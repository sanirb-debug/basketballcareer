import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { autoTickMonths } from './harness';
import { phaseFor } from '../engine/calendar';
import { overallFor } from '../engine/attributes';
import { endingScore } from '../engine/endings';
import {
  DecisionError,
  canChangePosition,
  canReclassify,
  canTransferSchool,
  changePosition,
  positionFit,
  reclassify,
  suggestedPosition,
  transferSchool,
} from '../engine/decisions';
import { projectDraftStock } from '../engine/draft';
import { ROSTER_BAR, shouldRetire } from '../engine/proLeague';
import { createRng, seedToState } from '../engine/rng';
import type { GameState, MonthAction, SchoolTier } from '../engine/types';

/**
 * PHASE 10 VERIFICATION — balance and logistics.
 *
 * The phase scripts before this one check that systems *work*. This one checks
 * that the numbers they produce make sense as basketball, and that playing
 * well is meaningfully better than playing badly.
 *
 * These are regression bounds, deliberately wide. They exist to catch a
 * change that silently makes 90% of players NBA lottery picks, not to pin the
 * balance to one exact set of values.
 */

const SCHOOLS: SchoolTier[] = ['powerhouse', 'public', 'prep'];

function input(seed: number): CreationInput {
  return {
    name: `P${seed}`,
    position: (['PG', 'SG', 'SF', 'PF', 'C'] as const)[seed % 5]!,
    jerseyNumber: (seed % 99) + 1,
    handedness: seed % 7 === 0 ? 'left' : 'right',
    homeCity: 'Town',
    homeState: ['California', 'Indiana', 'Montana', 'Texas', 'Vermont'][seed % 5]!,
    schoolTier: SCHOOLS[seed % 3]!,
  };
}

/** Trains, studies, rests, chases a bit of exposure. */
function engaged(s: GameState): MonthAction[] {
  const budget = phaseFor(s.clock, s.stage).actionPoints;
  const picks: MonthAction[] = [];
  if (s.condition.energy < 50) picks.push('rest');
  if (s.stage === 'highschool' && s.academics.gpa < 2.9) picks.push('study');
  if (s.stage === 'highschool' && s.academics.testScore === 0 && s.monthsElapsed > 30) {
    picks.push('testPrep');
  }
  const rot: MonthAction[] = [
    'shooting', 'defense', 'lift', 'playmaking', 'handles', 'finishing', 'film',
  ];
  let i = s.monthsElapsed;
  while (picks.length < budget) picks.push(rot[i++ % rot.length] as MonthAction);
  return picks.slice(0, budget);
}

/** Never rests, never studies, grinds one skill forever. */
function negligent(s: GameState): MonthAction[] {
  const budget = phaseFor(s.clock, s.stage).actionPoints;
  return Array.from({ length: budget }, () => 'shooting' as MonthAction);
}

const CAREER_MONTHS = 360;
const SAMPLE = 90;

interface Cohort {
  runs: GameState[];
  reachedPro: number;
  drafted: number;
  avgOverall: number;
  avgScore: number;
  proSeasons: number[];
}

function play(policy: (s: GameState) => MonthAction[]): Cohort {
  const runs: GameState[] = [];
  for (let seed = 1; seed <= SAMPLE; seed++) {
    runs.push(autoTickMonths(createGame(seed, input(seed)), CAREER_MONTHS, policy));
  }

  const pro = runs.filter((r) => r.pro !== null);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  return {
    runs,
    reachedPro: pro.length / runs.length,
    drafted: runs.filter((r) => (r.draft?.pick ?? 0) > 0).length / runs.length,
    avgOverall: avg(runs.map((r) => overallFor(r.player.attributes, r.player.position))),
    avgScore: avg(
      runs.map((r) => (r.careerEnd ? endingScore(r.careerEnd.endingId) : 0)),
    ),
    proSeasons: pro.map((r) => r.pro!.seasons),
  };
}

// Both cohorts are expensive; compute once and share across assertions.
const engagedCohort = play(engaged);
const negligentCohort = play(negligent);

describe('playing well is meaningfully better than playing badly', () => {
  test('every career finishes with a named ending', () => {
    for (const cohort of [engagedCohort, negligentCohort]) {
      for (const run of cohort.runs) {
        expect(run.careerEnd, `seed run`).not.toBeNull();
        expect(run.awaitingPath).toBe(false);
        expect(run.events.pending).toBeNull();
      }
    }
  });

  test('effort separates the outcomes by a wide margin', () => {
    // The failure this guards against is the one that actually happened:
    // a potential cap so tight that genetics decided everything and a
    // dedicated career finished two points from a lazy one.
    expect(engagedCohort.avgOverall).toBeGreaterThan(
      negligentCohort.avgOverall + 10,
    );
    expect(engagedCohort.avgScore).toBeGreaterThan(negligentCohort.avgScore + 10);
    expect(engagedCohort.reachedPro).toBeGreaterThan(
      negligentCohort.reachedPro + 0.25,
    );
  });

  test('neglecting school and rest closes the professional door', () => {
    expect(negligentCohort.reachedPro).toBeLessThan(0.15);
  });
});

