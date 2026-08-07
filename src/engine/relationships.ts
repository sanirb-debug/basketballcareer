import { clamp } from './rng';
import {
  RELATIONSHIP_IDS,
  type FamilyStructure,
  type RelationshipId,
  type Relationships,
} from './types';

/**
 * Relationships (SPEC §6).
 *
 * Each one costs action points to maintain, gives a buff when strong, and
 * fires drama events when neglected. They decay quietly every month, so doing
 * nothing is itself a choice with consequences.
 */

export const RELATIONSHIP = {
  MIN: 0,
  MAX: 100,
  /** Monthly decay when left alone. */
  DECAY: 1.3,
  /** Below this, neglect events start unlocking. */
  NEGLECT_THRESHOLD: 30,
  /** At or above this, the relationship's buff applies. */
  STRONG_THRESHOLD: 70,
} as const;

export const RELATIONSHIP_LABEL: Record<RelationshipId, string> = {
  parents: 'Parents',
  friends: 'Friends',
  girlfriend: 'Girlfriend',
  hsCoach: 'HS Coach',
  trainer: 'Trainer',
  aauCoach: 'AAU Coach',
};

export function initialRelationships(
  familyStructure: FamilyStructure,
): Relationships {
  const make = (level: number, active: boolean) => ({ level, active });

  return {
    // A single-parent household starts tighter but carries more obligation.
    parents: make(familyStructure === 'single-parent' ? 78 : 72, true),
    friends: make(62, true),
    girlfriend: make(0, false),
    hsCoach: make(50, true),
    trainer: make(0, false),
    aauCoach: make(0, false),
  };
}

export interface RelationshipMonthInput {
  relationships: Relationships;
  /** Relationship ids that received attention this month. */
  tended: RelationshipId[];
  /** Boost applied per tending action. */
  boost: number;
}

export function advanceRelationships(
  input: RelationshipMonthInput,
): { relationships: Relationships; notes: string[] } {
  const next = {} as Relationships;
  const notes: string[] = [];

  for (const id of RELATIONSHIP_IDS) {
    const current = input.relationships[id];
    if (!current.active) {
      next[id] = current;
      continue;
    }

    const tendCount = input.tended.filter((t) => t === id).length;
    const level = clamp(
      current.level - RELATIONSHIP.DECAY + tendCount * input.boost,
      RELATIONSHIP.MIN,
      RELATIONSHIP.MAX,
    );

    if (
      level < RELATIONSHIP.NEGLECT_THRESHOLD &&
      current.level >= RELATIONSHIP.NEGLECT_THRESHOLD
    ) {
      notes.push(`Things are getting strained with ${RELATIONSHIP_LABEL[id]}.`);
    }

    next[id] = { ...current, level };
  }

  return { relationships: next, notes };
}

/** Which relationships a `socialize` action tends, in priority order. */
export function socialTargets(relationships: Relationships): RelationshipId[] {
  const targets: RelationshipId[] = ['friends'];
  if (relationships.girlfriend.active) targets.push('girlfriend');
  return targets;
}

export function isStrong(relationships: Relationships, id: RelationshipId): boolean {
  const r = relationships[id];
  return r.active && r.level >= RELATIONSHIP.STRONG_THRESHOLD;
}

export function isNeglected(
  relationships: Relationships,
  id: RelationshipId,
): boolean {
  const r = relationships[id];
  return r.active && r.level < RELATIONSHIP.NEGLECT_THRESHOLD;
}

/**
 * Training bonus from a strong trainer relationship, and the coach-trust
 * bonus from a tight relationship with the HS staff.
 */
export function trainingBonus(relationships: Relationships): number {
  return isStrong(relationships, 'trainer') ? 0.12 : 0;
}

export function coachTrustBonus(relationships: Relationships): number {
  return isStrong(relationships, 'hsCoach') ? 1.2 : 0;
}
