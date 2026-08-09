import { createRng, seedToState } from './rng';
import { countryById, isUSA } from './countries';
import { isMiddleSchool } from './school';
import { gradeForClock } from './season';
import type { GameState } from './types';

/**
 * The rest of the life (SPEC §17).
 *
 * A month that reports only "I grew 0.2 inches" is a month nobody wants to
 * read, and across 264 of them that is the whole game. These are the small
 * true things that happen around the basketball — the bus, the gym floor, a
 * brother, a knee that clicks — and they are what turns the feed from a
 * changelog into a life.
 *
 * Two deliberate constraints:
 *
 * 1. **No mechanical effect, ever.** Everything here is flavour. The moment a
 *    texture line moves a number it becomes an event, and events belong in
 *    the catalogue where they can be balanced and tested. Keeping this layer
 *    inert means it can be as dense as it likes without touching balance.
 *
 * 2. **It never touches the main RNG stream.** The generator is derived from
 *    `(seed, monthsElapsed)`, so it is perfectly reproducible without
 *    consuming a draw — which matters because a single extra draw shifts
 *    every downstream roll in the run and would invalidate every balance
 *    bound in the suite.
 */

interface Ctx {
  stage: GameState['stage'];
  month: number;
  ageYears: number;
  inSeason: boolean;
  injured: boolean;
  hasPartner: boolean;
  children: number;
  money: number;
  isUSA: boolean;
  abroad: boolean;
  countryName: string;
  city: string;
  teamName: string;
}

interface Line {
  text: string | ((c: Ctx) => string);
  when?: (c: Ctx) => boolean;
}

const school = (c: Ctx) => c.stage === 'highschool';
const teen = (c: Ctx) => c.ageYears < 19;
const pro = (c: Ctx) => c.stage === 'nba';
const college = (c: Ctx) => c.stage === 'college' || c.stage === 'juco';
const paid = (c: Ctx) =>
  c.stage === 'nba' || c.stage === 'overseas' || c.stage === 'developmental';

/**
 * The pool.
 *
 * Written to be specific rather than atmospheric — "the rim at the park bent
 * about four degrees" is a memory, "I worked hard this month" is filler.
 */
