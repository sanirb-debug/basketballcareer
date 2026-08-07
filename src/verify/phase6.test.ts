import { describe, expect, test } from 'vitest';

import { createRng, seedToState } from '../engine/rng';
import { createGame, type CreationInput } from '../engine/newGame';
import { autoTickMonths } from './harness';
import { PROGRAMS, TIER_RANK, programById } from '../engine/colleges';
import {
  RECRUITING,
  activeOffers,
  advanceRecruiting,
  bestOffer,
  canSign,
  commitTo,
  decommit,
  initialRecruiting,
  isSigningMonth,
  sign,
  targetInterest,
  type RecruitingInput,
} from '../engine/recruiting';
import { phaseFor } from '../engine/calendar';
import type { MonthAction, RecruitingState } from '../engine/types';

/**
 * PHASE 6 VERIFICATION (SPEC §18)
 *
 * The build table calls for a manual playthrough here. These assertions cover
 * the mechanics underneath it so a playthrough is checking feel rather than
 * correctness.
 */

const INPUT: CreationInput = {
  name: 'Marcus Vale',
  position: 'SG',
  jerseyNumber: 3,
  handedness: 'right',
  homeCity: 'Gary',
  homeState: 'Indiana',
  schoolTier: 'powerhouse',
};

function recruit(overrides: Partial<RecruitingInput> = {}): RecruitingInput {
  return {
    nationalRank: 25,
    hype: 80,
    position: 'SG',
    eligibility: 'qualifier',
    offCourt: 70,
    onCourt: 70,
    grade: 11,
    monthsElapsed: 30,
    visited: [],
    homeState: 'Indiana',
    ...overrides,
  };
}

function runRecruiting(
  input: RecruitingInput,
  months = 20,
  seed = 4141,
): RecruitingState {
  const rng = createRng(seedToState(seed));
  let state = initialRecruiting(rng);
  for (let i = 0; i < months; i++) {
    state = advanceRecruiting(state, input, rng).recruiting;
  }
  return state;
}

