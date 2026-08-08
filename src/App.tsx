import { useCallback, useEffect, useState } from 'react';
import { createGame, randomSeed, type CreationInput } from './engine/newGame';
import { deepFreeze, latestLog, tick } from './engine/tick';
import { applyEventChoice } from './engine/events/engine';
import { toPublicView } from './engine/selectors';
import { exportCareerText } from './engine/careerExport';
import { commitTo, decommit, sign } from './engine/recruiting';
import {
  changePosition,
  choosePath,
  declareForDraft,
  reclassify,
  transferSchool,
  enterPortal,
  redshirt,
  requestTrade,
  transferTo,
  withdrawFromDraft,
} from './engine/decisions';
import type {
  PostHighSchoolPath,
  Position,
  SchoolTier,
  SocialPlatformId,
} from './engine/types';
import {
  buyAsset,
  goOut,
  interactWith,
  joinPlatform,
  makePost,
} from './engine/lifeActions';
import type { NightId } from './engine/nightlife';
import type { InteractionId } from './engine/people';
import type { PostKind } from './engine/activities';
import { hashSeedString, clamp } from './engine/rng';
import { phaseFor } from './engine/calendar';
import type { GameState, MonthAction } from './engine/types';
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
import CareerEndScreen from './ui/CareerEndScreen';
import PathChoiceScreen from './ui/PathChoiceScreen';
import EventModal from './ui/EventModal';

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
  const [chosen, setChosen] = useState<MonthAction[]>([]);
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

  /** Persist and adopt a new state. Autosave on every change (SPEC §16.1). */
  const commitState = async (next: GameState) => {
    setSaving(true);
    setError(null);
    try {
      await saveToSlot(activeSlot, next);
      setState(guard(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const openRun = (loaded: GameState, slot: SlotId) => {
    setActiveSlot(slot);
    setState(guard(loaded));
    setChosen([]);
    setScreen('month');
  };

  const handleContinue = async (slot: SlotId) => {
    setError(null);
    try {
      const loaded = await loadFromSlot(slot);
      if (!loaded) return;
      openRun(loaded, slot);
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
      openRun(created, activeSlot);
      void refreshSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleNextMonth = async () => {
    if (!state || saving) return;
    try {
      const next = tick(state, chosen);
      setChosen([]);
      await commitState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Answer a pending event (SPEC §12) — the clock stays frozen until this runs. */
  const handleEventChoice = async (index: number) => {
    if (!state || saving) return;
    try {
      await commitState(applyEventChoice(state, index));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCommit = async (programId: string) => {
    if (!state) return;
    try {
      const result = commitTo(state.recruiting, programId, state.monthsElapsed);
      await commitState(withRecruiting(state, result.recruiting, result.characterDelta, result.note));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDecommit = async () => {
    if (!state) return;
    try {
      const result = decommit(state.recruiting);
      await commitState(withRecruiting(state, result.recruiting, result.characterDelta, result.note));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSign = async () => {
    if (!state) return;
    try {
      const result = sign(state.recruiting);
      const signed = withRecruiting(
        state,
        result.recruiting,
        0,
        result.notes[0] ?? 'Signed.',
      );
      // Signing is a commitment, not an ending — the road continues into
      // college and beyond (SPEC §14).
      await commitState(signed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** A pure decision helper: apply it, persist it, surface any error. */
  const applyDecision = async (fn: (state: GameState) => GameState) => {
    if (!state || saving) return;
    try {
      await commitState(fn(state));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleChoosePath = (path: PostHighSchoolPath) =>
    applyDecision((s) => choosePath(s, path));
  const handleRedshirt = () => applyDecision(redshirt);
  const handleEnterPortal = () => applyDecision(enterPortal);
  const handleTransfer = (programId: string) =>
    applyDecision((s) => transferTo(s, programId));
  const handleDeclare = (testingWaters: boolean) =>
    applyDecision((s) => declareForDraft(s, testingWaters));
  const handleWithdraw = () => applyDecision(withdrawFromDraft);
  const handleRequestTrade = () => applyDecision(requestTrade);
  const handleChangePosition = (position: Position) =>
    applyDecision((s) => changePosition(s, position));
  const handleTransferSchool = (tier: SchoolTier) =>
    applyDecision((s) => transferSchool(s, tier));
  const handleReclassify = () => applyDecision(reclassify);

  // Life outside the tick (SPEC §6, §12). Same decision path as everything
  // else, so each one persists immediately and cannot desync the RNG.
  const handleInteract = (personId: string, interaction: InteractionId) =>
    applyDecision((s) => interactWith(s, personId, interaction));
  const handleBuy = (assetId: string) =>
    applyDecision((s) => buyAsset(s, assetId));
  const handleJoinPlatform = (platformId: SocialPlatformId) =>
    applyDecision((s) => joinPlatform(s, platformId));
  const handlePost = (platformId: SocialPlatformId, kind: PostKind) =>
    applyDecision((s) => makePost(s, platformId, kind));
  const handleGoOut = (nightId: NightId) =>
    applyDecision((s) => goOut(s, nightId));

  const handleExit = () => {
    setState(null);
    setChosen([]);
    setScreen('slots');
    void refreshSlots();
  };

  const handleDelete = async (slot: SlotId) => {
    await deleteSlot(slot);
    void refreshSlots();
  };

  // Trim any selection that no longer fits — the budget shrinks from four to
  // two the moment the season opens.
  const budget = state ? phaseFor(state.clock, state.stage).actionPoints : 0;
  const fitted = chosen.length > budget ? chosen.slice(0, budget) : chosen;

  const view = state ? toPublicView(state) : null;

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

      {screen === 'month' && state && view && (
        <>
          {state.careerEnd ? (
            <CareerEndScreen
              view={view}
              exportText={() => exportCareerText(state)}
              onExit={handleExit}
            />
          ) : state.awaitingPath ? (
            <PathChoiceScreen
              view={view}
              busy={saving}
              onChoose={handleChoosePath}
            />
          ) : (
            <MonthScreen
              view={view}
              training={state.training}
              chosen={fitted}
              monthLog={latestLog(state)}
              saving={saving}
              exportText={() => exportCareerText(state)}
              onChange={setChosen}
              onNextMonth={handleNextMonth}
              onExit={handleExit}
              onCommit={handleCommit}
              onDecommit={handleDecommit}
              onSign={handleSign}
              onRedshirt={handleRedshirt}
              onEnterPortal={handleEnterPortal}
              onTransfer={handleTransfer}
              onDeclare={handleDeclare}
              onWithdraw={handleWithdraw}
              onRequestTrade={handleRequestTrade}
              onChangePosition={handleChangePosition}
              onTransferSchool={handleTransferSchool}
              onReclassify={handleReclassify}
              onInteract={handleInteract}
              onBuy={handleBuy}
              onJoinPlatform={handleJoinPlatform}
              onPost={handlePost}
              onGoOut={handleGoOut}
            />
          )}

          {view.pendingEvent && !state.careerEnd && (
            <EventModal
              event={view.pendingEvent}
              onChoose={handleEventChoice}
              busy={saving}
            />
          )}

          {import.meta.env.DEV && <DebugPanel state={state} />}
        </>
      )}
    </main>
  );
}

/** Apply a recruiting decision plus its reputation consequence and log line. */
function withRecruiting(
  state: GameState,
  recruiting: GameState['recruiting'],
  characterDelta: number,
  note: string,
): GameState {
  return {
    ...state,
    recruiting,
    reputation: {
      ...state.reputation,
      offCourt: clamp(state.reputation.offCourt + characterDelta, 0, 100),
    },
    log: [
      ...state.log,
      {
        monthsElapsed: state.monthsElapsed,
        year: state.clock.year,
        month: state.clock.month,
        kind: 'recruiting',
        text: note,
      },
    ],
  };
}
