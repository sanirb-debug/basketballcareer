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
  partyById,
  resolveNight,
  resolveParty,
  type PartyId,
} from './nightlife';
import {
  DATES,
  GESTATION_MONTHS,
  askOutChance,
  canPropose,
  datesFor,
  generateCandidates,
  intimacyById,
  proposalChance,
  ringCost,
  romanceUnlocked,
  unmarriedPregnancyFallout,
  weddingTier,
  type DateId,
  type IntimacyId,
  type WeddingTierId,
} from './dating';
import { hasProperty, totalFollowers } from './activities';
import { ageYearsOf } from './stages';
import { DecisionError } from './decisions';
import type {
  GameState,
  LogEntry,
  Person,
  SocialAccount,
  SocialPlatformId,
} from './types';
import { romanceAtLeast } from './types';
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

  const partner = activePartner(state);

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

// --- Romance --------------------------------------------------------------

/** The one person you are currently seeing, if there is one. */
export function activePartner(state: GameState): Person | null {
  return state.people.find((p) => p.active && p.role === 'partner') ?? null;
}

function requireAdult(state: GameState): number {
  const ageYears = ageYearsOf(state);
  if (!romanceUnlocked(ageYears)) {
    throw new DecisionError('You are not old enough for that');
  }
  return ageYears;
}

function fameOf(state: GameState): number {
  return fameFor(state.stage, state.hype.hype, totalFollowers(state.social));
}

/**
 * Look around.
 *
 * Refreshing the pool is free but it replaces what was there — you cannot
 * hoard candidates until the perfect one turns up, which is the entire point
 * of modelling it as a pool rather than a catalogue.
 */
export function meetPeople(state: GameState): GameState {
  const ageYears = requireAdult(state);

  const rng = createRng(state.rngState);
  const candidates = generateCandidates(rng, {
    stage: state.stage,
    ageYears,
    fame: fameOf(state),
  });

  return {
    ...state,
    rngState: rng.state(),
    dating: { candidates, refreshedMonth: state.monthsElapsed },
    log: append(state, 'You put yourself out there a bit.'),
  };
}

/** Ask somebody out. They are allowed to say no. */
export function askOut(state: GameState, candidateId: string): GameState {
  requireAdult(state);

  const candidate = state.dating.candidates.find((c) => c.id === candidateId);
  if (!candidate) throw new DecisionError('They are not around any more');
  if (activePartner(state)) {
    throw new DecisionError('You are already seeing somebody');
  }

  const rng = createRng(state.rngState);
  const chance = askOutChance(
    candidate,
    fameOf(state),
    state.player.attributes.leadership as number,
  );
  const yes = rng.chance(chance);

  const remaining = state.dating.candidates.filter((c) => c.id !== candidateId);

  if (!yes) {
    return {
      ...state,
      rngState: rng.state(),
      dating: { ...state.dating, candidates: remaining },
      log: append(
        state,
        `${candidate.name} was kind about it, and the answer was still no.`,
      ),
    };
  }

  const person: Person = {
    id: `partner-${candidate.id}`,
    name: candidate.name,
    role: 'partner',
    age: candidate.age,
    relationship: clamp(candidate.interest * 0.55 + 18, 0, 100),
    alive: true,
    active: true,
    lastInteractionMonth: -1,
    interactionsThisMonth: 0,
    exclusive: false,
    metMonth: state.monthsElapsed,
    romance: 'flirting',
    metVia: candidate.metVia,
  };

  return {
    ...state,
    rngState: rng.state(),
    people: [...state.people, person],
    dating: { ...state.dating, candidates: remaining },
    relationships: {
      ...state.relationships,
      girlfriend: { ...state.relationships.girlfriend, active: true },
    },
    log: append(
      state,
      `You asked ${candidate.name} out — met ${candidate.metVia} — and she said yes.`,
    ),
  };
}

