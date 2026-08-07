import { useState } from 'react';
import { SELECTABLE_STATES } from '../engine/origin';
import { POSITIONS, type Handedness, type Position } from '../engine/types';
import type { CreationInput } from '../engine/newGame';

interface Props {
  slot: number;
  onCreate: (input: CreationInput, seedText: string) => void;
  onCancel: () => void;
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
  const [homeState, setHomeState] = useState('Indiana');
  const [seedText, setSeedText] = useState('');

  const canSubmit = name.trim().length > 0 && homeCity.trim().length > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onCreate(
      {
        name: name.trim(),
        position,
        jerseyNumber,
        handedness,
        homeCity: homeCity.trim(),
        homeState,
      },
      seedText.trim(),
    );
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl px-8 py-16">
      <div className="text-xs uppercase tracking-widest text-neutral-500">
        Slot {slot + 1}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Create your prospect
      </h1>

      <div className="mt-10 grid grid-cols-2 gap-6">
        <div className="col-span-2">
          <label className={labelClass} htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
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

        <div className="col-span-2">
          <label className={labelClass} htmlFor="city">
            Home city
          </label>
          <input
            id="city"
            className={fieldClass}
            value={homeCity}
            onChange={(e) => setHomeCity(e.target.value)}
          />
        </div>

        <div className="col-span-2">
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
      </div>

      <div className="mt-10 flex gap-3">
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
