import { clamp, type Rng } from './rng';
import { overallFor } from './attributes';
import type { Attributes, BoxScore, Position } from './types';

/**
 * The game resolver (SPEC §13).
 *
 * Not possession-by-possession — it produces a realistic box score from
 * ratings, minutes, opponent strength, energy, confidence and seeded variance.
 * Minutes come from coach trust rather than from skill, which is the whole
 * point of SPEC §6: you can be the best player in the gym and still ride the
 * bench.
 */

/** A high school game is 32 minutes; college is 40 and the pros play 48. */
export const GAME_MINUTES = 32;
const PACE_PER_36 = 76.5;

/**
 * Scoring environment by level.
 *
 * A high school game finishing 55-48 and a pro game finishing 114-109 are
 * both realistic; the same numbers at the wrong level read as broken. These
 * set the baseline each side scores before the player is added.
 */
export interface LevelProfile {
  gameMinutes: number;
  teammateBase: number;
  opponentBase: number;
  /** How much team strength swings the score at this level. */
  strengthSwing: number;
  spread: number;
}

export const LEVELS = {
  highschool: { gameMinutes: 32, teammateBase: 38, opponentBase: 44, strengthSwing: 0.55, spread: 7.5 },
  college: { gameMinutes: 40, teammateBase: 52, opponentBase: 60, strengthSwing: 0.5, spread: 8 },
  pro: { gameMinutes: 48, teammateBase: 88, opponentBase: 97, strengthSwing: 0.45, spread: 9.5 },
} as const satisfies Record<string, LevelProfile>;

export type LevelKey = keyof typeof LEVELS;

export function levelFor(stage: string): LevelKey {
  if (stage === 'nba') return 'pro';
  if (stage === 'highschool') return 'highschool';
  return 'college';
}

export function emptyBox(): BoxScore {
  return {
    minutes: 0,
    points: 0,
    rebounds: 0,
    offRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
  };
}

export function addBox(a: BoxScore, b: BoxScore): BoxScore {
  return {
    minutes: a.minutes + b.minutes,
    points: a.points + b.points,
    rebounds: a.rebounds + b.rebounds,
    offRebounds: a.offRebounds + b.offRebounds,
    assists: a.assists + b.assists,
    steals: a.steals + b.steals,
    blocks: a.blocks + b.blocks,
    turnovers: a.turnovers + b.turnovers,
    fgm: a.fgm + b.fgm,
    fga: a.fga + b.fga,
    tpm: a.tpm + b.tpm,
    tpa: a.tpa + b.tpa,
    ftm: a.ftm + b.ftm,
    fta: a.fta + b.fta,
  };
}

/**
 * Minutes played (SPEC §6: coach trust "determines your minutes *independently
 * of your skill*").
 *
 * Trust carries more weight than the skill edge on purpose — crossing the
 * coach should cost you a season of development even if you are the best
 * player on the roster.
 */
export function minutesFor(
  coachTrust: number,
  overall: number,
  rosterDepth: number,
  energy: number,
  injured: boolean,
  gameMinutes: number = GAME_MINUTES,
): number {
  if (injured) return 0;

  const trust = clamp(coachTrust, 0, 100) / 100;
  const skillEdge = clamp((overall - rosterDepth) / 30, -1, 1);
  const gassed = energy < 35 ? (35 - energy) / 35 : 0;

  const share = clamp(0.12 + 0.46 * trust + 0.44 * skillEdge - 0.12 * gassed, 0, 1);
  return Math.round(share * gameMinutes * 10) / 10;
}

/** Approximate a binomial draw without looping over every attempt. */
function makes(rng: Rng, attempts: number, pct: number): number {
  if (attempts <= 0) return 0;
  const p = clamp(pct, 0.02, 0.98);
  const sd = Math.sqrt(attempts * p * (1 - p));
  return clamp(Math.round(attempts * p + rng.normal(0, sd)), 0, attempts);
}

function noisy(rng: Rng, value: number, spread: number): number {
  return Math.max(0, value * rng.normal(1, spread));
}

export interface GameInputs {
  attributes: Attributes;
  position: Position;
  minutes: number;
  opponentStrength: number;
  teamStrength: number;
  home: boolean;
  energy: number;
  confidence: number;
  /** Scoring environment. Defaults to high school. */
  level?: LevelKey;
}

export interface GameOutcome {
  box: BoxScore;
  teamScore: number;
  oppScore: number;
  win: boolean;
}

