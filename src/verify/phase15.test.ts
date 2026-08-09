import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { autoTick, autoTickMonths } from './harness';
import { toPublicView } from '../engine/selectors';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  countryById,
  EXPOSURE_FLOOR,
  exposureForCountry,
  isHistoric,
  isUSA,
  milestoneHeadline,
  milestoneHype,
  type MilestoneId,
} from '../engine/countries';
import { migrate } from '../save/db';
import { SCHEMA_VERSION, type GameState } from '../engine/types';

/**
 * PHASE 15 VERIFICATION
 *
 * Nationality and the milestone headlines (SPEC §4, §7).
 *
 * The assertion that matters is the one about *range*: the same achievement
 * has to read differently depending on where the player is from, or the whole
 * feature is a flag next to a name. A player from a country that has never
 * had an NBA player should get "the first ever"; an American should get a
 * plain sentence.
 */

function input(country: string, city = 'Kathmandu'): CreationInput {
  return {
    name: 'Marcus Vale',
    position: 'SG',
    jerseyNumber: 3,
    handedness: 'right',
    homeCity: city,
    homeState: 'Indiana',
    country,
    schoolTier: 'public',
  };
}

const ALL_MILESTONES: MilestoneId[] = [
  'first-offer',
  'signed-d1',
  'college-debut',
  'drafted',
  'nba-debut',
  'nba-starter',
  'all-star',
  'champion',
];

describe('the country list (SPEC §4)', () => {
  test('is well formed, with no duplicates and no missing fields', () => {
    const ids = new Set<string>();
    for (const c of COUNTRIES) {
      expect(ids.has(c.id), c.id).toBe(false);
      ids.add(c.id);
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.demonym.length).toBeGreaterThan(2);
      expect(c.flag.length).toBeGreaterThan(0);
      expect(c.exposure).toBeGreaterThan(0);
      expect(c.exposure).toBeLessThanOrEqual(1);
      expect(c.pipeline).toBeGreaterThan(0);
      expect(c.pipeline).toBeLessThanOrEqual(1);
      expect(c.nbaPlayersEver).toBeGreaterThanOrEqual(0);
    }
  });

  test('has the countries that were asked for, and a long tail', () => {
    for (const id of ['nepal', 'france', 'england', 'usa']) {
      expect(COUNTRIES.some((c) => c.id === id), id).toBe(true);
    }
    expect(COUNTRIES.length).toBeGreaterThan(40);
    expect(countryById('nepal').demonym).toBe('Nepalese');
    expect(countryById('nepal').nbaPlayersEver).toBe(0);
  });

  test('exposure spans a real range, and the pipeline is a floor', () => {
    expect(exposureForCountry('usa')).toBeCloseTo(1, 5);
    // Roughly a quarter of an American's visibility — hard, not hopeless.
    expect(exposureForCountry('nepal')).toBeLessThan(0.3);
    expect(exposureForCountry('nepal')).toBeGreaterThan(EXPOSURE_FLOOR);
    expect(exposureForCountry('france')).toBeGreaterThan(
      exposureForCountry('nepal'),
    );
    // Nothing is unplayable, and nothing beats being American.
    for (const c of COUNTRIES) {
      expect(exposureForCountry(c.id)).toBeGreaterThanOrEqual(EXPOSURE_FLOOR);
      expect(exposureForCountry(c.id)).toBeLessThanOrEqual(1);
    }
  });

  test('an unknown id falls back rather than crashing', () => {
    expect(countryById('atlantis').id).toBe('usa');
  });
});

describe('the headlines scale with where you are from (SPEC §7)', () => {
  test('every milestone has copy for every country', () => {
    for (const id of ALL_MILESTONES) {
      for (const c of COUNTRIES) {
        const line = milestoneHeadline(id, c.id);
        expect(line, `${id}/${c.id}`).toBeTruthy();
        // The plain versions are terse on purpose ("I signed.").
        expect(line!.length).toBeGreaterThan(6);
      }
    }
  });

  test('a country with no NBA history gets the "first ever" version', () => {
    for (const id of ALL_MILESTONES) {
      const nepal = milestoneHeadline(id, 'nepal')!;
      const usa = milestoneHeadline(id, 'usa')!;
      expect(nepal).not.toBe(usa);
      expect(isHistoric(id, 'nepal')).toBe(true);
      expect(isHistoric(id, 'usa')).toBe(false);
    }

    // And it names the place, which is the entire point.
    expect(milestoneHeadline('drafted', 'nepal')).toContain('Nepal');
    expect(milestoneHeadline('drafted', 'nepal')).toContain('Nepalese');
    expect(milestoneHeadline('nba-debut', 'nepal')).toContain('Nepal');
  });

  test('a deep basketball nation gets the plain version', () => {
    expect(isHistoric('drafted', 'france')).toBe(false);
    expect(isHistoric('drafted', 'usa')).toBe(false);
    expect(milestoneHeadline('drafted', 'usa')).not.toContain('first');
  });

  test('a middling country gets the rare version, not the first-ever one', () => {
    // The Philippines has a couple, so this is notable but not unprecedented.
    expect(countryById('philippines').nbaPlayersEver).toBeGreaterThan(0);
    const line = milestoneHeadline('nba-starter', 'philippines')!;
    expect(line).toContain('Filipino');
    expect(line).not.toContain('the first');

    // England has enough history that the same line goes plain.
    expect(isHistoric('nba-starter', 'england')).toBe(false);
  });

  test('being first is worth hype, and being American is not', () => {
    expect(milestoneHype('drafted', 'nepal')).toBeGreaterThan(0);
    expect(milestoneHype('drafted', 'usa')).toBe(0);
    // The big moments are worth more than the small ones.
    expect(milestoneHype('drafted', 'nepal')).toBeGreaterThan(
      milestoneHype('first-offer', 'nepal'),
    );
  });
});

