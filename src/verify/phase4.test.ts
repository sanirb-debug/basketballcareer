import { describe, expect, test } from 'vitest';

import { createRng, seedToState } from '../engine/rng';
import { createGame, type CreationInput } from '../engine/newGame';
import { autoTickMonths } from './harness';
import {
  ACADEMICS,
  advanceAcademics,
  evaluateEligibility,
  isSchoolMonth,
  requiredTestScore,
} from '../engine/academics';
import {
  PROGRAMS,
  isDivisionOne,
  programById,
} from '../engine/colleges';
import {
  advanceRecruiting,
  initialRecruiting,
  meetsAcademicBar,
  targetInterest,
  type RecruitingInput,
} from '../engine/recruiting';
import type { Academics, EligibilityStatus } from '../engine/types';

/**
 * PHASE 4 VERIFICATION (SPEC §18)
 *
 * "Test: sub-threshold GPA blocks D1 offers."
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

/** An elite prospect — nothing but grades could possibly stop him. */
function eliteRecruit(eligibility: EligibilityStatus): RecruitingInput {
  return {
    nationalRank: 1,
    hype: 99,
    position: 'SG',
    eligibility,
    offCourt: 90,
    onCourt: 90,
    grade: 12,
    monthsElapsed: 40,
    visited: [],
    homeState: 'Indiana',
  };
}

/** Run recruiting forward long enough for interest to convert into offers. */
function recruitFor(eligibility: EligibilityStatus, months = 24) {
  const rng = createRng(seedToState(9090));
  let recruiting = initialRecruiting(rng);
  for (let i = 0; i < months; i++) {
    recruiting = advanceRecruiting(recruiting, eliteRecruit(eligibility), rng)
      .recruiting;
  }
  return recruiting;
}

describe('the spec assertion: sub-threshold GPA blocks D1 offers (SPEC §18 Phase 4)', () => {
  test('a non-qualifier gets no Division I offers, however good he is', () => {
    const recruiting = recruitFor('non-qualifier');
    const live = recruiting.offers.filter((o) => o.active);

    const d1 = live.filter((o) => {
      const program = programById(o.programId);
      return program && isDivisionOne(program.tier);
    });

    expect(d1).toHaveLength(0);
  });

  test('the same player with grades gets D1 offers everywhere', () => {
    const recruiting = recruitFor('qualifier');
    const live = recruiting.offers.filter((o) => o.active);

    const d1 = live.filter((o) => {
      const program = programById(o.programId);
      return program && isDivisionOne(program.tier);
    });

    expect(d1.length).toBeGreaterThan(3);
  });

  test('JUCO stays open — the gate forces a path, it is not a fail state', () => {
    const recruiting = recruitFor('non-qualifier');
    const juco = recruiting.offers
      .filter((o) => o.active)
      .filter((o) => programById(o.programId)?.tier === 'juco');

    expect(juco.length).toBeGreaterThan(0);
  });

  test('an academic redshirt can sign, but not with a blueblood', () => {
    const recruiting = recruitFor('academic-redshirt');
    const live = recruiting.offers.filter((o) => o.active);
    const tiers = new Set(
      live.map((o) => programById(o.programId)?.tier).filter(Boolean),
    );

    expect(tiers.has('blueblood')).toBe(false);
    expect(tiers.has('high-major')).toBe(true);
  });

  test('an offer already on the table is pulled if grades collapse', () => {
    const rng = createRng(seedToState(31));
    let recruiting = initialRecruiting(rng);

    for (let i = 0; i < 20; i++) {
      recruiting = advanceRecruiting(recruiting, eliteRecruit('qualifier'), rng)
        .recruiting;
    }
    const before = recruiting.offers.filter((o) => o.active).length;
    expect(before).toBeGreaterThan(0);

    const result = advanceRecruiting(
      recruiting,
      eliteRecruit('non-qualifier'),
      rng,
    );
    const pulled = result.recruiting.offers.filter(
      (o) => !o.active && o.pulledReason === 'academics',
    );

    expect(pulled.length).toBeGreaterThan(0);
    expect(result.notes.some((n) => n.includes('grades'))).toBe(true);
  });
});

describe('the eligibility rules (SPEC §9)', () => {
  test('every four-year program checks the academic bar; JUCO does not', () => {
    for (const program of PROGRAMS) {
      const open = meetsAcademicBar(program, 'non-qualifier');
      expect(open, program.id).toBe(!isDivisionOne(program.tier));
    }
  });

  test('a failing GPA is a non-qualifier regardless of anything else', () => {
    expect(evaluateEligibility(1.5, 16, 1600)).toBe('non-qualifier');
    expect(evaluateEligibility(1.99, 16, 1600)).toBe('non-qualifier');
  });

  test('full qualification needs GPA, credits and a test score together', () => {
    expect(evaluateEligibility(3.5, 16, 1200)).toBe('qualifier');
    // Strong grades, never sat the test.
    expect(evaluateEligibility(3.5, 16, 0)).toBe('academic-redshirt');
    // Strong grades and test, short on core credits.
    expect(evaluateEligibility(3.5, 9, 1200)).toBe('academic-redshirt');
  });

  test('the sliding scale trades GPA against test score', () => {
    const atFloor = requiredTestScore(ACADEMICS.QUALIFIER_GPA);
    const atTop = requiredTestScore(4);
    expect(atTop).toBeLessThan(atFloor);

    // A 4.0 student qualifies on a score that would fail a 2.3 student.
    expect(evaluateEligibility(4, 16, atTop)).toBe('qualifier');
    expect(evaluateEligibility(ACADEMICS.QUALIFIER_GPA, 16, atTop)).toBe(
      'academic-redshirt',
    );
  });

  test('interest is exactly zero at every program that bars you', () => {
    const rng = createRng(seedToState(5));
    const needs = initialRecruiting(rng).needs;

    for (const program of PROGRAMS.filter((p) => isDivisionOne(p.tier))) {
      expect(
        targetInterest(program, needs, eliteRecruit('non-qualifier')),
        program.id,
      ).toBe(0);
    }
  });
});

