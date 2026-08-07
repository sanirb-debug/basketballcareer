import { createRng } from './rng';
import { advanceClock, ageInMonths } from './calendar';
import { growOneMonth } from './growth';
import { applyDerivedAttributes } from './attributes';
import type { GameState, LogEntry, MonthAction } from './types';

/**
 * The month tick engine (SPEC §16.3) — the core loop everything else hangs off.
 *
 * `tick` is a pure function. It never mutates its input and never touches
 * anything outside the state it is given, including the RNG: the stream's
 * complete state lives in `state.rngState`, so the tick reads it, consumes
 * draws, and writes the resulting stream state into the value it returns.
 * That is what makes a run reproducible from its seed and exact across a
 * save/reload.
 *
 * Sub-steps run in a fixed order so later phases can slot in without surgery.
 */

/** Growth below this is rounding noise, not worth a notification line. */
const GROWTH_NOTIFICATION_THRESHOLD = 0.05;

export function tick(state: GameState, actions: MonthAction[]): GameState {
  // Phase 3 introduces action points and training. Until then, submitting
  // actions is a bug in the caller rather than something to silently ignore.
  if (actions.length > 0) {
    throw new Error(
      `tick: actions are not implemented until Phase 3 (received ${actions.length})`,
    );
  }

  const rng = createRng(state.rngState);

  // 1. Advance the clock.
  const clock = advanceClock(state.clock);
  const monthsElapsed = state.monthsElapsed + 1;
  const ageMonths = ageInMonths(
    clock,
    state.player.birthYear,
    state.player.birthMonth,
  );

  // 2. Apply the growth curve.
  const { genetics } = state.hidden;
  const growth = growOneMonth(state.player.body, ageMonths, genetics, rng);

  // 3. Recompute derived attributes from the new body.
  const attributes = applyDerivedAttributes(
    state.player.attributes,
    genetics,
    ageMonths,
    growth.body,
  );

  // 4. Append this month's notable outcomes to the career log.
  const log = appendGrowthNotification(state, clock, monthsElapsed, growth.grewInches);

  // Phase 3+ sub-steps land here, in order: spend action points, resolve
  // energy, simulate games, roll injuries, update hype/ranking, fire events.

  return {
    ...state,
    rngState: rng.state(),
    clock,
    monthsElapsed,
    player: {
      ...state.player,
      body: growth.body,
      attributes,
    },
    log,
  };
}

function appendGrowthNotification(
  state: GameState,
  clock: GameState['clock'],
  monthsElapsed: number,
  grewInches: number,
): LogEntry[] {
  const rounded = Math.round(grewInches * 10) / 10;
  if (rounded < GROWTH_NOTIFICATION_THRESHOLD) return state.log;

  const unit = rounded === 1 ? 'inch' : 'inches';
  return [
    ...state.log,
    {
      monthsElapsed,
      year: clock.year,
      month: clock.month,
      kind: 'growth',
      text: `You grew ${rounded.toFixed(1)} ${unit}.`,
    },
  ];
}

/** The most recent growth line, for the month screen. */
export function latestGrowthNote(state: GameState): string | null {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const entry = state.log[i] as LogEntry;
    if (entry.monthsElapsed !== state.monthsElapsed) break;
    if (entry.kind === 'growth') return entry.text;
  }
  return null;
}

/**
 * Recursively freeze a state tree so accidental mutation throws in strict mode
 * instead of silently corrupting a run. DEV only — the walk is not free.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