/**
 * Take them somewhere.
 *
 * Dates are how a romance actually advances: the stage moves when the
 * relationship number earns it, rather than on a button that says "become
 * exclusive".
 */
export function goOnDate(state: GameState, dateId: DateId): GameState {
  requireAdult(state);

  const partner = activePartner(state);
  if (!partner) throw new DecisionError('There is nobody to take anywhere');

  const def = DATES.find((d) => d.id === dateId);
  if (!def) throw new DecisionError('No such plan');
  if (!datesFor(partner, partner.relationship).some((d) => d.id === dateId)) {
    throw new DecisionError('It is not at that point yet');
  }
  if (state.money < def.cost) throw new DecisionError('You cannot afford that');

  const rng = createRng(state.rngState);

  // A good night is not guaranteed, and compatibility is the thing you cannot
  // see. Warmth lands somewhere between a third and full value.
  const quality = rng.float(0.35, 1.15);
  const delta = def.warmth * quality;
  const relationship = clamp(partner.relationship + delta, 0, 100);

  const notes: string[] = [
    quality > 0.9
      ? `${def.label} with ${partner.name}, and neither of you wanted to call it a night.`
      : quality > 0.6
        ? `${def.label} with ${partner.name}. Easy, and it went quickly.`
        : `${def.label} with ${partner.name}. Fine. A bit quiet in the middle.`,
  ];

  // Progression — earned, and announced when it happens.
  let romance = partner.romance ?? 'flirting';
  if (romance === 'flirting' && relationship >= 45) {
    romance = 'dating';
    notes.push(`You and ${partner.name} are seeing each other properly now.`);
  } else if (romance === 'dating' && relationship >= 68) {
    romance = 'exclusive';
    notes.push(
      `Neither of you is seeing anybody else, and now you have both said so.`,
    );
  }

  const tabloid =
    def.exposure > 0 && rng.chance(clamp((fameOf(state) / 100) * def.exposure * 0.25, 0, 0.6));
  if (tabloid) {
    notes.push(
      `Somebody got a picture. ${partner.name} is now a name people are searching.`,
    );
  }

  return {
    ...state,
    rngState: rng.state(),
    money: state.money - def.cost,
    people: state.people.map((p) =>
      p.id === partner.id
        ? { ...p, relationship, romance, exclusive: romance !== 'flirting' && romance !== 'dating' }
        : p,
    ),
    condition: {
      ...state.condition,
      energy: clamp(state.condition.energy - def.energy, 0, 100),
    },
    relationships: {
      ...state.relationships,
      girlfriend: {
        ...state.relationships.girlfriend,
        level: clamp(state.relationships.girlfriend.level + delta * 0.6, 0, 100),
        active: true,
      },
    },
    nightlife: {
      ...state.nightlife,
      distraction: clamp(state.nightlife.distraction - 3, 0, 100),
    },
    hype: {
      ...state.hype,
      hype: clamp(state.hype.hype + (tabloid ? 1.2 : 0), 0, 100),
    },
    log: [
      ...state.log,
      ...notes.map((text) => ({
        monthsElapsed: state.monthsElapsed,
        year: state.clock.year,
        month: state.clock.month,
        kind: 'life' as const,
        text,
      })),
    ],
  };
}

/**
 * The night itself.
 *
 * The engine models the door closing and what follows from it: the
 * relationship, and the risk you chose to take. Careful is not certain,
 * which is why there is a number on it at all.
 */
