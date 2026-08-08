import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { SCHEMA_VERSION, type GameState } from '../engine/types';
import { createRng, seedToState } from '../engine/rng';
import { initialPeople } from '../engine/people';
import { initialNightlife } from '../engine/nightlife';

/**
 * IndexedDB persistence (SPEC §16.1) — in place from the first commit, because
 * retrofitting saves is the thing that has sunk past projects.
 */

export const DB_NAME = 'hooplife';
export const DB_VERSION = 1;
export const SAVES_STORE = 'saves';

/** Fixed slots, per SPEC §16.1's "multiple save slots". */
export const SLOT_COUNT = 3;
export type SlotId = 0 | 1 | 2;
export const SLOT_IDS: readonly SlotId[] = [0, 1, 2];

export interface SaveRecord {
  slot: SlotId;
  schemaVersion: number;
  savedAt: number;
  displayName: string;
  state: GameState;
}

interface HoopLifeDB extends DBSchema {
  [SAVES_STORE]: {
    key: SlotId;
    value: SaveRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<HoopLifeDB>> | null = null;

export function openGameDb(): Promise<IDBPDatabase<HoopLifeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HoopLifeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SAVES_STORE)) {
          db.createObjectStore(SAVES_STORE, { keyPath: 'slot' });
        }
      },
    });
  }
  return dbPromise;
}

/** Drop the cached connection. Tests use this to start from a clean handle. */
export function resetDbConnection(): void {
  dbPromise = null;
}

export function isValidSlot(slot: number): slot is SlotId {
  return Number.isInteger(slot) && slot >= 0 && slot < SLOT_COUNT;
}

/**
 * One step up the schema ladder.
 *
 * Keyed by the version being migrated *from*, so `migrate` can walk a save
 * forward one version at a time rather than needing a case per pair.
 */
type Step = (state: GameState) => GameState;

const STEPS: Record<number, Step> = {
  /**
   * v5 → v6: the life layer arrives (SPEC §6, §12).
   *
   * All three fields are additive, so a career in progress can be carried
   * forward rather than thrown away. The household is regenerated from the
   * save's own seed — deterministic, and it never touches `rngState`, so the
   * run stays reproducible from the month it resumes.
   */
  5: (state) => {
    const rng = createRng(seedToState((state.seed ^ 0x5f6c7d) >>> 0));
    const years = Math.floor(state.monthsElapsed / 12);
    const people = initialPeople(
      rng,
      state.player.name,
      state.origin.familyStructure,
    ).map((person) => ({ ...person, age: person.age + years }));

    return { ...state, schemaVersion: 6, people, assets: [], social: [] };
  },

  /**
   * v6 → v7: the off-court life (SPEC §6), and interactions stop being
   * rationed one per person per month.
   *
   * Both are additive. A career resumes with a clean slate on the nights,
   * which is the only honest default — the engine has no record of evenings
   * it never simulated.
   */
  6: (state) => ({
    ...state,
    schemaVersion: 7,
    nightlife: initialNightlife(),
    people: state.people.map((person) => ({
      ...person,
      interactionsThisMonth: 0,
    })),
  }),
};

/**
 * Bring a stored record up to the current schema.
 *
 * Walks one version at a time and throws the moment there is no step for the
 * version in hand. Best-effort loading a mismatched save is far worse to
 * debug than one that refuses — but a save that *can* be carried forward
 * should be, because on the other side of this is somebody's career.
 */
export function migrate(record: SaveRecord): GameState {
  let state = record.state;
  let version = record.schemaVersion;

  while (version !== SCHEMA_VERSION) {
    const step = STEPS[version];
    if (!step) {
      throw new Error(
        `Unsupported save schema v${record.schemaVersion} (this build reads v${SCHEMA_VERSION})`,
      );
    }
    state = step(state);
    if (state.schemaVersion === version) {
      throw new Error(`Migration from v${version} did not advance the version`);
    }
    version = state.schemaVersion;
  }

  return state;
}
