import { clamp, type Rng } from './rng';
import type { AauTier, IncomeTier } from './types';

/**
 * Hype (SPEC §7) — a 0–100 stat entirely separate from skill.
 *
 * The point of this system is divergence. A 90 overall in Montana on no
 * circuit should be able to sit outside the top 150, and a 78 overall who
 * dunked on somebody at a July showcase should be able to crack the top 15.
 * Chasing ranking versus chasing skill has to be a real strategic fork, so
 * exposure multiplies production rather than adding to it.
 */

export const HYPE = {
  MIN: 0,
  MAX: 100,
  /** Hype bleeds away if you stop producing. */
  MONTHLY_DECAY: 0.972,

  /** Points of hype for an average game month, before multipliers. */
  PRODUCTION_BASE: 1.5,
  /** Weight on beating strong opponents (SPEC §7: "weighted heavily"). */
  OPPONENT_WEIGHT: 0.03,

  /** A viral clip is worth more than three good games. */
  MIXTAPE_BASE: 5.5,
  /** Showcases and camps are the other big lever. */
  SHOWCASE_BASE: 7,

  /** July live period multiplies whatever you do that month. */
  LIVE_PERIOD_MULTIPLIER: 1.8,
} as const;

/** Exposure multiplier by AAU circuit (SPEC §7). */
export const AAU_MULTIPLIER: Record<AauTier, number> = {
  none: 0.55,
  unaffiliated: 0.85,
  ua: 1.25,
  adidas: 1.45,
  nike: 1.75,
};

export const AAU_LABEL: Record<AauTier, string> = {
  none: 'No circuit',
  unaffiliated: 'Unaffiliated travel team',
  ua: 'Under Armour Association',
  adidas: '3SSB (adidas)',
  nike: 'Nike EYBL',
};

/** Annual cost of playing on each circuit — this is where income gates. */
export const AAU_COST: Record<AauTier, number> = {
  none: 0,
  unaffiliated: 400,
  ua: 1800,
  adidas: 2600,
  nike: 3800,
};

export interface HypeMonthInput {
  hype: number;
  aauTier: AauTier;
  /** School exposure (powerhouse vs rural public). */
  schoolExposure: number;
  /** Home-state scout density. */
  stateExposure: number;
  /** Points per game this month, 0 if no games. */
  pointsPerGame: number;
  gamesPlayed: number;
  /** Average opponent strength faced. */
  opponentStrength: number;
  mixtapeActions: number;
  showcaseActions: number;
  livePeriod: boolean;
}

export interface HypeMonthResult {
  hype: number;
  notes: string[];
}

export function advanceHype(input: HypeMonthInput, rng: Rng): HypeMonthResult {
  const notes: string[] = [];
  const exposure =
    AAU_MULTIPLIER[input.aauTier] * input.schoolExposure * input.stateExposure;

  let gain = 0;

  if (input.gamesPlayed > 0) {
    // Production scaled by who it came against.
    const quality =
      1 + (input.opponentStrength - 50) * HYPE.OPPONENT_WEIGHT;
    const production =
      (input.pointsPerGame / 12) * HYPE.PRODUCTION_BASE * Math.max(0.2, quality);
    gain += production;
  }

  if (input.mixtapeActions > 0) {
    for (let i = 0; i < input.mixtapeActions; i++) {
      // Virality is lumpy: most clips do nothing, one in six blows up.
      const viral = rng.chance(0.17);
      const value = HYPE.MIXTAPE_BASE * (viral ? rng.float(2.4, 4) : rng.float(0.25, 0.9));
      gain += value;
      if (viral) notes.push('A clip of you went viral.');
    }
  }

  if (input.showcaseActions > 0) {
    for (let i = 0; i < input.showcaseActions; i++) {
      gain += HYPE.SHOWCASE_BASE * rng.float(0.6, 1.4);
    }
    notes.push('Ran the showcase circuit.');
  }

  gain *= exposure;
  if (input.livePeriod) gain *= HYPE.LIVE_PERIOD_MULTIPLIER;

  const decayed = input.hype * HYPE.MONTHLY_DECAY;
  const hype = clamp(decayed + gain, HYPE.MIN, HYPE.MAX);

  return { hype, notes };
}

/**
 * Which circuit will take you each spring. Talent opens the door; money
 * decides whether you can walk through it (SPEC §4: AAU fees gate on income).
 */
export function offeredAauTier(
  hype: number,
  nationalRank: number,
  income: IncomeTier,
  money: number,
): AauTier {
  const affordable = (tier: AauTier) =>
    money >= AAU_COST[tier] || income === 'affluent';

  const merited: AauTier =
    nationalRank <= 60 || hype >= 70
      ? 'nike'
      : nationalRank <= 150 || hype >= 55
        ? 'adidas'
        : nationalRank <= 280 || hype >= 38
          ? 'ua'
          : 'unaffiliated';

  const ladder: AauTier[] = ['nike', 'adidas', 'ua', 'unaffiliated', 'none'];
  const start = ladder.indexOf(merited);
  for (let i = start; i < ladder.length; i++) {
    const tier = ladder[i] as AauTier;
    if (tier === 'none' || affordable(tier)) return tier;
  }
  return 'none';
}
