import { clamp, type Rng } from './rng';
import { GROWTH } from './growth';
import {
  MATURING_ATTRIBUTE_KEYS,
  type Genetics,
  type MaturingAttributeKey,
  type Origin,
} from './types';

/**
 * The hidden genetic roll (SPEC §4) — "the single most important mechanic".
 *
 * Rolled once at creation, stored under `state.hidden`, and never surfaced by
 * `toPublicView`. The player is meant to infer it from the monthly growth line
 * and, from Phase 3, the Doctor Visit action.
 */

export const GENETICS = {
  /**
   * Basketball prospects are not a population sample. This shifts the
   * mid-parental prediction up so the rolled class looks like kids who play,
   * landing mean adult height near 6'3".
   */
  PROSPECT_BIAS_INCHES: 5.25,
  /** Individual variation around the mid-parental prediction. */
  CEILING_NOISE_SD: 2.2,
  CEILING_MIN: 66,
  CEILING_MAX: 90,

  /**
   * Fraction of adult height already reached at 13. The spread here is what
   * makes §4's drama work: two kids both 5'8" at 13 can finish 6'0" or 6'9",
   * and a low fraction means a late bloomer with a big spurt still ahead.
   */
  START_FRACTION_MEAN: 0.87,
  START_FRACTION_SD: 0.028,
  START_FRACTION_MIN: 0.8,
  START_FRACTION_MAX: 0.95,

  WINGSPAN_RATIO_MEAN: 1.035,
  WINGSPAN_RATIO_SD: 0.022,
  WINGSPAN_RATIO_MIN: 0.97,
  WINGSPAN_RATIO_MAX: 1.1,

  FRAME_MEAN: 58,
  FRAME_SD: 13,
  ATHLETIC_MEAN: 58,
  ATHLETIC_SD: 14,
  INJURY_MEAN: 45,
  INJURY_SD: 15,
  POTENTIAL_MEAN: 55,
  POTENTIAL_SD: 15,

  /** Per-attribute spread around the athletic ceiling, so growth isn't uniform. */
  ATHLETIC_OFFSET_SD: 6,
} as const;

/**
 * Standard mid-parental height formula for a male child, in inches.
 * This is what makes the origin roll's parent heights actually drive genetics
 * rather than being flavor text.
 */
export function midParentalHeight(origin: Origin): number {
  return (origin.fatherHeightInches + origin.motherHeightInches + 5) / 2;
}

export function rollGenetics(rng: Rng, origin: Origin): Genetics {
  const heightCeiling = clamp(
    midParentalHeight(origin) +
      GENETICS.PROSPECT_BIAS_INCHES +
      rng.normal(0, GENETICS.CEILING_NOISE_SD),
    GENETICS.CEILING_MIN,
    GENETICS.CEILING_MAX,
  );

  const startingHeightFraction = clamp(
    rng.normal(GENETICS.START_FRACTION_MEAN, GENETICS.START_FRACTION_SD),
    GENETICS.START_FRACTION_MIN,
    GENETICS.START_FRACTION_MAX,
  );

  const wingspanRatio = clamp(
    rng.normal(GENETICS.WINGSPAN_RATIO_MEAN, GENETICS.WINGSPAN_RATIO_SD),
    GENETICS.WINGSPAN_RATIO_MIN,
    GENETICS.WINGSPAN_RATIO_MAX,
  );

  const frameCeiling = clamp(
    rng.normal(GENETICS.FRAME_MEAN, GENETICS.FRAME_SD),
    25,
    99,
  );
  const athleticCeiling = clamp(
    rng.normal(GENETICS.ATHLETIC_MEAN, GENETICS.ATHLETIC_SD),
    25,
    99,
  );
  const injuryProneness = clamp(
    rng.normal(GENETICS.INJURY_MEAN, GENETICS.INJURY_SD),
    25,
    99,
  );
  const potential = clamp(
    rng.normal(GENETICS.POTENTIAL_MEAN, GENETICS.POTENTIAL_SD),
    25,
    99,
  );

  const spurtStartAgeMonths = rng.int(
    GROWTH.SPURT_MIN_START_AGE_MONTHS,
    GROWTH.SPURT_MAX_START_AGE_MONTHS,
  );
  const spurtLengthMonths = rng.int(
    GROWTH.SPURT_MIN_LENGTH,
    GROWTH.SPURT_MAX_LENGTH,
  );
  const spurtMultiplier = rng.float(
    GROWTH.SPURT_MULTIPLIER_MIN,
    GROWTH.SPURT_MULTIPLIER_MAX,
  );

  const athleticOffsets = {} as Record<MaturingAttributeKey, number>;
  for (const key of MATURING_ATTRIBUTE_KEYS) {
    athleticOffsets[key] = rng.normal(0, GENETICS.ATHLETIC_OFFSET_SD);
  }

  return {
    heightCeiling,
    startingHeightFraction,
    wingspanRatio,
    frameCeiling,
    athleticCeiling,
    injuryProneness,
    potential,
    spurtStartAgeMonths,
    spurtLengthMonths,
    spurtMultiplier,
    athleticOffsets,
  };
}
