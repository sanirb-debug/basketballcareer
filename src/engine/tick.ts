import { clamp, createRng, type Rng } from './rng';
import { absoluteMonth, advanceClock, ageInMonths, phaseFor } from './calendar';
import { growOneMonth } from './growth';
import { applyDerivedAttributes, overallFor } from './attributes';
import { ACTIONS, TRAINING, applyActions, normalizeActions } from './actions';
import { advanceRehab, effectiveAttributes, rollInjury } from './condition';
import { MIDDLE_SCHOOL_TEAM, isMiddleSchool } from './school';
import { GAME_MINUTES, LEVELS, levelFor, minutesFor, resolveGame } from './gameSim';
import {
  advanceLeague,
  createSeason,
  gamesScheduledFor,
  gradeForClock,
  gradeLabel,
  hasGraduated,
  isSchoolYearEnd,
  seasonConfigFor,
  seasonYearFor,
  summarizeSeason,
  teamContextFromSchool,
} from './season';
import type { Note } from './stages';
import {
  advanceCollege,
  advanceDraft,
  advancePro,
  applyProAging,
  ageYearsOf,
  collegeExhausted,
  teamContextFor,
  trustFor,
} from './stages';
import { hasAnyPath } from './careerPath';
import { initialDraft } from './draft';
import { advanceAcademics, isSchoolMonth } from './academics';
import { advanceClass, playerRank } from './prospects';
import { advanceHype, offeredAauTier } from './hype';
import { exposureForState } from './origin';
import { advanceRecruiting } from './recruiting';
import { advanceRelationships, coachTrustBonus } from './relationships';
import { selectEvent } from './events/engine';
import { resolveEnding } from './endings';
import type {
  Attributes,
  GameRecord,
  GameState,
  LogEntry,
  MonthAction,
  RelationshipId,
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
 *   validate → train → academics → games → hype → class → recruiting →
 *   relationships → injury → coach trust → season rollover → advance clock →
 *   rehab → growth → derived attributes → raise event → check for the ending
 *
 * Three things about that order matter:
 *
 * 1. Actions are charged against the month the player is *currently* in, and
 *    the clock advances near the end. Advancing first would bill October's
 *    four offseason points against November's in-season two, so the screen
 *    would offer choices the engine then rejects.
 * 2. Training runs before games, so a month spent grinding leaves you tired
 *    for the games you then play — worse production and a higher injury roll.
 *    That is the tension SPEC §6 is built on.
 * 3. Hype is computed from *this month's* games, and the class advances
 *    immediately after, so the ranking the player sees already accounts for
 *    what they just did and what everyone else did.
 */

const GROWTH_NOTIFICATION_THRESHOLD = 0.05;
const ENERGY_PER_MINUTE = 0.16;

/** Monthly household support by income tier. */
const MONTHLY_INCOME = {
  low: 0,
  modest: 70,
  comfortable: 190,
  affluent: 520,
} as const;

export const COACH_TRUST = {
  MIN: 0,
  MAX: 100,
  DRIFT: 0.06,
  PER_WIN: 0.8,
  PER_LOSS: -0.5,
  PER_PRODUCTION: 0.09,
  INJURED_PENALTY: -1.5,
} as const;

export class ActionBudgetError extends Error {}
export class UnresolvedEventError extends Error {}
export class PathChoiceRequiredError extends Error {}

export function tick(state: GameState, actions: MonthAction[]): GameState {
  // A finished run is inert (SPEC §15).
  if (state.careerEnd) return state;

  // An event raised last month has to be answered before time moves again.
  if (state.events.pending) {
    throw new UnresolvedEventError(
      'An event is awaiting a choice — resolve it before ticking',
    );
  }

  // High school is over and the route has not been chosen (SPEC §14).
  if (state.awaitingPath) {
    throw new PathChoiceRequiredError(
      'Choose what happens after high school before ticking',
    );
  }

  const rng = createRng(state.rngState);
  const clock = state.clock;
  const stage = state.stage;
  const inHighSchool = stage === 'highschool';
  const phase = phaseFor(clock, stage);
  const grade = gradeForClock(clock);

  const chosen = normalizeActions(actions);
  validateActions(chosen, phase.actionPoints);

  const monthsElapsed = state.monthsElapsed + 1;
  const log: LogEntry[] = [];
  const note = (kind: LogEntry['kind'], text: string) =>
    log.push({ monthsElapsed, year: clock.year, month: clock.month, kind, text });

  const ageNow = ageInMonths(clock, state.player.birthYear, state.player.birthMonth);
  const count = (id: string) => chosen.filter((a) => a.id === id).length;

  // --- 1. Training -------------------------------------------------------
  const regenerated = clamp(
    state.condition.energy + TRAINING.PASSIVE_ENERGY_REGEN,
    TRAINING.ENERGY_MIN,
    TRAINING.ENERGY_MAX,
  );

  const applied = applyActions(
    chosen.map((a) => a.id),
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
    state.coachTrust + applied.trustDelta + coachTrustBonus(state.relationships),
    COACH_TRUST.MIN,
    COACH_TRUST.MAX,
  );

  const topGain = applied.gained[0];
  if (topGain && topGain.amount >= 0.2) {
    note('training', `The work is showing — ${labelFor(topGain.key)} is coming along.`);
  }

  // --- 2. Academics (SPEC §9) -------------------------------------------
  const academicResult = advanceAcademics(
    {
      academics: state.academics,
      studyActions: count('study'),
      testPrepActions: count('testPrep'),
      // College keeps a GPA too, but eligibility only gates the jump out of
      // high school, so it stops mattering once that jump is made.
      inSchoolYear:
        isSchoolMonth(clock.month) && grade <= 12 && inHighSchool,
      basketballIQ: applied.attributes.basketballIQ as number,
      yearComplete: isSchoolYearEnd(clock) && grade <= 12 && inHighSchool,
    },
    rng,
  );
  for (const text of academicResult.notes) note('academics', text);

  // --- 3. Games ----------------------------------------------------------
  const played = playMonth(rng, state, {
    clock,
    attributes: applied.attributes,
    // College and pro staffs keep their own trust — you do not walk onto
    // campus with the standing you had as a high school senior.
    coachTrust: inHighSchool ? coachTrust : trustFor(state),
    energy,
    note,
  });

  let season = played.season;
  energy = played.energy;

  // --- 4. Hype (SPEC §7) -------------------------------------------------
  const hypeResult = advanceHype(
    {
      hype: state.hype.hype,
      aauTier: state.hype.aauTier,
      schoolExposure: state.school.exposureMultiplier,
      stateExposure: exposureForState(state.origin.homeState),
      pointsPerGame:
        played.gamesPlayed > 0 ? played.points / played.gamesPlayed : 0,
      gamesPlayed: played.gamesPlayed,
      opponentStrength: played.averageOpponent,
      mixtapeActions: count('mixtape'),
      showcaseActions: count('showcase'),
      livePeriod: phase.phase === 'LIVE_PERIOD',
    },
    rng,
  );
  for (const text of hypeResult.notes) note('hype', text);

  // --- 5. The class moves whether you did anything or not (SPEC §11) -----
  // The recruiting class only matters while you are being recruited.
  const prospects = inHighSchool ? advanceClass(state.prospects, rng) : state.prospects;
  const playerEntry = {
    name: state.player.name,
    position: state.player.position,
    homeState: state.origin.homeState,
    rating: overallFor(applied.attributes, state.player.position),
    hype: hypeResult.hype,
  };
  const nationalRank = playerRank(prospects, playerEntry);

  // Circuit placement is decided each spring (SPEC §7).
  let aauTier = state.hype.aauTier;
  if (clock.month === 3) {
    const offered = offeredAauTier(
      hypeResult.hype,
      nationalRank,
      state.origin.incomeTier,
      state.money,
    );
    if (offered !== aauTier) {
      aauTier = offered;
      note('hype', `Spring circuit set: ${aauTier === 'none' ? 'no travel team this year' : aauTier.toUpperCase()}.`);
    }
  }

  // --- 6. Recruiting (SPEC §10) -----------------------------------------
  const visited = chosen
    .filter((a) => a.id === 'visit' && a.target)
    .map((a) => a.target as string);

  const recruitingResult = inHighSchool
    ? advanceRecruiting(
    state.recruiting,
    {
      nationalRank,
      hype: hypeResult.hype,
      position: state.player.position,
      eligibility: academicResult.academics.status,
      offCourt: state.reputation.offCourt,
      onCourt: state.reputation.onCourt,
      grade,
      monthsElapsed,
      visited,
      homeState: state.origin.homeState,
    },
    rng,
      )
    : { recruiting: state.recruiting, notes: [] as string[] };
  for (const text of recruitingResult.notes) note('recruiting', text);

  // --- 7. Relationships (SPEC §6) ---------------------------------------
  const tended: RelationshipId[] = [];
  for (let i = 0; i < count('socialize'); i++) {
    tended.push('friends');
    if (state.relationships.girlfriend.active) tended.push('girlfriend');
  }
  for (let i = 0; i < count('family'); i++) tended.push('parents');
  if (played.gamesPlayed > 0) tended.push('hsCoach');

  const relResult = advanceRelationships({
    relationships: state.relationships,
    tended,
    boost: TRAINING.RELATIONSHIP_BOOST,
  });
  let relationships = relResult.relationships;
  for (const text of relResult.notes) note('system', text);

  // Joining a circuit puts an AAU coach in your life.
  if (aauTier !== 'none' && !relationships.aauCoach.active) {
    relationships = {
      ...relationships,
      aauCoach: { level: 55, active: true },
    };
  }

  // --- 8. Money ----------------------------------------------------------
  const money =
    state.money +
    MONTHLY_INCOME[state.origin.incomeTier] +
    count('job') * TRAINING.JOB_INCOME;

  // --- 9. Injury roll ----------------------------------------------------
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
          endingId: 'career-ending-injury',
          reason: 'Career-ending injury',
          detail:
            'The run just stops. No build-up, no warning, no second act.',
          decision:
            'One landing. Nothing you chose, and nothing you could have chosen differently.',
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

  // --- 10. Coach trust ---------------------------------------------------
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

  // --- 11. Season rollover ----------------------------------------------
  let history = state.history;
  let proPlayoffRound: number | null = null;
  const postseasonMonth = seasonConfigFor(stage).postseasonMonth;
  if (
    season &&
    clock.month === postseasonMonth &&
    season.schedule.every((g) => g.played)
  ) {
    const teamName = teamContextFor(state, teamContextFromSchool(state.school)).name;
    const summary = summarizeSeason(season, teamName);
    const ppg =
      summary.games > 0 ? (summary.totals.points / summary.games).toFixed(1) : '0.0';
    note(
      'system',
      inHighSchool
        ? `${gradeLabel(season.grade)} year done: ${season.wins}-${season.losses}, ${ppg} ppg.`
        : `Season done: ${season.wins}-${season.losses}, ${ppg} ppg.`,
    );
    // The postseason result has to be recorded before the season is cleared,
    // or a title run leaves no trace and a championship can never happen.
    if (stage === 'nba' && state.pro) {
      proPlayoffRound = season.playoffWins;
    }

    history = [...history, summary];
    season = null;
  }

  // --- 12. Advance the clock --------------------------------------------
  const nextClock = advanceClock(clock);
  const ageNext = ageInMonths(
    nextClock,
    state.player.birthYear,
    state.player.birthMonth,
  );

  // --- 13. Rehab ---------------------------------------------------------
  const healingFrom = injury;
  injury = advanceRehab(injury);
  let eventFlags = state.events.flags;
  if (healingFrom && !injury) {
    note('injury', `Cleared to play — the ${healingFrom.name} has healed.`);
    // Engine-set flag: unlocks the first-game-back event (SPEC §12 chaining).
    eventFlags = { ...eventFlags, returned_from_injury: true };
  }

  // --- 14. Growth --------------------------------------------------------
  // The schedule closes at 19 on its own, so this is a no-op afterwards and
  // still consumes its draw, keeping the stream aligned at every age.
  const growth = growOneMonth(state.player.body, ageNext, state.hidden.genetics, rng);
  const grew = Math.round(growth.grewInches * 10) / 10;
  if (grew >= GROWTH_NOTIFICATION_THRESHOLD) {
    note('growth', `You grew ${grew.toFixed(1)} ${grew === 1 ? 'inch' : 'inches'}.`);
  }

  // --- 15. Derived attributes -------------------------------------------
  const attributes = applyDerivedAttributes(
    applied.attributes,
    state.hidden.genetics,
    ageNext,
    growth.body,
  );

  let next: GameState = {
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
    academics: academicResult.academics,
    hype: {
      hype: hypeResult.hype,
      nationalRank,
      previousRank: state.hype.nationalRank,
      aauTier,
      campInvites: state.hype.campInvites + count('showcase'),
    },
    prospects,
    relationships,
    recruiting: recruitingResult.recruiting,
    events: { ...state.events, flags: eventFlags },
    money,
    pro:
      proPlayoffRound !== null && state.pro
        ? { ...state.pro, lastPlayoffRound: proPlayoffRound }
        : state.pro,
    careerEnd,
    log: [...state.log, ...log],
  };

  // --- 16. Raise an event (SPEC §12) ------------------------------------
  if (!next.careerEnd) {
    const event = selectEvent(next, rng);
    if (event) {
      next = {
        ...next,
        rngState: rng.state(),
        events: {
          ...next.events,
          pending: { eventId: event.id, monthsElapsed },
        },
      };
    } else {
      next = { ...next, rngState: rng.state() };
    }
  }

  // --- 17. Stage progression (SPEC §14) ---------------------------------
  if (!next.careerEnd) {
    next = advanceStage(next, note, rng);
    // Sub-steps above append to `log`, which is folded in at the end.
    next = { ...next, log: [...state.log, ...log] };
  }

  return next;
}

/**
 * Move the career between stages.
 *
 * High school no longer *ends* the run — it hands off to a choice of routes
 * (SPEC §14). Every later stage has its own exit: eligibility running out,
 * the draft, a contract nobody renews.
 */
function advanceStage(state: GameState, note: Note, rng: Rng): GameState {
  let next = state;
  const ageYears = ageYearsOf(next);

  switch (next.stage) {
    case 'highschool': {
      // The senior year is over: choose a road, or discover there isn't one.
      const grade = gradeForClock(next.clock);
      const done = grade > 12 || (grade === 12 && next.clock.month === 5);
      if (!done) break;

      if (!hasAnyPath(next)) {
        note('system', 'No road out of high school opened.');
        return { ...next, careerEnd: resolveEnding(next) };
      }

      note('system', 'High school is over. Time to choose what happens next.');
      return {
        ...next,
        awaitingPath: true,
        draft: next.draft ?? initialDraft(next.clock.year + 1),
      };
    }

    case 'juco': {
      next = advanceCollege(next, note);
      next = advanceDraft(next, note, rng);
      if (next.stage !== 'juco') break;

      // Two years of junior college, then re-recruit (SPEC §9). This is the
      // whole point of the JUCO road — it is a detour, not a dead end.
      if (collegeExhausted(next)) {
        if (!hasAnyPath(next)) {
          note('system', 'Two years at junior college and nobody came back.');
          return { ...next, careerEnd: resolveEnding(next) };
        }
        note('system', 'Junior college is done. Time to decide where you go next.');
        return { ...next, awaitingPath: true };
      }
      break;
    }

    case 'college': {
      next = advanceCollege(next, note);

      // A senior is automatically draft-eligible — there is nothing to
      // declare once the eligibility is gone. Declaring *early* is the
      // decision; being out of years is just arithmetic.
      if (
        next.college &&
        next.college.eligibilityLeft <= 0 &&
        next.draft &&
        !next.draft.declared &&
        !next.draft.completed
      ) {
        note('system', 'Your eligibility is up — you are in the draft automatically.');
        next = {
          ...next,
          draft: {
            ...next.draft,
            declared: true,
            testingWaters: false,
            year: next.clock.year,
          },
        };
      }

      next = advanceDraft(next, note, rng);
      if (next.stage !== 'college') break;

      // Out of eligibility, draft has been and gone, nothing landed.
      if (
        next.college &&
        next.college.eligibilityLeft <= 0 &&
        next.draft?.completed
      ) {
        if (hasAnyPath(next)) {
          note('system', 'College is over. There is still basketball to play.');
          return { ...next, awaitingPath: true };
        }
        note('system', 'College is over and no professional door opened.');
        return { ...next, careerEnd: resolveEnding(next) };
      }
      break;
    }

    case 'developmental':
    case 'overseas': {
      next = advanceDraft(next, note, rng);
      if (next.stage === 'nba') break;

      // The overseas road can simply run out with age.
      if (ageYears >= 34 && next.clock.month === 6) {
        note('system', 'The contracts stopped coming.');
        return { ...next, careerEnd: resolveEnding(next) };
      }
      break;
    }

    case 'nba': {
      next = applyProAging(next);
      next = advancePro(next, note, rng);
      break;
    }

    default:
      break;
  }

  return next;
}

function validateActions(
  actions: { id: string }[],
  budget: number,
): void {
  if (actions.length > budget) {
    throw new ActionBudgetError(
      `Too many actions for this month: ${actions.length} chosen, ${budget} available`,
    );
  }
  for (const action of actions) {
    if (!ACTIONS[action.id as keyof typeof ACTIONS]) {
      throw new ActionBudgetError(`Unknown action: ${action.id}`);
    }
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
  averageOpponent: number;
}

function playMonth(rng: Rng, state: GameState, ctx: PlayContext): PlayResult {
  const config = seasonConfigFor(state.stage);
  // In 8th grade you are still at middle school; the chosen high school is
  // where you are headed, not where you play.
  const middleSchool =
    state.stage === 'highschool' && isMiddleSchool(gradeForClock(ctx.clock));
  const team = middleSchool
    ? { name: state.school.middleSchoolName, ...MIDDLE_SCHOOL_TEAM }
    : teamContextFor(state, teamContextFromSchool(state.school));
  const seasonYear = seasonYearFor(ctx.clock, config);
  let season = state.season;

  // A redshirt year is spent in practice, not in games (SPEC §14).
  const redshirting = state.college?.redshirtingNow ?? false;

  const canOpen =
    state.stage === 'highschool'
      ? seasonYear !== null && !hasGraduated(seasonYear)
      : seasonYear !== null && state.stage !== 'retired';

  if (canOpen && (!season || season.seasonYear !== seasonYear)) {
    const label =
      state.stage === 'highschool'
        ? `${gradeLabel(gradeForClock(ctx.clock))} season`
        : state.stage === 'nba'
          ? 'Season'
          : `Year ${state.college?.year ?? 1}`;
    season = createSeason(
      rng,
      seasonYear as number,
      team,
      config,
      state.stage === 'highschool'
        ? gradeForClock(ctx.clock)
        : (state.college?.year ?? state.pro?.seasons ?? 1),
    );
    ctx.note('system', `${label} opens at ${team.name}.`);
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
    averageOpponent: 50,
  };

  if (!season || seasonYear === null || season.seasonYear !== seasonYear) return idle;

  const monthAbs = absoluteMonth(ctx.clock.year, ctx.clock.month);
  const scheduled = gamesScheduledFor(season, monthAbs);
  if (scheduled.length === 0) return idle;

  const injured = state.condition.injury !== null || redshirting;
  const level = levelFor(state.stage);
  const gameMinutes = LEVELS[level].gameMinutes;
  const effective = effectiveAttributes(ctx.attributes, state.condition.injury);
  const overall = overallFor(effective, state.player.position);

  let energy = ctx.energy;
  let minutesLoad = 0;
  let wins = 0;
  let losses = 0;
  let points = 0;
  let gamesPlayed = 0;
  let opponentTotal = 0;
  let eliminated = season.eliminated;
  let playoffWins = season.playoffWins;

  const resolved = new Map<string, GameRecord>();

  for (const game of scheduled) {
    if (game.playoff && eliminated) {
      resolved.set(game.id, { ...game, played: true, note: 'Season over' });
      continue;
    }

    const minutes = minutesFor(
      ctx.coachTrust,
      overall,
      team.rosterDepth,
      energy,
      injured,
      gameMinutes,
    );

    const outcome = resolveGame(rng, {
      attributes: effective,
      position: state.player.position,
      minutes,
      opponentStrength: game.opponentStrength,
      teamStrength: team.teamStrength,
      home: game.home,
      energy,
      confidence: state.player.hiddenMeta.confidence,
      level,
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
      opponentTotal += game.opponentStrength;
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
      note:
        minutes > 0
          ? null
          : redshirting
            ? 'Redshirt — practised, did not play'
            : injured
              ? 'Did not play — injured'
              : 'Did not dress',
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
    averageOpponent: gamesPlayed > 0 ? opponentTotal / gamesPlayed : 50,
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

/** Turn an attribute key into something readable in a log line. */
const ATTRIBUTE_LABELS: Record<string, string> = {
  catchAndShoot3: 'catch-and-shoot three',
  offDribble3: 'off-the-dribble three',
  basketballIQ: 'basketball IQ',
  offBallMovement: 'off-ball movement',
  passingVision: 'court vision',
  defensiveRebounding: 'defensive rebounding',
  offensiveRebounding: 'offensive rebounding',
  perimeterDefense: 'perimeter defense',
  interiorDefense: 'interior defense',
  postGame: 'post game',
  midRange: 'mid-range',
  freeThrow: 'free throw shooting',
  ballHandling: 'ball handling',
};

function labelFor(key: string): string {
  return (
    ATTRIBUTE_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  );
}

export function latestLog(state: GameState): LogEntry[] {
  return state.log.filter((e) => e.monthsElapsed === state.monthsElapsed);
}

export function latestGrowthNote(state: GameState): string | null {
  const entry = latestLog(state).find((e) => e.kind === 'growth');
  return entry ? entry.text : null;
}

export { GAME_MINUTES };

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
