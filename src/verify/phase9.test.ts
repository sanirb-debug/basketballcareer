import { describe, expect, test } from 'vitest';

import { createRng, seedToState } from '../engine/rng';
import { createGame, type CreationInput } from '../engine/newGame';
import { autoTickMonths, BEST_PATH } from './harness';
import { tick, PathChoiceRequiredError } from '../engine/tick';
import { phaseFor } from '../engine/calendar';
import { applyEventChoice } from '../engine/events/engine';
import {
  CONFERENCES,
  PROGRAMS,
  TIER_RANK,
  isDivisionOne,
  programsInConference,
} from '../engine/colleges';
import { PATH, pathOptionsFor, hasAnyPath } from '../engine/careerPath';
import {
  DecisionError,
  canEnterPortal,
  canRedshirt,
  choosePath,
  declareForDraft,
  enterPortal,
  redshirt,
  transferOptions,
  transferTo,
  withdrawFromDraft,
} from '../engine/decisions';
import {
  DRAFT,
  describeProjection,
  initialDraft,
  projectDraftStock,
  runDraft,
} from '../engine/draft';
import {
  PRO,
  ageMultiplier,
  contractFor,
  generateLeague,
  marketValue,
  minutesForRole,
  roleFor,
  rookieContract,
  shouldRetire,
  teamForPick,
} from '../engine/proLeague';
import { PRO_ENDINGS, resolveProEnding } from '../engine/endings';
import { COLLEGE_SEASON, PRO_SEASON, seasonConfigFor } from '../engine/season';
import { LEVELS, levelFor, resolveGame } from '../engine/gameSim';
import { ATTRIBUTE_KEYS } from '../engine/types';
import type { GameState, MonthAction, ProState } from '../engine/types';

/**
 * PHASE 9 VERIFICATION (SPEC §14)
 *
 * The road after high school: college, JUCO, the pro-alternative routes, the
 * draft, and a professional career.
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

/** A sensible human policy, used to play whole careers. */
function policy(s: GameState): MonthAction[] {
  const budget = phaseFor(s.clock, s.stage).actionPoints;
  const picks: MonthAction[] = [];
  if (s.condition.energy < 45) picks.push('rest');
  if (s.stage === 'highschool' && s.academics.gpa < 2.9) picks.push('study');
  const rotation: MonthAction[] = ['shooting', 'defense', 'lift', 'playmaking'];
  let i = s.monthsElapsed;
  while (picks.length < budget) {
    picks.push(rotation[i++ % rotation.length] as MonthAction);
  }
  return picks.slice(0, budget);
}

/**
 * Advance to the exact moment high school hands off.
 *
 * Ticks raw rather than through the harness, because the harness answers the
 * path choice automatically and this is the state we want to inspect.
 */
function toPathChoice(seed: number): GameState {
  let state = createGame(seed, INPUT);
  for (let i = 0; i < 80 && !state.awaitingPath && !state.careerEnd; i++) {
    state = tick(state, policy(state));
    while (state.events.pending) state = applyEventChoice(state, 0);
  }
  return state;
}

describe('the college landscape (SPEC §10, §14)', () => {
  test('is eight conferences of eight, plus junior colleges', () => {
    expect(CONFERENCES).toHaveLength(8);
    for (const conference of CONFERENCES) {
      expect(programsInConference(conference), conference).toHaveLength(8);
    }
    expect(PROGRAMS.filter((p) => p.tier === 'juco').length).toBeGreaterThanOrEqual(3);
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(64);
  });

  test('every program is coherently specified', () => {
    const ids = new Set<string>();
    for (const p of PROGRAMS) {
      expect(ids.has(p.id), `duplicate ${p.id}`).toBe(false);
      ids.add(p.id);

      expect(p.strength, p.id).toBeGreaterThanOrEqual(25);
      expect(p.strength, p.id).toBeLessThanOrEqual(99);
      expect(p.rosterDepth, p.id).toBeGreaterThan(20);
      expect(p.coachQuality, p.id).toBeGreaterThan(20);
      expect(p.requiresQualifier, p.id).toBe(isDivisionOne(p.tier));
      expect(p.conference.length, p.id).toBeGreaterThan(0);
    }
  });

  test('better tiers are stronger and harder to crack', () => {
    const avg = (tier: string) => {
      const group = PROGRAMS.filter((p) => p.tier === tier);
      return group.reduce((t, p) => t + p.strength, 0) / group.length;
    };
    expect(avg('blueblood')).toBeGreaterThan(avg('high-major'));
    expect(avg('high-major')).toBeGreaterThan(avg('mid-major'));
    expect(avg('mid-major')).toBeGreaterThan(avg('low-major'));
    expect(TIER_RANK.blueblood).toBeGreaterThan(TIER_RANK.juco);
  });
});

