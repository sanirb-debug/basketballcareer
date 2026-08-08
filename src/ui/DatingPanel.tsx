import { useState } from 'react';
import type { PublicView } from '../engine/selectors';
import { INTIMACY, WEDDING_TIERS, type DateId, type IntimacyId, type WeddingTierId } from '../engine/dating';
import type { PartyId } from '../engine/nightlife';

/**
 * Dating, marriage, children and parties (SPEC §6).
 *
 * Laid out as a single column that changes shape with where you actually are:
 * nobody in your life shows you the pool, somebody in your life shows you the
 * plans, and an engagement shows you three ways to pay for a wedding. The
 * screen is never a menu of everything — it is a menu of what is true now.
 */

interface Props {
  view: PublicView;
  onMeetPeople: () => void;
  onAskOut: (candidateId: string) => void;
  onDate: (dateId: DateId) => void;
  onStayOver: (intimacy: IntimacyId) => void;
  onPropose: () => void;
  onMarry: (tier: WeddingTierId) => void;
  onParty: (partyId: PartyId) => void;
}

const sectionTitle =
  'text-xs font-medium uppercase tracking-widest text-neutral-500';

export default function DatingPanel({
  view,
  onMeetPeople,
  onAskOut,
  onDate,
  onStayOver,
  onPropose,
  onMarry,
  onParty,
}: Props) {
  const { romance, money } = view;
  const [confirmWedding, setConfirmWedding] = useState(false);

  if (!romance.unlocked) return null;

  const partner = romance.partner;
  const canStayOver =
    partner &&
    partner.romance &&
    ['dating', 'exclusive', 'engaged', 'married'].includes(partner.romance) &&
    romance.expectingIn === null;

  return (
    <div className="space-y-10">
      {/* --- Who you are with, or who is around ------------------------- */}
      {partner ? (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className={sectionTitle}>{romance.stageLabel}</h3>
            <p className="text-sm text-neutral-500">
              {Math.round(partner.relationship)}/100
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-lg font-medium text-neutral-100">
                {partner.name}
              </span>
              <span className="text-xs text-neutral-500">
                {partner.age}
                {partner.metVia && ` · met ${partner.metVia}`}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded bg-neutral-800">
              <span
                className="block h-full bg-rose-500"
                style={{ width: `${partner.relationship}%` }}
              />
            </div>

            {romance.expectingIn !== null && (
              <p className="mt-3 rounded border border-amber-900/60 bg-amber-950/25 px-3 py-2 text-sm text-amber-300">
                {partner.name} is expecting.{' '}
                {romance.expectingIn === 0
                  ? 'Any day now.'
                  : `${romance.expectingIn} month${
                      romance.expectingIn === 1 ? '' : 's'
                    } to go.`}
              </p>
            )}
          </div>

          {/* Dates */}
          {romance.dates.length > 0 && (
            <>
              <h4 className="mt-6 text-xs uppercase tracking-widest text-neutral-600">
                Take them somewhere
              </h4>
              <ul className="mt-2 space-y-2">
                {romance.dates.map((def) => (
                  <li key={def.id}>
                    <button
                      type="button"
                      disabled={money < def.cost}
                      onClick={() => onDate(def.id)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-3.5 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-medium text-neutral-100">
                          {def.label}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                          ${def.cost.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-snug text-neutral-400">
                        {def.detail}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* The night */}
          {canStayOver && (
            <>
              <h4 className="mt-6 text-xs uppercase tracking-widest text-neutral-600">
                Stay over
              </h4>
              <ul className="mt-2 space-y-2">
                {INTIMACY.map((def) => (
                  <li key={def.id}>
                    <button
                      type="button"
                      onClick={() => onStayOver(def.id)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-3.5 text-left transition hover:border-neutral-600"
                    >
                      <span className="block font-medium text-neutral-100">
                        {def.label}
                      </span>
                      <span className="mt-1 block text-sm leading-snug text-neutral-400">
                        {def.detail}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-neutral-600">
                One of these has a number attached to it and the other has a
                smaller one. Neither of them is zero.
              </p>
            </>
          )}

          {/* Proposing and the wedding */}
          {partner.romance === 'engaged' ? (
            <>
              <h4 className="mt-6 text-xs uppercase tracking-widest text-neutral-600">
                The wedding
              </h4>
              <ul className="mt-2 space-y-2">
                {WEDDING_TIERS.map((tier) => (
                  <li key={tier.id}>
                    <button
                      type="button"
                      disabled={money < tier.cost}
                      onClick={() => onMarry(tier.id)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-3.5 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-medium text-neutral-100">
                          {tier.label}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                          ${tier.cost.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-snug text-neutral-400">
                        {tier.detail}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : partner.romance !== 'married' ? (
            <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-medium text-neutral-100">Propose</span>
                <span className="text-xs tabular-nums text-neutral-500">
                  ring ≈ ${romance.ringCost.toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-400">
                {romance.canPropose.ok
                  ? 'You have thought about it for a while now. She might still say no.'
                  : romance.canPropose.reason}
              </p>
              {romance.canPropose.ok && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirmWedding) {
                      onPropose();
                      setConfirmWedding(false);
                    } else setConfirmWedding(true);
                  }}
                  className="mt-3 rounded-md bg-rose-800 px-4 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-700"
                >
                  {confirmWedding ? 'Ask her. For real.' : 'Ask her'}
                </button>
              )}
            </div>
          ) : null}
        </section>
      ) : (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className={sectionTitle}>Meet someone</h3>
            <button
              type="button"
              onClick={onMeetPeople}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-neutral-500"
            >
              {romance.candidates.length ? 'Look again' : 'Put yourself out there'}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            You meet who is around, not who is perfect. Looking again replaces
            everyone here.
          </p>

          {romance.candidates.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              Nobody in particular right now.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {romance.candidates.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="font-medium text-neutral-100">
                      {c.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {c.age} · met {c.metVia}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-snug text-neutral-400">
                    {c.blurb}
                  </p>
                  <button
                    type="button"
                    onClick={() => onAskOut(c.id)}
                    className="mt-3 rounded-md bg-neutral-800 px-4 py-1.5 text-xs text-neutral-100 transition hover:bg-neutral-700"
                  >
                    Ask her out
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* --- Children ---------------------------------------------------- */}
      {romance.children.length > 0 && (
        <section>
          <h3 className={sectionTitle}>Children</h3>
          <ul className="mt-3 space-y-2">
            {romance.children.map((child) => (
              <li
                key={child.id}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-3"
              >
                <span className="font-medium text-neutral-100">
                  {child.name}
                </span>
                <span className="text-xs text-neutral-500">
                  {child.age === 0 ? 'newborn' : `${child.age}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-600">
            $1,400 a month each, forever, and worth every dollar. They are on
            the People screen too.
          </p>
        </section>
      )}

      {/* --- Parties ----------------------------------------------------- */}
      <section>
        <h3 className={sectionTitle}>Throw something</h3>
        <p className="mt-1 text-xs text-neutral-600">
          Hosting is different from going out. It buys you standing with people
          whose opinion of you is otherwise out of your hands — and it puts
          your address on the internet.
        </p>
        <ul className="mt-3 space-y-2">
          {romance.parties.map((def) => {
            const blocked =
              (def.requiresProperty && !romance.hasProperty) ||
              money < def.cost;
            return (
              <li key={def.id}>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => onParty(def.id)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-3.5 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium text-neutral-100">
                      {def.label}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                      ${def.cost.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug text-neutral-400">
                    {def.detail}
                  </p>
                  {def.requiresProperty && !romance.hasProperty && (
                    <p className="mt-1.5 text-xs text-amber-500/80">
                      You need a place of your own first — see Money.
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
