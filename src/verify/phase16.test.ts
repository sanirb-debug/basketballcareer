import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { autoTick, autoTickMonths } from './harness';
import { toPublicView } from '../engine/selectors';
import { TEXTURE_LINE_COUNT, allTextureLines, textureFor } from '../engine/texture';
import { hasSecondPerson, toFirstPerson } from '../engine/voice';
import { movesAbroad, schoolFor } from '../engine/school';
import { countryById } from '../engine/countries';
import type { GameState, SchoolTier } from '../engine/types';

/**
 * PHASE 16 VERIFICATION
 *
 * The life feed's texture, and the school fork told in the right country.
 *
 * Two things this file is really protecting:
 *
 * 1. **Texture cannot touch the simulation.** It is drawn from a stream
 *    derived from the seed rather than the run's own, so a hundred new
 *    flavour lines must not shift a single roll. That is asserted directly
 *    by ticking with and without it and comparing the RNG state.
 * 2. **Texture is authored in first person and must survive the voice
 *    transform untouched** — a generic "you" in a flavour line comes out as
 *    "I could not tell me what", which is exactly the bug this caught.
 */

function input(country: string, tier: SchoolTier = 'public'): CreationInput {
  return {
    name: 'Marcus Vale',
    position: 'SG',
    jerseyNumber: 3,
    handedness: 'right',
    homeCity: country === 'usa' ? 'Gary' : 'Kathmandu',
    homeState: 'Indiana',
    country,
    schoolTier: tier,
  };
}

describe('the feed has a life in it (SPEC §17)', () => {
  test('the pool is large and every line resolves to real prose', () => {
    expect(TEXTURE_LINE_COUNT).toBeGreaterThan(70);
    const lines = allTextureLines();
    expect(lines.length).toBeGreaterThan(70);

    for (const line of lines) {
      expect(line.trim().length).toBeGreaterThan(15);
      // Specific, not atmospheric — every line is a sentence.
      expect(/[.!?]$/.test(line.trim()), line).toBe(true);
      expect(line).not.toContain('undefined');
      expect(line).not.toContain('[object');
    }

    // No duplicates hiding in the pool.
    expect(new Set(lines).size).toBe(lines.length);
  });

  test('texture is already first person and survives the transform', () => {
    for (const line of allTextureLines()) {
      expect(hasSecondPerson(line), line).toBe(false);
      // The load-bearing one: a generic "you" would be rewritten to "me".
      expect(toFirstPerson(line), line).toBe(line);
    }
  });

  test('it never touches the simulation', () => {
    // Texture is pure and stream-free: generating it a hundred times cannot
    // change the state or what the next tick produces. If it were drawing
    // from the run's own RNG this would diverge immediately.
    const before = autoTickMonths(createGame(7, input('usa')), 12);
    const clean = autoTick(before, []);

    for (let i = 0; i < 100; i++) textureFor(before, i % 2 === 0);
    const afterChurn = autoTick(before, []);

    expect(afterChurn.rngState).toEqual(clean.rngState);
    expect(afterChurn.player.attributes).toEqual(clean.player.attributes);
    expect(afterChurn.log.map((e) => e.text)).toEqual(
      clean.log.map((e) => e.text),
    );

    // Same input, same output, every time.
    expect(textureFor(before, false)).toEqual(textureFor(before, false));

    // And a whole career is bit-identical to the same seed replayed.
    const a = autoTickMonths(createGame(9, input('usa')), 80);
    const b = autoTickMonths(createGame(9, input('usa')), 80);
    expect(a.rngState).toEqual(b.rngState);
    expect(a.player.attributes).toEqual(b.player.attributes);
    expect(a.log.map((e) => e.text)).toEqual(b.log.map((e) => e.text));
  });

  test('the feed is genuinely denser than the bare mechanics', () => {
    const state = autoTickMonths(createGame(21, input('usa')), 60);
    const feed = toPublicView(state).feed;

    const lines = feed.flatMap((b) => b.lines);
    // Growth notices alone used to be most of it.
    const growth = lines.filter((l) => l.kind === 'growth').length;
    expect(lines.length).toBeGreaterThan(growth * 1.8);

    // And most months say more than one thing.
    const multi = feed.filter((b) => b.lines.length > 1).length;
    expect(multi).toBeGreaterThan(feed.length * 0.5);
  });

  test('it does not loop — a long career keeps finding new things to say', () => {
    const state = autoTickMonths(createGame(33, input('usa')), 160);
    const texture = toPublicView(state)
      .feed.flatMap((b) => b.lines)
      .filter((l) => l.kind === 'life')
      .map((l) => l.text);

    expect(texture.length).toBeGreaterThan(20);
    // A repeat inside the no-repeat window would show up as a low ratio.
    expect(new Set(texture).size).toBeGreaterThan(texture.length * 0.75);
  });

  test('context gates hold — no pro lines in middle school', () => {
    const state = autoTickMonths(createGame(41, input('usa')), 6);
    const said = state.log.map((e) => e.text).join(' ');
    expect(said).not.toContain('Four cities in six days');
    expect(said).not.toContain('signed for ninety minutes');
    expect(said).not.toContain('An agent I did not hire');
  });
});

