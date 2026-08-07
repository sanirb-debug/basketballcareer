import { clamp, type Rng } from './rng';
import { bmiAtAge } from './growth';
import {
  ATTRIBUTE_KEYS,
  DEFENSE_KEYS,
  MATURING_ATTRIBUTE_KEYS,
  MENTAL_KEYS,
  OFFENSE_KEYS,
  type AttributeKey,
  type Attributes,
  type Body,
  type Genetics,
  type MaturingAttributeKey,
  type Position,
} from './types';

/**
 * The attribute system (SPEC §5). Everything sits on the 25–99 scale and
 * Overall is a position-weighted composite.
 *
 * Three physical ratings — height, wingspan, frame — are *derived* from the
 * body measurements every tick rather than stored independently, because §5
 * says height and wingspan are not trainable. `durability` derives from hidden
 * injury proneness, and the five athletic ratings mature toward the hidden
 * athletic ceiling with age. That leaves offense/defense/mental as the only
 * stored, trainable values — and nothing trains them until Phase 3.
 */

export const ATTR_MIN = 25;
export const ATTR_MAX = 99;

export const RATING = {
  /** Height in inches mapped onto the rating scale. */
  HEIGHT_MIN_INCHES: 66,
  HEIGHT_MAX_INCHES: 87,
  /** Wingspan in inches mapped onto the rating scale. */
  WINGSPAN_MIN_INCHES: 68,
  WINGSPAN_MAX_INCHES: 92,
  /** BMI mapped onto the frame rating. */
  FRAME_MIN_BMI: 18,
  FRAME_MAX_BMI: 28,

  /** Age 20y0m — athletic maturation completes. */
  PHYSICAL_MATURE_AGE_MONTHS: 240,
  /** Age 13y0m — athletic maturation begins. */
  PHYSICAL_START_AGE_MONTHS: 156,
  /** How far up toward their athletic target a 13-year-old already sits. */
  YOUTH_ATHLETIC_FRACTION: 0.45,

  /** Starting roll for trainable attributes at 13. */
  START_MEAN: 32,
  START_SD: 5,
  START_MIN: 25,
  START_MAX: 50,
  /** Bonus at the position's most-weighted attributes. */
  POSITION_AFFINITY_BONUS: 5,
  /** Swing from the hidden potential roll. */
  POTENTIAL_BONUS: 3,
} as const;

function mapToRating(value: number, min: number, max: number): number {
  const t = (value - min) / (max - min);
  return clamp(ATTR_MIN + t * (ATTR_MAX - ATTR_MIN), ATTR_MIN, ATTR_MAX);
}

export function heightRating(heightInches: number): number {
  return mapToRating(
    heightInches,
    RATING.HEIGHT_MIN_INCHES,
    RATING.HEIGHT_MAX_INCHES,
  );
}

export function wingspanRating(wingspanInches: number): number {
  return mapToRating(
    wingspanInches,
    RATING.WINGSPAN_MIN_INCHES,
    RATING.WINGSPAN_MAX_INCHES,
  );
}

export function frameRating(ageMonths: number, g: Genetics): number {
  return mapToRating(
    bmiAtAge(ageMonths, g),
    RATING.FRAME_MIN_BMI,
    RATING.FRAME_MAX_BMI,
  );
}

export function durabilityRating(injuryProneness: number): number {
  return clamp(124 - injuryProneness, ATTR_MIN, ATTR_MAX);
}

/** Where an athletic attribute tops out, given the ceiling and its offset. */
export function maturingTarget(key: MaturingAttributeKey, g: Genetics): number {
  return clamp(g.athleticCeiling + g.athleticOffsets[key], ATTR_MIN, ATTR_MAX);
}

/**
 * Athletic maturation: the body expressing its genetics with age, not training.
 * Interpolates from a youth baseline at 13 to the full target at 20.
 */
export function maturingValue(
  key: MaturingAttributeKey,
  g: Genetics,
  ageMonths: number,
): number {
  const target = maturingTarget(key, g);
  const base = ATTR_MIN + (target - ATTR_MIN) * RATING.YOUTH_ATHLETIC_FRACTION;
  const span =
    RATING.PHYSICAL_MATURE_AGE_MONTHS - RATING.PHYSICAL_START_AGE_MONTHS;
  const progress = clamp(
    (ageMonths - RATING.PHYSICAL_START_AGE_MONTHS) / span,
    0,
    1,
  );
  return clamp(base + (target - base) * progress, ATTR_MIN, ATTR_MAX);
}

// --- Position weighting ---------------------------------------------------

/** Neutral wing weighting; each position overrides from here. */
const BASE_WEIGHTS: Record<AttributeKey, number> = {
  height: 3,
  wingspan: 2,
  frame: 2,
  vertical: 3,
  speed: 3,
  agility: 3,
  strength: 3,
  stamina: 3,
  durability: 2,
  finishing: 4,
  postGame: 2,
  midRange: 3,
  catchAndShoot3: 4,
  offDribble3: 3,
  freeThrow: 2,
  ballHandling: 3,
  passingVision: 3,
  offBallMovement: 3,
  perimeterDefense: 3,
  interiorDefense: 2,
  steal: 2,
  block: 2,
  defensiveRebounding: 2,
  offensiveRebounding: 2,
  basketballIQ: 4,
  motor: 3,
  composure: 3,
  coachability: 2,
  leadership: 2,
};

