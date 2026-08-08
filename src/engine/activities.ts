import { clamp, type Rng } from './rng';
import type {
  CareerStage,
  OwnedAsset,
  SocialAccount,
  SocialPlatformId,
} from './types';

/**
 * Things to do with a month that are not a training rep (SPEC §6, §12).
 *
 * Two systems live here:
 *
 * 1. **Assets** — what the money is actually for. Money that only accumulates
 *    is a scoreboard, not a decision, so most of the catalog buys back time:
 *    a hoop in the driveway, a trainer on retainer, recovery boots. The
 *    expensive end is pure status, which is its own reward at the pro level.
 *
 * 2. **Social** — the modern version of a mixtape. Reach is earned by playing
 *    well and posting about it, and reach feeds hype, which feeds rankings.
 *    Posting into an empty career does nothing, which is the point.
 *
 * Neither costs an action point. They are limited by money and by a one-per-
 * month cap instead, so they add texture without unbalancing SPEC §6's
 * action economy.
 */

// --- Assets ---------------------------------------------------------------

export type AssetCategory = 'gear' | 'training' | 'life';

export interface AssetDef {
  id: string;
  label: string;
  detail: string;
  category: AssetCategory;
  price: number;
  /** Earliest stage this can be bought at. */
  from?: CareerStage[];
  /** Multiplier applied to training gains while owned. */
  trainingBonus?: number;
  /** Extra energy recovered each month. */
  energyPerMonth?: number;
  /** Flat reduction to injury chance, as a multiplier. */
  injuryFactor?: number;
  /** Hype added each month just for having it. */
  hypePerMonth?: number;
  /** One-off happiness bump when bought. */
  joy?: number;
}

/**
 * Prices are deliberately spread so the catalog stays live across the whole
 * career: a $40 ball matters at fourteen, a $2.4M house matters at twenty-six.
 */
export const ASSETS: AssetDef[] = [
  // Gear — cheap, small, available immediately.
  {
    id: 'ball',
    label: 'Your own ball',
    detail: 'Properly inflated, and nobody else takes it home.',
    category: 'gear',
    price: 45,
    trainingBonus: 1.03,
  },
  {
    id: 'shoes',
    label: 'Real basketball shoes',
    detail: 'The ankles will thank you in about four years.',
    category: 'gear',
    price: 160,
    injuryFactor: 0.94,
  },
  {
    id: 'ropes',
    label: 'Jump rope and bands',
    detail: 'Twelve dollars of equipment that actually works.',
    category: 'gear',
    price: 60,
    trainingBonus: 1.03,
  },
  {
    id: 'recovery-boots',
    label: 'Recovery boots',
    detail: 'Compression after every session. Boring, effective.',
    category: 'gear',
    price: 1200,
    energyPerMonth: 4,
    injuryFactor: 0.93,
  },
  {
    id: 'sleep-tracker',
    label: 'Sleep tracking',
    detail: 'It turns out you were getting five hours.',
    category: 'gear',
    price: 350,
    energyPerMonth: 3,
  },

  // Training — the real money sink of the amateur years.
  {
    id: 'driveway-hoop',
    label: 'Hoop in the driveway',
    detail: 'Reps at eleven at night, in the rain, in December.',
    category: 'training',
    price: 900,
    trainingBonus: 1.08,
  },
  {
    id: 'gym-membership',
    label: 'Gym membership',
    detail: 'A weight room that is not the school one.',
    category: 'training',
    price: 600,
    trainingBonus: 1.06,
  },
  {
    id: 'shooting-machine',
    label: 'Shooting machine',
    detail: 'Six hundred shots an hour instead of one hundred.',
    category: 'training',
    price: 8500,
    trainingBonus: 1.14,
  },
  {
    id: 'private-trainer',
    label: 'Trainer on retainer',
    detail: 'Someone whose job is your jumper.',
    category: 'training',
    price: 24000,
    trainingBonus: 1.18,
    energyPerMonth: 2,
  },
  {
    id: 'home-gym',
    label: 'Home gym',
    detail: 'Full court, full rack, nobody scheduling you around.',
    category: 'training',
    price: 420000,
    from: ['college', 'overseas', 'developmental', 'nba'],
    trainingBonus: 1.22,
    energyPerMonth: 5,
    injuryFactor: 0.9,
  },
  {
    id: 'chef',
    label: 'Private chef',
    detail: 'You stop eating gas station food on road trips.',
    category: 'training',
    price: 95000,
    from: ['overseas', 'developmental', 'nba'],
    energyPerMonth: 6,
    injuryFactor: 0.92,
  },

  // Life — status, joy, and the thing everyone says they will do.
  {
    id: 'first-car',
    label: 'First car',
    detail: 'It is not good. It is yours.',
    category: 'life',
    price: 4200,
    joy: 8,
  },
  {
    id: 'moms-house',
    label: 'Buy your mother a house',
    detail: 'The one you told her about when you were fourteen.',
    category: 'life',
    price: 640000,
    from: ['overseas', 'developmental', 'nba'],
    joy: 30,
    hypePerMonth: 0.4,
  },
  {
    id: 'condo',
    label: 'Downtown condo',
    detail: 'Nine minutes from the arena.',
    category: 'life',
    price: 780000,
    from: ['overseas', 'developmental', 'nba'],
    joy: 12,
  },
  {
    id: 'sports-car',
    label: 'The car',
    detail: 'The one from the poster on your wall.',
    category: 'life',
    price: 310000,
    from: ['college', 'overseas', 'developmental', 'nba'],
    joy: 14,
    hypePerMonth: 0.3,
  },
  {
    id: 'estate',
    label: 'The house',
    detail: 'Gated, absurd, and photographed from a helicopter once.',
    category: 'life',
    price: 6400000,
    from: ['nba'],
    joy: 18,
    hypePerMonth: 0.6,
  },
  {
    id: 'charity',
    label: 'Start a foundation',
    detail: 'Courts resurfaced in the neighbourhood you came from.',
    category: 'life',
    price: 1500000,
    from: ['overseas', 'developmental', 'nba'],
    joy: 26,
    hypePerMonth: 0.8,
  },
];

