import { createRng } from './rng';
import { phaseFor } from './calendar';
import { gradeForClock } from './season';
import { schoolFor } from './school';
import { PROGRAMS, programById } from './colleges';
import { enterPath, pathOptionsFor } from './careerPath';
import { DRAFT, canDeclare, canWithdraw, initialDraft } from './draft';
import { POSITIONS } from './types';
import type {
  GameState,
  LogEntry,
  PostHighSchoolPath,
  Position,
  Program,
  SchoolTier,
} from './types';

/**
 * Decisions the player makes outside the month tick (SPEC §14).
 *
 * These are the branch points — which road to take at eighteen, whether to
 * redshirt, whether to enter the portal, whether to declare for the draft or
 * only test the waters. Each is a pure function so it stays as reproducible
 * as everything else.
 */

export class DecisionError extends Error {}

function append(state: GameState, text: string, kind: LogEntry['kind'] = 'system'): LogEntry[] {
  return [
    ...state.log,
    {
      monthsElapsed: state.monthsElapsed,
      year: state.clock.year,
      month: state.clock.month,
      kind,
      text,
    },
  ];
}

/** Take one of the roads out of high school. */
export function choosePath(state: GameState, path: PostHighSchoolPath): GameState {
  if (!state.awaitingPath) {
    throw new DecisionError('There is no path decision pending');
  }

  const option = pathOptionsFor(state).find((o) => o.path === path);
  if (!option) throw new DecisionError(`Unknown path: ${path}`);
  if (!option.available) {
    throw new DecisionError(option.blockedReason ?? 'That road is not open');
  }

  const rng = createRng(state.rngState);
  const entry = enterPath(option, state.monthsElapsed, rng);

  return {
    ...state,
    rngState: rng.state(),
    stage: entry.stage,
    college: entry.college,
    awaitingPath: false,
    // A new stage means a new staff and a fresh season.
    season: null,
    coachTrust: entry.college?.trust ?? 40,
    draft: state.draft ?? initialDraft(state.clock.year + 1),
    log: append(state, entry.note),
  };
}

/**
 * Declare for the draft.
 *
 * `testingWaters` keeps the option to withdraw before the May deadline;
 * declaring outright burns whatever eligibility is left, which is the whole
 * weight of the decision (SPEC §14).
 */
export function declareForDraft(state: GameState, testingWaters: boolean): GameState {
  if (!canDeclare(state)) {
    throw new DecisionError(
      `Declarations open in April of a season you are eligible for`,
    );
  }

  const draft = state.draft ?? initialDraft(state.clock.year);
  return {
    ...state,
    draft: { ...draft, declared: true, testingWaters, withdrew: false },
    log: append(
      state,
      testingWaters
        ? 'Declared for the draft, keeping the option to withdraw.'
        : 'Declared for the draft. No going back to college.',
    ),
  };
}

/** Pull out before the deadline and keep your eligibility. */
export function withdrawFromDraft(state: GameState): GameState {
  if (!canWithdraw(state)) {
    throw new DecisionError(
      `You can only withdraw before the deadline, and only if you tested the waters`,
    );
  }

  const draft = state.draft!;
  return {
    ...state,
    draft: {
      ...draft,
      declared: false,
      testingWaters: false,
      withdrew: true,
      year: draft.year + 1,
    },
    log: append(state, 'Withdrew from the draft and returned to school.'),
  };
}

export function canRedshirt(state: GameState): boolean {
  return Boolean(
    state.college &&
      !state.college.redshirted &&
      !state.college.redshirtingNow &&
      // Only worth doing before the season starts.
      state.clock.month >= 6 &&
      state.clock.month <= 9,
  );
}

/** Sit a season out to preserve a year of eligibility (SPEC §14). */
export function redshirt(state: GameState): GameState {
  if (!canRedshirt(state)) {
    throw new DecisionError('A redshirt has to be declared before the season');
  }
  return {
    ...state,
    college: { ...state.college!, redshirtingNow: true },
    log: append(
      state,
      'Redshirting this season — practices only, and the year does not count.',
    ),
  };
}

export function canEnterPortal(state: GameState): boolean {
  return Boolean(
    state.college &&
      !state.college.inPortal &&
      state.college.eligibilityLeft > 1 &&
      // The portal window is the spring.
      (state.clock.month === 3 || state.clock.month === 4),
  );
}

export function enterPortal(state: GameState): GameState {
  if (!canEnterPortal(state)) {
    throw new DecisionError('The portal is only open in the spring');
  }
  return {
    ...state,
    college: { ...state.college!, inPortal: true },
    log: append(state, 'Entered the transfer portal.'),
  };
}

/**
 * Programs that will take a transfer.
 *
 * A move reaches slightly beyond your current level but not indefinitely —
 * the portal is a lateral-or-small-step market, not a free upgrade.
 */
export function transferOptions(state: GameState): Program[] {
  if (!state.college?.inPortal) return [];

  const rank = state.hype.nationalRank;
  return PROGRAMS.filter(
    (p) =>
      p.id !== state.college?.programId &&
      p.tier !== 'juco' &&
      rank <= p.rankCutoff * 1.4,
  );
}

export function transferTo(state: GameState, programId: string): GameState {
  if (!state.college?.inPortal) {
    throw new DecisionError('You are not in the portal');
  }
  const program = programById(programId);
  if (!program) throw new DecisionError(`Unknown program: ${programId}`);

  return {
    ...state,
    college: {
      ...state.college,
      programId: program.id,
      inPortal: false,
      transfers: state.college.transfers + 1,
      // A new staff means starting from scratch on trust.
      trust: 32,
    },
    season: null,
    log: append(state, `Transferred to ${program.name}.`),
  };
}

