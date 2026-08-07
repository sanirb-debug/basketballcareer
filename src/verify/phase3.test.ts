import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { ActionBudgetError, tick } from '../engine/tick';
import { phaseFor } from '../engine/calendar';
import {
  ACTIONS,
  TRAINING,
  diminishingFor,
  initialTrainingState,
  skillCeiling,
} from '../engine/actions';
import { INJURY, effectiveAttributes, injuryProbability } from '../engine/condition';
import {
  ACTION_IDS,
  ATTRIBUTE_KEYS,
  type ActionId,
  type GameState,
} from '../engine/types';

/**
 * PHASE 3 VERIFICATION (SPEC §18)
 *
 * "Test: spamming one training is worse than rotating; zero-rest raises injury
 * rate measurably."
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

const ROTATION: ActionId[] = [
  'shooting',
  'handles',
  'finishing',
  'defense',
  'playmaking',
  'lift',
  'conditioning',
  'film',
];

function budget(state: GameState): number {
  return phaseFor(state.clock).actionPoints;
}

function runCareer(
  seed: number,
  choose: (state: GameState) => ActionId[],
  months = 60,
): GameState {
  let state = createGame(seed, INPUT);
  for (let i = 0; i < months; i++) state = tick(state, choose(state));
  return state;
}

function attributeTotal(state: GameState): number {
  return ATTRIBUTE_KEYS.reduce(
    (sum, key) => sum + (state.player.attributes[key] as number),
    0,
  );
}

/** Rotate through the training catalog, resting when gassed. */
function rotatePolicy(state: GameState): ActionId[] {
  const picks: ActionId[] = [];
  if (state.condition.energy < 50) picks.push('rest');
  let i = state.monthsElapsed * 3;
  while (picks.length < budget(state)) {
    picks.push(ROTATION[i++ % ROTATION.length] as ActionId);
  }
  return picks;
}

/** The pathological line the spec says must not be optimal. */
function spamPolicy(state: GameState): ActionId[] {
  const picks: ActionId[] = [];
  if (state.condition.energy < 50) picks.push('rest');
  while (picks.length < budget(state)) picks.push('shooting');
  return picks;
}

function injuryCount(state: GameState): number {
  return state.log.filter((e) => e.kind === 'injury' && e.text.includes('out')).length;
}

describe('the spec assertion: rotating beats spamming (SPEC §18 Phase 3)', () => {
  test('spamming one training develops a worse player overall', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rotated = runCareer(seed, rotatePolicy);
      const spammed = runCareer(seed, spamPolicy);
      expect(attributeTotal(rotated), `seed ${seed}`).toBeGreaterThan(
        attributeTotal(spammed),
      );
    }
  });

  test('spamming does not even win at the thing being spammed', () => {
    // Both rest identically, so this isolates diminishing returns rather than
    // just measuring the energy penalty.
    const rotated = runCareer(7, rotatePolicy);
    const spammed = runCareer(7, spamPolicy);
    expect(spammed.player.attributes.catchAndShoot3).toBeLessThan(
      rotated.player.attributes.catchAndShoot3,
    );
  });
});

describe('diminishing returns (SPEC §3)', () => {
  test('follows the ×1.0, ×0.8, ×0.6, floor ×0.5 curve', () => {
    expect(diminishingFor(0)).toBe(1);
    expect(diminishingFor(1)).toBe(0.8);
    expect(diminishingFor(2)).toBe(0.6);
    expect(diminishingFor(3)).toBe(0.5);
    expect(diminishingFor(9)).toBe(0.5);
    expect(TRAINING.DIMINISHING[0]).toBe(1);
  });

  test('a streak builds while repeating and resets after a month off', () => {
    let state = createGame(3, INPUT);
    state = tick(state, ['shooting']);
    expect(state.training.streaks.shooting).toBe(1);
    state = tick(state, ['shooting']);
    expect(state.training.streaks.shooting).toBe(2);

    // One month off resets it.
    state = tick(state, ['lift']);
    expect(state.training.streaks.shooting).toBe(0);
    expect(state.training.streaks.lift).toBe(1);
  });

  test('repeats within a single month diminish too', () => {
    // Four Shooting sessions in one offseason month must not pay full rate
    // four times over — that would sidestep §3 entirely.
    const base = createGame(3, INPUT);
    const once = tick(base, ['shooting']);
    const fourTimes = tick(base, ['shooting', 'shooting', 'shooting', 'shooting']);

    const gainOnce =
      (once.player.attributes.catchAndShoot3 as number) -
      (base.player.attributes.catchAndShoot3 as number);
    const gainFour =
      (fourTimes.player.attributes.catchAndShoot3 as number) -
      (base.player.attributes.catchAndShoot3 as number);

    expect(gainFour).toBeGreaterThan(gainOnce);
    expect(gainFour).toBeLessThan(gainOnce * 4);
  });

  test('potential caps how far a skill can be trained', () => {
    expect(skillCeiling(25)).toBeLessThan(skillCeiling(60));
    expect(skillCeiling(60)).toBeLessThan(skillCeiling(99));

    // A low-potential player grinding one skill still stalls short of elite.
    const capped = runCareer(5, spamPolicy, 60);
    const ceiling = skillCeiling(capped.player.hiddenMeta.potential);
    expect(capped.player.attributes.catchAndShoot3).toBeLessThanOrEqual(ceiling + 0.001);
  });
});