const LINES: Line[] = [
  // --- The gym and the game -------------------------------------------
  { text: 'The gym was open at six. I was the only one who knew that.' },
  { text: 'Somebody left the side door propped. I did not tell anyone.' },
  { text: 'The rim at the park is bent about four degrees. I have adjusted.' },
  { text: 'I shot until my hands went numb and then I shot some more.' },
  { text: 'New nets went up. It sounds different. It sounds correct.' },
  { text: 'The floor was sticky the whole month and everybody complained.' },
  { text: 'I lost a game of one-on-one to somebody I should not lose to.' },
  { text: 'I won a game of one-on-one I had no business winning.' },
  { text: 'I found a spot on the left wing where I do not miss.' },
  { text: 'My handle felt like it belonged to someone else all month.' },
  { text: 'Something clicked in my footwork and I still cannot say what.' },
  { text: 'I watched an hour of film on a guy who does what I want to do.' },
  { text: 'I air-balled a free throw in front of people. It happens.' },
  { text: 'I got dunked on. There is footage. I have made my peace with it.' },
  { text: 'I dunked in a live game for the first time and blacked out a bit.' },

  // --- The body ---------------------------------------------------------
  { text: 'My knees clicked going up the stairs. I am fourteen.', when: teen },
  { text: 'My shoes gave out. Third pair this year.', when: teen },
  { text: 'Nothing fits. My mother has stopped buying trousers.', when: teen },
  { text: 'I ate everything in the house and was hungry an hour later.' },
  { text: 'I slept eleven hours and woke up sore anyway.' },
  { text: 'Somebody asked what I am listed at and I did not know.' },
  { text: 'I keep catching myself in windows. I am not used to this yet.', when: teen },

  // --- School -----------------------------------------------------------
  { text: 'A teacher asked what my plan is if this does not work out.', when: school },
  { text: 'I fell asleep in third period. Twice.', when: school },
  { text: 'The chemistry test went badly and I have not mentioned it at home.', when: school },
  { text: 'Somebody in my year got a scholarship for something else entirely.', when: school },
  { text: 'The season means I have eaten dinner in a car for a month.', when: (c) => school(c) && c.inSeason },
  { text: 'I have a group project and I am the reason it is late.', when: school },

  // --- The team ---------------------------------------------------------
  { text: (c) => `The bus to away games at ${c.teamName} smells like feet and nobody talks about it.`, when: (c) => c.inSeason },
  { text: 'A teammate started calling me a nickname. It has stuck.' },
  { text: 'Two of the seniors are not speaking. Practice has been quiet.', when: school },
  { text: 'The coach ran us until somebody was sick. Nobody argued.' },
  { text: 'I got yelled at in front of everyone and he was right.' },
  { text: 'A walk-on outworked all of us for a week and made his point.', when: college },
  { text: 'Somebody put a speaker in the weight room. It is better now.' },
  { text: 'We lost one we should have won and the locker room was silent.', when: (c) => c.inSeason },
  { text: 'We won one we had no business winning and I could not sleep.', when: (c) => c.inSeason },
  { text: 'Team dinner ran three hours. Nobody wanted to leave.' },

  // --- Home -------------------------------------------------------------
  { text: 'My mother came to a game and left before it finished. Work.', when: teen },
  { text: 'My brother has started beating me at things. Not this, yet.' },
  { text: 'The house was full of people all weekend and I liked it.' },
  { text: 'I did the dishes for a month without being asked. Nobody noticed.', when: teen },
  { text: 'Somebody from the neighbourhood asked me to sign something. I laughed.' },
  { text: 'I heard my father tell somebody about me when he thought I was out.', when: teen },
  { text: 'The car did not start for four days and nobody said anything about it.', when: (c) => c.money < 3000 },

  // --- Money ------------------------------------------------------------
  { text: 'I checked my account balance three times, as if it would change.', when: (c) => c.money < 500 },
  { text: 'I bought lunch for the whole table because I could.', when: (c) => c.money > 200_000 },
  { text: 'Somebody I have not spoken to since school found my number.', when: paid },
  { text: 'An agent I did not hire sent me a very confident email.', when: paid },
  { text: 'I looked at the number in my account and felt nothing at all.', when: (c) => c.money > 5_000_000 },

  // --- Being watched ----------------------------------------------------
  { text: 'There was a man with a clipboard at the back. Nobody knew whose he was.', when: (c) => !pro(c) },
  { text: 'Somebody filmed the whole warm-up on their phone.' },
  { text: 'My name came up on a podcast I do not listen to.', when: paid },
  { text: 'A kid at the gym said he was going to be me. I did not know what to say.', when: paid },
  { text: 'A local paper ran forty words about me. My grandmother has the clipping.', when: (c) => !pro(c) },

  // --- Pro life ---------------------------------------------------------
  { text: 'Four cities in six days. I could not describe a single one of them.', when: pro },
  { text: 'The hotel gym was two treadmills and a bike. I made it work.', when: paid },
  { text: 'I signed for ninety minutes after a loss and smiled for all of it.', when: pro },
  { text: 'Somebody asked me about a play from 2029 like it was yesterday.', when: pro },
  { text: 'I got traded a rumour about myself from a group chat.', when: pro },
  { text: 'The plane sat on the tarmac for three hours. Nobody was surprised.', when: pro },
  { text: 'A veteran told me something about my footwork that changed everything.', when: paid },
  { text: 'I am the veteran now. Somebody asked me a question and meant it.', when: (c) => pro(c) && c.ageYears > 28 },

  // --- Country and home ------------------------------------------------
  {
    text: (c) => `A newspaper in ${c.countryName} ran my name for the first time.`,
    when: (c) => !c.isUSA && !pro(c),
  },
  {
    text: (c) => `Somebody back in ${c.city} set up a livestream so people could watch.`,
    when: (c) => !c.isUSA,
  },
  {
    text: 'I explained where I am from four times this month and spelled it twice.',
    when: (c) => !c.isUSA,
  },
  {
    text: 'The time difference means my mother watches me at four in the morning.',
    when: (c) => c.abroad || (!c.isUSA && (pro(c) || college(c))),
  },
  {
    text: 'I have not spoken my own language out loud in three weeks.',
    when: (c) => c.abroad,
  },
  {
    text: (c) => `A kid from ${c.countryName} messaged me asking how I did it. I have no idea what to tell him.`,
    when: (c) => !c.isUSA && paid(c),
  },

  // --- Injured ----------------------------------------------------------
  { text: 'I watched practice from a chair. It is worse than playing.', when: (c) => c.injured },
  { text: 'Rehab is forty minutes of the most boring work there is.', when: (c) => c.injured },
  { text: 'Somebody took my minutes and looked good doing it.', when: (c) => c.injured },

  // --- The people -------------------------------------------------------
  { text: 'We argued about nothing for two days and then it was fine.', when: (c) => c.hasPartner },
  { text: 'She came to a game and I played badly. She said I did not.', when: (c) => c.hasPartner },
  { text: 'We did not talk about basketball once all weekend.', when: (c) => c.hasPartner },
  { text: 'The baby slept through the night. I did not.', when: (c) => c.children > 0 },
  { text: 'I missed a bedtime for a road game and heard about it.', when: (c) => c.children > 0 },
  { text: 'My daughter picked up a ball and immediately threw it at a wall.', when: (c) => c.children > 0 },

  // --- Seasonal ---------------------------------------------------------
  { text: 'It got dark at four every day and the gym became the whole world.', when: (c) => c.month === 11 || c.month === 0 },
  { text: 'It was too hot to be outside so we played inside for a month.', when: (c) => c.month >= 5 && c.month <= 7 },
  { text: 'Everybody else went on holiday. I did not.', when: (c) => c.month >= 5 && c.month <= 7 },
  { text: 'New year. Same gym, same hour, same shots.', when: (c) => c.month === 0 },
];

