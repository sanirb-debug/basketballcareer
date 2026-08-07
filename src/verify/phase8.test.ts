import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { autoTickMonths } from './harness';
import { phaseFor } from '../engine/calendar';
import {
  endingCopy,
  endingScore,
  isSliceOver,
  resolveEnding,
  signedWith,
} from '../engine/endings';
import { exportCareerText } from '../engine/careerExport';
import { activeOffers, commitTo, sign } from '../engine/recruiting';
import type { EndingId, GameState, MonthAction } from '../engine/types';

/**
 * PHASE 8 VERIFICATION (SPEC §18)
 *
 * "Endings for the slice, career archive, text export." The build table calls
 * for a manual playthrough; these assertions cover the machinery so the
 * playthrough is about whether the endings land emotionally.
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

const ALL_ENDINGS: EndingId[] = [
  'career-ending-injury',
  'academic-washout',
  'no-offers',
  'juco-grinder',
  'low-major-signee',
  'mid-major-signee',
  'high-major-signee',
  'blueblood-signee',
  'off-court-flameout',
];

/** Play a full career with a decent, human-ish policy. */
function playCareer(seed: number, months = 60): GameState {
  return autoTickMonths(createGame(seed, INPUT), months, (s) => {
    const budget = phaseFor(s.clock).actionPoints;
    const picks: MonthAction[] = [];
    if (s.condition.energy < 45) picks.push('rest');
    if (s.academics.gpa < 2.8) picks.push('study');
    const rotation: MonthAction[] = ['shooting', 'defense', 'lift', 'playmaking'];
    let i = s.monthsElapsed;
    while (picks.length < budget) {
      picks.push(rotation[i++ % rotation.length] as MonthAction);
    }
    return picks.slice(0, budget);
  });
}

describe('every ending is a named terminal state (SPEC §15)', () => {
  test('all nine endings have copy and a score', () => {
    for (const id of ALL_ENDINGS) {
      const copy = endingCopy(id);
      expect(copy.reason.length, id).toBeGreaterThan(0);
      expect(copy.detail.length, id).toBeGreaterThan(40);
      expect(copy.score, id).toBeGreaterThanOrEqual(0);
      expect(copy.score, id).toBeLessThanOrEqual(100);
    }
  });

  test('a smaller outcome is written as a result, not a consolation', () => {
    // SPEC §15's design note: this sim has to make a modest career read as
    // a genuine success rather than a failure to become a superstar.
    const mid = endingCopy('mid-major-signee');
    expect(mid.detail).toMatch(/career worth having|never get/i);
    expect(mid.score).toBeGreaterThan(endingCopy('juco-grinder').score);

    // And JUCO is explicitly survivable, per SPEC §9.
    expect(endingCopy('juco-grinder').detail).toMatch(/not the end|road/i);
  });

  test('the scoring ladder is ordered sensibly', () => {
    expect(endingScore('blueblood-signee')).toBeGreaterThan(
      endingScore('high-major-signee'),
    );
    expect(endingScore('high-major-signee')).toBeGreaterThan(
      endingScore('mid-major-signee'),
    );
    expect(endingScore('mid-major-signee')).toBeGreaterThan(
      endingScore('low-major-signee'),
    );
    expect(endingScore('low-major-signee')).toBeGreaterThan(
      endingScore('juco-grinder'),
    );
    expect(endingScore('juco-grinder')).toBeGreaterThan(
      endingScore('academic-washout'),
    );
  });
});

