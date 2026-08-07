import type {
  AttributeKey,
  FamilyStructure,
  IncomeTier,
  InjurySeverity,
  RelationshipId,
} from '../types';

/**
 * The data-driven event system (SPEC §12).
 *
 * Events are plain objects: trigger conditions, a weight, and 2–4 choices each
 * carrying stat effects, relationship effects, and flags that can unlock later
 * events. Nothing here is bespoke code, so adding content is adding data.
 */

export type EventCategory =
  | 'family'
  | 'school'
  | 'teammates'
  | 'coaches'
  | 'social'
  | 'media'
  | 'injury'
  | 'money'
  | 'romance'
  | 'viral'
  | 'character';

export interface EventConditions {
  /** Age in whole years, inclusive. */
  minAge?: number;
  maxAge?: number;
  /** Calendar months (0 = January) the event can fire in. */
  months?: number[];
  minGrade?: number;
  maxGrade?: number;
  requireFlags?: string[];
  forbidFlags?: string[];
  minHype?: number;
  maxHype?: number;
  minGpa?: number;
  maxGpa?: number;
  minOffCourt?: number;
  maxOffCourt?: number;
  minOnCourt?: number;
  minCoachTrust?: number;
  maxCoachTrust?: number;
  minMoney?: number;
  maxMoney?: number;
  minNationalRank?: number;
  maxNationalRank?: number;
  income?: IncomeTier[];
  familyStructure?: FamilyStructure[];
  /** These relationships must already exist. */
  requireActive?: RelationshipId[];
  requireInactive?: RelationshipId[];
  minRelationship?: Partial<Record<RelationshipId, number>>;
  maxRelationship?: Partial<Record<RelationshipId, number>>;
  injured?: boolean;
  hasOffer?: boolean;
  committed?: boolean;
  /** Only when the player is on a real AAU circuit. */
  onCircuit?: boolean;
}

export interface EventEffect {
  attributes?: Partial<Record<AttributeKey, number>>;
  hype?: number;
  onCourt?: number;
  offCourt?: number;
  coachTrust?: number;
  gpa?: number;
  energy?: number;
  money?: number;
  confidence?: number;
  relationships?: Partial<Record<RelationshipId, number>>;
  activate?: RelationshipId[];
  deactivate?: RelationshipId[];
  setFlags?: string[];
  clearFlags?: string[];
  injury?: {
    name: string;
    severity: InjurySeverity;
    months: number;
    cap: number;
  };
  /** Ends the run outright — used by the off-court flameout path (SPEC §15). */
  endsCareer?: { reason: string; detail: string };
  /** One line describing what happened, appended to the career log. */
  outcome: string;
}

export interface EventChoice {
  label: string;
  /** Optional flavor shown under the label. */
  detail?: string;
  effects: EventEffect;
}

export interface GameEvent {
  id: string;
  category: EventCategory;
  title: string;
  prompt: string;
  /** Relative likelihood among all currently eligible events. */
  weight: number;
  /** One-shot events never repeat once fired. */
  once?: boolean;
  conditions?: EventConditions;
  choices: EventChoice[];
}
