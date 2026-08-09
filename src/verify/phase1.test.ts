import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { tick } from '../engine/tick';
import { autoTick } from './harness';
import { ageInMonths } from '../engine/calendar';
import { GROWTH, isSpurtGrowthMonth } from '../engine/growth';
import { midParentalHeight } from '../engine/genetics';
import {
  ATTR_MAX,
  ATTR_MIN,
  POSITION_WEIGHTS,
  frameRating,
  heightRating,
  overallFor,
  wingspanRating,
} from '../engine/attributes';
import { toPublicView } from '../engine/selectors';
import {
  ATTRIBUTE_KEYS,
  DEFENSE_KEYS,
  MENTAL_KEYS,
  OFFENSE_KEYS,
  PHYSICAL_KEYS,
  POSITIONS,
  type GameState,
  type Genetics,
} from '../engine/types';

/**
 * PHASE 1 VERIFICATION (SPEC §18)
 *
 * "Test script: a max-height-genes player reaches ceiling by 19; a low-genes
 * player doesn't."
 *
 * Read literally the second clause is false — a low-genes player also
 * converges on their *own* (low) ceiling by 19. We take the intent to be that
 * a low-genes player doesn't reach a *tall* finish, and assert both readings
 * separately below.
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

/** Age 19y0m — the age the spec's assertion is about. */
const AGE_19 = GROWTH.END_AGE_MONTHS;

const MAX_HEIGHT_GENES: Partial<Genetics> = {
  heightCeiling: 90, // the top of the clamp — 7'6"
  startingHeightFraction: 0.8, // late bloomer: the most growth still to come
  frameCeiling: 99,
  athleticCeiling: 99,
  potential: 99,
};

const LOW_GENES: Partial<Genetics> = {
  heightCeiling: 71, // 5'11"
  startingHeightFraction: 0.9,
  frameCeiling: 30,
  athleticCeiling: 30,
  potential: 30,
};

function ageOf(state: GameState): number {
  return ageInMonths(state.clock, state.player.birthYear, state.player.birthMonth);
}

interface TraceRow {
  age: number;
  height: number;
  delta: number;
  frame: number;
  weight: number;
}

/**
 * Tick to a target age, isolating the growth curve from Phase 3's injury
 * system.
 *
 * A career-ending injury stops the run for good, which is correct game
 * behaviour but would freeze the clock partway through a growth trace and make
 * these assertions fail for a reason that has nothing to do with growth. The
 * roll is rare (~1% a run) but certain to hit across the seed sweeps below, so
 * the helper clears it and keeps ageing the player. Phase 3 tests the injury
 * path on its own terms.
 */
