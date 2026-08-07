import { clamp, type Rng } from './rng';
import type { Body, Genetics } from './types';

/**
 * The monthly growth curve (SPEC §4).
 *
 * Height is driven by a *normalized cumulative* schedule rather than by
 * accumulating independent monthly increments. The schedule's weights are
 * normalized to sum to exactly 1 across ages 13y0m–19y0m, so the player lands
 * on their hidden ceiling exactly at 19 by construction — "reaches ceiling by
 * 19" is a property of the math, not something we approach and hope for.
 *
 * Frame/weight fills out separately over ages 17–23, per §4.
 */

export const GROWTH = {
  /** Age 13y0m — height schedule opens. */
  START_AGE_MONTHS: 156,
  /** Age 19y0m — height schedule closes, ceiling reached. */
  END_AGE_MONTHS: 228,

  /**
   * Front-loading strength. Monthly base weight decays as exp(-K * i / span),
   * so the last month of the schedule carries ~exp(-K) of the first month's.
   */
  FRONTLOAD_K: 1.6,

  /**
   * Spurt window opens somewhere in 14y0m–17y6m.
   *
   * The floor is 14y0m rather than 13y6m on purpose: players start the run
   * aged 13y0m–13y11m depending on their rolled birth month, so an earlier
   * floor would let a late-birthday player's spurt fall entirely before month
   * 0 — they'd live the whole run having already missed it.
   */
  SPURT_MIN_START_AGE_MONTHS: 168,
  SPURT_MAX_START_AGE_MONTHS: 210,
  /** SPEC §4: "one randomized 'spurt' window of 3–6 months". */
  SPURT_MIN_LENGTH: 3,
  SPURT_MAX_LENGTH: 6,
  SPURT_MULTIPLIER_MIN: 2.8,
  SPURT_MULTIPLIER_MAX: 3.6,

  /**
   * Month-to-month noise, as a fraction of *this month's own* scheduled
   * increment.
   *
   * The scale matters more than the magnitude here. A flat ±0.1" — or noise
   * scaled to remaining growth — dwarfs the real increment in the flat parts
   * of the curve, and because height is monotonic that becomes a ratchet:
   * height jumps early on a positive draw, then stalls at zero growth while
   * the schedule catches up. That smears the spurt into the months around it
   * and destroys the very acceleration §4 asks for. Scaling to the increment
   * keeps noise proportional to what the month was already going to do.
   */
  JITTER_FRACTION_OF_INCREMENT: 0.18,

  /** Age 17y0m — frame starts filling out. */
  FRAME_START_AGE_MONTHS: 204,
  /** Age 23y0m — frame fully filled. */
  FRAME_END_AGE_MONTHS: 276,
  /** Lean adolescent baseline before the frame fills. */
  BASE_BMI: 19,
  FRAME_TARGET_BMI_MIN: 20,
  FRAME_TARGET_BMI_MAX: 27,
} as const;

const SCHEDULE_SPAN = GROWTH.END_AGE_MONTHS - GROWTH.START_AGE_MONTHS;

/** Height at exactly age 13, implied by the ceiling and its starting fraction. */
export function startingHeightInches(g: Genetics): number {
  return g.heightCeiling * g.startingHeightFraction;
}

/**
 * Relative growth weight for schedule month `index` (0 = the month beginning at
 * age 13y0m). Front-loaded, multiplied inside the spurt window.
 */
export function monthlyWeight(index: number, g: Genetics): number {
  const base = Math.exp((-GROWTH.FRONTLOAD_K * index) / SCHEDULE_SPAN);
  const age = GROWTH.START_AGE_MONTHS + index;
  const inSpurt =
    age >= g.spurtStartAgeMonths &&
    age < g.spurtStartAgeMonths + g.spurtLengthMonths;
  return inSpurt ? base * g.spurtMultiplier : base;
}

/** Fraction of total 13→19 growth completed by `ageMonths`. Exactly 1 at 19. */
export function cumulativeFraction(ageMonths: number, g: Genetics): number {
  if (ageMonths <= GROWTH.START_AGE_MONTHS) return 0;
  if (ageMonths >= GROWTH.END_AGE_MONTHS) return 1;

  const elapsed = ageMonths - GROWTH.START_AGE_MONTHS;
  let consumed = 0;
  let total = 0;
  for (let i = 0; i < SCHEDULE_SPAN; i++) {
    const w = monthlyWeight(i, g);
    total += w;
    if (i < elapsed) consumed += w;
  }
  return consumed / total;
}

/** The noiseless scheduled height at a given age. */
export function scheduledHeight(ageMonths: number, g: Genetics): number {
  const start = startingHeightInches(g);
  return start + (g.heightCeiling - start) * cumulativeFraction(ageMonths, g);
}