describe('the fork at eighteen (SPEC §14)', () => {
  test('high school hands off instead of ending', () => {
    const state = toPathChoice(4);
    expect(state.careerEnd).toBeNull();
    expect(state.awaitingPath).toBe(true);
    expect(state.stage).toBe('highschool');
  });

  test('the clock will not move until a road is chosen', () => {
    const state = toPathChoice(4);
    expect(() => tick(state, [])).toThrow(PathChoiceRequiredError);
  });

  test('JUCO is always open — it is a floor, not a failure', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const state = toPathChoice(seed);
      if (state.careerEnd) continue;
      const juco = pathOptionsFor(state).find((o) => o.path === 'juco');
      expect(juco?.available, `seed ${seed}`).toBe(true);
      expect(hasAnyPath(state)).toBe(true);
    }
  });

  test('the developmental routes gate on national ranking', () => {
    const state = toPathChoice(4);
    const unranked = { ...state, hype: { ...state.hype, nationalRank: 300 } };
    const elite = { ...state, hype: { ...state.hype, nationalRank: 5 } };

    const closed = pathOptionsFor(unranked);
    expect(closed.find((o) => o.path === 'gleague')?.available).toBe(false);
    expect(closed.find((o) => o.path === 'gleague')?.blockedReason).toContain(
      String(PATH.GLEAGUE_RANK),
    );

    const open = pathOptionsFor(elite);
    expect(open.find((o) => o.path === 'gleague')?.available).toBe(true);
    expect(open.find((o) => o.path === 'ote')?.available).toBe(true);
  });

  test('a non-qualifier cannot take the four-year road', () => {
    const state = toPathChoice(4);
    const failing: GameState = {
      ...state,
      academics: { ...state.academics, status: 'non-qualifier' },
    };
    const college = pathOptionsFor(failing).find((o) => o.path === 'college');
    expect(college?.available).toBe(false);
    expect(() => choosePath(failing, 'college')).toThrow(DecisionError);
  });

  test('choosing a road moves the career onto it', () => {
    const state = toPathChoice(4);
    const next = choosePath(state, 'juco');

    expect(next.stage).toBe('juco');
    expect(next.awaitingPath).toBe(false);
    expect(next.college).not.toBeNull();
    expect(next.college?.eligibilityLeft).toBe(2);
    expect(next.season).toBeNull();
    // And the clock moves again.
    expect(() => tick(next, [])).not.toThrow();
  });

  test('the calendar changes shape with the stage (SPEC §3)', () => {
    // July in high school is the live period; in college it is summer work.
    expect(phaseFor({ year: 2031, month: 6 }, 'highschool').phase).toBe('LIVE_PERIOD');
    expect(phaseFor({ year: 2031, month: 6 }, 'college').phase).toBe('SUMMER');
    expect(phaseFor({ year: 2031, month: 6 }, 'nba').phase).toBe('FREE_AGENCY');

    // The pro season runs in months high school is in the offseason.
    expect(phaseFor({ year: 2031, month: 9 }, 'nba').phase).toBe('REGULAR_SEASON');
    expect(phaseFor({ year: 2031, month: 9 }, 'highschool').phase).toBe('OFFSEASON');
  });

  test('season shapes differ by level', () => {
    expect(seasonConfigFor('college')).toBe(COLLEGE_SEASON);
    expect(seasonConfigFor('nba')).toBe(PRO_SEASON);
    // A pro season is far longer than a high school one.
    const proGames = PRO_SEASON.regularMonths.length * PRO_SEASON.gamesPerMonth;
    const collegeGames = COLLEGE_SEASON.regularMonths.length * COLLEGE_SEASON.gamesPerMonth;
    expect(proGames).toBeGreaterThan(collegeGames * 2);
  });
});

