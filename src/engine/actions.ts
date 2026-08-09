import { clamp, type Rng } from './rng';
import { ATTR_MAX, ATTR_MIN } from './attributes';
import {
  ACTION_IDS,
  type ActionId,
  type AttributeKey,
  type Attributes,
  type MonthAction,
  type NormalizedAction,
  type TrainingState,
} from './types';

/** Accept both the plain-string and targeted forms of a submitted action. */
export function normalizeActions(actions: MonthAction[]): NormalizedAction[] {
  return actions.map((a) =>
    typeof a === 'string'
      ? { id: a, target: null }
      : { id: a.id, target: a.target ?? null },
  );
}

/**
 * Action points and training (SPEC §3, §6).
 *
 * Everything the player can do in a month competes for the same points, and
 * repeating the same training gets progressively less out of it — spamming one
 * attribute must never be the optimal line.
 */

export interface TrainedAttribute {
  key: AttributeKey;
  weight: number;
}

export interface ActionDef {
  id: ActionId;
  label: string;
  description: string;
  category: 'training' | 'recovery' | 'team' | 'academic' | 'exposure' | 'life';
  /** Energy spent. Recovery actions use a negative cost to restore. */
  energyCost: number;
  trains: TrainedAttribute[];
  /** Direct coach trust movement (SPEC §6: practice attendance). */
  trustDelta: number;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  lift: {
    id: 'lift',
    label: 'Weight room',
    description: 'Add strength and start carrying real weight.',
    category: 'training',
    energyCost: 18,
    trains: [
      { key: 'strength', weight: 1 },
      { key: 'frame', weight: 0.4 },
      { key: 'durability', weight: 0.3 },
    ],
    trustDelta: 0,
  },
  conditioning: {
    id: 'conditioning',
    label: 'Conditioning',
    description: 'Track work and footwork ladders. Wind and first step.',
    category: 'training',
    energyCost: 16,
    trains: [
      { key: 'stamina', weight: 1 },
      { key: 'speed', weight: 0.6 },
      { key: 'agility', weight: 0.6 },
    ],
    trustDelta: 0,
  },
  shooting: {
    id: 'shooting',
    label: 'Shooting',
    description: 'Form work, spot-ups, free throws.',
    category: 'training',
    energyCost: 14,
    trains: [
      { key: 'catchAndShoot3', weight: 1 },
      { key: 'midRange', weight: 0.7 },
      { key: 'freeThrow', weight: 0.5 },
      { key: 'offDribble3', weight: 0.4 },
    ],
    trustDelta: 0,
  },
  handles: {
    id: 'handles',
    label: 'Ball handling',
    description: 'Two-ball drills, change of pace, pressure work.',
    category: 'training',
    energyCost: 14,
    trains: [
      { key: 'ballHandling', weight: 1 },
      { key: 'offDribble3', weight: 0.4 },
      { key: 'agility', weight: 0.3 },
    ],
    trustDelta: 0,
  },
  finishing: {
    id: 'finishing',
    label: 'Finishing',
    description: 'Contact finishes, floaters, post touches.',
    category: 'training',
    energyCost: 16,
    trains: [
      { key: 'finishing', weight: 1 },
      { key: 'postGame', weight: 0.6 },
      { key: 'vertical', weight: 0.3 },
    ],
    trustDelta: 0,
  },
  defense: {
    id: 'defense',
    label: 'Defense',
    description: 'Slides, closeouts, rotations, rebounding.',
    category: 'training',
    energyCost: 17,
    trains: [
      { key: 'perimeterDefense', weight: 0.8 },
      { key: 'interiorDefense', weight: 0.6 },
      { key: 'steal', weight: 0.5 },
      { key: 'block', weight: 0.4 },
      { key: 'defensiveRebounding', weight: 0.5 },
    ],
    trustDelta: 1,
  },
  playmaking: {
    id: 'playmaking',
    label: 'Playmaking',
    description: 'Reads, pocket passes, moving without the ball.',
    category: 'training',
    energyCost: 14,
    trains: [
      { key: 'passingVision', weight: 1 },
      { key: 'offBallMovement', weight: 0.6 },
      { key: 'basketballIQ', weight: 0.4 },
    ],
    trustDelta: 0,
  },
  film: {
    id: 'film',
    label: 'Film study',
    description: 'Sit with the coaches and actually watch it back.',
    category: 'training',
    energyCost: 6,
    trains: [
      { key: 'basketballIQ', weight: 1 },
      { key: 'composure', weight: 0.5 },
      { key: 'coachability', weight: 0.4 },
    ],
    trustDelta: 2,
  },
  practice: {
    id: 'practice',
    label: 'Team practice',
    description: 'Show up, compete, do the little things. Coaches notice.',
    category: 'team',
    energyCost: 12,
    trains: [
      { key: 'coachability', weight: 0.5 },
      { key: 'motor', weight: 0.4 },
      { key: 'basketballIQ', weight: 0.3 },
    ],
    trustDelta: 6,
  },
  rest: {
    id: 'rest',
    label: 'Rest',
    description: 'Recover. Boring, and the difference between a career and a rehab table.',
    category: 'recovery',
    energyCost: -38,
    trains: [],
    trustDelta: -1,
  },
  study: {
    id: 'study',
    label: 'Study',
    description:
      'Hit the books. Costs exactly what a training session costs — that is the whole design.',
    category: 'academic',
    energyCost: 10,
    trains: [{ key: 'basketballIQ', weight: 0.2 }],
    trustDelta: 0,
  },
  testPrep: {
    id: 'testPrep',
    label: 'Test prep',
    description: 'Sit the SAT. A qualifying score is not optional if you want D1.',
    category: 'academic',
    energyCost: 12,
    trains: [{ key: 'basketballIQ', weight: 0.15 }],
    trustDelta: 0,
  },
  mixtape: {
    id: 'mixtape',
    label: 'Post a mixtape',
    description: 'Cut your highlights and put them out. One viral clip beats three good games.',
    category: 'exposure',
    energyCost: 8,
    trains: [],
    trustDelta: -1,
  },
  showcase: {
    id: 'showcase',
    label: 'Camp / showcase',
    description: 'Play in front of the people who make lists. Costs money and legs.',
    category: 'exposure',
    energyCost: 20,
    trains: [{ key: 'composure', weight: 0.3 }],
    trustDelta: 0,
  },
  visit: {
    id: 'visit',
    label: 'Campus visit',
    description: 'Go see a program. Raises their interest more than any phone call.',
    category: 'exposure',
    energyCost: 6,
    trains: [],
    trustDelta: 0,
  },
  socialize: {
    id: 'socialize',
    label: 'See your people',
    description: 'Friends, and whoever else matters. Relationships decay if you never show up.',
    category: 'life',
    energyCost: 4,
    trains: [],
    trustDelta: 0,
  },
  family: {
    id: 'family',
    label: 'Family time',
    description: 'Be at home and be present for it.',
    category: 'life',
    energyCost: 3,
    trains: [],
    trustDelta: 0,
  },
  job: {
    id: 'job',
    label: 'Work a shift',
    description: 'Money in your pocket and your family’s. Hours you will not get back.',
    category: 'life',
    energyCost: 20,
    trains: [{ key: 'strength', weight: 0.15 }],
    trustDelta: 0,
  },
};

