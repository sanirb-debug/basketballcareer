import type { GameEvent } from './types';

/**
 * The second half of the event catalog (SPEC §12).
 *
 * Split from `catalog.ts` purely so neither file becomes unreadable. These
 * lean on the stages the first batch never saw — middle school, college, the
 * league — plus a wider spread of ordinary life, so the months keep their
 * texture long after high school ends.
 */

export const EVENTS_2: readonly GameEvent[] = [
  // ======================================================================
  // MIDDLE SCHOOL — the 8th grade year
  // ======================================================================
  {
    id: 'ms-first-cut',
    category: 'teammates',
    title: 'Tryouts',
    prompt:
      'Middle school tryouts. There are forty kids in the gym for twelve spots, and you have never been cut from anything.',
    weight: 14,
    once: true,
    conditions: { maxGrade: 8 },
    choices: [
      {
        label: 'Play the way you always have',
        effects: {
          attributes: { composure: 1.2 },
          onCourt: 4,
          outcome: 'You played your game and made it comfortably.',
        },
      },
      {
        label: 'Try to do too much',
        effects: {
          attributes: { offDribble3: 0.8, basketballIQ: -0.5 },
          onCourt: -2,
          outcome: 'You forced it for two days. You made the team anyway, barely.',
        },
      },
    ],
  },
  {
    id: 'ms-growth-spurt-clothes',
    category: 'family',
    title: 'Nothing fits',
    prompt:
      'You have gone up two shoe sizes in a year and none of your clothes fit. Your mother says it like a complaint and means it like a brag.',
    weight: 8,
    conditions: { maxGrade: 10 },
    choices: [
      {
        label: 'Ask for new gear',
        effects: {
          money: -180,
          relationships: { parents: -3 },
          attributes: { speed: 0.4 },
          outcome: 'New shoes that actually fit. Your feet stopped aching.',
        },
      },
      {
        label: 'Make it work',
        effects: {
          attributes: { durability: -0.8 },
          relationships: { parents: 6 },
          outcome: 'You squeezed another season out of shoes a size too small.',
        },
      },
    ],
  },
  {
    id: 'ms-varsity-callup',
    category: 'coaches',
    title: 'The high school coach came to watch',
    prompt:
      'The varsity coach from the school you are headed to stood in the doorway for the whole second half.',
    weight: 12,
    once: true,
    conditions: { maxGrade: 9 },
    choices: [
      {
        label: 'Introduce yourself afterwards',
        effects: {
          coachTrust: 8,
          relationships: { hsCoach: 10 },
          hype: 3,
          outcome: 'You walked over and shook his hand. He remembered.',
        },
      },
      {
        label: 'Let the tape talk',
        effects: {
          onCourt: 4,
          attributes: { composure: 0.8 },
          outcome: 'You did not say a word to him. He noticed that too.',
        },
      },
    ],
  },
  {
    id: 'ms-summer-league',
    category: 'social',
    title: 'The park in July',
    prompt:
      'There is a run at the park every evening with grown men in it. They will not go easy on a thirteen-year-old.',
    weight: 9,
    conditions: { maxGrade: 9, months: [5, 6, 7] },
    choices: [
      {
        label: 'Go every night and get knocked around',
        effects: {
          attributes: { strength: 1.2, composure: 1.4, finishing: 0.8 },
          energy: -12,
          outcome: 'You got bullied for three weeks and stopped flinching in the fourth.',
        },
      },
      {
        label: 'Stick to your own age group',
        effects: {
          attributes: { catchAndShoot3: 0.6 },
          confidence: 3,
          outcome: 'You dominated kids your own size all summer.',
        },
      },
    ],
  },

  // ======================================================================
  // COLLEGE
  // ======================================================================
  {
    id: 'col-first-practice',
    category: 'teammates',
    title: 'The speed of it',
    prompt:
      'First college practice. Everyone is older, stronger, and faster than anyone you played against in high school, and it is not close.',
    weight: 16,
    once: true,
    conditions: { minGrade: 13 },
    choices: [
      {
        label: 'Ask the seniors what you are missing',
        effects: {
          attributes: { basketballIQ: 2, coachability: 1.5 },
          coachTrust: 6,
          outcome: 'You asked. Two of them stayed after and showed you.',
        },
      },
      {
        label: 'Try to prove you belong immediately',
        effects: {
          attributes: { motor: 1.6 },
          energy: -14,
          coachTrust: 3,
          outcome: 'You went at everyone for a week. Some of it worked.',
        },
      },
      {
        label: 'Go quiet',
        effects: {
          confidence: -8,
          coachTrust: -4,
          outcome: 'You went quiet for a month. It showed.',
        },
      },
    ],
  },
  {
    id: 'col-nil-offer',
    category: 'money',
    title: 'A local dealership wants your face',
    prompt:
      'A car dealership near campus wants you in their adverts. Real money for a college student, and an afternoon a week.',
    weight: 10,
    conditions: { minGrade: 13 },
    choices: [
      {
        label: 'Sign it',
        effects: {
          money: 2400,
          hype: 4,
          energy: -5,
          outcome: 'Your face is on a billboard on the highway now.',
        },
      },
      {
        label: 'Pass — you want the time',
        effects: {
          attributes: { catchAndShoot3: 0.8, finishing: 0.6 },
          outcome: 'You turned it down and spent the afternoons in the gym.',
        },
      },
    ],
  },
  {
    id: 'col-homesick',
    category: 'family',
    title: 'A long way from home',
    prompt:
      'It is November, you have not been home since August, and the campus empties out for a week at Thanksgiving.',
    weight: 9,
    conditions: { minGrade: 13, months: [10] },
    choices: [
      {
        label: 'Fly home',
        effects: {
          money: -350,
          relationships: { parents: 14 },
          confidence: 8,
          energy: 6,
          outcome: 'You went home for four days and came back lighter.',
        },
      },
      {
        label: 'Stay and get in the gym',
        effects: {
          attributes: { midRange: 1, freeThrow: 0.8 },
          relationships: { parents: -6 },
          confidence: -4,
          outcome: 'You had the gym to yourself for a week. It was very quiet.',
        },
      },
    ],
  },
  {
    id: 'col-benched-for-portal-kid',
    category: 'coaches',
    title: 'They brought in a transfer',
    prompt:
      'The staff signed a 23-year-old out of the portal who plays your position and has started 90 college games.',
    weight: 12,
    conditions: { minGrade: 13 },
    choices: [
      {
        label: 'Out-work him',
        effects: {
          attributes: { motor: 1.8, perimeterDefense: 0.8 },
          energy: -12,
          coachTrust: 5,
          outcome: 'You made every practice a fight. The staff took notice.',
        },
      },
      {
        label: 'Ask the staff where you stand',
        effects: {
          coachTrust: 4,
          attributes: { composure: 1 },
          outcome: 'You got a straight answer. It was not the one you wanted.',
        },
      },
      {
        label: 'Look at the portal yourself',
        effects: {
          coachTrust: -10,
          setFlags: ['eyeing_portal'],
          outcome: 'You started taking calls. Word travels fast in a locker room.',
        },
      },
    ],
  },
  {
    id: 'col-march-moment',
    category: 'viral',
    title: 'March',
    prompt:
      'A one-possession game in March, on national television, and the ball finds you at the elbow with the clock under ten.',
    weight: 14,
    conditions: { minGrade: 13, months: [2] },
    choices: [
      {
        label: 'Take it',
        effects: {
          hype: 16,
          confidence: 10,
          onCourt: 8,
          attributes: { composure: 2 },
          outcome: 'You took it. Whatever happened next, you were the one who took it.',
        },
      },
      {
        label: 'Swing it to the open man',
        effects: {
          onCourt: 6,
          attributes: { passingVision: 1.5, basketballIQ: 1.5 },
          hype: 4,
          relationships: { friends: 8 },
          outcome: 'You made the right pass. The right pass is not always the story.',
        },
      },
    ],
  },
  {
    id: 'col-degree',
    category: 'school',
    title: 'You are close to finishing',
    prompt:
      'You are two semesters from a degree. Nobody in your family has one.',
    weight: 10,
    conditions: { minGrade: 15 },
    choices: [
      {
        label: 'Finish it',
        effects: {
          gpa: 0.2,
          relationships: { parents: 18 },
          offCourt: 10,
          energy: -8,
          setFlags: ['has_degree'],
          outcome: 'You finished the degree. Your mother cried at the ceremony.',
        },
      },
      {
        label: 'Basketball comes first',
        effects: {
          attributes: { finishing: 1, catchAndShoot3: 1 },
          relationships: { parents: -8 },
          outcome: 'You put the degree on hold and went back to the gym.',
        },
      },
    ],
  },

  // ======================================================================
  // THE LEAGUE
  // ======================================================================
  {
    id: 'pro-first-game',
    category: 'media',
    title: 'Your first one',
    prompt:
      'Your first professional game. Somebody in your family is in the building who has never been on a plane before.',
    weight: 18,
    once: true,
    conditions: { minAge: 18, requireFlags: ['in_the_league'] },
    choices: [
      {
        label: 'Find them in the stands before tip',
        effects: {
          confidence: 12,
          relationships: { parents: 16 },
          outcome: 'You found them in the stands and pointed. You will keep that one.',
        },
      },
      {
        label: 'Stay locked in',
        effects: {
          attributes: { composure: 2 },
          onCourt: 4,
          outcome: 'You did not look up once. You played well.',
        },
      },
    ],
  },
  {
    id: 'pro-veteran-mentor',
    category: 'teammates',
    title: 'The 34-year-old at the end of the bench',
    prompt:
      'A veteran on his last contract has started sitting next to you on flights and telling you things nobody else will.',
    weight: 12,
    conditions: { requireFlags: ['in_the_league'] },
    choices: [
      {
        label: 'Listen to all of it',
        effects: {
          attributes: { basketballIQ: 2.4, composure: 1.5, coachability: 1 },
          onCourt: 5,
          outcome: 'You listened to every word. Half of it you only understood years later.',
        },
      },
      {
        label: 'You have your own way',
        effects: {
          confidence: 4,
          attributes: { basketballIQ: -0.5 },
          outcome: 'You nodded along and did it your way.',
        },
      },
    ],
  },
  {
    id: 'pro-shoe-deal',
    category: 'money',
    title: 'A shoe company called',
    prompt:
      'A brand wants to sign you. Not a headline deal, but real money and a signature colourway if things go well.',
    weight: 11,
    conditions: { requireFlags: ['in_the_league'], minOnCourt: 55 },
    choices: [
      {
        label: 'Sign with the big brand',
        effects: {
          money: 900000,
          hype: 10,
          outcome: 'You signed. There are boxes of shoes in your hallway now.',
        },
      },
      {
        label: 'Sign with the smaller one for more control',
        effects: {
          money: 400000,
          offCourt: 8,
          hype: 4,
          outcome: 'You took less money from a smaller brand and got a say in the design.',
        },
      },
    ],
  },
  {
    id: 'pro-trade-deadline',
    category: 'media',
    title: 'Your name is in a rumour',
    prompt:
      'Two days before the deadline, a national reporter lists you in a package for a star. Your phone will not stop.',
    weight: 13,
    conditions: { requireFlags: ['in_the_league'] },
    choices: [
      {
        label: 'Say nothing and play',
        effects: {
          attributes: { composure: 2.2 },
          onCourt: 5,
          outcome: 'You played through it without a word. The deadline passed.',
        },
      },
      {
        label: 'Ask the front office directly',
        effects: {
          confidence: 5,
          onCourt: -2,
          outcome: 'You asked. They told you what front offices always tell you.',
        },
      },
      {
        label: 'Post a cryptic story',
        effects: {
          hype: 6,
          offCourt: -9,
          outcome: 'You posted something vague. It was a screenshot within four minutes.',
        },
      },
    ],
  },
  {
    id: 'pro-injury-crossroads',
    category: 'injury',
    title: 'The doctor wants to go in',
    prompt:
      'Surgery now costs you most of a season. Rehab without it might hold, and might not, and you are in a contract year.',
    weight: 14,
    conditions: { requireFlags: ['in_the_league'], minAge: 22 },
    choices: [
      {
        label: 'Have the surgery',
        effects: {
          injury: { name: 'post-surgical rehab', severity: 'major', months: 7, cap: 0.72 },
          attributes: { durability: 2.5 },
          outcome: 'You had it done properly and lost most of a year.',
        },
      },
      {
        label: 'Rehab and play through it',
        effects: {
          injury: { name: 'managed knee', severity: 'moderate', months: 2, cap: 0.86 },
          attributes: { durability: -2.5, vertical: -1.5 },
          money: 0,
          outcome: 'You managed it and kept playing. It never quite came all the way back.',
        },
      },
    ],
  },
  {
    id: 'pro-bench-role',
    category: 'character',
    title: 'They want you to come off the bench',
    prompt:
      'The coach wants to bring you off the bench for a younger player. He asks you like it is a question. It is not really a question.',
    weight: 14,
    conditions: { requireFlags: ['in_the_league'], minAge: 27 },
    choices: [
      {
        label: 'Take the role and make it yours',
        effects: {
          coachTrust: 14,
          onCourt: 8,
          attributes: { leadership: 2, coachability: 2 },
          outcome:
            'You took it without a word of complaint and became the best sixth man on the roster.',
        },
      },
      {
        label: 'Fight it',
        effects: {
          coachTrust: -14,
          onCourt: -6,
          confidence: -5,
          outcome: 'You fought it. You lost, and it cost you the room.',
        },
      },
    ],
  },
  {
    id: 'pro-hometown-return',
    category: 'family',
    title: 'Playing back home',
    prompt:
      'The schedule brings you within an hour of where you grew up. Ninety people want tickets.',
    weight: 10,
    conditions: { requireFlags: ['in_the_league'] },
    choices: [
      {
        label: 'Buy out a section',
        effects: {
          money: -18000,
          relationships: { parents: 14, friends: 14 },
          offCourt: 8,
          outcome: 'You bought a whole section. Everyone who ever rebounded for you was there.',
        },
      },
      {
        label: 'Family only',
        effects: {
          relationships: { parents: 8, friends: -8 },
          money: -900,
          outcome: 'You sorted your parents out and left it there.',
        },
      },
    ],
  },
  {
    id: 'pro-young-teammate',
    category: 'teammates',
    title: 'The rookie will not stop asking',
    prompt:
      'A rookie has started copying your routine and asking questions after every practice. You recognise it.',
    weight: 10,
    conditions: { requireFlags: ['in_the_league'], minAge: 26 },
    choices: [
      {
        label: 'Take him under your wing',
        effects: {
          attributes: { leadership: 2.5 },
          onCourt: 6,
          offCourt: 6,
          outcome: 'You gave him everything you had been given. That is how it works.',
        },
      },
      {
        label: 'You have your own problems',
        effects: {
          energy: 5,
          onCourt: -3,
          outcome: 'You kept it professional and nothing more.',
        },
      },
    ],
  },
  {
    id: 'pro-ring-chase',
    category: 'character',
    title: 'Less money, better team',
    prompt:
      'A contender will pay you well under your market value. Two rebuilding teams will pay you what you are worth.',
    weight: 15,
    conditions: { requireFlags: ['in_the_league'], minAge: 27 },
    choices: [
      {
        label: 'Chase the ring',
        effects: {
          money: -2000000,
          onCourt: 6,
          confidence: 6,
          setFlags: ['chasing_a_ring'],
          outcome: 'You took the discount to go somewhere that could win it all.',
        },
      },
      {
        label: 'Take the money',
        effects: {
          money: 9000000,
          onCourt: -3,
          outcome:
            'You took the money. Nobody who has not been offered it gets to judge that.',
        },
      },
    ],
  },
  {
    id: 'pro-last-year',
    category: 'character',
    title: 'You can feel it',
    prompt:
      'Your body takes three days to recover from what used to take one, and the young guys are getting past you on closeouts.',
    weight: 13,
    conditions: { requireFlags: ['in_the_league'], minAge: 33 },
    choices: [
      {
        label: 'Change how you play',
        effects: {
          attributes: { basketballIQ: 2.5, composure: 2, midRange: 1.5 },
          onCourt: 5,
          outcome: 'You stopped trying to be who you were and got smarter instead.',
        },
      },
      {
        label: 'Push your body harder',
        effects: {
          attributes: { stamina: 1 },
          energy: -18,
          outcome: 'You tried to out-train time. Time is undefeated.',
        },
      },
    ],
  },

  // ======================================================================
  // LIFE, WIDER
  // ======================================================================
  {
    id: 'life-younger-kids-camp',
    category: 'character',
    title: 'Somebody asked you to run a camp',
    prompt:
      'A youth coach from your old neighbourhood asks if you will run a session for kids who have nothing else going on this summer.',
    weight: 9,
    conditions: { minAge: 17 },
    choices: [
      {
        label: 'Run it, and run it properly',
        effects: {
          offCourt: 12,
          attributes: { leadership: 2 },
          energy: -8,
          money: -200,
          outcome: 'Sixty kids showed up. You remembered being one of them.',
        },
      },
      {
        label: 'Send gear instead',
        effects: {
          money: -600,
          offCourt: 4,
          outcome: 'You paid for the gear and did not go.',
        },
      },
    ],
  },
  {
    id: 'life-old-injury-friend',
    category: 'social',
    title: 'The one who did not make it',
    prompt:
      'Your best friend from fourteen was better than you until his knee went. He is working nights now and he still comes to your games.',
    weight: 10,
    conditions: { minAge: 18 },
    choices: [
      {
        label: 'Bring him with you',
        effects: {
          relationships: { friends: 20 },
          money: -1200,
          offCourt: 8,
          confidence: 6,
          outcome: 'You put him on your payroll. He is the only person who tells you the truth.',
        },
      },
      {
        label: 'Keep it as it is',
        effects: {
          relationships: { friends: -4 },
          confidence: -3,
          outcome: 'You left things as they were. It got a little more awkward each year.',
        },
      },
    ],
  },
  {
    id: 'life-money-family-ask',
    category: 'money',
    title: 'Everybody needs something',
    prompt:
      'Since the money arrived, eleven different relatives have asked for help. Some of them genuinely need it.',
    weight: 12,
    conditions: { minMoney: 100000 },
    choices: [
      {
        label: 'Help the ones who actually need it',
        effects: {
          money: -60000,
          relationships: { parents: 12 },
          offCourt: 6,
          outcome: 'You helped where it was real and said no where it was not.',
        },
      },
      {
        label: 'Say yes to everyone',
        effects: {
          money: -260000,
          relationships: { parents: 6, friends: 6 },
          offCourt: -3,
          outcome: 'You said yes to all of it. The requests did not slow down.',
        },
      },
      {
        label: 'Shut it down entirely',
        effects: {
          relationships: { parents: -16, friends: -10 },
          offCourt: -5,
          outcome: 'You cut it off completely. Some of those calls never came back.',
        },
      },
    ],
  },
  {
    id: 'life-therapy',
    category: 'character',
    title: 'Somebody suggests you talk to someone',
    prompt:
      'A trainer you trust says, carefully, that you have not seemed like yourself for a while.',
    weight: 10,
    conditions: { minAge: 17 },
    choices: [
      {
        label: 'Go and talk to someone',
        effects: {
          confidence: 14,
          attributes: { composure: 2.5 },
          offCourt: 6,
          outcome: 'You went. It was uncomfortable for a month and then it helped.',
        },
      },
      {
        label: 'Say you are fine',
        effects: {
          confidence: -8,
          outcome: 'You told him you were fine.',
        },
      },
    ],
  },
  {
    id: 'life-marriage',
    category: 'romance',
    title: 'A real conversation about the future',
    prompt:
      'She wants to know whether this is going somewhere, and she is not asking rhetorically.',
    weight: 11,
    conditions: { requireActive: ['girlfriend'], minAge: 22, minRelationship: { girlfriend: 65 } },
    choices: [
      {
        label: 'Commit properly',
        effects: {
          relationships: { girlfriend: 20 },
          confidence: 10,
          setFlags: ['settled_down'],
          outcome: 'You committed. Having one thing that is not basketball turned out to matter.',
        },
      },
      {
        label: 'Say you are not ready',
        effects: {
          relationships: { girlfriend: -18 },
          attributes: { composure: 0.5 },
          outcome: 'You told her the truth. It did not go well, and it was still the truth.',
        },
      },
    ],
  },
  {
    id: 'life-kid',
    category: 'family',
    title: 'You are going to be a father',
    prompt:
      'Everything you thought your schedule was for just rearranged itself.',
    weight: 10,
    once: true,
    conditions: { requireFlags: ['settled_down'], minAge: 23 },
    choices: [
      {
        label: 'Be there for all of it',
        effects: {
          relationships: { girlfriend: 16, parents: 10 },
          energy: -10,
          confidence: 12,
          offCourt: 10,
          setFlags: ['has_kid'],
          outcome: 'You were in the room. Nothing on a basketball court has felt that big.',
        },
      },
      {
        label: 'Keep the season first',
        effects: {
          relationships: { girlfriend: -14 },
          attributes: { motor: 1 },
          setFlags: ['has_kid'],
          outcome: 'You played the road trip. You will hear about that one for years.',
        },
      },
    ],
  },
  {
    id: 'life-kid-watching',
    category: 'family',
    title: 'Somebody small is watching',
    prompt:
      'Your kid is old enough now to understand what you do, and repeats everything you say in the car after games.',
    weight: 9,
    conditions: { requireFlags: ['has_kid'], minAge: 27 },
    choices: [
      {
        label: 'Be someone worth copying',
        effects: {
          offCourt: 12,
          attributes: { composure: 1.8, leadership: 1.5 },
          outcome: 'You started watching your own mouth. It made you better at the job too.',
        },
      },
      {
        label: 'Nothing changes',
        effects: {
          offCourt: -4,
          outcome: 'You carried on exactly as before.',
        },
      },
    ],
  },
  {
    id: 'life-agent-change',
    category: 'money',
    title: 'Your agent missed something',
    prompt:
      'A clause your agent did not flag has cost you real money. He is apologetic and he is also your cousin’s friend.',
    weight: 9,
    conditions: { minMoney: 50000 },
    choices: [
      {
        label: 'Change agents',
        effects: {
          money: -20000,
          offCourt: 3,
          outcome: 'You moved to a bigger agency. It was an awkward phone call.',
        },
      },
      {
        label: 'Stay loyal',
        effects: {
          relationships: { friends: 8 },
          money: -40000,
          outcome: 'You stayed. Loyalty has a price and you paid it.',
        },
      },
    ],
  },
  {
    id: 'life-media-training',
    category: 'media',
    title: 'They want to media-train you',
    prompt:
      'The team has booked you sessions on how to talk to reporters without saying anything.',
    weight: 8,
    conditions: { requireFlags: ['in_the_league'] },
    choices: [
      {
        label: 'Take it seriously',
        effects: {
          offCourt: 8,
          attributes: { composure: 1.2 },
          outcome: 'You learned how to say nothing pleasantly. It is a real skill.',
        },
      },
      {
        label: 'Keep saying what you think',
        effects: {
          hype: 6,
          offCourt: -6,
          onCourt: 3,
          outcome: 'You kept answering honestly. It made you quotable and occasionally radioactive.',
        },
      },
    ],
  },
  {
    id: 'life-charity',
    category: 'character',
    title: 'What do you want your name on?',
    prompt:
      'You have enough money now that people are asking what you want to build.',
    weight: 9,
    conditions: { minMoney: 400000 },
    choices: [
      {
        label: 'Fund the gym you grew up in',
        effects: {
          money: -250000,
          offCourt: 16,
          relationships: { parents: 10 },
          outcome: 'You rebuilt the gym you learned in. Your name is over the door.',
        },
      },
      {
        label: 'Invest it instead',
        effects: {
          money: 180000,
          offCourt: -2,
          outcome: 'You put it to work. Sensible, and nobody wrote a story about it.',
        },
      },
    ],
  },
];
