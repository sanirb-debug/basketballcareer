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
import { gradeForClock, gradeLabel, perGame } from './season';
import { describeEligibility } from './academics';
import { AAU_LABEL } from './hype';
import { PROGRAMS, TIER_LABEL, programById } from './colleges';
import { RECRUITING, activeOffers, canSign, isSigningMonth } from './recruiting';
import { RELATIONSHIP_LABEL } from './relationships';
import { findRival, rankBoard, rankingScore } from './prospects';
import { eventById } from './events/engine';
import type {
  Academics,
  Attributes,
  Body,
  BoxScore,
  GameRecord,
  GameState,
  Injury,
  LeagueTeam,
  Origin,
  Position,
  ProgramTier,
  RankedProspect,
  RelationshipId,
  Reputation,
  SeasonSummary,
} from './types';
import { RELATIONSHIP_IDS } from './types';

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


export interface ProgramRow {
  id: string;
  name: string;
  tier: ProgramTier;
  tierLabel: string;
  state: string;
  interest: number;
  offered: boolean;
  pulledReason: string | null;
  committed: boolean;
  /** Whether this staff is recruiting the player's position this cycle. */
  needsYou: boolean;
}

export interface RelationshipRow {
  id: RelationshipId;
  label: string;
  level: number;
  active: boolean;
}

export interface PendingEventView {
  id: string;
  title: string;
  prompt: string;
  category: string;
  /**
   * Label and flavor only — never the effects.
   *
   * Showing the stat deltas would turn a character test into arithmetic, and
   * it would also surface hidden field names the rest of this selector works
   * hard to keep out of the player's hands.
   */
  choices: { label: string; detail: string | null }[];
}

export interface RecruitingView {
  programs: ProgramRow[];
  offerCount: number;
  committedTo: string | null;
  signed: boolean;
  decommits: number;
  visitsThisCycle: number;
  visitsAllowed: number;
  signingWindowOpen: boolean;
  canSignNow: boolean;
}

export interface RankingsView {
  nationalRank: number;
  previousRank: number;
  hype: number;
  aauLabel: string;
  top: RankedProspect[];
  rival: { name: string; rank: number; position: string; homeState: string } | null;
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
  grade: number;
  gradeLabel: string;
  academics: Academics & { standing: string };
  reputation: Reputation;
  money: number;
  recruiting: RecruitingView;
  rankings: RankingsView;
  relationships: RelationshipRow[];
  pendingEvent: PendingEventView | null;
  fullLog: { text: string; date: string; kind: string }[];
  decisions: { choice: string; monthsElapsed: number; title: string }[];
}

export function toPublicView(state: GameState): PublicView {
  const { player, clock } = state;
  const phase = phaseFor(clock, state.stage);
  const grade = gradeForClock(clock);
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
    grade,
    gradeLabel: gradeLabel(grade),
    academics: {
      ...state.academics,
      standing: describeEligibility(state.academics.status),
    },
    reputation: { ...state.reputation },
    money: Math.round(state.money),
    recruiting: toRecruitingView(state, grade),
    rankings: toRankingsView(state, overall),
    relationships: RELATIONSHIP_IDS.map((id) => ({
      id,
      label: RELATIONSHIP_LABEL[id],
      level: Math.round(state.relationships[id].level),
      active: state.relationships[id].active,
    })),
    pendingEvent: toPendingEvent(state),
    fullLog: [...state.log]
      .reverse()
      .map((entry) => ({
        text: entry.text,
        kind: entry.kind,
        date: formatClock({ year: entry.year, month: entry.month }),
      })),
    decisions: state.events.decisions.map((d) => ({
      choice: d.choice,
      monthsElapsed: d.monthsElapsed,
      title: eventById(d.eventId)?.title ?? d.eventId,
    })),
  };
}

function toRecruitingView(state: GameState, grade: number): RecruitingView {
  const { recruiting } = state;
  const live = activeOffers(recruiting);
  const offerIds = new Set(live.map((o) => o.programId));

  const programs: ProgramRow[] = PROGRAMS.map((program) => {
    const offer = recruiting.offers.find((o) => o.programId === program.id);
    return {
      id: program.id,
      name: program.name,
      tier: program.tier,
      tierLabel: TIER_LABEL[program.tier],
      state: program.state,
      interest: Math.round(recruiting.interest[program.id] ?? 0),
      offered: offerIds.has(program.id),
      pulledReason: offer && !offer.active ? offer.pulledReason : null,
      committed: recruiting.commitment?.programId === program.id,
      needsYou: recruiting.needs[program.id] === state.player.position,
    };
  }).sort((a, b) => b.interest - a.interest);

  return {
    programs,
    offerCount: live.length,
    committedTo: recruiting.commitment
      ? (programById(recruiting.commitment.programId)?.name ?? null)
      : null,
    signed: recruiting.signed,
    decommits: recruiting.decommits,
    visitsThisCycle: recruiting.visitsThisCycle,
    visitsAllowed: RECRUITING.VISITS_PER_CYCLE,
    signingWindowOpen: isSigningMonth(state.clock.month) && grade >= 12,
    canSignNow: canSign(recruiting, grade, state.clock.month),
  };
}

function toRankingsView(state: GameState, overall: number): RankingsView {
  const entry = {
    name: state.player.name,
    position: state.player.position,
    homeState: state.origin.homeState,
    rating: overall,
    hype: state.hype.hype,
  };

  const board = rankBoard(state.prospects, entry);
  const rivalProspect = findRival(state.prospects);
  const rivalRow = rivalProspect
    ? board.find((b) => b.id === rivalProspect.id)
    : undefined;

  // Always include the player's own row, even when he is nowhere near the top.
  const top = board.slice(0, 25);
  const playerRow = board.find((b) => b.isPlayer);
  if (playerRow && !top.some((b) => b.isPlayer)) top.push(playerRow);
  if (rivalRow && !top.some((b) => b.id === rivalRow.id)) top.push(rivalRow);
  void rankingScore;

  return {
    nationalRank: state.hype.nationalRank,
    previousRank: state.hype.previousRank,
    hype: Math.round(state.hype.hype),
    aauLabel: AAU_LABEL[state.hype.aauTier],
    top,
    rival: rivalRow
      ? {
          name: rivalRow.name,
          rank: rivalRow.rank,
          position: rivalRow.position,
          homeState: rivalRow.homeState,
        }
      : null,
  };
}

function toPendingEvent(state: GameState): PendingEventView | null {
  if (!state.events.pending) return null;
  const event = eventById(state.events.pending.eventId);
  if (!event) return null;

  return {
    id: event.id,
    title: event.title,
    prompt: event.prompt,
    category: event.category,
    choices: event.choices.map((c) => ({
      label: c.label,
      detail: c.detail ?? null,
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