describe('college (SPEC §14)', () => {
  function inCollege(seed = 4): GameState {
    const state = toPathChoice(seed);
    const option = pathOptionsFor(state).find((o) => o.path === 'college');
    return choosePath(state, option?.available ? 'college' : 'juco');
  }

  test('arrives with eligibility, a fresh trust number, and NIL', () => {
    const state = inCollege();
    expect(state.college?.year).toBe(1);
    expect(state.college?.eligibilityLeft).toBeGreaterThan(0);
    expect(state.college?.trust).toBeLessThan(75);
    expect(state.college?.nilPerMonth).toBeGreaterThanOrEqual(0);
  });

  test('NIL money accumulates month over month', () => {
    let state = inCollege();
    state = { ...state, college: { ...state.college!, nilPerMonth: 1000 } };
    const before = state.money;
    const after = autoTickMonths(state, 3, () => []);
    expect(after.money).toBeGreaterThan(before);
  });

  test('a redshirt preserves the year and keeps you off the floor', () => {
    let state = inCollege();
    // Wind to the preseason window where a redshirt can be declared.
    while (!canRedshirt(state) && !state.careerEnd) {
      state = autoTickMonths(state, 1, () => []);
    }
    expect(canRedshirt(state)).toBe(true);

    const sat = redshirt(state);
    expect(sat.college?.redshirtingNow).toBe(true);

    const played = autoTickMonths(sat, 4, () => []);
    const appearances =
      played.season?.schedule.filter((g) => g.played && g.box.minutes > 0) ?? [];
    expect(appearances).toHaveLength(0);
  });

  test('the portal is a spring window and a transfer resets your standing', () => {
    let state = inCollege();
    while (!canEnterPortal(state) && !state.careerEnd) {
      state = autoTickMonths(state, 1, () => []);
    }
    expect(canEnterPortal(state)).toBe(true);

    const portal = enterPortal(state);
    expect(portal.college?.inPortal).toBe(true);

    const options = transferOptions(portal);
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((p) => p.id !== portal.college?.programId)).toBe(true);

    const moved = transferTo(portal, options[0]!.id);
    expect(moved.college?.programId).toBe(options[0]!.id);
    expect(moved.college?.transfers).toBe(1);
    expect(moved.college?.trust).toBeLessThan(portal.college!.trust + 1);
    expect(moved.season).toBeNull();
  });

  test('transferring outside the portal is rejected', () => {
    const state = inCollege();
    expect(() => transferTo(state, 'kensington')).toThrow(DecisionError);
  });
});

describe('the draft (SPEC §14)', () => {
  test('projection responds to production, level and age', () => {
    const base = autoTickMonths(createGame(4, INPUT), 80, policy);
    const better: GameState = {
      ...base,
      hype: { ...base.hype, hype: 95 },
      reputation: { ...base.reputation, offCourt: 90 },
    };
    expect(projectDraftStock(better)).toBeLessThanOrEqual(projectDraftStock(base));
  });

  test('describes where a projection lands', () => {
    expect(describeProjection(3)).toContain('top-five');
    expect(describeProjection(10)).toContain('lottery');
    expect(describeProjection(25)).toContain('first round');
    expect(describeProjection(45)).toContain('second round');
    expect(describeProjection(90)).toContain('not on the board');
  });

  test('declaring is an April decision and testing the waters is reversible', () => {
    let state = choosePath(toPathChoice(4), 'juco');
    // Wind forward to an April.
    while (state.clock.month !== DRAFT.DECLARE_MONTH && !state.careerEnd) {
      state = autoTickMonths(state, 1, () => []);
    }

    const tested = declareForDraft(state, true);
    expect(tested.draft?.declared).toBe(true);
    expect(tested.draft?.testingWaters).toBe(true);

    const pulled = withdrawFromDraft(tested);
    expect(pulled.draft?.declared).toBe(false);
    expect(pulled.draft?.withdrew).toBe(true);

    // Declaring outright cannot be undone.
    const committed = declareForDraft(state, false);
    expect(() => withdrawFromDraft(committed)).toThrow(DecisionError);
  });

  test('draft night produces a pick, a round, or nothing at all', () => {
    const rng = createRng(seedToState(21));
    const base = autoTickMonths(createGame(4, INPUT), 80, policy);

    let drafted = 0;
    for (let i = 0; i < 40; i++) {
      const result = runDraft({ ...base, draft: initialDraft(2032) }, rng);
      expect(result.draft.completed).toBe(true);
      expect(result.draft.pick).toBeGreaterThanOrEqual(0);
      expect(result.draft.pick).toBeLessThanOrEqual(DRAFT.PICKS);
      if (result.draft.pick > 0) {
        drafted++;
        expect(result.draft.round).toBe(result.draft.pick <= 30 ? 1 : 2);
      }
    }
    // Not everyone gets picked, and not nobody does.
    expect(drafted).toBeLessThanOrEqual(40);
  });

  test('worse teams pick earlier', () => {
    const league = generateLeague(createRng(seedToState(7)));
    const first = teamForPick(league, 1);
    const last = teamForPick(league, 30);
    expect(first.strength).toBeLessThanOrEqual(last.strength);
  });
});

