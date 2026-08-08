import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { autoTick, autoTickMonths } from './harness';
import { toPublicView } from '../engine/selectors';
import { saveToSlot, loadFromSlot } from '../save/saveGame';
import {
  ASSETS,
  PLATFORMS,
  assetById,
  assetEffects,
  canBuy,
  canPost,
  driftFollowers,
  formatFollowers,
  totalFollowers,
} from '../engine/activities';
import {
  INTERACTIONS,
  ROLE_CATEGORY,
  canInteract,
  interactionsFor,
} from '../engine/people';
import {
  buyAsset,
  interactWith,
  joinPlatform,
  makePost,
} from '../engine/lifeActions';
import { DecisionError } from '../engine/decisions';
import { migrate } from '../save/db';
import { SCHEMA_VERSION, type GameState } from '../engine/types';

/**
 * PHASE 11 VERIFICATION
 *
 * The life layer: named people with their own interaction menus (SPEC §6),
 * money that buys things which then matter (SPEC §6), and social reach that
 * follows on-court results rather than replacing them (SPEC §12).
 *
 * The load-bearing assertions are the ones about *limits*: one interaction
 * per person per month, one post per platform per month, and bounded stacking
 * on the asset multipliers. Without those this layer is a clicker.
 */

const INPUT: CreationInput = {
  name: 'Marcus Vale',
  position: 'SG',
  jerseyNumber: 3,
  handedness: 'right',
  homeCity: 'Gary',
  homeState: 'Indiana',
  schoolTier: 'public',
};

/** Give the run enough money to shop without waiting six years for it. */
function withMoney(state: GameState, money: number): GameState {
  return { ...state, money };
}

