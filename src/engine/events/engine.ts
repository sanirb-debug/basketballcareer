import { clamp, createRng, type Rng } from './../rng';
import { ATTR_MAX, ATTR_MIN } from './../attributes';
import { ageInMonths } from './../calendar';
import { gradeForClock } from './../season';
import { RELATIONSHIP } from './../relationships';
import { activeOffers } from './../recruiting';
import type { GameState, LogEntry, RelationshipId } from './../types';
import type { EventChoice, EventConditions, GameEvent } from './types';
import { EVENTS } from './catalog';

/**
 * Event selection and resolution (SPEC §12).
 *
 * A tick can *raise* an event but cannot resolve it — resolving requires a
 * choice from the player, and `tick` is a pure function with no way to wait.
 * So a tick sets `events.pending` and the next tick refuses to run until
 * `applyEventChoice` has cleared it. That keeps the whole thing pure and
 * deterministic while still being genuinely interactive.
 */

/** Probability that any event fires in a given month. */
export const EVENT_CHANCE = 0.42;

export class PendingEventError extends Error {}

function relationshipLevel(state: GameState, id: RelationshipId): number {
  return state.relationships[id].level;
}

export function matchesConditions(
  event: GameEvent,
  state: GameState,
): boolean {
  const c: EventConditions | undefined = event.conditions;
  if (!c) return true;

  const ageYears = Math.floor(
    ageInMonths(state.clock, state.player.birthYear, state.player.birthMonth) / 12,
  );
  const grade = gradeForClock(state.clock);

  if (c.minAge !== undefined && ageYears < c.minAge) return false;
  if (c.maxAge !== undefined && ageYears > c.maxAge) return false;
  if (c.months && !c.months.includes(state.clock.month)) return false;
  if (c.minGrade !== undefined && grade < c.minGrade) return false;
  if (c.maxGrade !== undefined && grade > c.maxGrade) return false;

  if (c.requireFlags?.some((f) => !state.events.flags[f])) return false;
  if (c.forbidFlags?.some((f) => state.events.flags[f])) return false;

  if (c.minHype !== undefined && state.hype.hype < c.minHype) return false;
  if (c.maxHype !== undefined && state.hype.hype > c.maxHype) return false;
  if (c.minGpa !== undefined && state.academics.gpa < c.minGpa) return false;
  if (c.maxGpa !== undefined && state.academics.gpa > c.maxGpa) return false;

  if (c.minOffCourt !== undefined && state.reputation.offCourt < c.minOffCourt)
    return false;
  if (c.maxOffCourt !== undefined && state.reputation.offCourt > c.maxOffCourt)
    return false;
  if (c.minOnCourt !== undefined && state.reputation.onCourt < c.minOnCourt)
    return false;

  if (c.minCoachTrust !== undefined && state.coachTrust < c.minCoachTrust)
    return false;
  if (c.maxCoachTrust !== undefined && state.coachTrust > c.maxCoachTrust)
    return false;

  if (c.minMoney !== undefined && state.money < c.minMoney) return false;
  if (c.maxMoney !== undefined && state.money > c.maxMoney) return false;

  if (
    c.minNationalRank !== undefined &&
    state.hype.nationalRank < c.minNationalRank
  )
    return false;
  if (
    c.maxNationalRank !== undefined &&
    state.hype.nationalRank > c.maxNationalRank
  )
    return false;

  if (c.income && !c.income.includes(state.origin.incomeTier)) return false;
  if (c.familyStructure && !c.familyStructure.includes(state.origin.familyStructure))
    return false;

  if (c.requireActive?.some((id) => !state.relationships[id].active)) return false;
  if (c.requireInactive?.some((id) => state.relationships[id].active)) return false;

  if (c.minRelationship) {
    for (const [id, min] of Object.entries(c.minRelationship)) {
      if (relationshipLevel(state, id as RelationshipId) < (min as number))
        return false;
    }
  }
  if (c.maxRelationship) {
    for (const [id, max] of Object.entries(c.maxRelationship)) {
      if (relationshipLevel(state, id as RelationshipId) > (max as number))
        return false;
    }
  }

  if (c.injured !== undefined && (state.condition.injury !== null) !== c.injured)
    return false;
  if (c.hasOffer !== undefined && activeOffers(state.recruiting).length > 0 !== c.hasOffer)
    return false;
  if (c.committed !== undefined && (state.recruiting.commitment !== null) !== c.committed)
    return false;
  if (c.onCircuit !== undefined) {
    const onCircuit = state.hype.aauTier !== 'none';
    if (onCircuit !== c.onCircuit) return false;
  }

  return true;
}

/**
 * How long before a repeatable event may come round again.
 *
 * Only 23 of the 128 events are one-shot, which is right — a teammate asking
 * you to cover for him is a thing that happens more than once in a career.
 * What is not right is the *same sentence* twice in three months, which is
 * what an unbounded pool produces and what makes a feed look broken. Two
 * years is long enough that a repeat reads as history rhyming.
 */
export const EVENT_COOLDOWN_MONTHS = 24;

