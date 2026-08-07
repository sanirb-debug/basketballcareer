import type { RngState } from './rng';

/** Bump when the shape of `GameState` changes in a way old saves can't satisfy. */
export const SCHEMA_VERSION = 1;

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export const POSITIONS: readonly Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export type Handedness = 'left' | 'right';

export type IncomeTier = 'low' | 'modest' | 'comfortable' | 'affluent';
export type FamilyStructure = 'two-parent' | 'single-parent' | 'guardian';

// --- Attributes (SPEC §5), all on the 25–99 scale -------------------------

export const PHYSICAL_KEYS = [
  'height',
  'wingspan',
  'frame',
  'vertical',
  'speed',
  'agility',
  'strength',
  'stamina',
  'durability',
] as const;

export const OFFENSE_KEYS = [
  'finishing',
  'postGame',
  'midRange',
  'catchAndShoot3',
  'offDribble3',
  'freeThrow',
  'ballHandling',
  'passingVision',
  'offBallMovement',
] as const;

export const DEFENSE_KEYS = [
  'perimeterDefense',
  'interiorDefense',
  'steal',
  'block',
  'defensiveRebounding',
  'offensiveRebounding',
] as const;

export const MENTAL_KEYS = [
  'basketballIQ',
  'motor',
  'composure',
  'coachability',
  'leadership',
] as const;

export const ATTRIBUTE_KEYS = [
  ...PHYSICAL_KEYS,
  ...OFFENSE_KEYS,
  ...DEFENSE_KEYS,
  ...MENTAL_KEYS,
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

/**
 * Derived from body measurements each tick rather than trained (SPEC §5:
 * "Height/wingspan are not trainable"). Frame follows the same rule.
 */
export const DERIVED_ATTRIBUTE_KEYS = ['height', 'wingspan', 'frame'] as const;

/** Physical attributes that mature toward the athletic ceiling with age. */
export const MATURING_ATTRIBUTE_KEYS = [
  'vertical',
  'speed',
  'agility',
  'strength',
  'stamina',
] as const;
export type MaturingAttributeKey = (typeof MATURING_ATTRIBUTE_KEYS)[number];

/** SPEC §5 "Hidden meta-stats" — tracked but never shown to the player. */
export interface HiddenMeta {
  potential: number;
  workEthic: number;
  injuryProneness: number;
  confidence: number;
}

// --- Genetics (SPEC §4) ---------------------------------------------------

/**
 * The hidden genetic roll. Never surfaced through `toPublicView`; the player is
 * meant to infer it from the monthly growth line and (later) Doctor Visits.
 */
export interface Genetics {
  /** Final adult height in inches. */
  heightCeiling: number;
  /** Fraction of the ceiling already reached at exactly age 13. */
  startingHeightFraction: number;
  /** Wingspan as a multiple of height. */
  wingspanRatio: number;
  /** How much muscle the frame can carry, 25–99. */
  frameCeiling: number;
  /** Vertical / speed potential, 25–99. */
  athleticCeiling: number;
  injuryProneness: number;
  /** Soft cap on skill growth rate, 25–99. */
  potential: number;
  /** Age in months at which the growth spurt begins. */
  spurtStartAgeMonths: number;
  /** Spurt length in months, 3–6 per SPEC §4. */
  spurtLengthMonths: number;
  /** How sharply growth accelerates inside the spurt window. */
  spurtMultiplier: number;
  /** Per-attribute offsets from the athletic ceiling, so maturation isn't uniform. */
  athleticOffsets: Record<MaturingAttributeKey, number>;
}

// --- Origin (SPEC §4) -----------------------------------------------------

/**
 * Rolled and persisted at creation. Only `fatherHeightInches` /
 * `motherHeightInches` are read this phase — they feed the genetic roll.
 * Income, location, and family structure gate real mechanics in Phase 3/5;
 * they are stored now purely so that arriving doesn't need a save migration.
 */
export interface Origin {
  homeCity: string;
  homeState: string;
  incomeTier: IncomeTier;
  familyStructure: FamilyStructure;
  parentPlayed: boolean;
  fatherHeightInches: number;
  motherHeightInches: number;
  /** Stored for Phase 5's hype math. Nothing reads it yet. */
  exposureMultiplier: number;
}

// --- Player and state -----------------------------------------------------

/** Ground-truth measurements. The 25–99 ratings are derived from these. */
export interface Body {
  heightInches: number;
  wingspanInches: number;
  weightLbs: number;
}

export interface Player {
  name: string;
  position: Position;
  jerseyNumber: number;
  handedness: Handedness;
  birthYear: number;
  /** 0 = January. */
  birthMonth: number;
  body: Body;
  attributes: Attributes;
  hiddenMeta: HiddenMeta;
}

export interface Clock {
  year: number;
  /** 0 = January. */
  month: number;
}

export type LogKind = 'growth' | 'system';

export interface LogEntry {
  monthsElapsed: number;
  year: number;
  month: number;
  kind: LogKind;
  text: string;
}

/**
 * The complete save payload.
 *
 * INVARIANT: structured-clone safe. Plain data only — no class instances, no
 * functions, no Map/Set. The RNG is never stored as an object, only its
 * `{ s, calls }` state. The Phase 0 verification asserts a clean round-trip.
 */
export interface GameState {
  schemaVersion: number;
  seed: number;
  rngState: RngState;
  clock: Clock;
  monthsElapsed: number;
  player: Player;
  origin: Origin;
  /** Everything the player is not allowed to see. Stripped by `toPublicView`. */
  hidden: {
    genetics: Genetics;
  };
  log: LogEntry[];
}

/**
 * Actions submitted with a month tick. Deliberately empty for Phase 0/1 — the
 * parameter exists so `tick`'s signature is right from the first commit
 * (SPEC §16.3). Training and action points arrive in Phase 3.
 */
export type MonthAction = never;
