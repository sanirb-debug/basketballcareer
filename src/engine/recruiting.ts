import { clamp, type Rng } from './rng';
import { PROGRAMS, TIER_RANK, isDivisionOne, programById } from './colleges';
import type {
  EligibilityStatus,
  Offer,
  Position,
  Program,
  RecruitingState,
} from './types';
import { POSITIONS } from './types';

/**
 * Recruiting (SPEC §10) and the academic gate that sits in front of it (§9).
 *
 * Interest moves month to month off four independent things: your national
 * ranking against the program's cutoff, the position they need this cycle,
 * your academic standing, and your off-court character. Falling short on any
 * one of them closes a different set of doors, which is what makes the
 * academic gate feel like a wall rather than a difficulty slider.
 */

export const RECRUITING = {
  /** Interest at or above this converts into a written offer. */
  OFFER_THRESHOLD: 68,
  /** Below this an existing offer gets pulled. */
  PULL_THRESHOLD: 42,
  /** How fast interest chases its target. */
  DRIFT: 0.22,
  /** Interest added by an official visit. */
  VISIT_BOOST: 14,
  /** Visits allowed per recruiting cycle. */
  VISITS_PER_CYCLE: 5,
  /** Reputation cost of backing out of a commitment. */
  DECOMMIT_CHARACTER_COST: 12,
} as const;

export function initialRecruiting(rng: Rng): RecruitingState {
  const interest: Record<string, number> = {};
  const needs: Record<string, Position> = {};

  for (const program of PROGRAMS) {
    interest[program.id] = 0;
    needs[program.id] = rng.pick(POSITIONS) as Position;
  }

  return {
    interest,
    needs,
    offers: [],
    commitment: null,
    decommits: 0,
    visitsThisCycle: 0,
    signed: false,
  };
}

export interface RecruitingInput {
  nationalRank: number;
  hype: number;
  position: Position;
  eligibility: EligibilityStatus;
  offCourt: number;
  onCourt: number;
  /** Grade 9–12; nobody is offering a 13-year-old much. */
  grade: number;
  monthsElapsed: number;
  /** Program ids visited this month. */
  visited: string[];
  homeState: string;
}

/**
 * Whether a program's academic standard is met.
 *
 * This is SPEC §9's gate: "Fail the academic gate and D1 offers evaporate."
 * A non-qualifier is invisible to every four-year program regardless of how
 * highly ranked he is — JUCO becomes the forced path, not a choice.
 */
export function meetsAcademicBar(
  program: Program,
  eligibility: EligibilityStatus,
): boolean {
  if (!isDivisionOne(program.tier)) return true;
  if (eligibility === 'non-qualifier') return false;
  if (eligibility === 'academic-redshirt') {
    // The very top programs will not burn a scholarship on a redshirt.
    return program.tier !== 'blueblood';
  }
  return true;
}

/** The interest level a program is drifting toward, given who you are today. */
export function targetInterest(
  program: Program,
  needs: Record<string, Position>,
  input: RecruitingInput,
): number {
  if (!meetsAcademicBar(program, input.eligibility)) return 0;
  if (input.offCourt < program.characterFloor) return 0;

  // How far inside (or outside) their ranking window you sit.
  const rankRatio = input.nationalRank / program.rankCutoff;
  let base: number;
  if (rankRatio <= 0.4) base = 92;
  else if (rankRatio <= 0.7) base = 78;
  else if (rankRatio <= 1) base = 62;
  else if (rankRatio <= 1.35) base = 34;
  else if (rankRatio <= 2) base = 14;
  else base = 3;

  // JUCO does not care about your ranking, only that you can play at all.
  if (!isDivisionOne(program.tier)) {
    base = clamp(38 + input.hype * 0.3, 25, 85);
  }

  if (needs[program.id] === input.position) base += 9;
  if (program.state === input.homeState) base += 7;
  base += (input.onCourt - 50) * 0.12;
  base += (input.offCourt - 50) * 0.1;

  // Programs barely engage before junior year.
  const gradeFactor = input.grade <= 9 ? 0.35 : input.grade === 10 ? 0.7 : 1;

  return clamp(base * gradeFactor, 0, 100);
}

export interface RecruitingResult {
  recruiting: RecruitingState;
  notes: string[];
}

