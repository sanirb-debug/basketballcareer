import type { PublicView } from '../engine/selectors';
import type { PostHighSchoolPath } from '../engine/types';

/**
 * The fork at eighteen (SPEC §14).
 *
 * Deliberately full-screen and blocking. This is the single biggest decision
 * in the game — the roads genuinely diverge from here — and the closed doors
 * are shown alongside the open ones, with the reason they are closed, so the
 * choice is made with full information about what the last five years cost.
 */

const ACCENT: Record<PostHighSchoolPath, string> = {
  college: 'border-sky-800 hover:border-sky-500',
  juco: 'border-violet-800 hover:border-violet-500',
  gleague: 'border-amber-800 hover:border-amber-500',
  ote: 'border-rose-800 hover:border-rose-500',
  overseas: 'border-emerald-800 hover:border-emerald-500',
};

interface Props {
  view: PublicView;
  busy: boolean;
  onChoose: (path: PostHighSchoolPath) => void;
}

export default function PathChoiceScreen({ view, busy, onChoose }: Props) {
  const open = view.pathOptions.filter((o) => o.available);
  const closed = view.pathOptions.filter((o) => !o.available);

  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <div className="text-xs uppercase tracking-widest text-orange-500">
        High school is over
      </div>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        What happens next?
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-neutral-400">
        You finished ranked #{view.rankings.nationalRank} with a{' '}
        {view.academics.gpa.toFixed(2)} GPA. These are the roads that are open
        to you.
      </p>

      <div className="mt-10 space-y-3">
        {open.map((option) => (
          <button
            key={option.path}
            type="button"
            disabled={busy}
            onClick={() => onChoose(option.path)}
            className={`block w-full rounded-lg border bg-neutral-900/50 px-6 py-5 text-left transition disabled:opacity-50 ${ACCENT[option.path]}`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg font-medium text-neutral-100">
                {option.label}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-neutral-500">
                ${option.stipend.toLocaleString()}/mo
              </span>
            </div>
            <p className="mt-2 text-sm leading-snug text-neutral-400">
              {option.detail}
            </p>
          </button>
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <h2 className="mt-12 text-xs font-medium uppercase tracking-widest text-neutral-600">
            Closed to you
          </h2>
          <ul className="mt-3 space-y-2">
            {closed.map((option) => (
              <li
                key={option.path}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-neutral-900 px-6 py-3 text-sm"
              >
                <span className="text-neutral-600">{option.label}</span>
                <span className="shrink-0 text-neutral-700">
                  {option.blockedReason}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