describe('the ending names the decision that produced it (SPEC §15)', () => {
  test('an academic washout cites the actual GPA and credits', () => {
    const state = createGame(5, INPUT);
    const failing: GameState = {
      ...state,
      academics: {
        gpa: 1.42,
        coreCredits: 6,
        testScore: 0,
        testAttempts: 0,
        status: 'non-qualifier',
      },
    };

    const ending = resolveEnding(failing);
    expect(ending.endingId).toBe('academic-washout');
    expect(ending.decision).toContain('1.42');
    expect(ending.decision).toContain('6 of 16');
  });

  test('no offers cites the ranking and the school chosen at thirteen', () => {
    const state = createGame(5, INPUT);
    const ending = resolveEnding(state);
    expect(ending.endingId).toBe('no-offers');
    expect(ending.decision).toContain(`#${state.hype.nationalRank}`);
    expect(ending.decision).toContain(state.school.name);
  });

  test('every ending produces a non-empty, specific decision line', () => {
    const state = createGame(5, INPUT);
    for (const status of ['qualifier', 'non-qualifier'] as const) {
      const ending = resolveEnding({
        ...state,
        academics: { ...state.academics, status },
      });
      expect(ending.decision.length).toBeGreaterThan(30);
      expect(ending.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('the slice ends on signing day (SPEC §18)', () => {
  test('a fresh run is not over', () => {
    expect(isSliceOver(createGame(1, INPUT))).toBe(false);
  });

  test('signing ends it immediately', () => {
    const state = createGame(1, INPUT);
    const withOffer: GameState = {
      ...state,
      recruiting: {
        ...state.recruiting,
        offers: [
          {
            programId: 'crestview',
            monthOffered: 40,
            active: true,
            pulledReason: null,
          },
        ],
      },
    };

    const committed = commitTo(withOffer.recruiting, 'crestview', 45).recruiting;
    const signed = sign(committed).recruiting;
    expect(isSliceOver({ ...withOffer, recruiting: signed })).toBe(true);

    const ending = resolveEnding({ ...withOffer, recruiting: signed });
    expect(ending.endingId).toBe('low-major-signee');
    expect(signedWith({ ...withOffer, recruiting: signed })).toContain('Crestview');
  });

  test('a full career reaches an ending on its own', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = playCareer(seed);
      expect(state.careerEnd, `seed ${seed}`).not.toBeNull();
      expect(ALL_ENDINGS, `seed ${seed}`).toContain(state.careerEnd!.endingId);
      expect(state.careerEnd!.decision.length).toBeGreaterThan(20);
    }
  });

  test('ticking after the ending changes nothing', () => {
    const finished = playCareer(3);
    expect(finished.careerEnd).not.toBeNull();
    const after = autoTickMonths(finished, 6, () => []);
    expect(after).toEqual(finished);
  });

  test('how you play decides how it ends', () => {
    // Three archetypes, same engine. If they all land in the same place, the
    // choices in this game do not matter.
    const grinder = playCareer(3);

    const chaser = autoTickMonths(
      createGame(3, { ...INPUT, schoolTier: 'powerhouse', homeState: 'California' }),
      60,
      (s) => {
        const budget = phaseFor(s.clock).actionPoints;
        const picks: MonthAction[] = [];
        if (s.condition.energy < 40) picks.push('rest');
        if (s.academics.gpa < 2.6) picks.push('study');
        while (picks.length < budget) picks.push(picks.length % 2 ? 'showcase' : 'mixtape');
        return picks.slice(0, budget);
      },
    );

    const dropout = autoTickMonths(createGame(3, INPUT), 60, (s) => {
      const budget = phaseFor(s.clock).actionPoints;
      return Array.from({ length: budget }, () => 'lift' as MonthAction);
    });

    const endings = new Set([
      grinder.careerEnd!.endingId,
      chaser.careerEnd!.endingId,
      dropout.careerEnd!.endingId,
    ]);
    expect(endings.size).toBeGreaterThan(1);

    // SPEC §7: chasing exposure has to actually move the national ranking.
    expect(chaser.hype.hype).toBeGreaterThan(grinder.hype.hype);
    expect(chaser.hype.nationalRank).toBeLessThan(grinder.hype.nationalRank);

    // SPEC §9: never studying has to close doors the grinder kept open.
    expect(dropout.academics.gpa).toBeLessThan(grinder.academics.gpa);
  });
});

describe('the career archive and text export (SPEC §16.4)', () => {
  test('the log accumulates a real month-by-month history', () => {
    const state = playCareer(4);
    expect(state.log.length).toBeGreaterThan(40);

    const kinds = new Set(state.log.map((e) => e.kind));
    expect(kinds.has('game')).toBe(true);
    expect(kinds.has('growth')).toBe(true);
    expect(kinds.has('system')).toBe(true);
  });

  test('every decision the player made is recorded', () => {
    const state = playCareer(4);
    expect(state.events.decisions.length).toBeGreaterThan(3);
    for (const decision of state.events.decisions) {
      expect(decision.choice.length).toBeGreaterThan(0);
      expect(decision.eventId.length).toBeGreaterThan(0);
    }
  });

  test('the export contains every section a reader would want', () => {
    const text = exportCareerText(playCareer(4));

    for (const heading of [
      'HOOP LIFE',
      'ACADEMICS',
      'SEASON BY SEASON',
      'RECRUITING',
      'DECISIONS',
      'MONTH BY MONTH',
      'HOW IT ENDED',
    ]) {
      expect(text, heading).toContain(heading);
    }
  });

  test('the export names the player, the ending and the decision', () => {
    const state = playCareer(4);
    const text = exportCareerText(state);

    expect(text).toContain(state.player.name);
    expect(text).toContain(state.careerEnd!.reason.toUpperCase());
    expect(text).toContain('What decided it:');
    expect(text).toContain(`Career score`);
    // Reproducible: the seed is in there so a run can be replayed.
    expect(text).toContain(String(state.seed));
  });

  test('the export is plain text and wraps to a readable width', () => {
    const text = exportCareerText(playCareer(4));
    expect(text).not.toContain('<');
    expect(text).not.toContain('{');

    // Nothing absurdly long — it has to survive a paste into a chat window.
    const longest = Math.max(...text.split('\n').map((l) => l.length));
    expect(longest).toBeLessThan(120);
  });

  test('exporting works on an unfinished run too', () => {
    const midRun = autoTickMonths(createGame(6, INPUT), 20, () => []);
    const text = exportCareerText(midRun);
    expect(text).toContain('HOOP LIFE');
    expect(text).not.toContain('HOW IT ENDED');
  });

  test('a career with offers lists them', () => {
    const state = createGame(2, INPUT);
    const withOffers: GameState = {
      ...state,
      recruiting: {
        ...state.recruiting,
        offers: [
          { programId: 'kensington', monthOffered: 30, active: true, pulledReason: null },
          { programId: 'fairmount', monthOffered: 32, active: true, pulledReason: null },
        ],
      },
    };
    const text = exportCareerText(withOffers);
    expect(text).toContain('Kensington');
    expect(text).toContain('Fairmount');
    expect(activeOffers(withOffers.recruiting)).toHaveLength(2);
  });
});
