import { clamp, createRng } from './rng';
import {
  assetById,
  canBuy,
  canPost,
  platformById,
  post,
  type PostKind,
} from './activities';
import {
  ROLE_CATEGORY,
  canInteract,
  interact,
  interactionsFor,
  type InteractionId,
} from './people';
import {
  fameFor,
  nightById,
  nightlifeUnlocked,
  resolveNight,
} from './nightlife';
import { totalFollowers } from './activities';
import { ageYearsOf } from './stages';
import { DecisionError } from './decisions';
import type {
  GameState,
  LogEntry,
  SocialAccount,
  SocialPlatformId,
} from './types';
import type { NightId } from './nightlife';

/**
 * The player-driven side of life outside the tick (SPEC §6, §12).
 *
 * Same contract as `decisions.ts`: pure functions taking and returning
 * `GameState`, consuming the single RNG stream so a career stays reproducible
 * whether or not the player went shopping.
 */

function append(
  state: GameState,
  text: string,
  kind: LogEntry['kind'] = 'life',
): LogEntry[] {
  return [
    ...state.log,
    {
      monthsElapsed: state.monthsElapsed,
      year: state.clock.year,
      month: state.clock.month,
      kind,
      text,
    },
  ];
}

// --- People ---------------------------------------------------------------

/**
 * Do something with someone.
 *
 * The individual's number moves fully; the aggregate bucket it feeds moves at
 * half rate, so one good conversation with one of two parents does not swing
 * the whole "parents" relationship.
 */
export function interactWith(
  state: GameState,
  personId: string,
  interaction: InteractionId,
): GameState {
  const person = state.people.find((p) => p.id === personId);
  if (!person) throw new DecisionError('No such person');
  if (!canInteract(person)) {
    throw new DecisionError(`${person.name} is not in your life any more`);
  }

  const ageYears = ageYearsOf(state);
  if (!interactionsFor(person.role, ageYears).some((i) => i.id === interaction)) {
    throw new DecisionError('That is not something you can do with them');
  }

  const rng = createRng(state.rngState);
  const result = interact(person, interaction, state.monthsElapsed, rng);

  if (state.money + result.moneyDelta < 0) {
    throw new DecisionError('You cannot afford that');
  }

  const category = ROLE_CATEGORY[person.role];
  const existing = state.relationships[category];

  return {
    ...state,
    rngState: rng.state(),
    money: state.money + result.moneyDelta,
    people: state.people.map((p) => (p.id === personId ? result.person : p)),
    relationships: {
      ...state.relationships,
      [category]: {
        ...existing,
        level: clamp(existing.level + result.categoryDelta, 0, 100),
        active: result.ended && category === 'girlfriend' ? false : existing.active,
      },
    },
    condition: {
      ...state.condition,
      energy: clamp(state.condition.energy + result.energyDelta, 0, 100),
    },
    nightlife: {
      ...state.nightlife,
      distraction: clamp(
        state.nightlife.distraction + result.distractionDelta,
        0,
        100,
      ),
    },
    log: append(state, result.outcome),
  };
}

// --- Assets ---------------------------------------------------------------

export function buyAsset(state: GameState, assetId: string): GameState {
  const def = assetById(assetId);
  if (!def) throw new DecisionError('No such thing to buy');

  const check = canBuy(def, state.assets, state.money, state.stage);
  if (!check.ok) throw new DecisionError(check.reason ?? 'You cannot buy that');

  const joy = def.joy ?? 0;

  return {
    ...state,
    money: state.money - def.price,
    assets: [
      ...state.assets,
      { id: def.id, purchasedMonth: state.monthsElapsed, price: def.price },
    ],
    // Buying your mother a house is worth something on the floor the next
    // week. Confidence carries across games (SPEC §6), so this is where it
    // lands rather than in a one-off message.
    player: {
      ...state.player,
      hiddenMeta: {
        ...state.player.hiddenMeta,
        confidence: clamp(state.player.hiddenMeta.confidence + joy * 0.4, 0, 100),
      },
    },
    log: append(
      state,
      `You bought ${def.label.toLowerCase()} for $${def.price.toLocaleString()}.`,
    ),
  };
}

// --- Social ---------------------------------------------------------------

export function joinPlatform(
  state: GameState,
  platformId: SocialPlatformId,
): GameState {
  if (state.social.some((a) => a.id === platformId)) {
    throw new DecisionError('You are already on there');
  }

  const platform = platformById(platformId);
  const account: SocialAccount = {
    id: platformId,
    // Whatever reach you already have follows you over.
    followers: Math.round(120 + state.hype.hype * 14),
    joinedMonth: state.monthsElapsed,
    lastPostMonth: -1,
    viralPosts: 0,
  };

  return {
    ...state,
    social: [...state.social, account],
    log: append(state, `You signed up for ${platform.label}.`),
  };
}

/**
 * Post something.
 *
 * `performance` is the recent on-court signal the algorithm is really
 * reacting to — reach follows results rather than replacing them (SPEC §12).
 */