/** BMI target implied by the hidden frame ceiling. */
export function targetBmi(frameCeiling: number): number {
  const t = (clamp(frameCeiling, 25, 99) - 25) / 74;
  return (
    GROWTH.FRAME_TARGET_BMI_MIN +
    t * (GROWTH.FRAME_TARGET_BMI_MAX - GROWTH.FRAME_TARGET_BMI_MIN)
  );
}

/**
 * BMI at a given age: flat at the lean adolescent baseline until 17, then
 * ramping toward the frame target through 23 (SPEC §4). Weight still rises
 * before 17 — but via height, not via filling out.
 */
export function bmiAtAge(ageMonths: number, g: Genetics): number {
  if (ageMonths <= GROWTH.FRAME_START_AGE_MONTHS) return GROWTH.BASE_BMI;
  const span = GROWTH.FRAME_END_AGE_MONTHS - GROWTH.FRAME_START_AGE_MONTHS;
  const p = clamp((ageMonths - GROWTH.FRAME_START_AGE_MONTHS) / span, 0, 1);
  return GROWTH.BASE_BMI + (targetBmi(g.frameCeiling) - GROWTH.BASE_BMI) * p;
}

export function weightForHeightAndBmi(heightInches: number, bmi: number): number {
  return (bmi * heightInches * heightInches) / 703;
}

/** The full body at a given age, ignoring accumulated jitter. */
export function bodyAtAge(ageMonths: number, g: Genetics): Body {
  const heightInches = scheduledHeight(ageMonths, g);
  return {
    heightInches,
    wingspanInches: heightInches * g.wingspanRatio,
    weightLbs: weightForHeightAndBmi(heightInches, bmiAtAge(ageMonths, g)),
  };
}

export interface GrowthResult {
  body: Body;
  /** Inches gained this month. Feeds the monthly growth notification. */
  grewInches: number;
}

/**
 * Advance the body by one month.
 *
 * Always consumes exactly one `normal()` draw (2 RNG calls) regardless of age,
 * so the stream stays aligned no matter where a run is in the growth window.
 *
 * Three guarantees, all asserted by the Phase 1 verification:
 *  - monotonic: `max(previous, …)` means height never decreases
 *  - bounded: `min(ceiling, …)` means jitter can never overshoot the ceiling
 *  - exact: at 19 the jitter scale is 0 and the schedule is complete, so
 *    height equals the ceiling
 */
export function growOneMonth(
  previous: Body,
  ageMonths: number,
  g: Genetics,
  rng: Rng,
): GrowthResult {
  const target = scheduledHeight(ageMonths, g);
  const increment = Math.max(0, target - scheduledHeight(ageMonths - 1, g));
  const remaining = Math.max(0, g.heightCeiling - target);

  // Capping the sd by `remaining` is what preserves the exact-ceiling
  // guarantee: at 19 there is nothing left, so sd is 0 and height lands
  // precisely on the ceiling rather than a hair under it.
  const sd =
    GROWTH.JITTER_FRACTION_OF_INCREMENT * Math.min(increment, remaining);
  // Always draws, at every age, so the RNG stream stays aligned regardless of
  // where a run sits in the growth window.
  const jitter = rng.normal(0, sd);

  const heightInches = Math.min(
    g.heightCeiling,
    Math.max(previous.heightInches, target + jitter),
  );

  const body: Body = {
    heightInches,
    wingspanInches: heightInches * g.wingspanRatio,
    weightLbs: weightForHeightAndBmi(heightInches, bmiAtAge(ageMonths, g)),
  };

  return { body, grewInches: heightInches - previous.heightInches };
}

/** Whether the month *lived* at this age falls inside the spurt window. */
export function isInSpurtWindow(ageMonths: number, g: Genetics): boolean {
  return (
    ageMonths >= g.spurtStartAgeMonths &&
    ageMonths < g.spurtStartAgeMonths + g.spurtLengthMonths
  );
}

/**
 * Whether the growth *observed* on turning `ageMonths` came from a spurt month.
 *
 * Note the offset. `H(t) - H(t-1)` draws on weight index `t - 157`, so the
 * inches you see when you turn age t were grown during the month you lived at
 * age t-1. Classifying an observed delta by the current age instead of the
 * lived age shifts the whole window by a month and folds a normal month into
 * every spurt — use this rather than `isInSpurtWindow` when looking at deltas.
 */
export function isSpurtGrowthMonth(ageMonths: number, g: Genetics): boolean {
  return isInSpurtWindow(ageMonths - 1, g);
}
