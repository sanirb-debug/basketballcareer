import { clamp, type Rng } from './rng';
import { PROGRAMS, TIER_LABEL, jucoPrograms, programById } from './colleges';
import { activeOffers, bestOffer } from './recruiting';
import type {
  CareerStage,
  CollegeState,
  GameState,
  PathOption,
  PostHighSchoolPath,
  Program,
} from './types';

/**
 * The fork at eighteen (SPEC §14).
 *
 * "Commit → college, OR skip college: Overtime Elite / G League Ignite /
 * overseas at 18." Which doors are open is decided by everything that came
 * before: your ranking opens the developmental routes, your grades open the
 * four-year ones, and JUCO is always there, which is what makes it a floor
 * rather than a failure.
 */

export const PATH = {
  /** National rank needed for a G League developmental contract. */
  GLEAGUE_RANK: 30,
  /** National rank needed for an Overtime Elite deal. */
  OTE_RANK: 45,
  /** Rank at which a European club will pay for an 18-year-old American. */
  OVERSEAS_RANK: 170,

  GLEAGUE_STIPEND: 9500,
  OTE_STIPEND: 8000,
  OVERSEAS_STIPEND: 6500,
  /** NIL is handled separately; this is walking-around money on campus. */
  COLLEGE_STIPEND: 900,
  JUCO_STIPEND: 300,
} as const;

const STAGE_FOR_PATH: Record<PostHighSchoolPath, CareerStage> = {
  college: 'college',
  juco: 'juco',
  ote: 'developmental',
  gleague: 'developmental',
  overseas: 'overseas',
};

/**
 * Everything available to this player right now, including the routes that
 * are closed — the player should be able to see the door they did not open
 * and why.
 */
export function pathOptionsFor(state: GameState): PathOption[] {
  const rank = state.hype.nationalRank;
  const qualifier = state.academics.status !== 'non-qualifier';
  const options: PathOption[] = [];

  // --- Four-year college, from an offer already in hand ------------------
  const committed = state.recruiting.commitment
    ? programById(state.recruiting.commitment.programId)
    : null;
  const best = bestOffer(state.recruiting);
  const collegeTarget =
    committed && committed.tier !== 'juco'
      ? committed
      : best && best.tier !== 'juco'
        ? best
        : null;

  options.push({
    path: 'college',
    programId: collegeTarget?.id ?? null,
    label: collegeTarget
      ? `${collegeTarget.name} (${TIER_LABEL[collegeTarget.tier]})`
      : 'Four-year college',
    detail: collegeTarget
      ? 'Take the scholarship. Three or four years to develop, NIL money, and the draft when you are ready.'
      : 'No four-year program has offered.',
    stipend: PATH.COLLEGE_STIPEND,
    available: Boolean(collegeTarget) && qualifier,
    blockedReason: !collegeTarget
      ? 'No four-year offer on the table'
      : !qualifier
        ? 'You are not academically eligible'
        : null,
  });

  // --- JUCO: always open -------------------------------------------------
  const jucoOffer =
    activeOffers(state.recruiting)
      .map((o) => programById(o.programId))
      .find((p): p is Program => Boolean(p) && p!.tier === 'juco') ??
    jucoPrograms()[0];

  options.push({
    path: 'juco',
    programId: jucoOffer?.id ?? null,
    label: jucoOffer ? `${jucoOffer.name} (JUCO)` : 'Junior college',
    detail:
      'Two years to fix what needs fixing, then re-recruit as a transfer with a compressed window.',
    stipend: PATH.JUCO_STIPEND,
    available: true,
    blockedReason: null,
  });

  // --- The pro-alternative routes ---------------------------------------
  options.push({
    path: 'gleague',
    programId: null,
    label: 'G League developmental contract',
    detail:
      'Get paid to develop against professionals a year early. No college, no eligibility to protect, and nowhere to hide.',
    stipend: PATH.GLEAGUE_STIPEND,
    available: rank <= PATH.GLEAGUE_RANK,
    blockedReason:
      rank <= PATH.GLEAGUE_RANK ? null : `They take the top ${PATH.GLEAGUE_RANK}; you are #${rank}`,
  });

  options.push({
    path: 'ote',
    programId: null,
    label: 'Overtime Elite',
    detail:
      'A salary at eighteen and a camera on you constantly. Enormous exposure, and you give up college eligibility to take it.',
    stipend: PATH.OTE_STIPEND,
    available: rank <= PATH.OTE_RANK,
    blockedReason:
      rank <= PATH.OTE_RANK ? null : `They take the top ${PATH.OTE_RANK}; you are #${rank}`,
  });

  options.push({
    path: 'overseas',
    programId: null,
    label: 'Overseas professional',
    detail:
      'A real professional contract in Europe. The money is good and the American scouts are a long way away.',
    stipend: PATH.OVERSEAS_STIPEND,
    available: rank <= PATH.OVERSEAS_RANK,
    blockedReason:
      rank <= PATH.OVERSEAS_RANK
        ? null
        : `Clubs are not signing an unranked eighteen-year-old`,
  });

  return options;
}

