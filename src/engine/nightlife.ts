import { clamp, type Rng } from './rng';
import { makePerson } from './people';
import type { CareerStage, NightlifeState, Person } from './types';

/**
 * The off-court life (SPEC §6).
 *
 * The thing that ends careers at this level is almost never the jumper. It is
 * the schedule you keep when nobody is filming. A rotation guy who is out four
 * nights a week is a rotation guy for two more seasons and then he is out of
 * the league, and everyone around him watched it happen and said nothing.
 *
 * So this is modelled as a genuine trade, not a punishment:
 *
 * - Going out *works*. It is where confidence comes from, where teammates
 *   become friends, and where you meet people. A player who never leaves the
 *   gym is not automatically the optimal build.
 * - What it costs is `distraction`, which is read by training, by coach
 *   trust, and by what you have left in the fourth quarter. It decays when
 *   you leave it alone.
 * - Fame is the multiplier on the risk, not on the fun. Nobody photographs a
 *   sophomore at a mid-major. They photograph a max-contract starter, and
 *   then his girlfriend reads about it.
 *
 * Everything here is gated behind `NIGHTLIFE_MIN_AGE`. The career starts at
 * thirteen; none of this exists until the player is an adult, and the gate is
 * asserted in verification rather than trusted to the UI.
 */

export const NIGHTLIFE_MIN_AGE = 18;

export function nightlifeUnlocked(ageYears: number): boolean {
  return ageYears >= NIGHTLIFE_MIN_AGE;
}

export function initialNightlife(): NightlifeState {
  return {
    distraction: 0,
    nightsThisMonth: 0,
    nightsOut: 0,
    flings: 0,
    tabloidStories: 0,
    caught: 0,
  };
}

// --- The nights -----------------------------------------------------------

export type NightId =
  | 'teamDinner'
  | 'outWithTheGuys'
  | 'club'
  | 'apps'
  | 'afterHours'
  | 'quietNight';

export interface NightDef {
  id: NightId;
  label: string;
  detail: string;
  cost: number;
  /** Energy spent. Negative restores it. */
  energy: number;
  /** Base chance of meeting somebody. */
  meetChance: number;
  /** How visible the night is. Multiplied by fame for the tabloid roll. */
  exposure: number;
  /** How much of your head it takes with it. */
  distraction: number;
  /** Confidence. Being happy is not nothing. */
  joy: number;
  /** Standing with teammates and friends. */
  social: number;
  /** Stages this is offered at. Omitted means all of them. */
  stages?: CareerStage[];
}

export const NIGHTS: NightDef[] = [
  {
    id: 'teamDinner',
    label: 'Team dinner',
    detail:
      'The whole roster, one long table, somebody else picking up the check. You learn more about your teammates in three hours than in a season of practice.',
    cost: 120,
    energy: 6,
    meetChance: 0.04,
    exposure: 0.2,
    distraction: 1,
    joy: 6,
    social: 9,
  },
  {
    id: 'outWithTheGuys',
    label: 'Out with the guys',
    detail:
      'Nothing planned. Two bars, somebody’s cousin driving, home at a time you would not tell your coach. The version of this that everybody does and nobody mentions.',
    cost: 260,
    energy: 16,
    meetChance: 0.3,
    exposure: 1,
    distraction: 8,
    joy: 11,
    social: 7,
  },
  {
    id: 'club',
    label: 'The club',
    detail:
      'Bottle service, a booth with a rope around it, and forty phones pointed at you the whole night. You will have a very good time and so will everyone with a camera.',
    cost: 3200,
    energy: 24,
    meetChance: 0.55,
    exposure: 2.4,
    distraction: 16,
    joy: 16,
    social: 5,
  },
  {
    id: 'apps',
    label: 'Swipe for a while',
    detail:
      'Low effort, low ceiling, and completely invisible — right up until somebody screenshots the conversation.',
    cost: 0,
    energy: 4,
    meetChance: 0.4,
    exposure: 0.5,
    distraction: 5,
    joy: 4,
    social: 0,
  },
  {
    id: 'afterHours',
    label: 'Stay out',
    detail:
      'The night was over an hour ago and you are still in it. Shootaround is at ten. You have decided that is a problem for a different version of you.',
    cost: 1400,
    energy: 34,
    meetChance: 0.6,
    exposure: 1.9,
    distraction: 26,
    joy: 18,
    social: 3,
  },
  {
    id: 'quietNight',
    label: 'Quiet night',
    detail:
      'Home, early, phone across the room. Unglamorous, and the single most reliable thing on this menu.',
    cost: 0,
    energy: -10,
    meetChance: 0,
    exposure: 0,
    distraction: -14,
    joy: 3,
    social: 0,
  },
];

