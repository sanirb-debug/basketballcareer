import { useState } from 'react';
import { endingScore } from '../engine/endings';
import type { PublicView } from '../engine/selectors';
import CareerArchive from './CareerArchive';

/**
 * The "how it ended" screen (SPEC §15).
 *
 * The spec is specific about this: every run ends with a named ending *and* a
 * screen that names the decision that broke it. So the decision line is the
 * largest thing on the page after the ending's name — not the stat block.
 */
export default function CareerEndScreen({
  view,
  exportText,
  onExit,
}: {
  view: PublicView;
  exportText: () => string;
  onExit: () => void;
}) {
  const [showArchive, setShowArchive] = useState(false);
  const end = view.careerEnd;
  if (!end) return null;

  const score = endingScore(end.endingId);

  const totals = view.history.reduce(
    (acc, s) => ({
      games: acc.games + s.games,
      points: acc.points + s.totals.points,
      rebounds: acc.rebounds + s.totals.rebounds,
      assists: acc.assists + s.totals.assists,
      wins: acc.wins + s.wins,
      losses: acc.losses + s.losses,
    }),
    { games: 0, points: 0, rebounds: 0, assists: 0, wins: 0, losses: 0 },
  );
  const gp = Math.max(1, totals.games);

  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <div className="text-xs uppercase tracking-widest text-orange-500">
        {end.reason}
      </div>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        {view.player.name}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-neutral-300">{end.detail}</p>

      <div className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-5">
        <div className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          What decided it
        </div>
        <p className="mt-2 text-lg leading-relaxed text-neutral-200">
          {end.decision}
        </p>
      </div>

      <dl className="mt-8 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
        <Cell label="Seasons" value={String(view.history.length)} />
        <Cell label="Games" value={String(totals.games)} />
        <Cell label="Career PPG" value={(totals.points / gp).toFixed(1)} />
        <Cell label="Record" value={`${totals.wins}–${totals.losses}`} />
        <Cell label="Final height" value={view.player.heightLabel} />
        <Cell label="Overall" value={String(view.player.overall)} />
        <Cell label="National rank" value={`#${view.rankings.nationalRank}`} />
        <Cell label="Final GPA" value={view.academics.gpa.toFixed(2)} />
      </dl>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm text-neutral-500">Career score</span>
        <span className="h-2 flex-1 overflow-hidden rounded bg-neutral-800">
          <span
            className="block h-full bg-orange-500"
            style={{ width: `${score}%` }}
          />
        </span>
        <span className="tabular-nums text-neutral-300">{score} / 100</span>
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        Seed {view.seed} — the same seed and the same choices reproduce this run
        exactly.
      </p>

      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => setShowArchive(!showArchive)}
          className="rounded-md bg-orange-600 px-5 py-2.5 font-medium hover:bg-orange-500"
        >
          {showArchive ? 'Hide the archive' : 'Read the whole career'}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md border border-neutral-700 px-5 py-2.5 text-neutral-300 hover:border-neutral-500"
        >
          Back to save slots
        </button>
      </div>

      {showArchive && (
        <div className="mt-10 border-t border-neutral-800 pt-8">
          <CareerArchive view={view} exportText={exportText} />
        </div>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-950 px-4 py-3">
      <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 text-xl tabular-nums">{value}</dd>
    </div>
  );
}