const POSITION_OVERRIDES: Record<
  Position,
  Partial<Record<AttributeKey, number>>
> = {
  PG: {
    height: 1,
    strength: 1.5,
    speed: 5,
    agility: 5,
    ballHandling: 7,
    passingVision: 7,
    offDribble3: 5,
    finishing: 3,
    postGame: 0.5,
    perimeterDefense: 4,
    interiorDefense: 0.5,
    steal: 4,
    block: 0.5,
    defensiveRebounding: 1,
    offensiveRebounding: 0.5,
    basketballIQ: 6,
    leadership: 4,
  },
  SG: {
    height: 2,
    speed: 4,
    agility: 4,
    midRange: 4,
    catchAndShoot3: 6,
    offDribble3: 5,
    freeThrow: 3,
    ballHandling: 4,
    offBallMovement: 5,
    postGame: 1,
    perimeterDefense: 4,
    interiorDefense: 1,
    block: 1,
  },
  SF: {
    height: 3.5,
    speed: 4,
    agility: 4,
    finishing: 5,
    catchAndShoot3: 5,
    perimeterDefense: 4,
    defensiveRebounding: 3,
    motor: 4,
  },
  PF: {
    height: 5,
    wingspan: 4,
    frame: 4,
    strength: 5,
    speed: 2,
    agility: 2,
    finishing: 5,
    postGame: 4,
    ballHandling: 1,
    offDribble3: 1,
    passingVision: 2,
    interiorDefense: 5,
    block: 4,
    defensiveRebounding: 5,
    offensiveRebounding: 4,
  },
  C: {
    height: 7,
    wingspan: 5,
    frame: 5,
    strength: 6,
    speed: 1.5,
    agility: 1.5,
    finishing: 5,
    postGame: 5,
    catchAndShoot3: 1,
    offDribble3: 0.5,
    ballHandling: 0.5,
    passingVision: 2,
    perimeterDefense: 1.5,
    interiorDefense: 6,
    block: 6,
    defensiveRebounding: 6,
    offensiveRebounding: 5,
  },
};

function buildNormalizedWeights(position: Position): Record<AttributeKey, number> {
  const raw = { ...BASE_WEIGHTS, ...POSITION_OVERRIDES[position] };
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) total += raw[key];

  const normalized = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) normalized[key] = raw[key] / total;
  return normalized;
}

/** Normalized weights per position; each map sums to exactly 1. */
export const POSITION_WEIGHTS: Record<
  Position,
  Record<AttributeKey, number>
> = {
  PG: buildNormalizedWeights('PG'),
  SG: buildNormalizedWeights('SG'),
  SF: buildNormalizedWeights('SF'),
  PF: buildNormalizedWeights('PF'),
  C: buildNormalizedWeights('C'),
};

/** Position-weighted composite overall (SPEC §5). */
export function overallFor(attributes: Attributes, position: Position): number {
  const weights = POSITION_WEIGHTS[position];
  let sum = 0;
  for (const key of ATTRIBUTE_KEYS) sum += attributes[key] * weights[key];
  return clamp(Math.round(sum), ATTR_MIN, ATTR_MAX);
}

// --- Creation and per-tick recomputation ----------------------------------

/** Attributes the player trains. Everything else is derived from the body. */
const TRAINABLE_KEYS = [
  ...OFFENSE_KEYS,
  ...DEFENSE_KEYS,
  ...MENTAL_KEYS,
] as const;

/**
 * Roll the trainable attributes for a 13-year-old — low across the board, with
 * a nudge toward the position they prefer and a nudge from hidden potential.
 */
export function rollStartingAttributes(
  rng: Rng,
  g: Genetics,
  position: Position,
  ageMonths: number,
  body: Body,
): Attributes {
  const weights = POSITION_WEIGHTS[position];
  let maxWeight = 0;
  for (const key of TRAINABLE_KEYS) {
    if (weights[key] > maxWeight) maxWeight = weights[key];
  }

  const potentialBonus =
    ((g.potential - 55) / 44) * RATING.POTENTIAL_BONUS;

  const attributes = {} as Attributes;
  for (const key of TRAINABLE_KEYS) {
    const affinity =
      (weights[key] / maxWeight) * RATING.POSITION_AFFINITY_BONUS;
    const rolled =
      rng.normal(RATING.START_MEAN, RATING.START_SD) + affinity + potentialBonus;
    attributes[key] = clamp(rolled, RATING.START_MIN, RATING.START_MAX);
  }

  return applyDerivedAttributes(attributes, g, ageMonths, body);
}

/**
 * Recompute every non-trainable attribute from the body, age, and genetics.
 * Runs on the same inputs every tick, so it is idempotent — calling it twice
 * with the same state produces the same result.
 */
export function applyDerivedAttributes(
  attributes: Attributes,
  g: Genetics,
  ageMonths: number,
  body: Body,
): Attributes {
  const next: Attributes = { ...attributes };

  next.height = heightRating(body.heightInches);
  next.wingspan = wingspanRating(body.wingspanInches);
  next.frame = frameRating(ageMonths, g);
  next.durability = durabilityRating(g.injuryProneness);

  for (const key of MATURING_ATTRIBUTE_KEYS) {
    next[key] = maturingValue(key, g, ageMonths);
  }

  return next;
}
