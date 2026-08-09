import { useState } from 'react';
import { SELECTABLE_STATES } from '../engine/origin';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  countryById,
  isUSA,
} from '../engine/countries';
import { SCHOOLS, SCHOOL_TIERS } from '../engine/school';
import {
  POSITIONS,
  type Handedness,
  type Position,
  type SchoolTier,
} from '../engine/types';
import type { CreationInput } from '../engine/newGame';

interface Props {
  slot: number;
  onCreate: (input: CreationInput, seedText: string) => void;
  onCancel: () => void;
}

/**
 * The honest pitch for picking a hard country.
 *
 * Exposure is a real penalty and the screen says so — but it also says what
 * you get for it, because being the first player from somewhere is the single
 * best story this game can tell.
 */
function describeCountry(id: string): string {
  const c = countryById(id);
  const seen =
    c.exposure >= 0.45
      ? 'Scouts already have this country on a list.'
      : c.exposure >= 0.25
        ? 'You will have to go and find the scouts. They are not coming here.'
        : 'Almost nobody is watching. Everything you get, you go and take.';

  const history =
    c.nbaPlayersEver === 0
      ? `No one from ${c.name} has ever reached the NBA. If you do it, every single thing you do is the first time.`
      : c.nbaPlayersEver < 6
        ? `Only a handful of ${c.demonym} players have ever reached the NBA.`
        : `${c.demonym} players are a known quantity at the top level.`;

  return `${seen} ${history}`;
}

const labelClass =
  'block text-xs font-medium uppercase tracking-widest text-neutral-500';
const fieldClass =
  'mt-2 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-orange-600';

export default function CharacterCreation({ slot, onCreate, onCancel }: Props) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('SG');
  const [jerseyNumber, setJerseyNumber] = useState(3);
  const [handedness, setHandedness] = useState<Handedness>('right');
  const [homeCity, setHomeCity] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [homeState, setHomeState] = useState('Indiana');
  const [schoolTier, setSchoolTier] = useState<SchoolTier>('public');
  const [schoolName, setSchoolName] = useState('');
  const [seedText, setSeedText] = useState('');
  const [attempted, setAttempted] = useState(false);

  /*
   * A disabled button with no explanation is a dead end — the player is left
   * clicking something that silently does nothing. Track exactly what is
   * missing so the form can say so.
   */
  const missing: string[] = [];
  if (!name.trim()) missing.push('a name');
  if (!homeCity.trim()) missing.push('a home city');
  const canSubmit = missing.length === 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;
    onCreate(
      {
        name: name.trim(),
        position,
        jerseyNumber,
        handedness,
        homeCity: homeCity.trim(),
        homeState,
        country,
        schoolTier,
        ...(schoolName.trim() ? { schoolName: schoolName.trim() } : {}),
      },
      seedText.trim(),
    );
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl px-8 py-14">
      <div className="text-xs uppercase tracking-widest text-neutral-500">
        Slot {slot + 1}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Create your prospect
      </h1>

      <div className="mt-10 grid grid-cols-2 gap-6">
        <div className="col-span-2">
          <label className={labelClass} htmlFor="name">
            Name <span className="text-orange-500">*</span>
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${fieldClass} ${
              attempted && !name.trim() ? 'border-red-600' : ''
            }`}
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="position">
            Position preference
          </label>
          <select
            id="position"
            className={fieldClass}
            value={position}
            onChange={(e) => setPosition(e.target.value as Position)}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="jersey">
            Jersey number
          </label>
          <input
            id="jersey"
            type="number"
            min={0}
            max={99}
            className={fieldClass}
            value={jerseyNumber}
            onChange={(e) =>
              setJerseyNumber(
                Math.max(0, Math.min(99, Number(e.target.value) || 0)),
              )
            }
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="handedness">
            Handedness
          </label>
          <select
            id="handedness"
            className={fieldClass}
            value={handedness}
            onChange={(e) => setHandedness(e.target.value as Handedness)}
          >
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="country">
            Country
          </label>
          <select
            id="country"
            className={fieldClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>

        {isUSA(country) ? (
          <div>
            <label className={labelClass} htmlFor="state">
              Home state
            </label>
            <select
              id="state"
              className={fieldClass}
              value={homeState}
              onChange={(e) => setHomeState(e.target.value)}
            >
              {SELECTABLE_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <span className={labelClass}>What that means</span>
            <p className="mt-2 text-sm leading-snug text-neutral-400">
              {describeCountry(country)}
            </p>
          </div>
        )}

        <div className="col-span-2">
          <label className={labelClass} htmlFor="city">
            Home city <span className="text-orange-500">*</span>
          </label>
          <input
            id="city"
            className={`${fieldClass} ${
              attempted && !homeCity.trim() ? 'border-red-600' : ''
            }`}
            value={homeCity}
            onChange={(e) => setHomeCity(e.target.value)}
          />
        </div>
      </div>

      <h2 className="mt-12 text-xs font-medium uppercase tracking-widest text-neutral-500">
        Where do you play?
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        This is the real decision. Exposure and playing time pull against each
        other.
      </p>

      <div className="mt-4 space-y-3">
        {SCHOOL_TIERS.map((tier) => {
          const school = SCHOOLS[tier];
          const selected = schoolTier === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setSchoolTier(tier)}
              className={`block w-full rounded-lg border px-5 py-4 text-left transition ${
                selected
                  ? 'border-orange-600 bg-orange-950/25'
                  : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-600'
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-neutral-100">{school.name}</span>
                <span className="shrink-0 text-xs uppercase tracking-widest text-neutral-500">
                  {tier}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-neutral-400">
                {school.blurb}
              </p>
              <div className="mt-3 flex gap-5 text-xs tabular-nums text-neutral-500">
                <span>Exposure ×{school.exposureMultiplier.toFixed(2)}</span>
                <span>Coaching {school.coachQuality}</span>
                <span>Roster depth {school.rosterDepth}</span>
                <span>Starting trust {school.startingTrust}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <label className={labelClass} htmlFor="schoolName">
          Name your high school <span className="normal-case">(optional)</span>
        </label>
        <input
          id="schoolName"
          className={fieldClass}
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder={SCHOOLS[schoolTier].name}
        />
        <p className="mt-2 text-sm text-neutral-500">
          Leave blank to use {SCHOOLS[schoolTier].name}. You will spend 8th
          grade at your local middle school either way.
        </p>
      </div>

      <div className="mt-10">
        <label className={labelClass} htmlFor="seed">
          Seed <span className="normal-case">(optional)</span>
        </label>
        <input
          id="seed"
          className={fieldClass}
          value={seedText}
          onChange={(e) => setSeedText(e.target.value)}
          placeholder="Leave blank for a random seed"
        />
        <p className="mt-2 text-sm text-neutral-500">
          The same seed always reproduces the same career, down to the month.
        </p>
      </div>

      {missing.length > 0 && (
        <p className="mt-8 text-sm text-amber-400">
          Still need {missing.join(' and ')} before you can start.
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-orange-600 px-5 py-2.5 font-medium hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
        >
          Start career
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-700 px-5 py-2.5 text-neutral-300 hover:border-neutral-500"
        >
          Back
        </button>
      </div>
    </form>
  );
}
