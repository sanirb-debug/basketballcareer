import type { SlotId } from '../save/db';
import type { SlotSummary } from '../save/saveGame';

interface Props {
  slots: SlotSummary[];
  onContinue: (slot: SlotId) => void;
  onNewGame: (slot: SlotId) => void;
  onDelete: (slot: SlotId) => void;
}

export default function SlotPicker({
  slots,
  onContinue,
  onNewGame,
  onDelete,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Hoop Life</h1>
      <p className="mt-2 text-neutral-400">
        Thirteen years old. Nobody knows how tall you finish.
      </p>

      <h2 className="mt-12 text-sm font-medium uppercase tracking-widest text-neutral-500">
        Save slots
      </h2>

      <div className="mt-4 space-y-3">
        {slots.map((slot) => (
          <div
            key={slot.slot}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-5 py-4"
          >
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Slot {slot.slot + 1}
              </div>
              <div className="mt-1 text-lg">
                {slot.occupied ? (
                  slot.displayName
                ) : (
                  <span className="text-neutral-600">Empty</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {slot.occupied && (
                <>
                  <button
                    type="button"
                    onClick={() => onContinue(slot.slot)}
                    className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium hover:bg-orange-500"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(slot.slot)}
                    className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                  >
                    Delete
                  </button>
                </>
              )}
              {!slot.occupied && (
                <button
                  type="button"
                  onClick={() => onNewGame(slot.slot)}
                  className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
                >
                  New career
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