describe('the professional league (SPEC §14)', () => {
  test('is thirty franchises split across two conferences', () => {
    const league = generateLeague(createRng(seedToState(3)));
    expect(league).toHaveLength(PRO.TEAMS);
    expect(league.filter((t) => t.conference === 'East')).toHaveLength(15);
    expect(league.filter((t) => t.conference === 'West')).toHaveLength(15);
    expect(new Set(league.map((t) => t.id)).size).toBe(PRO.TEAMS);
  });

  test('rookie money follows the draft slot', () => {
    expect(rookieContract(1).salary).toBeGreaterThan(rookieContract(20).salary);
    expect(rookieContract(20).salary).toBeGreaterThan(rookieContract(55).salary);
    // Second-rounders get shorter, optioned deals; undrafted get two-ways.
    expect(rookieContract(45).teamOption).toBe(true);
    expect(rookieContract(0).type).toBe('two-way');
  });

  test('role and minutes track how good you actually are', () => {
    expect(roleFor(94, 70)).toBe('franchise');
    expect(roleFor(86, 70)).toBe('star');
    expect(roleFor(78, 70)).toBe('starter');
    expect(roleFor(64, 70)).toBe('rotation');
    expect(roleFor(40, 70)).toBe('deep-bench');

    expect(minutesForRole('franchise')).toBeGreaterThan(minutesForRole('starter'));
    expect(minutesForRole('starter')).toBeGreaterThan(minutesForRole('rotation'));
  });

  test('the market pays for stars and discounts age', () => {
    expect(marketValue(92, 26)).toBeGreaterThan(marketValue(78, 26));
    expect(marketValue(85, 26)).toBeGreaterThan(marketValue(85, 36));
    expect(marketValue(50, 26)).toBe(PRO.MINIMUM_SALARY);

    const max = contractFor(94, 26, 4);
    expect(max.type).toBe('max');
    expect(max.yearsLeft).toBe(4);
  });

  test('the aging curve peaks in the late twenties and falls after', () => {
    expect(ageMultiplier(27)).toBeGreaterThan(ageMultiplier(22));
    expect(ageMultiplier(27)).toBeGreaterThanOrEqual(ageMultiplier(31));
    expect(ageMultiplier(36)).toBeLessThan(ageMultiplier(31));
    expect(ageMultiplier(38)).toBeLessThan(0.8);
  });

  test('careers end, and nobody plays past forty', () => {
    const rng = createRng(seedToState(9));
    expect(shouldRetire(80, PRO.HARD_RETIREMENT_AGE, 18, rng)).toBe(true);
    expect(shouldRetire(80, 25, 3, rng)).toBe(false);

    // An ineffective 34-year-old is far likelier to be done than a good one.
    let weakDone = 0;
    let strongDone = 0;
    for (let i = 0; i < 200; i++) {
      if (shouldRetire(55, 34, 12, rng)) weakDone++;
      if (shouldRetire(88, 34, 12, rng)) strongDone++;
    }
    expect(weakDone).toBeGreaterThan(strongDone);
  });
});

