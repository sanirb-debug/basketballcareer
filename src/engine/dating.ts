import { clamp, type Rng } from './rng';
import type {
  CareerStage,
  DatingCandidate,
  Person,
  RomanceStage,
} from './types';
import { romanceAtLeast } from './types';

/**
 * Dating, and everything downstream of it (SPEC §6).
 *
 * The design brief here is the same one the rest of the life layer runs on:
 * these are decisions with consequences, not a collection screen. So —
 *
 * - **The pool is small and it refreshes.** You do not shop for a perfect
 *   match out of four hundred options; you meet who is around this month.
 *   `compatibility` is hidden, which is the entire drama of dating.
 * - **Progression is earned, not bought.** Flirting → dating → exclusive →
 *   engaged → married, each gated on the relationship number and on time.
 *   You cannot propose to somebody you met in March.
 * - **The private stuff is modelled by its consequences.** What the engine
 *   tracks is the relationship, the risk, and what a child does to a career.
 *   Everything else is a fade to black and a line of copy.
 *
 * Every function here is gated at `ROMANCE_MIN_AGE`. The career starts at
 * thirteen and none of this exists before eighteen.
 */

export const ROMANCE_MIN_AGE = 18;

export function romanceUnlocked(ageYears: number): boolean {
  return ageYears >= ROMANCE_MIN_AGE;
}

// --- The pool -------------------------------------------------------------

const FIRST = [
  'Simone', 'Naomi', 'Adrienne', 'Priya', 'Camila', 'Jaya', 'Erin', 'Talia',
  'Noor', 'Bianca', 'Marisol', 'Devon', 'Alexis', 'Rowan', 'Jules', 'Sasha',
  'Imani', 'Delphine', 'Odette', 'Rae', 'Nadia', 'Solange', 'Wren', 'Zoe',
];
const LAST = [
  'Okafor', 'Reyes', 'Beaumont', 'Nakamura', 'Aldridge', 'Sorenson', 'Cruz',
  'Whitlock', 'Amara', 'Petrov', 'Castellanos', 'Byrne', 'Osei', 'Vaziri',
  'Lindqvist', 'Moreau', 'Ferrante', 'Kwan', 'Delacroix', 'Abara',
];

/**
 * Where you met, which is most of what you know about somebody at first.
 *
 * Weighted by stage — a college junior meets people in a lecture hall, a
 * seven-year pro meets them at a charity gala and can never quite tell who is
 * there for him and who is there for the room.
 */
interface Venue {
  via: string;
  stages?: CareerStage[];
  /** Bias on how into you they already are. */
  interestBias: number;
  /** Bias on whether it actually works. */
  compatibilityBias: number;
}

const VENUES: Venue[] = [
  { via: 'through a teammate', interestBias: 4, compatibilityBias: 6 },
  { via: 'at the gym', interestBias: 0, compatibilityBias: 8 },
  { via: 'through your sister', interestBias: 2, compatibilityBias: 10 },
  { via: 'in a class', stages: ['college', 'juco'], interestBias: -2, compatibilityBias: 12 },
  { via: 'on campus', stages: ['college', 'juco'], interestBias: 3, compatibilityBias: 6 },
  { via: 'at a party', interestBias: 10, compatibilityBias: -6 },
  { via: 'on an app', interestBias: 6, compatibilityBias: -2 },
  { via: 'courtside', stages: ['nba'], interestBias: 18, compatibilityBias: -14 },
  { via: 'at a charity thing', stages: ['nba', 'overseas'], interestBias: 12, compatibilityBias: 0 },
  { via: 'at the hotel bar on a road trip', stages: ['nba', 'overseas', 'developmental'], interestBias: 14, compatibilityBias: -12 },
  { via: 'back home, over the summer', interestBias: 5, compatibilityBias: 16 },
];

/**
 * One line about who somebody is.
 *
 * Written to be specific rather than flattering — the point is that these are
 * people with their own lives, some of which do not have room for yours.
 */
const BLURBS = [
  'A nurse, three years into nights, who has never once asked what your contract is.',
  'Doing a master’s in something you have had explained to you twice.',
  'Runs a bakery that opens at four in the morning. Will not be moving cities.',
  'A photographer. Half of what she says is a joke you get about a minute late.',
  'Grew up two streets over and remembers you before any of this.',
  'Works in the front office of a team that is not yours. Everybody thinks that is funnier than it is.',
  'Very online, very funny, and very aware of what dating you would do to that.',
  'Teaches sixth grade. Unimpressed by athletes as a category.',
  'A lawyer who works more hours than you do and does not apologise for it.',
  'Just moved here and knows exactly nobody, which she says is the appeal.',
  'A dancer. Understands what a body costs better than most of your teammates.',
  'Wants four kids and mentioned it on the first night, which you appreciated.',
  'Somebody’s cousin. Everyone involved is pretending this was not arranged.',
  'Been in the room with famous people her whole life and finds it boring.',
  'A trainer at a rival programme. This is going to come up eventually.',
];

