import type { CareerStage, Clock } from './types';

/**
 * The sim clock and the basketball calendar (SPEC §3).
 *
 * A run starts in August — the head of the Aug–Oct offseason block that
 * precedes the Nov–Feb season, so month 0 lines up with the start of a
 * basketball/school year.
 */

export const START_YEAR = 2026;
/** 0 = January, so 7 = August. */
export const START_MONTH = 7;
export const STARTING_AGE_YEARS = 13;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type SeasonPhase =
  | 'REGULAR_SEASON'
  | 'POSTSEASON'
  | 'AAU'
  | 'LIVE_PERIOD'
  | 'OFFSEASON'
  | 'PRESEASON'
  | 'PORTAL'
  | 'FREE_AGENCY'
  | 'SUMMER';

export interface PhaseInfo {
  phase: SeasonPhase;
  label: string;
  /**
   * Action-point budget from SPEC §3. Stored for Phase 3 — nothing spends or
   * enforces it yet.
   */
  actionPoints: number;
}

/** High school, indexed by calendar month, 0 = January. */
const HIGH_SCHOOL_PHASES: readonly PhaseInfo[] = [
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Jan
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Feb
  { phase: 'POSTSEASON', label: 'Playoffs', actionPoints: 1 }, // Mar
  { phase: 'AAU', label: 'AAU / Spring Circuit', actionPoints: 3 }, // Apr
  { phase: 'AAU', label: 'AAU / Spring Circuit', actionPoints: 3 }, // May
  { phase: 'AAU', label: 'AAU / Spring Circuit', actionPoints: 3 }, // Jun
  { phase: 'LIVE_PERIOD', label: 'Live Period', actionPoints: 1 }, // Jul
  { phase: 'OFFSEASON', label: 'Offseason', actionPoints: 4 }, // Aug
  { phase: 'OFFSEASON', label: 'Offseason', actionPoints: 4 }, // Sep
  { phase: 'OFFSEASON', label: 'Offseason', actionPoints: 4 }, // Oct
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Nov
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Dec
];

/**
 * College and JUCO. The spring is the portal and the stay-or-go decision
 * rather than the AAU circuit, and September–October is preseason.
 */
const COLLEGE_PHASES: readonly PhaseInfo[] = [
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Jan
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Feb
  { phase: 'POSTSEASON', label: 'March', actionPoints: 1 }, // Mar
  { phase: 'PORTAL', label: 'Portal / Stay-or-Go', actionPoints: 3 }, // Apr
  { phase: 'PORTAL', label: 'Portal / Stay-or-Go', actionPoints: 3 }, // May
  { phase: 'SUMMER', label: 'Summer', actionPoints: 4 }, // Jun
  { phase: 'SUMMER', label: 'Summer', actionPoints: 4 }, // Jul
  { phase: 'SUMMER', label: 'Summer', actionPoints: 4 }, // Aug
  { phase: 'PRESEASON', label: 'Preseason', actionPoints: 3 }, // Sep
  { phase: 'PRESEASON', label: 'Preseason', actionPoints: 3 }, // Oct
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Nov
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 2 }, // Dec
];

/** The pro calendar: an October–March grind, April playoffs, July free agency. */
const PRO_PHASES: readonly PhaseInfo[] = [
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 1 }, // Jan
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 1 }, // Feb
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 1 }, // Mar
  { phase: 'POSTSEASON', label: 'Playoffs', actionPoints: 1 }, // Apr
  { phase: 'OFFSEASON', label: 'Offseason', actionPoints: 3 }, // May
  { phase: 'OFFSEASON', label: 'Offseason', actionPoints: 3 }, // Jun
  { phase: 'FREE_AGENCY', label: 'Free Agency', actionPoints: 2 }, // Jul
  { phase: 'OFFSEASON', label: 'Offseason', actionPoints: 4 }, // Aug
  { phase: 'PRESEASON', label: 'Training Camp', actionPoints: 3 }, // Sep
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 1 }, // Oct
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 1 }, // Nov
  { phase: 'REGULAR_SEASON', label: 'Season', actionPoints: 1 }, // Dec
];

/**
 * The action-point budget and month texture depend on where a career is
 * (SPEC §3, §14). A July in high school is the live period; a July in the
 * league is free agency; a July in college is summer workouts.
 */
export function phaseFor(clock: Clock, stage: CareerStage = 'highschool'): PhaseInfo {
  switch (stage) {
    case 'nba':
      return PRO_PHASES[clock.month] as PhaseInfo;
    case 'college':
    case 'juco':
    case 'overseas':
    case 'developmental':
      return COLLEGE_PHASES[clock.month] as PhaseInfo;
    default:
      return HIGH_SCHOOL_PHASES[clock.month] as PhaseInfo;
  }
}

/** Absolute month index, for arithmetic across year boundaries. */
export function absoluteMonth(year: number, month: number): number {
  return year * 12 + month;
}

export function advanceClock(clock: Clock): Clock {
  const next = absoluteMonth(clock.year, clock.month) + 1;
  return { year: Math.floor(next / 12), month: next % 12 };
}

export function ageInMonths(
  clock: Clock,
  birthYear: number,
  birthMonth: number,
): number {
  return (
    absoluteMonth(clock.year, clock.month) - absoluteMonth(birthYear, birthMonth)
  );
}

export function ageYears(
  clock: Clock,
  birthYear: number,
  birthMonth: number,
): number {
  return Math.floor(ageInMonths(clock, birthYear, birthMonth) / 12);
}

/**
 * Given a rolled birth month, the birth year that makes the player exactly
 * `STARTING_AGE_YEARS` at the start of the run.
 *
 * Born Jan–Aug and they turn 13 before the August start (age 13y0m–13y7m);
 * born Sep–Dec and their 13th birthday was in the prior calendar year
 * (age 13y8m–13y11m). The spread across runs is the relative-age effect.
 */
export function birthYearForMonth(birthMonth: number): number {
  const offset = birthMonth <= START_MONTH ? 0 : 1;
  return START_YEAR - STARTING_AGE_YEARS - offset;
}

export function formatClock(clock: Clock): string {
  return `${MONTH_NAMES[clock.month]} ${clock.year}`;
}

export function formatAge(months: number): string {
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

/** Inches as feet-and-inches, e.g. 68.5 -> `5'8.5"`. */
export function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches - feet * 12;
  const shown = Math.round(rem * 10) / 10;
  // Rounding 11.97 up to 12.0 would render 5'12"; carry into the feet instead.
  if (shown >= 12) return `${feet + 1}'0"`;
  return `${feet}'${shown}"`;
}
