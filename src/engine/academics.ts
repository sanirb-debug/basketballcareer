import { clamp, type Rng } from './rng';
import type { Academics, EligibilityStatus } from './types';

/**
 * Grades, core courses, and the NCAA eligibility gate (SPEC §9).
 *
 * The design note in the spec is the whole point: "Studying costs the same
 * action point as training. That's the whole design." Nothing here is
 * expensive on its own — it is expensive because every hour spent on it is an
 * hour not spent in the gym.
 *
 * Failing the gate is not a fail state. It forces the JUCO path, which is
 * meant to be survivable and satisfying rather than a game over.
 */

export const ACADEMICS = {
  GPA_MIN: 0,
  GPA_MAX: 4,
  /** Where an average incoming freshman sits. */
  STARTING_GPA: 2.6,

  /** Core courses needed to qualify. */
  CORE_CREDITS_REQUIRED: 16,
  /** Credits earned per school year when passing. */
  CORE_CREDITS_PER_YEAR: 4,

  /** NCAA-style floor for full qualification. */
  QUALIFIER_GPA: 2.3,
  /** Below this you cannot even take the academic-redshirt route. */
  REDSHIRT_GPA: 2.0,

  TEST_MIN: 400,
  TEST_MAX: 1600,
  /** Test score required at exactly the minimum qualifying GPA. */
  SLIDING_SCALE_TEST_AT_MIN_GPA: 1000,
  /** Each full GPA point above the floor buys this much slack on the test. */
  SLIDING_SCALE_TEST_PER_GPA: 220,

  /** GPA lost each school month with no study at all. */
  NEGLECT_DECAY: 0.045,
  /** GPA gained by a month of studying, before modifiers. */
  STUDY_GAIN: 0.14,
} as const;

/**
 * The sliding scale: a strong GPA lowers the test score you need, and vice
 * versa. Mirrors how the real NCAA index works without reproducing the table.
 */
export function requiredTestScore(gpa: number): number {
  const above = gpa - ACADEMICS.QUALIFIER_GPA;
  return clamp(
    ACADEMICS.SLIDING_SCALE_TEST_AT_MIN_GPA -
      above * ACADEMICS.SLIDING_SCALE_TEST_PER_GPA,
    600,
    1400,
  );
}

/**
 * Evaluate eligibility. Called continuously so the player can watch their
 * standing move, and checked for real at signing.
 *
 * A player who has not sat the test yet cannot be a full qualifier — that is
 * deliberate, so "I'll take it later" is a real risk rather than a formality.
 */
export function evaluateEligibility(
  gpa: number,
  coreCredits: number,
  testScore: number,
  creditsRequired = ACADEMICS.CORE_CREDITS_REQUIRED,
): EligibilityStatus {
  if (gpa < ACADEMICS.REDSHIRT_GPA) return 'non-qualifier';

  const hasCredits = coreCredits >= creditsRequired;
  const hasTest = testScore >= requiredTestScore(gpa);

  if (gpa >= ACADEMICS.QUALIFIER_GPA && hasCredits && hasTest) return 'qualifier';
  if (hasCredits || gpa >= ACADEMICS.QUALIFIER_GPA) return 'academic-redshirt';
  return 'non-qualifier';
}

export function initialAcademics(rng: Rng): Academics {
  const gpa = clamp(
    rng.normal(ACADEMICS.STARTING_GPA, 0.45),
    1.4,
    ACADEMICS.GPA_MAX,
  );
  return {
    gpa,
    coreCredits: 0,
    testScore: 0,
    testAttempts: 0,
    status: evaluateEligibility(gpa, 0, 0),
  };
}

export interface AcademicMonthInput {
  academics: Academics;
  /** How many Study actions were taken this month. */
  studyActions: number;
  /** How many Test Prep actions were taken this month. */
  testPrepActions: number;
  /** School is only in session Sep–May; summer months neither build nor rot. */
  inSchoolYear: boolean;
  /** Coachability and IQ make studying land harder. */
  basketballIQ: number;
  /** True on the month a school year completes, when credits are awarded. */
  yearComplete: boolean;
}

export interface AcademicMonthResult {
  academics: Academics;
  notes: string[];
}

export function advanceAcademics(
  input: AcademicMonthInput,
  rng: Rng,
): AcademicMonthResult {
  const { academics } = input;
  const notes: string[] = [];

  let gpa = academics.gpa;

  if (input.inSchoolYear) {
    if (input.studyActions > 0) {
      // Diminishing within the month: the second session is worth less.
      for (let i = 0; i < input.studyActions; i++) {
        const aptitude = 0.75 + (input.basketballIQ / 99) * 0.5;
        gpa += ACADEMICS.STUDY_GAIN * aptitude * (i === 0 ? 1 : 0.55);
      }
    } else {
      gpa -= ACADEMICS.NEGLECT_DECAY;
    }
    gpa += rng.normal(0, 0.02);
  }

  gpa = clamp(gpa, ACADEMICS.GPA_MIN, ACADEMICS.GPA_MAX);

  let coreCredits = academics.coreCredits;
  if (input.yearComplete) {
    // Credits only bank if you actually passed the year.
    const earned = gpa >= 1.8 ? ACADEMICS.CORE_CREDITS_PER_YEAR : 2;
    coreCredits = Math.min(
      ACADEMICS.CORE_CREDITS_REQUIRED,
      coreCredits + earned,
    );
    notes.push(
      `School year finished with a ${gpa.toFixed(2)} GPA — ${earned} core credits banked.`,
    );
  }

  let testScore = academics.testScore;
  let testAttempts = academics.testAttempts;
  if (input.testPrepActions > 0) {
    const base = 780 + (gpa / 4) * 260 + (input.basketballIQ / 99) * 120;
    const prepBonus = input.testPrepActions * 45 + testAttempts * 25;
    const sat = clamp(
      rng.normal(base + prepBonus, 70),
      ACADEMICS.TEST_MIN,
      ACADEMICS.TEST_MAX,
    );
    testAttempts += 1;
    if (sat > testScore) {
      testScore = Math.round(sat / 10) * 10;
      notes.push(`Sat the test and scored ${testScore}.`);
    } else {
      notes.push(`Retook the test and did not beat ${testScore}.`);
    }
  }

  const status = evaluateEligibility(gpa, coreCredits, testScore);
  if (status !== academics.status) {
    notes.push(`Academic standing is now: ${describeEligibility(status)}.`);
  }

  return {
    academics: { gpa, coreCredits, testScore, testAttempts, status },
    notes,
  };
}

export function describeEligibility(status: EligibilityStatus): string {
  switch (status) {
    case 'qualifier':
      return 'NCAA qualifier';
    case 'academic-redshirt':
      return 'academic redshirt — can sign, cannot play year one';
    case 'non-qualifier':
      return 'non-qualifier — JUCO only';
  }
}

/** Months Sep–May count as school. Summer does not move GPA either way. */
export function isSchoolMonth(month: number): boolean {
  return month >= 8 || month <= 4;
}
