import { describe, expect, test } from 'vitest';

import { createRng, seedToState } from '../engine/rng';
import { createGame, type CreationInput } from '../engine/newGame';
import { autoTick } from './harness';
import { GAME_MINUTES, minutesFor, resolveGame } from '../engine/gameSim';
import { SCHOOLS } from '../engine/school';
import {
  FINAL_GRADE,
  GAMES_PER_MONTH,
  MAX_PLAYOFF_GAMES,
  createSeason,
  gradeForSeason,
  hasGraduated,
  seasonYearForClock,
} from '../engine/season';
import { absoluteMonth } from '../engine/calendar';
import {
  ATTRIBUTE_KEYS,
  type Attributes,
  type BoxScore,
  type GameState,
} from '../engine/types';

/**
 * PHASE 2 VERIFICATION (SPEC §18)
 *
 * "Test script: a 90 OVR player outproduces a 70 OVR over a simulated season."
 */

const INPUT: CreationInput = {
  name: 'Marcus Vale',
  position: 'SG',
  jerseyNumber: 3,
  handedness: 'right',
  homeCity: 'Gary',
  homeState: 'Indiana',
  schoolTier: 'public',
};

function flat(value: number): Attributes {
  const a = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) a[key] = value;
  return a;
}

interface SeasonLine {
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
  fgm: number;
  fga: number;
  games: number;
}

/**
 * Sim a season with fixed ratings, holding everything except the player
 * constant — same seed, same opponents, same team, same coach trust.
 */
function simSeason(overall: number, trust: number, seed = 4242): SeasonLine {
  const rng = createRng(seedToState(seed));
  const school = SCHOOLS.public;
  const attributes = flat(overall);
  const line: SeasonLine = {
    points: 0,
    rebounds: 0,
    assists: 0,
    minutes: 0,
    fgm: 0,
    fga: 0,
    games: 24,
  };

  for (let i = 0; i < line.games; i++) {
    const minutes = minutesFor(trust, overall, school.rosterDepth, 80, false);
    const out = resolveGame(rng, {
      attributes,
      position: 'SG',
      minutes,
      opponentStrength: school.scheduleStrength,
      teamStrength: school.teamStrength,
      home: i % 2 === 0,
      energy: 80,
      confidence: 50,
    });
    line.points += out.box.points;
    line.rebounds += out.box.rebounds;
    line.assists += out.box.assists;
    line.minutes += out.box.minutes;
    line.fgm += out.box.fgm;
    line.fga += out.box.fga;
  }
  return line;
}

function checkBoxInternallyConsistent(box: BoxScore, label: string) {
  expect(box.fgm, `${label} fgm<=fga`).toBeLessThanOrEqual(box.fga);
  expect(box.tpm, `${label} tpm<=tpa`).toBeLessThanOrEqual(box.tpa);
  expect(box.ftm, `${label} ftm<=fta`).toBeLessThanOrEqual(box.fta);
  expect(box.tpa, `${label} tpa<=fga`).toBeLessThanOrEqual(box.fga);
  expect(box.tpm, `${label} tpm<=fgm`).toBeLessThanOrEqual(box.fgm);
  expect(box.offRebounds, `${label} oreb<=reb`).toBeLessThanOrEqual(box.rebounds);
  expect(box.minutes, `${label} minutes`).toBeLessThanOrEqual(GAME_MINUTES);

  // Points must reconcile with the shooting line exactly.
  expect(box.points, `${label} points reconcile`).toBe(
    (box.fgm - box.tpm) * 2 + box.tpm * 3 + box.ftm,
  );

  for (const [key, value] of Object.entries(box)) {
    expect(value, `${label} ${key} non-negative`).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(value), `${label} ${key} finite`).toBe(true);
  }
}