export function assetById(id: string): AssetDef | undefined {
  return ASSETS.find((a) => a.id === id);
}

export function canBuy(
  def: AssetDef,
  owned: OwnedAsset[],
  money: number,
  stage: CareerStage,
): { ok: boolean; reason?: string } {
  if (owned.some((o) => o.id === def.id)) {
    return { ok: false, reason: 'Already owned' };
  }
  if (def.from && !def.from.includes(stage)) {
    return { ok: false, reason: 'Not yet' };
  }
  if (money < def.price) {
    return { ok: false, reason: `Need $${(def.price - money).toLocaleString()} more` };
  }
  return { ok: true };
}

/** The combined effect of everything owned, recomputed rather than stored. */
export interface AssetEffects {
  trainingBonus: number;
  energyPerMonth: number;
  injuryFactor: number;
  hypePerMonth: number;
}

export function assetEffects(owned: OwnedAsset[]): AssetEffects {
  const effects: AssetEffects = {
    trainingBonus: 1,
    energyPerMonth: 0,
    injuryFactor: 1,
    hypePerMonth: 0,
  };

  for (const item of owned) {
    const def = assetById(item.id);
    if (!def) continue;
    effects.trainingBonus *= def.trainingBonus ?? 1;
    effects.energyPerMonth += def.energyPerMonth ?? 0;
    effects.injuryFactor *= def.injuryFactor ?? 1;
    effects.hypePerMonth += def.hypePerMonth ?? 0;
  }

  // Stacking multipliers has to stay bounded or a rich player trains at 2x.
  effects.trainingBonus = Math.min(effects.trainingBonus, 1.45);
  effects.injuryFactor = Math.max(effects.injuryFactor, 0.72);
  effects.energyPerMonth = Math.min(effects.energyPerMonth, 14);

  return effects;
}

// --- Social ---------------------------------------------------------------

export interface SocialPlatformDef {
  id: SocialPlatformId;
  label: string;
  detail: string;
  /** How fast followers compound here. */
  growth: number;
  /** How much a viral post is worth. */
  virality: number;
}

export const PLATFORMS: SocialPlatformDef[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    detail: 'Highlights, fits, and the occasional gym selfie.',
    growth: 1,
    virality: 1,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    detail: 'Where a single crossover can outrun your actual résumé.',
    growth: 1.35,
    virality: 1.8,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    detail: 'Mixtapes, full games, and a documentary nobody asked for.',
    growth: 0.8,
    virality: 1.3,
  },
  {
    id: 'x',
    label: 'X',
    detail: 'Talk. It travels fast in both directions.',
    growth: 0.9,
    virality: 1.1,
  },
  {
    id: 'twitch',
    label: 'Twitch',
    detail: 'Streaming after practice. Your coach has opinions.',
    growth: 0.6,
    virality: 0.8,
  },
];