export function generateCandidates(
  rng: Rng,
  context: { stage: CareerStage; ageYears: number; fame: number },
  count = 3,
): DatingCandidate[] {
  const pool = VENUES.filter(
    (v) => !v.stages || v.stages.includes(context.stage),
  );
  const out: DatingCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const venue = rng.pick(pool);
    // Fame opens the door and narrows the room at the same time: more people
    // are interested, fewer of them are interested in you.
    const interest = clamp(
      rng.normal(38 + context.fame * 0.28 + venue.interestBias, 14),
      5,
      95,
    );
    const compatibility = clamp(
      rng.normal(52 + venue.compatibilityBias - context.fame * 0.12, 17),
      5,
      98,
    );

    out.push({
      id: `cand-${Math.floor(rng.next() * 1e9).toString(36)}`,
      name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
      age: Math.max(
        ROMANCE_MIN_AGE,
        Math.round(context.ageYears + rng.float(-3, 6)),
      ),
      metVia: venue.via,
      blurb: rng.pick(BLURBS),
      interest: Math.round(interest),
      compatibility: Math.round(compatibility),
    });
  }

  return out;
}

/** Whether asking somebody out lands. */
export function askOutChance(
  candidate: DatingCandidate,
  fame: number,
  charisma: number,
): number {
  return clamp(
    candidate.interest / 130 + fame / 420 + charisma / 500,
    0.08,
    0.95,
  );
}

// --- Dates ----------------------------------------------------------------

export type DateId =
  | 'coffee'
  | 'dinner'
  | 'courtside'
  | 'weekendAway'
  | 'meetTheFamily';

export interface DateDef {
  id: DateId;
  label: string;
  detail: string;
  cost: number;
  energy: number;
  /** Relationship it moves on a good night. */
  warmth: number;
  /** How public it is — feeds the tabloid roll. */
  exposure: number;
  /** Minimum stage this is available at. */
  requires: RomanceStage;
  /** Relationship floor, because some things you have to earn. */
  minRelationship?: number;
}

export const DATES: DateDef[] = [
  {
    id: 'coffee',
    label: 'Coffee',
    detail: 'Forty minutes, no stakes, and you find out whether there is anything to talk about.',
    cost: 25,
    energy: 3,
    warmth: 6,
    exposure: 0.2,
    requires: 'flirting',
  },
  {
    id: 'dinner',
    label: 'Dinner',
    detail: 'A real reservation, a real conversation, and the check arriving too early.',
    cost: 180,
    energy: 6,
    warmth: 11,
    exposure: 0.7,
    requires: 'flirting',
  },
  {
    id: 'courtside',
    label: 'Bring them to a game',
    detail: 'Two seats behind the bench. Everybody sees it, which is either the point or the problem.',
    cost: 900,
    energy: 5,
    warmth: 14,
    exposure: 2.2,
    requires: 'dating',
  },
  {
    id: 'weekendAway',
    label: 'A weekend away',
    detail: 'Somewhere with no flight connections and nobody who follows the league.',
    cost: 4800,
    energy: 12,
    warmth: 22,
    exposure: 0.9,
    requires: 'dating',
    minRelationship: 55,
  },
  {
    id: 'meetTheFamily',
    label: 'Take them home',
    detail: 'Your mother has been asking. This is not a small thing and everyone in the room knows it.',
    cost: 400,
    energy: 8,
    warmth: 18,
    exposure: 0.3,
    requires: 'exclusive',
    minRelationship: 65,
  },
];

export function datesFor(person: Person, relationship: number): DateDef[] {
  return DATES.filter(
    (d) =>
      romanceAtLeast(person.romance, d.requires) &&
      relationship >= (d.minRelationship ?? 0),
  );
}

// --- The private part -----------------------------------------------------

export type IntimacyId = 'careful' | 'carriedAway';

export interface IntimacyDef {
  id: IntimacyId;
  label: string;
  detail: string;
  /** Chance of a pregnancy per occasion. */
  risk: number;
}

/**
 * Two options, and the difference between them is the entire mechanic.
 *
 * Nothing here is described beyond the door closing. What the game models is
 * what happens next — which, in a sport where the average career is four and
 * a half years, is frequently the most consequential thing a player does with
 * an evening.
 */
