import { beforeEach, describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGame, type CreationInput } from '../engine/newGame';
import { deepFreeze, tick } from '../engine/tick';
import { createRng, hashSeedString, seedToState } from '../engine/rng';
import { SCHEMA_VERSION, type GameState, type MonthAction } from '../engine/types';
import { SLOT_IDS, type SlotId } from '../save/db';
import {
  deleteSlot,
  listSlots,
  loadFromSlot,
  putRawRecord,
  saveToSlot,
} from '../save/saveGame';

/**
 * PHASE 0 VERIFICATION (SPEC §18)
 *
 * "Tick 60 months, save, reload, confirm identical state; same seed reproduces
 * run exactly."
 */

const SEED = 20260807;

const INPUT: CreationInput = {
  name: 'Marcus Vale',
  position: 'SG',
  jerseyNumber: 3,
  handedness: 'right',
  homeCity: 'Gary',
  homeState: 'Indiana',
  schoolTier: 'public',
};

function tickMonths(state: GameState, months: number): GameState {
  let next = state;
  for (let i = 0; i < months; i++) next = tick(next, []);
  return next;
}

beforeEach(async () => {
  for (const slot of SLOT_IDS) await deleteSlot(slot);
});

describe('seeded RNG (SPEC §16.2)', () => {
  test('the same seed produces an identical stream', () => {
    const a = createRng(seedToState(SEED));
    const b = createRng(seedToState(SEED));
    const left = Array.from({ length: 500 }, () => a.next());
    const right = Array.from({ length: 500 }, () => b.next());
    expect(left).toEqual(right);
  });

  test('different seeds diverge', () => {
    const a = createRng(seedToState(SEED));
    const b = createRng(seedToState(SEED + 1));
    expect(Array.from({ length: 50 }, () => a.next())).not.toEqual(
      Array.from({ length: 50 }, () => b.next()),
    );
  });

  test('restoring a captured state resumes the stream exactly', () => {
    const original = createRng(seedToState(SEED));
    for (let i = 0; i < 137; i++) original.next();

    const captured = original.state();
    const expected = Array.from({ length: 200 }, () => original.next());

    // A single uint32 is the whole stream state — no replay needed.
    const resumed = createRng(captured);
    expect(Array.from({ length: 200 }, () => resumed.next())).toEqual(expected);
  });

  test('draws stay in range and the call counter tracks consumption', () => {
    const rng = createRng(seedToState(SEED));
    for (let i = 0; i < 2000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(rng.state().calls).toBe(2000);

    const helpers = createRng(seedToState(SEED));
    for (let i = 0; i < 200; i++) {
      const n = helpers.int(3, 7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  test('a seed string always hashes to the same seed', () => {
    expect(hashSeedString('gary indiana')).toBe(hashSeedString('gary indiana'));
    expect(hashSeedString('gary indiana')).not.toBe(hashSeedString('gary illinois'));
  });
});

describe('month tick engine (SPEC §16.3)', () => {
  test('is pure — it does not mutate the state it is given', () => {
    const state = createGame(SEED, INPUT);
    const before = structuredClone(state);
    tick(state, []);
    expect(state).toEqual(before);
  });

  test('is deterministic — the same input always yields the same output', () => {
    const state = createGame(SEED, INPUT);
    expect(tick(state, [])).toEqual(tick(state, []));
  });

  test('advances the clock and the RNG stream every month', () => {
    const state = createGame(SEED, INPUT);
    const next = tick(state, []);
    expect(next.monthsElapsed).toBe(state.monthsElapsed + 1);
    expect(next.rngState.calls).toBeGreaterThan(state.rngState.calls);
  });

  test('rejects more actions than the month affords', () => {
    const state = createGame(SEED, INPUT);
    // September is offseason: 4 action points, so a fifth is a caller bug.
    const tooMany: MonthAction[] = ['lift', 'lift', 'lift', 'lift', 'lift'];
    expect(() => tick(state, tooMany)).toThrow(/Too many actions/);
  });

  test('rejects an unknown action rather than silently dropping it', () => {
    const state = createGame(SEED, INPUT);
    const bogus = ['nap'] as unknown as MonthAction[];
    expect(() => tick(state, bogus)).toThrow(/Unknown action/);
  });

  test('rolls the calendar over correctly across 60 months', () => {
    const state = createGame(SEED, INPUT);
    const after = tickMonths(state, 60);
    // Starts August 2026; 60 months later is August 2031.
    expect(after.clock).toEqual({ year: 2031, month: 7 });
    expect(after.monthsElapsed).toBe(60);
  });

  test('deepFreeze makes accidental mutation throw', () => {
    const state = deepFreeze(createGame(SEED, INPUT));
    expect(() => {
      (state as { monthsElapsed: number }).monthsElapsed = 99;
    }).toThrow();
    expect(() => {
      (state.player.body as { heightInches: number }).heightInches = 99;
    }).toThrow();
  });
});

describe('save / reload (SPEC §16.1)', () => {
  test('60 months round-trips through IndexedDB with identical state', async () => {
    const played = tickMonths(createGame(SEED, INPUT), 60);

    await saveToSlot(0, played);
    const reloaded = await loadFromSlot(0);

    expect(reloaded).not.toBeNull();
    expect(reloaded).toEqual(played);
    // The RNG stream in particular — this is what makes the run resumable.
    expect(reloaded?.rngState).toEqual(played.rngState);
  });

  test('a reloaded save continues the run identically', async () => {
    const played = tickMonths(createGame(SEED, INPUT), 60);
    await saveToSlot(0, played);
    const reloaded = await loadFromSlot(0);
    if (!reloaded) throw new Error('expected a save');

    // A save can round-trip looking correct while carrying a desynced RNG
    // stream; that only shows up once you keep playing. So keep playing.
    expect(tickMonths(reloaded, 12)).toEqual(tickMonths(played, 12));
  });

  test('autosaving every month leaves the slot holding the final state', async () => {
    let state = createGame(SEED, INPUT);
    await saveToSlot(1, state);
    for (let i = 0; i < 60; i++) {
      state = tick(state, []);
      await saveToSlot(1, state);
    }
    expect(await loadFromSlot(1)).toEqual(state);
  });

  test('slots are independent', async () => {
    const a = tickMonths(createGame(SEED, INPUT), 10);
    const b = tickMonths(createGame(SEED + 99, INPUT), 20);

    await saveToSlot(0, a);
    await saveToSlot(2, b);

    expect(await loadFromSlot(0)).toEqual(a);
    expect(await loadFromSlot(2)).toEqual(b);
    expect(await loadFromSlot(1)).toBeNull();

    const summaries = await listSlots();
    expect(summaries.map((s) => s.occupied)).toEqual([true, false, true]);
    expect(summaries[0]?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  test('deleting a slot empties it', async () => {
    await saveToSlot(0, createGame(SEED, INPUT));
    await deleteSlot(0);
    expect(await loadFromSlot(0)).toBeNull();
  });

  test('an unknown schema version is refused rather than half-loaded', async () => {
    await putRawRecord({
      slot: 0,
      schemaVersion: 999,
      savedAt: Date.now(),
      displayName: 'from the future',
      state: createGame(SEED, INPUT),
    });
    await expect(loadFromSlot(0)).rejects.toThrow(/schema/i);
  });

  test('rejects an out-of-range slot', async () => {
    await expect(saveToSlot(7 as SlotId, createGame(SEED, INPUT))).rejects.toThrow();
  });
});

describe('reproducibility (SPEC §16.2)', () => {
  test('the same seed reproduces a 60-month run exactly', () => {
    const first = tickMonths(createGame(SEED, INPUT), 60);
    const second = tickMonths(createGame(SEED, INPUT), 60);
    expect(second).toEqual(first);
  });

  test('a different seed produces a different run', () => {
    const first = tickMonths(createGame(SEED, INPUT), 60);
    const other = tickMonths(createGame(SEED + 1, INPUT), 60);
    expect(other).not.toEqual(first);
  });

  test('hidden genetics are reproduced too, not just visible state', () => {
    expect(createGame(SEED, INPUT).hidden.genetics).toEqual(
      createGame(SEED, INPUT).hidden.genetics,
    );
  });
});

describe('every random call routes through the seeded RNG (SPEC §16.2)', () => {
  const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));

  function sourceFiles(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) sourceFiles(full, found);
      else if (/\.tsx?$/.test(entry)) found.push(full);
    }
    return found;
  }

  // Built at runtime so the needles never appear literally in this file and
  // trip their own scan.
  const UNSEEDED = ['Math', 'random'].join('.');
  const SEED_BOOTSTRAP = ['crypto', 'getRandomValues'].join('.');

  test('no unseeded randomness anywhere in src/', () => {
    const offenders = sourceFiles(SRC_ROOT).filter((file) =>
      readFileSync(file, 'utf8').includes(UNSEEDED),
    );
    expect(offenders.map((f) => f.replace(SRC_ROOT, 'src/'))).toEqual([]);
  });

  test('the platform RNG is confined to the seed bootstrap', () => {
    const users = sourceFiles(SRC_ROOT)
      .filter((file) => readFileSync(file, 'utf8').includes(SEED_BOOTSTRAP))
      .map((f) => f.replace(SRC_ROOT, 'src/'));
    expect(users).toEqual(['src/engine/newGame.ts']);
  });
});
