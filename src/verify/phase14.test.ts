import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { autoTickMonths } from './harness';
import { toPublicView } from '../engine/selectors';
import { hasSecondPerson, toFirstPerson } from '../engine/voice';
import { EVENTS } from '../engine/events/catalog';

/**
 * PHASE 14 VERIFICATION
 *
 * The life feed reads as a diary (SPEC §17).
 *
 * The load-bearing assertion is that *nothing* in the feed still addresses
 * the player as "you". The engine and the 200-odd event outcomes are written
 * in second person and converted on the way out, so this file drives every
 * string in the catalogue through the transform and checks the result — which
 * is also what stops a new event being written in a voice the feed cannot
 * render.
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

/** Every piece of prose the feed can ever show. */
function allOutcomes(): string[] {
  const out: string[] = [];
  for (const event of EVENTS) {
    for (const choice of event.choices) {
      if (choice.effects?.outcome) out.push(choice.effects.outcome);
    }
  }
  return out;
}

describe('the transform', () => {
  test('handles the pronouns English actually conjugates differently', () => {
    expect(toFirstPerson('You are tired.')).toBe('I am tired.');
    expect(toFirstPerson('You were tired.')).toBe('I was tired.');
    expect(toFirstPerson("You're tired.")).toBe("I'm tired.");
    expect(toFirstPerson('You ran your drills.')).toBe('I ran my drills.');
    expect(toFirstPerson('You know what it cost.')).toBe('I know what it cost.');
  });

  test('gets subject and object right, which is the whole difficulty', () => {
    expect(toFirstPerson('Coaches notice you.')).toBe('Coaches notice me.');
    expect(toFirstPerson('He watched you go.')).toBe('He watched me go.');
    expect(toFirstPerson('He is watching you from the window.')).toBe(
      'He is watching me from the window.',
    );
    expect(toFirstPerson('Nobody is going to make you decide.')).toBe(
      'Nobody is going to make me decide.',
    );
    expect(toFirstPerson('Wider than you hoped.')).toBe('Wider than I hoped.');
    expect(toFirstPerson('He owes you and both of you know it.')).toBe(
      'He owes me and both of us know it.',
    );
    expect(toFirstPerson('You went once. It sat with you.')).toBe(
      'I went once. It sat with me.',
    );
  });

  test('leaves prose that never addressed the player alone', () => {
    const untouched = 'He went quiet and went inside.';
    expect(toFirstPerson(untouched)).toBe(untouched);
  });
});

describe('every string in the game survives it', () => {
  test('no event outcome still addresses the player after conversion', () => {
    const outcomes = allOutcomes();
    expect(outcomes.length).toBeGreaterThan(200);

    const leftover = outcomes
      .map((text) => ({ text, converted: toFirstPerson(text) }))
      .filter((row) => hasSecondPerson(row.converted));

    expect(leftover.map((r) => r.converted)).toEqual([]);
  });

  test('no outcome comes out empty or mangled into nothing', () => {
    for (const outcome of allOutcomes()) {
      const converted = toFirstPerson(outcome);
      expect(converted.trim().length).toBeGreaterThan(0);
      // Length should stay in the same ballpark — a rule that ate half a
      // sentence would show up here.
      expect(converted.length).toBeGreaterThan(outcome.length * 0.6);
    }
  });
});

describe('the feed itself (SPEC §17)', () => {
  test('groups by month, oldest first, and says something on month one', () => {
    const state = autoTickMonths(createGame(4, INPUT), 18);
    const feed = toPublicView(state).feed;

    expect(feed.length).toBeGreaterThan(3);
    for (let i = 1; i < feed.length; i++) {
      expect(feed[i].monthsElapsed).toBeGreaterThan(feed[i - 1].monthsElapsed);
    }
    for (const block of feed) {
      expect(block.lines.length).toBeGreaterThan(0);
      expect(block.date.length).toBeGreaterThan(0);
    }
  });

  test('a whole career reads back without addressing the player once', () => {
    for (const seed of [7, 21, 44]) {
      const state = autoTickMonths(createGame(seed, INPUT), 160);
      for (const block of toPublicView(state).feed) {
        for (const line of block.lines) {
          expect(
            hasSecondPerson(line.text),
            `"${line.text}"`,
          ).toBe(false);
        }
      }
    }
  });

  test('the feed is in first person, not just free of second person', () => {
    const state = autoTickMonths(createGame(9, INPUT), 90);
    const lines = toPublicView(state)
      .feed.flatMap((b) => b.lines.map((l) => l.text));

    const firstPerson = lines.filter((l) => /\b(I|my|me)\b/.test(l));
    expect(firstPerson.length).toBeGreaterThan(lines.length * 0.4);
  });
});

describe('plural you (SPEC §17)', () => {
  test('a quantified "you" becomes "us", including before a verb', () => {
    expect(toFirstPerson('Both of you were sent home.')).toBe(
      'Both of us were sent home.',
    );
    expect(toFirstPerson('He owes you and both of you know it.')).toBe(
      'He owes me and both of us know it.',
    );
    expect(toFirstPerson('All of you are on the list.')).toBe(
      'All of us are on the list.',
    );
    // And a bare "you were" is still singular.
    expect(toFirstPerson('You were sent home.')).toBe('I was sent home.');
  });
});