describe('the people are people (SPEC §6)', () => {
  test('a career starts with a named household', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed, INPUT);
      expect(state.people.length).toBeGreaterThan(0);

      for (const person of state.people) {
        expect(person.name.trim().length).toBeGreaterThan(0);
        // First and last name, not a bare label.
        expect(person.name.split(/\s+/).length).toBeGreaterThanOrEqual(2);
        expect(person.age).toBeGreaterThan(0);
        expect(person.relationship).toBeGreaterThanOrEqual(0);
        expect(person.relationship).toBeLessThanOrEqual(100);
        expect(person.lastInteractionMonth).toBe(-1);
      }

      // Everyone is either a parent figure, a sibling or a friend at 13.
      expect(state.people.some((p) => p.role === 'mother')).toBe(true);
    }
  });

  test('family structure decides who is actually in the house', () => {
    let sawTwoParent = false;
    let sawSingle = false;

    for (let seed = 1; seed <= 60; seed++) {
      const state = createGame(seed, INPUT);
      const fathers = state.people.filter((p) => p.role === 'father').length;

      if (state.origin.familyStructure === 'two-parent') {
        sawTwoParent = true;
        expect(fathers).toBe(1);
      }
      if (state.origin.familyStructure === 'single-parent') {
        sawSingle = true;
        // The whole point of the origin roll is that it changes the household.
        expect(fathers).toBe(0);
      }
    }

    expect(sawTwoParent).toBe(true);
    expect(sawSingle).toBe(true);
  });

  test('every role has at least one thing you can do with them', () => {
    for (const role of Object.keys(ROLE_CATEGORY) as (keyof typeof ROLE_CATEGORY)[]) {
      expect(interactionsFor(role).length).toBeGreaterThan(0);
    }
    // And nothing is offered to a role it makes no sense for.
    expect(interactionsFor('mother').some((i) => i.id === 'dateNight')).toBe(false);
    expect(interactionsFor('partner').some((i) => i.id === 'dateNight')).toBe(true);
  });

  test('one interaction per person per month, and the engine enforces it', () => {
    const state = createGame(7, INPUT);
    const target = state.people[0];

    const after = interactWith(state, target.id, 'talk');
    const updated = after.people.find((p) => p.id === target.id)!;
    expect(updated.lastInteractionMonth).toBe(after.monthsElapsed);
    expect(canInteract(updated, after.monthsElapsed)).toBe(false);

    expect(() => interactWith(after, target.id, 'talk')).toThrow(DecisionError);

    // The clock ticking over opens it back up.
    const nextMonth = autoTick(after, []);
    const later = nextMonth.people.find((p) => p.id === target.id)!;
    expect(canInteract(later, nextMonth.monthsElapsed)).toBe(true);
  });

  test('interactions move the individual and the aggregate bucket', () => {
    const state = createGame(11, INPUT);
    const mother = state.people.find((p) => p.role === 'mother')!;
    const before = state.relationships.parents.level;

    const after = interactWith(state, mother.id, 'spendTime');
    const updated = after.people.find((p) => p.id === mother.id)!;

    expect(updated.relationship).toBeGreaterThan(mother.relationship);
    expect(after.relationships.parents.level).toBeGreaterThan(before);

    // The bucket moves at half rate: one parent is not the whole family.
    const individualDelta = updated.relationship - mother.relationship;
    const bucketDelta = after.relationships.parents.level - before;
    expect(bucketDelta).toBeLessThan(individualDelta);
  });

  test('arguing costs you, which is the point of it being on the menu', () => {
    // Averaged: a single argument can land softly, but the expectation is
    // clearly negative.
    let total = 0;
    const runs = 40;

    for (let seed = 1; seed <= runs; seed++) {
      const state = createGame(seed, INPUT);
      const target = state.people[0];
      const after = interactWith(state, target.id, 'argue');
      const updated = after.people.find((p) => p.id === target.id)!;
      total += updated.relationship - target.relationship;
    }

    expect(total / runs).toBeLessThan(-5);
  });

  test('a gift you cannot afford is refused rather than putting you in debt', () => {
    const broke = withMoney(createGame(3, INPUT), 0);
    const target = broke.people[0];
    expect(() => interactWith(broke, target.id, 'gift')).toThrow(DecisionError);
    expect(broke.money).toBe(0);
  });

  test('people drift apart when you leave them alone (SPEC §6)', () => {
    const state = createGame(5, INPUT);
    const before = state.people[0].relationship;

    // Two years of never speaking to anyone.
    const later = autoTickMonths(state, 24);
    const after = later.people.find((p) => p.id === state.people[0].id)!;

    expect(after.relationship).toBeLessThan(before);
  });

  test('tending a relationship beats neglecting it over the same span', () => {
    const state = createGame(9, INPUT);
    const targetId = state.people[0].id;

    let neglected = state;
    let tended = state;
    for (let i = 0; i < 18; i++) {
      neglected = autoTick(neglected, []);
      tended = interactWith(tended, targetId, 'spendTime');
      tended = autoTick(tended, []);
    }

    const a = neglected.people.find((p) => p.id === targetId)!;
    const b = tended.people.find((p) => p.id === targetId)!;
    expect(b.relationship).toBeGreaterThan(a.relationship);
  });

  test('people age with the calendar', () => {
    const state = createGame(4, INPUT);
    const before = state.people[0].age;
    const later = autoTickMonths(state, 36);
    const after = later.people.find((p) => p.id === state.people[0].id)!;
    expect(after.age).toBeGreaterThan(before);
    expect(after.age).toBeLessThanOrEqual(before + 4);
  });
});

