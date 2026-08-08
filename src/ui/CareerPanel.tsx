import type { PublicView } from '../engine/selectors';

/**
 * The stage-specific panel (SPEC §14, §17): college status and its decisions,
 * draft stock, or a professional contract and honours.
 */

interface Props {
  view: PublicView;
  onRedshirt: () => void;
  onEnterPortal: () => void;
  onTransfer: (programId: string) => void;
  onDeclare: (testingWaters: boolean) => void;
  onWithdraw: () => void;
  onRequestTrade: () => void;
}

export default function CareerPanel({
  view,
  onRedshirt,
  onEnterPortal,
  onTransfer,
  onDeclare,
  onWithdraw,
  onRequestTrade,
}: Props) {
  const { college, draft, pro } = view;

  return (
    <div className="space-y-10">
      {college && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            {college.programName} · {college.tierLabel}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{college.conference}</p>

          <dl className="mt-4 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
            <Cell label="Year" value={String(college.year)} />
            <Cell label="Eligibility" value={`${college.eligibilityLeft} left`} />
            <Cell label="NIL" value={`$${college.nilPerMonth.toLocaleString()}/mo`} />
            <Cell label="Coach trust" value={String(college.trust)} />
          </dl>

          {college.redshirtingNow && (
            <p className="mt-3 rounded-lg border border-violet-900/60 bg-violet-950/25 px-4 py-2.5 text-sm text-violet-300">
              Redshirting this season — practising, not playing. The year does
              not count against your eligibility.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {college.canRedshirt && (
              <button
                type="button"
                onClick={onRedshirt}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
              >
                Redshirt this season
              </button>
            )}
            {college.canEnterPortal && (
              <button
                type="button"
                onClick={onEnterPortal}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
              >
                Enter the transfer portal
              </button>
            )}
          </div>

          {college.inPortal && (
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-600">
                Programs that will take you
              </h3>
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-2">
                {college.transferOptions.slice(0, 20).map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    onClick={() => onTransfer(program.id)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-md border border-neutral-800 px-4 py-2 text-left text-sm hover:border-neutral-600"
                  >
                    <span className="text-neutral-300">{program.name}</span>
                    <span className="text-xs text-neutral-600">
                      {program.conference}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {draft && !draft.completed && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Draft stock
          </h2>
          <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
            <Cell label="Projection" value={`#${draft.projection}`} />
            <Cell label="Read" value={draft.projectionLabel} />
            <Cell label="Class" value={String(draft.year)} />
          </dl>

          {draft.declared && (
            <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/25 px-4 py-2.5 text-sm text-amber-300">
              {draft.testingWaters
                ? 'Declared, keeping the option to withdraw before the deadline.'
                : 'Declared. There is no going back to school.'}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {draft.canDeclare && (
              <>
                <button
                  type="button"
                  onClick={() => onDeclare(true)}
                  className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
                >
                  Test the waters
                </button>
                <button
                  type="button"
                  onClick={() => onDeclare(false)}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium hover:bg-orange-500"
                >
                  Declare for the draft
                </button>
              </>
            )}
            {draft.canWithdraw && (
              <button
                type="button"
                onClick={onWithdraw}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
              >
                Withdraw and return to school
              </button>
            )}
          </div>
        </section>
      )}

      {draft?.completed && draft.pick > 0 && !pro && (
        <p className="text-sm text-neutral-400">
          Drafted #{draft.pick} overall in round {draft.round}.
        </p>
      )}

      {pro && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            {pro.teamName} · {pro.conference}
          </h2>

          <dl className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
            <Cell label="Role" value={pro.role} />
            <Cell label="Salary" value={`$${pro.salary}M`} />
            <Cell label="Years left" value={String(pro.yearsLeft)} />
            <Cell label="Seasons" value={String(pro.seasons)} />
          </dl>

          <div className="mt-3 flex gap-6 text-sm text-neutral-400">
            <span>
              Rings <span className="tabular-nums text-neutral-200">{pro.championships}</span>
            </span>
            <span>
              All-Stars{' '}
              <span className="tabular-nums text-neutral-200">{pro.allStars}</span>
            </span>
            <span className="text-neutral-600">{pro.contractType} deal</span>
          </div>

          {pro.awards.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-medium uppercase tracking-widest text-neutral-600">
                Honours
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {pro.awards
                  .slice()
                  .reverse()
                  .map((award, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="text-neutral-300">{award.name}</span>
                      <span className="tabular-nums text-neutral-600">
                        {award.season}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}

          {pro.canRequestTrade && (
            <button
              type="button"
              onClick={onRequestTrade}
              className="mt-5 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
            >
              Request a trade
            </button>
          )}
          {pro.tradeRequested && (
            <p className="mt-3 text-sm text-neutral-600">
              You have already asked out once. The front office remembers.
            </p>
          )}

          <h3 className="mt-8 text-xs font-medium uppercase tracking-widest text-neutral-600">
            Around the league
          </h3>
          <ul className="mt-2 space-y-1 text-sm tabular-nums">
            {pro.standings.map((team) => (
              <li key={team.name} className="flex justify-between gap-3">
                <span className="truncate text-neutral-400">{team.name}</span>
                <span className="text-neutral-600">
                  {team.wins}–{team.losses}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
      <dd className="mt-1 text-lg tabular-nums">{value}</dd>
    </div>
  );
}