describe('the professional pyramid is a pyramid (SPEC §14)', () => {
  test('reaching the league is an achievement, not a formality', () => {
    // Sixty players are drafted worldwide a year. This is a protagonist sim,
    // so it is generous — but it cannot be a rubber stamp.
    expect(engagedCohort.reachedPro).toBeGreaterThan(0.2);
    expect(engagedCohort.reachedPro).toBeLessThan(0.75);
    expect(engagedCohort.drafted).toBeLessThan(engagedCohort.reachedPro + 0.05);
  });

  test('the ending distribution is spread, not a funnel', () => {
    const counts = new Map<string, number>();
    for (const run of engagedCohort.runs) {
      const id = run.careerEnd!.endingId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // At least four distinct outcomes, and none of them swallowing everything.
    expect(counts.size).toBeGreaterThanOrEqual(4);
    const biggest = Math.max(...counts.values());
    expect(biggest / engagedCohort.runs.length).toBeLessThan(0.65);
  });

  test('the very top is rare', () => {
    const elite = engagedCohort.runs.filter((r) =>
      ['superstar', 'hall-of-fame', 'all-star'].includes(r.careerEnd!.endingId),
    );
    expect(elite.length / engagedCohort.runs.length).toBeLessThan(0.15);
  });

  test('careers end rather than running forever', () => {
    for (const seasons of engagedCohort.proSeasons) {
      expect(seasons).toBeLessThanOrEqual(22);
    }
  });

  test('roster attrition is what ends most careers, not old age', () => {
    const rng = createRng(seedToState(5));
    let fringeOut = 0;
    let goodOut = 0;
    for (let i = 0; i < 400; i++) {
      // A 25-year-old well below the roster bar should be at real risk.
      if (shouldRetire(ROSTER_BAR - 12, 25, 3, rng)) fringeOut++;
      if (shouldRetire(ROSTER_BAR + 12, 25, 3, rng)) goodOut++;
    }
    expect(fringeOut).toBeGreaterThan(goodOut * 5);
    expect(goodOut).toBe(0);
  });
});

describe('the draft board reads like a draft board', () => {
  test('a fringe player is not a lottery pick', () => {
    const base = autoTickMonths(createGame(4, input(4)), 120, engaged);
    const flat = (value: number) => {
      const attrs = { ...base.player.attributes };
      for (const key of Object.keys(attrs)) {
        (attrs as Record<string, number>)[key] = value;
      }
      return { ...base, player: { ...base.player, attributes: attrs } };
    };

    const fringe = projectDraftStock(flat(66));
    const solid = projectDraftStock(flat(76));
    const star = projectDraftStock(flat(88));

    // Lower projection number = earlier pick.
    expect(star).toBeLessThan(solid);
    expect(solid).toBeLessThan(fringe);
    // A 66 overall is not getting drafted.
    expect(fringe).toBeGreaterThan(60);
    // An 88 overall is a high pick.
    expect(star).toBeLessThan(15);
  });
});

describe('the choices the spec promises are actually available (SPEC §4, §8)', () => {
  function summerOfSophomoreYear(): GameState {
    let state = createGame(11, input(11));
    // Play to a summer month in high school.
    for (let i = 0; i < 24; i++) state = autoTickMonths(state, 1, engaged);
    while (
      state.stage === 'highschool' &&
      !(state.clock.month >= 4 && state.clock.month <= 7)
    ) {
      state = autoTickMonths(state, 1, engaged);
    }
    return state;
  }

  test('a player who grows into a big can move positions', () => {
    // SPEC §4's whole premise: "you built a handle-and-floater game and now
    // you're a big". That only means anything if you can respond to it.
    const state = summerOfSophomoreYear();
    expect(canChangePosition(state)).toBe(true);

    const moved = changePosition(state, state.player.position === 'C' ? 'PG' : 'C');
    expect(moved.player.position).not.toBe(state.player.position);
    // Learning a new job costs standing with the staff.
    expect(moved.coachTrust).toBeLessThan(state.coachTrust);
  });

  test('position fit follows the body, and the suggestion follows fit', () => {
    const state = summerOfSophomoreYear();
    const tall = {
      ...state,
      player: { ...state.player, body: { ...state.player.body, heightInches: 84 } },
    };
    const small = {
      ...state,
      player: { ...state.player, body: { ...state.player.body, heightInches: 72 } },
    };

    expect(positionFit(tall, 'C')).toBeGreaterThan(positionFit(tall, 'PG'));
    expect(positionFit(small, 'PG')).toBeGreaterThan(positionFit(small, 'C'));
    expect(suggestedPosition(tall)).toBe('C');
    expect(suggestedPosition(small)).toBe('PG');
  });

  test('you cannot switch positions mid-season', () => {
    let state = createGame(11, input(11));
    while (phaseFor(state.clock, state.stage).phase !== 'REGULAR_SEASON') {
      state = autoTickMonths(state, 1, engaged);
    }
    expect(canChangePosition(state)).toBe(false);
    expect(() => changePosition(state, 'C')).toThrow(DecisionError);
  });

  test('transferring high schools costs reputation and standing (SPEC §8)', () => {
    const state = summerOfSophomoreYear();
    expect(canTransferSchool(state)).toBe(true);

    const target: SchoolTier =
      state.school.name.includes('Lincoln') ? 'powerhouse' : 'public';
    const moved = transferSchool(state, target);

    expect(moved.school.name).not.toBe(state.school.name);
    expect(moved.reputation.offCourt).toBeLessThan(state.reputation.offCourt);
    expect(moved.season).toBeNull();
  });

  test('reclassifying makes you older for your class, once (SPEC §8)', () => {
    const state = summerOfSophomoreYear();
    expect(canReclassify(state)).toBe(true);

    const older = reclassify(state);
    expect(older.player.birthYear).toBe(state.player.birthYear - 1);
    // It is a one-time decision.
    expect(canReclassify(older)).toBe(false);
    expect(() => reclassify(older)).toThrow(DecisionError);
  });
});
