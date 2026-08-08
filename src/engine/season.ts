import { clamp, type Rng } from './rng';
import { absoluteMonth, START_YEAR } from './calendar';
import { addBox, emptyBox } from './gameSim';
import type {
  CareerStage,
  Clock,
  GameRecord,
  LeagueTeam,
  School,
  SeasonState,
  SeasonSummary,
} from './types';

/**
 * Everything the season engine needs to know about the team a player is on,
 * whatever level that is. High schools, colleges and pro franchises all
 * flatten into this so one season engine can drive all three (SPEC §14).
 */
export interface TeamContext {
  name: string;
  teamStrength: number;
  rosterDepth: number;
  scheduleStrength: number;
  coachQuality: number;
  startingTrust: number;
}

export interface SeasonConfig {
  /** Calendar months the regular season occupies. */
  regularMonths: readonly number[];
  gamesPerMonth: number;
  postseasonMonth: number;
  /** Rounds of single-elimination postseason. */
  playoffRounds: number;
  /** Teams in the standings table alongside the player's. */
  rivals: readonly string[];
  opponents: readonly string[];
  /** How much tougher each postseason round gets. */
  playoffStep: number;
}

export function teamContextFromSchool(school: School): TeamContext {
  return {
    name: school.name,
    teamStrength: school.teamStrength,
    rosterDepth: school.rosterDepth,
    scheduleStrength: school.scheduleStrength,
    coachQuality: school.coachQuality,
    startingTrust: school.startingTrust,
  };
}

/**
 * The season calendar, schedule and standings (SPEC §13).
 *
 * A season is named for the year it starts in: 2026 covers Nov 2026 – Mar 2027.
 * Regular season games land Nov–Feb, six a month; March is single-elimination
 * postseason, which is what gives that month its own texture per SPEC §3.
 */

export const FIRST_SEASON_YEAR = START_YEAR;
/**
 * The run opens in 8th grade.
 *
 * SPEC §18 sets the slice at "ages 13 → 18, ending on signing day", which is
 * ~60 months. Starting a 13-year-old as a freshman would graduate him at 17
 * and end the slice around month 45; starting him in 8th grade puts signing
 * day in the senior year at month 51 (early period) or 56 (late), which is
 * what the spec describes. School choice at 13 also makes more sense as a
 * decision about where you are *going* than where you already are.
 */
export const FIRST_GRADE = 8;
export const FINAL_GRADE = 12;
export const GAMES_PER_MONTH = 6;
export const REGULAR_SEASON_MONTHS = [10, 11, 0, 1] as const; // Nov, Dec, Jan, Feb
export const POSTSEASON_MONTH = 2; // March
export const MAX_PLAYOFF_GAMES = 3;

const OPPONENT_NAMES = [
  'Eastview',
  'Northgate',
  'Saint Bridget',
  'Cardinal Ritter',
  'Marshall Central',
  'Oak Park',
  'Bishop Kelley',
  'Westfield',
  'Franklin Tech',
  'Hillcrest',
  'Providence Day',
  'Southshore',
  'Lakeview',
  'Aurora Christian',
  'Pike Valley',
  'Roosevelt',
  'Concord Academy',
  'Millburn',
  'Trinity Hall',
  'Garfield Heights',
];

const LEAGUE_NAMES = [
  'Eastview',
  'Northgate',
  'Saint Bridget',
  'Marshall Central',
  'Oak Park',
  'Westfield',
  'Hillcrest',
];

export function gradeForSeason(seasonYear: number): number {
  return FIRST_GRADE + (seasonYear - FIRST_SEASON_YEAR);
}

export function hasGraduated(seasonYear: number): boolean {
  return gradeForSeason(seasonYear) > FINAL_GRADE;
}

/**
 * Which season a calendar month belongs to, or null in the offseason.
 * Nov–Dec belong to the season starting that year; Jan–Mar to the previous.
 */
export function seasonYearForClock(clock: Clock): number | null {
  if (clock.month >= 10) return clock.year;
  if (clock.month <= POSTSEASON_MONTH) return clock.year - 1;
  return null;
}

export function isSeasonOpener(clock: Clock): boolean {
  return clock.month === 10;
}

/**
 * The academic year a month belongs to, running Aug–Jul so that a grade
 * spans the whole basketball calendar rather than splitting at New Year.
 */
export function academicYearFor(clock: Clock): number {
  return clock.month >= 7 ? clock.year : clock.year - 1;
}

/** Grade the player is in during a given month, 9 through 12 (then beyond). */
export function gradeForClock(clock: Clock): number {
  return gradeForSeason(academicYearFor(clock));
}

/** True on the month a school year completes, when core credits are awarded. */
export function isSchoolYearEnd(clock: Clock): boolean {
  return clock.month === 4; // May
}

export function gradeLabel(grade: number): string {
  switch (grade) {
    case 8:
      return '8th grade';
    case 9:
      return 'Freshman';
    case 10:
      return 'Sophomore';
    case 11:
      return 'Junior';
    case 12:
      return 'Senior';
    default:
      return `Grade ${grade}`;
  }
}

