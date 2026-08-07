import type { PublicView } from '../engine/selectors';

/**
 * A minimal terminal state (SPEC §15). Only the career-ending injury path
 * exists this phase; the full set of named endings is Phase 8.
 */
export default function CareerEndScreen({
  view,
  onExit,
}: {
  view: PublicView;
  onExit: () => void;
}) {
  const end = view.careerEnd;
  if (!end) return null;

  const totals = view.history.reduce(
    (acc, s) => ({
      games: acc.games + s.games,
      points: acc.points + s.totals.points,
      wins: acc.wins + s.wins,
      losses: acc.losses + s.losses,
    }),
    { games: 0, points: 0, wins: 0, losses: 0 },
  );

  return (
    <div className="mx-auto max-w-2xl px-8 py-24">
      <div className="text-xs uppercase tracking-widest text-red-500">
        {end.reason}
      </div>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        {view.player.name}’s career is over.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-neutral-400">{end.detail}</p>

      <dl className="mt-10 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
        {[
          ['Seasons', String(view.history.length)],
          ['Games', String(totals.games)],
          [
            'Career PPG',
            totals.games > 0 ? (totals.points / totals.games).toFixed(1) : '0.0',
          ],
          ['Record', `${totals.wins}–${totals.losses}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-neutral-950 px-4 py-3">
            <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
              {label}
            </dt>
            <dd className="mt-1 text-xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-sm text-neutral-600">
        Final height {view.player.heightLabel} · {view.player.overall} overall ·
        seed {view.seed}
      </p>

      <button
        type="button"
        onClick={onExit}
        className="mt-10 rounded-md border border-neutral-700 px-5 py-2.5 text-neutral-300 hover:border-neutral-500"
      >
        Back to save slots
      </button>
    </div>
  );
}