describe('the money buys something (SPEC §6)', () => {
  test('the catalog is internally consistent', () => {
    const ids = new Set<string>();
    for (const def of ASSETS) {
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      expect(def.price).toBeGreaterThan(0);
      expect(def.label.trim().length).toBeGreaterThan(0);
      expect(def.detail.trim().length).toBeGreaterThan(0);
      if (def.trainingBonus) expect(def.trainingBonus).toBeGreaterThan(1);
      if (def.injuryFactor) expect(def.injuryFactor).toBeLessThan(1);
    }
    // Something is affordable on day one, and something never is.
    const start = createGame(1, INPUT);
    expect(ASSETS.some((a) => a.price <= start.money)).toBe(true);
    expect(ASSETS.some((a) => a.price > 1_000_000)).toBe(true);
  });

  test('you cannot buy what you cannot afford, own twice, or unlock early', () => {
    const state = withMoney(createGame(2, INPUT), 100);

    expect(() => buyAsset(state, 'estate')).toThrow(DecisionError);
    expect(() => buyAsset(state, 'not-a-thing')).toThrow(DecisionError);

    const bought = buyAsset(state, 'ball');
    expect(bought.assets).toHaveLength(1);
    expect(bought.money).toBe(100 - assetById('ball')!.price);
    expect(() => buyAsset(bought, 'ball')).toThrow(DecisionError);

    // Rich but still in high school: the pro-tier items stay locked.
    const rich = withMoney(createGame(2, INPUT), 50_000_000);
    expect(rich.stage).toBe('highschool');
    expect(canBuy(assetById('estate')!, [], rich.money, rich.stage).ok).toBe(false);
  });

  test('owned things stack, but the stacking is bounded', () => {
    const everything = ASSETS.map((a) => ({
      id: a.id,
      purchasedMonth: 0,
      price: a.price,
    }));
    const effects = assetEffects(everything);

    expect(effects.trainingBonus).toBeGreaterThan(1);
    expect(effects.trainingBonus).toBeLessThanOrEqual(1.45);
    expect(effects.injuryFactor).toBeGreaterThanOrEqual(0.72);
    expect(effects.injuryFactor).toBeLessThan(1);
    expect(effects.energyPerMonth).toBeLessThanOrEqual(14);
    expect(assetEffects([]).trainingBonus).toBe(1);
  });

  test('training equipment actually changes how a player develops', () => {
    // Same seed, same actions, same everything — the only difference is a
    // hoop in the driveway and a trainer on retainer.
    let bare = withMoney(createGame(21, INPUT), 200_000);
    let equipped = withMoney(createGame(21, INPUT), 200_000);
    for (const id of ['driveway-hoop', 'gym-membership', 'shooting-machine', 'private-trainer']) {
      equipped = buyAsset(equipped, id);
    }

    // One action a month, so it fits every phase's budget including the
    // one-point postseason.
    const work = [{ id: 'shooting' as const }];
    for (let i = 0; i < 30; i++) {
      bare = autoTick(bare, work);
      equipped = autoTick(equipped, work);
    }

    const a = toPublicView(bare).player.overall;
    const b = toPublicView(equipped).player.overall;
    expect(b).toBeGreaterThan(a);
  });

  test('buying is off the action economy — it never costs a month', () => {
    const state = withMoney(createGame(6, INPUT), 100_000);
    const bought = buyAsset(state, 'driveway-hoop');
    expect(bought.monthsElapsed).toBe(state.monthsElapsed);
    expect(bought.clock).toEqual(state.clock);
    // And it does not silently consume randomness either.
    expect(bought.rngState).toEqual(state.rngState);
  });
});

