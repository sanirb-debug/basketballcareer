import { useState } from 'react';
import type { PublicView } from '../engine/selectors';
import type { Position, SchoolTier } from '../engine/types';

/**
 * Career-shaping decisions that are only open in certain windows (SPEC §4, §8).
 *
 * Surfaced on the month screen rather than buried in a menu, because the whole
 * point of the hidden growth curve is that you notice you have become a
 * different player and get to respond to it. A 6'9" point guard should be
 * *told* his body has changed, not left to find the option himself.
 */

interface Props {
  view: PublicView;
  onChangePosition: (position: Position) => void;
  onTransferSchool: (tier: SchoolTier) => void;
  onReclassify: () => void;
}

export default function BigChoicesPanel({
  view,
  onChangePosition,
  onTransferSchool,
  onReclassify,
}: Props) {
  const [open, setOpen] = useState<'position' | 'school' | null>(null);
  const { choices } = view;

  const anything =
    choices.canChangePosition || choices.canTransferSchool || choices.canReclassify;
  if (!anything) return null;

  // Only nag about a position change when the body has genuinely outgrown it.
  const current = choices.positionFits.find(
    (p) => p.position === view.player.position,
  );
  const best = choices.positionFits.find(
    (p) => p.position === choices.suggestedPosition,
  );
  const mismatch =
    Boolean(current && best) && (best?.fit ?? 0) - (current?.fit ?? 0) >= 25;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-5 py-4">
      <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
        Decisions open to you
      </h2>

      {mismatch && (
        <p className="mt-2 text-sm text-amber-300">
          You are {view.player.heightLabel} and still listed at{' '}
          {view.player.position}. Your body is built for{' '}
          {choices.suggestedPosition} now.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {choices.canChangePosition && (
          <button
            type="button"
            onClick={() => setOpen(open === 'position' ? null : 'position')}
            className={`rounded-md border px-4 py-2 text-sm ${
              mismatch
                ? 'border-amber-700 text-amber-300 hover:border-amber-500'
                : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
            }`}
          >
            Change position
          </button>
        )}
        {choices.canTransferSchool && (
          <button
            type="button"
            onClick={() => setOpen(open === 'school' ? null : 'school')}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
          >
            Transfer schools
          </button>
        )}
        {choices.canReclassify && (
          <button
            type="button"
            onClick={onReclassify}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
            title="Repeat a year to be older and more developed for your class"
          >
            Reclassify
          </button>
        )}
      </div>

      {open === 'position' && (
        <div className="mt-4">
          <p className="text-xs text-neutral-600">
            Fit is judged on your height. Changing costs some coach trust while
            you learn the job.
          </p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {choices.positionFits.map(({ position, fit }) => (
              <button
                key={position}
                type="button"
                disabled={position === view.player.position}
                onClick={() => {
                  onChangePosition(position);
                  setOpen(null);
                }}
                className="rounded-md border border-neutral-800 px-3 py-2 text-center hover:border-neutral-600 disabled:opacity-40"
              >
                <span className="block text-sm text-neutral-200">{position}</span>
                <span
                  className={`mt-0.5 block text-xs tabular-nums ${
                    fit >= 70
                      ? 'text-emerald-400'
                      : fit >= 40
                        ? 'text-neutral-500'
                        : 'text-red-500'
                  }`}
                >
                  {fit}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {open === 'school' && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-neutral-600">
            A transfer costs off-court character and starts you over with a
            staff that did not recruit you.
          </p>
          {choices.schoolOptions.map((option) => (
            <button
              key={option.tier}
              type="button"
              onClick={() => {
                onTransferSchool(option.tier as SchoolTier);
                setOpen(null);
              }}
              className="block w-full rounded-md border border-neutral-800 px-4 py-3 text-left hover:border-neutral-600"
            >
              <span className="text-sm font-medium text-neutral-100">
                {option.name}
              </span>
              <span className="mt-1 block text-xs leading-snug text-neutral-500">
                {option.blurb}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
