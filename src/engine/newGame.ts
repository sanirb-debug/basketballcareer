import { clamp, createRng, seedToState } from './rng';
import {
  START_MONTH,
  START_YEAR,
  ageInMonths,
  birthYearForMonth,
} from './calendar';
import { rollOrigin } from './origin';
import { rollGenetics } from './genetics';
import { bodyAtAge } from './growth';
import { rollStartingAttributes } from './attributes';
import { initialTrainingState } from './actions';
import { schoolFor } from './school';
import { initialAcademics } from './academics';
import { initialRecruiting } from './recruiting';
import { initialRelationships } from './relationships';
import { designateRival, generateClass, playerRank, rankingScore } from './prospects';
import { overallFor } from './attributes';
import {
  SCHEMA_VERSION,
  type Clock,
  type GameState,
  type Genetics,
  type Handedness,
  type Position,
  type SchoolTier,
} from './types';

export interface CreationInput {
  name: string;
  position: Position;
  jerseyNumber: number;
  handedness: Handedness;
  homeCity: string;
  homeState: string;
  schoolTier: SchoolTier;
  /** Optional: name your own high school. Falls back to the tier's default. */
  schoolName?: string;
}

/**
 * The single legitimate non-mulberry random in the codebase: choosing a seed
 * for a brand-new run. It sits outside the simulation, its result is recorded
 * into the save, and every draw after this point comes from the seeded stream.
 *
 * The Phase 0 source scan whitelists exactly this call site.
 */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] as number;
}

export interface CreateGameOptions {
  /**
   * Test-only genetic override, merged over the rolled genetics. Lets the
   * Phase 1 verification construct exact max-genes and low-genes players
   * instead of hunting for seeds that happen to produce them.
   */
  debugGenetics?: Partial<Genetics>;
}

export function createGame(
  seed: number,
  input: CreationInput,
  options: CreateGameOptions = {},
): GameState {
  const rng = createRng(seedToState(seed));

  const birthMonth = rng.int(0, 11);
  const birthYear = birthYearForMonth(birthMonth);
  const clock: Clock = { year: START_YEAR, month: START_MONTH };
  const startAgeMonths = ageInMonths(clock, birthYear, birthMonth);

  const origin = rollOrigin(rng, {
    homeCity: input.homeCity,
    homeState: input.homeState,
  });

  const genetics: Genetics = {
    ...rollGenetics(rng, origin),
    ...options.debugGenetics,
  };

  // Players start somewhere in 13y0m–13y11m, so wind the growth schedule
  // forward to their actual age rather than assuming exactly 13y0m.
  const body = bodyAtAge(startAgeMonths, genetics);

  const attributes = rollStartingAttributes(
    rng,
    genetics,
    input.position,
    startAgeMonths,
    body,
  );

  const hiddenMeta = {
    potential: genetics.potential,
    workEthic: clamp(rng.normal(55, 14), 25, 99),
    injuryProneness: genetics.injuryProneness,
    confidence: 50,
  };

  const school = schoolFor(input.schoolTier, {
    ...(input.schoolName ? { name: input.schoolName } : {}),
    city: input.homeCity,
  });
  const academics = initialAcademics(rng);
  const recruiting = initialRecruiting(rng);
  const relationships = initialRelationships(origin.familyStructure);

  // A 13-year-old starts with almost no hype: the class does not know he
  // exists yet, which is what makes the climb up the board mean something.
  const startingHype = clamp(rng.normal(8, 4), 0, 25);
  const overall = overallFor(attributes, input.position);

  const rawClass = generateClass(rng);
  const prospects = designateRival(
    rawClass,
    rankingScore(overall, startingHype),
    rng,
  );

  const playerEntry = {
    name: input.name,
    position: input.position,
    homeState: input.homeState,
    rating: overall,
    hype: startingHype,
  };
  const nationalRank = playerRank(prospects, playerEntry);

  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngState: rng.state(),
    clock,
    monthsElapsed: 0,
    player: {
      name: input.name,
      position: input.position,
      jerseyNumber: input.jerseyNumber,
      handedness: input.handedness,
      birthYear,
      birthMonth,
      body,
      attributes,
      hiddenMeta,
    },
    origin,
    school,
    coachTrust: school.startingTrust,
    training: initialTrainingState(),
    condition: { energy: 100, injury: null },
    season: null,
    history: [],
    academics,
    reputation: { onCourt: 50, offCourt: 55 },
    hype: {
      hype: startingHype,
      nationalRank,
      previousRank: nationalRank,
      aauTier: 'none',
      campInvites: 0,
    },
    prospects,
    relationships,
    recruiting,
    events: { pending: null, flags: {}, fired: [], decisions: [] },
    money: origin.incomeTier === 'affluent' ? 1500 : origin.incomeTier === 'comfortable' ? 600 : 150,
    stage: 'highschool',
    awaitingPath: false,
    college: null,
    draft: null,
    pro: null,
    careerEnd: null,
    hidden: { genetics },
    log: [
      {
        monthsElapsed: 0,
        year: clock.year,
        month: clock.month,
        kind: 'system',
        text: `${input.name} starts out in ${input.homeCity}, ${input.homeState}. ${school.middleSchoolName} now, ${school.name} next year.`,
      },
    ],
  };
}