function playUntilAge(state: GameState, targetAge: number) {
  const trace: TraceRow[] = [];
  let s = state;
  let guard = 0;
  while (ageOf(s) < targetAge) {
    const previous = s.player.body.heightInches;
    s = autoTick(s, []);
    if (s.careerEnd) s = { ...s, careerEnd: null };
    trace.push({
      age: ageOf(s),
      height: s.player.body.heightInches,
      delta: s.player.body.heightInches - previous,
      frame: s.player.attributes.frame,
      weight: s.player.body.weightLbs,
    });
    if (++guard > 600) throw new Error('runaway growth loop');
  }
  return { state: s, trace };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

function correlation(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = (xs[i] as number) - mx;
    const b = (ys[i] as number) - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

describe('the spec assertion: ceiling by 19 (SPEC §18 Phase 1)', () => {
  test('a max-height-genes player reaches their ceiling by 19', () => {
    const start = createGame(4242, INPUT, { debugGenetics: MAX_HEIGHT_GENES });
    const { state } = playUntilAge(start, AGE_19);

    expect(ageOf(state)).toBe(AGE_19);
    expect(state.player.body.heightInches).toBeCloseTo(
      state.hidden.genetics.heightCeiling,
      9,
    );
    // And that ceiling is genuinely a big-man finish.
    expect(state.player.body.heightInches).toBeGreaterThanOrEqual(81);
  });

  test('a low-genes player does not reach a tall finish', () => {
    const start = createGame(4242, INPUT, { debugGenetics: LOW_GENES });
    const { state } = playUntilAge(start, AGE_19);

    expect(state.player.body.heightInches).toBeLessThanOrEqual(73);
    // The other reading of the same spec row: they still land on their own
    // ceiling — they just don't have a tall one.
    expect(state.player.body.heightInches).toBeCloseTo(
      state.hidden.genetics.heightCeiling,
      9,
    );
  });

  test('the two runs diverge by more than half a foot', () => {
    const tall = playUntilAge(
      createGame(4242, INPUT, { debugGenetics: MAX_HEIGHT_GENES }),
      AGE_19,
    ).state;
    const short = playUntilAge(
      createGame(4242, INPUT, { debugGenetics: LOW_GENES }),
      AGE_19,
    ).state;

    expect(
      tall.player.body.heightInches - short.player.body.heightInches,
    ).toBeGreaterThan(6);
  });

  test('naturally rolled players also land on their own ceiling by 19', () => {
    const ceilings: number[] = [];
    const finals: number[] = [];

    for (let seed = 1; seed <= 120; seed++) {
      const { state } = playUntilAge(createGame(seed, INPUT), AGE_19);
      expect(state.player.body.heightInches).toBeCloseTo(
        state.hidden.genetics.heightCeiling,
        9,
      );
      ceilings.push(state.hidden.genetics.heightCeiling);
      finals.push(state.player.body.heightInches);
    }

    // Without any override, the genes still separate the class: top decile
    // finishes far above bottom decile.
    const order = ceilings
      .map((c, i) => [c, finals[i] as number] as const)
      .sort((a, b) => a[0] - b[0]);
    const cut = Math.floor(order.length / 10);
    const low = mean(order.slice(0, cut).map((r) => r[1]));
    const high = mean(order.slice(-cut).map((r) => r[1]));
    expect(high - low).toBeGreaterThan(6);
  });
});

describe('growth curve shape (SPEC §4)', () => {
  test('height is monotonic and never overshoots the ceiling', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const start = createGame(seed, INPUT);
      const ceiling = start.hidden.genetics.heightCeiling;
      const { trace } = playUntilAge(start, AGE_19 + 12);

      for (const row of trace) {
        expect(row.delta).toBeGreaterThanOrEqual(0);
        expect(row.height).toBeLessThanOrEqual(ceiling + 1e-9);
      }
    }
  });

  test('monthly growth stays within a plausible bound', () => {
    let worst = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { trace } = playUntilAge(createGame(seed, INPUT), AGE_19);
      for (const row of trace) worst = Math.max(worst, row.delta);
    }
    // ~1" in a month is already an extreme spurt; anything near 2" would mean
    // the schedule is spiking unrealistically.
    expect(worst).toBeLessThan(1.6);
  });

  test('growth is front-loaded across the 13–19 window', () => {
    const totals = [0, 0];
    for (let seed = 1; seed <= 120; seed++) {
      const { trace } = playUntilAge(createGame(seed, INPUT), AGE_19);
      for (const row of trace) {
        totals[row.age <= 192 ? 0 : 1] += row.delta;
      }
    }
    // Ages 13–16 should carry clearly more growth than 16–19.
    expect(totals[0] as number).toBeGreaterThan((totals[1] as number) * 1.5);
  });
});

