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
  ex: 'Ex',
  coach: 'Coach',
  trainer: 'Trainer',
  teammate: 'Teammate',
  agent: 'Agent',
  rival: 'Rival',
};

/** Which aggregate bucket a person feeds (SPEC §6's relationship categories). */
export const ROLE_CATEGORY: Record<PersonRole, RelationshipId> = {
  father: 'parents',
  mother: 'parents',
  sibling: 'parents',
  friend: 'friends',
  partner: 'girlfriend',
  ex: 'friends',
  coach: 'hsCoach',
  trainer: 'trainer',
  teammate: 'friends',
  agent: 'trainer',
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
  | 'breakUp';

export interface InteractionDef {
  id: InteractionId;
  label: string;
  detail: string;
  /** Dollars it costs to do. */
  cost: number;
  /** Roles this is offered for. Empty means everyone. */
  roles?: PersonRole[];
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
    roles: ['partner'],
  },
  {
    id: 'breakUp',
    label: 'Break up',
    detail: 'End it.',
    cost: 0,
    roles: ['partner'],
  },
];

export function interactionsFor(role: PersonRole): InteractionDef[] {
  return INTERACTIONS.filter((i) => !i.roles || i.roles.includes(role));
}

export interface InteractionResult {
  person: Person;
  /** Change to the aggregate relationship bucket. */
  categoryDelta: number;
  moneyDelta: number;
  energyDelta: number;
  outcome: string;
  /** Set when the person should be moved to ex / removed. */
  ended: boolean;
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
  const base = (amount: number) => clamp(amount + rng.float(-1.5, 1.5), -40, 40);
  const touch = (delta: number, outcome: string, extra: Partial<InteractionResult> = {}) => ({
    person: {
      ...person,
      relationship: clamp(person.relationship + delta, 0, 100),
      lastInteractionMonth: monthsElapsed,
    },
    categoryDelta: delta * 0.5,
    moneyDelta: 0,
    energyDelta: 0,
    outcome,
    ended: false,
    ...extra,
  });

  switch (interaction) {
    case 'talk':
      return touch(base(5), `You and ${person.name} actually talked.`);

    case 'compliment': {
      // Constant flattery stops landing.
      const worn = person.relationship > 85;
      return touch(
        worn ? base(1) : base(6),
        worn
          ? `${person.name} smiled and changed the subject.`
          : `${person.name} needed to hear that.`,
      );
    }

    case 'spendTime':
      return touch(base(9), `You spent real time with ${person.name}.`, {
        energyDelta: -4,
      });

    case 'gift':
      return touch(base(11), `${person.name} was not expecting a gift.`, {
        moneyDelta: -120,
      });

    case 'advice':
      return touch(
        base(6),
        `${person.name} told you something worth keeping.`,
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

    case 'breakUp':
      return {
        person: { ...person, role: 'ex', relationship: clamp(person.relationship - 45, 0, 100), lastInteractionMonth: monthsElapsed },
        categoryDelta: -25,
        moneyDelta: 0,
        energyDelta: 0,
        outcome: `You and ${person.name} broke up.`,
        ended: true,
      };
  }
}

/** One interaction per person per month keeps this from becoming a clicker. */
export function canInteract(person: Person, monthsElapsed: number): boolean {
  return person.alive && person.lastInteractionMonth !== monthsElapsed;
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
    };
  });
}
