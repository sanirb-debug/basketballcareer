import { createRng } from './rng';
import { PROGRAMS, programById } from './colleges';
import { enterPath, pathOptionsFor } from './careerPath';
import { DRAFT, canDeclare, canWithdraw, initialDraft } from './draft';
import type { GameState, LogEntry, PostHighSchoolPath, Program } from './types';

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