describe('nationality in a real career (SPEC §4)', () => {
  test('a career carries its country through creation and the view', () => {
    const state = createGame(1, input('nepal'));
    expect(state.origin.country).toBe('nepal');
    expect(state.milestones).toEqual([]);

    const view = toPublicView(state);
    expect(view.nationality.name).toBe('Nepal');
    expect(view.nationality.demonym).toBe('Nepalese');
    expect(view.nationality.isUSA).toBe(false);
    expect(view.nationality.flag.length).toBeGreaterThan(0);
  });

  test('the country sets exposure, not the state, once you leave the US', () => {
    const nepal = createGame(2, input('nepal'));
    const usa = createGame(2, { ...input('usa'), homeCity: 'Gary' });
    expect(nepal.origin.exposureMultiplier).toBeLessThan(
      usa.origin.exposureMultiplier,
    );
    expect(isUSA(usa.origin.country)).toBe(true);

    // And the state field is inert outside the US — two Nepalese careers
    // with different states on the form are equally visible. This is the
    // assertion that would have caught the hype path reading the state
    // directly and never seeing the country at all.
    const a = createGame(5, { ...input('nepal'), homeState: 'California' });
    const b = createGame(5, { ...input('nepal'), homeState: 'Montana' });
    expect(a.origin.exposureMultiplier).toBe(b.origin.exposureMultiplier);
  });

  test('omitting the country defaults to the United States', () => {
    const { country: _dropped, ...rest } = input('nepal');
    const state = createGame(3, rest as CreationInput);
    expect(state.origin.country).toBe(DEFAULT_COUNTRY);
  });

  test('the opening line names the country when it is not the US', () => {
    const nepal = createGame(4, input('nepal'));
    expect(nepal.log[0].text).toContain('Nepal');
    const usa = createGame(4, { ...input('usa'), homeCity: 'Gary' });
    expect(usa.log[0].text).toContain('Indiana');
  });

  test('milestones fire once, in order, and land in the feed', () => {
    // Drive a career and watch the ledger fill without repeating.
    let state = createGame(11, input('nepal'));
    for (let i = 0; i < 200 && !state.careerEnd; i++) {
      state = autoTick(state, [{ id: 'shooting' }]);
    }

    const seen = new Set(state.milestones);
    expect(seen.size).toBe(state.milestones.length);

    // Whatever was reached shows up exactly once in the feed.
    for (const id of state.milestones) {
      const line = milestoneHeadline(id as MilestoneId, 'nepal')!;
      const hits = state.log.filter((e) => e.text === line).length;
      expect(hits, id).toBe(1);
    }
  });

  test('a Nepalese career that gets an offer reads as national news', () => {
    // Force the milestone rather than seed-hunting for one.
    const base = createGame(12, input('nepal'));
    const withOffer: GameState = {
      ...base,
      recruiting: {
        ...base.recruiting,
        offers: [
          { programId: 'duke', monthOffered: 1, active: true, pulledReason: null },
        ],
      },
    };
    const after = autoTick(withOffer, []);

    expect(after.milestones).toContain('first-offer');
    expect(
      after.log.some((e) => e.text.includes('Nepal')),
      'the headline names the country',
    ).toBe(true);

    // And it never fires again.
    const later = autoTickMonths(after, 4);
    const line = milestoneHeadline('first-offer', 'nepal')!;
    expect(later.log.filter((e) => e.text === line)).toHaveLength(1);
  });

  test('the same milestone for an American is a quieter sentence', () => {
    const base = createGame(12, { ...input('usa'), homeCity: 'Gary' });
    const withOffer: GameState = {
      ...base,
      recruiting: {
        ...base.recruiting,
        offers: [
          { programId: 'duke', monthOffered: 1, active: true, pulledReason: null },
        ],
      },
    };
    const after = autoTick(withOffer, []);
    expect(after.milestones).toContain('first-offer');
    expect(after.log.some((e) => e.text.includes('first real offer'))).toBe(true);
    expect(after.log.some((e) => e.text.includes('No one from'))).toBe(false);
  });

  test('a full career from a hard country still completes', () => {
    for (const country of ['nepal', 'france', 'england', 'fiji']) {
      let state = createGame(21, input(country));
      for (let i = 0; i < 260 && !state.careerEnd; i++) {
        state = autoTick(state, [{ id: 'shooting' }]);
      }
      expect(state.careerEnd, country).not.toBeNull();
    }
  });
});

describe('the save (SPEC §16)', () => {
  test('a v8 save becomes an American career rather than breaking', () => {
    const current = createGame(31, { ...input('usa'), homeCity: 'Gary' });
    const { milestones: _m, ...rest } = current;
    const legacyOrigin = { ...current.origin };
    delete (legacyOrigin as { country?: string }).country;

    const legacy = {
      ...rest,
      schemaVersion: 8,
      origin: legacyOrigin,
    } as unknown as GameState;

    const migrated = migrate({
      slot: 0,
      schemaVersion: 8,
      savedAt: Date.now(),
      displayName: 'legacy',
      state: legacy,
    });

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.origin.country).toBe(DEFAULT_COUNTRY);
    expect(migrated.milestones).toEqual([]);
    expect(autoTick(migrated, []).monthsElapsed).toBe(current.monthsElapsed + 1);
  });
});
