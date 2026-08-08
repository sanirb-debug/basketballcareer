import { clamp, type Rng } from './rng';
import type {
  FamilyStructure,
  Person,
  PersonRole,
  RelationshipId,
} from './types';

/**
 * The people in a career (SPEC §6).
 *
 * The spec asks for "a BitLife-style interaction menu per relationship", which
 * means the people have to be *people* — named, aged, and individually
 * tracked — rather than a category with a bar next to it. Your mother is
 * Denise, she is 41, and she has her own opinion of you.
 *
 * The abstract `relationships` record is still the thing events read; it is
 * kept as the aggregate of the individuals underneath it.
 */

const FIRST_M = [
  'Marcus', 'Andre', 'Terrance', 'Damon', 'Wesley', 'Curtis', 'Reggie',
  'Lamar', 'Otis', 'Vernon', 'Clyde', 'Dwayne', 'Rodney', 'Baxter', 'Emmett',
];
const FIRST_F = [
  'Denise', 'Yolanda', 'Charlene', 'Rochelle', 'Vivian', 'Marlene', 'Paulette',
  'Deborah', 'Sandra', 'Gwen', 'Loretta', 'Camille', 'Estelle', 'Renata',
];
const FIRST_ANY = [
  'Jordan', 'Casey', 'Devin', 'Riley', 'Elliot', 'Quinn', 'Micah', 'Sydney',
  'Cameron', 'Alexis', 'Bailey', 'Rowan', 'Nico', 'Sasha', 'Tatum',
];
const LAST = [
  'Whitfield', 'Bledsoe', 'Ferrell', 'Sampson', 'Vaughn', 'Delgado', 'Mensah',
  'Pritchard', 'Calhoun', 'Bannister', 'Steward', 'Hollins', 'Dunlap',
  'Kessler', 'Roundtree', 'Winslow', 'Crowder', 'Trotter', 'Redmond', 'Landry',
];

export const ROLE_LABEL: Record<PersonRole, string> = {
  father: 'Father',
  mother: 'Mother',
  sibling: 'Sibling',
  friend: 'Friend',
  partner: 'Partner',
  fling: 'Seeing',
  ex: 'Ex',
  coach: 'Coach',
  trainer: 'Trainer',
  teammate: 'Teammate',
  agent: 'Agent',
  child: 'Child',
  rival: 'Rival',
};

/** Which aggregate bucket a person feeds (SPEC §6's relationship categories). */
export const ROLE_CATEGORY: Record<PersonRole, RelationshipId> = {
  father: 'parents',
  mother: 'parents',
  sibling: 'parents',
  friend: 'friends',
  partner: 'girlfriend',
  fling: 'girlfriend',
  ex: 'friends',
  coach: 'hsCoach',
  trainer: 'trainer',
  teammate: 'friends',
  agent: 'trainer',
  child: 'parents',
  rival: 'friends',
};

function nameFor(rng: Rng, role: PersonRole, surname: string): string {
  const pool =
    role === 'father'
      ? FIRST_M
      : role === 'mother'
        ? FIRST_F
        : FIRST_ANY;
  const first = rng.pick(pool);
  // Friends, partners and teammates are not related to you.
  const keepsSurname =
    role === 'father' || role === 'mother' || role === 'sibling';
  return `${first} ${keepsSurname ? surname : rng.pick(LAST)}`;
}

export function makePerson(
  rng: Rng,
  role: PersonRole,
  surname: string,
  options: { age: number; relationship: number; name?: string },
): Person {
  return {
    id: `${role}-${Math.floor(rng.next() * 1e9).toString(36)}`,
    name: options.name ?? nameFor(rng, role, surname),
    role,
    age: options.age,
    relationship: clamp(options.relationship, 0, 100),
    alive: true,
    active: true,
    lastInteractionMonth: -1,
    interactionsThisMonth: 0,
  };
}

/** The household a career starts in, built from the origin roll. */
export function initialPeople(
  rng: Rng,
  playerName: string,
  family: FamilyStructure,
): Person[] {
  const surname = playerName.trim().split(/\s+/).slice(-1)[0] || 'Vale';
  const people: Person[] = [];

  if (family !== 'guardian') {
    people.push(
      makePerson(rng, 'mother', surname, {
        age: rng.int(31, 46),
        relationship: family === 'single-parent' ? 82 : 76,
      }),
    );
  }
  if (family === 'two-parent') {
    people.push(
      makePerson(rng, 'father', surname, {
        age: rng.int(33, 49),
        relationship: 74,
      }),
    );
  }
  if (family === 'guardian') {
    people.push(
      makePerson(rng, 'mother', surname, {
        age: rng.int(52, 68),
        relationship: 70,
        name: `${rng.pick(FIRST_F)} ${surname}`,
      }),
    );
  }

  const siblings = rng.int(0, 2);
  for (let i = 0; i < siblings; i++) {
    people.push(
      makePerson(rng, 'sibling', surname, {
        age: rng.int(8, 19),
        relationship: rng.int(50, 85),
      }),
    );
  }

  const friends = rng.int(1, 2);
  for (let i = 0; i < friends; i++) {
    people.push(
      makePerson(rng, 'friend', surname, {
        age: rng.int(12, 14),
        relationship: rng.int(55, 80),
      }),
    );
  }

  return people;
}

