import { TIER_LABEL, programById } from './colleges';
import { activeOffers, bestOffer } from './recruiting';
import { ACADEMICS } from './academics';
import type { CareerEnd, EndingId, GameState } from './types';

/**
 * Terminal states for the whole career (SPEC §15).
 *
 * Three rules from the spec drive everything here:
 *
 * 1. Every run ends with a *named* ending and a screen that "names the
 *    specific decision that broke it" — so every ending carries a `decision`
 *    line built from what actually happened in this run, not boilerplate.
 * 2. "Most sims only reward becoming the best player alive. This one must make
 *    a 6th-man defensive stopper who lasts 14 years feel like a successful
 *    run." A ring as a role player scores above being a star who never won.
 * 3. JUCO and the undrafted road are survivable, not fail states.
 */

export interface EndingCopy {
  reason: string;
  detail: string;
  /** Higher is a better outcome, for sorting and for the archive. */
  score: number;
}

const ENDING_COPY: Record<EndingId, EndingCopy> = {
  'hall-of-fame': {
    reason: 'Hall of Fame',
    detail:
      'They put you on the wall. Every kid who picks up a ball in your hometown for the next fifty years hears your name before they hear anyone else’s.',
    score: 100,
  },
  superstar: {
    reason: 'Superstar',
    detail:
      'You were, for a stretch of years, one of the best players alive. Franchises were built around what you could do, and the league looked different because you were in it.',
    score: 94,
  },
  'all-star': {
    reason: 'All-Star',
    detail:
      'Multiple All-Star selections and a career people will argue about in a good way. You were, unambiguously, one of the best in the world at this.',
    score: 84,
  },
  'role-player-with-ring': {
    reason: 'Champion role player',
    detail:
      'You were never the best player on the floor and you did not need to be. You defended, you made the right pass, you hit the shot when it came, and you have a ring that says it worked. This is what a successful career actually looks like.',
    score: 80,
  },
  starter: {
    reason: 'Long-time starter',
    detail:
      'A decade of starts. Not a household name outside your city, and completely indispensable inside it.',
    score: 72,
  },
  'role-player': {
    reason: 'Rotation player',
    detail:
      'You carved out a real career off the bench in the best league in the world. Thousands of people who were better than you at eighteen never got a single minute of this.',
    score: 62,
  },
  'two-way-shuttle': {
    reason: 'The two-way shuttle',
    detail:
      'Years of call-ups and send-downs, hotel rooms in two leagues, and a handful of nights you will never forget. You were on an NBA floor. Most people are not.',
    score: 46,
  },
  'undrafted-grinder': {
    reason: 'Undrafted grinder',
    detail:
      'Nobody called your name on draft night, and you kept playing anyway — summer leagues, camps, whatever door was open. The grind was the career.',
    score: 42,
  },
  'overseas-journeyman': {
    reason: 'Overseas journeyman',
    detail:
      'Six countries, four languages you half-learned, and a professional basketball career that paid your bills for a decade. The NBA never called. Plenty of very good players can say the same.',
    score: 40,
  },
  'college-washout': {
    reason: 'Out of eligibility',
    detail:
      'Four years of college basketball and no professional door open at the end of it. You got an education and a lot of good memories out of it, which is more than most.',
    score: 28,
  },
  'juco-dead-end': {
    reason: 'The road ended at JUCO',
    detail:
      'Two years of junior college and nobody came back for you. It was a genuine chance, and it did not convert.',
    score: 24,
  },
  'academic-washout': {
    reason: 'Academic washout',
    detail:
      'The basketball was never the problem. You could not clear the classroom bar, the offers evaporated, and nobody was left holding a scholarship for you.',
    score: 18,
  },
  'career-ending-injury': {
    reason: 'Career-ending injury',
    detail: 'The run just stops. No build-up, no warning, no second act.',
    score: 15,
  },
  'rec-league': {
    reason: 'Rec league',
    detail:
      'Nobody offered. You can still hoop — rec leagues, open gyms, the occasional tournament where somebody says you should have played college ball.',
    score: 10,
  },
  'off-court-flameout': {
    reason: 'Off-court flameout',
    detail: 'The talent was never in question. Everything around it was.',
    score: 6,
  },
};

export function endingCopy(id: EndingId): EndingCopy {
  return ENDING_COPY[id];
}

export function endingScore(id: EndingId): number {
  return ENDING_COPY[id].score;
}

/** The pro tiers, so callers can ask "did this career reach the league?" */
export const PRO_ENDINGS: readonly EndingId[] = [
  'two-way-shuttle',
  'role-player',
  'role-player-with-ring',
  'starter',
  'all-star',
  'superstar',
  'hall-of-fame',
];

/**
 * Name the specific decision that produced this outcome.
 *
 * This is the part SPEC §15 actually asks for. It reads the run rather than
 * picking a canned line — the GPA you finished with, the school you picked at
 * thirteen, the choice that set a flag, the year you declared.
 */
