import type { PublicView } from '../engine/selectors';

/**
 * The recruiting board (SPEC §10, §17).
 *
 * Interest levels are visible and move month to month, offers are marked, and
 * visits are scheduled from here because a visit needs a target — it is the
 * one action that cannot just be picked off a generic list.
 */

interface Props {
  view: PublicView;
  visitsQueued: string[];
  onQueueVisit: (programId: string) => void;
  onCommit: (programId: string) => void;
  onDecommit: () => void;
  onSign: () => void;
}

const TIER_COLOR: Record<string, string> = {
  blueblood: 'text-amber-400',
  'high-major': 'text-sky-400',
  'mid-major': 'text-emerald-400',
  'low-major': 'text-neutral-400',
  juco: 'text-violet-400',
};

export default function RecruitingPanel({
  view,
  visitsQueued,
  onQueueVisit,
  onCommit,
  onDecommit,
  onSign,
}: Props) {
  const { recruiting, academics } = view;
  const blocked = academics.status === 'non-qualifier';

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Recruiting board
        </h2>
        <div className="text-sm text-neutral-400">
          {recruiting.offerCount} offer{recruiting.offerCount === 1 ? '' : 's'} ·{' '}
          {recruiting.visitsThisCycle}/{recruiting.visitsAllowed} visits
        </div>
      </div>

      {blocked && (
        <p className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2.5 text-sm text-red-300">
          You are a non-qualifier. Every four-year program is closed until your
          grades come up — JUCO is the only road open.
        </p>
      )}

      {recruiting.committedTo && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-900/60 bg-orange-950/25 px-4 py-3">
          <span className="text-sm text-orange-200">
            {recruiting.signed ? 'Signed with' : 'Committed to'}{' '}
            <strong>{recruiting.committedTo}</strong>
            {recruiting.decommits > 0 && (
              <span className="text-orange-400/70">
                {' '}
                · {recruiting.decommits} decommit
                {recruiting.decommits === 1 ? '' : 's'}
              </span>
            )}
          </span>
          <span className="flex gap-2">
            {recruiting.canSignNow && (
              <button
                type="button"
                onClick={onSign}
                className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium hover:bg-orange-500"
              >
                Sign — it&apos;s official
              </button>
            )}
            {!recruiting.signed && (
              <button
                type="button"
                onClick={onDecommit}
                className="rounded-md border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
              >
                Decommit
              </button>
            )}
          </span>
        </div>
      )}

      {recruiting.signingWindowOpen && !recruiting.committedTo && (
        <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/25 px-4 py-2.5 text-sm text-amber-300">
          Signing period is open. Commit to a program to sign.
        </p>
      )}

      <div className="mt-4 max-h-[26rem] overflow-y-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-950">
            <tr className="text-left text-xs uppercase tracking-wider text-neutral-600">
              <th className="px-4 py-2 font-medium">Program</th>
              <th className="px-2 py-2 font-medium">Tier</th>
              <th className="px-2 py-2 text-right font-medium">Interest</th>
              <th className="px-4 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {recruiting.programs.map((program) => {
              const queued = visitsQueued.includes(program.id);
              return (
                <tr
                  key={program.id}
                  className="border-t border-neutral-900 hover:bg-neutral-900/40"
                >
                  <td className="px-4 py-2">
                    <span className="text-neutral-200">{program.name}</span>
                    {program.committed && (
                      <span className="ml-2 rounded bg-orange-950 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-orange-400">
                        Committed
                      </span>
                    )}
                    {program.offered && !program.committed && (
                      <span className="ml-2 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-400">
                        Offer
                      </span>
                    )}
                    {program.needsYou && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-neutral-600">
                        needs {view.player.position}
                      </span>
                    )}
                    {program.pulledReason && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-red-500">
                        pulled · {program.pulledReason}
                      </span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-xs ${TIER_COLOR[program.tier]}`}>
                    {program.tierLabel}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1 w-16 overflow-hidden rounded bg-neutral-800">
                        <span
                          className="block h-full bg-neutral-500"
                          style={{ width: `${program.interest}%` }}
                        />
                      </span>
                      <span className="w-7 text-neutral-400">
                        {program.interest}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {program.offered && !program.committed && !recruiting.signed && (
                      <button
                        type="button"
                        onClick={() => onCommit(program.id)}
                        className="rounded-md border border-orange-800 px-3 py-1 text-xs text-orange-300 hover:border-orange-500"
                      >
                        Commit
                      </button>
                    )}
                    {!program.offered && (
                      <button
                        type="button"
                        onClick={() => onQueueVisit(program.id)}
                        disabled={queued}
                        className="rounded-md border border-neutral-800 px-3 py-1 text-xs text-neutral-400 hover:border-neutral-600 disabled:opacity-40"
                      >
                        {queued ? 'Visit queued' : 'Visit'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        Queuing a visit spends one of this month&apos;s action points.
      </p>
    </section>
  );
}
