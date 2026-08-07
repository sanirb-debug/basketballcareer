import { useCallback, useEffect, useState } from 'react';
import { createGame, randomSeed, type CreationInput } from './engine/newGame';
import { deepFreeze, latestGrowthNote, tick } from './engine/tick';
import { toPublicView } from './engine/selectors';
import { hashSeedString } from './engine/rng';
import type { GameState } from './engine/types';
import type { SlotId } from './save/db';
import {
  deleteSlot,
  listSlots,
  loadFromSlot,
  saveToSlot,
  type SlotSummary,
} from './save/saveGame';
import SlotPicker from './ui/SlotPicker';
import CharacterCreation from './ui/CharacterCreation';
import MonthScreen from './ui/MonthScreen';
import DebugPanel from './ui/DebugPanel';

type Screen = 'slots' | 'create' | 'month';

/** Freeze state in dev so an accidental mutation throws instead of corrupting a run. */
function guard(state: GameState): GameState {
  return import.meta.env.DEV ? deepFreeze(state) : state;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('slots');
  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [activeSlot, setActiveSlot] = useState<SlotId>(0);
  const [state, setState] = useState<GameState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSlots = useCallback(async () => {
    try {
      setSlots(await listSlots());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  const handleContinue = async (slot: SlotId) => {
    setError(null);
    try {
      const loaded = await loadFromSlot(slot);
      if (!loaded) return;
      setActiveSlot(slot);
      setState(guard(loaded));
      setScreen('month');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCreate = async (input: CreationInput, seedText: string) => {
    setError(null);
    const seed = seedText ? hashSeedString(seedText) : randomSeed();
    const created = createGame(seed, input);
    try {
      await saveToSlot(activeSlot, created);
      setState(guard(created));
      setScreen('month');
      void refreshSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Tick, then autosave — SPEC §16.1 requires a write on every month tick. */
  const handleNextMonth = async () => {
    if (!state || saving) return;
    setSaving(true);
    setError(null);
    const next = tick(state, []);
    try {
      await saveToSlot(activeSlot, next);
      setState(guard(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleExit = () => {
    setState(null);
    setScreen('slots');
    void refreshSlots();
  };

  const handleDelete = async (slot: SlotId) => {
    await deleteSlot(slot);
    void refreshSlots();
  };

  return (
    <main className="min-h-screen">
      {error && (
        <div className="border-b border-red-900 bg-red-950/60 px-8 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {screen === 'slots' && (
        <SlotPicker
          slots={slots}
          onContinue={handleContinue}
          onNewGame={(slot) => {
            setActiveSlot(slot);
            setScreen('create');
          }}
          onDelete={handleDelete}
        />
      )}

      {screen === 'create' && (
        <CharacterCreation
          slot={activeSlot}
          onCreate={handleCreate}
          onCancel={() => setScreen('slots')}
        />
      )}

      {screen === 'month' && state && (
        <>
          <MonthScreen
            view={toPublicView(state)}
            growthNote={latestGrowthNote(state)}
            saving={saving}
            onNextMonth={handleNextMonth}
            onExit={handleExit}
          />
          {import.meta.env.DEV && <DebugPanel state={state} />}
        </>
      )}
    </main>
  );
}
