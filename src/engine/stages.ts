import { clamp, type Rng } from './rng';
import { overallFor } from './attributes';
import { ageInMonths } from './calendar';
import { programById } from './colleges';
import { alternativeTeamContext, programTeamContext } from './careerPath';
import { DRAFT, initialDraft, projectDraftStock, runDraft } from './draft';
import {
  PRO,
  ageMultiplier,
  contractFor,
  evaluateAwards,
  generateLeague,
  initialPro,
  roleFor,
  shouldRetire,
  teamById,
  teamForPick,
  rookieContract,
} from './proLeague';
import { seasonConfigFor, type TeamContext } from './season';
import { resolveProEnding, buildEnding } from './endings';
import type { CareerStage, GameState, LogEntry } from './types';

/**
 * Stage progression after high school (SPEC §14).
 *
 * Each stage advances on its own clock: college years turn over in May,
 * declarations open in April, the draft is in June, and pro contracts run
 * down every offseason. This module owns those transitions so the tick can
 * stay a readable list of sub-steps.
 */

export type Note = (kind: LogEntry['kind'], text: string) => void;

export function ageYearsOf(state: GameState): number {
  return (
    ageInMonths(state.clock, state.player.birthYear, state.player.birthMonth) / 12
  );
}

/** The team the player is attached to right now, whatever the level. */
export function teamContextFor(state: GameState, fallback: TeamContext): TeamContext {
  switch (state.stage) {
    case 'college':
    case 'juco':
      return state.college
        ? programTeamContext(state.college.programId)
        : fallback;
    case 'developmental':
    case 'overseas':
      return alternativeTeamContext(state.stage);
    case 'nba': {
      if (!state.pro) return fallback;
      const team = teamById(state.pro.league, state.pro.teamId);
      return {
        name: team?.name ?? 'Your team',
        teamStrength: team?.strength ?? 60,
        // In the league, your role is the bar rather than a roster spot.
        rosterDepth: clamp((team?.strength ?? 60) + 4, 30, 96),
        scheduleStrength: 62,
        coachQuality: 80,
        startingTrust: 45,
      };
    }
    default:
      return fallback;
  }
}

/** Coach trust is tracked per stage — college staffs do not inherit it. */
export function trustFor(state: GameState): number {
  if (state.stage === 'college' || state.stage === 'juco') {
    return state.college?.trust ?? 40;
  }
  return state.coachTrust;
}

export interface StageResult {
  state: GameState;
  /** True when the stage handler already ended the career. */
  ended: boolean;
}

/**
 * College and JUCO progression: NIL income, the year turning over in May,
 * eligibility running out, and the portal.
 */
export function advanceCollege(state: GameState, note: Note): GameState {
  const college = state.college;
  if (!college) return state;

  let next = { ...college };
  const money = state.money + college.nilPerMonth;

  // --- May: the academic year turns over --------------------------------
  if (state.clock.month === 4) {
    const burnedYear = !next.redshirtingNow;
    next = {
      ...next,
      year: next.year + 1,
      eligibilityLeft: burnedYear
        ? Math.max(0, next.eligibilityLeft - 1)
        : next.eligibilityLeft,
      redshirted: next.redshirted || next.redshirtingNow,
      redshirtingNow: false,
    };

    if (!burnedYear) {
      note('system', 'Redshirt year complete — the eligibility is preserved.');
    }

    // NIL follows what you did on the floor.
    const recent = state.history.at(-1);
    const ppg = recent && recent.games > 0 ? recent.totals.points / recent.games : 0;
    const raise = clamp(ppg / 18, 0, 1.6);
    next.nilPerMonth = Math.round(
      next.nilPerMonth * (0.85 + raise) + state.hype.hype * 12,
    );
    if (next.nilPerMonth > college.nilPerMonth * 1.2) {
      note('system', `NIL deal renegotiated — $${next.nilPerMonth}/month.`);
    }
  }

  const program = programById(next.programId);
  return {
    ...state,
    college: next,
    money,
    log: state.log,
    school: state.school,
    ...(program ? {} : {}),
  };
}

/** Whether college eligibility has run out with no professional door open. */
export function collegeExhausted(state: GameState): boolean {
  return Boolean(
    state.college &&
      state.college.eligibilityLeft <= 0 &&
      state.clock.month === 4,
  );
}

/**
 * Draft season: keep the projection current, run the draft in June, and place
 * the player with a franchise (or not).
 */