describe('GPA moves with what you actually do (SPEC §9)', () => {
  const base: Academics = {
    gpa: 2.8,
    coreCredits: 4,
    testScore: 0,
    testAttempts: 0,
    status: 'academic-redshirt',
  };

  function month(studyActions: number, overrides: Partial<Academics> = {}) {
    const rng = createRng(seedToState(77));
    return advanceAcademics(
      {
        academics: { ...base, ...overrides },
        studyActions,
        testPrepActions: 0,
        inSchoolYear: true,
        basketballIQ: 55,
        yearComplete: false,
      },
      rng,
    );
  }

  test('studying raises it and neglect decays it', () => {
    expect(month(1).academics.gpa).toBeGreaterThan(base.gpa);
    expect(month(0).academics.gpa).toBeLessThan(base.gpa);
  });

  test('a second session in the same month is worth less than the first', () => {
    const one = month(1).academics.gpa - base.gpa;
    const two = month(2).academics.gpa - base.gpa;
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(one * 2);
  });

  test('summer neither builds nor rots the average', () => {
    const rng = createRng(seedToState(4));
    const summer = advanceAcademics(
      {
        academics: base,
        studyActions: 0,
        testPrepActions: 0,
        inSchoolYear: false,
        basketballIQ: 55,
        yearComplete: false,
      },
      rng,
    );
    expect(summer.academics.gpa).toBe(base.gpa);
    expect(isSchoolMonth(6)).toBe(false); // July
    expect(isSchoolMonth(9)).toBe(true); // October
  });

  test('core credits bank at the end of a passed school year', () => {
    const rng = createRng(seedToState(8));
    const result = advanceAcademics(
      {
        academics: base,
        studyActions: 1,
        testPrepActions: 0,
        inSchoolYear: true,
        basketballIQ: 55,
        yearComplete: true,
      },
      rng,
    );
    expect(result.academics.coreCredits).toBe(
      base.coreCredits + ACADEMICS.CORE_CREDITS_PER_YEAR,
    );
  });

  test('a failing student banks fewer credits', () => {
    const rng = createRng(seedToState(8));
    const result = advanceAcademics(
      {
        academics: { ...base, gpa: 1.2 },
        studyActions: 0,
        testPrepActions: 0,
        inSchoolYear: true,
        basketballIQ: 55,
        yearComplete: true,
      },
      rng,
    );
    expect(result.academics.coreCredits).toBeLessThan(
      base.coreCredits + ACADEMICS.CORE_CREDITS_PER_YEAR,
    );
  });

  test('sitting the test records a score and keeps the best one', () => {
    const rng = createRng(seedToState(12));
    const first = advanceAcademics(
      {
        academics: base,
        studyActions: 0,
        testPrepActions: 1,
        inSchoolYear: true,
        basketballIQ: 70,
        yearComplete: false,
      },
      rng,
    );
    expect(first.academics.testScore).toBeGreaterThan(ACADEMICS.TEST_MIN);
    expect(first.academics.testAttempts).toBe(1);

    const second = advanceAcademics(
      {
        academics: first.academics,
        studyActions: 0,
        testPrepActions: 1,
        inSchoolYear: true,
        basketballIQ: 70,
        yearComplete: false,
      },
      rng,
    );
    expect(second.academics.testScore).toBeGreaterThanOrEqual(
      first.academics.testScore,
    );
  });
});

describe('academics inside a real run', () => {
  test('a player who never studies drifts toward ineligibility', () => {
    const neglected = autoTickMonths(createGame(21, INPUT), 40, () => []);
    const studious = autoTickMonths(createGame(21, INPUT), 40, (s) =>
      s.clock.month === 6 ? [] : ['study'],
    );

    expect(studious.academics.gpa).toBeGreaterThan(neglected.academics.gpa);
    expect(studious.academics.coreCredits).toBeGreaterThanOrEqual(
      neglected.academics.coreCredits,
    );
  });

  test('GPA stays inside 0.0–4.0 across a whole career', () => {
    const state = autoTickMonths(createGame(4, INPUT), 56, () => ['study']);
    expect(state.academics.gpa).toBeGreaterThanOrEqual(0);
    expect(state.academics.gpa).toBeLessThanOrEqual(4);
    expect(state.academics.coreCredits).toBeLessThanOrEqual(
      ACADEMICS.CORE_CREDITS_REQUIRED,
    );
  });
});
