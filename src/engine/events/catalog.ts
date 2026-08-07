import type { GameEvent } from './types';

/**
 * The event catalog (SPEC §12) — target 80–120 for the high school slice.
 *
 * Every entry is data. Conditions decide when it can fire, weight decides how
 * often, and choices carry the consequences. Several chain: a choice sets a
 * flag, and a later event requires or forbids it.
 */

export const EVENTS: readonly GameEvent[] = [
  // ======================================================================
  // FAMILY
  // ======================================================================
  {
    id: 'fam-dad-drills',
    category: 'family',
    title: 'The driveway',
    prompt:
      'Your dad wants to run the same footwork drills he ran at 15. They are dated, they are boring, and he is watching you from the kitchen window every night.',
    weight: 8,
    conditions: { maxAge: 16 },
    choices: [
      {
        label: 'Run them anyway',
        detail: 'It matters to him.',
        effects: {
          attributes: { agility: 0.8, coachability: 1.2 },
          relationships: { parents: 8 },
          energy: -6,
          outcome: 'You ran your dad’s drills. He did not say much, but he watched every rep.',
        },
      },
      {
        label: 'Tell him the game has changed',
        effects: {
          relationships: { parents: -10 },
          attributes: { composure: 0.5 },
          outcome: 'You told him the game has moved on. He went quiet and went inside.',
        },
      },
    ],
  },
  {
    id: 'fam-move-cities',
    category: 'family',
    title: 'A job in another city',
    prompt:
      'Your family has an opportunity two states away. Better money, worse basketball. Nobody is going to make you decide, but they are all looking at you.',
    weight: 5,
    once: true,
    conditions: { minAge: 14, maxAge: 16 },
    choices: [
      {
        label: 'Say you want to stay',
        effects: {
          relationships: { parents: -6 },
          money: -400,
          setFlags: ['stayed_put'],
          outcome: 'You asked to stay. Your parents made it work, and you know what it cost them.',
        },
      },
      {
        label: 'Tell them to take it',
        effects: {
          money: 2200,
          hype: -6,
          relationships: { parents: 12, friends: -14 },
          setFlags: ['family_moved'],
          outcome: 'You told them to take the job. New gym, new faces, more money at home.',
        },
      },
    ],
  },
  {
    id: 'fam-younger-sibling',
    category: 'family',
    title: 'Your little brother',
    prompt:
      'Your younger brother has started copying everything you do, including skipping homework and mouthing off to coaches.',
    weight: 6,
    conditions: { minAge: 15 },
    choices: [
      {
        label: 'Sit him down',
        effects: {
          attributes: { leadership: 1.6 },
          relationships: { parents: 7 },
          outcome: 'You had a talk with your brother. Felt strange being the one giving it.',
        },
      },
      {
        label: 'Let him figure it out',
        effects: {
          energy: 4,
          relationships: { parents: -5 },
          outcome: 'You let him figure it out himself. He is still figuring.',
        },
      },
    ],
  },
  {
    id: 'fam-parent-shouting',
    category: 'family',
    title: 'The loudest voice in the gym',
    prompt:
      'Your parent has been screaming at referees all season. Two other families have complained. Your coach mentioned it to you, not to them.',
    weight: 7,
    conditions: { minGrade: 9 },
    choices: [
      {
        label: 'Ask them to stop',
        effects: {
          relationships: { parents: -8, hsCoach: 8 },
          coachTrust: 4,
          offCourt: 3,
          outcome: 'You asked them to tone it down. The next game was almost silent.',
        },
      },
      {
        label: 'Say nothing',
        effects: {
          coachTrust: -3,
          offCourt: -2,
          outcome: 'You said nothing. It got louder.',
        },
      },
      {
        label: 'Tell coach to handle it himself',
        effects: {
          coachTrust: -8,
          relationships: { hsCoach: -12 },
          attributes: { coachability: -1 },
          outcome: 'You told the coach it was his problem. He disagreed.',
        },
      },
    ],
  },
  {
    id: 'fam-single-parent-shift',
    category: 'family',
    title: 'Someone has to be home',
    prompt:
      'Your mom picked up a night shift. Somebody has to be home with your siblings, and practice runs late.',
    weight: 9,
    conditions: { familyStructure: ['single-parent'], minAge: 14 },
    choices: [
      {
        label: 'Skip practice, be home',
        effects: {
          coachTrust: -7,
          relationships: { parents: 12 },
          offCourt: 4,
          outcome: 'You went home. Coach noticed you were not at practice.',
        },
      },
      {
        label: 'Stay at practice',
        effects: {
          coachTrust: 6,
          relationships: { parents: -9 },
          attributes: { motor: 0.6 },
          outcome: 'You stayed. Your mom sorted it out somehow, like always.',
        },
      },
    ],
  },
  {
    id: 'fam-grandparent-ill',
    category: 'family',
    title: 'Hospital visiting hours',
    prompt: 'Your grandmother is in the hospital. Visiting hours clash with the weight room.',
    weight: 5,
    once: true,
    conditions: { minAge: 15 },
    choices: [
      {
        label: 'Go see her every day',
        effects: {
          relationships: { parents: 14 },
          energy: -10,
          offCourt: 5,
          confidence: -4,
          outcome: 'You were there every day. The gym could wait.',
        },
      },
      {
        label: 'Go once, then get back to work',
        effects: {
          relationships: { parents: -4 },
          attributes: { strength: 1 },
          outcome: 'You went once and got back to the gym. It sat with you.',
        },
      },
    ],
  },
  {
    id: 'fam-dad-played',
    category: 'family',
    title: 'He knows what this is',
    prompt:
      'Your father played at a decent level and never made it. Tonight he wants to tell you exactly where he went wrong.',
    weight: 6,
    conditions: { minAge: 15 },
    choices: [
      {
        label: 'Listen properly',
        effects: {
          attributes: { basketballIQ: 2, composure: 1 },
          relationships: { parents: 9 },
          outcome: 'You listened. Some of it was bitter. Most of it was useful.',
        },
      },
      {
        label: 'Change the subject',
        effects: {
          relationships: { parents: -7 },
          energy: 3,
          outcome: 'You changed the subject. He let you.',
        },
      },
    ],
  },
  {
    id: 'fam-pressure-dinner',
    category: 'family',
    title: 'Every dinner is about basketball',
    prompt:
      'Nobody in your house talks about anything else any more. Not school, not your brother, not the weather. Just you and your jumper.',
    weight: 6,
    conditions: { minAge: 15, minHype: 30 },
    choices: [
      {
        label: 'Ask for one night off from it',
        effects: {
          relationships: { parents: 5 },
          confidence: 6,
          energy: 6,
          outcome: 'You asked for one dinner without basketball. You got it, mostly.',
        },
      },
      {
        label: 'Feed it — you like the attention',
        effects: {
          hype: 2,
          confidence: -5,
          relationships: { parents: 3 },
          outcome: 'You leaned into it. The pressure crept up a notch.',
        },
      },
    ],
  },
  {
    id: 'fam-cousin-agent',
    category: 'family',
    title: 'Your cousin has a plan',
    prompt:
      'A cousin you barely know has started calling himself your advisor and giving quotes to a local reporter.',
    weight: 5,
    conditions: { minHype: 45 },
    choices: [
      {
        label: 'Shut it down publicly',
        effects: {
          offCourt: 6,
          relationships: { parents: -5 },
          hype: -3,
          outcome: 'You publicly said he does not speak for you. Family dinner was tense.',
        },
      },
      {
        label: 'Let him run with it',
        effects: {
          hype: 5,
          offCourt: -8,
          setFlags: ['cousin_advisor'],
          outcome: 'You let him talk. Programs started asking who he was.',
        },
      },
    ],
  },
  {
    id: 'fam-cousin-fallout',
    category: 'family',
    title: 'What your cousin said',
    prompt:
      'Your self-appointed advisor told a recruiting site you were "basically committed" somewhere you have never visited. Two staffs have called.',
    weight: 12,
    once: true,
    conditions: { requireFlags: ['cousin_advisor'], minGrade: 11 },
    choices: [
      {
        label: 'Publicly correct it and cut him off',
        effects: {
          offCourt: 8,
          relationships: { parents: -8 },
          clearFlags: ['cousin_advisor'],
          outcome: 'You corrected the record and cut him loose. Staffs appreciated the clarity.',
        },
      },
      {
        label: 'Say nothing and hope it passes',
        effects: {
          offCourt: -10,
          hype: -4,
          outcome: 'You let it sit. Two programs quietly stopped calling.',
        },
      },
    ],
  },

  // ======================================================================
  // SCHOOL
  // ======================================================================
  {
    id: 'sch-failing-test',
    category: 'school',
    title: 'The test you did not study for',
    prompt: 'Chemistry midterm tomorrow. You have not opened the book. Someone offers you last year’s answer key.',
    weight: 9,
    conditions: { minGrade: 9 },
    choices: [
      {
        label: 'Study all night',
        effects: {
          gpa: 0.1,
          energy: -18,
          attributes: { basketballIQ: 0.5 },
          outcome: 'You stayed up and did it properly. Exhausted, but you passed.',
        },
      },
      {
        label: 'Use the answer key',
        effects: {
          gpa: 0.12,
          offCourt: -9,
          setFlags: ['cheated_once'],
          outcome: 'You used the key. Good grade. It sits somewhere in the back of your head.',
        },
      },
      {
        label: 'Take the bad grade',
        effects: {
          gpa: -0.16,
          energy: 4,
          outcome: 'You took the L on the test and got some sleep.',
        },
      },
    ],
  },
  {
    id: 'sch-caught-cheating',
    category: 'school',
    title: 'The vice principal’s office',
    prompt:
      'Someone else got caught with the same answer key. Your name came up. The vice principal is asking you directly.',
    weight: 14,
    once: true,
    conditions: { requireFlags: ['cheated_once'] },
    choices: [
      {
        label: 'Admit it',
        effects: {
          gpa: -0.2,
          offCourt: 4,
          coachTrust: -6,
          clearFlags: ['cheated_once'],
          outcome: 'You admitted it. One-game suspension and a genuinely clean slate.',
        },
      },
      {
        label: 'Deny everything',
        effects: {
          offCourt: -12,
          coachTrust: -3,
          setFlags: ['academic_integrity_flag'],
          outcome: 'You denied it. Nothing was proven, but it is in a file somewhere.',
        },
      },
    ],
  },
  {
    id: 'sch-teacher-advocate',
    category: 'school',
    title: 'The teacher who stayed late',
    prompt:
      'Your English teacher has offered to stay after school twice a week to get you where you need to be for eligibility.',
    weight: 8,
    conditions: { maxGpa: 2.8, minGrade: 10 },
    choices: [
      {
        label: 'Take her up on it',
        effects: {
          gpa: 0.22,
          energy: -8,
          attributes: { coachability: 1 },
          outcome: 'You took the help. Your writing got better and so did your average.',
        },
      },
      {
        label: 'Too busy',
        effects: {
          gpa: -0.06,
          energy: 5,
          outcome: 'You told her you were too busy. She stopped offering.',
        },
      },
    ],
  },
  {
    id: 'sch-guidance-warning',
    category: 'school',
    title: 'A conversation about core courses',
    prompt:
      'Guidance pulled you out of class. On your current path you are short on NCAA core credits, and you have fewer semesters left than you think.',
    weight: 16,
    once: true,
    conditions: { minGrade: 10, maxGpa: 2.6 },
    choices: [
      {
        label: 'Restructure your whole schedule',
        effects: {
          gpa: 0.15,
          energy: -6,
          setFlags: ['took_academics_seriously'],
          outcome: 'You rebuilt your schedule around eligibility. It cost you the easy classes.',
        },
      },
      {
        label: 'Say you will handle it later',
        effects: {
          gpa: -0.08,
          outcome: 'You said you would handle it later. Guidance wrote the date down.',
        },
      },
    ],
  },
  {
    id: 'sch-skip-day',
    category: 'school',
    title: 'Senior skip day',
    prompt: 'Half the class is going to the lake. There is a shootaround at four.',
    weight: 7,
    conditions: { minGrade: 11 },
    choices: [
      {
        label: 'Go to the lake',
        effects: {
          relationships: { friends: 12 },
          coachTrust: -6,
          gpa: -0.05,
          energy: 8,
          outcome: 'You went to the lake. Coach ran the shootaround without you.',
        },
      },
      {
        label: 'Show up to shootaround',
        effects: {
          coachTrust: 7,
          relationships: { friends: -8 },
          attributes: { motor: 0.5 },
          outcome: 'You showed up. Coach mentioned it to the staff.',
        },
      },
    ],
  },
  {
    id: 'sch-tutor-offer',
    category: 'school',
    title: 'A booster offers a tutor',
    prompt:
      'A man who describes himself as "a friend of the program" offers to pay for a private tutor. He is very insistent it is no trouble.',
    weight: 6,
    conditions: { minHype: 40, minGrade: 10 },
    choices: [
      {
        label: 'Accept',
        effects: {
          gpa: 0.24,
          offCourt: -6,
          setFlags: ['booster_contact'],
          outcome: 'You took the tutoring. Your grades improved. So did his interest in you.',
        },
      },
      {
        label: 'Decline politely',
        effects: {
          offCourt: 5,
          outcome: 'You said no thanks. He said the offer stands.',
        },
      },
    ],
  },
  {
    id: 'sch-honor-roll',
    category: 'school',
    title: 'Honor roll assembly',
    prompt: 'You made the honor roll. They want you to stand up at the assembly in front of everyone.',
    weight: 5,
    conditions: { minGpa: 3.4 },
    choices: [
      {
        label: 'Stand up',
        effects: {
          offCourt: 7,
          relationships: { parents: 10 },
          attributes: { composure: 0.6 },
          outcome: 'You stood up in front of the school. Your mother did not stop talking about it.',
        },
      },
      {
        label: 'Stay in your seat',
        effects: {
          confidence: 2,
          outcome: 'You stayed seated. Not your thing.',
        },
      },
    ],
  },
  {
    id: 'sch-transfer-rumor',
    category: 'school',
    title: 'People are asking if you are leaving',
    prompt:
      'A rumour is going around that you are transferring to the prep school two hours away. You have not said a word to anyone.',
    weight: 7,
    conditions: { minGrade: 10, minHype: 35 },
    choices: [
      {
        label: 'Deny it firmly',
        effects: {
          coachTrust: 8,
          relationships: { hsCoach: 10, friends: 5 },
          outcome: 'You told everyone you were staying. The locker room relaxed.',
        },
      },
      {
        label: 'Refuse to comment',
        effects: {
          coachTrust: -9,
          hype: 4,
          outcome: 'You would not comment. Coach heard about that too.',
        },
      },
    ],
  },
  {
    id: 'sch-class-clown',
    category: 'school',
    title: 'Third period',
    prompt: 'You have an audience in third period and a substitute teacher who has lost control.',
    weight: 6,
    choices: [
      {
        label: 'Run the room',
        effects: {
          relationships: { friends: 9 },
          gpa: -0.08,
          offCourt: -4,
          outcome: 'You ran the room. Detention, but the class was yours.',
        },
      },
      {
        label: 'Keep your head down',
        effects: {
          gpa: 0.04,
          attributes: { composure: 0.4 },
          outcome: 'You kept your head down and got the work done.',
        },
      },
    ],
  },
  {
    id: 'sch-college-visit-class',
    category: 'school',
    title: 'Missing a week',
    prompt:
      'Visiting three campuses means missing five days of school in a semester where you are already behind.',
    weight: 8,
    conditions: { minGrade: 11, hasOffer: true },
    choices: [
      {
        label: 'Take the visits',
        effects: {
          gpa: -0.12,
          hype: 4,
          outcome: 'You took all three visits and came back to a stack of make-up work.',
        },
      },
      {
        label: 'Cut it to one visit',
        effects: {
          gpa: 0.02,
          hype: -2,
          outcome: 'You took one visit and stayed in class for the rest.',
        },
      },
    ],
  },

  // ======================================================================
  // TEAMMATES
  // ======================================================================
  {
    id: 'team-senior-minutes',
    category: 'teammates',
    title: 'You are taking his minutes',
    prompt:
      'The senior you are replacing has stopped talking to you. Half the locker room is following his lead.',
    weight: 9,
    conditions: { minGrade: 9, maxGrade: 11 },
    choices: [
      {
        label: 'Talk to him directly',
        effects: {
          attributes: { leadership: 1.8, composure: 1 },
          onCourt: 5,
          outcome: 'You went to him directly. It was awkward and it worked.',
        },
      },
      {
        label: 'Out-work him until it is not a debate',
        effects: {
          attributes: { motor: 1.4 },
          energy: -10,
          onCourt: 3,
          outcome: 'You let the work answer it. The locker room came around slowly.',
        },
      },
      {
        label: 'Ignore it',
        effects: {
          onCourt: -4,
          confidence: -4,
          outcome: 'You ignored it. It did not go away on its own.',
        },
      },
    ],
  },
  {
    id: 'team-ball-hog',
    category: 'teammates',
    title: 'He is not passing',
    prompt:
      'Your leading scorer has stopped passing entirely. You are open every possession and the team is losing.',
    weight: 8,
    conditions: { minGrade: 9 },
    choices: [
      {
        label: 'Call him out in the huddle',
        effects: {
          attributes: { leadership: 1.5 },
          onCourt: 4,
          coachTrust: 3,
          outcome: 'You called it in the huddle. He did not like it. The ball moved after that.',
        },
      },
      {
        label: 'Go to the coach',
        effects: {
          coachTrust: 5,
          onCourt: -5,
          outcome: 'You took it to the coach. Somebody told him you did.',
        },
      },
      {
        label: 'Start hunting your own shot too',
        effects: {
          attributes: { offDribble3: 1, passingVision: -0.8 },
          onCourt: -3,
          outcome: 'You started hunting yours as well. The film was ugly.',
        },
      },
    ],
  },
  {
    id: 'team-hazing',
    category: 'teammates',
    title: 'Freshman initiation',
    prompt:
      'The upperclassmen have a tradition for freshmen. It is not violent, but it is genuinely humiliating and one kid is close to quitting.',
    weight: 9,
    once: true,
    conditions: { maxGrade: 10 },
    choices: [
      {
        label: 'Refuse and stand with the kid',
        effects: {
          offCourt: 10,
          attributes: { leadership: 2 },
          relationships: { friends: -10 },
          outcome: 'You refused and stood next to him. The room went quiet.',
        },
      },
      {
        label: 'Go along with it',
        effects: {
          relationships: { friends: 10 },
          offCourt: -9,
          setFlags: ['went_along_hazing'],
          outcome: 'You went along with it. The kid quit the team a week later.',
        },
      },
    ],
  },
  {
    id: 'team-injured-friend',
    category: 'teammates',
    title: 'His knee',
    prompt:
      'Your closest friend on the team tore his knee in practice. He is done for the year and nobody has been to see him.',
    weight: 7,
    choices: [
      {
        label: 'Go see him every week',
        effects: {
          relationships: { friends: 16 },
          offCourt: 6,
          energy: -5,
          outcome: 'You went every week. He said it was the only thing keeping him sane.',
        },
      },
      {
        label: 'Send a text',
        effects: {
          relationships: { friends: -6 },
          outcome: 'You sent a text. He read it.',
        },
      },
    ],
  },
  {
    id: 'team-fight-practice',
    category: 'teammates',
    title: 'It got physical',
    prompt: 'A practice scrimmage boiled over. He shoved you. The gym went silent and everyone is waiting.',
    weight: 8,
    choices: [
      {
        label: 'Swing',
        effects: {
          offCourt: -14,
          coachTrust: -12,
          onCourt: 4,
          setFlags: ['fought_teammate'],
          outcome: 'You swung. Both of you were sent home. Somebody filmed it.',
        },
      },
      {
        label: 'Walk away',
        effects: {
          attributes: { composure: 2 },
          coachTrust: 6,
          offCourt: 6,
          outcome: 'You walked away. Coach made a point of mentioning it later.',
        },
      },
      {
        label: 'Get in his face without touching him',
        effects: {
          onCourt: 3,
          coachTrust: -3,
          attributes: { composure: -0.5 },
          outcome: 'You got in his face and stopped there. Message sent, line not crossed.',
        },
      },
    ],
  },
  {
    id: 'team-captain-vote',
    category: 'teammates',
    title: 'The captain vote',
    prompt: 'The team is voting for captains. You know you are one or two votes short.',
    weight: 8,
    conditions: { minGrade: 11 },
    choices: [
      {
        label: 'Campaign for it',
        effects: {
          attributes: { leadership: 1.2 },
          relationships: { friends: 4 },
          onCourt: 2,
          outcome: 'You worked the room. You got it by one vote.',
        },
      },
      {
        label: 'Let the vote happen',
        effects: {
          offCourt: 4,
          attributes: { composure: 0.8 },
          outcome: 'You let it happen. You were not named. Nobody mentioned it.',
        },
      },
    ],
  },
  {
    id: 'team-new-transfer',
    category: 'teammates',
    title: 'They brought somebody in',
    prompt:
      'A transfer arrived at your position. He is older, stronger, and the staff clearly recruited him to start.',
    weight: 9,
    conditions: { minGrade: 10 },
    choices: [
      {
        label: 'Take it as a challenge',
        effects: {
          attributes: { motor: 1.5, strength: 0.8 },
          energy: -12,
          onCourt: 4,
          outcome: 'You treated it as a challenge and made practice a war.',
        },
      },
      {
        label: 'Ask the coach where you stand',
        effects: {
          coachTrust: 4,
          relationships: { hsCoach: 6 },
          outcome: 'You asked directly. He respected the question and gave you a real answer.',
        },
      },
      {
        label: 'Sulk',
        effects: {
          coachTrust: -8,
          confidence: -8,
          outcome: 'You sulked for three weeks. It showed in everything.',
        },
      },
    ],
  },
  {
    id: 'team-cover-for-him',
    category: 'teammates',
    title: 'He wants you to cover',
    prompt:
      'A teammate missed curfew on a road trip and wants you to tell the staff he was in his room.',
    weight: 8,
    choices: [
      {
        label: 'Cover for him',
        effects: {
          relationships: { friends: 12 },
          offCourt: -6,
          setFlags: ['covered_for_teammate'],
          outcome: 'You covered. He owes you and both of you know it.',
        },
      },
      {
        label: 'Refuse to lie',
        effects: {
          coachTrust: 7,
          relationships: { friends: -12 },
          offCourt: 6,
          outcome: 'You would not lie for him. The locker room heard about that.',
        },
      },
    ],
  },
  {
    id: 'team-younger-kid',
    category: 'teammates',
    title: 'The freshman who keeps asking',
    prompt:
      'A freshman keeps asking you to stay after and rebound for him. It is forty minutes you do not really have.',
    weight: 6,
    conditions: { minGrade: 11 },
    choices: [
      {
        label: 'Stay and rebound',
        effects: {
          attributes: { leadership: 1.6, coachability: 0.5 },
          onCourt: 4,
          energy: -7,
          outcome: 'You stayed. He told everyone who would listen.',
        },
      },
      {
        label: 'Tell him you are busy',
        effects: {
          energy: 4,
          onCourt: -2,
          outcome: 'You told him you were busy. He stopped asking.',
        },
      },
    ],
  },
  {
    id: 'team-locker-theft',
    category: 'teammates',
    title: 'Money missing from the locker room',
    prompt:
      'Cash has gone missing twice this month. You know who is doing it, and you know why he needs it.',
    weight: 7,
    conditions: { minGrade: 10 },
    choices: [
      {
        label: 'Tell the coach',
        effects: {
          coachTrust: 5,
          relationships: { friends: -10 },
          offCourt: 3,
          outcome: 'You told the coach. He was quietly moved off the team.',
        },
      },
      {
        label: 'Handle it privately with him',
        effects: {
          attributes: { leadership: 2 },
          offCourt: 6,
          relationships: { friends: 6 },
          outcome: 'You handled it yourself. The money stopped going missing.',
        },
      },
      {
        label: 'Stay out of it',
        effects: {
          offCourt: -3,
          outcome: 'You stayed out of it. It kept happening.',
        },
      },
    ],
  },

  // ======================================================================
  // COACHES
  // ======================================================================
  {
    id: 'coach-bench-benching',
    category: 'coaches',
    title: 'You did not play',
    prompt:
      'You did not leave the bench tonight. No explanation, no conversation, and the guy who played your minutes went 2-for-11.',
    weight: 10,
    conditions: { maxCoachTrust: 55, minGrade: 9 },
    choices: [
      {
        label: 'Ask him what you need to do',
        effects: {
          coachTrust: 8,
          relationships: { hsCoach: 9 },
          attributes: { coachability: 1.2 },
          outcome: 'You asked what you needed to do. He gave you a list. It was fair.',
        },
      },
      {
        label: 'Say nothing and work',
        effects: {
          attributes: { motor: 1 },
          coachTrust: 2,
          confidence: -5,
          outcome: 'You said nothing and kept working. It ate at you.',
        },
      },
      {
        label: 'Tell him it is a joke',
        effects: {
          coachTrust: -16,
          relationships: { hsCoach: -18 },
          onCourt: 2,
          setFlags: ['crossed_coach'],
          outcome: 'You told him what you thought. It cost you more than that game.',
        },
      },
    ],
  },
  {
    id: 'coach-doghouse',
    category: 'coaches',
    title: 'The doghouse',
    prompt:
      'Since the argument, your minutes have collapsed. The staff barely looks at you in film. This could cost you a season.',
    weight: 14,
    once: true,
    conditions: { requireFlags: ['crossed_coach'] },
    choices: [
      {
        label: 'Apologise properly, in front of the team',
        effects: {
          coachTrust: 18,
          relationships: { hsCoach: 15 },
          onCourt: -3,
          clearFlags: ['crossed_coach'],
          outcome: 'You apologised in front of everyone. He let you back in.',
        },
      },
      {
        label: 'Wait him out',
        effects: {
          coachTrust: -6,
          confidence: -8,
          outcome: 'You waited him out. The season went past you.',
        },
      },
    ],
  },
  {
    id: 'coach-position-change',
    category: 'coaches',
    title: 'He wants to move you',
    prompt:
      'Coach wants to play you out of position for the good of the team. It will hurt your numbers and probably your recruitment.',
    weight: 9,
    conditions: { minGrade: 10 },
    choices: [
      {
        label: 'Do it without complaint',
        effects: {
          coachTrust: 14,
          attributes: { coachability: 2, basketballIQ: 1 },
          hype: -4,
          outcome: 'You moved without complaint. Coach told every visiting staff about it.',
        },
      },
      {
        label: 'Refuse',
        effects: {
          coachTrust: -12,
          hype: 2,
          attributes: { coachability: -1.5 },
          outcome: 'You refused. He played you where you wanted, and less often.',
        },
      },
    ],
  },
  {
    id: 'coach-extra-film',
    category: 'coaches',
    title: 'Six in the morning',
    prompt: 'The assistant offers to break down film with you at six in the morning, twice a week.',
    weight: 8,
    choices: [
      {
        label: 'Be there every time',
        effects: {
          attributes: { basketballIQ: 2.4, composure: 0.8 },
          coachTrust: 9,
          energy: -12,
          relationships: { hsCoach: 10 },
          outcome: 'You never missed one. Your reads got noticeably faster.',
        },
      },
      {
        label: 'Go when you can',
        effects: {
          attributes: { basketballIQ: 0.8 },
          coachTrust: 2,
          energy: -4,
          outcome: 'You made about half of them.',
        },
      },
      {
        label: 'Pass',
        effects: {
          energy: 6,
          coachTrust: -5,
          outcome: 'You passed. He stopped offering.',
        },
      },
    ],
  },
  {
    id: 'coach-fired',
    category: 'coaches',
    title: 'They fired him',
    prompt:
      'Your head coach was let go. The new staff arrives with their own ideas and their own guys.',
    weight: 7,
    once: true,
    conditions: { minGrade: 10 },
    choices: [
      {
        label: 'Introduce yourself first, work hardest',
        effects: {
          coachTrust: 10,
          attributes: { motor: 1 },
          energy: -8,
          outcome: 'You were the first one in the new staff’s office. It mattered.',
        },
      },
      {
        label: 'Wait and see',
        effects: {
          coachTrust: -6,
          outcome: 'You waited to see how it shook out. So did they.',
        },
      },
    ],
  },
  {
    id: 'coach-recruiting-call',
    category: 'coaches',
    title: 'He is on the phone for you',
    prompt:
      'Your coach spends his evenings calling college staffs on your behalf. He has never mentioned it to you.',
    weight: 6,
    conditions: { minGrade: 11, minCoachTrust: 60 },
    choices: [
      {
        label: 'Thank him',
        effects: {
          relationships: { hsCoach: 14 },
          coachTrust: 6,
          hype: 3,
          outcome: 'You thanked him. He waved it off and kept making calls.',
        },
      },
      {
        label: 'Assume it is his job',
        effects: {
          relationships: { hsCoach: -8 },
          outcome: 'You assumed it was part of the job. He kept making the calls anyway.',
        },
      },
    ],
  },
  {
    id: 'coach-run-it-back',
    category: 'coaches',
    title: 'Conditioning after a loss',
    prompt:
      'You lost by twenty. Coach has the whole team on the baseline and it is already seven o’clock.',
    weight: 8,
    choices: [
      {
        label: 'Lead from the front',
        effects: {
          attributes: { stamina: 1.2, leadership: 1.4 },
          coachTrust: 8,
          energy: -16,
          outcome: 'You finished first in every one. The team followed.',
        },
      },
      {
        label: 'Get through it',
        effects: {
          attributes: { stamina: 0.5 },
          energy: -10,
          outcome: 'You got through it and went home.',
        },
      },
      {
        label: 'Loaf',
        effects: {
          coachTrust: -10,
          energy: -4,
          outcome: 'You loafed. He noticed, and so did everyone else.',
        },
      },
    ],
  },
  {
    id: 'coach-honest-assessment',
    category: 'coaches',
    title: 'An honest assessment',
    prompt:
      'Your coach sits you down and tells you, kindly, that he does not think you are a high-major player.',
    weight: 7,
    conditions: { minGrade: 11, maxNationalRank: 400, minNationalRank: 150 },
    choices: [
      {
        label: 'Use it as fuel',
        effects: {
          attributes: { motor: 2 },
          confidence: -6,
          energy: -6,
          setFlags: ['told_not_good_enough'],
          outcome: 'You took it personally. That is one way to use it.',
        },
      },
      {
        label: 'Ask him what he actually sees',
        effects: {
          attributes: { basketballIQ: 1.5, coachability: 1.5 },
          relationships: { hsCoach: 10 },
          outcome: 'You asked him to be specific. What he said was useful.',
        },
      },
    ],
  },
  {
    id: 'coach-trainer-offer',
    category: 'coaches',
    title: 'A private trainer',
    prompt:
      'A well-regarded skills trainer will take you on. He is not cheap and he does not do discounts.',
    weight: 8,
    conditions: { minMoney: 900, requireInactive: ['trainer'], minAge: 14 },
    choices: [
      {
        label: 'Pay for it',
        effects: {
          money: -900,
          activate: ['trainer'],
          attributes: { finishing: 1, ballHandling: 1 },
          outcome: 'You paid for the trainer. First session was humbling.',
        },
      },
      {
        label: 'Cannot justify it',
        effects: {
          outcome: 'You decided you could not justify the money.',
        },
      },
    ],
  },
  {
    id: 'coach-aau-conflict',
    category: 'coaches',
    title: 'Two coaches, one weekend',
    prompt:
      'Your AAU coach and your high school coach have scheduled over each other and each expects you to pick him.',
    weight: 9,
    conditions: { onCircuit: true, months: [3, 4, 5] },
    choices: [
      {
        label: 'Go with the high school',
        effects: {
          coachTrust: 10,
          relationships: { hsCoach: 10, aauCoach: -14 },
          hype: -4,
          outcome: 'You went with your high school coach. Your AAU coach did not forget.',
        },
      },
      {
        label: 'Go with the circuit',
        effects: {
          hype: 7,
          relationships: { aauCoach: 12, hsCoach: -12 },
          coachTrust: -9,
          outcome: 'You went with the circuit. More eyes, colder locker room.',
        },
      },
    ],
  },

  // ======================================================================
  // SOCIAL / PARTIES
  // ======================================================================
  {
    id: 'soc-party-before-game',
    category: 'social',
    title: 'The party the night before',
    prompt: 'Everyone is going. You have a game at ten in the morning.',
    weight: 10,
    choices: [
      {
        label: 'Stay home',
        effects: {
          energy: 10,
          relationships: { friends: -7 },
          attributes: { composure: 0.5 },
          outcome: 'You stayed home and slept. You were the best player on the floor.',
        },
      },
      {
        label: 'Go for an hour',
        effects: {
          relationships: { friends: 6 },
          energy: -6,
          outcome: 'You went for an hour. Nobody believes it was an hour.',
        },
      },
      {
        label: 'Stay out',
        effects: {
          relationships: { friends: 14 },
          energy: -22,
          coachTrust: -5,
          outcome: 'You stayed out. The ten a.m. tip was brutal.',
        },
      },
    ],
  },
  {
    id: 'soc-drink-offered',
    category: 'social',
    title: 'Somebody hands you a cup',
    prompt: 'You are seventeen and somebody just put a drink in your hand at a house full of phones.',
    weight: 9,
    conditions: { minAge: 16 },
    choices: [
      {
        label: 'Put it down',
        effects: {
          offCourt: 6,
          relationships: { friends: -4 },
          outcome: 'You put it down and nobody made much of it.',
        },
      },
      {
        label: 'Drink it',
        effects: {
          relationships: { friends: 8 },
          offCourt: -6,
          setFlags: ['party_photo_risk'],
          outcome: 'You drank it. Somebody was filming, because somebody always is.',
        },
      },
    ],
  },
  {
    id: 'soc-photo-surfaces',
    category: 'social',
    title: 'The photo',
    prompt:
      'A photo of you at that party is circulating. It is not the worst thing in the world, but two college staffs have seen it.',
    weight: 13,
    once: true,
    conditions: { requireFlags: ['party_photo_risk'], minGrade: 11 },
    choices: [
      {
        label: 'Get ahead of it — call the staffs yourself',
        effects: {
          offCourt: 4,
          attributes: { composure: 1.5 },
          clearFlags: ['party_photo_risk'],
          outcome: 'You called them before they called you. Two of them respected it.',
        },
      },
      {
        label: 'Say nothing',
        effects: {
          offCourt: -12,
          hype: -3,
          outcome: 'You said nothing and hoped. One program went quiet.',
        },
      },
      {
        label: 'Post something defiant',
        effects: {
          hype: 5,
          offCourt: -16,
          outcome: 'You posted something defiant. It did numbers. It also did damage.',
        },
      },
    ],
  },
  {
    id: 'soc-friend-trouble',
    category: 'social',
    title: 'Your friend is in the car',
    prompt:
      'Your oldest friend wants a ride at one in the morning and will not say where he has been.',
    weight: 8,
    conditions: { minAge: 16 },
    choices: [
      {
        label: 'Go get him',
        effects: {
          relationships: { friends: 16 },
          energy: -8,
          offCourt: -3,
          outcome: 'You went and got him. You did not ask questions.',
        },
      },
      {
        label: 'Tell him you cannot',
        effects: {
          relationships: { friends: -14 },
          offCourt: 3,
          outcome: 'You told him no. He has not brought it up since.',
        },
      },
    ],
  },
  {
    id: 'soc-old-friends',
    category: 'social',
    title: 'The friends you had before',
    prompt:
      'The people you grew up with have started saying you think you are better than them. You are not sure they are entirely wrong.',
    weight: 7,
    conditions: { minHype: 40 },
    choices: [
      {
        label: 'Make time for them',
        effects: {
          relationships: { friends: 14 },
          energy: -6,
          confidence: 5,
          outcome: 'You made the time. It was easier than you expected.',
        },
      },
      {
        label: 'Let it drift',
        effects: {
          relationships: { friends: -12 },
          energy: 5,
          confidence: -4,
          outcome: 'You let it drift. The group chat went quiet.',
        },
      },
    ],
  },
  {
    id: 'soc-hometown-hero',
    category: 'social',
    title: 'Everybody knows your name',
    prompt:
      'You cannot get gas without three conversations. It is nice, mostly. It is also relentless.',
    weight: 6,
    conditions: { minHype: 55 },
    choices: [
      {
        label: 'Give everyone time',
        effects: {
          offCourt: 8,
          energy: -8,
          hype: 3,
          outcome: 'You gave everyone their minute. The town loves you for it.',
        },
      },
      {
        label: 'Keep your head down',
        effects: {
          energy: 6,
          offCourt: -4,
          outcome: 'You kept the hood up and kept moving.',
        },
      },
    ],
  },
  {
    id: 'soc-graduation-party',
    category: 'social',
    title: 'The last summer',
    prompt: 'It is the last summer before everything changes and everyone wants a piece of it.',
    weight: 7,
    conditions: { minGrade: 12, months: [5, 6] },
    choices: [
      {
        label: 'Enjoy it properly',
        effects: {
          relationships: { friends: 16 },
          confidence: 8,
          energy: -12,
          outcome: 'You let yourself enjoy it. You will remember this summer.',
        },
      },
      {
        label: 'Stay in the gym',
        effects: {
          attributes: { catchAndShoot3: 1, finishing: 1.2, strength: 1.2 },
          relationships: { friends: -10 },
          energy: -10,
          outcome: 'You spent the summer in the gym. Quiet, and productive.',
        },
      },
    ],
  },
  {
    id: 'soc-group-chat',
    category: 'social',
    title: 'Something in the group chat',
    prompt:
      'Somebody posted something ugly in a chat with your name in it. You did not write it, but you are in the thread.',
    weight: 8,
    conditions: { minAge: 15 },
    choices: [
      {
        label: 'Leave the chat and say why',
        effects: {
          offCourt: 8,
          relationships: { friends: -8 },
          outcome: 'You left and said why. A couple of them followed you out.',
        },
      },
      {
        label: 'Stay silent in it',
        effects: {
          offCourt: -7,
          setFlags: ['in_bad_chat'],
          outcome: 'You stayed in the thread and said nothing.',
        },
      },
    ],
  },
  {
    id: 'soc-teammate-invite',
    category: 'social',
    title: 'Team dinner',
    prompt: 'The seniors are organising a team dinner. You are the only underclassman invited.',
    weight: 6,
    conditions: { maxGrade: 11 },
    choices: [
      {
        label: 'Go',
        effects: {
          relationships: { friends: 10 },
          onCourt: 4,
          money: -40,
          outcome: 'You went. Being invited meant more than the dinner.',
        },
      },
      {
        label: 'Skip it and get shots up',
        effects: {
          attributes: { catchAndShoot3: 0.8 },
          relationships: { friends: -6 },
          outcome: 'You got shots up instead. The seniors noticed you were not there.',
        },
      },
    ],
  },
  {
    id: 'soc-curfew-broken',
    category: 'social',
    title: 'One in the morning',
    prompt: 'You are two hours past curfew and your key is in the door.',
    weight: 6,
    conditions: { minAge: 15 },
    choices: [
      {
        label: 'Own it in the morning',
        effects: {
          relationships: { parents: 5 },
          offCourt: 4,
          outcome: 'You owned it at breakfast. Grounded, but respected.',
        },
      },
      {
        label: 'Lie about where you were',
        effects: {
          relationships: { parents: -12 },
          offCourt: -5,
          outcome: 'You lied. They knew immediately.',
        },
      },
    ],
  },

  // ======================================================================
  // MEDIA
  // ======================================================================
  {
    id: 'media-first-interview',
    category: 'media',
    title: 'Your first real interview',
    prompt: 'A recruiting site wants fifteen minutes. It is the first time anyone has asked.',
    weight: 8,
    once: true,
    conditions: { minHype: 25 },
    choices: [
      {
        label: 'Credit your teammates',
        effects: {
          onCourt: 6,
          offCourt: 6,
          hype: 3,
          relationships: { hsCoach: 6 },
          outcome: 'You talked about your teammates the whole time. It read well.',
        },
      },
      {
        label: 'Sell yourself hard',
        effects: {
          hype: 8,
          onCourt: -3,
          outcome: 'You sold yourself hard. The clip travelled.',
        },
      },
    ],
  },
  {
    id: 'media-ranking-slip',
    category: 'media',
    title: 'You dropped in the rankings',
    prompt: 'The new rankings are out and you fell. The comment section has thoughts.',
    weight: 9,
    conditions: { minNationalRank: 60, minHype: 20 },
    choices: [
      {
        label: 'Stay off it entirely',
        effects: {
          attributes: { composure: 1.6 },
          confidence: 4,
          outcome: 'You stayed off the internet. Best decision you made that month.',
        },
      },
      {
        label: 'Read every word',
        effects: {
          confidence: -10,
          attributes: { motor: 0.8 },
          outcome: 'You read all of it. Twice.',
        },
      },
      {
        label: 'Reply to a hater',
        effects: {
          hype: 4,
          offCourt: -8,
          confidence: -3,
          outcome: 'You replied to one of them. Screenshots exist.',
        },
      },
    ],
  },
  {
    id: 'media-local-paper',
    category: 'media',
    title: 'The local paper',
    prompt: 'The town paper wants a feature on you and your family.',
    weight: 6,
    conditions: { minHype: 30 },
    choices: [
      {
        label: 'Do it',
        effects: {
          hype: 4,
          relationships: { parents: 8 },
          offCourt: 4,
          outcome: 'Your mother has three copies. One is laminated.',
        },
      },
      {
        label: 'Decline',
        effects: {
          hype: -2,
          energy: 3,
          outcome: 'You passed on the feature.',
        },
      },
    ],
  },
  {
    id: 'media-hot-take',
    category: 'media',
    title: 'A national writer took a shot',
    prompt:
      'A writer with a real audience called you "the most overrated prospect in the class" by name.',
    weight: 8,
    conditions: { minHype: 55 },
    choices: [
      {
        label: 'Ignore it publicly, use it privately',
        effects: {
          attributes: { motor: 1.6, composure: 1 },
          confidence: -4,
          outcome: 'You never responded. You did not need to.',
        },
      },
      {
        label: 'Answer him',
        effects: {
          hype: 7,
          offCourt: -7,
          outcome: 'You answered him. It became the story for a week.',
        },
      },
    ],
  },
  {
    id: 'media-mixtape-crew',
    category: 'media',
    title: 'A mixtape crew wants to follow you',
    prompt: 'A well-known channel wants to shadow you for a season. Huge reach, zero privacy.',
    weight: 7,
    conditions: { minHype: 45, minGrade: 10 },
    choices: [
      {
        label: 'Let them in',
        effects: {
          hype: 14,
          energy: -8,
          offCourt: -3,
          setFlags: ['documented_season'],
          outcome: 'You let the cameras in. Your name travelled a long way.',
        },
      },
      {
        label: 'Say no',
        effects: {
          offCourt: 4,
          energy: 4,
          outcome: 'You told them no. Your season stayed yours.',
        },
      },
    ],
  },
  {
    id: 'media-camera-pressure',
    category: 'media',
    title: 'Playing with a camera in your face',
    prompt:
      'The film crew is at every game now. You are 4-for-19 over two nights and the lens has not moved.',
    weight: 10,
    once: true,
    conditions: { requireFlags: ['documented_season'] },
    choices: [
      {
        label: 'Ask them to back off for a while',
        effects: {
          hype: -5,
          confidence: 8,
          attributes: { composure: 1.2 },
          outcome: 'You asked for space. Your shooting came back the next week.',
        },
      },
      {
        label: 'Play through it',
        effects: {
          attributes: { composure: 2.2 },
          confidence: -6,
          hype: 3,
          outcome: 'You played through it. Learning to not see the camera is a skill.',
        },
      },
    ],
  },
  {
    id: 'media-national-list',
    category: 'media',
    title: 'A national list',
    prompt: 'You made a national top-100 watch list for the first time.',
    weight: 6,
    once: true,
    conditions: { maxNationalRank: 100 },
    choices: [
      {
        label: 'Post it',
        effects: {
          hype: 5,
          offCourt: -2,
          confidence: 6,
          outcome: 'You posted it. Of course you did.',
        },
      },
      {
        label: 'Screenshot it and tell nobody',
        effects: {
          confidence: 8,
          attributes: { composure: 0.8 },
          outcome: 'You saved it to your camera roll and said nothing.',
        },
      },
    ],
  },
  {
    id: 'media-radio-callin',
    category: 'media',
    title: 'They are talking about you on the radio',
    prompt:
      'A local sports radio show spent a segment debating whether you are being overhyped by your own school.',
    weight: 6,
    conditions: { minHype: 40 },
    choices: [
      {
        label: 'Laugh it off',
        effects: {
          attributes: { composure: 1.2 },
          confidence: 3,
          outcome: 'You laughed it off. Your teammates did not.',
        },
      },
      {
        label: 'Let it get to you',
        effects: {
          confidence: -8,
          attributes: { motor: 0.8 },
          outcome: 'It got under your skin and stayed there a while.',
        },
      },
    ],
  },

  // ======================================================================
  // INJURY
  // ======================================================================
  {
    id: 'inj-play-through',
    category: 'injury',
    title: 'It is probably fine',
    prompt:
      'Your ankle has been wrong for two weeks. There is a big game Friday and a trainer who wants to scan it.',
    weight: 10,
    conditions: { injured: false, minGrade: 9 },
    choices: [
      {
        label: 'Get it scanned',
        effects: {
          energy: 5,
          coachTrust: -3,
          offCourt: 2,
          outcome: 'You got it looked at. Minor, but you sat out the week.',
        },
      },
      {
        label: 'Play Friday',
        effects: {
          coachTrust: 6,
          onCourt: 5,
          injury: { name: 'aggravated ankle sprain', severity: 'moderate', months: 2, cap: 0.88 },
          outcome: 'You played. It went from a niggle to a real problem in the second quarter.',
        },
      },
    ],
  },
  {
    id: 'inj-rehab-boredom',
    category: 'injury',
    title: 'Six weeks of the same three exercises',
    prompt: 'Rehab is unbelievably boring and nobody is watching whether you do it properly.',
    weight: 11,
    conditions: { injured: true },
    choices: [
      {
        label: 'Do every rep exactly right',
        effects: {
          attributes: { durability: 2, coachability: 1 },
          energy: -6,
          outcome: 'You did the whole protocol properly. It came back stronger than before.',
        },
      },
      {
        label: 'Cut corners',
        effects: {
          attributes: { durability: -2.5 },
          energy: 8,
          setFlags: ['skipped_rehab'],
          outcome: 'You cut corners. It felt fine. It will not stay fine.',
        },
      },
    ],
  },
  {
    id: 'inj-recurrence',
    category: 'injury',
    title: 'The same spot again',
    prompt: 'It has gone again, in exactly the same place, doing nothing in particular.',
    weight: 12,
    once: true,
    conditions: { requireFlags: ['skipped_rehab'], injured: false },
    choices: [
      {
        label: 'Do it properly this time',
        effects: {
          injury: { name: 'recurrent soft tissue injury', severity: 'moderate', months: 3, cap: 0.85 },
          attributes: { durability: 1 },
          clearFlags: ['skipped_rehab'],
          outcome: 'Same injury, same spot. This time you did the rehab properly.',
        },
      },
      {
        label: 'Tape it and keep going',
        effects: {
          injury: { name: 'chronic ankle instability', severity: 'major', months: 5, cap: 0.76 },
          attributes: { durability: -3 },
          outcome: 'You taped it and kept playing until you could not.',
        },
      },
    ],
  },
  {
    id: 'inj-comeback-game',
    category: 'injury',
    title: 'First game back',
    prompt: 'You are cleared. Everyone is watching to see if you are the same player.',
    weight: 9,
    conditions: { injured: false, requireFlags: ['returned_from_injury'] },
    choices: [
      {
        label: 'Ease into it',
        effects: {
          attributes: { durability: 1 },
          confidence: 3,
          hype: -2,
          outcome: 'You eased in. Sensible, and quiet.',
        },
      },
      {
        label: 'Come out firing',
        effects: {
          hype: 6,
          confidence: 7,
          energy: -10,
          outcome: 'You came out firing and reminded everyone.',
        },
      },
    ],
  },
  {
    id: 'inj-painkillers',
    category: 'injury',
    title: 'Something for the pain',
    prompt: 'Somebody offers you something stronger than ibuprofen to get through the postseason.',
    weight: 8,
    conditions: { injured: true, minGrade: 11 },
    choices: [
      {
        label: 'Refuse',
        effects: {
          offCourt: 8,
          attributes: { composure: 1 },
          outcome: 'You said no. It was a long postseason.',
        },
      },
      {
        label: 'Take it',
        effects: {
          offCourt: -12,
          energy: 10,
          setFlags: ['painkiller_risk'],
          outcome: 'You took it. You got through the postseason.',
        },
      },
    ],
  },
  {
    id: 'inj-doctor-projection',
    category: 'injury',
    title: 'A conversation about your frame',
    prompt:
      'A sports doctor looks at your growth plates and offers to give you a projection of where you will finish.',
    weight: 7,
    once: true,
    conditions: { minAge: 15, maxAge: 17 },
    choices: [
      {
        label: 'Ask for the number',
        effects: {
          confidence: 5,
          setFlags: ['knows_projection'],
          outcome: 'He gave you a range. Wider than you hoped, but a real answer.',
        },
      },
      {
        label: 'Rather not know',
        effects: {
          attributes: { composure: 1 },
          outcome: 'You told him you would rather find out the normal way.',
        },
      },
    ],
  },

  // ======================================================================
  // MONEY
  // ======================================================================
  {
    id: 'money-aau-fees',
    category: 'money',
    title: 'The circuit costs money',
    prompt: 'Travel team fees are due. It is a real number and your family does not have it spare.',
    weight: 10,
    conditions: { income: ['low', 'modest'], months: [2, 3], minAge: 14 },
    choices: [
      {
        label: 'Ask your parents to find it',
        effects: {
          money: 800,
          relationships: { parents: -8 },
          hype: 4,
          outcome: 'They found the money somewhere. You did not ask where.',
        },
      },
      {
        label: 'Get a job and pay it yourself',
        effects: {
          money: 500,
          energy: -14,
          relationships: { parents: 12 },
          attributes: { motor: 0.8 },
          outcome: 'You worked weekends and paid your own fees.',
        },
      },
      {
        label: 'Skip the circuit this year',
        effects: {
          hype: -10,
          money: 200,
          energy: 8,
          outcome: 'You sat the circuit out. Nobody saw you play all spring.',
        },
      },
    ],
  },
  {
    id: 'money-shoes',
    category: 'money',
    title: 'Your shoes are done',
    prompt: 'You have played a season and a half in these. The tread is gone and your knees know it.',
    weight: 8,
    conditions: { income: ['low', 'modest'] },
    choices: [
      {
        label: 'Buy proper ones',
        effects: {
          money: -160,
          attributes: { durability: 1, speed: 0.4 },
          outcome: 'New shoes. Immediate difference.',
        },
      },
      {
        label: 'Make them last',
        effects: {
          attributes: { durability: -1.2 },
          outcome: 'You made them last another season. Your knees kept score.',
        },
      },
    ],
  },
  {
    id: 'money-job-offer',
    category: 'money',
    title: 'Twenty hours a week',
    prompt:
      'The warehouse is hiring. Twenty hours a week, decent money, and it is every evening you currently spend in the gym.',
    weight: 9,
    conditions: { income: ['low'], minAge: 15 },
    choices: [
      {
        label: 'Take the job',
        effects: {
          money: 1400,
          energy: -18,
          relationships: { parents: 14 },
          attributes: { strength: 0.8 },
          setFlags: ['has_job'],
          outcome: 'You took the job. Money in the house, less time in the gym.',
        },
      },
      {
        label: 'Turn it down',
        effects: {
          relationships: { parents: -8 },
          energy: 6,
          outcome: 'You turned it down to keep training. It was not a comfortable conversation.',
        },
      },
    ],
  },
  {
    id: 'money-handshake',
    category: 'money',
    title: 'A handshake with something in it',
    prompt:
      'A man you have seen at three of your games shakes your hand and there is cash in it. He does not want anything. Yet.',
    weight: 8,
    conditions: { minHype: 50, minGrade: 10 },
    choices: [
      {
        label: 'Give it back',
        effects: {
          offCourt: 10,
          attributes: { composure: 1 },
          outcome: 'You handed it straight back. He respected it, or pretended to.',
        },
      },
      {
        label: 'Keep it',
        effects: {
          money: 600,
          offCourt: -14,
          setFlags: ['took_money'],
          outcome: 'You kept it. Nobody saw. Somebody always sees.',
        },
      },
    ],
  },
  {
    id: 'money-investigation',
    category: 'money',
    title: 'Somebody has been asking questions',
    prompt:
      'A compliance officer has been asking your coach about payments around the program. Your name has come up twice.',
    weight: 13,
    once: true,
    conditions: { requireFlags: ['took_money'], minGrade: 11 },
    choices: [
      {
        label: 'Come clean to your coach',
        effects: {
          offCourt: 5,
          coachTrust: -8,
          hype: -4,
          clearFlags: ['took_money'],
          outcome: 'You told your coach everything. He was furious and then he helped.',
        },
      },
      {
        label: 'Deny it',
        effects: {
          offCourt: -18,
          hype: -8,
          outcome: 'You denied it. Two programs stopped returning your coach’s calls.',
        },
      },
    ],
  },
  {
    id: 'money-family-struggling',
    category: 'money',
    title: 'The envelope on the counter',
    prompt: 'There is a red bill on the kitchen counter and nobody has mentioned it to you.',
    weight: 8,
    conditions: { income: ['low'], minAge: 15 },
    choices: [
      {
        label: 'Hand over what you have',
        effects: {
          money: -350,
          relationships: { parents: 16 },
          offCourt: 5,
          outcome: 'You gave them what you had. Nobody said thank you and everybody knew.',
        },
      },
      {
        label: 'Pretend you did not see it',
        effects: {
          relationships: { parents: -6 },
          confidence: -4,
          outcome: 'You put it back where you found it.',
        },
      },
    ],
  },
  {
    id: 'money-camp-fee',
    category: 'money',
    title: 'An elite camp invite',
    prompt:
      'An invite-only camp in July. Every staff that matters will be in the building. It costs to get there.',
    weight: 9,
    conditions: { months: [5, 6], minHype: 35 },
    choices: [
      {
        label: 'Find the money and go',
        effects: {
          money: -550,
          hype: 12,
          energy: -8,
          outcome: 'You went. You played well in front of the right people.',
        },
      },
      {
        label: 'Cannot afford it',
        effects: {
          hype: -5,
          outcome: 'You could not make the numbers work. The camp went ahead without you.',
        },
      },
    ],
  },
  {
    id: 'money-gear-hookup',
    category: 'money',
    title: 'A box of gear',
    prompt: 'Your AAU program has a box of shoes and gear with your name on it. Nobody mentions payment.',
    weight: 6,
    conditions: { onCircuit: true },
    choices: [
      {
        label: 'Take it — everyone does',
        effects: {
          money: 300,
          offCourt: -3,
          attributes: { durability: 0.5 },
          outcome: 'You took the box. It is how the circuit works.',
        },
      },
      {
        label: 'Pay for what you take',
        effects: {
          money: -150,
          offCourt: 5,
          outcome: 'You insisted on paying. They thought you were strange.',
        },
      },
    ],
  },
  {
    id: 'money-job-conflict',
    category: 'money',
    title: 'Your shift is during practice',
    prompt: 'They moved your shift. It is now every Tuesday and Thursday, straight through practice.',
    weight: 10,
    conditions: { requireFlags: ['has_job'], minGrade: 10 },
    choices: [
      {
        label: 'Quit the job',
        effects: {
          money: -300,
          coachTrust: 8,
          relationships: { parents: -8 },
          clearFlags: ['has_job'],
          outcome: 'You quit. Practice attendance fixed, household budget not.',
        },
      },
      {
        label: 'Keep the job, miss practice',
        effects: {
          money: 700,
          coachTrust: -14,
          outcome: 'You kept the job. Coach stopped counting on you.',
        },
      },
      {
        label: 'Ask the coach to work around it',
        effects: {
          coachTrust: -3,
          relationships: { hsCoach: 6 },
          money: 400,
          outcome: 'You explained the situation. He moved some things. Not everything.',
        },
      },
    ],
  },

  // ======================================================================
  // ROMANCE
  // ======================================================================
  {
    id: 'rom-first',
    category: 'romance',
    title: 'Somebody is interested',
    prompt: 'Someone in your year has made it fairly obvious. You have a game Friday and a lot on.',
    weight: 8,
    once: true,
    conditions: { minAge: 15, requireInactive: ['girlfriend'] },
    choices: [
      {
        label: 'Ask her out',
        effects: {
          activate: ['girlfriend'],
          confidence: 8,
          energy: -4,
          outcome: 'You asked. She said yes.',
        },
      },
      {
        label: 'Not right now',
        effects: {
          energy: 5,
          attributes: { composure: 0.6 },
          outcome: 'You decided the timing was wrong.',
        },
      },
    ],
  },
  {
    id: 'rom-time-conflict',
    category: 'romance',
    title: 'She wants a Saturday',
    prompt: 'She wants one Saturday that is not a gym, a game, or a film session. One.',
    weight: 9,
    conditions: { requireActive: ['girlfriend'] },
    choices: [
      {
        label: 'Give her the day',
        effects: {
          relationships: { girlfriend: 14 },
          confidence: 6,
          energy: 6,
          outcome: 'You took the day off. You felt better for it on Monday.',
        },
      },
      {
        label: 'Gym',
        effects: {
          relationships: { girlfriend: -14 },
          attributes: { catchAndShoot3: 0.8, finishing: 0.6 },
          outcome: 'You went to the gym. She stopped asking for a while.',
        },
      },
    ],
  },
  {
    id: 'rom-breakup',
    category: 'romance',
    title: 'It is not working',
    prompt: 'It has been bad for a month and both of you know it.',
    weight: 10,
    conditions: { requireActive: ['girlfriend'], maxRelationship: { girlfriend: 28 } },
    choices: [
      {
        label: 'End it cleanly',
        effects: {
          deactivate: ['girlfriend'],
          confidence: -6,
          attributes: { composure: 1.5 },
          outcome: 'You ended it properly. It was still awful.',
        },
      },
      {
        label: 'Let it limp on',
        effects: {
          relationships: { girlfriend: 4 },
          confidence: -8,
          energy: -6,
          outcome: 'You let it drag. It took something out of both of you.',
        },
      },
    ],
  },
  {
    id: 'rom-long-distance',
    category: 'romance',
    title: 'She is going away',
    prompt:
      'She is going to school eight hours away. You have not talked about what happens after graduation.',
    weight: 9,
    conditions: { requireActive: ['girlfriend'], minGrade: 12 },
    choices: [
      {
        label: 'Commit to making it work',
        effects: {
          relationships: { girlfriend: 16 },
          confidence: 6,
          energy: -5,
          outcome: 'You agreed to try. Hard, but you meant it.',
        },
      },
      {
        label: 'End it before you both get hurt',
        effects: {
          deactivate: ['girlfriend'],
          confidence: -8,
          attributes: { composure: 1.8 },
          outcome: 'You called it before it could go bad. Nobody felt good.',
        },
      },
    ],
  },
  {
    id: 'rom-supportive',
    category: 'romance',
    title: 'She came to every game',
    prompt: 'She has been at every home game this season, including the ones you would rather forget.',
    weight: 6,
    conditions: { requireActive: ['girlfriend'], minRelationship: { girlfriend: 60 } },
    choices: [
      {
        label: 'Tell her it matters',
        effects: {
          relationships: { girlfriend: 12 },
          confidence: 10,
          outcome: 'You told her what it meant. She already knew, but she liked hearing it.',
        },
      },
      {
        label: 'Assume she knows',
        effects: {
          relationships: { girlfriend: -5 },
          outcome: 'You assumed she knew.',
        },
      },
    ],
  },
  {
    id: 'rom-jealousy',
    category: 'romance',
    title: 'The attention',
    prompt:
      'Since you started getting ranked, a lot of people slide into your messages. She has seen some of them.',
    weight: 8,
    conditions: { requireActive: ['girlfriend'], minHype: 45 },
    choices: [
      {
        label: 'Show her everything and delete it',
        effects: {
          relationships: { girlfriend: 14 },
          offCourt: 4,
          outcome: 'You were completely transparent. It defused instantly.',
        },
      },
      {
        label: 'Tell her to stop going through your phone',
        effects: {
          relationships: { girlfriend: -16 },
          confidence: -4,
          outcome: 'You made it about her instead. That went badly.',
        },
      },
    ],
  },
  {
    id: 'rom-priorities',
    category: 'romance',
    title: 'She asked you what you want',
    prompt:
      'She asked, seriously, whether basketball or the two of you comes first. She wants an honest answer.',
    weight: 8,
    conditions: { requireActive: ['girlfriend'], minGrade: 11 },
    choices: [
      {
        label: 'Tell her the truth: basketball',
        effects: {
          relationships: { girlfriend: -10 },
          attributes: { motor: 1.2 },
          confidence: 4,
          offCourt: 3,
          outcome: 'You told her the truth. She appreciated the honesty and it still hurt.',
        },
      },
      {
        label: 'Tell her what she wants to hear',
        effects: {
          relationships: { girlfriend: 8 },
          offCourt: -5,
          outcome: 'You said the right thing. You are not sure you meant it.',
        },
      },
    ],
  },
  {
    id: 'rom-her-family',
    category: 'romance',
    title: 'Dinner with her parents',
    prompt: 'Her family wants you at dinner. Her father has opinions about basketball players.',
    weight: 6,
    conditions: { requireActive: ['girlfriend'], minRelationship: { girlfriend: 45 } },
    choices: [
      {
        label: 'Go and be yourself',
        effects: {
          relationships: { girlfriend: 10 },
          attributes: { composure: 1 },
          offCourt: 4,
          outcome: 'You went. Her father came around by dessert.',
        },
      },
      {
        label: 'Find a reason not to',
        effects: {
          relationships: { girlfriend: -10 },
          outcome: 'You found a reason. She saw straight through it.',
        },
      },
    ],
  },
  {
    id: 'rom-rumor',
    category: 'romance',
    title: 'A rumour about you',
    prompt: 'A rumour is going round about you and somebody else. It is not true.',
    weight: 7,
    conditions: { requireActive: ['girlfriend'] },
    choices: [
      {
        label: 'Tell her first, before she hears it',
        effects: {
          relationships: { girlfriend: 12 },
          offCourt: 5,
          outcome: 'You got to her before the rumour did. That was the whole thing.',
        },
      },
      {
        label: 'Hope it dies down',
        effects: {
          relationships: { girlfriend: -14 },
          outcome: 'It did not die down. She heard it from somebody else.',
        },
      },
    ],
  },

  // ======================================================================
  // VIRAL MOMENTS
  // ======================================================================
  {
    id: 'viral-dunk',
    category: 'viral',
    title: 'You put somebody on a poster',
    prompt: 'You just dunked on a kid in front of three phones and a packed gym.',
    weight: 9,
    conditions: { minAge: 15 },
    choices: [
      {
        label: 'Celebrate — sell it',
        effects: {
          hype: 12,
          onCourt: 4,
          offCourt: -4,
          confidence: 8,
          outcome: 'You sold the celebration. The clip did three million views.',
        },
      },
      {
        label: 'Run back on defense',
        effects: {
          hype: 5,
          onCourt: 8,
          coachTrust: 6,
          offCourt: 5,
          outcome: 'You ran straight back. The clip still travelled, and coaches noticed the run-back.',
        },
      },
    ],
  },
  {
    id: 'viral-buzzer',
    category: 'viral',
    title: 'The shot went in',
    prompt: 'Down two, three seconds, you took it from twenty-eight feet and it went in.',
    weight: 7,
    conditions: { minGrade: 9 },
    choices: [
      {
        label: 'Let the moment happen',
        effects: {
          hype: 14,
          confidence: 14,
          onCourt: 8,
          attributes: { composure: 1.5 },
          outcome: 'The gym came apart. You will see that clip for years.',
        },
      },
    ],
  },
  {
    id: 'viral-getting-cooked',
    category: 'viral',
    title: 'You are the other guy in the clip',
    prompt: 'Somebody crossed you up badly and the video has your jersey number in the caption.',
    weight: 8,
    conditions: { minHype: 25 },
    choices: [
      {
        label: 'Repost it yourself',
        effects: {
          offCourt: 8,
          hype: 4,
          attributes: { composure: 2 },
          confidence: 3,
          outcome: 'You reposted it with a joke. Everyone moved on immediately.',
        },
      },
      {
        label: 'Say nothing and seethe',
        effects: {
          confidence: -8,
          attributes: { perimeterDefense: 1.2, motor: 0.8 },
          outcome: 'You said nothing and spent a month on your slides.',
        },
      },
    ],
  },
  {
    id: 'viral-argument-clip',
    category: 'viral',
    title: 'A clip of you arguing',
    prompt: 'Someone filmed you barking at a teammate on the bench. It is doing numbers for the wrong reasons.',
    weight: 8,
    conditions: { minHype: 35 },
    choices: [
      {
        label: 'Apologise publicly to him',
        effects: {
          offCourt: 9,
          onCourt: 3,
          relationships: { friends: 8 },
          outcome: 'You apologised publicly and specifically. It landed well.',
        },
      },
      {
        label: 'Say it was competitive fire',
        effects: {
          offCourt: -6,
          onCourt: 2,
          outcome: 'You called it competitive fire. Half of them bought it.',
        },
      },
    ],
  },
  {
    id: 'viral-workout-clip',
    category: 'viral',
    title: 'A trainer wants to post your workout',
    prompt: 'A trainer with a big following wants to post a session with you in it.',
    weight: 7,
    conditions: { minAge: 15 },
    choices: [
      {
        label: 'Do it',
        effects: {
          hype: 8,
          energy: -6,
          outcome: 'The workout clip travelled further than any of your game film.',
        },
      },
      {
        label: 'Pass — you would rather be seen in games',
        effects: {
          onCourt: 4,
          hype: -1,
          outcome: 'You passed. Game film or nothing.',
        },
      },
    ],
  },
  {
    id: 'viral-rival-clip',
    category: 'viral',
    title: 'He said your name',
    prompt:
      'The kid ranked just above you was asked who the most overrated player in the class is, and he said yours.',
    weight: 10,
    conditions: { minHype: 40, minGrade: 10 },
    choices: [
      {
        label: 'Answer on the court',
        effects: {
          attributes: { motor: 2, composure: 1 },
          onCourt: 5,
          setFlags: ['rivalry_lit'],
          outcome: 'You did not respond publicly. You circled the date instead.',
        },
      },
      {
        label: 'Answer him publicly',
        effects: {
          hype: 10,
          offCourt: -6,
          setFlags: ['rivalry_lit'],
          outcome: 'You answered him publicly. Now everybody is waiting for the game.',
        },
      },
    ],
  },

  // ======================================================================
  // CHARACTER TESTS
  // ======================================================================
  {
    id: 'char-ref-call',
    category: 'character',
    title: 'That was a terrible call',
    prompt: 'The referee just made a genuinely awful call in a one-possession game and he knows it.',
    weight: 9,
    choices: [
      {
        label: 'Say nothing',
        effects: {
          attributes: { composure: 1.8 },
          coachTrust: 4,
          offCourt: 4,
          outcome: 'You said nothing and got back on defense.',
        },
      },
      {
        label: 'Let him hear it',
        effects: {
          onCourt: 2,
          coachTrust: -6,
          offCourt: -6,
          attributes: { composure: -1 },
          outcome: 'You let him hear it. Technical, and the run was over.',
        },
      },
    ],
  },
  {
    id: 'char-stat-padding',
    category: 'character',
    title: 'Up thirty with a minute left',
    prompt: 'You are four rebounds from a triple-double and the game has been over for ten minutes.',
    weight: 8,
    conditions: { minGrade: 10 },
    choices: [
      {
        label: 'Ask to come out',
        effects: {
          coachTrust: 10,
          offCourt: 8,
          onCourt: 6,
          hype: -3,
          outcome: 'You asked out. Coach told that story to every visiting staff.',
        },
      },
      {
        label: 'Chase it',
        effects: {
          hype: 6,
          onCourt: -6,
          coachTrust: -6,
          outcome: 'You chased the numbers. The other bench noticed.',
        },
      },
    ],
  },
  {
    id: 'char-younger-kid-autograph',
    category: 'character',
    title: 'A kid with a marker',
    prompt:
      'A nine-year-old has been waiting outside the locker room for forty minutes with a ball and a marker.',
    weight: 7,
    conditions: { minHype: 35 },
    choices: [
      {
        label: 'Stay as long as it takes',
        effects: {
          offCourt: 9,
          energy: -3,
          confidence: 5,
          outcome: 'You signed everything and took the photo. He will remember it forever.',
        },
      },
      {
        label: 'Wave and keep walking',
        effects: {
          offCourt: -7,
          energy: 2,
          outcome: 'You waved and kept moving. He watched you go.',
        },
      },
    ],
  },
  {
    id: 'char-teammate-credit',
    category: 'character',
    title: 'They gave you the credit',
    prompt:
      'The write-up says you won the game. It was your teammate’s three and his stop that actually did it.',
    weight: 7,
    choices: [
      {
        label: 'Correct the record',
        effects: {
          onCourt: 8,
          offCourt: 6,
          relationships: { friends: 10 },
          hype: -2,
          outcome: 'You publicly corrected it. The locker room noticed.',
        },
      },
      {
        label: 'Take the headline',
        effects: {
          hype: 4,
          onCourt: -5,
          relationships: { friends: -8 },
          outcome: 'You took the headline. So did he, silently.',
        },
      },
    ],
  },
  {
    id: 'char-lesser-opponent',
    category: 'character',
    title: 'A team with no chance',
    prompt: 'You are playing a school with 300 students and one player over six foot.',
    weight: 6,
    choices: [
      {
        label: 'Play it straight and shake hands',
        effects: {
          offCourt: 6,
          attributes: { leadership: 0.8 },
          outcome: 'You played it straight and shook every hand afterwards.',
        },
      },
      {
        label: 'Hunt highlights',
        effects: {
          hype: 6,
          offCourt: -8,
          outcome: 'You hunted highlights against a team that could not stop you.',
        },
      },
    ],
  },
  {
    id: 'char-quit-moment',
    category: 'character',
    title: 'You thought about stopping',
    prompt:
      'You are hurt, buried on the bench, your grades are shaky, and for the first time you genuinely thought about quitting.',
    weight: 9,
    conditions: { maxCoachTrust: 35, minGrade: 10 },
    choices: [
      {
        label: 'Tell somebody',
        effects: {
          relationships: { parents: 12, hsCoach: 8 },
          confidence: 8,
          attributes: { composure: 1.5 },
          outcome: 'You told somebody how bad it had got. It helped more than you expected.',
        },
      },
      {
        label: 'Keep it to yourself',
        effects: {
          confidence: -10,
          attributes: { motor: 1 },
          outcome: 'You kept it to yourself and kept showing up.',
        },
      },
    ],
  },
  {
    id: 'char-fight-fallout',
    category: 'character',
    title: 'The video of the fight',
    prompt:
      'The practice fight is on the internet. Two programs have called your coach asking what happened.',
    weight: 13,
    once: true,
    conditions: { requireFlags: ['fought_teammate'], minGrade: 11 },
    choices: [
      {
        label: 'Apologise to him and to the team',
        effects: {
          offCourt: 12,
          coachTrust: 8,
          clearFlags: ['fought_teammate'],
          outcome: 'You apologised in front of everybody. It mostly went away.',
        },
      },
      {
        label: 'Refuse to apologise',
        effects: {
          offCourt: -14,
          coachTrust: -10,
          outcome: 'You would not apologise. It followed you into the spring.',
        },
      },
    ],
  },
  {
    id: 'char-recruit-honesty',
    category: 'character',
    title: 'They asked you directly',
    prompt:
      'A head coach asks, face to face, whether you are seriously considering them or using them as leverage.',
    weight: 10,
    conditions: { hasOffer: true, minGrade: 11 },
    choices: [
      {
        label: 'Tell him the truth',
        effects: {
          offCourt: 10,
          attributes: { composure: 1 },
          outcome: 'You told him exactly where he stood. He thanked you for it.',
        },
      },
      {
        label: 'Keep him warm',
        effects: {
          offCourt: -8,
          hype: 2,
          outcome: 'You kept him on the hook. It bought you options and cost you something.',
        },
      },
    ],
  },
  {
    id: 'char-blame',
    category: 'character',
    title: 'Somebody has to answer for it',
    prompt:
      'You lost a game you should have won, and a reporter is asking what went wrong. The obvious answer is your teammate’s two turnovers.',
    weight: 8,
    conditions: { minGrade: 10 },
    choices: [
      {
        label: 'Take it on yourself',
        effects: {
          onCourt: 7,
          offCourt: 8,
          relationships: { friends: 12 },
          attributes: { leadership: 1.8 },
          outcome: 'You took it on yourself in front of a microphone. The team saw that.',
        },
      },
      {
        label: 'Tell the truth about the turnovers',
        effects: {
          onCourt: -4,
          relationships: { friends: -14 },
          outcome: 'You told the truth. Accurate, and expensive.',
        },
      },
    ],
  },
  {
    id: 'char-flameout',
    category: 'character',
    title: 'It has all caught up',
    prompt:
      'The money, the photos, the fight, the denials. A story is running tomorrow with all of it in one place, and your coach cannot help you this time.',
    weight: 30,
    once: true,
    conditions: { maxOffCourt: 12, minGrade: 11 },
    choices: [
      {
        label: 'Own all of it publicly',
        effects: {
          offCourt: 22,
          hype: -12,
          coachTrust: -6,
          outcome: 'You owned every bit of it publicly. Brutal week. It stopped the bleeding.',
        },
      },
      {
        label: 'Blame everyone else',
        effects: {
          endsCareer: {
            reason: 'Off-court flameout',
            detail:
              'The story ran with your name on it and nothing left to balance it. Every program pulled. Nobody would take the call.',
          },
          outcome: 'You blamed everyone but yourself. Every program pulled inside a week.',
        },
      },
    ],
  },
];
