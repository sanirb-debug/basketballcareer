import { useState } from 'react';
import type { PublicView } from '../engine/selectors';

/**
 * The career archive and its text export (SPEC §16.4, §17).
 *
 * Everything that happened, in one scrollable place, plus a one-tap copy of
 * the whole run as plain text.
 */

const KIND_COLOR: Record<string, string> = {
  growth: 'text-orange-400',
  game: 'text-sky-400',
  injury: 'text-red-400',
  academics: 'text-emerald-400',
  recruiting: 'text-violet-400',
  hype: 'text-amber-400',
  training: 'text-neutral-400',
  system: 'text-neutral-300',
  coach: 'text-neutral-400',
};

interface Props {
  view: PublicView;
  exportText: () => string;
}

export default function CareerArchive({ view, exportText }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = exportText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; fall back to a download so the export is
      // never a dead end.
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${view.player.name.replace(/\s+/g, '-').toLowerCase()}-career.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Career archive
          </h2>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
          >
            {copied ? 'Copied' : 'Export as text'}
          </button>
        </div>

        {view.decisions.length > 0 && (
          <>
            <h3 className="mt-6 text-xs font-medium uppercase tracking-widest text-neutral-600">
              Decisions you made
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {view.decisions
                .slice()
                .reverse()
                .map((decision, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-16 shrink-0 tabular-nums text-neutral-600">
                      mo {decision.monthsElapsed}
                    </span>
                    <span className="text-neutral-500">{decision.title}</span>
                    <span className="text-neutral-300">— {decision.choice}</span>
                  </li>
                ))}
            </ul>
          </>
        )}

        <h3 className="mt-6 text-xs font-medium uppercase tracking-widest text-neutral-600">
          Every month
        </h3>
        <ul className="mt-2 max-h-[32rem] space-y-1.5 overflow-y-auto pr-2 text-sm">
          {view.fullLog.map((entry, i) => (
            <li key={i} className="flex gap-4">
              <span className="w-32 shrink-0 tabular-nums text-neutral-600">
                {entry.date}
              </span>
              <span className={KIND_COLOR[entry.kind] ?? 'text-neutral-400'}>
                {entry.text}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
