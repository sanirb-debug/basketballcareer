import type { School, SchoolTier } from './types';
import { countryById, isUSA } from './countries';

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

export function middleSchoolNameFor(city: string, country?: string): string {
  const town = city.trim() || 'Town';
  if (!country || isUSA(country)) return `${town} Middle School`;
  return `${town} Secondary School`;
}

/**
 * The same three-way fork, told in the right country (SPEC §4, §8).
 *
 * The mechanics do not change — a powerhouse is still the crowded roster
 * everybody watches — but the fiction has to. A fourteen-year-old in
 * Kathmandu is not enrolling at Gary Lincoln High, and shipping him there
 * with an American school name was the giveaway that nationality had been
 * bolted on rather than built in.
 *
 * The interesting one is `prep`. For an American it is a development school
 * down the road. For everybody else it is the decision to leave — and it is
 * the only way out of the exposure penalty your country carries, which is
 * exactly the trade real international prospects face at fifteen.
 */
function localize(tier: SchoolTier, city: string, country: string): Partial<School> {
  const c = countryById(country);
  const town = city.trim() || c.name;

  switch (tier) {
    case 'powerhouse':
      return {
        name: `${town} Basketball Academy`,
        blurb: `The national programme's academy. The best young players in ${c.name} are already here, the coaching is real, and you will not start immediately — but this is the roster the federation actually watches.`,
      };
    case 'public':
      return {
        name: `${town} Secondary School`,
        blurb: `You are the best player in the building on day one, and you will get every shot you want. Nobody who matters is going to see a minute of it.`,
      };
    case 'prep':
      return {
        name: 'Ridgeline Academy (USA)',
        blurb: `Leave. A prep school in the States takes you at fifteen, and you will be four thousand miles from everyone you know. It is the only road that gets you in front of the people who decide these things — and your mother will not say a word about what it costs her.`,
      };
  }
}

export function schoolFor(
  tier: SchoolTier,
  options: { name?: string; city?: string; country?: string } = {},
): School {
  const base = SCHOOLS[tier];
  const country = options.country ?? 'usa';
  const local = isUSA(country)
    ? {}
    : localize(tier, options.city ?? '', country);

  return {
    ...base,
    ...local,
    // A typed-in name replaces the default but keeps the tier's character.
    name: options.name?.trim() || local.name || base.name,
    middleSchoolName: middleSchoolNameFor(options.city ?? '', country),
  };
}

/** Choosing to move abroad is choosing to be seen (SPEC §4). */
export function movesAbroad(tier: SchoolTier, country: string): boolean {
  return tier === 'prep' && !isUSA(country);
}