export function platformById(id: SocialPlatformId): SocialPlatformDef {
  return PLATFORMS.find((p) => p.id === id)!;
}

export function totalFollowers(accounts: SocialAccount[]): number {
  return accounts.reduce((sum, a) => sum + a.followers, 0);
}

export type PostKind = 'highlight' | 'workout' | 'callout' | 'personal';

export interface PostDef {
  id: PostKind;
  label: string;
  detail: string;
}

export const POST_KINDS: PostDef[] = [
  {
    id: 'highlight',
    label: 'Post a highlight',
    detail: 'Only works if there was a highlight.',
  },
  {
    id: 'workout',
    label: 'Post a workout',
    detail: 'Safe, steady, and coaches like seeing it.',
  },
  {
    id: 'callout',
    label: 'Talk your talk',
    detail: 'Big reach. Makes enemies. Rivals notice.',
  },
  {
    id: 'personal',
    label: 'Post something real',
    detail: 'Off the court. Slower growth, but people stay.',
  },
];

export interface PostResult {
  account: SocialAccount;
  gained: number;
  viral: boolean;
  hypeDelta: number;
  coachTrustDelta: number;
  outcome: string;
}

/**
 * Resolve one post.
 *
 * Reach is downstream of results, not a substitute for them: `performance` is
 * the recent on-court signal, and a highlight post with nothing behind it
 * grows almost nothing. Talking is the exception — it travels regardless, and
 * charges you for it elsewhere.
 */
export function post(
  account: SocialAccount,
  kind: PostKind,
  context: { performance: number; hype: number; monthsElapsed: number },
  rng: Rng,
): PostResult {
  const platform = platformById(account.id);
  const { performance, hype } = context;

  // A floor so a brand-new account can actually start moving.
  const base = Math.max(account.followers, 240);

  const quality =
    kind === 'highlight'
      ? clamp(performance / 60, 0.15, 2.2)
      : kind === 'workout'
        ? 0.55
        : kind === 'callout'
          ? 1.3
          : 0.7;

  const hypePull = 1 + clamp(hype, 0, 100) / 90;
  const viralChance = clamp(
    0.04 + (performance / 100) * 0.14 * platform.virality * (kind === 'callout' ? 1.6 : 1),
    0.02,
    0.4,
  );
  const viral = rng.chance(viralChance);

  const rate =
    0.035 * platform.growth * quality * hypePull * (viral ? 9 * platform.virality : 1);
  const gained = Math.max(
    viral ? 500 : 15,
    Math.round(base * rate * rng.float(0.75, 1.3)),
  );

  const followers = account.followers + gained;

  // Reach feeds hype, but with heavy diminishing returns — a million
  // followers is not a scholarship (SPEC §12).
  const hypeDelta =
    Math.log10(1 + gained / 900) * (kind === 'callout' ? 1.5 : 1) * (viral ? 2.2 : 1);

  const coachTrustDelta =
    kind === 'callout' ? -(viral ? 2.5 : 1.2) : kind === 'workout' ? 0.4 : 0;

  const outcome = viral
    ? kind === 'callout'
      ? `It went everywhere. Not all of it was friendly. +${gained.toLocaleString()} followers.`
      : `It broke out. +${gained.toLocaleString()} followers on ${platform.label}.`
    : `+${gained.toLocaleString()} followers on ${platform.label}.`;

  return {
    account: {
      ...account,
      followers,
      lastPostMonth: context.monthsElapsed,
      viralPosts: account.viralPosts + (viral ? 1 : 0),
    },
    gained,
    viral,
    hypeDelta,
    coachTrustDelta,
    outcome,
  };
}

/** One post per platform per month. */
export function canPost(
  account: SocialAccount,
  monthsElapsed: number,
): boolean {
  return account.lastPostMonth !== monthsElapsed;
}

/**
 * Followers drift when you go quiet, and compound slowly when the career
 * itself is going well.
 */
export function driftFollowers(
  accounts: SocialAccount[],
  monthsElapsed: number,
  hype: number,
): SocialAccount[] {
  return accounts.map((account) => {
    const quiet = monthsElapsed - account.lastPostMonth;
    const organic = (clamp(hype, 0, 100) / 100) * 0.02;
    const decay = quiet > 3 ? 0.012 : 0;
    const factor = 1 + organic - decay;
    return {
      ...account,
      followers: Math.max(0, Math.round(account.followers * factor)),
    };
  });
}

export function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