function makeGame(
  rng: Rng,
  id: string,
  monthAbs: number,
  baseStrength: number,
  spread: number,
  playoff: boolean,
  pool: readonly string[] = OPPONENT_NAMES,
): GameRecord {
  return {
    id,
    monthAbs,
    opponent: rng.pick(pool),
    opponentStrength: clamp(rng.normal(baseStrength, spread), 25, 96),
    home: rng.chance(playoff ? 0.4 : 0.5),
    playoff,
    played: false,
    teamScore: 0,
    oppScore: 0,
    win: false,
    box: emptyBox(),
    note: null,
  };
}

export const HIGH_SCHOOL_SEASON: SeasonConfig = {
  regularMonths: REGULAR_SEASON_MONTHS,
  gamesPerMonth: GAMES_PER_MONTH,
  postseasonMonth: POSTSEASON_MONTH,
  playoffRounds: MAX_PLAYOFF_GAMES,
  rivals: LEAGUE_NAMES,
  opponents: OPPONENT_NAMES,
  playoffStep: 6,
};

/** Roughly a 28-game college season plus conference and national tournaments. */
export const COLLEGE_SEASON: SeasonConfig = {
  regularMonths: [10, 11, 0, 1],
  gamesPerMonth: 7,
  postseasonMonth: 2,
  playoffRounds: 5,
  rivals: LEAGUE_NAMES,
  opponents: OPPONENT_NAMES,
  playoffStep: 5,
};

/** An 84-game pro grind from October, then four playoff rounds in April. */
export const PRO_SEASON: SeasonConfig = {
  regularMonths: [9, 10, 11, 0, 1, 2],
  gamesPerMonth: 14,
  postseasonMonth: 3,
  playoffRounds: 4,
  rivals: LEAGUE_NAMES,
  opponents: OPPONENT_NAMES,
  playoffStep: 4,
};

export function seasonConfigFor(stage: CareerStage): SeasonConfig {
  switch (stage) {
    case 'nba':
      return PRO_SEASON;
    case 'college':
    case 'juco':
    case 'overseas':
    case 'developmental':
      return COLLEGE_SEASON;
    default:
      return HIGH_SCHOOL_SEASON;
  }
}

/**
 * Which season a month belongs to, given the config. The pro calendar opens
 * in October rather than November, so this cannot be hard-coded.
 */
export function seasonYearFor(clock: Clock, config: SeasonConfig): number | null {
  const opensAt = Math.min(...config.regularMonths.filter((m) => m >= 9));
  if (clock.month >= opensAt) return clock.year;
  if (clock.month <= config.postseasonMonth) return clock.year - 1;
  return null;
}

export function createSeason(
  rng: Rng,
  seasonYear: number,
  team: TeamContext,
  config: SeasonConfig = HIGH_SCHOOL_SEASON,
  grade = gradeForSeason(seasonYear),
): SeasonState {
  const schedule: GameRecord[] = [];

  config.regularMonths.forEach((month, monthIndex) => {
    // Months from September on sit in seasonYear; January onward roll over.
    const year = month >= 9 ? seasonYear : seasonYear + 1;
    const monthAbs = absoluteMonth(year, month);
    for (let g = 0; g < config.gamesPerMonth; g++) {
      schedule.push(
        makeGame(
          rng,
          `${seasonYear}-r${monthIndex}-${g}`,
          monthAbs,
          team.scheduleStrength,
          11,
          false,
          config.opponents,
        ),
      );
    }
  });

  // Postseason: one month, single elimination, each opponent tougher than the
  // last. A single loss ends it.
  const postseasonAbs = absoluteMonth(seasonYear + 1, config.postseasonMonth);
  for (let round = 0; round < config.playoffRounds; round++) {
    schedule.push(
      makeGame(
        rng,
        `${seasonYear}-p${round}`,
        postseasonAbs,
        team.scheduleStrength + config.playoffStep * (round + 1),
        7,
        true,
        config.rivals,
      ),
    );
  }

  const league: LeagueTeam[] = config.rivals.map((name) => ({
    name,
    strength: clamp(rng.normal(team.scheduleStrength, 10), 25, 96),
    wins: 0,
    losses: 0,
  }));

  return {
    seasonYear,
    grade,
    schedule,
    wins: 0,
    losses: 0,
    league,
    eliminated: false,
    playoffWins: 0,
  };
}

export function gamesScheduledFor(
  season: SeasonState,
  monthAbs: number,
): GameRecord[] {
  return season.schedule.filter((g) => g.monthAbs === monthAbs && !g.played);
}

/**
 * Advance the rest of the league so the standings move without the player
 * (SPEC §11: the board must move on its own).
 */
export function advanceLeague(
  rng: Rng,
  league: LeagueTeam[],
  games: number,
): LeagueTeam[] {
  return league.map((team) => {
    let wins = team.wins;
    let losses = team.losses;
    for (let i = 0; i < games; i++) {
      const p = clamp(0.5 + (team.strength - 55) / 120, 0.12, 0.88);
      if (rng.chance(p)) wins++;
      else losses++;
    }
    return { ...team, wins, losses };
  });
}

export function summarizeSeason(
  season: SeasonState,
  schoolName: string,
): SeasonSummary {
  const played = season.schedule.filter((g) => g.played && g.box.minutes > 0);
  const totals = played.reduce((acc, g) => addBox(acc, g.box), emptyBox());

  return {
    seasonYear: season.seasonYear,
    grade: season.grade,
    schoolName,
    games: played.length,
    wins: season.wins,
    losses: season.losses,
    totals,
  };
}

export function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}
