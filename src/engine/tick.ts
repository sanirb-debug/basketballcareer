import { clamp, createRng, type Rng } from './rng';
import { absoluteMonth, advanceClock, ageInMonths, phaseFor } from './calendar';
import { growOneMonth } from './growth';
import { applyDerivedAttributes, overallFor } from './attributes';
import { ACTIONS, TRAINING, applyActions } from './actions';
import { advanceRehab, effectiveAttributes, rollInjury } from './condition';
import { GAME_MINUTES, minutesFor, resolveGame } from './gameSim';
import {
  advanceLeague,
  createSeason,
  gamesScheduledFor,
  gradeLabel,
  hasGraduated,
  seasonYearForClock,
  summarizeSeason,
} from './season';
import type {
  Attributes,
  GameRecord,
  GameState,
  LogEntry,
  MonthAction,
  SeasonState,
} from './types';

/**
 * The month tick engine (SPEC §16.3) — the core loop everything else hangs off.
 *
 * `tick` is a pure function. It never mutates its input and never touches
 * anything outside the state it is given, including the RNG: the stream's
 * complete state lives in `state.rngState`, so the tick reads it, consumes
 * draws, and writes the resulting stream state into the value it returns.
 *
 * Sub-step order is deliberate and load-bearing:
 *
 *   validate → train → play games → injury roll → coach trust → season
 *   rollover → advance clock → rehab → growth → derived attributes
 *
 * Two things about that order matter:
 *
 * 1. Actions are charged against the month the player is *currently* in, and
 *    the clock advances at the very end. Advancing first would bill October's
 *    four offseason points against November's in-season two, so the screen
 *    would offer choices the engine then rejects.
 * 2. Training runs before games, so a month spent grinding leaves you tired
 *    for the games you then play — worse production and a higher injury roll.
 *    That is the tension SPEC §6 is built on; reordering quietly removes the
 *    cost of overtraining.
 */

/** Growth below this is rounding noise, not worth a notification line. */
const GROWTH_NOTIFICATION_THRESHOLD = 0.05;

/** Energy burned per minute played. */
const ENERGY_PER_MINUTE = 0.16;

export const COACH_TRUST = {
  MIN: 0,
  MAX: 100,
  /** How fast trust reverts toward the merit-implied baseline. */
  DRIFT: 0.06,
  PER_WIN: 0.8,
  PER_LOSS: -0.5,
  PER_PRODUCTION: 0.09,
  INJURED_PENALTY: -1.5,
} as const;

export class ActionBudgetError extends Error {}