describe('the randomized spurt window (SPEC §4)', () => {
  test('is 3–6 months long and always ahead of the start of the run', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const state = createGame(seed, INPUT);
      const g = state.hidden.genetics;

      expect(g.spurtLengthMonths).toBeGreaterThanOrEqual(GROWTH.SPURT_MIN_LENGTH);
      expect(g.spurtLengthMonths).toBeLessThanOrEqual(GROWTH.SPURT_MAX_LENGTH);
      // Otherwise a late-birthday player's spurt would already be over at
      // month 0 and the run would never see it.
      expect(g.spurtStartAgeMonths).toBeGreaterThan(ageOf(state));
      expect(g.spurtStartAgeMonths + g.spurtLengthMonths).toBeLessThan(AGE_19);
    }
  });

  test('is genuinely randomized across runs', () => {
    const starts = new Set<number>();
    const lengths = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const g = createGame(seed, INPUT).hidden.genetics;
      starts.add(g.spurtStartAgeMonths);
      lengths.add(g.spurtLengthMonths);
    }
    expect(starts.size).toBeGreaterThan(20);
    expect(lengths.size).toBe(4); // 3, 4, 5 and 6 all occur
  });

  test('every run actually lives through its spurt', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const start = createGame(seed, INPUT);
      const g = start.hidden.genetics;
      const { trace } = playUntilAge(start, AGE_19);
      const observed = trace.filter((r) => isSpurtGrowthMonth(r.age, g));
      expect(observed.length).toBe(g.spurtLengthMonths);
    }
  });

  test('growth accelerates sharply inside the window', () => {
    let worstRatio = Infinity;

    for (let seed = 1; seed <= 200; seed++) {
      const start = createGame(seed, INPUT);
      const g = start.hidden.genetics;
      const { trace } = playUntilAge(start, AGE_19);

      const inside: number[] = [];
      const neighbours: number[] = [];

      for (const row of trace) {
        if (isSpurtGrowthMonth(row.age, g)) {
          inside.push(row.delta);
          continue;
        }
        // Compare against the months either side, not the whole schedule:
        // the curve is front-loaded, so a late spurt will never beat the
        // 13-year-old months in absolute terms even while it is a sharp
        // local acceleration.
        const lived = row.age - 1;
        const distance = Math.min(
          Math.abs(lived - g.spurtStartAgeMonths),
          Math.abs(lived - (g.spurtStartAgeMonths + g.spurtLengthMonths)),
        );
        if (distance <= 6) neighbours.push(row.delta);
      }

      expect(inside.length).toBeGreaterThan(0);
      expect(neighbours.length).toBeGreaterThan(0);
      worstRatio = Math.min(worstRatio, mean(inside) / mean(neighbours));
    }

    expect(worstRatio).toBeGreaterThanOrEqual(2);
  });
});

describe('frame fills out at 17–23, not before (SPEC §4)', () => {
  test('frame is flat before 17 and rises afterwards', () => {
    const { trace } = playUntilAge(createGame(77, INPUT), 240);

    const before = trace.filter((r) => r.age <= GROWTH.FRAME_START_AGE_MONTHS);
    const after = trace.filter((r) => r.age > GROWTH.FRAME_START_AGE_MONTHS);

    const firstFrame = before[0]?.frame as number;
    for (const row of before) expect(row.frame).toBeCloseTo(firstFrame, 9);

    for (let i = 1; i < after.length; i++) {
      expect(after[i]?.frame as number).toBeGreaterThan(
        after[i - 1]?.frame as number,
      );
    }
    expect(after[after.length - 1]?.frame as number).toBeGreaterThan(firstFrame);
  });

  test('weight still rises before 17, carried by height', () => {
    const { trace } = playUntilAge(createGame(77, INPUT), GROWTH.FRAME_START_AGE_MONTHS);
    const first = trace[0]?.weight as number;
    const last = trace[trace.length - 1]?.weight as number;
    expect(last).toBeGreaterThan(first);
  });
});

