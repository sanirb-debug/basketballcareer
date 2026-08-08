import type { RngState } from './rng';

/** Bump when the shape of `GameState` changes in a way old saves can't satisfy. */
export const SCHEMA_VERSION = 7;

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
  /**
   * Where you actually are in 8th grade. You do not attend a high school in
   * middle school — the chosen high school is where you are *headed*.
   */
  middleSchoolName: string;
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
  // Phase 4 — academics compete for the same points as training (SPEC §9).
  'study',
  'testPrep',
  // Phase 5 — hype is its own currency (SPEC §7).
  'mixtape',
  'showcase',
  // Phase 6 — recruiting (SPEC §10).
  'visit',
  // Phase 7 — life systems (SPEC §6).
  'socialize',
  'family',
  'job',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

/**
 * What the player submits with a month tick.
 *
 * Most actions are just an id. A few — a recruiting visit, spending money on
 * a circuit — need a target, so the object form carries one. The plain string
 * stays valid so the common case reads cleanly.
 */
export type MonthAction = ActionId | { id: ActionId; target?: string };

export interface NormalizedAction {
  id: ActionId;
  target: string | null;
}

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


// --- Academics and eligibility (SPEC §9) ----------------------------------

export type EligibilityStatus = 'qualifier' | 'academic-redshirt' | 'non-qualifier';

export interface Academics {
  /** 0.0–4.0, moved by Study and decayed by neglect. */
  gpa: number;
  /** NCAA core-course credits, tracked separately from GPA. 16 required. */
  coreCredits: number;
  /** 400–1600. Zero until the test is actually sat. */
  testScore: number;
  /** Times the test has been taken — each sitting keeps the best score. */
  testAttempts: number;
  status: EligibilityStatus;
}

// --- Reputation (SPEC §6) -------------------------------------------------

/**
 * Two axes that diverge on purpose: character gates which programs will
 * recruit you, respect drives teammate and media reaction.
 */
export interface Reputation {
  onCourt: number;
  offCourt: number;
}

// --- Hype, the prospect class, and rankings (SPEC §7, §11) ----------------

export type AauTier = 'none' | 'unaffiliated' | 'ua' | 'adidas' | 'nike';
export const AAU_TIERS: readonly AauTier[] = [
  'none',
  'unaffiliated',
  'ua',
  'adidas',
  'nike',
];

/** One of the ~400 other prospects in the class, on a lightweight sim. */
export interface Prospect {
  id: string;
  name: string;
  position: Position;
  homeState: string;
  /** True skill, hidden from the player. */
  rating: number;
  hype: number;
  /** Per-month drift: some rise, some bust. */
  trajectory: number;
  isRival: boolean;
}

export interface RankedProspect {
  id: string;
  name: string;
  position: Position;
  homeState: string;
  score: number;
  rank: number;
  isPlayer: boolean;
  isRival: boolean;
}

export interface HypeState {
  hype: number;
  /** 1-based national ranking within the class. */
  nationalRank: number;
  /** Ranking a month ago, so the board can show movement. */
  previousRank: number;
  aauTier: AauTier;
  campInvites: number;
}

// --- Relationships (SPEC §6) ----------------------------------------------

export const RELATIONSHIP_IDS = [
  'parents',
  'friends',
  'girlfriend',
  'hsCoach',
  'trainer',
  'aauCoach',
] as const;
export type RelationshipId = (typeof RELATIONSHIP_IDS)[number];

export interface Relationship {
  level: number;
  /** Whether this relationship exists yet — you have no girlfriend at 13. */
  active: boolean;
}

export type Relationships = Record<RelationshipId, Relationship>;

/**
 * A named individual (SPEC §6's "BitLife-style interaction menu per
 * relationship").
 *
 * The `Relationships` record above is the aggregate the event system reads;
 * these are the actual people underneath it, each with their own name, age
 * and opinion of you.
 */
export type PersonRole =
  | 'father'
  | 'mother'
  | 'sibling'
  | 'friend'
  | 'partner'
  | 'fling'
  | 'ex'
  | 'coach'
  | 'trainer'
  | 'teammate'
  | 'agent'
  | 'child'
  | 'rival';

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  age: number;
  /** 0–100, same scale as the aggregate bucket they feed. */
  relationship: number;
  alive: boolean;
  active: boolean;
  /** `monthsElapsed` of the last interaction. */
  lastInteractionMonth: number;
  /**
   * How many times you have gone to this person *this month*.
   *
   * Not a cap — you can talk to your mother nine times in March if you want.
   * It drives diminishing returns, so the ninth conversation lands like the
   * ninth conversation.
   */
  interactionsThisMonth: number;
  /** Set on a partner you are actually committed to. */
  exclusive?: boolean;
  /** `monthsElapsed` this person came into the career. */
  metMonth?: number;
}

