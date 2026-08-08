import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { createRng, seedToState } from '../engine/rng';
import { autoTick, autoTickMonths } from './harness';
import { toPublicView } from '../engine/selectors';
import {
  askOut,
  goOnDate,
  marry,
  meetPeople,
  propose,
  spendTheNight,
  throwParty,
} from '../engine/lifeActions';
import { DecisionError } from '../engine/decisions';
import { ageYearsOf } from '../engine/stages';
import {
  CHILD,
  DATES,
  GESTATION_MONTHS,
  INTIMACY,
  ROMANCE_MIN_AGE,
  WEDDING_TIERS,
  canPropose,
  generateCandidates,
  ringCost,
} from '../engine/dating';
import { PARTIES, partyById } from '../engine/nightlife';
import { ASSETS, hasProperty } from '../engine/activities';
import { migrate } from '../save/db';
import { SCHEMA_VERSION, romanceAtLeast, type GameState } from '../engine/types';

/**
 * PHASE 13 VERIFICATION
 *
 * Dating, marriage, children and parties (SPEC §6).
 *
 * The spine of this file is the same as phase 12's: **the age gate holds**,
 * and **every step is earned rather than bought**. A romance that could be
 * fast-forwarded with money would make the whole system decorative, so the
 * gates on each stage are asserted individually and from the engine side.
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

function withMoney(state: GameState, money: number): GameState {
  return { ...state, money };
}

function adult(seed: number, money = 5_000_000): GameState {
  let state = createGame(seed, INPUT);
  while (ageYearsOf(state) < ROMANCE_MIN_AGE && !state.careerEnd) {
    state = autoTick(state, []);
  }
  return withMoney(state, money);
}

/** Get somebody into the career. The pool refreshes, so keep asking. */
function withPartner(seed: number, money = 5_000_000): GameState {
  let state = adult(seed, money);
  for (let i = 0; i < 60; i++) {
    if (state.people.some((p) => p.role === 'partner' && p.active)) break;
    state = meetPeople(state);
    const candidate = state.dating.candidates[0];
    if (candidate) {
      try {
        state = askOut(state, candidate.id);
      } catch {
        /* she said no; try the next one */
      }
    }
  }
  return withMoney(state, money);
}

function partnerOf(state: GameState) {
  return state.people.find((p) => p.role === 'partner' && p.active) ?? null;
}

/** Date until the romance reaches a stage, or give up. */
function dateUpTo(state: GameState, stage: 'dating' | 'exclusive'): GameState {
  let run = state;
  for (let i = 0; i < 40; i++) {
    const partner = partnerOf(run);
    if (!partner) break;
    if (romanceAtLeast(partner.romance, stage)) break;
    const available = DATES.filter((d) =>
      toPublicView(run).romance.dates.some((x) => x.id === d.id),
    );
    const pick = available[available.length - 1] ?? DATES[0];
    run = withMoney(goOnDate(run, pick.id), 5_000_000);
  }
  return run;
}

describe('the age gate holds for all of it (SPEC §6)', () => {
  test('none of the romance layer exists before eighteen', () => {
    const state = withMoney(createGame(1, INPUT), 10_000_000);
    expect(ageYearsOf(state)).toBeLessThan(ROMANCE_MIN_AGE);
    expect(toPublicView(state).romance.unlocked).toBe(false);

    expect(() => meetPeople(state)).toThrow(DecisionError);
    expect(() => askOut(state, 'anything')).toThrow(DecisionError);
    expect(() => goOnDate(state, 'dinner')).toThrow(DecisionError);
    expect(() => spendTheNight(state, 'careful')).toThrow(DecisionError);
    expect(() => propose(state)).toThrow(DecisionError);
    expect(() => marry(state, 'courthouse')).toThrow(DecisionError);
    for (const party of PARTIES) {
      expect(() => throwParty(state, party.id)).toThrow(DecisionError);
    }
  });

  test('everybody in the dating pool is an adult, at every stage', () => {
    // Driven straight at the generator so the assertion covers every venue
    // and every stage rather than whatever one career happened to roll.
    for (const seed of [12, 44, 91, 205, 777]) {
      for (const stage of ['college', 'juco', 'nba', 'overseas'] as const) {
        const rng = createRng(seedToState(seed));
        for (const c of generateCandidates(
          rng,
          { stage, ageYears: 18, fame: 70 },
          40,
        )) {
          expect(c.age).toBeGreaterThanOrEqual(ROMANCE_MIN_AGE);
        }
      }
    }
  });
});