/** Whether any route at all is open. If not, the run ends here (SPEC §15). */
export function hasAnyPath(state: GameState): boolean {
  return pathOptionsFor(state).some((o) => o.available);
}

export interface PathEntry {
  stage: CareerStage;
  college: CollegeState | null;
  note: string;
}

/** Move the career onto a chosen route. */
export function enterPath(
  option: PathOption,
  monthsElapsed: number,
  rng: Rng,
): PathEntry {
  const stage = STAGE_FOR_PATH[option.path];

  if (option.path === 'college' || option.path === 'juco') {
    const program = option.programId ? programById(option.programId) : null;
    if (!program) throw new Error(`enterPath: unknown program ${option.programId}`);

    return {
      stage,
      college: {
        programId: program.id,
        year: 1,
        // JUCO carries two years of eligibility, four-year schools four.
        eligibilityLeft: program.tier === 'juco' ? 2 : 4,
        redshirted: false,
        redshirtingNow: false,
        nilPerMonth: initialNil(program, rng),
        transfers: 0,
        // You arrive with less standing than you had as a high school senior.
        trust: clamp(rng.normal(38, 8), 15, 70),
        inPortal: false,
      },
      note:
        program.tier === 'juco'
          ? `Enrolled at ${program.name}. Two years to earn your way back.`
          : `Enrolled at ${program.name}. ${TIER_LABEL[program.tier]} basketball.`,
    };
  }

  void monthsElapsed;
  return {
    stage,
    college: null,
    note:
      option.path === 'overseas'
        ? 'Signed a professional contract overseas at eighteen.'
        : `Signed a ${option.label}.`,
  };
}

/** NIL money on arrival, driven by the program's profile (SPEC §14). */
function initialNil(program: Program, rng: Rng): number {
  const base =
    program.tier === 'blueblood'
      ? 5200
      : program.tier === 'high-major'
        ? 2100
        : program.tier === 'mid-major'
          ? 550
          : program.tier === 'low-major'
            ? 120
            : 0;
  return Math.max(0, Math.round(rng.normal(base, base * 0.35)));
}

/** Team context for whichever program the player is attached to. */
export function programTeamContext(programId: string) {
  const program = programById(programId) ?? PROGRAMS[0]!;
  return {
    name: program.name,
    teamStrength: program.strength,
    rosterDepth: program.rosterDepth,
    // Conference schedule strength tracks the level you are playing at.
    scheduleStrength: clamp(program.strength - 4, 25, 95),
    coachQuality: program.coachQuality,
    startingTrust: 38,
  };
}

/** A generic team context for the routes with no named program. */
export function alternativeTeamContext(stage: CareerStage) {
  switch (stage) {
    case 'developmental':
      return {
        name: 'Developmental squad',
        teamStrength: 74,
        rosterDepth: 74,
        scheduleStrength: 74,
        coachQuality: 82,
        startingTrust: 40,
      };
    case 'overseas':
      return {
        name: 'European club',
        teamStrength: 70,
        rosterDepth: 72,
        scheduleStrength: 70,
        coachQuality: 74,
        startingTrust: 34,
      };
    default:
      return {
        name: 'Team',
        teamStrength: 60,
        rosterDepth: 60,
        scheduleStrength: 60,
        coachQuality: 60,
        startingTrust: 40,
      };
  }
}