describe('attributes (SPEC §5)', () => {
  test('the full list is present with the right group sizes', () => {
    expect(PHYSICAL_KEYS.length).toBe(9);
    expect(OFFENSE_KEYS.length).toBe(9);
    expect(DEFENSE_KEYS.length).toBe(6);
    expect(MENTAL_KEYS.length).toBe(5);
    expect(ATTRIBUTE_KEYS.length).toBe(29);
    expect(new Set(ATTRIBUTE_KEYS).size).toBe(29);

    const attributes = createGame(1, INPUT).player.attributes;
    for (const key of ATTRIBUTE_KEYS) {
      expect(attributes[key], key).toBeTypeOf('number');
    }
  });

  test('every attribute stays on the 25–99 scale over a full run', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { state } = playUntilAge(createGame(seed, INPUT), AGE_19 + 12);
      for (const key of ATTRIBUTE_KEYS) {
        expect(state.player.attributes[key], key).toBeGreaterThanOrEqual(ATTR_MIN);
        expect(state.player.attributes[key], key).toBeLessThanOrEqual(ATTR_MAX);
      }
    }
  });

  test('position weight tables are normalized', () => {
    for (const position of POSITIONS) {
      const weights = POSITION_WEIGHTS[position];
      let sum = 0;
      for (const key of ATTRIBUTE_KEYS) sum += weights[key];
      expect(sum, position).toBeCloseTo(1, 10);
    }
  });

  test('overall is a position-weighted composite inside the scale', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed, INPUT);
      for (const position of POSITIONS) {
        const overall = overallFor(state.player.attributes, position);
        expect(overall).toBeGreaterThanOrEqual(ATTR_MIN);
        expect(overall).toBeLessThanOrEqual(ATTR_MAX);
      }
    }

    // A 7-footer's overall should read higher at centre than at point guard —
    // but only once he actually is one. At 13 this player is 6'0" and the two
    // positions grade him the same, which is correct.
    const big = playUntilAge(
      createGame(9, INPUT, { debugGenetics: MAX_HEIGHT_GENES }),
      AGE_19,
    ).state;
    expect(big.player.body.heightInches).toBeGreaterThan(84);
    expect(overallFor(big.player.attributes, 'C')).toBeGreaterThan(
      overallFor(big.player.attributes, 'PG'),
    );
  });

  test('height, wingspan and frame are derived from the body, not trained', () => {
    const { state, trace } = playUntilAge(createGame(5, INPUT), 216);
    expect(trace.length).toBeGreaterThan(0);

    const { attributes, body } = state.player;
    expect(attributes.height).toBeCloseTo(heightRating(body.heightInches), 9);
    expect(attributes.wingspan).toBeCloseTo(
      wingspanRating(body.wingspanInches),
      9,
    );
    expect(attributes.frame).toBeCloseTo(
      frameRating(ageOf(state), state.hidden.genetics),
      9,
    );
  });

  test('wingspan tracks height by the hidden ratio', () => {
    const { state } = playUntilAge(createGame(11, INPUT), AGE_19);
    expect(state.player.body.wingspanInches).toBeCloseTo(
      state.player.body.heightInches * state.hidden.genetics.wingspanRatio,
      9,
    );
  });

  test('trainable attributes do not drift without training or events', () => {
    // Raw `tick`, not the harness: once an event goes pending it is the event
    // system moving these numbers, which is legitimate and Phase 7's business.
    const start = createGame(13, INPUT);
    let state = start;
    for (let i = 0; i < 24; i++) {
      state = tick(state, []);
      if (state.events.pending) break;
    }

    for (const key of [...OFFENSE_KEYS, ...DEFENSE_KEYS, ...MENTAL_KEYS]) {
      expect(state.player.attributes[key], key).toBe(
        start.player.attributes[key],
      );
    }
  });
});

