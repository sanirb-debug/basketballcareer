import { useState } from 'react';
import {
  ROLE_LABEL,
  canInteract,
  interactionsFor,
  type InteractionId,
} from '../engine/people';
import type { Person, PersonRole } from '../engine/types';

/**
 * The people screen (SPEC §6).
 *
 * Grouped by who they are to you, each with their own interaction menu. The
 * bar is the whole point: it is the only place in the game where the number
 * going down is entirely your fault and entirely fixable.
 */

interface Props {
  people: Person[];
  monthsElapsed: number;
  money: number;
  onInteract: (personId: string, interaction: InteractionId) => void;
}

const GROUPS: { title: string; roles: PersonRole[] }[] = [
  { title: 'Family', roles: ['father', 'mother', 'sibling'] },
  { title: 'Basketball', roles: ['coach', 'trainer', 'agent', 'teammate'] },
  { title: 'Friends', roles: ['friend'] },
  { title: 'Partner', roles: ['partner'] },
  { title: 'Rivals', roles: ['rival'] },
  { title: 'Exes', roles: ['ex'] },
];

function tone(value: number): string {
  if (value >= 75) return 'bg-emerald-500';
  if (value >= 50) return 'bg-sky-500';
  if (value >= 28) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function PeoplePanel({
  people,
  monthsElapsed,
  money,
  onInteract,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const selected = people.find((p) => p.id === open) ?? null;

  return (
    <div className="space-y-8">
      <p className="text-sm text-neutral-500">
        One interaction per person per month. Relationships fade on their own if
        you leave them alone for half a year.
      </p>

      {GROUPS.map((group) => {
        const members = people.filter(
          (p) => group.roles.includes(p.role) && p.active,
        );
        if (members.length === 0) return null;

        return (
          <section key={group.title}>
            <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              {group.title}
            </h3>

            <ul className="mt-3 divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
              {members.map((person) => {
                const available = canInteract(person, monthsElapsed);
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(person.id)}
                      className="flex w-full items-center gap-4 bg-neutral-950 px-5 py-3.5 text-left transition hover:bg-neutral-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate font-medium text-neutral-100">
                            {person.name}
                          </span>
                          <span className="shrink-0 text-xs text-neutral-500">
                            {ROLE_LABEL[person.role]} · {person.age}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="h-1.5 w-40 overflow-hidden rounded bg-neutral-800">
                            <span
                              className={`block h-full ${tone(person.relationship)}`}
                              style={{ width: `${person.relationship}%` }}
                            />
                          </span>
                          <span className="text-xs tabular-nums text-neutral-600">
                            {Math.round(person.relationship)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-xs ${
                          available ? 'text-orange-400' : 'text-neutral-700'
                        }`}
                      >
                        {available ? 'Interact →' : 'Seen this month'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {selected && (
        <InteractionModal
          person={selected}
          monthsElapsed={monthsElapsed}
          money={money}
          onClose={() => setOpen(null)}
          onPick={(interaction) => {
            onInteract(selected.id, interaction);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function InteractionModal({
  person,
  monthsElapsed,
  money,
  onClose,
  onPick,
}: {
  person: Person;
  monthsElapsed: number;
  money: number;
  onClose: () => void;
  onPick: (interaction: InteractionId) => void;
}) {
  const available = canInteract(person, monthsElapsed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-950 p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-medium text-neutral-100">{person.name}</h3>
          <span className="text-xs uppercase tracking-widest text-neutral-500">
            {ROLE_LABEL[person.role]}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Age {person.age} · relationship {Math.round(person.relationship)}
        </p>

        <ul className="mt-5 space-y-2">
          {interactionsFor(person.role).map((def) => {
            const affordable = money >= def.cost;
            const usable = available && affordable;
            return (
              <li key={def.id}>
                <button
                  type="button"
                  disabled={!usable}
                  onClick={() => onPick(def.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-neutral-800 px-4 py-3 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:text-neutral-700"
                >
                  <span>
                    <span className="block text-sm text-neutral-100">
                      {def.label}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {def.detail}
                    </span>
                  </span>
                  {def.cost > 0 && (
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        affordable ? 'text-neutral-400' : 'text-red-400'
                      }`}
                    >
                      ${def.cost}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {!available && (
          <p className="mt-4 text-sm text-amber-400">
            You already spent time with {person.name} this month.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
        >
          Close
        </button>
      </div>
    </div>
  );
}