export function spendTheNight(
  state: GameState,
  intimacyId: IntimacyId,
): GameState {
  requireAdult(state);

  const partner = activePartner(state);
  if (!partner) throw new DecisionError('There is nobody to stay with');
  if (!romanceAtLeast(partner.romance, 'dating')) {
    throw new DecisionError('It is not at that point yet');
  }
  if (partner.dueMonth !== undefined) {
    throw new DecisionError(`${partner.name} is already expecting`);
  }

  const def = intimacyById(intimacyId);
  if (!def) throw new DecisionError('No such choice');

  const rng = createRng(state.rngState);
  const relationship = clamp(
    partner.relationship + rng.float(3, 9),
    0,
    100,
  );

  const notes: string[] = [
    intimacyId === 'careful'
      ? `A night in with ${partner.name}. The rest of it is nobody's business.`
      : `A night in with ${partner.name}, and neither of you was thinking about consequences.`,
  ];

  const expecting = rng.chance(def.risk);
  let people = state.people.map((p) =>
    p.id === partner.id ? { ...p, relationship } : p,
  );
  let offCourtDelta = 0;
  let distractionDelta = -5;
  let tabloid = false;

  if (expecting) {
    const married = partner.romance === 'married';
    people = people.map((p) =>
      p.id === partner.id
        ? { ...p, dueMonth: state.monthsElapsed + GESTATION_MONTHS }
        : p,
    );

    if (married) {
      notes.push(
        `${partner.name} is pregnant. You have been trying, and you both cried in a kitchen about it.`,
      );
      distractionDelta = 2;
    } else {
      const fallout = unmarriedPregnancyFallout(
        fameOf(state),
        partner.relationship,
      );
      offCourtDelta = fallout.offCourt;
      distractionDelta = fallout.distraction;
      tabloid = rng.chance(fallout.tabloidChance);

      notes.push(
        `${partner.name} is pregnant. You are not married, you have not talked about any of this, and you are both twenty-something in a hallway.`,
      );
      if (tabloid) {
        notes.push(
          'Your agent heard it from a reporter before he heard it from you.',
        );
      }
    }
  }

  return {
    ...state,
    rngState: rng.state(),
    people,
    reputation: {
      ...state.reputation,
      offCourt: clamp(state.reputation.offCourt + offCourtDelta, 0, 100),
    },
    nightlife: {
      ...state.nightlife,
      distraction: clamp(state.nightlife.distraction + distractionDelta, 0, 100),
      tabloidStories: state.nightlife.tabloidStories + (tabloid ? 1 : 0),
    },
    relationships: {
      ...state.relationships,
      girlfriend: {
        ...state.relationships.girlfriend,
        level: clamp(state.relationships.girlfriend.level + 4, 0, 100),
      },
    },
    log: [
      ...state.log,
      ...notes.map((text) => ({
        monthsElapsed: state.monthsElapsed,
        year: state.clock.year,
        month: state.clock.month,
        kind: 'life' as const,
        text,
      })),
    ],
  };
}

/** Ask. */
export function propose(state: GameState): GameState {
  requireAdult(state);

  const partner = activePartner(state);
  if (!partner) throw new DecisionError('There is nobody to ask');

  const check = canPropose(partner, state.monthsElapsed, state.money);
  if (!check.ok) throw new DecisionError(check.reason ?? 'Not yet');

  const cost = ringCost(state.money);
  const rng = createRng(state.rngState);
  const yes = rng.chance(proposalChance(partner, state.monthsElapsed));

  if (!yes) {
    return {
      ...state,
      rngState: rng.state(),
      money: state.money - cost,
      people: state.people.map((p) =>
        p.id === partner.id
          ? { ...p, relationship: clamp(p.relationship - 18, 0, 100) }
          : p,
      ),
      nightlife: {
        ...state.nightlife,
        distraction: clamp(state.nightlife.distraction + 12, 0, 100),
      },
      log: append(
        state,
        `${partner.name} said she was not ready. You are still holding the ring.`,
      ),
    };
  }

  return {
    ...state,
    rngState: rng.state(),
    money: state.money - cost,
    people: state.people.map((p) =>
      p.id === partner.id
        ? {
            ...p,
            romance: 'engaged' as const,
            exclusive: true,
            relationship: clamp(p.relationship + 10, 0, 100),
          }
        : p,
    ),
    player: {
      ...state.player,
      hiddenMeta: {
        ...state.player.hiddenMeta,
        confidence: clamp(state.player.hiddenMeta.confidence + 8, 0, 100),
      },
    },
    nightlife: {
      ...state.nightlife,
      distraction: clamp(state.nightlife.distraction - 10, 0, 100),
    },
    log: append(state, `${partner.name} said yes. You are getting married.`),
  };
}