// --- Things you own and post (SPEC §6, §12) -------------------------------

export interface OwnedAsset {
  /** Catalog id from `assets.ts`. */
  id: string;
  purchasedMonth: number;
  price: number;
}

export type SocialPlatformId =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'twitch';

export interface SocialAccount {
  id: SocialPlatformId;
  followers: number;
  joinedMonth: number;
  lastPostMonth: number;
  /** Lifetime posts that broke out. */
  viralPosts: number;
}

/**
 * The off-court life (SPEC §6).
 *
 * The reason this is a system and not flavour text: the thing that actually
 * ends careers at this level is rarely the jumper. It is the schedule you
 * keep when nobody is watching. `distraction` is the number that carries that
 * — it is fed by how you spend your nights and it is read by training, by
 * coach trust, and by what you have left in the fourth quarter.
 */
export interface NightlifeState {
  /** 0–100. High means the life outside is running the one inside. */
  distraction: number;
  /** Nights out this month, for the diminishing-returns curve. */
  nightsThisMonth: number;
  /** Lifetime, for the career summary. */
  nightsOut: number;
  flings: number;
  /** Times it made the news. */
  tabloidStories: number;
  /** Times a partner found out. */
  caught: number;
}

// --- Recruiting (SPEC §10) ------------------------------------------------

export type ProgramTier =
  | 'blueblood'
  | 'high-major'
  | 'mid-major'
  | 'low-major'
  | 'juco';

export interface Program {
  id: string;
  name: string;
  tier: ProgramTier;
  /** National rank you must be inside for this program to offer. */
  rankCutoff: number;
  /** Minimum off-court character this staff will tolerate. */
  characterFloor: number;
  /** Academic standard — bluebloods still need you eligible. */
  requiresQualifier: boolean;
  state: string;
  /** Conference the program plays in. JUCO programs sit outside one. */
  conference: string;
  /** Roster strength 25–99 — how good the team around you is. */
  strength: number;
  /** The bar for minutes here, same idea as a high school's roster depth. */
  rosterDepth: number;
  /** Coaching quality: modifies development and trust growth. */
  coachQuality: number;
}

export interface Offer {
  programId: string;
  monthOffered: number;
  /** Offers can be pulled if you fall off or blow up your character. */
  active: boolean;
  pulledReason: string | null;
}

export interface Commitment {
  programId: string;
  monthsElapsed: number;
  /** True once signed on a signing day — a signature is much harder to undo. */
  signed: boolean;
}

export interface RecruitingState {
  /** Interest level 0–100 per program, moving month to month. */
  interest: Record<string, number>;
  /** The position each staff is recruiting this cycle (SPEC §10). */
  needs: Record<string, Position>;
  offers: Offer[];
  commitment: Commitment | null;
  decommits: number;
  visitsThisCycle: number;
  /** True once the player has signed and the recruitment is closed. */
  signed: boolean;
}

// --- Events (SPEC §12) ----------------------------------------------------

export interface PendingEvent {
  eventId: string;
  monthsElapsed: number;
}

export interface EventState {
  /** Set by a tick, cleared by the player choosing. Blocks the next tick. */
  pending: PendingEvent | null;
  /** Flags set by choices, which later events can require or forbid. */
  flags: Record<string, boolean>;
  /** Event ids already fired, so one-shot events do not repeat. */
  fired: string[];
  /** Recent choices, for the career archive. */
  decisions: { eventId: string; choice: string; monthsElapsed: number }[];
}

// --- Endings (SPEC §15) ---------------------------------------------------

export type EndingId =
  // High school terminal states
  | 'career-ending-injury'
  | 'academic-washout'
  | 'off-court-flameout'
  // Post-high-school paths that end without a pro career (SPEC §15)
  | 'rec-league'
  | 'college-washout'
  | 'juco-dead-end'
  | 'overseas-journeyman'
  | 'undrafted-grinder'
  // Pro careers
  | 'two-way-shuttle'
  | 'role-player'
  | 'role-player-with-ring'
  | 'starter'
  | 'all-star'
  | 'superstar'
  | 'hall-of-fame';


// --- Career stages (SPEC §14) ---------------------------------------------

/**
 * Where a career currently is. The high school slice is one stage among
 * several rather than the whole game.
 */
export type CareerStage =
  | 'highschool'
  | 'juco'
  | 'college'
  | 'developmental'
  | 'overseas'
  | 'nba'
  | 'retired';