// --- Interactions ---------------------------------------------------------

export type InteractionId =
  | 'talk'
  | 'compliment'
  | 'spendTime'
  | 'gift'
  | 'advice'
  | 'argue'
  | 'dateNight'
  | 'stayIn'
  | 'commit'
  | 'breakUp';

export interface InteractionDef {
  id: InteractionId;
  label: string;
  detail: string;
  /** Dollars it costs to do. */
  cost: number;
  /** Roles this is offered for. Empty means everyone. */
  roles?: PersonRole[];
  /** Gate for anything that belongs to an adult life. */
  minAge?: number;
}

export const INTERACTIONS: InteractionDef[] = [
  { id: 'talk', label: 'Conversation', detail: 'Catch up properly.', cost: 0 },
  { id: 'compliment', label: 'Compliment', detail: 'Say the nice thing out loud.', cost: 0 },
  { id: 'spendTime', label: 'Spend time', detail: 'An afternoon that is not about basketball.', cost: 0 },
  { id: 'gift', label: 'Gift', detail: 'Turn up with something.', cost: 120 },
  {
    id: 'advice',
    label: 'Ask for advice',
    detail: 'They have seen more than you have.',
    cost: 0,
    roles: ['father', 'mother', 'coach', 'trainer', 'agent'],
  },
  { id: 'argue', label: 'Argue', detail: 'Say the thing you have been holding.', cost: 0 },
  {
    id: 'dateNight',
    label: 'Date night',
    detail: 'Somewhere with tablecloths.',
    cost: 90,
    roles: ['partner', 'fling'],
  },
  {
    id: 'stayIn',
    label: 'Stay in',
    detail: 'No cameras, no reservation, nowhere to be.',
    cost: 0,
    roles: ['partner', 'fling'],
    minAge: 18,
  },
  {
    id: 'commit',
    label: 'Make it serious',
    detail: 'Say the thing out loud and mean it.',
    cost: 0,
    roles: ['fling'],
    minAge: 18,
  },
  {
    id: 'breakUp',
    label: 'End it',
    detail: 'Say it to their face.',
    cost: 0,
    roles: ['partner', 'fling'],
  },
];

export function interactionsFor(
  role: PersonRole,
  ageYears = 99,
): InteractionDef[] {
  return INTERACTIONS.filter(
    (i) =>
      (!i.roles || i.roles.includes(role)) && ageYears >= (i.minAge ?? 0),
  );
}

export interface InteractionResult {
  person: Person;
  /** Change to the aggregate relationship bucket. */
  categoryDelta: number;
  moneyDelta: number;
  energyDelta: number;
  /** Nights in with someone pull you back toward the middle. */
  distractionDelta: number;
  outcome: string;
  /** Set when the person should be moved to ex / removed. */
  ended: boolean;
  /** Set when a fling became something you would call by a name. */
  committed: boolean;
}

/**
 * How much the *n*-th visit of the month is worth.
 *
 * There is no cap on interactions — this is a life, not a turn economy, and
 * you can call your mother every day of March if that is who you are. What
 * there is instead is honesty about it: the fourth conversation in a month is
 * not worth what the first was, and the tenth is worth almost nothing. Money
 * costs, by contrast, are charged in full every single time, which is what
 * stops "buy her nine gifts" from being a strategy.
 */
export const INTERACTION_FALLOFF = 0.55;

export function repeatValue(repeats: number): number {
  return Math.pow(INTERACTION_FALLOFF, Math.max(0, repeats));
}

/**
 * Resolve one interaction.
 *
 * Deliberately not uniformly positive — arguing is available precisely so it
 * can cost you, and a gift from someone who never visits lands differently
 * from one who does.
 */
