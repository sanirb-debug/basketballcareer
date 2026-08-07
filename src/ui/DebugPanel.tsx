import { useState } from 'react';
import { formatHeight } from '../engine/calendar';
import { isInSpurtWindow } from '../engine/growth';
import type { GameState } from '../engine/types';

/**
 * DEV-only reveal of the hidden genetic roll.
 *
 * Not part of the spec. It exists because Phase 1's entire point is a mechanic
 * the player cannot see, and a hidden mechanic cannot be hand-verified without
 * some way to look at it. `App` gates this on `import.meta.env.DEV`, so it is
 * tree-shaken out of a production build.
 */
export default function DebugPanel({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const g = state.hidden.genetics;
  const ageMonths =
    state.clock.year * 12 +
    state.clock.month -
    (state.player.birthYear * 12 + state.player.birthMonth);

  const rows: [string, string][] = [
    ['Height ceiling', formatHeight(g.heightCeiling)],
    ['Start fraction', g.startingHeightFraction.toFixed(3)],
    ['Wingspan ratio', g.wingspanRatio.toFixed(3)],
    ['Frame ceiling', g.frameCeiling.toFixed(1)],
    ['Athletic ceiling', g.athleticCeiling.toFixed(1)],
    ['Potential', g.potential.toFixed(1)],
    ['Injury proneness', g.injuryProneness.toFixed(1)],
    [
      'Spurt window',
      `age ${Math.floor(g.spurtStartAgeMonths / 12)}y ${g.spurtStartAgeMonths % 12}m` +
        ` · ${g.spurtLengthMonths}mo · ×${g.spurtMultiplier.toFixed(2)}`,
    ],
    ['In spurt now', isInSpurtWindow(ageMonths, g) ? 'YES' : 'no'],
    ['Seed', String(state.seed)],
    ['RNG state', `${state.rngState.s} (${state.rngState.calls} calls)`],
  ];

  return (
    <div className="fixed bottom-4 right-4 w-80 rounded-lg border border-amber-900/60 bg-neutral-950/95 text-sm shadow-xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-medium uppercase tracking-widest text-amber-500"
      >
        Dev · hidden roll
        <span className="text-neutral-600">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <dl className="border-t border-neutral-800 px-4 py-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-0.5">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="text-right text-neutral-200">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