export function tick(state: GameState, actions: MonthAction[]): GameState {
  // A career-ending injury stops the run (SPEC §15).
  if (state.careerEnd) return state;

  const rng = createRng(state.rngState);
  const clock = state.clock;
  const phase = phaseFor(clock);

  validateActions(actions, phase.actionPoints);

  const monthsElapsed = state.monthsElapsed + 1;
  const log: LogEntry[] = [];
  const note = (kind: LogEntry['kind'], text: string) =>
    log.push({ monthsElapsed, year: clock.year, month: clock.month, kind, text });

  const ageNow = ageInMonths(clock, state.player.birthYear, state.player.birthMonth);

  // --- 1. Training -------------------------------------------------------
  const regenerated = clamp(
    state.condition.energy + TRAINING.PASSIVE_ENERGY_REGEN,
    TRAINING.ENERGY_MIN,
    TRAINING.ENERGY_MAX,
  );

  const applied = applyActions(
    actions,
    state.player.attributes,
    state.training,
    {
      ageMonths: ageNow,
      potential: state.player.hiddenMeta.potential,
      workEthic: state.player.hiddenMeta.workEthic,
      coachQuality: state.school.coachQuality,
      energy: regenerated,
    },
    rng,
  );

  let energy = applied.energy;
  let coachTrust = clamp(
    state.coachTrust + applied.trustDelta,
    COACH_TRUST.MIN,
    COACH_TRUST.MAX,
  );

  const topGain = applied.gained[0];
  if (topGain && topGain.amount >= 0.2) {
    note('training', `The work is showing — ${labelFor(topGain.key)} is coming along.`);
  }

  // --- 2. Games ----------------------------------------------------------
  const played = playMonth(rng, state, {
    clock,
    attributes: applied.attributes,
    coachTrust,
    energy,
    note,
  });

  let season = played.season;
  energy = played.energy;

  // --- 3. Injury roll ----------------------------------------------------
  let injury = state.condition.injury;
  // Annotated because the early return above narrows the field to `null`.
  let careerEnd: GameState['careerEnd'] = state.careerEnd;

  if (!injury) {
    const roll = rollInjury(
      rng,
      energy,
      state.player.hiddenMeta.injuryProneness,
      played.minutesLoad,
    );
    if (roll.injury) {
      injury = roll.injury;
      if (roll.careerEnding) {
        note('injury', `A ${roll.injury.name}. This one does not heal.`);
        careerEnd = {
          reason: 'Career-ending injury',
          detail: `A ${roll.injury.name} at ${Math.floor(ageNow / 12)}. The run just stops.`,
          monthsElapsed,
        };
      } else {
        note(
          'injury',
          `${capitalize(roll.injury.name)} — out ${roll.injury.monthsRemaining} month${
            roll.injury.monthsRemaining === 1 ? '' : 's'
          }.`,
        );
      }
    }
  }

  // --- 4. Coach trust ----------------------------------------------------
  coachTrust = updateCoachTrust(coachTrust, {
    startingTrust: state.school.startingTrust,
    coachability: applied.attributes.coachability as number,
    wins: played.wins,
    losses: played.losses,
    points: played.points,
    gamesPlayed: played.gamesPlayed,
    injuredAllMonth:
      injury !== null && played.gamesScheduled > 0 && played.gamesPlayed === 0,
  });

  // --- 5. Season rollover (March, once every game is in the books) -------
  let history = state.history;
  if (season && clock.month === 2 && season.schedule.every((g) => g.played)) {
    const summary = summarizeSeason(season, state.school.name);
    const ppg =
      summary.games > 0 ? (summary.totals.points / summary.games).toFixed(1) : '0.0';
    note(
      'system',
      `${gradeLabel(season.grade)} year done: ${season.wins}-${season.losses}, ${ppg} ppg.`,
    );
    history = [...history, summary];
    season = null;
  }

  // --- 6. Advance the clock ---------------------------------------------
  const nextClock = advanceClock(clock);
  const ageNext = ageInMonths(
    nextClock,
    state.player.birthYear,
    state.player.birthMonth,
  );

  // --- 7. Rehab ----------------------------------------------------------
  const healingFrom = injury;
  injury = advanceRehab(injury);
  if (healingFrom && !injury) {
    note('injury', `Cleared to play — the ${healingFrom.name} has healed.`);
  }

  // --- 8. Growth ---------------------------------------------------------
  const growth = growOneMonth(
    state.player.body,
    ageNext,
    state.hidden.genetics,
    rng,
  );
  const grew = Math.round(growth.grewInches * 10) / 10;
  if (grew >= GROWTH_NOTIFICATION_THRESHOLD) {
    note('growth', `You grew ${grew.toFixed(1)} ${grew === 1 ? 'inch' : 'inches'}.`);
  }

  // --- 9. Derived attributes --------------------------------------------
  const attributes = applyDerivedAttributes(
    applied.attributes,
    state.hidden.genetics,
    ageNext,
    growth.body,
  );

  return {
    ...state,
    rngState: rng.state(),
    clock: nextClock,
    monthsElapsed,
    player: { ...state.player, body: growth.body, attributes },
    coachTrust,
    training: { streaks: applied.streaks },
    condition: { energy, injury },
    season,
    history,
    careerEnd,
    log: [...state.log, ...log],
  };
}

function validateActions(actions: MonthAction[], budget: number): void {
  if (actions.length > budget) {
    throw new ActionBudgetError(
      `Too many actions for this month: ${actions.length} chosen, ${budget} available`,
    );
  }
  for (const id of actions) {
    if (!ACTIONS[id]) throw new ActionBudgetError(`Unknown action: ${id}`);
  }
}

interface PlayContext {
  clock: GameState['clock'];
  attributes: Attributes;
  coachTrust: number;
  energy: number;
  note: (kind: LogEntry['kind'], text: string) => void;
}

interface PlayResult {
  season: SeasonState | null;
  energy: number;
  minutesLoad: number;
  wins: number;
  losses: number;
  points: number;
  gamesPlayed: number;
  gamesScheduled: number;
}

