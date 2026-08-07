import type { PendingEventView } from '../engine/selectors';

/**
 * A blocking choice (SPEC §12).
 *
 * The engine raises an event and refuses to advance time until it is answered,
 * so this is deliberately modal — you cannot play past it or leave it sitting
 * in a corner of the screen.
 *
 * Effects are never shown. Knowing that one option is "+6 character, −4 hype"
 * turns a character test into arithmetic; you get the situation and your read
 * of it, which is the whole point.
 */

const CATEGORY_LABEL: Record<string, string> = {
  family: 'Family',
  school: 'School',
  teammates: 'Teammates',
  coaches: 'Coaches',
  social: 'Social',
  media: 'Media',
  injury: 'Injury',
  money: 'Money',
  romance: 'Romance',
  viral: 'Viral',
  character: 'Character',
};

interface Props {
  event: PendingEventView;
  onChoose: (index: number) => void;
  busy: boolean;
}

export default function EventModal({ event, onChoose, busy }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 py-10">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl">
        <div className="border-b border-neutral-800 px-8 py-4">
          <div className="text-xs font-medium uppercase tracking-widest text-orange-500">
            {CATEGORY_LABEL[event.category] ?? event.category}
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {event.title}
          </h2>
        </div>

        <p className="px-8 py-6 text-lg leading-relaxed text-neutral-300">
          {event.prompt}
        </p>

        <div className="space-y-2 px-8 pb-8">
          {event.choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => onChoose(i)}
              className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-5 py-4 text-left transition hover:border-orange-600 hover:bg-orange-950/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block font-medium text-neutral-100">
                {choice.label}
              </span>
              {choice.detail && (
                <span className="mt-1 block text-sm text-neutral-500">
                  {choice.detail}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