export function advanceDraft(
  state: GameState,
  note: Note,
  rng: Rng,
): GameState {
  let draft = state.draft ?? initialDraft(state.clock.year);
  let next = state;

  // Keep the board current so "test the waters" is an informed decision.
  const projection = projectDraftStock(state);
  draft = { ...draft, projection };

  /*
   * An undrafted player gets another look next year.
   *
   * Going undrafted once used to close the door permanently, which stranded
   * players overseas for a decade with no way back. Real careers do not work
   * that way — you go and get better and put your name in again.
   */
  const ageYears = ageYearsOf(state);
  if (
    draft.completed &&
    draft.pick === 0 &&
    state.clock.month === DRAFT.DECLARE_MONTH &&
    ageYears < 26 &&
    (state.stage === 'overseas' || state.stage === 'developmental')
  ) {
    draft = {
      ...draft,
      year: state.clock.year,
      declared: true,
      testingWaters: false,
      completed: false,
    };
    note('system', 'Putting your name back in the draft.');
  }

  const isDraftMonth = state.clock.month === DRAFT.MONTH;
  if (!isDraftMonth || !draft.declared || draft.completed || draft.withdrew) {
    return { ...next, draft };
  }

  const result = runDraft({ ...state, draft }, rng);
  for (const text of result.notes) note('system', text);

  if (result.draft.pick > 0) {
    const league = generateLeague(rng);
    const team = teamForPick(league, result.draft.pick);
    const contract = rookieContract(result.draft.pick);

    note(
      'system',
      `${team.name} take you. ${contract.type === 'two-way' ? 'Two-way deal' : `$${contract.salary}M a year`}.`,
    );

    return {
      ...next,
      draft: { ...result.draft, teamId: team.id },
      stage: 'nba',
      college: null,
      pro: initialPro(team.id, contract, league),
      // Unlocks the professional storylines (SPEC §12 chaining).
      events: { ...next.events, flags: { ...next.events.flags, in_the_league: true } },
    };
  }

  // Undrafted. A near-miss still gets a two-way and a Summer League look;
  // everyone else goes and earns a living somewhere else, which is what
  // actually happens to the overwhelming majority of undrafted players.
  const nearMiss = result.draft.projection <= 70 && rng.chance(0.3);

  if (!nearMiss) {
    note(
      'system',
      'Undrafted, and no camp invite came. There is still professional basketball overseas.',
    );
    return {
      ...next,
      draft: result.draft,
      stage: 'overseas',
      college: null,
    };
  }

  const league = generateLeague(rng);
  const team = league[Math.floor(rng.next() * league.length)] as (typeof league)[number];
  note(
    'system',
    `Undrafted. ${team.name} offer a two-way contract and a Summer League roster spot.`,
  );

  return {
    ...next,
    draft: { ...result.draft, teamId: team.id },
    stage: 'nba',
    college: null,
    pro: initialPro(
      team.id,
      { type: 'two-way', salary: PRO.TWO_WAY_SALARY, yearsLeft: 2, teamOption: true },
      league,
    ),
  };
}

/**
 * Pro offseason: salary paid, role reassessed, contracts run down, awards
 * handed out, and eventually retirement.
 */
export function advancePro(state: GameState, note: Note, rng: Rng): GameState {
  const pro = state.pro;
  if (!pro) return state;

  const overall = overallFor(state.player.attributes, state.player.position);
  const team = teamById(pro.league, pro.teamId);
  const ageYears = ageYearsOf(state);

  let next: typeof pro = { ...pro };
  let money = state.money;

  // Salary lands monthly, in millions.
  money += (pro.contract.salary * 1_000_000) / 12;

  // Role is reassessed continuously — this is what drives minutes.
  next.role = roleFor(overall, team?.strength ?? 62);

  // --- May: the season is over, hand out the honours -------------------
  if (state.clock.month === 4) {
    const recent = state.history.at(-1);
    const ppg = recent && recent.games > 0 ? recent.totals.points / recent.games : 0;
    const wins = recent ? recent.wins : 0;

    const { awards, allStar } = evaluateAwards(
      state.clock.year,
      overall,
      ppg,
      next.role,
      wins,
      next.seasons === 0,
      rng,
    );
    for (const award of awards) note('system', `${award.name}, ${award.season}.`);

    next = {
      ...next,
      seasons: next.seasons + 1,
      allStars: next.allStars + (allStar ? 1 : 0),
      awards: [...next.awards, ...awards],
    };

    // A deep run is a title run. Winning it all is rare and it should be.
    const wonTitle =
      next.lastPlayoffRound >= seasonConfigFor('nba').playoffRounds;
    if (wonTitle) {
      next.championships += 1;
      note('system', 'You won the championship.');
    }
  }

  // --- July: contracts and free agency ---------------------------------
  if (state.clock.month === 6) {
    next.contract = { ...next.contract, yearsLeft: next.contract.yearsLeft - 1 };

    if (next.contract.yearsLeft <= 0) {
      if (shouldRetire(overall, ageYears, next.seasons, rng)) {
        const retired: GameState = {
          ...state,
          pro: next,
          money,
          stage: 'retired',
        };
        note('system', 'You are out of contract and nobody is calling. That is that.');
        return {
          ...retired,
          careerEnd: buildEnding(retired, resolveProEnding(retired)),
        };
      }

      const years = ageYears > 33 ? 1 : ageYears > 30 ? 2 : 4;
      next.contract = contractFor(overall, ageYears, years);
      note(
        'system',
        `Signed a new deal: $${next.contract.salary}M a year for ${years}.`,
      );
    }
  }

  return { ...state, pro: next, money };
}

/** Physical decline and maturation once a player is past the growth window. */
export function applyProAging(state: GameState): GameState {
  const ageYears = ageYearsOf(state);
  if (ageYears < 24) return state;

  const multiplier = ageMultiplier(ageYears);
  if (multiplier >= 1) return state;

  // Athleticism goes first; skill and feel hold on much longer.
  const decayed = { ...state.player.attributes };
  for (const key of ['vertical', 'speed', 'agility', 'stamina'] as const) {
    decayed[key] = clamp((decayed[key] as number) * (1 - (1 - multiplier) * 0.06), 25, 99);
  }
  return { ...state, player: { ...state.player, attributes: decayed } };
}

/** Stages where the player is on a team and plays a real season. */
export function playsGames(stage: CareerStage): boolean {
  return stage !== 'retired';
}