describe('social reach follows results (SPEC §12)', () => {
  test('every platform is reachable and distinct', () => {
    const ids = new Set(PLATFORMS.map((p) => p.id));
    expect(ids.size).toBe(PLATFORMS.length);
    for (const p of PLATFORMS) {
      expect(p.growth).toBeGreaterThan(0);
      expect(p.virality).toBeGreaterThan(0);
    }
  });

  test('you join once, and posting is capped at one per platform per month', () => {
    const state = createGame(8, INPUT);
    expect(state.social).toHaveLength(0);

    const joined = joinPlatform(state, 'tiktok');
    expect(joined.social).toHaveLength(1);
    expect(() => joinPlatform(joined, 'tiktok')).toThrow(DecisionError);
    expect(() => makePost(state, 'tiktok', 'workout')).toThrow(DecisionError);

    const posted = makePost(joined, 'tiktok', 'workout');
    expect(canPost(posted.social[0], posted.monthsElapsed)).toBe(false);
    expect(() => makePost(posted, 'tiktok', 'workout')).toThrow(DecisionError);

    const nextMonth = autoTick(posted, []);
    expect(canPost(nextMonth.social[0], nextMonth.monthsElapsed)).toBe(true);
  });

  test('posting grows followers, and posting more grows them more', () => {
    let quiet = joinPlatform(createGame(12, INPUT), 'instagram');
    let loud = joinPlatform(createGame(12, INPUT), 'instagram');

    for (let i = 0; i < 24; i++) {
      quiet = autoTick(quiet, []);
      loud = makePost(loud, 'instagram', 'workout');
      loud = autoTick(loud, []);
    }

    expect(totalFollowers(loud.social)).toBeGreaterThan(
      totalFollowers(quiet.social),
    );
  });

  test('reach is downstream of results, not a substitute for them', () => {
    // A player who is actually producing gets more out of the same post than
    // one who is not. Built by handing the same account two different hype
    // levels and posting a highlight on both.
    const base = joinPlatform(createGame(15, INPUT), 'tiktok');

    const cold: GameState = { ...base, hype: { ...base.hype, hype: 2 } };
    const hot: GameState = { ...base, hype: { ...base.hype, hype: 85 } };

    let coldTotal = 0;
    let hotTotal = 0;
    for (let i = 0; i < 25; i++) {
      const seedShift = { s: base.rngState.s + i * 7717, calls: 0 };
      coldTotal += makePost(
        { ...cold, rngState: seedShift },
        'tiktok',
        'highlight',
      ).social[0].followers;
      hotTotal += makePost(
        { ...hot, rngState: seedShift },
        'tiktok',
        'highlight',
      ).social[0].followers;
    }

    expect(hotTotal).toBeGreaterThan(coldTotal);
  });

  test('talking your talk costs you with the coach', () => {
    const state = joinPlatform(createGame(18, INPUT), 'x');
    const after = makePost(state, 'x', 'callout');
    expect(after.coachTrust).toBeLessThan(state.coachTrust);

    const safe = makePost(state, 'x', 'workout');
    expect(safe.coachTrust).toBeGreaterThanOrEqual(state.coachTrust);
  });

  test('followers decay when you go quiet', () => {
    const account = {
      id: 'youtube' as const,
      followers: 100_000,
      joinedMonth: 0,
      lastPostMonth: 0,
      viralPosts: 0,
    };
    // Six months of silence with nothing else going on.
    const quiet = driftFollowers([account], 6, 0);
    expect(quiet[0].followers).toBeLessThan(account.followers);

    // A career that is going well grows on its own.
    const humming = driftFollowers([account], 1, 90);
    expect(humming[0].followers).toBeGreaterThan(account.followers);
  });

  test('follower counts read like follower counts', () => {
    expect(formatFollowers(420)).toBe('420');
    expect(formatFollowers(4200)).toBe('4.2K');
    expect(formatFollowers(4_200_000)).toBe('4.2M');
  });

  test('hype gained from posting is bounded — reach is not a scholarship', () => {
    let state = joinPlatform(createGame(19, INPUT), 'tiktok');
    state = joinPlatform(state, 'instagram');
    state = joinPlatform(state, 'youtube');

    // Three years of posting on everything, every month, and nothing else.
    for (let i = 0; i < 36; i++) {
      for (const id of ['tiktok', 'instagram', 'youtube'] as const) {
        if (state.social.some((a) => a.id === id)) {
          state = makePost(state, id, 'highlight');
        }
      }
      state = autoTick(state, []);
    }

    expect(state.hype.hype).toBeLessThanOrEqual(100);
    // Posting alone does not make you a top-50 recruit.
    expect(state.hype.nationalRank).toBeGreaterThan(50);
  });
});

