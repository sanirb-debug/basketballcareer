import { clamp, type Rng } from './rng';
import type { FamilyStructure, IncomeTier, Origin } from './types';

/**
 * The origin roll (SPEC §4).
 *
 * SCOPE NOTE: this phase rolls and persists origin, but wires none of the
 * mechanics it is meant to gate. Income does not gate trainers or AAU fees,
 * location does not move exposure, and family structure adds no actions —
 * those land in Phase 3/5. The one field read this phase is parent height,
 * which feeds the genetic roll as §4 requires. Storing the rest now means
 * Phase 3 arrives without a save-schema migration.
 */

/**
 * Exposure multipliers by state (SPEC §4: rural/small state means fewer scouts;
 * hoops-heavy metro means constant exposure). Stored, not yet applied.
 */
const STATE_EXPOSURE: Readonly<Record<string, number>> = {
  California: 1.35,
  Texas: 1.3,
  Florida: 1.28,
  Georgia: 1.25,
  Illinois: 1.22,
  'New York': 1.22,
  'North Carolina': 1.2,
  Ohio: 1.15,
  Indiana: 1.15,
  Pennsylvania: 1.12,
  'New Jersey': 1.12,
  Michigan: 1.1,
  Maryland: 1.1,
  Virginia: 1.08,
  Tennessee: 1.05,
  Missouri: 1.0,
  Kentucky: 1.0,
  Kansas: 0.95,
  Oregon: 0.92,
  Iowa: 0.88,
  Nebraska: 0.85,
  Idaho: 0.78,
  Montana: 0.72,
  Wyoming: 0.68,
  'North Dakota': 0.68,
  'South Dakota': 0.68,
  Alaska: 0.62,
  Vermont: 0.65,
};

export const DEFAULT_EXPOSURE = 1.0;

/** States offered in character creation, ordered for a readable dropdown. */
export const SELECTABLE_STATES: readonly string[] = Object.keys(STATE_EXPOSURE)
  .slice()
  .sort();

export function exposureForState(state: string): number {
  return STATE_EXPOSURE[state] ?? DEFAULT_EXPOSURE;
}

const INCOME_TIERS: readonly IncomeTier[] = [
  'low',
  'modest',
  'comfortable',
  'affluent',
];
const INCOME_WEIGHTS: readonly number[] = [30, 38, 24, 8];

const FAMILY_STRUCTURES: readonly FamilyStructure[] = [
  'two-parent',
  'single-parent',
  'guardian',
];
const FAMILY_WEIGHTS: readonly number[] = [58, 36, 6];

/** Parent height distributions in inches, clamped to plausible extremes. */
const FATHER_MEAN = 70;
const FATHER_SD = 3;
const MOTHER_MEAN = 64.5;
const MOTHER_SD = 2.8;

export interface OriginInput {
  homeCity: string;
  homeState: string;
}

export function rollOrigin(rng: Rng, input: OriginInput): Origin {
  const incomeTier = rng.weighted(INCOME_TIERS, INCOME_WEIGHTS);
  const familyStructure = rng.weighted(FAMILY_STRUCTURES, FAMILY_WEIGHTS);
  const parentPlayed = rng.chance(0.18);
  const fatherHeightInches = clamp(rng.normal(FATHER_MEAN, FATHER_SD), 60, 84);
  const motherHeightInches = clamp(rng.normal(MOTHER_MEAN, MOTHER_SD), 56, 78);

  return {
    homeCity: input.homeCity,
    homeState: input.homeState,
    incomeTier,
    familyStructure,
    parentPlayed,
    fatherHeightInches,
    motherHeightInches,
    exposureMultiplier: exposureForState(input.homeState),
  };
}
