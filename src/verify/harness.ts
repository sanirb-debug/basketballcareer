import { tick } from '../engine/tick';
import { applyEventChoice } from '../engine/events/engine';
import type { GameState, MonthAction } from '../engine/types';

/**
 * Shared harness for automated runs.
 *
 * `tick` refuses to advance while an event is awaiting a choice — that is
 * correct for a game driven by a human, but every automated run needs a
 * policy. These helpers supply a deterministic one so the phase scripts can
 * simulate whole careers without the event system deciding whether they pass.
 */

export type ChoicePolicy = (state: GameState) => number;

/** Always take the first option. Deterministic and boring on purpose. */
export const FIRST_CHOICE: ChoicePolicy = () => 0;

export function resolvePending(
  state: GameState,
  pick: ChoicePolicy = FIRST_CHOICE,
): GameState {
  let next = state;
  while (next.events.pending) {
    next = applyEventChoice(next, pick(next));
  }
  return next;
}

/** Tick one month and immediately answer whatever the month raised. */
export function autoTick(
  state: GameState,
  actions: MonthAction[] = [],
  pick: ChoicePolicy = FIRST_CHOICE,
): GameState {
  return resolvePending(tick(state, actions), pick);
}

/** Tick `months` months, or until the run ends. */
export function autoTickMonths(
  state: GameState,
  months: number,
  choose: (state: GameState) => MonthAction[] = () => [],
  pick: ChoicePolicy = FIRST_CHOICE,
): GameState {
  let next = state;
  for (let i = 0; i < months; i++) {
    if (next.careerEnd) break;
    next = autoTick(next, choose(next), pick);
  }
  return next;
}