/** Actually do it. */
export function marry(state: GameState, tierId: WeddingTierId): GameState {
  requireAdult(state);

  const partner = activePartner(state);
  if (!partner) throw new DecisionError('There is nobody to marry');
  if (partner.romance !== 'engaged') {
    throw new DecisionError('You have not asked yet');
  }

  const tier = weddingTier(tierId);
  if (!tier) throw new DecisionError('No such wedding');
  if (state.money < tier.cost) throw new DecisionError('You cannot afford that');

  const rng = createRng(state.rngState);
  const tabloid =
    tier.exposure > 0 &&
    rng.chance(clamp((fameOf(state) / 100) * tier.exposure * 0.3, 0, 0.85));

  const notes = [`You married ${partner.name}. ${tier.detail}`];
  if (tabloid) {
    notes.push('The photographs were everywhere by Monday. She handled it better than you did.');
  }

  return {
    ...state,
    rngState: rng.state(),
    money: state.money - tier.cost,
    people: state.people.map((p) =>
      p.id === partner.id
        ? {
            ...p,
            romance: 'married' as const,
            exclusive: true,
            relationship: clamp(p.relationship + 12, 0, 100),
          }
        : p,
    ),
    player: {
      ...state.player,
      hiddenMeta: {
        ...state.player.hiddenMeta,
        confidence: clamp(state.player.hiddenMeta.confidence + tier.joy * 0.4, 0, 100),
      },
    },
    reputation: {
      ...state.reputation,
      offCourt: clamp(state.reputation.offCourt + 6, 0, 100),
    },
    hype: {
      ...state.hype,
      hype: clamp(state.hype.hype + (tabloid ? tier.exposure : 0), 0, 100),
    },
    nightlife: {
      ...state.nightlife,
      distraction: clamp(state.nightlife.distraction - 18, 0, 100),
      tabloidStories: state.nightlife.tabloidStories + (tabloid ? 1 : 0),
    },
    relationships: {
      ...state.relationships,
      girlfriend: {
        ...state.relationships.girlfriend,
        level: clamp(state.relationships.girlfriend.level + 15, 0, 100),
        active: true,
      },
    },
    log: [
      ...state.log,
      ...notes.map((text) => ({
        monthsElapsed: state.monthsElapsed,
        year: state.clock.year,
        month: state.clock.month,
        kind: 'life' as const,
        text,
      })),
    ],
  };
}

// --- Parties --------------------------------------------------------------

export function throwParty(state: GameState, partyId: PartyId): GameState {
  const ageYears = requireAdult(state);
  void ageYears;

  const def = partyById(partyId);
  if (!def) throw new DecisionError('No such party');
  if (state.money < def.cost) throw new DecisionError('You cannot afford that');
  if (def.requiresProperty && !hasProperty(state.assets)) {
    throw new DecisionError('You need a place of your own first');
  }

  const rng = createRng(state.rngState);
  const result = resolveParty(
    def,
    { fame: fameOf(state), nightsThisMonth: state.nightlife.nightsThisMonth },
    rng,
  );

  return {
    ...state,
    rngState: rng.state(),
    money: state.money + result.moneyDelta,
    condition: {
      ...state.condition,
      energy: clamp(state.condition.energy + result.energyDelta, 0, 100),
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
          state.relationships.friends.level + result.socialDelta * 0.5,
          0,
          100,
        ),
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
      tabloidStories: state.nightlife.tabloidStories + (result.tabloid ? 1 : 0),
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