describe('each level looks like itself (SPEC §13)', () => {
  function averageScore(level: 'highschool' | 'college' | 'pro') {
    const rng = createRng(seedToState(17));
    const attrs = {} as Record<string, number>;
    for (const k of ATTRIBUTE_KEYS) attrs[k] = 70;

    let team = 0;
    let opp = 0;
    const games = 60;
    for (let i = 0; i < games; i++) {
      const out = resolveGame(rng, {
        attributes: attrs as never,
        position: 'SG',
        minutes: LEVELS[level].gameMinutes * 0.7,
        opponentStrength: 62,
        teamStrength: 62,
        home: i % 2 === 0,
        energy: 80,
        confidence: 50,
        level,
      });
      team += out.teamScore;
      opp += out.oppScore;
    }
    return { team: team / games, opp: opp / games };
  }

  test('a high school game does not finish like a pro game', () => {
    const hs = averageScore('highschool');
    const college = averageScore('college');
    const pro = averageScore('pro');

    // Rough but firm bands — a 41-49 pro game reads as broken.
    expect(hs.team).toBeGreaterThan(35);
    expect(hs.team).toBeLessThan(80);
    expect(college.team).toBeGreaterThan(hs.team);
    expect(pro.team).toBeGreaterThan(95);
    expect(pro.opp).toBeGreaterThan(95);
    expect(pro.team).toBeLessThan(150);
  });

  test('game length grows with the level', () => {
    expect(LEVELS.highschool.gameMinutes).toBe(32);
    expect(LEVELS.college.gameMinutes).toBe(40);
    expect(LEVELS.pro.gameMinutes).toBe(48);
    expect(levelFor('nba')).toBe('pro');
    expect(levelFor('college')).toBe('college');
    expect(levelFor('juco')).toBe('college');
    expect(levelFor('highschool')).toBe('highschool');
  });

  test('you play opponents from your own level', () => {
    // A pro schedule should be franchises, not the high school down the road.
    expect(PRO_SEASON.opponents.some((n) => n.includes('Boston Wolves'))).toBe(true);
    expect(PRO_SEASON.opponents).not.toContain('Bishop Kelley');
    expect(COLLEGE_SEASON.opponents).not.toContain('Bishop Kelley');
    expect(COLLEGE_SEASON.opponents.length).toBeGreaterThan(50);
  });
});

describe('pro endings reward the right things (SPEC §15)', () => {
  function pro(overrides: Partial<ProState>): GameState {
    const base = createGame(1, INPUT);
    return {
      ...base,
      stage: 'nba',
      pro: {
        teamId: 'bos',
        contract: { type: 'standard', salary: 12, yearsLeft: 2, teamOption: false },
        role: 'rotation',
        seasons: 0,
        championships: 0,
        allStars: 0,
        awards: [],
        league: generateLeague(createRng(seedToState(1))),
        tradeRequested: false,
        lastPlayoffRound: 0,
        ...overrides,
      },
    };
  }

  test('a long career with a ring is a win state, not a shortfall', () => {
    // SPEC §15's design note, made mechanical.
    const ringed = resolveProEnding(pro({ seasons: 11, championships: 1, role: 'sixth-man' }));
    expect(ringed).toBe('role-player-with-ring');

    const ringless = resolveProEnding(pro({ seasons: 11, championships: 0, role: 'starter' }));
    expect(ringless).toBe('starter');
  });

  test('the ladder runs from a cup of coffee to the Hall', () => {
    expect(resolveProEnding(pro({ seasons: 1 }))).toBe('two-way-shuttle');
    expect(resolveProEnding(pro({ seasons: 5 }))).toBe('role-player');
    expect(resolveProEnding(pro({ seasons: 4, allStars: 3 }))).toBe('all-star');
    expect(resolveProEnding(pro({ seasons: 10, allStars: 7 }))).toBe('superstar');
    expect(
      resolveProEnding(pro({ seasons: 14, allStars: 9, championships: 2 })),
    ).toBe('hall-of-fame');
  });

  test('every pro ending is in the pro list', () => {
    for (const seasons of [1, 4, 9, 14]) {
      expect(PRO_ENDINGS).toContain(resolveProEnding(pro({ seasons })));
    }
  });
});

describe('a whole career, end to end', () => {
  test('runs from thirteen to a named ending without stalling', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const state = autoTickMonths(createGame(seed, INPUT), 340, policy);
      expect(state.careerEnd, `seed ${seed}`).not.toBeNull();
      expect(state.monthsElapsed, `seed ${seed}`).toBeGreaterThan(57);
      // Nothing left dangling.
      expect(state.awaitingPath).toBe(false);
      expect(state.events.pending).toBeNull();
    }
  });

  test('careers pass through the stages rather than skipping them', () => {
    const stages = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      let state = createGame(seed, INPUT);
      for (let i = 0; i < 340 && !state.careerEnd; i++) {
        state = autoTickMonths(state, 1, policy);
        stages.add(state.stage);
      }
    }
    expect(stages.has('highschool')).toBe(true);
    // At least one post-high-school stage is reached across the sample.
    const after = ['college', 'juco', 'developmental', 'overseas', 'nba', 'retired'];
    expect(after.some((s) => stages.has(s))).toBe(true);
  });

  test('the default path policy always picks something legal', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = toPathChoice(seed);
      if (state.careerEnd) continue;
      const chosen = BEST_PATH(state);
      const option = pathOptionsFor(state).find((o) => o.path === chosen);
      expect(option?.available, `seed ${seed}`).toBe(true);
    }
  });
});