/**
 * Position change (SPEC §4).
 *
 * The whole premise of the hidden genetic roll is that a late spurt can
 * "reshape your entire career — you built a handle-and-floater game and now
 * you're a big." That only lands if you can actually respond to it, so a
 * player can re-declare his position between seasons.
 */
export function canChangePosition(state: GameState): boolean {
  if (state.careerEnd || state.awaitingPath) return false;
  // Between seasons only — you do not switch positions in February.
  const phase = phaseFor(state.clock, state.stage).phase;
  return phase === 'OFFSEASON' || phase === 'SUMMER' || phase === 'AAU';
}

/**
 * How well a position fits the body the player actually has.
 * Used to surface the suggestion rather than leave it buried.
 */
export function positionFit(state: GameState, position: Position): number {
  const height = state.player.body.heightInches;
  const ideal: Record<Position, number> = {
    PG: 74,
    SG: 77,
    SF: 79,
    PF: 81,
    C: 83,
  };
  return Math.max(0, 100 - Math.abs(height - ideal[position]) * 9);
}

/** The position this player's body is actually built for right now. */
export function suggestedPosition(state: GameState): Position {
  return [...POSITIONS].sort(
    (a, b) => positionFit(state, b) - positionFit(state, a),
  )[0] as Position;
}

export function changePosition(state: GameState, position: Position): GameState {
  if (!canChangePosition(state)) {
    throw new DecisionError('A position change has to happen between seasons');
  }
  if (position === state.player.position) {
    throw new DecisionError('You already play there');
  }

  return {
    ...state,
    player: { ...state.player, position },
    // A new position means learning a new job; the staff needs convincing.
    coachTrust: Math.max(0, state.coachTrust - 8),
    log: append(
      state,
      `Moved to ${position}. New position, new film, and a coach to convince.`,
    ),
  };
}

/**
 * Transferring high schools (SPEC §8): "reputation hit + sit-out period".
 */
export function canTransferSchool(state: GameState): boolean {
  return (
    state.stage === 'highschool' &&
    !state.careerEnd &&
    !state.awaitingPath &&
    gradeForClock(state.clock) < 12 &&
    // Summer only — you do not move schools mid-season.
    state.clock.month >= 4 &&
    state.clock.month <= 7
  );
}

export function transferSchool(state: GameState, tier: SchoolTier): GameState {
  if (!canTransferSchool(state)) {
    throw new DecisionError('You can only transfer between school years');
  }
  const school = schoolFor(tier);
  if (school.name === state.school.name) {
    throw new DecisionError('You already go there');
  }

  return {
    ...state,
    school,
    // A transfer costs standing everywhere and starts you at the back of
    // the queue with a staff that did not recruit you.
    coachTrust: Math.max(0, school.startingTrust - 12),
    reputation: {
      ...state.reputation,
      offCourt: Math.max(0, state.reputation.offCourt - 7),
    },
    season: null,
    log: append(
      state,
      `Transferred to ${school.name}. New gym, new coach, and people are talking.`,
    ),
  };
}

/**
 * Reclassifying (SPEC §8): repeat a year to be older and more developed
 * relative to your class. Costs a year of your life; buys physical maturity
 * and another recruiting cycle.
 */
export function canReclassify(state: GameState): boolean {
  return (
    state.stage === 'highschool' &&
    !state.events.flags.reclassified &&
    gradeForClock(state.clock) >= 9 &&
    gradeForClock(state.clock) <= 11 &&
    state.clock.month >= 4 &&
    state.clock.month <= 7
  );
}

export function reclassify(state: GameState): GameState {
  if (!canReclassify(state)) {
    throw new DecisionError('You can only reclassify in the summer, before senior year');
  }

  // Push the birth date back a year: you are now old for your class rather
  // than young for it, with everything that implies physically.
  return {
    ...state,
    player: { ...state.player, birthYear: state.player.birthYear - 1 },
    events: {
      ...state.events,
      flags: { ...state.events.flags, reclassified: true },
    },
    log: append(
      state,
      'Reclassified down a year. You are the old one in the class now.',
    ),
  };
}

export function canRequestTrade(state: GameState): boolean {
  return Boolean(state.pro && !state.pro.tradeRequested && state.pro.seasons >= 1);
}

/** Ask out. Costs standing, and it is not always granted (SPEC §14). */
export function requestTrade(state: GameState): GameState {
  if (!canRequestTrade(state)) {
    throw new DecisionError('You cannot request a trade right now');
  }

  const rng = createRng(state.rngState);
  const granted = rng.chance(0.55);
  const league = state.pro!.league;
  const destination = granted
    ? (league[Math.floor(rng.next() * league.length)] as (typeof league)[number])
    : null;

  return {
    ...state,
    rngState: rng.state(),
    reputation: {
      ...state.reputation,
      onCourt: Math.max(0, state.reputation.onCourt - 6),
    },
    pro: {
      ...state.pro!,
      tradeRequested: true,
      ...(destination ? { teamId: destination.id } : {}),
    },
    season: destination ? null : state.season,
    log: append(
      state,
      destination
        ? `Trade request granted — you are headed to ${destination.name}.`
        : 'Trade request denied. The front office is not moving you.',
    ),
  };
}

export { DRAFT };
