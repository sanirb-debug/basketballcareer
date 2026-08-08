import { clamp, type Rng } from './rng';
import { overallFor } from './attributes';
import type { CareerStage, DraftState, GameState } from './types';

/**
 * The draft (SPEC §14).
 *
 * "Draft: declare, test the waters, withdraw before the deadline." Declaring
 * without withdrawing burns your remaining college eligibility, which is what
 * makes testing the waters a real decision rather than a free look.
 */

export const DRAFT = {
  PICKS: 60,
  ROUND_SIZE: 30,
  /** Month the draft is held (June). */
  MONTH: 5,
  /** Month by which a tester must withdraw (May). */
  WITHDRAW_MONTH: 4,
  /** Month declarations open (April). */
  DECLARE_MONTH: 3,
} as const;

export function initialDraft(year: number): DraftState {
  return {
    year,
    declared: false,
    testingWaters: false,
    withdrew: false,
    pick: 0,
    round: 0,
    teamId: null,
    projection: 99,
    completed: false,
  };
}

/**
 * Where scouts project the player, updated every month.
 *
 * Weighted toward production and age as much as raw rating — a 22-year-old
 * putting up numbers in a mid-major is a very different prospect from a
 * 19-year-old doing the same thing, and the board knows it.
 */
export function projectDraftStock(state: GameState): number {
  const overall = overallFor(state.player.attributes, state.player.position);
  const ageYears =
    (state.clock.year * 12 +
      state.clock.month -
      (state.player.birthYear * 12 + state.player.birthMonth)) /
    12;

  /*
   * Scouts judge on a body of work, not one season.
   *
   * Reading only the most recent year meant a single injury-wrecked or
   * redshirt season collapsed a player's stock to zero — which perversely
   * made a harder-working, more injury-prone career draft *worse* than a
   * lazier one. Take the best of the last two.
   */
  const ppgOf = (index: number) => {
    const season = state.history.at(index);
    return season && season.games > 0 ? season.totals.points / season.games : 0;
  };
  const ppg = Math.max(ppgOf(-1), ppgOf(-2));

  // Level of competition matters: the same numbers mean different things.
  const levelBonus =
    state.stage === 'college'
      ? 10
      : state.stage === 'developmental'
        ? 14
        : state.stage === 'overseas'
          ? 6
          : state.stage === 'juco'
            ? -8
            : 0;

  // Youth is the single biggest multiplier on draft stock.
  const youth = clamp((22 - ageYears) * 4.5, -14, 16);

  /*
   * The board is brutally steep on purpose.
   *
   * Sixty players are drafted worldwide each year. A solid college starter is
   * not a draft pick — he is a very good player who goes to Europe. Anchoring
   * at 79 overall ≈ the back of the first round keeps that true: below the
   * mid-70s the projection falls off the board entirely, which is what makes
   * hearing your name called mean something.
   */
  const score =
    (overall - 79) * 3.6 +
    (ppg - 12) * 0.9 +
    levelBonus +
    youth +
    (state.hype.hype - 40) * 0.22 +
    (state.reputation.offCourt - 50) * 0.1;

  // Score maps onto a board position: high score = early pick.
  return clamp(Math.round(34 - score), 1, 99);
}

export function canDeclare(state: GameState): boolean {
  if (!state.draft || state.draft.completed) return false;
  if (state.draft.declared) return false;
  const eligibleStage: CareerStage[] = [
    'college',
    'juco',
    'developmental',
    'overseas',
  ];
  return (
    eligibleStage.includes(state.stage) && state.clock.month === DRAFT.DECLARE_MONTH
  );
}

export function canWithdraw(state: GameState): boolean {
  return Boolean(
    state.draft?.declared &&
      state.draft.testingWaters &&
      !state.draft.completed &&
      state.clock.month <= DRAFT.WITHDRAW_MONTH,
  );
}

export interface DraftNight {
  draft: DraftState;
  notes: string[];
}

/**
 * Resolve draft night.
 *
 * The projection is a centre point, not a promise — teams reach and slide, so
 * a lottery projection can still fall out of the first round.
 */
export function runDraft(state: GameState, rng: Rng): DraftNight {
  const draft = state.draft;
  if (!draft) throw new Error('runDraft: no draft state');

  const projection = projectDraftStock(state);
  // Draft night noise. Boards move, teams reach, agents lie.
  const landed = Math.round(rng.normal(projection, 7.5));

  if (landed < 1 || landed > DRAFT.PICKS) {
    return {
      draft: { ...draft, projection, pick: 0, round: 0, completed: true },
      notes: [
        landed < 1
          ? 'You went first overall.'
          : 'Sixty picks went by and your name was not one of them.',
      ],
    };
  }

  const pick = clamp(landed, 1, DRAFT.PICKS);
  const round = pick <= DRAFT.ROUND_SIZE ? 1 : 2;

  return {
    draft: { ...draft, projection, pick, round, completed: true },
    notes: [
      `Selected #${pick} overall in round ${round} of the ${draft.year} draft.`,
    ],
  };
}

export function describeProjection(projection: number): string {
  if (projection <= 5) return 'top-five pick';
  if (projection <= 14) return 'lottery pick';
  if (projection <= 30) return 'first round';
  if (projection <= 60) return 'second round';
  if (projection <= 75) return 'on the bubble';
  return 'not on the board';
}
