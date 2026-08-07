import { clamp, type Rng } from './rng';
import { ATTR_MAX, ATTR_MIN } from './attributes';
import {
  ATTRIBUTE_KEYS,
  type Attributes,
  type Injury,
  type InjurySeverity,
} from './types';

/**
 * Energy and injuries (SPEC §6).
 *
 * The monthly injury roll is the spec's formula directly:
 *   base + (100 − energy)·k1 + injuryProneness·k2 + minutesLoad·k3
 *
 * Low energy sharply raises injury probability, which is the entire reason
 * Rest has to compete for an action point.
 */

export const INJURY = {
  BASE: 0.005,
  K_ENERGY: 0.00055,
  K_PRONENESS: 0.0004,
  K_MINUTES: 0.00035,

  /** Share of injuries at each severity. */
  SEVERITY_WEIGHTS: { minor: 60, moderate: 28, major: 12 },

  /** SPEC §6: "A small tail chance of career-ending." Only major injuries. */
  CAREER_ENDING_CHANCE: 0.02,
} as const;

const INJURY_NAMES: Record<InjurySeverity, readonly string[]> = {
  minor: [
    'rolled ankle',
    'jammed finger',
    'hip pointer',
    'bruised quad',
    'sprained wrist',
  ],
  moderate: [
    'high ankle sprain',
    'stress reaction in the shin',
    'partially torn ligament in the thumb',
    'strained hamstring',
    'back spasms',
  ],
  major: [
    'torn meniscus',
    'stress fracture in the foot',
    'torn labrum',
    'fractured wrist',
    'ruptured Achilles',
  ],
};

const SEVERITY_SPECS: Record<
  InjurySeverity,
  { months: [number, number]; cap: number }
> = {
  minor: { months: [1, 1], cap: 0.95 },
  moderate: { months: [2, 3], cap: 0.88 },
  major: { months: [4, 9], cap: 0.74 },
};

/** The spec's monthly injury probability. */
export function injuryProbability(
  energy: number,
  injuryProneness: number,
  minutesLoad: number,
): number {
  const p =
    INJURY.BASE +
    (100 - clamp(energy, 0, 100)) * INJURY.K_ENERGY +
    clamp(injuryProneness, 0, 99) * INJURY.K_PRONENESS +
    Math.max(0, minutesLoad) * INJURY.K_MINUTES;
  return clamp(p, 0, 0.9);
}

export interface InjuryRoll {
  injury: Injury | null;
  careerEnding: boolean;
}

export function rollInjury(
  rng: Rng,
  energy: number,
  injuryProneness: number,
  minutesLoad: number,
): InjuryRoll {
  const p = injuryProbability(energy, injuryProneness, minutesLoad);
  if (!rng.chance(p)) return { injury: null, careerEnding: false };

  const severities: InjurySeverity[] = ['minor', 'moderate', 'major'];
  const severity = rng.weighted(severities, [
    INJURY.SEVERITY_WEIGHTS.minor,
    INJURY.SEVERITY_WEIGHTS.moderate,
    INJURY.SEVERITY_WEIGHTS.major,
  ]);

  const spec = SEVERITY_SPECS[severity];
  const name = rng.pick(INJURY_NAMES[severity]);
  const months = rng.int(spec.months[0], spec.months[1]);
  const careerEnding =
    severity === 'major' && rng.chance(INJURY.CAREER_ENDING_CHANCE);

  return {
    injury: {
      name,
      severity,
      monthsRemaining: months,
      attributeCap: spec.cap,
    },
    careerEnding,
  };
}

/** Tick an injury's rehab clock down. Returns null once fully healed. */
export function advanceRehab(injury: Injury | null): Injury | null {
  if (!injury) return null;
  const monthsRemaining = injury.monthsRemaining - 1;
  if (monthsRemaining <= 0) return null;
  return { ...injury, monthsRemaining };
}

/**
 * Attributes as they actually play while hurt (SPEC §6: injuries "apply a
 * temporary attribute cap until fully healed").
 *
 * Deliberately a projection rather than a mutation — the underlying ratings
 * are untouched, so healing restores them exactly instead of needing the
 * damage to be undone.
 */
export function effectiveAttributes(
  attributes: Attributes,
  injury: Injury | null,
): Attributes {
  if (!injury) return attributes;
  const capped = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    capped[key] = clamp(
      (attributes[key] as number) * injury.attributeCap,
      ATTR_MIN,
      ATTR_MAX,
    );
  }
  return capped;
}