describe('meeting people (SPEC §6)', () => {
  test('the pool is small, refreshable, and replaces itself', () => {
    let state = adult(3);
    expect(state.dating.candidates).toHaveLength(0);

    state = meetPeople(state);
    expect(state.dating.candidates.length).toBeGreaterThan(0);
    expect(state.dating.candidates.length).toBeLessThanOrEqual(4);
    const first = state.dating.candidates.map((c) => c.id);

    state = meetPeople(state);
    // Looking again replaces everyone — you cannot hoard candidates.
    expect(state.dating.candidates.map((c) => c.id)).not.toEqual(first);
  });

  test('candidates are people, not stat blocks', () => {
    let state = adult(4);
    state = meetPeople(state);
    for (const c of state.dating.candidates) {
      expect(c.name.split(/\s+/).length).toBeGreaterThanOrEqual(2);
      expect(c.blurb.length).toBeGreaterThan(20);
      expect(c.metVia.length).toBeGreaterThan(3);
      expect(c.interest).toBeGreaterThanOrEqual(0);
      expect(c.compatibility).toBeGreaterThanOrEqual(0);
    }
  });

  test('they are allowed to say no', () => {
    let state = adult(5);
    let asked = 0;
    let refused = 0;

    for (let i = 0; i < 60; i++) {
      state = meetPeople(state);
      const candidate = state.dating.candidates[0];
      if (!candidate) continue;
      const before = state.people.length;
      state = askOut(state, candidate.id);
      asked++;
      if (state.people.length === before) refused++;
      else {
        // Reset so we keep asking rather than stopping at the first yes.
        state = {
          ...state,
          people: state.people.filter((p) => p.role !== 'partner'),
        };
      }
    }

    expect(asked).toBeGreaterThan(30);
    expect(refused).toBeGreaterThan(0);
  });

  test('you cannot line up a second person while seeing somebody', () => {
    let state = withPartner(6);
    expect(partnerOf(state)).not.toBeNull();
    state = meetPeople(state);
    const candidate = state.dating.candidates[0];
    expect(() => askOut(state, candidate.id)).toThrow(DecisionError);
  });

  test('somebody you asked out arrives with a name, an age and a story', () => {
    const state = withPartner(7);
    const partner = partnerOf(state)!;
    expect(partner.age).toBeGreaterThanOrEqual(ROMANCE_MIN_AGE);
    expect(partner.romance).toBe('flirting');
    expect(partner.metVia).toBeTruthy();
    expect(partner.metMonth).toBe(state.monthsElapsed);
    expect(toPublicView(state).romance.partner?.id).toBe(partner.id);
  });
});

describe('a romance is earned, not bought (SPEC §6)', () => {
  test('the early dates are the only ones open at the start', () => {
    const state = withPartner(8);
    const view = toPublicView(state);
    const open = view.romance.dates.map((d) => d.id);

    expect(open).toContain('coffee');
    expect(open).toContain('dinner');
    // These need a stage you have not reached yet.
    expect(open).not.toContain('courtside');
    expect(open).not.toContain('meetTheFamily');
    expect(() => goOnDate(state, 'meetTheFamily')).toThrow(DecisionError);
  });

  test('dating advances the stage as the relationship earns it', () => {
    const state = dateUpTo(withPartner(9), 'exclusive');
    const partner = partnerOf(state)!;

    expect(romanceAtLeast(partner.romance, 'dating')).toBe(true);
    expect(partner.relationship).toBeGreaterThan(45);
    // And the log said so when it happened.
    expect(
      state.log.some((l) => /seeing each other properly|said so/.test(l.text)),
    ).toBe(true);
  });

  test('money alone cannot buy a proposal', () => {
    // A billionaire who met her last month still cannot propose.
    const rich = withMoney(withPartner(10), 900_000_000);
    const partner = partnerOf(rich)!;
    expect(canPropose(partner, rich.monthsElapsed, rich.money).ok).toBe(false);
    expect(() => propose(rich)).toThrow(DecisionError);
  });

  test('proposing needs the stage, the number and the time', () => {
    let state = dateUpTo(withPartner(11), 'exclusive');
    const partner = partnerOf(state)!;

    // Force time and warmth, which is exactly what the gate asks for.
    state = {
      ...state,
      monthsElapsed: state.monthsElapsed + 24,
      people: state.people.map((p) =>
        p.id === partner.id
          ? { ...p, relationship: 88, romance: 'exclusive' as const }
          : p,
      ),
    };

    expect(canPropose(partnerOf(state)!, state.monthsElapsed, state.money).ok).toBe(
      true,
    );

    // She is still allowed to say no; try until one lands.
    let engaged: GameState | null = null;
    for (let i = 0; i < 25; i++) {
      const attempt = propose(withMoney(state, 5_000_000));
      if (partnerOf(attempt)?.romance === 'engaged') {
        engaged = attempt;
        break;
      }
      state = { ...state, rngState: attempt.rngState };
    }

    expect(engaged).not.toBeNull();
    expect(partnerOf(engaged!)!.exclusive).toBe(true);
    expect(engaged!.money).toBeLessThan(5_000_000);
    expect(engaged!.log.some((l) => /said yes/.test(l.text))).toBe(true);
  });

  test('a ring costs real money and scales with what you have', () => {
    expect(ringCost(1000)).toBeGreaterThan(0);
    expect(ringCost(50_000_000)).toBeGreaterThan(ringCost(200_000));
    expect(ringCost(900_000_000)).toBeLessThanOrEqual(240_000);
  });
});

