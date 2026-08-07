import type { School, SchoolTier } from './types';

/**
 * High school choice (SPEC §8).
 *
 * The three options are meant to be a genuine strategic fork rather than a
 * difficulty slider: the powerhouse buries you on the bench but is seen by
 * everyone, the local public school hands you 30 a game that nobody watches,
 * and prep sits in between with the best coaching.
 */

export const SCHOOLS: Record<SchoolTier, School> = {
  powerhouse: {
    tier: 'powerhouse',
    name: 'Saint Anselm Prep',
    blurb:
      'National schedule, four D1 signees on the roster already. You will not start as a freshman, and your counting stats will look bad — but everyone is watching.',
    teamStrength: 82,
    rosterDepth: 70,
    exposureMultiplier: 1.9,
    coachQuality: 85,
    scheduleStrength: 76,
    startingTrust: 28,
  },
  public: {
    tier: 'public',
    name: 'Gary Lincoln High',
    blurb:
      'You are the best player in the building on day one. You will get every shot you want. Nobody with a clipboard is going to see it.',
    teamStrength: 45,
    rosterDepth: 36,
    exposureMultiplier: 0.75,
    coachQuality: 44,
    scheduleStrength: 44,
    startingTrust: 62,
  },
  prep: {
    tier: 'prep',
    name: 'Ridgeline Academy',
    blurb:
      'A development school. Real coaching, real weight room, a schedule with some teeth. You will have to earn minutes, but you will get better faster.',
    teamStrength: 68,
    rosterDepth: 62,
    exposureMultiplier: 1.35,
    coachQuality: 76,
    scheduleStrength: 64,
    startingTrust: 42,
  },
};

export const SCHOOL_TIERS: readonly SchoolTier[] = ['powerhouse', 'public', 'prep'];

export function schoolFor(tier: SchoolTier): School {
  return SCHOOLS[tier];
}