export const INTIMACY: IntimacyDef[] = [
  {
    id: 'careful',
    label: 'Stay the night',
    detail: 'You are both grown, and you are both careful about it.',
    // Careful is not certain. Nothing is.
    risk: 0.012,
  },
  {
    id: 'carriedAway',
    label: 'Do not think about it',
    detail:
      'Neither of you goes looking for the drawer. You will have the conversation about this later, one way or another.',
    risk: 0.16,
  },
];

export function intimacyById(id: IntimacyId): IntimacyDef | undefined {
  return INTIMACY.find((i) => i.id === id);
}

/** How long until the baby arrives, in months. */
export const GESTATION_MONTHS = 9;

// --- Proposing ------------------------------------------------------------

/** What a ring costs somebody at this level. Two months' money, traditionally. */
export function ringCost(money: number): number {
  return clamp(Math.round(money * 0.06), 900, 240_000);
}

export interface ProposalRequirements {
  ok: boolean;
  reason?: string;
}

export function canPropose(
  person: Person,
  monthsElapsed: number,
  money: number,
): ProposalRequirements {
  if (!romanceAtLeast(person.romance, 'exclusive')) {
    return { ok: false, reason: 'Not that serious yet' };
  }
  if (person.romance === 'engaged' || person.romance === 'married') {
    return { ok: false, reason: 'Already asked' };
  }
  if (person.relationship < 72) {
    return { ok: false, reason: 'They would say no' };
  }
  const together = monthsElapsed - (person.metMonth ?? monthsElapsed);
  if (together < 10) {
    return { ok: false, reason: 'You have known them ten minutes' };
  }
  if (money < ringCost(money)) {
    return { ok: false, reason: 'You cannot afford a ring' };
  }
  return { ok: true };
}

/**
 * Whether they say yes.
 *
 * Time together matters more than the relationship number, which is the
 * closest this engine gets to an opinion about anything.
 */
export function proposalChance(person: Person, monthsElapsed: number): number {
  const together = monthsElapsed - (person.metMonth ?? monthsElapsed);
  return clamp(
    0.2 + (person.relationship - 70) / 90 + Math.min(together, 40) / 90,
    0.15,
    0.97,
  );
}

/** A wedding costs what you let it cost. */
export const WEDDING_TIERS = [
  {
    id: 'courthouse' as const,
    label: 'The courthouse',
    detail: 'Two witnesses, twelve minutes, lunch afterwards. Nobody finds out for a week.',
    cost: 400,
    joy: 18,
    exposure: 0.1,
  },
  {
    id: 'small' as const,
    label: 'Something small',
    detail: 'Sixty people who actually know you both, in a room you can afford twice over.',
    cost: 42_000,
    joy: 30,
    exposure: 0.8,
  },
  {
    id: 'thewedding' as const,
    label: 'The wedding',
    detail: 'Four hundred guests, a magazine deal, and a cousin you have not spoken to since you were nine.',
    cost: 620_000,
    joy: 38,
    exposure: 3,
  },
];

export type WeddingTierId = (typeof WEDDING_TIERS)[number]['id'];

export function weddingTier(id: WeddingTierId) {
  return WEDDING_TIERS.find((t) => t.id === id);
}

// --- Children -------------------------------------------------------------

const CHILD_NAMES = [
  'Amari', 'Zion', 'Kai', 'Nova', 'Elias', 'Sage', 'Malachi', 'Aaliyah',
  'Reign', 'Ezra', 'Isla', 'Josiah', 'Wren', 'Cassius', 'Nyla', 'Theo',
];

export function childName(rng: Rng, surname: string): string {
  return `${rng.pick(CHILD_NAMES)} ${surname}`;
}

/**
 * What a child costs a career, monthly.
 *
 * Deliberately not only a cost. The distraction hit is real and front-loaded,
 * but a settled home is one of the few things in this engine that raises the
 * floor under everything else.
 */
export const CHILD = {
  MONTHLY_COST: 1400,
  /** Distraction added in the first year. */
  NEWBORN_DISTRACTION: 12,
  /** Distraction removed per month once past the first year. */
  SETTLED_DECAY: 2,
  JOY: 26,
} as const;

/**
 * A child before a wedding is a different story to a child after one.
 *
 * This is the scandal the sport actually has: not the child, but the way it
 * arrives — a paternity story, an agent who found out from a reporter, and a
 * relationship that either becomes serious very fast or does not.
 */
export function unmarriedPregnancyFallout(
  fame: number,
  relationship: number,
): { offCourt: number; tabloidChance: number; distraction: number } {
  return {
    offCourt: -(4 + fame * 0.08),
    tabloidChance: clamp(0.15 + fame / 160, 0.1, 0.8),
    distraction: relationship > 60 ? 8 : 18,
  };
}