/**
 * Energy is switched off for now.
 *
 * It was a real constraint — training drained it, low energy hurt production
 * and raised the injury roll — but it made the month-to-month feel like
 * bookkeeping rather than a life. The formulas are all still here and still
 * tested, so turning this back on restores the whole system in one line.
 *
 * While it is off: nothing drains, the training penalty is neutral, the
 * injury roll sees a rested player, and the UI does not mention it.
 */
export const ENERGY_ENABLED = false;

export const TRAINING = {
  /** Attribute points a primary-weighted action yields at neutral conditions. */
  /**
   * Tuned against the balance suite with `ENERGY_ENABLED` off.
   *
   * Energy used to hold development back roughly 30% over a career — a
   * player grinding four actions a month spent far more than the monthly
   * regen and trained at the low end of `energyTrainingFactor` most of the
   * time. Removing that made 92% of dedicated careers reach the league
   * against a 75% ceiling, so the base rate absorbs what energy used to take.
   * Restore this to 3.4 if energy is ever switched back on.
   */
  BASE_GAIN: 2.15,

  /**
   * SPEC §3 diminishing returns: ×1.0, ×0.8, ×0.6, floor at ×0.5, reset after
   * a month off. Indexed by how many consecutive months the action was taken.
   */
  DIMINISHING: [1, 0.8, 0.6, 0.5] as const,

  /**
   * Soft cap on any trained attribute, derived from hidden potential.
   *
   * SPEC §5 calls potential "a soft cap on skill growth *rate*" — it is meant
   * to slow you down, not wall you off. An earlier, tighter curve capped an
   * average-potential player near 75, which made genetics decide the entire
   * career and left effort worth almost nothing: a dedicated run and a lazy
   * one finished within two points of each other. This band leaves an average
   * player real room to work with while keeping the very top for the gifted.
   */
  CEILING_BASE: 62,
  CEILING_PER_POTENTIAL: 0.37,
  /** Gains taper across this many points below the ceiling. */
  HEADROOM_BAND: 18,

  /** Natural energy recovery each month, before actions. */
  PASSIVE_ENERGY_REGEN: 9,
  /** Dollars earned per Work a shift action. */
  JOB_INCOME: 420,
  /** Relationship points per tending action. */
  RELATIONSHIP_BOOST: 11,
  ENERGY_MIN: 0,
  ENERGY_MAX: 100,
} as const;

export function diminishingFor(streak: number): number {
  const table = TRAINING.DIMINISHING;
  return streak < table.length
    ? (table[streak] as number)
    : (table[table.length - 1] as number);
}

/** The soft cap SPEC §5 describes: potential limits how far a skill can go. */
export function skillCeiling(potential: number): number {
  return clamp(
    TRAINING.CEILING_BASE + potential * TRAINING.CEILING_PER_POTENTIAL,
    ATTR_MIN,
    ATTR_MAX,
  );
}