export function eligibleEvents(state: GameState): GameEvent[] {
  const fired = new Set(state.events.fired);

  // Derived from the decision log rather than a new field, so this needs no
  // schema change and works on every existing save.
  const recent = new Set(
    state.events.decisions
      .filter(
        (d) => state.monthsElapsed - d.monthsElapsed < EVENT_COOLDOWN_MONTHS,
      )
      .map((d) => d.eventId),
  );

  const pool = EVENTS.filter(
    (event) =>
      !(event.once && fired.has(event.id)) &&
      !recent.has(event.id) &&
      matchesConditions(event, state),
  );

  // If the cooldown has starved the pool, fall back to ignoring it rather
  // than silently going quiet for two years.
  if (pool.length > 0) return pool;
  return EVENTS.filter(
    (event) =>
      !(event.once && fired.has(event.id)) && matchesConditions(event, state),
  );
}

/** Pick an event for this month, or null if none fires. */
export function selectEvent(state: GameState, rng: Rng): GameEvent | null {
  if (!rng.chance(EVENT_CHANCE)) return null;

  const pool = eligibleEvents(state);
  if (pool.length === 0) return null;

  return rng.weighted(
    pool,
    pool.map((e) => e.weight),
  );
}

export function eventById(id: string): GameEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

/**
 * Apply the player's choice and clear the pending event.
 *
 * Pure and seeded like everything else: it draws from the same stream stored
 * in state, so a run replays identically given the same choices.
 */
export function applyEventChoice(
  state: GameState,
  choiceIndex: number,
  monthsElapsed = state.monthsElapsed,
): GameState {
  const pending = state.events.pending;
  if (!pending) throw new PendingEventError('No pending event to resolve');

  const event = eventById(pending.eventId);
  if (!event) throw new PendingEventError(`Unknown event ${pending.eventId}`);

  const choice = event.choices[choiceIndex];
  if (!choice) {
    throw new PendingEventError(
      `Choice ${choiceIndex} out of range for ${event.id}`,
    );
  }

  return applyEffects(state, event, choice, monthsElapsed);
}

function applyEffects(
  state: GameState,
  event: GameEvent,
  choice: EventChoice,
  monthsElapsed: number,
): GameState {
  const fx = choice.effects;
  const rng = createRng(state.rngState);

  // --- attributes --------------------------------------------------------
  const attributes = { ...state.player.attributes };
  if (fx.attributes) {
    for (const [key, delta] of Object.entries(fx.attributes)) {
      const k = key as keyof typeof attributes;
      attributes[k] = clamp(
        (attributes[k] as number) + (delta as number),
        ATTR_MIN,
        ATTR_MAX,
      );
    }
  }

  // --- relationships -----------------------------------------------------
  const relationships = { ...state.relationships };
  for (const id of fx.activate ?? []) {
    relationships[id] = { level: Math.max(relationships[id].level, 55), active: true };
  }
  for (const id of fx.deactivate ?? []) {
    relationships[id] = { level: 0, active: false };
  }
  if (fx.relationships) {
    for (const [id, delta] of Object.entries(fx.relationships)) {
      const key = id as RelationshipId;
      if (!relationships[key].active) continue;
      relationships[key] = {
        ...relationships[key],
        level: clamp(
          relationships[key].level + (delta as number),
          RELATIONSHIP.MIN,
          RELATIONSHIP.MAX,
        ),
      };
    }
  }

  // --- flags -------------------------------------------------------------
  const flags = { ...state.events.flags };
  for (const flag of fx.setFlags ?? []) flags[flag] = true;
  for (const flag of fx.clearFlags ?? []) delete flags[flag];

  // --- injury ------------------------------------------------------------
  const injury = fx.injury
    ? {
        name: fx.injury.name,
        severity: fx.injury.severity,
        monthsRemaining: fx.injury.months,
        attributeCap: fx.injury.cap,
      }
    : state.condition.injury;

  const log: LogEntry[] = [
    ...state.log,
    {
      monthsElapsed,
      year: state.clock.year,
      month: state.clock.month,
      kind: 'system',
      text: fx.outcome,
    },
  ];

  const careerEnd = fx.endsCareer
    ? {
        endingId: 'off-court-flameout' as const,
        reason: fx.endsCareer.reason,
        detail: fx.endsCareer.detail,
        decision: `${event.title} — you chose "${choice.label}".`,
        monthsElapsed,
      }
    : state.careerEnd;

  return {
    ...state,
    rngState: rng.state(),
    player: {
      ...state.player,
      attributes,
      hiddenMeta: {
        ...state.player.hiddenMeta,
        confidence: clamp(
          state.player.hiddenMeta.confidence + (fx.confidence ?? 0),
          0,
          100,
        ),
      },
    },
    coachTrust: clamp(state.coachTrust + (fx.coachTrust ?? 0), 0, 100),
    condition: {
      energy: clamp(state.condition.energy + (fx.energy ?? 0), 0, 100),
      injury,
    },
    academics: {
      ...state.academics,
      gpa: clamp(state.academics.gpa + (fx.gpa ?? 0), 0, 4),
    },
    reputation: {
      onCourt: clamp(state.reputation.onCourt + (fx.onCourt ?? 0), 0, 100),
      offCourt: clamp(state.reputation.offCourt + (fx.offCourt ?? 0), 0, 100),
    },
    hype: {
      ...state.hype,
      hype: clamp(state.hype.hype + (fx.hype ?? 0), 0, 100),
    },
    money: Math.max(0, state.money + (fx.money ?? 0)),
    relationships,
    events: {
      pending: null,
      flags,
      fired: state.events.fired.includes(event.id)
        ? state.events.fired
        : [...state.events.fired, event.id],
      decisions: [
        ...state.events.decisions,
        { eventId: event.id, choice: choice.label, monthsElapsed },
      ],
    },
    careerEnd,
    log,
  };
}
