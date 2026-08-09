import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { ActionBudgetError, tick } from '../engine/tick';
import { autoTick } from './harness';
import { ACTION_POINTS_PER_MONTH, phaseFor } from '../engine/calendar';
import {
  ACTIONS,
  ENERGY_ENABLED,
  TRAINING,
  diminishingFor,
  energyTrainingFactor,
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
  return phaseFor(state.clock, state.stage).actionPoints;
}

function runCareer(
  seed: number,
  choose: (state: GameState) => ActionId[],
  months = 60,
): GameState {
  let state = createGame(seed, INPUT);
  for (let i = 0; i < months; i++) {
    if (state.careerEnd) break;
    state = autoTick(state, choose(state));
  }
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

/**
 * Injuries picked up, not injury log lines — the `injury` kind also carries
 * the all-clear message when one heals.
 *
 * Matched by excluding the recovery line rather than by looking for a word in
 * the prose: this assertion is about the injury *rate*, and it should not
 * start failing because somebody reworded a notification.
 */
function injuryCount(state: GameState): number {
  return state.log.filter(
    (e) => e.kind === 'injury' && !/cleared to play/i.test(e.text),
  ).length;
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

  test('what spamming buys on one skill, it gives back everywhere else', () => {
    const rotated = runCareer(7, rotatePolicy);
    const spammed = runCareer(7, spamPolicy);

    // Both policies rest identically, so this isolates the trade rather than
    // measuring an energy penalty. Grinding one skill every month does not
    // even pull far ahead on that skill, because the potential soft cap binds
    // long before the extra reps pay off...
    const shootingEdge =
      (spammed.player.attributes.catchAndShoot3 as number) -
      (rotated.player.attributes.catchAndShoot3 as number);
    expect(Math.abs(shootingEdge)).toBeLessThan(6);

    // ...while everything the spammer never touched falls badly behind.
    const untouched = ['perimeterDefense', 'passingVision', 'strength'] as const;
    for (const key of untouched) {
      expect(spammed.player.attributes[key], key).toBeLessThan(
        rotated.player.attributes[key] as number,
      );
    }
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
    state = autoTick(state, ['shooting']);
    expect(state.training.streaks.shooting).toBe(1);
    state = autoTick(state, ['shooting']);
    expect(state.training.streaks.shooting).toBe(2);

    // One month off resets it.
    state = autoTick(state, ['lift']);
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
  /*
   * Energy is switched off (`ENERGY_ENABLED`). The system is intact and still
   * asserted at the formula level below, because the flag exists to be turned
   * back on — but the career-level behaviour it used to drive is genuinely
   * gone, and a test that pretended otherwise would be lying.
   */
  test('the formulas still behave, so the flag can be flipped back', () => {
    expect(energyTrainingFactor(100)).toBeGreaterThan(energyTrainingFactor(20));
    expect(energyTrainingFactor(100)).toBeCloseTo(1, 5);
    expect(energyTrainingFactor(0)).toBeGreaterThan(0);
    expect(injuryProbability(20, 40, 0)).toBeGreaterThan(
      injuryProbability(100, 40, 0),
    );
  });

  test('nothing drains while it is switched off', () => {
    expect(ENERGY_ENABLED).toBe(false);
    const base = createGame(3, INPUT);
    const trained = tick(base, ['lift', 'lift', 'lift', 'lift']);
    expect(trained.condition.energy).toBe(base.condition.energy);
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

describe('training is the only thing a plain tick moves (SPEC §3)', () => {
  test('trainable attributes hold steady when no actions are taken', () => {
    // Raw `tick`, not the harness: once an event goes pending it is the
    // event system moving these numbers, which is Phase 7's business.
    let state = createGame(13, INPUT);
    const before = { ...state.player.attributes };

    for (let i = 0; i < 24; i++) {
      const next = tick(state, []);
      state = next;
      if (state.events.pending) break;
    }

    for (const key of ['finishing', 'passingVision', 'leadership'] as const) {
      expect(state.player.attributes[key], key).toBe(before[key]);
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

  test('minutes played still drive the injury rate', () => {
    // Rest used to be the lever here. With energy off, the load term is what
    // is left — and it has to keep working, or injuries stop meaning
    // anything at all.
    const light = injuryProbability(100, 40, 20);
    const heavy = injuryProbability(100, 40, 320);
    expect(heavy).toBeGreaterThan(light * 1.1);

    // And injuries still actually happen across a run.
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      total += injuryCount(runCareer(seed, rotatePolicy));
    }
    expect(total).toBeGreaterThan(0);
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

    state = autoTick(state, []);
    expect(state.condition.injury?.monthsRemaining).toBe(1);
    state = autoTick(state, []);
    expect(state.condition.injury).toBeNull();
    expect(state.log.some((e) => e.text.includes('healed'))).toBe(true);
  });

  test('a career-ending injury stops the run', () => {
    // Force the tail case by pinning an already-ended career.
    const ended: GameState = {
      ...createGame(3, INPUT),
      careerEnd: {
        endingId: 'career-ending-injury',
        reason: 'Career-ending injury',
        detail: 'test',
        decision: 'test',
        monthsElapsed: 4,
      },
    };
    // Further ticks are inert once the run is over.
    expect(tick(ended, [])).toEqual(ended);
  });
});

describe('action points (SPEC §3)', () => {
  test('the budget is flat, and generous, at every phase', () => {
    // The seasonal ration is gone (see `ACTION_POINTS_PER_MONTH`): a real
    // player lifts, shoots, watches film and sees his family in the same
    // February. What stops ten sessions being worth ten is the diminishing
    // curve on repeats, which is asserted separately above.
    for (let month = 0; month < 12; month++) {
      const info = phaseFor({ year: 2026, month });
      expect(info.actionPoints, `month ${month}`).toBe(ACTION_POINTS_PER_MONTH);
      // The phase itself still has a name and a character.
      expect(info.label.length).toBeGreaterThan(0);
    }
    expect(ACTION_POINTS_PER_MONTH).toBe(10);
  });

  test('spending more than the month affords is still rejected', () => {
    const state = createGame(2, INPUT);
    const budget = phaseFor(state.clock).actionPoints;
    const tooMany = Array.from(
      { length: budget + 1 },
      () => 'shooting' as ActionId,
    );
    expect(() => tick(state, tooMany)).toThrow(ActionBudgetError);
    // And exactly the budget is fine.
    expect(() =>
      tick(state, tooMany.slice(0, budget)),
    ).not.toThrow();
  });


  test('a fresh run starts with an empty streak table', () => {
    const training = initialTrainingState();
    for (const id of ACTION_IDS) expect(training.streaks[id]).toBe(0);
  });
});
