import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { SCHEMA_VERSION, type GameState } from '../engine/types';

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
 * Bring a stored record up to the current schema.
 *
 * Deliberately throws on anything unrecognized rather than best-effort loading
 * a mismatched save — a save that loads *almost* correctly is far worse to
 * debug than one that refuses.
 */
export function migrate(record: SaveRecord): GameState {
  if (record.schemaVersion === SCHEMA_VERSION) return record.state;
  throw new Error(
    `Unsupported save schema v${record.schemaVersion} (this build reads v${SCHEMA_VERSION})`,
  );
}