describe('interest and offers (SPEC §10)', () => {
  test('every program starts at zero interest with a position need', () => {
    const rng = createRng(seedToState(1));
    const state = initialRecruiting(rng);

    for (const program of PROGRAMS) {
      expect(state.interest[program.id], program.id).toBe(0);
      expect(state.needs[program.id], program.id).toBeDefined();
    }
    expect(state.offers).toHaveLength(0);
    expect(state.signed).toBe(false);
  });

  test('interest climbs toward its target month over month', () => {
    const rng = createRng(seedToState(2));
    let state = initialRecruiting(rng);
    const input = recruit();

    const first = advanceRecruiting(state, input, rng);
    state = first.recruiting;
    const early = state.interest['ridgemont'] as number;

    for (let i = 0; i < 10; i++) {
      state = advanceRecruiting(state, input, rng).recruiting;
    }
    expect(state.interest['ridgemont'] as number).toBeGreaterThan(early);
  });

  test('a top-30 recruit draws blueblood offers; a top-200 one does not', () => {
    const elite = runRecruiting(recruit({ nationalRank: 12 }));
    const solid = runRecruiting(recruit({ nationalRank: 200 }));

    const tiersFor = (state: RecruitingState) =>
      new Set(
        activeOffers(state)
          .map((o) => programById(o.programId)?.tier)
          .filter(Boolean),
      );

    expect(tiersFor(elite).has('blueblood')).toBe(true);
    expect(tiersFor(solid).has('blueblood')).toBe(false);
    // But a top-200 player is still a real recruit somewhere.
    expect(activeOffers(solid).length).toBeGreaterThan(0);
  });

  test('character floors keep some staffs away regardless of ranking', () => {
    const state = runRecruiting(recruit({ nationalRank: 5, offCourt: 20 }));
    const offered = activeOffers(state)
      .map((o) => programById(o.programId))
      .filter(Boolean);

    for (const program of offered) {
      expect(program!.characterFloor, program!.id).toBeLessThanOrEqual(20);
    }
    // St. Crispin has the highest character floor in the catalog.
    expect(offered.some((p) => p!.id === 'st-crispin')).toBe(false);
  });

  test('position need and home state both nudge interest up', () => {
    const rng = createRng(seedToState(6));
    const needs = { ...initialRecruiting(rng).needs };
    const program = PROGRAMS.find((p) => p.id === 'st-crispin')!;

    needs[program.id] = 'C';
    const withoutNeed = targetInterest(program, needs, recruit({ position: 'SG' }));
    needs[program.id] = 'SG';
    const withNeed = targetInterest(program, needs, recruit({ position: 'SG' }));

    expect(withNeed).toBeGreaterThan(withoutNeed);

    // St. Crispin is in Indiana, same as the player.
    const away = targetInterest(program, needs, recruit({ homeState: 'Oregon' }));
    expect(withNeed).toBeGreaterThan(away);
  });

  test('programs barely engage before junior year', () => {
    const rng = createRng(seedToState(7));
    const needs = initialRecruiting(rng).needs;
    const program = PROGRAMS.find((p) => p.id === 'lake-city')!;

    const freshman = targetInterest(program, needs, recruit({ grade: 9 }));
    const junior = targetInterest(program, needs, recruit({ grade: 11 }));
    expect(junior).toBeGreaterThan(freshman * 2);
  });

  test('an offer cools off and is pulled when interest collapses', () => {
    const rng = createRng(seedToState(21));
    let state = runRecruiting(recruit({ nationalRank: 10 }), 20, 21);
    expect(activeOffers(state).length).toBeGreaterThan(0);

    // The prospect falls off a cliff.
    for (let i = 0; i < 25; i++) {
      state = advanceRecruiting(state, recruit({ nationalRank: 399 }), rng)
        .recruiting;
    }
    const cooled = state.offers.filter((o) => o.pulledReason === 'cooled');
    expect(cooled.length).toBeGreaterThan(0);
  });

  test('visits raise interest more than another quiet month', () => {
    const rng = createRng(seedToState(31));
    const start = runRecruiting(recruit(), 4, 31);

    const quiet = advanceRecruiting(start, recruit(), createRng(seedToState(99)));
    const visited = advanceRecruiting(
      start,
      recruit({ visited: ['fairmount'] }),
      createRng(seedToState(99)),
    );
    void rng;

    expect(visited.recruiting.interest['fairmount'] as number).toBeGreaterThan(
      quiet.recruiting.interest['fairmount'] as number,
    );
    expect(visited.recruiting.visitsThisCycle).toBe(1);
  });
});

describe('commit, decommit and flip (SPEC §10)', () => {
  function withOffers() {
    return runRecruiting(recruit({ nationalRank: 15 }), 20);
  }

  test('committing requires a live offer', () => {
    const rng = createRng(seedToState(4));
    const empty = initialRecruiting(rng);
    expect(() => commitTo(empty, 'kensington', 10)).toThrow(/no active offer/);
  });

  test('committing to an unknown program is rejected', () => {
    expect(() => commitTo(withOffers(), 'not-a-school', 10)).toThrow(/unknown/);
  });

  test('a first commitment is a small character gain', () => {
    const state = withOffers();
    const target = activeOffers(state)[0]!.programId;
    const result = commitTo(state, target, 30);

    expect(result.recruiting.commitment?.programId).toBe(target);
    expect(result.recruiting.commitment?.signed).toBe(false);
    expect(result.characterDelta).toBeGreaterThan(0);
    expect(result.recruiting.decommits).toBe(0);
  });

  test('flipping costs character and is counted', () => {
    const state = withOffers();
    const offers = activeOffers(state);
    expect(offers.length).toBeGreaterThan(1);

    const first = commitTo(state, offers[0]!.programId, 30);
    const flipped = commitTo(first.recruiting, offers[1]!.programId, 32);

    expect(flipped.characterDelta).toBe(-RECRUITING.DECOMMIT_CHARACTER_COST);
    expect(flipped.recruiting.decommits).toBe(1);
    expect(flipped.note).toMatch(/Flipped/);
  });

  test('decommitting clears the commitment and costs character', () => {
    const state = withOffers();
    const committed = commitTo(state, activeOffers(state)[0]!.programId, 30);
    const out = decommit(committed.recruiting);

    expect(out.recruiting.commitment).toBeNull();
    expect(out.characterDelta).toBe(-RECRUITING.DECOMMIT_CHARACTER_COST);
    expect(out.recruiting.decommits).toBe(1);
  });

  test('a commitment dies with the offer behind it', () => {
    const rng = createRng(seedToState(55));
    const state = withOffers();
    const target = activeOffers(state)[0]!.programId;
    const committed = commitTo(state, target, 30).recruiting;

    // Grades collapse: every D1 offer evaporates, including the one he took.
    const after = advanceRecruiting(
      committed,
      recruit({ eligibility: 'non-qualifier' }),
      rng,
    );
    expect(after.recruiting.commitment).toBeNull();
  });
});