/** How many months back a line is blocked from repeating. */
const NO_REPEAT_MONTHS = 40;

function contextFor(state: GameState, inSeason: boolean): Ctx {
  const country = countryById(state.origin.country);
  const inMiddleSchool =
    state.stage === 'highschool' && isMiddleSchool(gradeForClock(state.clock));

  return {
    stage: state.stage,
    month: state.clock.month,
    ageYears: 13 + state.monthsElapsed / 12,
    inSeason,
    injured: state.condition.injury !== null,
    hasPartner: state.people.some((p) => p.active && p.role === 'partner'),
    children: state.people.filter((p) => p.role === 'child' && p.alive).length,
    money: state.money,
    isUSA: isUSA(state.origin.country),
    // Choosing the abroad school in 8th grade does not put you on a plane
    // until high school actually starts, so the homesick lines have to wait
    // for the move rather than firing while the player is still at home.
    abroad:
      !isUSA(state.origin.country) &&
      ((state.school.tier === 'prep' && !inMiddleSchool) ||
        (state.stage !== 'highschool' && state.stage !== 'retired')),
    countryName: country.name,
    city: state.origin.homeCity || country.name,
    // The team you actually play for right now, which in 8th grade is the
    // middle school rather than the high school you are headed to.
    teamName: inMiddleSchool ? state.school.middleSchoolName : state.school.name,
  };
}

/**
 * Nought to two lines for this month.
 *
 * Frequency is deliberately below one per month on average: texture that
 * shows up every single tick stops reading as texture and starts reading as
 * noise, and the months where nothing is said are what make the months where
 * something happens land.
 */
export function textureFor(state: GameState, inSeason: boolean): string[] {
  const rng = createRng(
    seedToState((state.seed ^ (state.monthsElapsed * 0x9e3779b1)) >>> 0),
  );

  const ctx = contextFor(state, inSeason);
  const eligible = LINES.filter((l) => !l.when || l.when(ctx));
  if (eligible.length === 0) return [];

  // Anything said recently is off the table, so the feed does not loop.
  const recent = new Set(
    state.log
      .slice(-NO_REPEAT_MONTHS * 3)
      .map((entry) => entry.text),
  );

  const resolve = (line: Line) =>
    typeof line.text === 'function' ? line.text(ctx) : line.text;

  const fresh = eligible.filter((l) => !recent.has(resolve(l)));
  if (fresh.length === 0) return [];

  // 55% one line, 12% two, 33% nothing at all.
  const roll = rng.next();
  const count = roll < 0.33 ? 0 : roll < 0.88 ? 1 : 2;
  if (count === 0) return [];

  const picked: string[] = [];
  const pool = [...fresh];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(rng.next() * pool.length);
    picked.push(resolve(pool[index]));
    pool.splice(index, 1);
  }

  return picked;
}

/** Exposed for verification: every line the pool can ever produce. */
export const TEXTURE_LINE_COUNT = LINES.length;

/**
 * Every line the pool can produce, resolved against a spread of contexts.
 *
 * Exists for the verification that texture copy is already first person and
 * survives `toFirstPerson` unchanged. Texture is authored in the player's own
 * voice while the engine and the event catalogue are written in second
 * person, so a generic "you" here — "I could not tell you what" — comes out
 * the far side as "I could not tell me what".
 */
export function allTextureLines(): string[] {
  const contexts: Ctx[] = [];
  for (const stage of ['highschool', 'college', 'juco', 'nba', 'overseas'] as const) {
    for (const money of [100, 500_000, 9_000_000]) {
      for (const injured of [false, true]) {
        for (const isUS of [true, false]) {
          contexts.push({
            stage,
            month: 0,
            ageYears: 17,
            inSeason: true,
            injured,
            hasPartner: true,
            children: 1,
            money,
            isUSA: isUS,
            abroad: !isUS,
            countryName: 'Nepal',
            city: 'Kathmandu',
            teamName: 'Gary Lincoln High',
          });
        }
      }
    }
  }

  const out = new Set<string>();
  for (const ctx of contexts) {
    for (const line of LINES) {
      if (line.when && !line.when(ctx)) continue;
      out.add(typeof line.text === 'function' ? line.text(ctx) : line.text);
    }
  }
  return [...out];
}