export function advanceRecruiting(
  state: RecruitingState,
  input: RecruitingInput,
  rng: Rng,
): RecruitingResult {
  const notes: string[] = [];
  const interest: Record<string, number> = {};
  const offers: Offer[] = state.offers.map((o) => ({ ...o }));

  for (const program of PROGRAMS) {
    const current = state.interest[program.id] ?? 0;
    const target = targetInterest(program, state.needs, input);

    let next = current + (target - current) * RECRUITING.DRIFT;
    if (input.visited.includes(program.id)) next += RECRUITING.VISIT_BOOST;
    next += rng.normal(0, 1.6);
    next = clamp(next, 0, 100);
    interest[program.id] = next;

    const existing = offers.find((o) => o.programId === program.id);

    if (!existing && next >= RECRUITING.OFFER_THRESHOLD && input.grade >= 10) {
      offers.push({
        programId: program.id,
        monthOffered: input.monthsElapsed,
        active: true,
        pulledReason: null,
      });
      notes.push(`${program.name} offered a scholarship.`);
      continue;
    }

    if (existing?.active) {
      // Offers evaporate if you stop qualifying — academically or otherwise.
      if (!meetsAcademicBar(program, input.eligibility)) {
        existing.active = false;
        existing.pulledReason = 'academics';
        notes.push(`${program.name} pulled their offer over your grades.`);
      } else if (input.offCourt < program.characterFloor) {
        existing.active = false;
        existing.pulledReason = 'character';
        notes.push(`${program.name} pulled their offer — character concerns.`);
      } else if (next < RECRUITING.PULL_THRESHOLD) {
        existing.active = false;
        existing.pulledReason = 'cooled';
        notes.push(`${program.name} has moved on to other targets.`);
      }
    }
  }

  // A commitment to a program that just pulled its offer is no commitment.
  let commitment = state.commitment;
  if (commitment) {
    const offer = offers.find((o) => o.programId === commitment?.programId);
    if (offer && !offer.active) {
      notes.push(
        `${programById(commitment.programId)?.name ?? 'Your school'} rescinded — you are uncommitted.`,
      );
      commitment = null;
    }
  }

  return {
    recruiting: {
      ...state,
      interest,
      offers,
      commitment,
      visitsThisCycle: state.visitsThisCycle + input.visited.length,
    },
    notes,
  };
}

export function activeOffers(state: RecruitingState): Offer[] {
  return state.offers.filter((o) => o.active);
}

/** The strongest offer on the table, used for endings and for auto-signing. */
export function bestOffer(state: RecruitingState): Program | null {
  const live = activeOffers(state)
    .map((o) => programById(o.programId))
    .filter((p): p is Program => Boolean(p));
  if (live.length === 0) return null;

  return live.reduce((best, p) =>
    TIER_RANK[p.tier] > TIER_RANK[best.tier] ? p : best,
  );
}

/** SPEC §10 signing periods: the November early period and the April late one. */
export function isSigningMonth(month: number): boolean {
  return month === 10 || month === 3;
}

export function canSign(state: RecruitingState, grade: number, month: number): boolean {
  return (
    !state.signed &&
    grade >= 12 &&
    isSigningMonth(month) &&
    state.commitment !== null &&
    activeOffers(state).some((o) => o.programId === state.commitment?.programId)
  );
}

export interface CommitResult {
  recruiting: RecruitingState;
  characterDelta: number;
  note: string;
}

export function commitTo(
  state: RecruitingState,
  programId: string,
  monthsElapsed: number,
): CommitResult {
  const program = programById(programId);
  if (!program) throw new Error(`commitTo: unknown program ${programId}`);
  if (state.signed) throw new Error('commitTo: already signed');

  const offer = state.offers.find((o) => o.programId === programId && o.active);
  if (!offer) throw new Error(`commitTo: no active offer from ${programId}`);

  const flipping = state.commitment !== null;
  const previous = state.commitment
    ? programById(state.commitment.programId)?.name
    : null;

  return {
    recruiting: {
      ...state,
      commitment: { programId, monthsElapsed, signed: false },
      decommits: state.decommits + (flipping ? 1 : 0),
    },
    // Flipping costs you with everyone watching (SPEC §10).
    characterDelta: flipping ? -RECRUITING.DECOMMIT_CHARACTER_COST : 2,
    note: flipping
      ? `Flipped from ${previous} to ${program.name}.`
      : `Committed to ${program.name}.`,
  };
}

export function decommit(state: RecruitingState): CommitResult {
  if (!state.commitment) throw new Error('decommit: not committed');
  if (state.signed) throw new Error('decommit: already signed');

  const previous = programById(state.commitment.programId)?.name ?? 'your school';
  return {
    recruiting: { ...state, commitment: null, decommits: state.decommits + 1 },
    characterDelta: -RECRUITING.DECOMMIT_CHARACTER_COST,
    note: `Decommitted from ${previous}.`,
  };
}

export function sign(state: RecruitingState): RecruitingResult {
  if (!state.commitment) throw new Error('sign: not committed');
  const program = programById(state.commitment.programId);

  return {
    recruiting: {
      ...state,
      signed: true,
      commitment: { ...state.commitment, signed: true },
    },
    notes: [`Signed with ${program?.name ?? 'your school'}. It is official.`],
  };
}