function pivotalDecision(state: GameState, endingId: EndingId): string {
  const { academics, hype, school, college, draft, pro } = state;

  switch (endingId) {
    case 'academic-washout':
      return (
        `You finished high school with a ${academics.gpa.toFixed(2)} GPA and ` +
        `${academics.coreCredits} of ${ACADEMICS.CORE_CREDITS_REQUIRED} core credits. ` +
        `Every month you chose the gym over the classroom was a month this was ` +
        `getting closer.`
      );

    case 'rec-league':
      return (
        `You finished high school ranked #${hype.nationalRank} with ` +
        `${Math.round(hype.hype)} hype. Choosing ${school.name} at thirteen meant ` +
        `the basketball was real and the audience was not.`
      );

    case 'off-court-flameout':
      return (
        `Off-court character bottomed out at ${Math.round(state.reputation.offCourt)}. ` +
        `It was never one decision — it was the eighth one.`
      );

    case 'career-ending-injury':
      return 'One landing. Nothing you chose, and nothing you could have chosen differently.';

    case 'juco-dead-end': {
      if (academics.status === 'non-qualifier') {
        return (
          `A ${academics.gpa.toFixed(2)} GPA closed every four-year door out of high ` +
          `school. JUCO was not a choice you made — it was the one that was left, and ` +
          `nobody came back for you.`
        );
      }
      return 'You took the junior college road and it did not convert into anything else.';
    }

    case 'college-washout': {
      const program = college ? programById(college.programId) : null;
      const transfers = college?.transfers ?? 0;
      return (
        `You used up your eligibility at ${program?.name ?? 'college'}` +
        (transfers > 0
          ? ` after ${transfers} transfer${transfers === 1 ? '' : 's'}`
          : '') +
        `, and the draft never came calling.`
      );
    }

    case 'overseas-journeyman':
      return (
        `You went overseas at eighteen instead of taking the college route. The ` +
        `money was real and the exposure never was.`
      );

    case 'undrafted-grinder':
      return draft?.declared
        ? `You declared for the ${draft.year} draft projected around #${draft.projection}, and all sixty picks went by.`
        : 'You never got a draft call, and kept playing anyway.';

    default: {
      // Every remaining ending is a pro career.
      const seasons = pro?.seasons ?? 0;
      const rings = pro?.championships ?? 0;
      const pickText =
        draft && draft.pick > 0
          ? `Drafted #${draft.pick} overall`
          : 'Undrafted, and in the league anyway';

      const ringText =
        rings > 0
          ? ` You finished with ${rings} championship${rings === 1 ? '' : 's'}.`
          : ' You never won one.';

      return `${pickText}. ${seasons} seasons in the league.${ringText}`;
    }
  }
}

/**
 * Which pro ending a career earned.
 *
 * Deliberately not a pure "how good were you" ladder — a ring as a role player
 * outranks a longer career without one, because SPEC §15 asks for exactly that.
 */
export function resolveProEnding(state: GameState): EndingId {
  const pro = state.pro;
  if (!pro) return 'undrafted-grinder';

  const { seasons, championships, allStars } = pro;
  const mvps = pro.awards.filter((a) => a.name === 'MVP').length;

  if (allStars >= 8 && championships >= 1 && seasons >= 12) return 'hall-of-fame';
  if (mvps >= 1 || allStars >= 6) return 'superstar';
  if (allStars >= 2) return 'all-star';
  // The win state: a long career, a real role, and a ring.
  if (championships >= 1 && seasons >= 8) return 'role-player-with-ring';
  if (seasons >= 9 && (pro.role === 'starter' || pro.role === 'star')) return 'starter';
  if (seasons >= 4) return 'role-player';
  if (seasons >= 1) return 'two-way-shuttle';
  return 'undrafted-grinder';
}

export function buildEnding(state: GameState, endingId: EndingId): CareerEnd {
  const copy = ENDING_COPY[endingId];
  return {
    endingId,
    reason: copy.reason,
    detail: copy.detail,
    decision: pivotalDecision(state, endingId),
    monthsElapsed: state.monthsElapsed,
  };
}

/**
 * The ending for a career that has run out of road at its current stage.
 * Called when a stage closes with nowhere left to go.
 */
export function resolveEnding(state: GameState): CareerEnd {
  if (state.careerEnd) return state.careerEnd;

  let endingId: EndingId;

  switch (state.stage) {
    case 'nba':
    case 'retired':
      endingId = resolveProEnding(state);
      break;

    case 'overseas':
      endingId = 'overseas-journeyman';
      break;

    case 'developmental':
      endingId = 'undrafted-grinder';
      break;

    case 'college':
      endingId = 'college-washout';
      break;

    case 'juco':
      endingId = 'juco-dead-end';
      break;

    default: {
      // Still in high school with nowhere to go.
      if (state.academics.status === 'non-qualifier' && activeOffers(state.recruiting).length === 0) {
        endingId = 'academic-washout';
      } else {
        endingId = 'rec-league';
      }
    }
  }

  return buildEnding(state, endingId);
}

/** Human label for the program signed with, used on the ending screen. */
export function signedWith(state: GameState): string | null {
  const id = state.college?.programId ?? state.recruiting.commitment?.programId;
  if (!id) return null;
  const program = programById(id);
  if (!program) return null;
  return `${program.name} (${TIER_LABEL[program.tier]})`;
}

export { bestOffer };
