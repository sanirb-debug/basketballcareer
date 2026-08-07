import type { RngState } from './rng';

/** Bump when the shape of `GameState` changes in a way old saves can't satisfy. */
export const SCHEMA_VERSION = 2;

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

// --- School (SPEC §8) -----------------------------------------------------

export type SchoolTier = 'powerhouse' | 'public' | 'prep';

export interface School {
  tier: SchoolTier;
  name: string;
  blurb: string;
  /** How good your teammates are, 25–99. Drives team scoring. */
  teamStrength: number;
  /** The bar you must clear for minutes. High means you sit as a freshman. */
  rosterDepth: number;
  /** Scout attention. Stored for Phase 5 hype; shown as flavor for now. */
  exposureMultiplier: number;
  /** Modifies training gains and how fast coach trust builds. */
  coachQuality: number;
  /** Average opponent strength on the schedule. */
  scheduleStrength: number;
  /** Coach trust you walk in the door with. */
  startingTrust: number;
}

// --- Actions and training (SPEC §3, §6) -----------------------------------

export const ACTION_IDS = [
  'lift',
  'conditioning',
  'shooting',
  'handles',
  'finishing',
  'defense',
  'playmaking',
  'film',
  'practice',
  'rest',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

/** What the player submits with a month tick. */
export type MonthAction = ActionId;

export interface TrainingState {
  /**
   * Consecutive months each action has been taken. Drives the diminishing
   * returns curve in SPEC §3 and resets to 0 after a month off.
   */
  streaks: Record<ActionId, number>;
}

// --- Condition: energy and injuries (SPEC §6) -----------------------------

export type InjurySeverity = 'minor' | 'moderate' | 'major';

export interface Injury {
  name: string;
  severity: InjurySeverity;
  monthsRemaining: number;
  /** Temporary multiplier on attributes until fully healed. */
  attributeCap: number;
}

export interface ConditionState {
  /** 0–100. Training drains it, rest restores it. */
  energy: number;
  injury: Injury | null;
}

// --- Season and games (SPEC §13) ------------------------------------------

export interface BoxScore {
  minutes: number;
  points: number;
  rebounds: number;
  offRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
}

export interface GameRecord {
  id: string;
  /** Absolute month index the game is scheduled in. */
  monthAbs: number;
  opponent: string;
  opponentStrength: number;
  home: boolean;
  playoff: boolean;
  played: boolean;
  teamScore: number;
  oppScore: number;
  win: boolean;
  box: BoxScore;
  /** Set when the player was unavailable, e.g. injured. */
  note: string | null;
}

export interface LeagueTeam {
  name: string;
  strength: number;
  wins: number;
  losses: number;
}

export interface SeasonState {
  /** The calendar year the season starts in: 2026 means the 2026-27 season. */
  seasonYear: number;
  grade: number;
  schedule: GameRecord[];
  wins: number;
  losses: number;
  league: LeagueTeam[];
  eliminated: boolean;
  playoffWins: number;
}

export interface SeasonSummary {
  seasonYear: number;
  grade: number;
  schoolName: string;
  games: number;
  wins: number;
  losses: number;
  totals: BoxScore;
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

export type LogKind = 'growth' | 'system' | 'game' | 'training' | 'injury' | 'coach';

export interface LogEntry {
  monthsElapsed: number;
  year: number;
  month: number;
  kind: LogKind;
  text: string;
}

/** Why a run ended (SPEC §15). Only the injury path exists this phase. */
export interface CareerEnd {
  reason: string;
  detail: string;
  monthsElapsed: number;
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
  school: School;
  coachTrust: number;
  training: TrainingState;
  condition: ConditionState;
  season: SeasonState | null;
  history: SeasonSummary[];
  careerEnd: CareerEnd | null;
  /** Everything the player is not allowed to see. Stripped by `toPublicView`. */
  hidden: {
    genetics: Genetics;
  };
  log: LogEntry[];
}