export function nightById(id: NightId): NightDef | undefined {
  return NIGHTS.find((n) => n.id === id);
}

export function nightsFor(stage: CareerStage, ageYears: number): NightDef[] {
  if (!nightlifeUnlocked(ageYears)) return [];
  return NIGHTS.filter((n) => !n.stages || n.stages.includes(stage));
}

// --- Fame -----------------------------------------------------------------

/**
 * How much of the world is looking at you.
 *
 * A junior at a low-major can close a bar and nothing happens. A starter on a
 * max deal cannot buy gas without it being content. This is the number that
 * turns the same night into two completely different mornings.
 */
export function fameFor(
  stage: CareerStage,
  hype: number,
  followers: number,
): number {
  const base =
    stage === 'nba'
      ? 58
      : stage === 'college'
        ? 22
        : stage === 'overseas' || stage === 'developmental'
          ? 18
          : 8;
  const reach = Math.log10(1 + followers) * 4.5;
  return clamp(base + hype * 0.35 + reach, 0, 100);
}

// --- Resolving a night ----------------------------------------------------

export interface NightContext {
  stage: CareerStage;
  ageYears: number;
  fame: number;
  monthsElapsed: number;
  nightsThisMonth: number;
  /** The partner you are supposed to be going home to, if there is one. */
  partner: Person | null;
  playerSurname: string;
}

export interface NightResult {
  moneyDelta: number;
  energyDelta: number;
  distractionDelta: number;
  joyDelta: number;
  socialDelta: number;
  offCourtDelta: number;
  coachTrustDelta: number;
  hypeDelta: number;
  /** Somebody new, if you met somebody. */
  metPerson: Person | null;
  /** Set when there was a partner and you went home with somebody else. */
  cheated: boolean;
  caught: boolean;
  tabloid: boolean;
  /** How the partner's number should move. */
  partnerDelta: number;
  /** Set when the partner ends it there and then. */
  partnerEnded: boolean;
  outcome: string[];
}

/**
 * The fourth night out in a month is not the fourth first night out.
 *
 * Same shape as the training and interaction curves: there is no cap, you can
 * go out every night of February if you want to. It just stops being fun and
 * never stops being expensive.
 */
function nightFalloff(nightsThisMonth: number): number {
  return Math.pow(0.7, Math.max(0, nightsThisMonth));
}

export function resolveNight(
  def: NightDef,
  context: NightContext,
  rng: Rng,
): NightResult {
  const { fame, partner, monthsElapsed } = context;
  const joyFalloff = nightFalloff(context.nightsThisMonth);

  const result: NightResult = {
    moneyDelta: -def.cost,
    energyDelta: -def.energy,
    distractionDelta: def.distraction,
    joyDelta: def.joy * joyFalloff,
    socialDelta: def.social * joyFalloff,
    offCourtDelta: 0,
    coachTrustDelta: 0,
    hypeDelta: 0,
    metPerson: null,
    cheated: false,
    caught: false,
    tabloid: false,
    partnerDelta: 0,
    partnerEnded: false,
    outcome: [],
  };

  const say = (line: string) => result.outcome.push(line);

  // --- The quiet option short-circuits everything else -------------------
  if (def.id === 'quietNight') {
    say(
      partner
        ? `A night in with ${partner.name}. Nothing happened, which was the entire point.`
        : 'You stayed in. The group chat will survive without you.',
    );
    if (partner) result.partnerDelta = 4;
    return result;
  }

  // --- Did you meet somebody? -------------------------------------------
  // Fame opens doors. That is the part nobody warns you about.
  const meetChance = clamp(def.meetChance * (0.7 + fame / 140), 0, 0.92);
  const met = rng.chance(meetChance);

  if (met) {
    const person = makePerson(rng, 'fling', context.playerSurname, {
      age: Math.max(18, Math.round(context.ageYears + rng.float(-3, 5))),
      relationship: rng.int(28, 52),
    });
    result.metPerson = { ...person, metMonth: monthsElapsed, exclusive: false };

    if (partner) {
      // You had somewhere to be and you did not go there.
      result.cheated = true;
      result.distractionDelta += 6;

      // Getting away with it is a function of how many people know your face.
      const caughtChance = clamp(0.12 + (fame / 100) * 0.45 + def.exposure * 0.05, 0.08, 0.75);
      result.caught = rng.chance(caughtChance);

      if (result.caught) {
        say(
          `${partner.name} found out. Not from you — from a photograph, and then from everybody who had already seen it.`,
        );
        result.partnerDelta = -55;
        result.offCourtDelta = -10;
        result.distractionDelta += 14;
        // Whether it survives depends on what was there to begin with.
        result.partnerEnded = partner.relationship < 70 || rng.chance(0.55);
        if (result.partnerEnded) {
          say(`It did not survive the week.`);
        } else {
          say(
            `It survived, in the sense that neither of you has said the word yet.`,
          );
        }
      } else {
        say(
          `You met ${result.metPerson.name}. You went home the long way and told ${partner.name} the night ran late.`,
        );
        result.partnerDelta = -3;
        // The cost is not the getting caught. It is the carrying it.
        result.distractionDelta += 4;
      }
    } else {
      say(
        `You met ${result.metPerson.name}. Numbers were exchanged, and for once you actually saved it.`,
      );
      result.joyDelta += 5;
    }
  }

  // --- Did it make the news? --------------------------------------------
  const tabloidChance = clamp((fame / 100) * def.exposure * 0.32, 0, 0.7);
  result.tabloid = def.exposure > 0 && rng.chance(tabloidChance);

  if (result.tabloid) {
    // All publicity is publicity. It is just not the kind that gets you
    // minutes.
    result.hypeDelta = 1.4 + def.exposure;
    result.offCourtDelta -= 6 + def.exposure * 2;
    result.coachTrustDelta -= 2 + def.exposure;
    say(TABLOID_LINES[Math.floor(rng.next() * TABLOID_LINES.length)]);
  }

  // --- The morning after -------------------------------------------------
  if (result.outcome.length === 0) {
    say(NEUTRAL_LINES[Math.floor(rng.next() * NEUTRAL_LINES.length)]);
  }

  if (context.nightsThisMonth >= 3) {
    say('This is the fourth one this month. It is starting to show.');
    result.distractionDelta += 4;
    result.coachTrustDelta -= 1;
  }

  return result;
}

