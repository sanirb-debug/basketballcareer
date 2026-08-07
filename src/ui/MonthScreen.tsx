import type { PublicView } from '../engine/selectors';

/**
 * The bare Phase 0 month screen: date, age, and a next-month button.
 *
 * SPEC §2 requires months to look materially different by season phase — that
 * arrives in Phase 2. This is deliberately the same layout every month.
 */
interface Props {
  view: PublicView;
  growthNote: string | null;
  saving: boolean;
  onNextMonth: () => void;
  onExit: () => void;
}

export default function MonthScreen({
  view,
  growthNote,
  saving,
  onNextMonth,
  onExit,
}: Props) {
  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-neutral-500">
            {view.phase}
          </div>
          <h1 className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {view.date}
          </h1>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          Save &amp; exit
        </button>
      </div>

      <dl className="mt-10 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
        <Stat label="Age" value={view.ageLabel} />
        <Stat label="Height" value={view.player.heightLabel} />
        <Stat
          label="Weight"
          value={`${Math.round(view.player.body.weightLbs)} lb`}
        />
        <Stat label="Overall" value={String(view.player.overall)} />
      </dl>

      <div className="mt-6 flex items-center gap-3">
        <div className="text-neutral-300">
          {view.player.name} · #{view.player.jerseyNumber} ·{' '}
          {view.player.position} · {view.origin.homeCity},{' '}
          {view.origin.homeState}
        </div>
      </div>

      <div className="mt-8 min-h-[2rem]">
        {growthNote && (
          <p className="inline-block rounded-md border border-orange-900/60 bg-orange-950/40 px-4 py-2 text-orange-300">
            {growthNote}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onNextMonth}
        disabled={saving}
        className="mt-6 rounded-md bg-orange-600 px-6 py-3 text-lg font-medium hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
      >
        {saving ? 'Saving…' : 'Next month →'}
      </button>

      <section className="mt-14">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Career log
        </h2>
        <ul className="mt-3 space-y-1.5">
          {view.recentLog.map((entry, i) => (
            <li key={`${entry.date}-${i}`} className="flex gap-4 text-sm">
              <span className="w-32 shrink-0 tabular-nums text-neutral-600">
                {entry.date}
              </span>
              <span className="text-neutral-300">{entry.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-950 px-5 py-4">
      <dt className="text-xs uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 text-2xl tabular-nums">{value}</dd>
    </div>
  );
}