export function ageTrainingFactor(ageMonths: number): number {
  const years = ageMonths / 12;
  return clamp(1.45 - (years - 13) * 0.075, 0.4, 1.45);
}

export function potentialTrainingFactor(potential: number): number {
  return 0.55 + ((clamp(potential, 25, 99) - 25) / 74) * 0.9;
}

export function coachTrainingFactor(coachQuality: number): number {
  return 0.75 + (clamp(coachQuality, 0, 99) / 99) * 0.5;
}

export function workEthicFactor(workEthic: number): number {
  return 0.8 + (clamp(workEthic, 25, 99) / 99) * 0.4;
}

export function energyTrainingFactor(energy: number): number {
  return 0.6 + (clamp(energy, 0, 100) / 100) * 0.4;
}

export interface TrainingContext {
  ageMonths: number;
  potential: number;
  workEthic: number;
  coachQuality: number;
  /** Energy at the moment the action is performed. */
  energy: number;
  /**
   * Everything outside the gym that scales a session, multiplied together:
   * what the player owns pushes it up, what the nights cost pushes it down
   * (SPEC §6). Defaults to 1 so callers that do not care are unaffected.
   *
   * The clamp below is deliberately two-sided. It was one-sided when only
   * equipment fed this, and that silently swallowed every downward factor.
   */
  trainingMultiplier?: number;
}

export interface ApplyActionsResult {
  attributes: Attributes;
  energy: number;
  trustDelta: number;
  streaks: Record<ActionId, number>;
  gained: { key: AttributeKey; amount: number }[];
}

function emptyStreaks(): Record<ActionId, number> {
  const streaks = {} as Record<ActionId, number>;
  for (const id of ACTION_IDS) streaks[id] = 0;
  return streaks;
}

export function initialTrainingState(): TrainingState {
  return { streaks: emptyStreaks() };
}

/**
 * Resolve a month's chosen actions.
 *
 * Order matters: energy is spent as each action runs, so the fourth training
 * session in a month is genuinely worth less than the first, and a month with
 * no rest quietly makes everything after it weaker.
 */
export function applyActions(
  chosen: ActionId[],
  attributes: Attributes,
  training: TrainingState,
  context: TrainingContext,
  rng: Rng,
): ApplyActionsResult {
  const next: Attributes = { ...attributes };
  const gainsByKey = new Map<AttributeKey, number>();

  let energy = clamp(context.energy, TRAINING.ENERGY_MIN, TRAINING.ENERGY_MAX);
  let trustDelta = 0;

  const ceiling = skillCeiling(context.potential);
  const ageF = ageTrainingFactor(context.ageMonths);
  const potF = potentialTrainingFactor(context.potential);
  const coachF = coachTrainingFactor(context.coachQuality);
  const ethicF = workEthicFactor(context.workEthic);
  const outsideF = clamp(context.trainingMultiplier ?? 1, 0.45, 1.45);

  // Repeats *within* a month walk the same diminishing curve as repeats across
  // months. Without this, stacking four Shooting sessions into one offseason
  // month would pay full rate four times over and sidestep SPEC §3 entirely.
  const repeatsThisMonth = new Map<ActionId, number>();

  for (const id of chosen) {
    const def = ACTIONS[id];
    const energyF = ENERGY_ENABLED ? energyTrainingFactor(energy) : 1;
    const repeatIndex = repeatsThisMonth.get(id) ?? 0;
    const streak = (training.streaks[id] ?? 0) + repeatIndex;
    const dim = diminishingFor(streak);
    repeatsThisMonth.set(id, repeatIndex + 1);

    for (const { key, weight } of def.trains) {
      const current = next[key] as number;
      const headroom = clamp(
        (ceiling - current) / TRAINING.HEADROOM_BAND,
        0,
        1,
      );
      const jitter = rng.float(0.85, 1.15);
      const gain =
        TRAINING.BASE_GAIN *
        weight *
        ageF *
        potF *
        coachF *
        ethicF *
        energyF *
        outsideF *
        headroom *
        dim *
        jitter;

      if (gain > 0) {
        next[key] = clamp(current + gain, ATTR_MIN, ATTR_MAX);
        gainsByKey.set(key, (gainsByKey.get(key) ?? 0) + gain);
      }
    }

    trustDelta += def.trustDelta;
    if (ENERGY_ENABLED) {
      energy = clamp(
        energy - def.energyCost,
        TRAINING.ENERGY_MIN,
        TRAINING.ENERGY_MAX,
      );
    }
  }

  // Streaks advance for what was chosen and reset for everything else — the
  // "resets after a month off" half of SPEC §3.
  const streaks = emptyStreaks();
  const takenThisMonth = new Set(chosen);
  for (const id of ACTION_IDS) {
    streaks[id] = takenThisMonth.has(id) ? (training.streaks[id] ?? 0) + 1 : 0;
  }

  return {
    attributes: next,
    energy,
    trustDelta,
    streaks,
    gained: [...gainsByKey.entries()]
      .map(([key, amount]) => ({ key, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
