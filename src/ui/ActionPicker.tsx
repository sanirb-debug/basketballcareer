import {
  ACTIONS,
  ENERGY_ENABLED,
  TRAINING,
  diminishingFor,
  normalizeActions,
} from '../engine/actions';
import { programById } from '../engine/colleges';
import {
  ACTION_IDS,
  type ActionId,
  type MonthAction,
  type TrainingState,
} from '../engine/types';

interface Props {
  budget: number;
  chosen: MonthAction[];
  training: TrainingState;
  energy: number;
  onChange: (next: MonthAction[]) => void;
}

/** With energy off there is nothing to recover, so Rest has no job. */
const HIDDEN_WHILE_NO_ENERGY = new Set(['rest']);

const CATEGORY_ORDER = [
  'training',
  'team',
  'academic',
  'exposure',
  'life',
  'recovery',
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  training: 'Training',
  team: 'Team',
  academic: 'School',
  exposure: 'Exposure',
  life: 'Life',
  recovery: 'Recovery',
};

export default function ActionPicker({
  budget,
  chosen,
  training,
  energy,
  onChange,
}: Props) {
  const normalized = normalizeActions(chosen);
  const remaining = budget - chosen.length;

  const projectedEnergy = normalized.reduce(
    (e, a) => Math.max(0, Math.min(100, e - ACTIONS[a.id].energyCost)),
    Math.min(100, energy + TRAINING.PASSIVE_ENERGY_REGEN),
  );

  const add = (id: ActionId) => {
    if (remaining <= 0) return;
    onChange([...chosen, id]);
  };

  const removeAt = (index: number) => {
    onChange(chosen.filter((_, i) => i !== index));
  };

  const labelFor = (index: number): string => {
    const action = normalized[index];
    if (!action) return '';
    if (action.id === 'visit' && action.target) {
      return `Visit ${programById(action.target)?.name ?? action.target}`;
    }
    return ACTIONS[action.id].label;
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
          if (!chosen[slot]) {
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
              {labelFor(slot)}
              <span className="ml-2 text-orange-500/70 group-hover:text-orange-300">
                ×
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-5">
        {CATEGORY_ORDER.map((category) => {
          const ids = ACTION_IDS.filter(
            (id) =>
              ACTIONS[id].category === category &&
              (ENERGY_ENABLED || !HIDDEN_WHILE_NO_ENERGY.has(id)),
          );
          if (ids.length === 0) return null;

          return (
            <div key={category}>
              <div className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">
                {CATEGORY_LABEL[category]}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ids.map((id) => {
                  const def = ACTIONS[id];
                  const streak = training.streaks[id] ?? 0;
                  const multiplier = diminishingFor(streak);
                  const stale = multiplier < 1 && def.trains.length > 0;
                  // A visit needs a target, so it is queued from the
                  // recruiting board rather than picked off this list.
                  const needsTarget = id === 'visit';

                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={remaining <= 0 || needsTarget}
                      onClick={() => add(id)}
                      title={
                        needsTarget
                          ? 'Queue a visit from the Recruiting tab'
                          : undefined
                      }
                      className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span>
                        <span className="block text-sm font-medium text-neutral-100">
                          {def.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                          {needsTarget
                            ? 'Pick a program on the Recruiting tab.'
                            : def.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums">
                        {ENERGY_ENABLED && (
                          <span
                            className={
                              def.energyCost < 0
                                ? 'text-emerald-400'
                                : 'text-neutral-500'
                            }
                          >
                            {def.energyCost < 0 ? '+' : '−'}
                            {Math.abs(def.energyCost)} nrg
                          </span>
                        )}
                        {stale && (
                          <span className="mt-0.5 block text-amber-500">
                            ×{multiplier.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {ENERGY_ENABLED && (
        <p className="mt-4 text-xs text-neutral-600">
          Energy after this month:{' '}
          <span
            className={projectedEnergy < 35 ? 'text-red-400' : 'text-neutral-400'}
          >
            {Math.round(projectedEnergy)}
          </span>
          {projectedEnergy < 35 && ' — low energy sharply raises injury risk'}
        </p>
      )}
    </section>
  );
}