export function interact(
  person: Person,
  interaction: InteractionId,
  monthsElapsed: number,
  rng: Rng,
): InteractionResult {
  // Repeats inside the same month walk down the curve. The first one is
  // full price; everything after is the same gesture getting quieter.
  const repeats =
    person.lastInteractionMonth === monthsElapsed
      ? person.interactionsThisMonth
      : 0;
  const falloff = repeatValue(repeats);

  const base = (amount: number) =>
    clamp((amount + rng.float(-1.5, 1.5)) * falloff, -40, 40);

  const touch = (
    delta: number,
    outcome: string,
    extra: Partial<InteractionResult> = {},
  ): InteractionResult => ({
    person: {
      ...person,
      relationship: clamp(person.relationship + delta, 0, 100),
      lastInteractionMonth: monthsElapsed,
      interactionsThisMonth: repeats + 1,
    },
    categoryDelta: delta * 0.5,
    moneyDelta: 0,
    energyDelta: 0,
    distractionDelta: 0,
    outcome,
    ended: false,
    committed: false,
    ...extra,
  });

  // Said out loud once the gesture has stopped meaning anything, so the
  // player can see the curve rather than having to infer it.
  const thin = repeats >= 3;

  switch (interaction) {
    case 'talk':
      return touch(
        base(5),
        thin
          ? `${person.name} has heard most of this already today.`
          : `You and ${person.name} actually talked.`,
      );

    case 'compliment': {
      // Constant flattery stops landing.
      const worn = person.relationship > 85 || thin;
      return touch(
        worn ? base(1) : base(6),
        worn
          ? `${person.name} smiled and changed the subject.`
          : `${person.name} needed to hear that.`,
      );
    }

    case 'spendTime':
      return touch(
        base(9),
        thin
          ? `Another afternoon with ${person.name}. Comfortable, and quiet.`
          : `You spent real time with ${person.name}.`,
        { energyDelta: -4, distractionDelta: -1 },
      );

    case 'gift':
      return touch(
        base(11),
        thin
          ? `${person.name} thanked you and set it down with the others.`
          : `${person.name} was not expecting a gift.`,
        { moneyDelta: -120 },
      );

    case 'advice':
      return touch(
        base(6),
        thin
          ? `${person.name} told you the same thing, more slowly.`
          : `${person.name} told you something worth keeping.`,
      );

    case 'argue': {
      const bad = rng.chance(0.75);
      return touch(
        bad ? base(-16) : base(-4),
        bad
          ? `It turned into a real argument with ${person.name}.`
          : `You said your piece to ${person.name} and it was fine.`,
      );
    }

    case 'dateNight':
      return touch(base(14), `A proper night out with ${person.name}.`, {
        moneyDelta: -90,
        energyDelta: -5,
      });

    case 'stayIn':
      // Deliberately the *opposite* of a night out: it is the one thing on
      // any menu in this game that lowers distraction and raises the
      // relationship at the same time. Staying home with someone who knows
      // you is how players survive a decade of this.
      return touch(
        base(12),
        thin
          ? `Another quiet one in with ${person.name}. Nobody is counting.`
          : `A night in with ${person.name}. Phone face down, nowhere to be.`,
        { energyDelta: 3, distractionDelta: -7 },
      );

    case 'commit':
      return {
        person: {
          ...person,
          role: 'partner',
          exclusive: true,
          relationship: clamp(person.relationship + 12, 0, 100),
          lastInteractionMonth: monthsElapsed,
          interactionsThisMonth: repeats + 1,
        },
        categoryDelta: 10,
        moneyDelta: 0,
        energyDelta: 0,
        distractionDelta: -10,
        outcome: `You and ${person.name} stopped pretending it was casual.`,
        ended: false,
        committed: true,
      };

    case 'breakUp':
      return {
        person: {
          ...person,
          role: 'ex',
          exclusive: false,
          relationship: clamp(person.relationship - 45, 0, 100),
          lastInteractionMonth: monthsElapsed,
          interactionsThisMonth: repeats + 1,
        },
        categoryDelta: -25,
        moneyDelta: 0,
        energyDelta: 0,
        distractionDelta: 4,
        outcome: `You and ${person.name} are done.`,
        ended: true,
        committed: false,
      };
  }
}

/**
 * Whether this person is reachable at all.
 *
 * There is no per-month limit any more — the only people you cannot go to are
 * the ones who are gone.
 */
export function canInteract(person: Person): boolean {
  return person.alive && person.active;
}

/** People drift apart when nothing is done about it (SPEC §6). */
export function agePeople(people: Person[], monthsElapsed: number): Person[] {
  return people.map((person) => {
    if (!person.alive) return person;
    const neglected = monthsElapsed - person.lastInteractionMonth > 6;
    return {
      ...person,
      // A year of months; ages tick over annually.
      age: monthsElapsed % 12 === 0 ? person.age + 1 : person.age,
      relationship: clamp(person.relationship - (neglected ? 0.9 : 0.3), 0, 100),
      // A fresh month is a fresh curve.
      interactionsThisMonth: 0,
    };
  });
}
