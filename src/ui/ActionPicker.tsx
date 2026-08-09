import { ACTIONS, ENERGY_ENABLED, diminishingFor } from '../engine/actions';
import { programById } from '../engine/colleges';
import {
  ACTION_IDS,
  type ActionId,
  type MonthAction,
  type TrainingState,
} from '../engine/types';

/**
 * Planning the month (SPEC §3, §6).
 *
 * Ten slots changed what this screen has to be. A row of ten empty boxes and
 * a grid you click ten times is a chore; what a player actually wants to say
 * is "four shooting, two lifts, some film" — a quantity, not a sequence. So
 * every action is one row with a stepper, the count is the state, and the
 * whole month can be planned without scrolling twice.
 *
 * The two numbers on a row are the honest ones: how many of this you have
 * planned, and how much the *next* one would be worth. Repeats fall away
 * fast inside a month, and showing that is what turns ten slots into a menu
 * rather than a button to hold down.
 */

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

/** Mirrors the engine's within-month repeat curve, for the "next is worth" hint. */
const REPEAT_FALLOFF = 0.72;

export default function ActionPicker({
  budget,
  chosen,
  training,
  onChange,
}: Props) {
  const counts = new Map<ActionId, number>();
  const targeted: { id: ActionId; target: string }[] = [];

  for (const action of chosen) {
    const id = typeof action === 'string' ? action : action.id;
    const target = typeof action === 'string' ? null : (action.target ?? null);
    if (target) targeted.push({ id, target });
    else counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const used = chosen.length;
  const remaining = budget - used;

  const setCount = (id: ActionId, next: number) => {
    // Everything that is not a bare instance of this action survives — which
    // deliberately includes targeted actions like a queued campus visit, so
    // stepping Shooting up and down never drops a visit off the plan.
    const keep = chosen.filter((a) => typeof a !== 'string' || a !== id);
    onChange([...keep, ...Array.from({ length: next }, () => id)]);
  };

  const bump = (id: ActionId, delta: number) => {
    const current = counts.get(id) ?? 0;
    const next = Math.max(0, current + delta);
    if (delta > 0 && remaining <= 0) return;
    setCount(id, next);
  };

  const clear = () => onChange([]);

  return (
    <section>
      {/* --- Header ------------------------------------------------------- */}
      <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center gap-3 rounded-lg bg-neutral-900/95 px-3 py-2.5 backdrop-blur">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums text-orange-400">
            {used}
          </span>
          <span className="text-sm text-neutral-400">
            of {budget} planned
          </span>
        </div>
        {used > 0 && (
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-500"
          >
            Clear
          </button>
        )}
      </div>

      {/* --- What is planned --------------------------------------------- */}
      {used === 0 ? (
        <p className="mb-5 text-sm text-neutral-500">
          Nothing planned. Add as much as you like — ten is the ceiling, and
          doing the same thing over and over gets you less each time. Whatever
          you set here carries into next month, so a routine only has to be
          built once.
        </p>
      ) : (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {[...counts.entries()].map(([id, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => bump(id, -1)}
              className="group rounded-full border border-orange-700/70 bg-orange-950/40 px-3 py-1 text-xs text-orange-200 transition hover:border-orange-500"
            >
              {ACTIONS[id].label}
              {n > 1 && <span className="ml-1 opacity-70">×{n}</span>}
              <span className="ml-1.5 text-orange-500/60 group-hover:text-orange-300">
                ×
              </span>
            </button>
          ))}
          {targeted.map((t, i) => (
            <span
              key={`${t.id}-${i}`}
              className="rounded-full border border-violet-700/70 bg-violet-950/40 px-3 py-1 text-xs text-violet-200"
            >
              Visit {programById(t.target)?.name ?? t.target}
            </span>
          ))}
        </div>
      )}

      {/* --- The menu ----------------------------------------------------- */}
      <div className="space-y-6">
        {CATEGORY_ORDER.map((category) => {
          const ids = ACTION_IDS.filter(
            (id) =>
              ACTIONS[id].category === category &&
              (ENERGY_ENABLED || !HIDDEN_WHILE_NO_ENERGY.has(id)),
          );
          if (ids.length === 0) return null;

          return (
            <div key={category}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                {CATEGORY_LABEL[category]}
              </div>

              <ul className="divide-y divide-neutral-800/80 overflow-hidden rounded-xl border border-neutral-800">
                {ids.map((id) => {
                  const def = ACTIONS[id];
                  const n = counts.get(id) ?? 0;
                  // A visit needs a target, so it is queued from the
                  // recruiting board rather than picked off this list.
                  const needsTarget = id === 'visit';

                  // What the next one of these would actually be worth,
                  // combining the across-month streak and this month's repeats.
                  const streak = training.streaks[id] ?? 0;
                  const nextWorth =
                    diminishingFor(streak + n) * Math.pow(REPEAT_FALLOFF, n);
                  const faded = def.trains.length > 0 && nextWorth < 0.7;

                  return (
                    <li
                      key={id}
                      className={`flex items-center gap-3 px-4 py-3 transition ${
                        n > 0 ? 'bg-orange-950/20' : 'bg-neutral-900/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium text-neutral-100">
                            {def.label}
                          </span>
                          {faded && (
                            <span className="text-[11px] tabular-nums text-amber-500/90">
                              next ×{nextWorth.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-neutral-500">
                          {needsTarget
                            ? 'Pick a program on the Career tab.'
                            : def.description}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={n === 0 || needsTarget}
                          onClick={() => bump(id, -1)}
                          aria-label={`One fewer ${def.label}`}
                          className="h-8 w-8 rounded-lg border border-neutral-700 text-neutral-300 transition hover:border-neutral-500 disabled:opacity-25"
                        >
                          −
                        </button>
                        <span
                          className={`w-6 text-center text-sm tabular-nums ${
                            n > 0 ? 'font-semibold text-orange-300' : 'text-neutral-600'
                          }`}
                        >
                          {n}
                        </span>
                        <button
                          type="button"
                          disabled={remaining <= 0 || needsTarget}
                          onClick={() => bump(id, 1)}
                          aria-label={`One more ${def.label}`}
                          className="h-8 w-8 rounded-lg border border-neutral-700 text-neutral-300 transition hover:border-orange-600 hover:text-orange-300 disabled:opacity-25"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