describe('the life layer survives the save (SPEC §16)', () => {
  test('people, assets and accounts round-trip exactly', async () => {
    let state = withMoney(createGame(23, INPUT), 60_000);
    state = buyAsset(state, 'driveway-hoop');
    state = joinPlatform(state, 'tiktok');
    state = makePost(state, 'tiktok', 'highlight');
    state = interactWith(state, state.people[0].id, 'compliment');
    state = autoTickMonths(state, 5);

    await saveToSlot(0, state);
    const loaded = await loadFromSlot(0);

    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(state);
    expect(loaded!.people).toEqual(state.people);
    expect(loaded!.assets).toEqual(state.assets);
    expect(loaded!.social).toEqual(state.social);

    // And the stream is still in step: the next month matches either way.
    expect(autoTick(loaded!, [])).toEqual(autoTick(state, []));
  });

  test('the public view exposes the life layer and still hides the genetics', () => {
    let state = withMoney(createGame(24, INPUT), 5_000);
    state = buyAsset(state, 'first-car');
    state = joinPlatform(state, 'instagram');

    const view = toPublicView(state);
    expect(view.people.length).toBeGreaterThan(0);
    expect(view.assets).toHaveLength(1);
    expect(view.social).toHaveLength(1);

    const dumped = JSON.stringify(view);
    expect(dumped).not.toContain('heightCeiling');
    expect(dumped).not.toContain('potential');
    expect(dumped).not.toContain('injuryProneness');
  });

  test('a long career with the whole layer exercised still ends cleanly', () => {
    let state = withMoney(createGame(25, INPUT), 250_000);
    state = joinPlatform(state, 'tiktok');

    for (let i = 0; i < 200 && !state.careerEnd; i++) {
      // Buy whatever is affordable, keep in touch, keep posting.
      for (const def of ASSETS) {
        if (canBuy(def, state.assets, state.money, state.stage).ok) {
          state = buyAsset(state, def.id);
        }
      }
      const someone = state.people.find((p) =>
        canInteract(p, state.monthsElapsed),
      );
      if (someone) state = interactWith(state, someone.id, 'talk');
      if (canPost(state.social[0], state.monthsElapsed)) {
        state = makePost(state, 'tiktok', 'highlight');
      }
      state = autoTick(state, [{ id: 'shooting' }]);
    }

    expect(state.careerEnd).not.toBeNull();
    expect(state.money).toBeGreaterThanOrEqual(0);
    for (const person of state.people) {
      expect(person.relationship).toBeGreaterThanOrEqual(0);
      expect(person.relationship).toBeLessThanOrEqual(100);
    }
    for (const account of state.social) {
      expect(Number.isFinite(account.followers)).toBe(true);
      expect(account.followers).toBeGreaterThanOrEqual(0);
    }
  });

  test('the interaction catalog has no dead entries', () => {
    const state = createGame(26, INPUT);
    for (const def of INTERACTIONS) {
      const person = state.people.find(
        (p) => !def.roles || def.roles.includes(p.role),
      );
      if (!person) continue;
      const funded = withMoney(state, 10_000);
      const after = interactWith(funded, person.id, def.id);
      // Every entry does *something* — money, energy, or the relationship.
      const updated = after.people.find((p) => p.id === person.id)!;
      const moved =
        updated.relationship !== person.relationship ||
        after.money !== funded.money ||
        updated.role !== person.role;
      expect(moved).toBe(true);
    }
  });
});

describe('an existing career survives the schema bump (SPEC §16.1)', () => {
  test('a v5 save is carried forward rather than thrown away', async () => {
    // Build a real career, then strip it back to what a v5 build wrote:
    // no people, no assets, no accounts.
    const current = autoTickMonths(createGame(31, INPUT), 30);
    const { people, assets, social, ...rest } = current;
    const legacy = { ...rest, schemaVersion: 5 } as unknown as GameState;

    const migrated = migrate({
      slot: 0,
      schemaVersion: 5,
      savedAt: Date.now(),
      displayName: 'legacy',
      state: legacy,
    });

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.assets).toEqual([]);
    expect(migrated.social).toEqual([]);
    expect(migrated.people.length).toBeGreaterThan(0);

    // The career itself is untouched — same month, same body, same stream.
    expect(migrated.monthsElapsed).toBe(current.monthsElapsed);
    expect(migrated.rngState).toEqual(current.rngState);
    expect(migrated.player.body).toEqual(current.player.body);

    // The household is aged to the career, not left at thirteen.
    const years = Math.floor(current.monthsElapsed / 12);
    expect(years).toBeGreaterThan(0);
    const fresh = createGame(31, INPUT);
    expect(Math.min(...migrated.people.map((p) => p.age))).toBeGreaterThanOrEqual(
      Math.min(...fresh.people.map((p) => p.age)),
    );

    // And it plays on.
    const next = autoTick(migrated, []);
    expect(next.monthsElapsed).toBe(current.monthsElapsed + 1);
    expect(next.careerEnd).toBeNull();
  });

  test('a schema with no migration path still refuses rather than half-loading', () => {
    const state = createGame(32, INPUT);
    expect(() =>
      migrate({
        slot: 0,
        schemaVersion: 2,
        savedAt: Date.now(),
        displayName: 'ancient',
        state,
      }),
    ).toThrow(/Unsupported save schema/);
  });
});