describe('the genetic roll stays hidden (SPEC §4)', () => {
  const LEAKS = [
    'heightCeiling',
    'startingHeightFraction',
    'wingspanRatio',
    'frameCeiling',
    'athleticCeiling',
    'spurtStartAgeMonths',
    'spurtLengthMonths',
    'spurtMultiplier',
    'athleticOffsets',
    'potential',
    'workEthic',
    'injuryProneness',
    'confidence',
    'hiddenMeta',
  ];

  test('toPublicView exposes no part of the hidden block', () => {
    const { state } = playUntilAge(createGame(21, INPUT), 200);
    const view = toPublicView(state);

    expect('hidden' in view).toBe(false);
    expect('hiddenMeta' in view.player).toBe(false);

    const serialized = JSON.stringify(view);
    for (const field of LEAKS) {
      expect(serialized, `public view leaked ${field}`).not.toContain(field);
    }
  });

  test('the raw state still carries the genetics the view hides', () => {
    const state = createGame(21, INPUT);
    expect(state.hidden.genetics.heightCeiling).toBeGreaterThan(0);
    expect(JSON.stringify(state)).toContain('heightCeiling');
  });

  test('the growth notification never leaks the ceiling', () => {
    // The invariant is about secrecy, not phrasing: a player may be told how
    // tall he is — he can see that — but never how tall he will end up.
    const { state } = playUntilAge(createGame(21, INPUT), 190);
    const growthLines = state.log.filter((e) => e.kind === 'growth');
    expect(growthLines.length).toBeGreaterThan(0);

    const ceiling = state.hidden.genetics.heightCeiling;
    const ceilingWhole = Math.floor(ceiling);
    const reachedCeiling =
      Math.floor(state.player.body.heightInches) >= ceilingWhole;

    for (const line of growthLines) {
      // Nothing in the feed states a height the player has not reached.
      const quoted = line.text.match(/(\d+)'(\d+)"/);
      if (quoted) {
        const inches = Number(quoted[1]) * 12 + Number(quoted[2]);
        expect(inches).toBeLessThanOrEqual(
          Math.floor(state.player.body.heightInches),
        );
        if (!reachedCeiling) expect(inches).toBeLessThan(ceilingWhole);
      }
      expect(line.text).not.toContain('ceiling');
      expect(line.text).not.toContain('potential');
    }
  });

  test('growth is reported on crossings, not every single month', () => {
    // "I grew 0.1 inches" fired ~70 times a career and buried everything
    // else in the feed.
    const { state } = playUntilAge(createGame(21, INPUT), 190);
    const growthLines = state.log.filter((e) => e.kind === 'growth');
    const monthsLived = state.monthsElapsed;

    expect(growthLines.length).toBeGreaterThan(2);
    expect(growthLines.length).toBeLessThan(monthsLived / 3);

    // One line per whole inch gained, at most.
    const inchesGained =
      state.player.body.heightInches -
      Math.floor(state.player.body.heightInches) +
      growthLines.length;
    expect(growthLines.length).toBeLessThanOrEqual(Math.ceil(inchesGained) + 1);
  });
});

describe('origin feeds the genetic roll (SPEC §4)', () => {
  test('taller parents produce taller ceilings', () => {
    const parents: number[] = [];
    const ceilings: number[] = [];

    for (let seed = 1; seed <= 400; seed++) {
      const state = createGame(seed, INPUT);
      parents.push(midParentalHeight(state.origin));
      ceilings.push(state.hidden.genetics.heightCeiling);
    }

    expect(correlation(parents, ceilings)).toBeGreaterThan(0.5);
  });

  test('origin is rolled and persisted in full', () => {
    const origin = createGame(3, INPUT).origin;
    expect(origin.homeCity).toBe(INPUT.homeCity);
    expect(origin.homeState).toBe(INPUT.homeState);
    expect(['low', 'modest', 'comfortable', 'affluent']).toContain(
      origin.incomeTier,
    );
    expect(['two-parent', 'single-parent', 'guardian']).toContain(
      origin.familyStructure,
    );
    expect(origin.exposureMultiplier).toBeGreaterThan(0);
    expect(origin.fatherHeightInches).toBeGreaterThan(0);
    expect(origin.motherHeightInches).toBeGreaterThan(0);
  });
});
