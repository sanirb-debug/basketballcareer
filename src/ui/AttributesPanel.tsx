import type { PublicView } from '../engine/selectors';
import type { AttributeKey } from '../engine/types';

/**
 * The full rating sheet (SPEC §5, §17).
 *
 * Every attribute on the 25–99 scale, grouped the way a player thinks about
 * them rather than the way the engine stores them. Each bar shows where you
 * are now and marks how far this attribute can still be trained, so "grow
 * towards it" is visible rather than guesswork.
 *
 * The ceiling shown is the *trainable* one. Height and wingspan are not
 * trainable at all (§5) and are marked as such instead of given a fake target.
 */

interface Group {
  title: string;
  blurb: string;
  keys: AttributeKey[];
}

const GROUPS: Group[] = [
  {
    title: 'Shooting',
    blurb: 'Where your points come from when you are not at the rim.',
    keys: ['catchAndShoot3', 'offDribble3', 'midRange', 'freeThrow'],
  },
  {
    title: 'Finishing',
    blurb: 'Scoring inside, through contact, and above the rim.',
    keys: ['finishing', 'postGame', 'vertical', 'strength'],
  },
  {
    title: 'Playmaking',
    blurb: 'Creating for yourself and for everyone else.',
    keys: ['ballHandling', 'passingVision', 'offBallMovement', 'basketballIQ'],
  },
  {
    title: 'Athleticism',
    blurb: 'The engine underneath all of it.',
    keys: ['speed', 'agility', 'stamina', 'durability'],
  },
  {
    title: 'Defense',
    blurb: 'The half of the floor that keeps you on it.',
    keys: [
      'perimeterDefense',
      'interiorDefense',
      'steal',
      'block',
      'defensiveRebounding',
      'offensiveRebounding',
    ],
  },
  {
    title: 'Mental',
    blurb: 'The part coaches talk about when nobody is recording.',
    keys: ['motor', 'composure', 'coachability', 'leadership'],
  },
  {
    title: 'Frame',
    blurb: 'What you were given. Height and wingspan cannot be trained.',
    keys: ['height', 'wingspan', 'frame'],
  },
];

const LABELS: Partial<Record<AttributeKey, string>> = {
  catchAndShoot3: 'Catch & shoot 3',
  offDribble3: 'Off-dribble 3',
  midRange: 'Mid-range',
  freeThrow: 'Free throws',
  finishing: 'Finishing at the rim',
  postGame: 'Post game',
  vertical: 'Vertical / dunking',
  strength: 'Strength',
  ballHandling: 'Ball handling',
  passingVision: 'Passing & vision',
  offBallMovement: 'Off-ball movement',
  basketballIQ: 'Basketball IQ',
  speed: 'Speed',
  agility: 'Agility',
  stamina: 'Stamina',
  durability: 'Durability',
  perimeterDefense: 'Perimeter defense',
  interiorDefense: 'Interior defense',
  steal: 'Steal',
  block: 'Block',
  defensiveRebounding: 'Defensive rebounding',
  offensiveRebounding: 'Offensive rebounding',
  motor: 'Motor',
  composure: 'Composure / clutch',
  coachability: 'Coachability',
  leadership: 'Leadership',
  height: 'Height',
  wingspan: 'Wingspan',
  frame: 'Frame',
};

/** Attributes the body decides, not the gym. */
const UNTRAINABLE: AttributeKey[] = ['height', 'wingspan', 'frame'];

function tone(value: number): string {
  if (value >= 85) return 'bg-emerald-500';
  if (value >= 72) return 'bg-sky-500';
  if (value >= 58) return 'bg-neutral-400';
  if (value >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function AttributesPanel({ view }: { view: PublicView }) {
  const { attributes, overall, position } = view.player;
  const ceiling = view.trainingCeiling;

  const groupAverage = (keys: AttributeKey[]) =>
    Math.round(
      keys.reduce((sum, key) => sum + (attributes[key] ?? 0), 0) / keys.length,
    );

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Ratings
          </h2>
          <p className="text-sm text-neutral-500">
            {position} · {view.player.heightLabel} ·{' '}
            {Math.round(view.player.body.weightLbs)} lb
          </p>
        </div>

        <dl className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800 md:grid-cols-7">
          <Tile label="Overall" value={overall} big />
          {GROUPS.slice(0, 6).map((group) => (
            <Tile
              key={group.title}
              label={group.title}
              value={groupAverage(group.keys)}
            />
          ))}
        </dl>

        <p className="mt-3 text-xs text-neutral-600">
          The dim marker on each bar is as far as that skill can currently be
          trained. It rises as you develop — nothing is fixed except height,
          wingspan and frame.
        </p>
      </section>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            {group.title}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600">{group.blurb}</p>

          <ul className="mt-3 space-y-2.5">
            {group.keys.map((key) => {
              const value = attributes[key] ?? 0;
              const untrainable = UNTRAINABLE.includes(key);
              const cap = untrainable ? null : ceiling;
              const headroom = cap ? Math.max(0, cap - value) : 0;

              return (
                <li key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 text-neutral-400">
                    {LABELS[key] ?? key}
                  </span>

                  <span className="relative h-2 flex-1 overflow-hidden rounded bg-neutral-800">
                    <span
                      className={`block h-full ${tone(value)}`}
                      style={{ width: `${value}%` }}
                    />
                    {cap !== null && cap > value && (
                      <span
                        className="absolute top-0 h-full w-px bg-neutral-500"
                        style={{ left: `${cap}%` }}
                        title={`Trainable to about ${Math.round(cap)}`}
                      />
                    )}
                  </span>

                  <span className="w-9 shrink-0 text-right tabular-nums text-neutral-200">
                    {Math.round(value)}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-600">
                    {untrainable
                      ? 'natural'
                      : headroom >= 1
                        ? `+${Math.round(headroom)}`
                        : 'maxed'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  big,
}: {
  label: string;
  value: number;
  big?: boolean;
}) {
  return (
    <div className="bg-neutral-950 px-3 py-3">
      <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd
        className={`mt-1 tabular-nums ${
          big ? 'text-2xl text-orange-400' : 'text-xl text-neutral-100'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
