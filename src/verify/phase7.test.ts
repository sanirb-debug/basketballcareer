import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { UnresolvedEventError, tick } from '../engine/tick';
import { autoTick, autoTickMonths } from './harness';
import { EVENTS } from '../engine/events/catalog';
import {
  PendingEventError,
  applyEventChoice,
  eligibleEvents,
  eventById,
  matchesConditions,
} from '../engine/events/engine';
import {
  RELATIONSHIP,
  advanceRelationships,
  initialRelationships,
  isNeglected,
  isStrong,
} from '../engine/relationships';
import {
  ATTRIBUTE_KEYS,
  RELATIONSHIP_IDS,
  type GameState,
} from '../engine/types';

/**
 * PHASE 7 VERIFICATION (SPEC §18)
 *
 * "Event engine + 80 events." The build table calls for a manual playthrough;
 * these assertions cover the engine and audit the catalog so the playthrough
 * is checking whether the writing lands rather than whether it works.
 */

const INPUT: CreationInput = {
  name: 'Marcus Vale',
  position: 'SG',
  jerseyNumber: 3,
  handedness: 'right',
  homeCity: 'Gary',
  homeState: 'Indiana',
  schoolTier: 'public',
};

describe('the catalog (SPEC §12)', () => {
  test('hits the 80–120 target for the high school slice', () => {
    // SPEC §12's target is for the high school slice specifically. The
    // catalog now spans a whole career, so measure the subset that can
    // actually fire before graduation.
    const highSchool = EVENTS.filter((e) => {
      const c = e.conditions;
      if (!c) return true;
      if ((c.minGrade ?? 0) > 12) return false;
      if (c.requireFlags?.includes('in_the_league')) return false;
      return true;
    });

    expect(highSchool.length).toBeGreaterThanOrEqual(80);
    expect(highSchool.length).toBeLessThanOrEqual(120);
    // And the whole career has more than the slice alone.
    expect(EVENTS.length).toBeGreaterThan(highSchool.length);
  });

  test('the later stages have their own storylines', () => {
    const collegeOrLater = EVENTS.filter(
      (e) => (e.conditions?.minGrade ?? 0) > 12,
    );
    const pro = EVENTS.filter((e) =>
      e.conditions?.requireFlags?.includes('in_the_league'),
    );
    expect(collegeOrLater.length).toBeGreaterThanOrEqual(5);
    expect(pro.length).toBeGreaterThanOrEqual(5);
  });

  test('covers every category the spec names', () => {
    const categories = new Set(EVENTS.map((e) => e.category));
    for (const required of [
      'family',
      'school',
      'teammates',
      'coaches',
      'social',
      'media',
      'injury',
      'money',
      'romance',
      'viral',
      'character',
    ]) {
      expect(categories.has(required as never), required).toBe(true);
    }
  });

  test('every event id is unique', () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every event is structurally valid', () => {
    for (const event of EVENTS) {
      expect(event.title.length, event.id).toBeGreaterThan(0);
      expect(event.prompt.length, event.id).toBeGreaterThan(20);
      expect(event.weight, event.id).toBeGreaterThan(0);

      // SPEC §12 asks for 2–4 choices. One is allowed only where the event is
      // a moment rather than a decision.
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(1);
      expect(event.choices.length, event.id).toBeLessThanOrEqual(4);

      for (const choice of event.choices) {
        expect(choice.label.length, event.id).toBeGreaterThan(0);
        expect(choice.effects.outcome.length, event.id).toBeGreaterThan(0);

        for (const key of Object.keys(choice.effects.attributes ?? {})) {
          expect(ATTRIBUTE_KEYS, `${event.id} -> ${key}`).toContain(key);
        }
        for (const key of Object.keys(choice.effects.relationships ?? {})) {
          expect(RELATIONSHIP_IDS, `${event.id} -> ${key}`).toContain(key);
        }
      }
    }
  });

  test('the vast majority of events are real decisions, not notifications', () => {
    const decisions = EVENTS.filter((e) => e.choices.length >= 2);
    expect(decisions.length / EVENTS.length).toBeGreaterThan(0.95);
  });

  test('events chain — flags set by choices are required by later events', () => {
    const set = new Set<string>();
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        for (const flag of choice.effects.setFlags ?? []) set.add(flag);
      }
    }

    const required = new Set<string>();
    for (const event of EVENTS) {
      for (const flag of event.conditions?.requireFlags ?? []) required.add(flag);
    }

    // Flags the engine raises rather than a choice.
    const engineFlags = new Set(['returned_from_injury', 'in_the_league']);

    expect(required.size).toBeGreaterThan(5);
    // Every flag an event waits on must be reachable — otherwise the event is
    // dead content that can never fire.
    for (const flag of required) {
      expect(
        set.has(flag) || engineFlags.has(flag),
        `nothing ever sets "${flag}"`,
      ).toBe(true);
    }
  });

  test('every flag a choice clears is one that can be set', () => {
    const set = new Set<string>();
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        for (const flag of choice.effects.setFlags ?? []) set.add(flag);
      }
    }
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        for (const flag of choice.effects.clearFlags ?? []) {
          expect(set.has(flag), `${event.id} clears unreachable "${flag}"`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe('trigger conditions (SPEC §12)', () => {
  const base = () => createGame(11, INPUT);

  test('an age-gated event does not fire for a 13-year-old', () => {
    const state = base();
    const grownUp = EVENTS.find((e) => (e.conditions?.minAge ?? 0) >= 16);
    expect(grownUp).toBeDefined();
    expect(matchesConditions(grownUp!, state)).toBe(false);
  });

  test('a flag-gated event only becomes eligible once the flag is set', () => {
    const state = base();
    const gated = eventById('sch-caught-cheating')!;
    expect(matchesConditions(gated, state)).toBe(false);

    const flagged: GameState = {
      ...state,
      events: { ...state.events, flags: { cheated_once: true } },
    };
    expect(matchesConditions(gated, flagged)).toBe(true);
  });

  test('a relationship-gated event waits for the relationship to exist', () => {
    const state = base();
    const romance = eventById('rom-time-conflict')!;
    expect(matchesConditions(romance, state)).toBe(false);

    const dating: GameState = {
      ...state,
      relationships: {
        ...state.relationships,
        girlfriend: { level: 60, active: true },
      },
    };
    expect(matchesConditions(romance, dating)).toBe(true);
  });

  test('an injury event only fires in the right condition', () => {
    const state = base();
    const rehab = eventById('inj-rehab-boredom')!;
    expect(matchesConditions(rehab, state)).toBe(false);

    const hurt: GameState = {
      ...state,
      condition: {
        energy: 60,
        injury: {
          name: 'rolled ankle',
          severity: 'minor',
          monthsRemaining: 2,
          attributeCap: 0.95,
        },
      },
    };
    expect(matchesConditions(rehab, hurt)).toBe(true);
  });

  test('one-shot events drop out of the pool once fired', () => {
    const state = base();
    const oneShot = EVENTS.find((e) => e.once && matchesConditions(e, state));
    if (!oneShot) return;

    const after: GameState = {
      ...state,
      events: { ...state.events, fired: [oneShot.id] },
    };
    expect(eligibleEvents(after).some((e) => e.id === oneShot.id)).toBe(false);
  });

  test('there is always something eligible to fire', () => {
    let state = createGame(4, INPUT);
    for (let i = 0; i < 30; i++) {
      expect(eligibleEvents(state).length, `month ${i}`).toBeGreaterThan(0);
      state = autoTick(state, []);
      if (state.careerEnd) break;
    }
  });
});

describe('resolution (SPEC §12)', () => {
  /** Advance until the engine raises something. */
  function untilPending(seed: number): GameState {
    let state = createGame(seed, INPUT);
    for (let i = 0; i < 60; i++) {
      state = tick(state, []);
      if (state.events.pending) return state;
    }
    throw new Error('no event fired');
  }

  test('a pending event blocks the clock until it is answered', () => {
    const state = untilPending(5);
    expect(state.events.pending).not.toBeNull();
    expect(() => tick(state, [])).toThrow(UnresolvedEventError);
  });

  test('choosing clears the pending event and records the decision', () => {
    const state = untilPending(5);
    const eventId = state.events.pending!.eventId;

    const after = applyEventChoice(state, 0);
    expect(after.events.pending).toBeNull();
    expect(after.events.fired).toContain(eventId);
    expect(after.events.decisions.at(-1)?.eventId).toBe(eventId);
    // The outcome line is appended to the career log.
    expect(after.log.length).toBeGreaterThan(state.log.length);
  });

  test('resolving with no pending event is an error', () => {
    const state = createGame(5, INPUT);
    expect(() => applyEventChoice(state, 0)).toThrow(PendingEventError);
  });

  test('an out-of-range choice is rejected', () => {
    const state = untilPending(5);
    expect(() => applyEventChoice(state, 99)).toThrow(PendingEventError);
  });

  test('effects actually land on the state', () => {
    const state = createGame(7, INPUT);
    const pending: GameState = {
      ...state,
      events: {
        ...state.events,
        pending: { eventId: 'char-ref-call', monthsElapsed: 1 },
      },
    };

    // Choice 1 is losing your temper: trust and character both drop.
    const after = applyEventChoice(pending, 1);
    expect(after.coachTrust).toBeLessThan(state.coachTrust);
    expect(after.reputation.offCourt).toBeLessThan(state.reputation.offCourt);
    expect(after.player.attributes.composure).toBeLessThan(
      state.player.attributes.composure as number,
    );
  });

  test('a choice can start a relationship that did not exist', () => {
    const state = createGame(7, INPUT);
    expect(state.relationships.girlfriend.active).toBe(false);

    const pending: GameState = {
      ...state,
      events: {
        ...state.events,
        pending: { eventId: 'rom-first', monthsElapsed: 1 },
      },
    };
    const after = applyEventChoice(pending, 0);
    expect(after.relationships.girlfriend.active).toBe(true);
  });

  test('a choice can end the run outright (SPEC §15)', () => {
    const state = createGame(7, INPUT);
    const pending: GameState = {
      ...state,
      events: {
        ...state.events,
        pending: { eventId: 'char-flameout', monthsElapsed: 40 },
      },
    };

    const after = applyEventChoice(pending, 1);
    expect(after.careerEnd).not.toBeNull();
    expect(after.careerEnd?.endingId).toBe('off-court-flameout');
    // The ending names the decision that caused it.
    expect(after.careerEnd?.decision).toContain('Blame everyone else');
  });

  test('resolution is deterministic', () => {
    const state = untilPending(9);
    expect(applyEventChoice(state, 0)).toEqual(applyEventChoice(state, 0));
  });

  test('all state stays inside its bounds after heavy event traffic', () => {
    const state = autoTickMonths(createGame(17, INPUT), 56, () => []);

    expect(state.reputation.offCourt).toBeGreaterThanOrEqual(0);
    expect(state.reputation.offCourt).toBeLessThanOrEqual(100);
    expect(state.reputation.onCourt).toBeGreaterThanOrEqual(0);
    expect(state.reputation.onCourt).toBeLessThanOrEqual(100);
    expect(state.money).toBeGreaterThanOrEqual(0);
    expect(state.academics.gpa).toBeGreaterThanOrEqual(0);
    expect(state.academics.gpa).toBeLessThanOrEqual(4);

    for (const id of RELATIONSHIP_IDS) {
      expect(state.relationships[id].level, id).toBeGreaterThanOrEqual(0);
      expect(state.relationships[id].level, id).toBeLessThanOrEqual(100);
    }
  });
});

describe('relationships (SPEC §6)', () => {
  test('start in a sensible shape — no girlfriend at thirteen', () => {
    const rels = initialRelationships('two-parent');
    expect(rels.parents.active).toBe(true);
    expect(rels.friends.active).toBe(true);
    expect(rels.girlfriend.active).toBe(false);
    expect(rels.trainer.active).toBe(false);
  });

  test('decay when neglected and recover when tended', () => {
    const rels = initialRelationships('two-parent');

    const neglected = advanceRelationships({
      relationships: rels,
      tended: [],
      boost: 11,
    }).relationships;
    expect(neglected.friends.level).toBeLessThan(rels.friends.level);

    const tended = advanceRelationships({
      relationships: rels,
      tended: ['friends'],
      boost: 11,
    }).relationships;
    expect(tended.friends.level).toBeGreaterThan(rels.friends.level);
  });

  test('inactive relationships are left alone entirely', () => {
    const rels = initialRelationships('two-parent');
    const after = advanceRelationships({
      relationships: rels,
      tended: [],
      boost: 11,
    }).relationships;
    expect(after.girlfriend).toEqual(rels.girlfriend);
  });

  test('long neglect eventually crosses the strain threshold', () => {
    let rels = initialRelationships('two-parent');
    for (let i = 0; i < 60; i++) {
      rels = advanceRelationships({
        relationships: rels,
        tended: [],
        boost: 11,
      }).relationships;
    }
    expect(isNeglected(rels, 'friends')).toBe(true);
    expect(rels.friends.level).toBeGreaterThanOrEqual(RELATIONSHIP.MIN);
  });

  test('a strong relationship reads as strong', () => {
    const rels = initialRelationships('two-parent');
    const strong = {
      ...rels,
      trainer: { level: 85, active: true },
    };
    expect(isStrong(strong, 'trainer')).toBe(true);
    expect(isStrong(rels, 'trainer')).toBe(false);
  });

  test('a single-parent household starts closer', () => {
    expect(initialRelationships('single-parent').parents.level).toBeGreaterThan(
      initialRelationships('two-parent').parents.level,
    );
  });
});
