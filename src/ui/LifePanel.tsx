import type { PublicView } from '../engine/selectors';

/**
 * Academics, reputation, relationships and money (SPEC §6, §9, §17).
 *
 * All four are surfaced together because they are the systems that quietly
 * decide the ending while the player is looking at box scores.
 */
export default function LifePanel({ view }: { view: PublicView }) {
  const { academics, reputation, relationships } = view;

  const standingTone =
    academics.status === 'qualifier'
      ? 'text-emerald-400'
      : academics.status === 'academic-redshirt'
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Academics
        </h2>
        <dl className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
          <Cell label="GPA" value={academics.gpa.toFixed(2)} />
          <Cell label="Core credits" value={`${academics.coreCredits}/16`} />
          <Cell
            label="Test"
            value={academics.testScore > 0 ? String(academics.testScore) : '—'}
          />
          <Cell label="Grade" value={view.gradeLabel} />
        </dl>
        <p className={`mt-2 text-sm ${standingTone}`}>{academics.standing}</p>
        {academics.status === 'non-qualifier' && (
          <p className="mt-1 text-xs text-neutral-500">
            Studying costs the same action point as training. That is the whole
            decision.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Reputation
        </h2>
        <div className="mt-3 space-y-3">
          <Meter
            label="On-court respect"
            value={reputation.onCourt}
            hint="How teammates, coaches and the media read you as a player."
          />
          <Meter
            label="Off-court character"
            value={reputation.offCourt}
            hint="Which programs will put their name next to yours."
          />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Relationships
          </h2>
          <span className="text-sm tabular-nums text-neutral-400">
            ${view.money.toLocaleString()}
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {relationships.map((rel) => (
            <li key={rel.id} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 text-neutral-400">{rel.label}</span>
              {rel.active ? (
                <>
                  <span className="h-1.5 flex-1 overflow-hidden rounded bg-neutral-800">
                    <span
                      className={`block h-full ${
                        rel.level < 30
                          ? 'bg-red-500'
                          : rel.level >= 70
                            ? 'bg-emerald-500'
                            : 'bg-neutral-500'
                      }`}
                      style={{ width: `${rel.level}%` }}
                    />
                  </span>
                  <span className="w-8 text-right tabular-nums text-neutral-500">
                    {rel.level}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-neutral-700">—</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-600">
          Relationships decay every month you ignore them.
        </p>
      </section>
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

function Meter({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-300">{label}</span>
        <span className="tabular-nums text-neutral-500">{Math.round(value)}</span>
      </div>
      <span className="mt-1 block h-1.5 overflow-hidden rounded bg-neutral-800">
        <span
          className={`block h-full ${
            value < 25 ? 'bg-red-500' : value >= 70 ? 'bg-emerald-500' : 'bg-neutral-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </span>
      <p className="mt-1 text-xs text-neutral-600">{hint}</p>
    </div>
  );
}