describe('marriage (SPEC §6)', () => {
  function engaged(seed: number): GameState {
    let state = dateUpTo(withPartner(seed), 'exclusive');
    const partner = partnerOf(state)!;
    state = {
      ...state,
      monthsElapsed: state.monthsElapsed + 24,
      people: state.people.map((p) =>
        p.id === partner.id
          ? { ...p, relationship: 92, romance: 'exclusive' as const }
          : p,
      ),
    };
    for (let i = 0; i < 40; i++) {
      const attempt = propose(withMoney(state, 20_000_000));
      if (partnerOf(attempt)?.romance === 'engaged') return attempt;
      state = { ...state, rngState: attempt.rngState };
    }
    throw new Error('never got engaged');
  }

  test('you cannot marry somebody you have not asked', () => {
    const state = dateUpTo(withPartner(12), 'exclusive');
    expect(() => marry(state, 'courthouse')).toThrow(DecisionError);
  });

  test('the wedding happens, costs what it costs, and steadies you', () => {
    const state = engaged(13);
    const before = state.nightlife.distraction + 40;
    const primed = {
      ...state,
      nightlife: { ...state.nightlife, distraction: before },
    };

    const married = marry(withMoney(primed, 20_000_000), 'small');
    const partner = partnerOf(married)!;

    expect(partner.romance).toBe('married');
    expect(married.money).toBe(20_000_000 - 42_000);
    expect(married.nightlife.distraction).toBeLessThan(before);
    expect(married.reputation.offCourt).toBeGreaterThan(state.reputation.offCourt);
    expect(married.log.some((l) => /You married/.test(l.text))).toBe(true);
  });

  test('the three tiers are genuinely different bets', () => {
    const costs = WEDDING_TIERS.map((t) => t.cost);
    expect(costs[0]).toBeLessThan(costs[1]);
    expect(costs[1]).toBeLessThan(costs[2]);
    // The cheap one is nearly invisible; the big one is a press event.
    expect(WEDDING_TIERS[0].exposure).toBeLessThan(WEDDING_TIERS[2].exposure);
    const broke = withMoney(engaged(14), 1000);
    expect(() => marry(broke, 'thewedding')).toThrow(DecisionError);
    expect(() => marry(broke, 'courthouse')).not.toThrow();
  });
});