/** Resolve every game scheduled for the month the player is currently in. */
function playMonth(rng: Rng, state: GameState, ctx: PlayContext): PlayResult {
  const seasonYear = seasonYearForClock(ctx.clock);
  let season = state.season;

  // Open a season lazily the first in-season month we see. Doing it here
  // rather than on a November edge means a save loaded mid-season still
  // finds its schedule.
  if (
    seasonYear !== null &&
    !hasGraduated(seasonYear) &&
    (!season || season.seasonYear !== seasonYear)
  ) {
    season = createSeason(rng, seasonYear, state.school);
    ctx.note(
      'system',
      `${gradeLabel(season.grade)} season opens at ${state.school.name}.`,
    );
  }

  const idle: PlayResult = {
    season,
    energy: ctx.energy,
    minutesLoad: 0,
    wins: 0,
    losses: 0,
    points: 0,
    gamesPlayed: 0,
    gamesScheduled: 0,
  };

  if (!season || seasonYear === null || season.seasonYear !== seasonYear) return idle;

  const monthAbs = absoluteMonth(ctx.clock.year, ctx.clock.month);
  const scheduled = gamesScheduledFor(season, monthAbs);
  if (scheduled.length === 0) return idle;

  const injured = state.condition.injury !== null;
  const effective = effectiveAttributes(ctx.attributes, state.condition.injury);
  const overall = overallFor(effective, state.player.position);

  let energy = ctx.energy;
  let minutesLoad = 0;
  let wins = 0;
  let losses = 0;
  let points = 0;
  let gamesPlayed = 0;
  let eliminated = season.eliminated;
  let playoffWins = season.playoffWins;

  const resolved = new Map<string, GameRecord>();

  for (const game of scheduled) {
    // Postseason is single elimination — once you're out, you're out.
    if (game.playoff && eliminated) {
      resolved.set(game.id, { ...game, played: true, note: 'Season over' });
      continue;
    }

    const minutes = minutesFor(
      ctx.coachTrust,
      overall,
      state.school.rosterDepth,
      energy,
      injured,
    );

    const outcome = resolveGame(rng, {
      attributes: effective,
      position: state.player.position,
      minutes,
      opponentStrength: game.opponentStrength,
      teamStrength: state.school.teamStrength,
      home: game.home,
      energy,
      confidence: state.player.hiddenMeta.confidence,
    });

    if (outcome.win) wins++;
    else losses++;
    if (game.playoff) {
      if (outcome.win) playoffWins++;
      else eliminated = true;
    }

    if (minutes > 0) {
      minutesLoad += minutes;
      points += outcome.box.points;
      gamesPlayed++;
      energy = clamp(
        energy - minutes * ENERGY_PER_MINUTE,
        TRAINING.ENERGY_MIN,
        TRAINING.ENERGY_MAX,
      );
    }

    resolved.set(game.id, {
      ...game,
      played: true,
      teamScore: outcome.teamScore,
      oppScore: outcome.oppScore,
      win: outcome.win,
      box: outcome.box,
      note: minutes > 0 ? null : injured ? 'Did not play — injured' : 'Did not dress',
    });
  }

  if (gamesPlayed > 0) {
    ctx.note(
      'game',
      `${wins}-${losses} this month, averaging ${(points / gamesPlayed).toFixed(1)} a night.`,
    );
  } else if (scheduled.length > 0) {
    ctx.note('game', `Watched all ${scheduled.length} from the bench.`);
  }

  return {
    season: {
      ...season,
      schedule: season.schedule.map((g) => resolved.get(g.id) ?? g),
      wins: season.wins + wins,
      losses: season.losses + losses,
      league: advanceLeague(rng, season.league, scheduled.length),
      eliminated,
      playoffWins,
    },
    energy,
    minutesLoad,
    wins,
    losses,
    points,
    gamesPlayed,
    gamesScheduled: scheduled.length,
  };
}

interface TrustContext {
  startingTrust: number;
  coachability: number;
  wins: number;
  losses: number;
  points: number;
  gamesPlayed: number;
  injuredAllMonth: boolean;
}

/**
 * Coach trust (SPEC §6): raised by coachability, practice attendance and
 * winning; lowered by missed obligations. Practice attendance is folded in
 * upstream via each action's `trustDelta`.
 */
function updateCoachTrust(current: number, ctx: TrustContext): number {
  const baseline = clamp(
    ctx.startingTrust + (ctx.coachability - 50) * 0.35,
    COACH_TRUST.MIN,
    COACH_TRUST.MAX,
  );

  let trust = current + (baseline - current) * COACH_TRUST.DRIFT;
  trust += ctx.wins * COACH_TRUST.PER_WIN + ctx.losses * COACH_TRUST.PER_LOSS;

  if (ctx.gamesPlayed > 0) {
    trust += (ctx.points / ctx.gamesPlayed - 10) * COACH_TRUST.PER_PRODUCTION;
  }
  if (ctx.injuredAllMonth) trust += COACH_TRUST.INJURED_PENALTY;

  return clamp(trust, COACH_TRUST.MIN, COACH_TRUST.MAX);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelFor(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

/** Log lines produced by the most recent tick, for the month screen. */
export function latestLog(state: GameState): LogEntry[] {
  return state.log.filter((e) => e.monthsElapsed === state.monthsElapsed);
}

export function latestGrowthNote(state: GameState): string | null {
  const entry = latestLog(state).find((e) => e.kind === 'growth');
  return entry ? entry.text : null;
}

export { GAME_MINUTES };

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
