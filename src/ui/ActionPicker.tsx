import { ACTIONS, TRAINING, diminishingFor } from '../engine/actions';
import { ACTION_IDS, type ActionId, type TrainingState } from '../engine/types';

interface Props {
  budget: number;
  chosen: ActionId[];
  training: TrainingState;
  energy: number;
  onChange: (next: ActionId[]) => void;
}

const CATEGORY_ORDER = ['training', 'team', 'recovery'] as const;

export default function ActionPicker({
  budget,
  chosen,
  training,
  energy,
  onChange,
}: Props) {
  const remaining = budget - chosen.length;

  // Preview where energy lands if the month is played as currently planned.
  const projectedEnergy = chosen.reduce(
    (e, id) => Math.max(0, Math.min(100, e - ACTIONS[id].energyCost)),
    Math.min(100, energy + TRAINING.PASSIVE_ENERGY_REGEN),
  );

  const add = (id: ActionId) => {
    if (remaining <= 0) return;
    onChange([...chosen, id]);
  };

  const removeAt = (index: number) => {
    onChange(chosen.filter((_, i) => i !== index));
  };

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          This month
        </h2>
        <div className="text-sm text-neutral-400">
          <span
            className={
              remaining === 0 ? 'text-neutral-500' : 'font-medium text-orange-400'
            }
          >
            {remaining}
          </span>{' '}
          of {budget} action point{budget === 1 ? '' : 's'} left
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: budget }).map((_, slot) => {
          const id = chosen[slot];
          if (!id) {
            return (
              <div
                key={slot}
                className="rounded-md border border-dashed border-neutral-800 px-4 py-2 text-sm text-neutral-600"
              >
                empty slot
              </div>
            );
          }
          return (
            <button
              key={slot}
              type="button"
              onClick={() => removeAt(slot)}
              className="group rounded-md border border-orange-800 bg-orange-950/40 px-4 py-2 text-sm text-orange-200 hover:border-orange-600"
            >
              {ACTIONS[id].label}
              <span className="ml-2 text-orange-500/70 group-hover:text-orange-300">
                ×
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {CATEGORY_ORDER.flatMap((category) =>
          ACTION_IDS.filter((id) => ACTIONS[id].category === category).map((id) => {
            const def = ACTIONS[id];
            const streak = training.streaks[id] ?? 0;
            const multiplier = diminishingFor(streak);
            const stale = multiplier < 1 && def.trains.length > 0;

            return (
              <button
                key={id}
                type="button"
                disabled={remaining <= 0}
                onClick={() => add(id)}
                className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>
                  <span className="block text-sm font-medium text-neutral-100">
                    {def.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                    {def.description}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums">
                  <span
                    className={
                      def.energyCost < 0 ? 'text-emerald-400' : 'text-neutral-500'
                    }
                  >
                    {def.energyCost < 0 ? '+' : '−'}
                    {Math.abs(def.energyCost)} nrg
                  </span>
                  {stale && (
                    <span className="mt-0.5 block text-amber-500">
                      ×{multiplier.toFixed(1)}
                    </span>
                  )}
                </span>
              </button>
            );
          }),
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        Energy after this month:{' '}
        <span
          className={
            projectedEnergy < 35 ? 'text-red-400' : 'text-neutral-400'
          }
        >
          {Math.round(projectedEnergy)}
        </span>
        {projectedEnergy < 35 && ' — low energy sharply raises injury risk'}
      </p>
    </section>
  );
}