/** The routes available at 18 (SPEC §14). */
export type PostHighSchoolPath =
  | 'college'
  | 'juco'
  | 'ote'
  | 'gleague'
  | 'overseas';

export interface PathOption {
  path: PostHighSchoolPath;
  /** Program id when the route is college or JUCO. */
  programId: string | null;
  label: string;
  detail: string;
  /** Money per month on this route. */
  stipend: number;
  available: boolean;
  blockedReason: string | null;
}

// --- College (SPEC §14) ---------------------------------------------------

export interface CollegeState {
  programId: string;
  /** Academic year on campus, 1–5. */
  year: number;
  /** Years of eligibility left. */
  eligibilityLeft: number;
  redshirted: boolean;
  /** True during a redshirt season — practices, does not play. */
  redshirtingNow: boolean;
  /** NIL money earned per month. */
  nilPerMonth: number;
  transfers: number;
  /** Coach trust at this program, separate from the high school number. */
  trust: number;
  /** Set when the player has entered the portal and is looking. */
  inPortal: boolean;
}

// --- Draft (SPEC §14) -----------------------------------------------------

export interface DraftState {
  /** Year of the draft the player is eligible for. */
  year: number;
  declared: boolean;
  /** Declared but retaining the option to withdraw. */
  testingWaters: boolean;
  withdrew: boolean;
  /** 1–60, or 0 if undrafted. Set on draft night. */
  pick: number;
  round: number;
  teamId: string | null;
  /** Where scouts currently project him, 1–60+, updated monthly. */
  projection: number;
  completed: boolean;
}

// --- Pro career (SPEC §14) ------------------------------------------------

export type ContractType = 'rookie-scale' | 'two-way' | 'minimum' | 'standard' | 'max';

export interface Contract {
  type: ContractType;
  /** Salary in millions per year. */
  salary: number;
  yearsLeft: number;
  teamOption: boolean;
}

export type ProRole = 'deep-bench' | 'rotation' | 'sixth-man' | 'starter' | 'star' | 'franchise';

export interface ProTeam {
  id: string;
  name: string;
  conference: 'East' | 'West';
  /** Team quality 25–99. */
  strength: number;
  wins: number;
  losses: number;
}

export interface Award {
  season: number;
  name: string;
}

export interface ProState {
  teamId: string;
  contract: Contract;
  role: ProRole;
  /** Seasons of pro experience completed. */
  seasons: number;
  championships: number;
  allStars: number;
  awards: Award[];
  league: ProTeam[];
  /** Set when the player has asked out. */
  tradeRequested: boolean;
  /** Playoff round reached last season, 0 = missed. */
  lastPlayoffRound: number;
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

export type LogKind =
  | 'growth'
  | 'system'
  | 'game'
  | 'training'
  | 'injury'
  | 'coach'
  | 'academics'
  | 'hype'
  | 'recruiting'
  | 'life';

export interface LogEntry {
  monthsElapsed: number;
  year: number;
  month: number;
  kind: LogKind;
  text: string;
}

/**
 * A named terminal state (SPEC §15).
 *
 * `decision` is the point of the whole screen: every run has to name the
 * specific choice that broke it, not just report that it ended.
 */
export interface CareerEnd {
  endingId: EndingId;
  /** The ending's name, e.g. "Academic washout". */
  reason: string;
  detail: string;
  /** The specific decision that led here. */
  decision: string;
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
  academics: Academics;
  reputation: Reputation;
  hype: HypeState;
  /** The ~400-prospect class the player is ranked inside (SPEC §11). */
  prospects: Prospect[];
  relationships: Relationships;
  /** The named people behind the aggregate buckets (SPEC §6). */
  people: Person[];
  /** Everything bought with the money (SPEC §6's money sinks). */
  assets: OwnedAsset[];
  /** Social accounts, which convert on-court results into reach (SPEC §12). */
  social: SocialAccount[];
  /** What the nights cost you (SPEC §6). Locked until the player is an adult. */
  nightlife: NightlifeState;
  recruiting: RecruitingState;
  events: EventState;
  /** Dollars. Income from family and jobs; spent on camps and trainers. */
  money: number;
  /** Which stage of the career this is (SPEC §14). */
  stage: CareerStage;
  /**
   * Set when high school is over and the player has to choose a route.
   * Blocks the clock the same way a pending event does — the fork at
   * eighteen is the single biggest decision in the game and cannot be
   * defaulted through.
   */
  awaitingPath: boolean;
  college: CollegeState | null;
  draft: DraftState | null;
  pro: ProState | null;
  careerEnd: CareerEnd | null;
  /** Everything the player is not allowed to see. Stripped by `toPublicView`. */
  hidden: {
    genetics: Genetics;
  };
  log: LogEntry[];
}