describe('signing day (SPEC §10)', () => {
  test('the periods are November and April', () => {
    expect(isSigningMonth(10)).toBe(true); // November
    expect(isSigningMonth(3)).toBe(true); // April
    expect(isSigningMonth(0)).toBe(false);
    expect(isSigningMonth(7)).toBe(false);
  });

  test('you cannot sign early, out of period, or uncommitted', () => {
    const state = withCommitment();
    expect(canSign(state, 11, 10)).toBe(false); // junior year
    expect(canSign(state, 12, 5)).toBe(false); // June, no period
    expect(canSign(state, 12, 10)).toBe(true); // senior November

    const uncommitted = runRecruiting(recruit({ nationalRank: 15 }), 20);
    expect(canSign(uncommitted, 12, 10)).toBe(false);
  });

  test('signing closes the recruitment for good', () => {
    const signed = sign(withCommitment()).recruiting;
    expect(signed.signed).toBe(true);
    expect(signed.commitment?.signed).toBe(true);
    expect(canSign(signed, 12, 10)).toBe(false);
    expect(() => commitTo(signed, 'kensington', 40)).toThrow(/already signed/);
  });

  function withCommitment(): RecruitingState {
    const state = runRecruiting(recruit({ nationalRank: 15 }), 20);
    return commitTo(state, activeOffers(state)[0]!.programId, 30).recruiting;
  }
});

describe('reading the board', () => {
  test('bestOffer picks the highest tier available', () => {
    const state = runRecruiting(recruit({ nationalRank: 12 }));
    const best = bestOffer(state);
    expect(best).not.toBeNull();

    for (const offer of activeOffers(state)) {
      const program = programById(offer.programId)!;
      expect(TIER_RANK[best!.tier]).toBeGreaterThanOrEqual(TIER_RANK[program.tier]);
    }
  });

  test('bestOffer is null when nobody wants you', () => {
    const rng = createRng(seedToState(3));
    expect(bestOffer(initialRecruiting(rng))).toBeNull();
  });
});

describe('recruiting inside a real run', () => {
  test('a strong career produces offers by senior year', () => {
    const state = autoTickMonths(createGame(3, INPUT), 52, (s) => {
      const budget = phaseFor(s.clock).actionPoints;
      return ['shooting', 'defense', 'study', 'lift'].slice(
        0,
        budget,
      ) as MonthAction[];
    });

    expect(state.recruiting.offers.length).toBeGreaterThan(0);
    expect(Object.keys(state.recruiting.interest)).toHaveLength(PROGRAMS.length);
  });

  test('visits from the month tick land on the program that was targeted', () => {
    const state = autoTickMonths(createGame(3, INPUT), 40, () => []);
    const before = state.recruiting.interest['crestview'] as number;

    const visited = autoTickMonths(state, 1, () => [
      { id: 'visit', target: 'crestview' },
    ]);
    expect(visited.recruiting.visitsThisCycle).toBeGreaterThan(
      state.recruiting.visitsThisCycle,
    );
    expect(visited.recruiting.interest['crestview'] as number).toBeGreaterThan(
      before,
    );
  });
});