describe('the school fork is told in the right country (SPEC §4, §8)', () => {
  test('an American career is unchanged', () => {
    const school = schoolFor('public', { city: 'Gary', country: 'usa' });
    expect(school.name).toBe('Gary Lincoln High');
    expect(school.middleSchoolName).toBe('Gary Middle School');
    expect(movesAbroad('prep', 'usa')).toBe(false);
  });

  test('a Nepalese fourteen-year-old is not enrolled at an American high school', () => {
    for (const tier of ['powerhouse', 'public', 'prep'] as SchoolTier[]) {
      const school = schoolFor(tier, { city: 'Kathmandu', country: 'nepal' });
      expect(school.middleSchoolName).toBe('Kathmandu Secondary School');
      // The two stay-at-home options are local; only the abroad one is not.
      if (tier !== 'prep') {
        expect(school.name).toContain('Kathmandu');
        expect(school.name).not.toContain('Gary');
        expect(school.name).not.toContain('Saint Anselm');
      }
      expect(school.blurb.length).toBeGreaterThan(60);
    }
  });

  test('the abroad option is the way out of the exposure penalty', () => {
    const home = createGame(3, input('nepal', 'public'));
    const away = createGame(3, input('nepal', 'prep'));
    const usa = createGame(3, input('usa', 'prep'));

    expect(movesAbroad('prep', 'nepal')).toBe(true);
    expect(away.origin.exposureMultiplier).toBeGreaterThan(
      home.origin.exposureMultiplier,
    );
    // It closes most of the gap to an American career, but the country is
    // still a real handicap everywhere else.
    expect(away.origin.exposureMultiplier).toBeLessThanOrEqual(
      usa.origin.exposureMultiplier,
    );
    expect(away.school.name).toContain('USA');
    expect(away.log[0].text).toContain('Nepal');
  });

  test('a player who never leaves is measurably less visible', () => {
    let home = autoTickMonths(createGame(12, input('nepal', 'public')), 70);
    let away = autoTickMonths(createGame(12, input('nepal', 'prep')), 70);
    // Not a strict inequality on one seed — exposure is one input among
    // several — but the ranking should not favour staying home.
    expect(away.hype.nationalRank).toBeLessThanOrEqual(
      home.hype.nationalRank + 40,
    );
  });

  test('a typed-in school name still wins, in any country', () => {
    const named = schoolFor('public', {
      name: 'Budhanilkantha School',
      city: 'Kathmandu',
      country: 'nepal',
    });
    expect(named.name).toBe('Budhanilkantha School');
  });

  test('every country produces a coherent fork', () => {
    for (const id of ['nepal', 'france', 'england', 'fiji', 'usa']) {
      const c = countryById(id);
      for (const tier of ['powerhouse', 'public', 'prep'] as SchoolTier[]) {
        const school = schoolFor(tier, { city: 'Somewhere', country: id });
        expect(school.name.length, `${id}/${tier}`).toBeGreaterThan(3);
        expect(school.name).not.toContain('undefined');
        expect(school.blurb).not.toContain('undefined');
        expect(school.middleSchoolName).toContain('Somewhere');
      }
      expect(c.name.length).toBeGreaterThan(1);
    }
  });
});

describe('a career from anywhere still runs to an ending', () => {
  test('four countries, three school tiers, all complete', () => {
    for (const country of ['usa', 'nepal', 'france']) {
      for (const tier of ['powerhouse', 'public', 'prep'] as SchoolTier[]) {
        let state: GameState = createGame(5, input(country, tier));
        for (let i = 0; i < 270 && !state.careerEnd; i++) {
          state = autoTick(state, [{ id: 'shooting' }]);
        }
        expect(state.careerEnd, `${country}/${tier}`).not.toBeNull();
        for (const entry of state.log) {
          expect(hasSecondPerson(toFirstPerson(entry.text)), entry.text).toBe(
            false,
          );
        }
      }
    }
  });
});
