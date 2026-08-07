import { clamp, type Rng } from './rng';
import { absoluteMonth, START_YEAR } from './calendar';
import { addBox, emptyBox } from './gameSim';
import type {
  Clock,
  GameRecord,
  LeagueTeam,
  School,
  SeasonState,
  SeasonSummary,
} from './types';

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
): GameRecord {
  return {
    id,
    monthAbs,
    opponent: rng.pick(playoff ? LEAGUE_NAMES : OPPONENT_NAMES),
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

export function createSeason(
  rng: Rng,
  seasonYear: number,
  school: School,
): SeasonState {
  const schedule: GameRecord[] = [];

  REGULAR_SEASON_MONTHS.forEach((month, monthIndex) => {
    // Nov and Dec sit in seasonYear; Jan and Feb roll into the next year.
    const year = month >= 10 ? seasonYear : seasonYear + 1;
    const monthAbs = absoluteMonth(year, month);
    for (let g = 0; g < GAMES_PER_MONTH; g++) {
      schedule.push(
        makeGame(
          rng,
          `${seasonYear}-r${monthIndex}-${g}`,
          monthAbs,
          school.scheduleStrength,
          11,
          false,
        ),
      );
    }
  });

  // Postseason: one month, up to three games, each opponent tougher than the
  // last. A single loss ends it.
  const postseasonAbs = absoluteMonth(seasonYear + 1, POSTSEASON_MONTH);
  for (let round = 0; round < MAX_PLAYOFF_GAMES; round++) {
    schedule.push(
      makeGame(
        rng,
        `${seasonYear}-p${round}`,
        postseasonAbs,
        school.scheduleStrength + 6 + round * 6,
        7,
        true,
      ),
    );
  }

  const league: LeagueTeam[] = LEAGUE_NAMES.map((name) => ({
    name,
    strength: clamp(rng.normal(school.scheduleStrength, 10), 25, 96),
    wins: 0,
    losses: 0,
  }));

  return {
    seasonYear,
    grade: gradeForSeason(seasonYear),
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