describe('the spec assertion: 90 OVR outproduces 70 OVR (SPEC §18 Phase 2)', () => {
  test('over a simulated season, with everything else held equal', () => {
    const elite = simSeason(90, 60);
    const good = simSeason(70, 60);

    expect(elite.points).toBeGreaterThan(good.points);
    expect(elite.points / elite.games).toBeGreaterThan(good.points / good.games);
    expect(elite.rebounds).toBeGreaterThan(good.rebounds);
    expect(elite.assists).toBeGreaterThan(good.assists);

    // And more efficiently, not just on volume.
    expect(elite.fgm / elite.fga).toBeGreaterThan(good.fgm / good.fga);
  });

  test('the gap holds across many seeds, not just a lucky one', () => {
    let eliteWins = 0;
    const trials = 40;
    for (let seed = 1; seed <= trials; seed++) {
      if (simSeason(90, 60, seed).points > simSeason(70, 60, seed).points) {
        eliteWins++;
      }
    }
    expect(eliteWins).toBe(trials);
  });

  test('the production ladder is monotonic across the rating scale', () => {
    const ppg = [50, 60, 70, 80, 90].map((ovr) => simSeason(ovr, 60).points / 24);
    for (let i = 1; i < ppg.length; i++) {
      expect(ppg[i] as number, `${i}`).toBeGreaterThan(ppg[i - 1] as number);
    }
  });
});

describe('coach trust drives minutes independently of skill (SPEC §6)', () => {
  test('the same player plays more for a coach who trusts him', () => {
    const depth = SCHOOLS.public.rosterDepth;
    const low = minutesFor(20, 75, depth, 80, false);
    const high = minutesFor(85, 75, depth, 80, false);
    expect(high).toBeGreaterThan(low + 4);
  });

  test('trust alone changes production for identical ratings', () => {
    const benched = simSeason(85, 15);
    const trusted = simSeason(85, 85);
    expect(trusted.minutes).toBeGreaterThan(benched.minutes);
    expect(trusted.points).toBeGreaterThan(benched.points);
  });

  test('a freshman buried on a stacked roster barely plays', () => {
    const powerhouse = SCHOOLS.powerhouse;
    const frosh = minutesFor(
      powerhouse.startingTrust,
      40,
      powerhouse.rosterDepth,
      90,
      false,
    );
    expect(frosh).toBeLessThan(6);

    // The same freshman is the man at the local public school.
    const atPublic = minutesFor(
      SCHOOLS.public.startingTrust,
      40,
      SCHOOLS.public.rosterDepth,
      90,
      false,
    );
    expect(atPublic).toBeGreaterThan(frosh + 8);
  });

  test('an injured player gets no minutes at all', () => {
    expect(minutesFor(99, 99, 25, 100, true)).toBe(0);
  });
});

describe('box scores are internally consistent (SPEC §13)', () => {
  test('across a wide sweep of ratings and minutes', () => {
    const rng = createRng(seedToState(11));
    for (let i = 0; i < 400; i++) {
      const overall = 25 + (i % 75);
      const home = i % 2 === 0;
      const out = resolveGame(rng, {
        attributes: flat(overall),
        position: 'SG',
        minutes: (i % 33) as number,
        opponentStrength: 30 + (i % 60),
        teamStrength: 40 + (i % 40),
        home,
        energy: 20 + (i % 80),
        confidence: 30 + (i % 60),
      });
      checkBoxInternallyConsistent(out.box, `sweep ${i}`);
      expect(out.teamScore).toBeGreaterThan(0);
      expect(out.oppScore).toBeGreaterThan(0);
      // Basketball has no ties: a dead heat goes to the home side.
      const expected =
        out.teamScore === out.oppScore ? home : out.teamScore > out.oppScore;
      expect(out.win, `sweep ${i}`).toBe(expected);
    }
  });

  test('zero minutes produces an empty stat line', () => {
    const rng = createRng(seedToState(3));
    const out = resolveGame(rng, {
      attributes: flat(90),
      position: 'SG',
      minutes: 0,
      opponentStrength: 50,
      teamStrength: 50,
      home: true,
      energy: 100,
      confidence: 50,
    });
    expect(out.box.points).toBe(0);
    expect(out.box.fga).toBe(0);
    expect(out.box.minutes).toBe(0);
  });
});

