import type { PublicView } from '../engine/selectors';
import type { NightId } from '../engine/nightlife';
import { ENERGY_ENABLED } from '../engine/actions';

/**
 * The off-court panel (SPEC §6).
 *
 * Written to be tempting, because that is the honest version. A screen that
 * scolded you would be a screen you learned to ignore; the nights genuinely
 * are the best thing on offer in a lot of months, and the bill arrives later
 * and somewhere else.
 *
 * The two numbers at the top are the whole design. **Focus** is what it is
 * costing you right now. **Attention** is how many people are watching, which
 * is what turns an ordinary Tuesday into a story — and it climbs on its own
 * as the career goes, so the same night is a different bet every year.
 */

interface Props {
  view: PublicView;
  onGoOut: (nightId: NightId) => void;
}

function focusTone(distraction: number): string {
  if (distraction >= 75) return 'text-red-400';
  if (distraction >= 55) return 'text-orange-400';
  if (distraction >= 35) return 'text-amber-400';
  return 'text-emerald-400';
}

export default function NightlifePanel({ view, onGoOut }: Props) {
  const { nightlife, money } = view;
  const { distraction, fame, partner } = nightlife;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Nights
        </h3>
        <p className="text-sm text-neutral-500">
          {nightlife.nightsThisMonth > 0
            ? `${nightlife.nightsThisMonth} out this month`
            : 'Nothing on the calendar'}
          {nightlife.tabloidStories > 0 &&
            ` · ${nightlife.tabloidStories} written about`}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
        <div className="bg-neutral-950 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            Focus
          </dt>
          <dd className={`mt-1 text-lg ${focusTone(distraction)}`}>
            {nightlife.label}
          </dd>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-800">
            <span
              className={`block h-full ${
                distraction >= 55 ? 'bg-red-500' : 'bg-amber-500'
              }`}
              style={{ width: `${distraction}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-snug text-neutral-600">
            What the nights are costing you — training, the coach’s patience,
            and the fourth quarter. It clears on its own if you let it.
          </p>
        </div>

        <div className="bg-neutral-950 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
            Attention
          </dt>
          <dd className="mt-1 text-lg tabular-nums text-neutral-100">{fame}</dd>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-800">
            <span
              className="block h-full bg-sky-500"
              style={{ width: `${fame}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-snug text-neutral-600">
            How many people would recognise you across a dark room. Nobody
            writes about a freshman. They write about you now.
          </p>
        </div>
      </dl>

      {partner ? (
        <p className="mt-3 text-xs text-neutral-500">
          You are seeing{' '}
          <span className="text-neutral-300">{partner.name}</span>
          {partner.exclusive ? ' — and you called it that out loud.' : '.'}{' '}
          Going home with somebody else is a thing you can do. Whether you get
          away with it is a question about that number on the right.
        </p>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">
          Nobody is waiting up. Nights out are cheap in every sense right now.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {nightlife.nights.map((def) => {
          const affordable = money >= def.cost;
          return (
            <li key={def.id}>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => onGoOut(def.id as NightId)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:opacity-40"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium text-neutral-100">
                    {def.label}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                    {def.cost > 0 ? `$${def.cost.toLocaleString()}` : 'Free'}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-snug text-neutral-400">
                  {def.detail}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                  {ENERGY_ENABLED && (
                    <span
                      className={
                        def.energy > 0
                          ? 'text-neutral-500'
                          : 'text-emerald-500/80'
                      }
                    >
                      {def.energy > 0 ? `−${def.energy}` : `+${-def.energy}`} nrg
                    </span>
                  )}
                  <span
                    className={
                      def.distraction > 0
                        ? 'text-amber-500/80'
                        : 'text-emerald-500/80'
                    }
                  >
                    {def.distraction > 0 ? '+' : ''}
                    {def.distraction} focus cost
                  </span>
                  {def.exposure >= 1.5 && (
                    <span className="text-red-400/80">Highly visible</span>
                  )}
                  {def.meetChance >= 0.5 && (
                    <span className="text-neutral-500">
                      You will probably meet somebody
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-neutral-600">
        Go out as often as you want. Nobody is stopping you — that is rather
        the problem. The fourth night in a month costs the same and gives back
        a third as much.
      </p>
    </section>
  );
}