/**
 * The headline, not the night.
 *
 * Written from the outside on purpose — you never get to see your own evening
 * again, only the version of it that other people are now discussing.
 */
const TABLOID_LINES = [
  'It is a video by morning. Fourteen seconds, shot from above, and you are very clearly enjoying yourself.',
  'A blog has the photos and a headline with your name and an exclamation point in it.',
  'Someone tagged the venue. By lunch it is a segment, and two former players have opinions about your professionalism.',
  'Your agent calls before you are awake. He is not angry. He is doing the voice he uses when he is angry.',
  'The team asks, politely, whether you would consider a side door next time.',
];

const NEUTRAL_LINES = [
  'A good night, and nobody made anything of it.',
  'You got out clean. Late, but clean.',
  'Nothing happened, which at this point counts as a result.',
  'You were home by two and nobody was outside.',
];

// --- What it costs you ----------------------------------------------------

export interface DistractionEffects {
  /** Multiplier on training gains. */
  trainingFactor: number;
  /** Monthly coach trust drift. */
  trustDelta: number;
  /** Points off effective confidence in games. */
  confidencePenalty: number;
  /** Multiplier on the injury roll — tired bodies break. */
  injuryFactor: number;
}

/**
 * Distraction is not a morality meter. It is a tax, it is legible, and it is
 * always payable — walk away from it for a few months and it clears.
 */
export function distractionEffects(distraction: number): DistractionEffects {
  const d = clamp(distraction, 0, 100) / 100;
  return {
    trainingFactor: 1 - d * 0.34,
    // `-0 * x` is `-0`, which then propagates into coach trust and breaks an
    // exact comparison further down. Normalise it the way `makes()` does.
    trustDelta: d === 0 ? 0 : -d * 2.6,
    confidencePenalty: d * 22,
    injuryFactor: 1 + d * 0.35,
  };
}

/** What it looks like on the screen. */
export function describeDistraction(distraction: number): string {
  if (distraction >= 75) return 'Out of pocket';
  if (distraction >= 55) return 'Burning it';
  if (distraction >= 35) return 'Living a bit';
  if (distraction >= 15) return 'Balanced';
  return 'Locked in';
}

/**
 * The monthly settle.
 *
 * Distraction decays on its own — this is the part that makes it a trade
 * rather than a death spiral. Somebody at home who knows you speeds it up,
 * which is the whole argument for having one.
 */
export function settleNightlife(
  nightlife: NightlifeState,
  options: { hasPartner: boolean; exclusive: boolean },
): NightlifeState {
  const decay = 6 + (options.hasPartner ? 2 : 0) + (options.exclusive ? 3 : 0);
  return {
    ...nightlife,
    distraction: clamp(nightlife.distraction - decay, 0, 100),
    nightsThisMonth: 0,
  };
}