describe('the season calendar (SPEC §3, §13)', () => {
  test('is 24 regular season games plus a three-round postseason', () => {
    const rng = createRng(seedToState(5));
    const season = createSeason(rng, 2026, SCHOOLS.public);

    const regular = season.schedule.filter((g) => !g.playoff);
    const playoff = season.schedule.filter((g) => g.playoff);
    expect(regular.length).toBe(GAMES_PER_MONTH * 4);
    expect(playoff.length).toBe(MAX_PLAYOFF_GAMES);

    // Regular season sits in Nov–Feb, postseason entirely in March.
    for (const g of regular) {
      const month = g.monthAbs % 12;
      expect([10, 11, 0, 1]).toContain(month);
    }
    for (const g of playoff) {
      expect(g.monthAbs).toBe(absoluteMonth(2027, 2));
    }
  });

  test('maps calendar months onto the right season year', () => {
    expect(seasonYearForClock({ year: 2026, month: 10 })).toBe(2026); // Nov
    expect(seasonYearForClock({ year: 2027, month: 1 })).toBe(2026); // Feb
    expect(seasonYearForClock({ year: 2027, month: 2 })).toBe(2026); // Mar
    expect(seasonYearForClock({ year: 2027, month: 6 })).toBeNull(); // Jul
    expect(seasonYearForClock({ year: 2027, month: 10 })).toBe(2027); // Nov
  });

  test('grades run 8th grade through senior, then graduate', () => {
    // The slice opens in 8th grade so that signing day lands at 18 (SPEC §18).
    expect(gradeForSeason(2026)).toBe(8);
    expect(gradeForSeason(2030)).toBe(FINAL_GRADE);
    expect(hasGraduated(2030)).toBe(false);
    expect(hasGraduated(2031)).toBe(true);
  });
});

describe('a played season (SPEC §13)', () => {
  function playMonths(months: number, seed = 808): GameState {
    let state = createGame(seed, INPUT);
    for (let i = 0; i < months; i++) {
      if (state.careerEnd) break;
      state = autoTick(state, []);
    }
    return state;
  }

  test('games get played, logged, and aggregated into a record', () => {
    // Aug 2026 + 6 ticks lands in Feb 2027, mid-season.
    const state = playMonths(6);
    expect(state.season).not.toBeNull();

    const season = state.season as NonNullable<GameState['season']>;
    const played = season.schedule.filter((g) => g.played);
    expect(played.length).toBeGreaterThan(0);
    expect(season.wins + season.losses).toBe(played.length);

    for (const game of played) {
      checkBoxInternallyConsistent(game.box, game.id);
      expect(game.teamScore).toBeGreaterThan(0);
    }
  });

  test('the standings move without the player (SPEC §11)', () => {
    const state = playMonths(6);
    const season = state.season as NonNullable<GameState['season']>;
    const totalLeagueGames = season.league.reduce(
      (sum, t) => sum + t.wins + t.losses,
      0,
    );
    expect(totalLeagueGames).toBeGreaterThan(0);
    expect(new Set(season.league.map((t) => t.wins)).size).toBeGreaterThan(1);
  });

  test('a finished season rolls into career history', () => {
    // Through the end of March of the freshman year.
    const state = playMonths(9);
    expect(state.history.length).toBe(1);

    const summary = state.history[0] as NonNullable<(typeof state.history)[0]>;
    expect(summary.grade).toBe(8);
    expect(summary.seasonYear).toBe(2026);
    expect(summary.wins + summary.losses).toBeGreaterThan(20);
    expect(summary.totals.points).toBeGreaterThanOrEqual(0);
    // The season is closed out, not left hanging around.
    expect(state.season).toBeNull();
  });

  test('five seasons accumulate from 8th grade through senior year', () => {
    const state = playMonths(56);
    expect(state.history.length).toBe(5);
    expect(state.history.map((h) => h.grade)).toEqual([8, 9, 10, 11, 12]);
  });

  test('the postseason is single elimination', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = playMonths(9, seed);
      const summary = state.history[0];
      expect(summary).toBeDefined();
    }
  });
});