export function resolveGame(rng: Rng, inputs: GameInputs): GameOutcome {
  const {
    attributes: a,
    position,
    minutes,
    opponentStrength,
    teamStrength,
    home,
    energy,
    confidence,
  } = inputs;

  const profile = LEVELS[inputs.level ?? 'highschool'];
  const overall = overallFor(a, position);
  const scale = minutes / 36;

  // Form: energy and confidence carry across games rather than being
  // re-rolled each night (SPEC §6 slumps and hot streaks).
  const form =
    1 +
    ((clamp(energy, 0, 100) - 70) / 100) * 0.12 +
    ((clamp(confidence, 0, 100) - 50) / 100) * 0.15;

  const defAdjust = ((opponentStrength - 50) / 99) * 0.06;

  // --- Shot volume -------------------------------------------------------
  const usage = clamp(0.14 + (overall - 50) / 200, 0.1, 0.34);
  const fga36 = PACE_PER_36 * usage * 0.82;
  const fga = Math.round(noisy(rng, fga36 * scale * form, 0.18));

  const perimeter = ((a.catchAndShoot3 as number) + (a.offDribble3 as number)) / 2;
  const interior = ((a.postGame as number) + (a.finishing as number)) / 2;
  const tpaShare = clamp(0.34 + (perimeter - interior) / 100, 0.04, 0.62);
  const tpa = Math.min(fga, Math.round(fga * tpaShare));
  const twoA = fga - tpa;

  // --- Efficiency --------------------------------------------------------
  const insideSkill =
    (a.finishing as number) * 0.6 +
    (a.postGame as number) * 0.25 +
    (a.vertical as number) * 0.15;
  const twoPct = clamp(0.34 + (insideSkill / 99) * 0.24 - defAdjust, 0.2, 0.68) * form;

  const threeSkill =
    (a.catchAndShoot3 as number) * 0.6 + (a.offDribble3 as number) * 0.4;
  const threePct = clamp(0.19 + (threeSkill / 99) * 0.2 - defAdjust, 0.08, 0.46) * form;

  const twoM = makes(rng, twoA, twoPct);
  const tpm = makes(rng, tpa, threePct);
  const fgm = twoM + tpm;

  const fta = Math.round(
    noisy(rng, fga * (0.18 + ((a.finishing as number) / 99) * 0.16), 0.3),
  );
  const ftPct = clamp(0.45 + ((a.freeThrow as number) / 99) * 0.42, 0.3, 0.95);
  const ftm = makes(rng, fta, ftPct);

  const points = twoM * 2 + tpm * 3 + ftm;

  // --- Everything else ---------------------------------------------------
  const dreb = noisy(
    rng,
    (((a.defensiveRebounding as number) * 0.7 + (a.height as number) * 0.3) / 99) *
      9.5 *
      scale,
    0.28,
  );
  const oreb = noisy(
    rng,
    (((a.offensiveRebounding as number) * 0.7 + (a.height as number) * 0.3) / 99) *
      4.2 *
      scale,
    0.35,
  );
  const assists = noisy(
    rng,
    (((a.passingVision as number) * 0.75 + (a.basketballIQ as number) * 0.25) / 99) *
      8.5 *
      scale,
    0.3,
  );
  const steals = noisy(
    rng,
    (((a.steal as number) * 0.8 + (a.agility as number) * 0.2) / 99) * 3 * scale,
    0.45,
  );
  const blocks = noisy(
    rng,
    (((a.block as number) * 0.75 + (a.height as number) * 0.25) / 99) * 3.2 * scale,
    0.5,
  );
  const turnovers = noisy(
    rng,
    (1.4 + usage * 8 - ((a.ballHandling as number) / 99) * 2) * scale,
    0.35,
  );

  const box: BoxScore = {
    minutes,
    points,
    rebounds: Math.round(dreb + oreb),
    offRebounds: Math.round(oreb),
    assists: Math.round(assists),
    steals: Math.round(steals),
    blocks: Math.round(blocks),
    turnovers: Math.round(turnovers),
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta,
  };

  // --- Team result -------------------------------------------------------
  // The player's scoring partly substitutes for teammates' rather than
  // stacking on top of a fixed team total.
  const teammatePoints =
    profile.teammateBase +
    (teamStrength - 50) * profile.strengthSwing -
    points * 0.35 +
    rng.normal(0, 6);
  const teamScore = clamp(Math.round(teammatePoints + points), 20, 180);

  const homeEdge = home ? -2.5 : 2.5;
  const oppScore = clamp(
    Math.round(
      profile.opponentBase +
        (opponentStrength - 50) * (profile.strengthSwing + 0.05) +
        homeEdge +
        rng.normal(0, profile.spread),
    ),
    20,
    180,
  );

  return {
    box,
    teamScore,
    oppScore,
    // No ties in basketball — the home side gets the nod on a dead heat.
    win: teamScore === oppScore ? home : teamScore > oppScore,
  };
}
