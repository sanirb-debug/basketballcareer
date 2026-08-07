import { formatClock } from '../engine/calendar';
import { SCHEMA_VERSION, type GameState } from '../engine/types';
import {
  SAVES_STORE,
  SLOT_IDS,
  isValidSlot,
  migrate,
  openGameDb,
  type SaveRecord,
  type SlotId,
} from './db';

export interface SlotSummary {
  slot: SlotId;
  occupied: boolean;
  displayName?: string;
  savedAt?: number;
  schemaVersion?: number;
}

function displayNameFor(state: GameState): string {
  return `${state.player.name} — ${formatClock(state.clock)}`;
}

/**
 * Persist a run. Called on every month tick (SPEC §16.1: "Autosave on every
 * month tick"), so it must stay cheap and must never partially write.
 */
export async function saveToSlot(
  slot: SlotId,
  state: GameState,
): Promise<SaveRecord> {
  if (!isValidSlot(slot)) throw new Error(`saveToSlot: invalid slot ${slot}`);

  const record: SaveRecord = {
    slot,
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    displayName: displayNameFor(state),
    state,
  };

  const db = await openGameDb();
  await db.put(SAVES_STORE, record);
  return record;
}

export async function loadFromSlot(slot: SlotId): Promise<GameState | null> {
  if (!isValidSlot(slot)) throw new Error(`loadFromSlot: invalid slot ${slot}`);

  const db = await openGameDb();
  const record = await db.get(SAVES_STORE, slot);
  if (!record) return null;
  return migrate(record);
}

export async function listSlots(): Promise<SlotSummary[]> {
  const db = await openGameDb();
  const records = await db.getAll(SAVES_STORE);
  const bySlot = new Map(records.map((r) => [r.slot, r]));

  return SLOT_IDS.map((slot) => {
    const record = bySlot.get(slot);
    if (!record) return { slot, occupied: false };
    return {
      slot,
      occupied: true,
      displayName: record.displayName,
      savedAt: record.savedAt,
      schemaVersion: record.schemaVersion,
    };
  });
}

export async function deleteSlot(slot: SlotId): Promise<void> {
  if (!isValidSlot(slot)) throw new Error(`deleteSlot: invalid slot ${slot}`);
  const db = await openGameDb();
  await db.delete(SAVES_STORE, slot);
}

/** Write a record directly. Tests use this to plant a bad schema version. */
export async function putRawRecord(record: SaveRecord): Promise<void> {
  const db = await openGameDb();
  await db.put(SAVES_STORE, record);
}
