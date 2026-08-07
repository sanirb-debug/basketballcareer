import type { PublicView } from '../engine/selectors';

/**
 * The national board (SPEC §7, §11, §17).
 *
 * The player's row is always shown even when he is nowhere near the top, and
 * the rival is always pinned — he is meant to be a name you check every month
 * rather than a stat you look up.
 */
export default function RankingsPanel({ view }: { view: PublicView }) {
  const { rankings } = view;
  const movement = rankings.previousRank - rankings.nationalRank;

  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
        National rankings
      </h2>

      <dl className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
        <Cell label="Rank" value={`#${rankings.nationalRank}`} />
        <Cell
          label="Movement"
          value={movement === 0 ? '—' : movement > 0 ? `▲ ${movement}` : `▼ ${-movement}`}
          tone={movement > 0 ? 'good' : movement < 0 ? 'bad' : undefined}
        />
        <Cell label="Hype" value={String(rankings.hype)} />
        <Cell label="Overall" value={String(view.player.overall)} />
      </dl>

      <p className="mt-2 text-xs text-neutral-600">
        Circuit: {rankings.aauLabel} · school exposure ×
        {view.school.exposure.toFixed(2)}
      </p>

      {rankings.rival && (
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-red-500">
            Your rival
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-neutral-100">{rankings.rival.name}</span>
            <span className="tabular-nums text-neutral-400">
              #{rankings.rival.rank}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {rankings.rival.position} · {rankings.rival.homeState} ·{' '}
            {rankings.rival.rank < rankings.nationalRank
              ? `${rankings.nationalRank - rankings.rival.rank} spots ahead of you`
              : `${rankings.rival.rank - rankings.nationalRank} spots behind you`}
          </div>
        </div>
      )}

      <div className="mt-4 max-h-[24rem] overflow-y-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-950">
            <tr className="text-left text-xs uppercase tracking-wider text-neutral-600">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Player</th>
              <th className="px-2 py-2 font-medium">Pos</th>
              <th className="px-4 py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {rankings.top.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-neutral-900 ${
                  row.isPlayer
                    ? 'bg-orange-950/30'
                    : row.isRival
                      ? 'bg-red-950/20'
                      : ''
                }`}
              >
                <td className="px-4 py-1.5 tabular-nums text-neutral-500">
                  {row.rank}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={
                      row.isPlayer
                        ? 'font-medium text-orange-300'
                        : row.isRival
                          ? 'text-red-300'
                          : 'text-neutral-300'
                    }
                  >
                    {row.name}
                  </span>
                  {row.isPlayer && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-orange-500">
                      you
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-neutral-500">{row.position}</td>
                <td className="px-4 py-1.5 text-neutral-600">{row.homeState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | undefined;
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'bad'
        ? 'text-red-400'
        : 'text-neutral-100';
  return (
    <div className="bg-neutral-950 px-4 py-3">
      <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd className={`mt-1 text-xl tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
