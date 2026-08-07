import {
  absoluteMonth,
  ageInMonths,
  formatAge,
  formatClock,
  formatHeight,
  phaseFor,
} from './calendar';
import { overallFor } from './attributes';
import { effectiveAttributes } from './condition';
import { GAME_MINUTES, addBox, emptyBox, minutesFor } from './gameSim';
import { gradeLabel, perGame } from './season';
import type {
  Attributes,
  Body,
  BoxScore,
  GameRecord,
  GameState,
  Injury,
  LeagueTeam,
  Origin,
  Position,
  SeasonSummary,
} from './types';

/**
 * The player-facing projection of game state.
 *
 * SPEC §4 requires the genetic roll to stay hidden and be revealed slowly. The
 * enforcement is structural: this selector is the only thing the UI reads, and
 * it cannot leak `hidden` or `hiddenMeta` because it never copies them. The
 * Phase 1 verification deep-scans the result to prove it.
 */

export interface PublicOrigin extends Omit<Origin, 'exposureMultiplier'> {}

export interface SeasonView {
  seasonYear: number;
  grade: number;
  gradeLabel: string;
  wins: number;
  losses: number;
  eliminated: boolean;
  playoffWins: number;
  games: GameRecord[];
  gamesPlayed: number;
  totals: BoxScore;
  ppg: number;
  rpg: number;
  apg: number;
  mpg: number;
  standings: LeagueTeam[];
}

export interface PublicView {
  seed: number;
  monthsElapsed: number;
  date: string;
  phase: string;
  actionPoints: number;
  ageMonths: number;
  ageLabel: string;
  energy: number;
  coachTrust: number;
  projectedMinutes: number;
  injury: Injury | null;
  player: {
    name: string;
    position: Position;
    jerseyNumber: number;
    handedness: string;
    body: Body;
    heightLabel: string;
    attributes: Attributes;
    overall: number;
  };
  school: {
    name: string;
    blurb: string;
    exposure: number;
  };
  origin: PublicOrigin;
  season: SeasonView | null;
  gamesThisMonth: GameRecord[];
  history: SeasonSummary[];
  careerEnd: GameState['careerEnd'];
  recentLog: { text: string; date: string; kind: string }[];
}

export function toPublicView(state: GameState): PublicView {
  const { player, clock } = state;
  const phase = phaseFor(clock);
  const months = ageInMonths(clock, player.birthYear, player.birthMonth);
  const monthAbs = absoluteMonth(clock.year, clock.month);

  // Destructured out rather than deleted, so adding a hidden field later
  // cannot accidentally start leaking through this selector.
  const { exposureMultiplier: _exposure, ...publicOrigin } = state.origin;
  void _exposure;

  const effective = effectiveAttributes(player.attributes, state.condition.injury);
  const overall = overallFor(player.attributes, player.position);

  return {
    seed: state.seed,
    monthsElapsed: state.monthsElapsed,
    date: formatClock(clock),
    phase: phase.label,
    actionPoints: phase.actionPoints,
    ageMonths: months,
    ageLabel: formatAge(months),
    energy: Math.round(state.condition.energy),
    coachTrust: Math.round(state.coachTrust),
    projectedMinutes: minutesFor(
      state.coachTrust,
      overallFor(effective, player.position),
      state.school.rosterDepth,
      state.condition.energy,
      state.condition.injury !== null,
    ),
    injury: state.condition.injury,
    player: {
      name: player.name,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      handedness: player.handedness,
      body: { ...player.body },
      heightLabel: formatHeight(player.body.heightInches),
      attributes: { ...player.attributes },
      overall,
    },
    school: {
      name: state.school.name,
      blurb: state.school.blurb,
      exposure: state.school.exposureMultiplier,
    },
    origin: publicOrigin,
    season: state.season ? toSeasonView(state) : null,
    // The clock advances at the end of a tick, so the games worth showing are
    // the ones from the month just completed, not the month now on screen.
    gamesThisMonth: state.season
      ? state.season.schedule.filter((g) => g.played && g.monthAbs === monthAbs - 1)
      : [],
    history: state.history,
    careerEnd: state.careerEnd,
    recentLog: state.log
      .slice(-10)
      .reverse()
      .map((entry) => ({
        text: entry.text,
        kind: entry.kind,
        date: formatClock({ year: entry.year, month: entry.month }),
      })),
  };
}

function toSeasonView(state: GameState): SeasonView {
  const season = state.season as NonNullable<GameState['season']>;
  const appearances = season.schedule.filter((g) => g.played && g.box.minutes > 0);
  const totals = appearances.reduce((acc, g) => addBox(acc, g.box), emptyBox());
  const games = appearances.length;

  return {
    seasonYear: season.seasonYear,
    grade: season.grade,
    gradeLabel: gradeLabel(season.grade),
    wins: season.wins,
    losses: season.losses,
    eliminated: season.eliminated,
    playoffWins: season.playoffWins,
    games: season.schedule,
    gamesPlayed: games,
    totals,
    ppg: perGame(totals.points, games),
    rpg: perGame(totals.rebounds, games),
    apg: perGame(totals.assists, games),
    mpg: perGame(totals.minutes, games),
    standings: [...season.league].sort(
      (a, b) => b.wins - b.losses - (a.wins - a.losses),
    ),
  };
}

export { GAME_MINUTES };