describe('the night, and what can follow it (SPEC §6)', () => {
  test('it is not available before the relationship is', () => {
    const state = withPartner(15);
    expect(partnerOf(state)!.romance).toBe('flirting');
    expect(() => spendTheNight(state, 'careful')).toThrow(DecisionError);
  });

  test('once it is available, it warms the relationship and settles you', () => {
    const state = dateUpTo(withPartner(16), 'dating');
    const before = partnerOf(state)!.relationship;
    const after = spendTheNight(
      { ...state, nightlife: { ...state.nightlife, distraction: 40 } },
      'careful',
    );

    expect(partnerOf(after)!.relationship).toBeGreaterThan(before);
    expect(after.nightlife.distraction).toBeLessThan(40);
  });

  test('careless carries far more risk than careful, and neither is zero', () => {
    const careful = INTIMACY.find((i) => i.id === 'careful')!;
    const not = INTIMACY.find((i) => i.id === 'carriedAway')!;
    expect(careful.risk).toBeGreaterThan(0);
    expect(not.risk).toBeGreaterThan(careful.risk * 5);
    expect(not.risk).toBeLessThan(0.5);
  });

  test('an accidental pregnancy actually happens, and it costs standing', () => {
    let state = dateUpTo(withPartner(17), 'dating');
    state = { ...state, stage: 'nba', hype: { ...state.hype, hype: 90 } };
    const repBefore = state.reputation.offCourt;

    let expecting: GameState | null = null;
    for (let i = 0; i < 120; i++) {
      const attempt = spendTheNight(state, 'carriedAway');
      if (partnerOf(attempt)?.dueMonth !== undefined) {
        expecting = attempt;
        break;
      }
      state = { ...state, rngState: attempt.rngState };
    }

    expect(expecting).not.toBeNull();
    const partner = partnerOf(expecting!)!;
    expect(partner.romance).not.toBe('married');
    expect(partner.dueMonth).toBe(expecting!.monthsElapsed + GESTATION_MONTHS);
    // Unmarried, famous, and it costs you.
    expect(expecting!.reputation.offCourt).toBeLessThan(repBefore);
    expect(
      expecting!.log.some((l) => /pregnant/.test(l.text)),
    ).toBe(true);

    // And you cannot start a second one on top of it.
    expect(() => spendTheNight(expecting!, 'careful')).toThrow(DecisionError);
  });

  test('the baby arrives on schedule and becomes a real person', () => {
    let state = dateUpTo(withPartner(18), 'dating');
    let expecting: GameState | null = null;
    for (let i = 0; i < 120; i++) {
      const attempt = spendTheNight(state, 'carriedAway');
      if (partnerOf(attempt)?.dueMonth !== undefined) {
        expecting = attempt;
        break;
      }
      state = { ...state, rngState: attempt.rngState };
    }
    expect(expecting).not.toBeNull();

    let run = withMoney(expecting!, 20_000_000);
    const due = partnerOf(run)!.dueMonth!;
    // Nothing before the due month.
    run = autoTickMonths(run, GESTATION_MONTHS - 2);
    expect(run.people.some((p) => p.role === 'child')).toBe(false);

    run = autoTickMonths(withMoney(run, 20_000_000), 3);
    expect(run.monthsElapsed).toBeGreaterThanOrEqual(due);

    const child = run.people.find((p) => p.role === 'child');
    expect(child).toBeDefined();
    expect(child!.name.split(/\s+/).length).toBeGreaterThanOrEqual(2);
    expect(child!.age).toBe(0);
    expect(partnerOf(run)?.dueMonth).toBeUndefined();
    expect(toPublicView(run).romance.children).toHaveLength(1);
    expect(run.log.some((l) => /was born/.test(l.text))).toBe(true);
  });

  test('a child is a permanent monthly cost', () => {
    const base = withMoney(adult(19), 100_000);
    const withKid: GameState = {
      ...base,
      people: [
        ...base.people,
        {
          id: 'kid-1',
          name: 'Amari Vale',
          role: 'child',
          age: 0,
          relationship: 90,
          alive: true,
          active: true,
          lastInteractionMonth: -1,
          interactionsThisMonth: 0,
        },
      ],
    };

    // Compared with a tolerance rather than exactly: adding a person changes
    // which events are *eligible*, so the two runs can draw different events
    // with different money effects. The child's cost is the signal; the event
    // is the noise.
    const a = autoTick(base, []);
    const b = autoTick(withKid, []);
    expect(b.money).toBeLessThan(a.money);
    expect(a.money - b.money).toBeGreaterThan(CHILD.MONTHLY_COST * 0.7);
    expect(a.money - b.money).toBeLessThan(CHILD.MONTHLY_COST * 1.4);

    // And it scales with how many of them there are.
    const twoKids: GameState = {
      ...withKid,
      people: [
        ...withKid.people,
        { ...withKid.people[withKid.people.length - 1], id: 'kid-2', name: 'Zion Vale' },
      ],
    };
    const c = autoTick(twoKids, []);
    expect(c.money).toBeLessThan(b.money);

    // The number the Dating screen quotes is the number the engine charges.
    expect(CHILD.MONTHLY_COST).toBe(1400);
  });
});

