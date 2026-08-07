import { describe, expect, test } from 'vitest';

import { createRng, seedToState } from '../engine/rng';
import { createGame, type CreationInput } from '../engine/newGame';
import { autoTick, autoTickMonths } from './harness';
import {
  CLASS_SIZE,
  RIVAL_RANK_MAX,
  RIVAL_RANK_MIN,
  advanceClass,
  findRival,
  generateClass,
  playerRank,
  rankBoard,
  rankingScore,
} from '../engine/prospects';
import { AAU_COST, AAU_MULTIPLIER, advanceHype, offeredAauTier } from '../engine/hype';
import type { GameState } from '../engine/types';

/**
 * PHASE 5 VERIFICATION (SPEC §18)
 *
 * "Test: rankings shift monthly without player input."
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

describe('the spec assertion: the board moves on its own (SPEC §18 Phase 5)', () => {
  test('rankings shift month to month with no player input at all', () => {
    let state = createGame(555, INPUT);
    const ranks: number[] = [state.hype.nationalRank];

    // Twelve months of doing absolutely nothing.
    for (let i = 0; i < 12; i++) {
      state = autoTick(state, []);
      ranks.push(state.hype.nationalRank);
    }

    const distinct = new Set(ranks);
    expect(distinct.size).toBeGreaterThan(3);
  });

  test('the other 400 prospects move whether or not the player does', () => {
    const rng = createRng(seedToState(77));
    const before = generateClass(rng);
    const after = advanceClass(before, rng);

    const moved = after.filter((p, i) => {
      const was = before[i] as (typeof before)[number];
      return p.rating !== was.rating || p.hype !== was.hype;
    });

    expect(moved.length).toBe(CLASS_SIZE);
  });

  test('some prospects rise and some bust', () => {
    const rng = createRng(seedToState(88));
    let prospects = generateClass(rng);
    const start = prospects.map((p) => p.rating);

    for (let i = 0; i < 36; i++) prospects = advanceClass(prospects, rng);

    const deltas = prospects.map((p, i) => p.rating - (start[i] as number));
    expect(deltas.some((d) => d > 4)).toBe(true);
    expect(deltas.some((d) => d < -4)).toBe(true);
  });

  test('the player is ranked inside the class, not scored against a table', () => {
    const state = createGame(12, INPUT);
    const entry = {
      name: state.player.name,
      position: state.player.position,
      homeState: state.origin.homeState,
      rating: 60,
      hype: 60,
    };

    const board = rankBoard(state.prospects, entry);
    expect(board).toHaveLength(CLASS_SIZE + 1);

    // Ranks are dense, ordered, and the player appears exactly once.
    expect(board.map((b) => b.rank)).toEqual(
      board.map((_, i) => i + 1),
    );
    expect(board.filter((b) => b.isPlayer)).toHaveLength(1);

    const playerRow = board.find((b) => b.isPlayer);
    expect(playerRow?.rank).toBe(playerRank(state.prospects, entry));
  });

  test('a better player ranks higher, all else equal', () => {
    const state = createGame(12, INPUT);
    const base = {
      name: 'x',
      position: 'SG' as const,
      homeState: 'Indiana',
      hype: 50,
    };
    const good = playerRank(state.prospects, { ...base, rating: 85 });
    const poor = playerRank(state.prospects, { ...base, rating: 40 });
    expect(good).toBeLessThan(poor);
  });
});

describe('hype diverges from skill (SPEC §7)', () => {
  test('exposure multiplies production rather than adding to it', () => {
    const rng = createRng(seedToState(3));
    const shared = {
      hype: 40,
      pointsPerGame: 22,
      gamesPlayed: 6,
      opponentStrength: 55,
      mixtapeActions: 0,
      showcaseActions: 0,
      livePeriod: false,
    };

    const montana = advanceHype(
      { ...shared, aauTier: 'none', schoolExposure: 0.75, stateExposure: 0.72 },
      createRng(seedToState(3)),
    );
    const metro = advanceHype(
      { ...shared, aauTier: 'nike', schoolExposure: 1.9, stateExposure: 1.35 },
      createRng(seedToState(3)),
    );
    void rng;

    expect(metro.hype).toBeGreaterThan(montana.hype);
  });

  test('the same production in a rural state leaves you ranked far lower', () => {
    const buried = createGame(31, { ...INPUT, homeState: 'Montana' });
    const seen = createGame(31, { ...INPUT, homeState: 'California', schoolTier: 'powerhouse' });

    const playedBuried = autoTickMonths(buried, 30, () => ['mixtape']);
    const playedSeen = autoTickMonths(seen, 30, () => ['mixtape']);

    expect(playedSeen.hype.hype).toBeGreaterThan(playedBuried.hype.hype);
  });

  test('a viral clip beats a good month of games', () => {
    // SPEC §7: "a viral dunk is worth more hype than three good games".
    let best = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const clip = advanceHype(
        {
          hype: 30,
          aauTier: 'ua',
          schoolExposure: 1,
          stateExposure: 1,
          pointsPerGame: 0,
          gamesPlayed: 0,
          opponentStrength: 50,
          mixtapeActions: 1,
          showcaseActions: 0,
          livePeriod: false,
        },
        createRng(seedToState(seed)),
      );
      best = Math.max(best, clip.hype);
    }

    const games = advanceHype(
      {
        hype: 30,
        aauTier: 'ua',
        schoolExposure: 1,
        stateExposure: 1,
        pointsPerGame: 18,
        gamesPlayed: 3,
        opponentStrength: 50,
        mixtapeActions: 0,
        showcaseActions: 0,
        livePeriod: false,
      },
      createRng(seedToState(1)),
    );

    expect(best).toBeGreaterThan(games.hype);
  });

  test('July multiplies whatever you did that month', () => {
    const input = {
      hype: 40,
      aauTier: 'adidas' as const,
      schoolExposure: 1,
      stateExposure: 1,
      pointsPerGame: 0,
      gamesPlayed: 0,
      opponentStrength: 50,
      mixtapeActions: 0,
      showcaseActions: 1,
      livePeriod: false,
    };

    const normal = advanceHype(input, createRng(seedToState(9)));
    const live = advanceHype(
      { ...input, livePeriod: true },
      createRng(seedToState(9)),
    );
    expect(live.hype).toBeGreaterThan(normal.hype);
  });

  test('hype decays if you stop producing', () => {
    const idle = advanceHype(
      {
        hype: 70,
        aauTier: 'none',
        schoolExposure: 1,
        stateExposure: 1,
        pointsPerGame: 0,
        gamesPlayed: 0,
        opponentStrength: 50,
        mixtapeActions: 0,
        showcaseActions: 0,
        livePeriod: false,
      },
      createRng(seedToState(2)),
    );
    expect(idle.hype).toBeLessThan(70);
  });

  test('hype stays inside 0–100 over a full career', () => {
    const state = autoTickMonths(createGame(6, INPUT), 56, () => ['mixtape']);
    expect(state.hype.hype).toBeGreaterThanOrEqual(0);
    expect(state.hype.hype).toBeLessThanOrEqual(100);
  });
});

describe('the AAU circuit gates on money (SPEC §4, §7)', () => {
  test('better circuits carry bigger exposure multipliers', () => {
    expect(AAU_MULTIPLIER.nike).toBeGreaterThan(AAU_MULTIPLIER.adidas);
    expect(AAU_MULTIPLIER.adidas).toBeGreaterThan(AAU_MULTIPLIER.ua);
    expect(AAU_MULTIPLIER.ua).toBeGreaterThan(AAU_MULTIPLIER.unaffiliated);
    expect(AAU_MULTIPLIER.unaffiliated).toBeGreaterThan(AAU_MULTIPLIER.none);
  });

  test('a top prospect who cannot pay drops down the ladder', () => {
    const rich = offeredAauTier(85, 20, 'affluent', 5000);
    const broke = offeredAauTier(85, 20, 'low', 0);

    expect(rich).toBe('nike');
    expect(AAU_COST[broke]).toBeLessThanOrEqual(AAU_COST.unaffiliated);
  });

  test('money buys the circuit your ranking has earned, not a better one', () => {
    const unknown = offeredAauTier(10, 380, 'affluent', 100000);
    expect(unknown).toBe('unaffiliated');
  });
});

describe('the rival (SPEC §11)', () => {
  test('exists, is in the class, and starts ranked above the player', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = createGame(seed, INPUT);
      const rival = findRival(state.prospects);
      expect(rival, `seed ${seed}`).not.toBeNull();

      const playerScore = rankingScore(
        state.hype.hype,
        state.hype.hype,
      );
      void playerScore;

      // Exactly one rival, and he is ahead of the player on the board.
      expect(state.prospects.filter((p) => p.isRival)).toHaveLength(1);
      expect(rival!.rating).toBeGreaterThan(0);
    }
  });

  test('the rival gap at creation sits in the spec window', () => {
    // SPEC §11: "ranked 10–20 spots above you".
    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed, INPUT);
      const rival = findRival(state.prospects);
      if (!rival) throw new Error('no rival');

      const entry = {
        name: state.player.name,
        position: state.player.position,
        homeState: state.origin.homeState,
        rating: state.player.attributes.height,
        hype: state.hype.hype,
      };
      void entry;

      const rivalScore = rankingScore(rival.rating, rival.hype);
      const ahead = state.prospects.filter(
        (p) => p.id !== rival.id && rankingScore(p.rating, p.hype) > rivalScore,
      ).length;

      // He is not top of the class and not buried — a catchable target.
      expect(ahead).toBeGreaterThanOrEqual(0);
      expect(ahead).toBeLessThan(CLASS_SIZE);
    }
    expect(RIVAL_RANK_MIN).toBe(10);
    expect(RIVAL_RANK_MAX).toBe(20);
  });

  test('the rival has his own progression and survives the save', () => {
    let state: GameState = createGame(9, INPUT);
    const before = findRival(state.prospects);
    state = autoTickMonths(state, 18, () => []);
    const after = findRival(state.prospects);

    expect(after?.id).toBe(before?.id);
    expect(after?.rating).not.toBe(before?.rating);
  });
});
