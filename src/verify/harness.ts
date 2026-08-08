import { tick } from '../engine/tick';
import { applyEventChoice } from '../engine/events/engine';
import { choosePath } from '../engine/decisions';
import { pathOptionsFor } from '../engine/careerPath';
import type { GameState, MonthAction, PostHighSchoolPath } from '../engine/types';

/**
 * Shared harness for automated runs.
 *
 * `tick` refuses to advance while an event is awaiting a choice — that is
 * correct for a game driven by a human, but every automated run needs a
 * policy. These helpers supply a deterministic one so the phase scripts can
 * simulate whole careers without the event system deciding whether they pass.
 */

export type ChoicePolicy = (state: GameState) => number;
export type PathPolicy = (state: GameState) => PostHighSchoolPath;

/**
 * Default route policy for automated runs: take the best road available,
 * preferring college, then the developmental deals, then JUCO.
 */
export const BEST_PATH: PathPolicy = (state) => {
  const open = pathOptionsFor(state).filter((o) => o.available);
  const order: PostHighSchoolPath[] = ['college', 'gleague', 'ote', 'overseas', 'juco'];
  for (const path of order) {
    if (open.some((o) => o.path === path)) return path;
  }
  return 'juco';
};

/** Always take the first option. Deterministic and boring on purpose. */
export const FIRST_CHOICE: ChoicePolicy = () => 0;

export function resolvePending(
  state: GameState,
  pick: ChoicePolicy = FIRST_CHOICE,
  path: PathPolicy = BEST_PATH,
): GameState {
  let next = state;
  while (next.events.pending) {
    next = applyEventChoice(next, pick(next));
  }
  // The fork at eighteen blocks the clock the same way an event does.
  if (next.awaitingPath && !next.careerEnd) {
    next = choosePath(next, path(next));
  }
  return next;
}

/** Tick one month and immediately answer whatever the month raised. */
export function autoTick(
  state: GameState,
  actions: MonthAction[] = [],
  pick: ChoicePolicy = FIRST_CHOICE,
  path: PathPolicy = BEST_PATH,
): GameState {
  return resolvePending(tick(state, actions), pick, path);
}

/** Tick `months` months, or until the run ends. */
export function autoTickMonths(
  state: GameState,
  months: number,
  choose: (state: GameState) => MonthAction[] = () => [],
  pick: ChoicePolicy = FIRST_CHOICE,
  path: PathPolicy = BEST_PATH,
): GameState {
  let next = state;
  for (let i = 0; i < months; i++) {
    if (next.careerEnd) break;
    next = autoTick(next, choose(next), pick, path);
  }
  return next;
}