describe('energy (SPEC §6)', () => {
  test('training drains it and rest restores it', () => {
    const base = createGame(3, INPUT);
    const trained = tick(base, ['lift', 'lift', 'lift', 'lift']);
    const rested = tick(base, ['rest']);
    expect(trained.condition.energy).toBeLessThan(base.condition.energy);
    expect(rested.condition.energy).toBeGreaterThan(trained.condition.energy);
  });

  test('stays inside 0–100 across a punishing career', () => {
    const grind = runCareer(9, (s) =>
      Array.from({ length: budget(s) }, () => 'lift' as ActionId),
    );
    expect(grind.condition.energy).toBeGreaterThanOrEqual(0);
    expect(grind.condition.energy).toBeLessThanOrEqual(100);
  });

  test('every action has a coherent energy cost', () => {
    for (const id of ACTION_IDS) {
      const def = ACTIONS[id];
      if (def.category === 'recovery') expect(def.energyCost).toBeLessThan(0);
      else expect(def.energyCost).toBeGreaterThan(0);
    }
  });
});

describe('injuries (SPEC §6)', () => {
  test('the probability formula rises with each of its three terms', () => {
    const baseline = injuryProbability(100, 40, 0);
    expect(injuryProbability(20, 40, 0)).toBeGreaterThan(baseline); // tired
    expect(injuryProbability(100, 90, 0)).toBeGreaterThan(baseline); // fragile
    expect(injuryProbability(100, 40, 200)).toBeGreaterThan(baseline); // heavy load
    expect(baseline).toBeGreaterThanOrEqual(INJURY.BASE);
  });

  test('zero rest raises the injury rate measurably', () => {
    let withRest = 0;
    let withoutRest = 0;

    for (let seed = 1; seed <= 60; seed++) {
      withRest += injuryCount(runCareer(seed, rotatePolicy));
      withoutRest += injuryCount(
        runCareer(seed, (s) => {
          let i = s.monthsElapsed * 3;
          return Array.from(
            { length: budget(s) },
            () => ROTATION[i++ % ROTATION.length] as ActionId,
          );
        }),
      );
    }

    expect(withoutRest).toBeGreaterThan(withRest * 1.1);
  });

  test('an injury caps attributes while it heals and lifts cleanly after', () => {
    const state = createGame(3, INPUT);
    const injured = {
      name: 'torn meniscus',
      severity: 'major' as const,
      monthsRemaining: 4,
      attributeCap: 0.74,
    };

    const capped = effectiveAttributes(state.player.attributes, injured);
    const healthy = effectiveAttributes(state.player.attributes, null);

    expect(capped.finishing).toBeLessThan(healthy.finishing as number);
    // The underlying ratings are untouched, so healing restores them exactly.
    expect(healthy).toEqual(state.player.attributes);
  });

  test('rehab counts down and clears on its own', () => {
    let state: GameState = {
      ...createGame(3, INPUT),
      condition: {
        energy: 100,
        injury: {
          name: 'rolled ankle',
          severity: 'minor',
          monthsRemaining: 2,
          attributeCap: 0.95,
        },
      },
    };

    state = tick(state, []);
    expect(state.condition.injury?.monthsRemaining).toBe(1);
    state = tick(state, []);
    expect(state.condition.injury).toBeNull();
    expect(state.log.some((e) => e.text.includes('healed'))).toBe(true);
  });

  test('a career-ending injury stops the run', () => {
    // Force the tail case by pinning an already-ended career.
    const ended: GameState = {
      ...createGame(3, INPUT),
      careerEnd: {
        reason: 'Career-ending injury',
        detail: 'test',
        monthsElapsed: 4,
      },
    };
    // Further ticks are inert once the run is over.
    expect(tick(ended, [])).toEqual(ended);
  });
});

describe('action points (SPEC §3)', () => {
  test('the budget matches the season phase', () => {
    const byMonth = [2, 2, 1, 3, 3, 3, 1, 4, 4, 4, 2, 2];
    byMonth.forEach((expected, month) => {
      expect(phaseFor({ year: 2027, month }).actionPoints, `month ${month}`).toBe(
        expected,
      );
    });
  });

  test('spending more than the month affords is rejected', () => {
    const state = createGame(3, INPUT); // August: offseason, 4 points
    expect(() => tick(state, Array(5).fill('lift') as ActionId[])).toThrow(
      ActionBudgetError,
    );
    expect(() => tick(state, Array(4).fill('lift') as ActionId[])).not.toThrow();
  });

  test('in-season months really are tighter than the offseason', () => {
    // August (offseason) affords four; January (in season) affords two.
    const august = phaseFor({ year: 2026, month: 7 }).actionPoints;
    const january = phaseFor({ year: 2027, month: 0 }).actionPoints;
    expect(august).toBeGreaterThan(january);
  });

  test('a fresh run starts with an empty streak table', () => {
    const training = initialTrainingState();
    for (const id of ACTION_IDS) expect(training.streaks[id]).toBe(0);
  });
});