export function makePost(
  state: GameState,
  platformId: SocialPlatformId,
  kind: PostKind,
): GameState {
  const account = state.social.find((a) => a.id === platformId);
  if (!account) throw new DecisionError('You are not on that platform');
  if (!canPost(account, state.monthsElapsed)) {
    throw new DecisionError('You already posted there this month');
  }

  const played = (state.season?.schedule ?? []).filter((g) => g.played);
  const last = played.slice(-5);
  const ppg = last.length
    ? last.reduce((sum, g) => sum + g.box.points, 0) / last.length
    : 0;
  const performance = clamp(ppg * 3 + state.hype.hype * 0.4, 0, 100);

  const rng = createRng(state.rngState);
  const result = post(
    account,
    kind,
    { performance, hype: state.hype.hype, monthsElapsed: state.monthsElapsed },
    rng,
  );

  return {
    ...state,
    rngState: rng.state(),
    social: state.social.map((a) => (a.id === platformId ? result.account : a)),
    hype: {
      ...state.hype,
      hype: clamp(state.hype.hype + result.hypeDelta, 0, 100),
    },
    coachTrust: clamp(state.coachTrust + result.coachTrustDelta, 0, 100),
    log: append(state, result.outcome),
  };
}

// --- Nights ---------------------------------------------------------------

/**
 * Spend a night.
 *
 * There is no limit on how many you take — that is the point of it being a
 * lifestyle rather than a menu. The limiters are the ones a real life uses:
 * money, energy, the diminishing return on the fourth night in a row, and the
 * fact that everything you do now happens in front of more people than it did
 * last season.
 */
export function goOut(state: GameState, nightId: NightId): GameState {
  const def = nightById(nightId);
  if (!def) throw new DecisionError('No such night');

  const ageYears = ageYearsOf(state);
  if (!nightlifeUnlocked(ageYears)) {
    throw new DecisionError('You are not old enough for that');
  }
  if (state.money < def.cost) {
    throw new DecisionError('You cannot afford that');
  }

  const partner =
    state.people.find(
      (p) => p.active && (p.role === 'partner' || p.role === 'fling'),
    ) ?? null;

  const rng = createRng(state.rngState);
  const result = resolveNight(
    def,
    {
      stage: state.stage,
      ageYears,
      fame: fameFor(state.stage, state.hype.hype, totalFollowers(state.social)),
      monthsElapsed: state.monthsElapsed,
      nightsThisMonth: state.nightlife.nightsThisMonth,
      partner,
      playerSurname:
        state.player.name.trim().split(/\s+/).slice(-1)[0] || 'Vale',
    },
    rng,
  );

  // The partner takes the hit, and sometimes ends it.
  let people = state.people;
  if (partner && (result.partnerDelta !== 0 || result.partnerEnded)) {
    people = people.map((p) =>
      p.id === partner.id
        ? {
            ...p,
            relationship: clamp(p.relationship + result.partnerDelta, 0, 100),
            ...(result.partnerEnded
              ? { role: 'ex' as const, exclusive: false }
              : {}),
          }
        : p,
    );
  }
  // Somebody new only stays in your life if there was room for them.
  if (result.metPerson && !result.partnerEnded && !partner) {
    people = [...people, result.metPerson];
  }

  const girlfriend = state.relationships.girlfriend;

  return {
    ...state,
    rngState: rng.state(),
    money: state.money + result.moneyDelta,
    people,
    condition: {
      ...state.condition,
      energy: clamp(state.condition.energy + result.energyDelta, 0, 100),
    },
    player: {
      ...state.player,
      hiddenMeta: {
        ...state.player.hiddenMeta,
        confidence: clamp(
          state.player.hiddenMeta.confidence + result.joyDelta * 0.35,
          0,
          100,
        ),
      },
    },
    coachTrust: clamp(state.coachTrust + result.coachTrustDelta, 0, 100),
    hype: {
      ...state.hype,
      hype: clamp(state.hype.hype + result.hypeDelta, 0, 100),
    },
    reputation: {
      ...state.reputation,
      offCourt: clamp(state.reputation.offCourt + result.offCourtDelta, 0, 100),
    },
    relationships: {
      ...state.relationships,
      friends: {
        ...state.relationships.friends,
        level: clamp(
          state.relationships.friends.level + result.socialDelta * 0.4,
          0,
          100,
        ),
      },
      girlfriend: {
        ...girlfriend,
        level: clamp(girlfriend.level + result.partnerDelta * 0.6, 0, 100),
        active: result.partnerEnded
          ? false
          : girlfriend.active || Boolean(result.metPerson && !partner),
      },
    },
    nightlife: {
      ...state.nightlife,
      distraction: clamp(
        state.nightlife.distraction + result.distractionDelta,
        0,
        100,
      ),
      nightsThisMonth: state.nightlife.nightsThisMonth + 1,
      nightsOut: state.nightlife.nightsOut + 1,
      flings: state.nightlife.flings + (result.metPerson ? 1 : 0),
      tabloidStories: state.nightlife.tabloidStories + (result.tabloid ? 1 : 0),
      caught: state.nightlife.caught + (result.caught ? 1 : 0),
    },
    log: [
      ...state.log,
      ...result.outcome.map((text) => ({
        monthsElapsed: state.monthsElapsed,
        year: state.clock.year,
        month: state.clock.month,
        kind: 'life' as const,
        text,
      })),
    ],
  };
}