describe('parties (SPEC §6)', () => {
  test('the menu is consistent and spans real money', () => {
    const ids = new Set<string>();
    for (const def of PARTIES) {
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      expect(def.detail.length).toBeGreaterThan(30);
      expect(def.cost).toBeGreaterThan(0);
    }
    expect(PARTIES[0].cost).toBeLessThan(PARTIES[PARTIES.length - 1].cost / 50);
  });

  test('throwing one buys standing and costs focus', () => {
    const state = adult(20, 2_000_000);
    const after = throwParty(state, 'apartment');

    expect(after.relationships.friends.level).toBeGreaterThan(
      state.relationships.friends.level,
    );
    expect(after.nightlife.distraction).toBeGreaterThan(
      state.nightlife.distraction,
    );
    expect(after.money).toBe(state.money - partyById('apartment')!.cost);
    expect(after.nightlife.nightsOut).toBe(1);
  });

  test('a housewarming needs somewhere to warm', () => {
    const state = adult(21, 20_000_000);
    expect(hasProperty(state.assets)).toBe(false);
    expect(() => throwParty(state, 'housewarming')).toThrow(DecisionError);

    const owning: GameState = {
      ...state,
      assets: [{ id: 'condo', purchasedMonth: 0, price: 780_000 }],
    };
    expect(hasProperty(owning.assets)).toBe(true);
    expect(() => throwParty(owning, 'housewarming')).not.toThrow();
  });

  test('the big ones get written about when you are famous', () => {
    let quiet = adult(22, 500_000_000);
    let famous: GameState = {
      ...quiet,
      stage: 'nba',
      hype: { ...quiet.hype, hype: 96 },
    };

    for (let i = 0; i < 25; i++) {
      quiet = withMoney(throwParty(quiet, 'blowout'), 500_000_000);
      famous = withMoney(throwParty(famous, 'blowout'), 500_000_000);
    }

    expect(famous.nightlife.tabloidStories).toBeGreaterThan(
      quiet.nightlife.tabloidStories,
    );
    expect(famous.reputation.offCourt).toBeLessThan(quiet.reputation.offCourt);
  });
});

describe('the catalogue and the save (SPEC §6, §16)', () => {
  test('cars and property are real categories with a real ladder', () => {
    const cars = ASSETS.filter((a) => a.category === 'car');
    const property = ASSETS.filter((a) => a.category === 'property');

    expect(cars.length).toBeGreaterThanOrEqual(3);
    expect(property.length).toBeGreaterThanOrEqual(4);
    // Something reachable as a teenager, something that never is.
    expect(Math.min(...cars.map((c) => c.price))).toBeLessThan(10_000);
    expect(Math.max(...property.map((p) => p.price))).toBeGreaterThan(5_000_000);
    // At least one property is somewhere you can actually hold a party.
    expect(property.some((p) => p.isProperty)).toBe(true);
  });

  test('a v7 save carries its relationships forward', () => {
    const current = adult(23);
    const legacyPeople = current.people.map((p) =>
      p.role === 'partner'
        ? ({ ...p, role: 'fling', exclusive: false } as unknown as typeof p)
        : p,
    );
    const { dating: _dropped, ...rest } = current;
    const legacy = {
      ...rest,
      schemaVersion: 7,
      people: legacyPeople,
    } as unknown as GameState;

    const migrated = migrate({
      slot: 0,
      schemaVersion: 7,
      savedAt: Date.now(),
      displayName: 'legacy',
      state: legacy,
    });

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.dating.candidates).toEqual([]);
    // Nobody is left holding a role the engine no longer understands.
    for (const person of migrated.people) {
      expect(person.role).not.toBe('fling');
    }
    expect(autoTick(migrated, []).monthsElapsed).toBe(
      current.monthsElapsed + 1,
    );
  });

  test('a long career running the whole life layer still ends cleanly', () => {
    let state = withPartner(24, 80_000_000);

    for (let i = 0; i < 200 && !state.careerEnd; i++) {
      state = withMoney(state, 80_000_000);
      const view = toPublicView(state);
      if (view.romance.dates.length > 0) {
        state = goOnDate(state, view.romance.dates[0].id);
      }
      const partner = partnerOf(state);
      if (partner && romanceAtLeast(partner.romance, 'dating') && !partner.dueMonth) {
        state = spendTheNight(state, 'carriedAway');
      }
      state = throwParty(withMoney(state, 80_000_000), 'apartment');
      state = autoTick(withMoney(state, 80_000_000), [{ id: 'shooting' }]);
    }

    expect(state.careerEnd).not.toBeNull();
    for (const person of state.people) {
      expect(person.relationship).toBeGreaterThanOrEqual(0);
      expect(person.relationship).toBeLessThanOrEqual(100);
      expect(Number.isFinite(person.age)).toBe(true);
    }
    expect(state.nightlife.distraction).toBeLessThanOrEqual(100);
    expect(Number.isFinite(state.money)).toBe(true);
  });
});
