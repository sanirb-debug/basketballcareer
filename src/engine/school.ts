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
    middleSchoolName: 'Town Middle School',
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
    middleSchoolName: 'Town Middle School',
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
    middleSchoolName: 'Town Middle School',
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

/** The grade a player starts high school in. Before this, it is middle school. */
export const FIRST_HIGH_SCHOOL_GRADE = 9;

export function isMiddleSchool(grade: number): boolean {
  return grade < FIRST_HIGH_SCHOOL_GRADE;
}

/**
 * Middle school ball: a smaller gym, a worse team, and a coach who will play
 * you because there is nobody else. It is where the 8th grade year happens.
 */
export const MIDDLE_SCHOOL_TEAM = {
  teamStrength: 34,
  rosterDepth: 26,
  scheduleStrength: 33,
  coachQuality: 32,
  startingTrust: 68,
} as const;

export function middleSchoolNameFor(city: string): string {
  return `${city.trim() || 'Town'} Middle School`;
}

export function schoolFor(
  tier: SchoolTier,
  options: { name?: string; city?: string } = {},
): School {
  const base = SCHOOLS[tier];
  return {
    ...base,
    // A typed-in name replaces the default but keeps the tier's character.
    name: options.name?.trim() || base.name,
    middleSchoolName: middleSchoolNameFor(options.city ?? ''),
  };
}
