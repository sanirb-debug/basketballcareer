/**
 * Second person → first person, for the life feed.
 *
 * The whole game reads back as a diary — "I grew 0.1 inches", "I averaged 2.5
 * a night" — rather than as a report addressed to the player. That is the
 * single biggest thing separating a life sim from a management screen.
 *
 * This runs at the *display* layer rather than in the engine. Three reasons:
 * the 274 event outcomes and ~60 engine notes stay written in one voice and
 * one place; saves written by earlier builds render correctly with no
 * migration; and the transform is one small function with one test rather
 * than a diff across every catalogue file.
 *
 * It is reliable because of a quirk of English: first and second person share
 * every verb form except *to be*. "You ran" → "I ran", "You know" → "I know",
 * "You told him" → "I told him" all work by swapping the pronoun alone. Only
 * are/were and the contractions need special handling, and there is a fixed
 * number of those.
 *
 * The genuinely ambiguous case is object `you` — "coaches notice you" has to
 * become "me", not "I". That is handled by position: a `you` that ends a
 * clause, or follows a preposition, is an object.
 */

/** Prepositions after which `you` is unambiguously an object. */
const PREPOSITIONS =
  'to|for|at|with|on|about|behind|around|of|than|like|beside|near|from|by|off|onto|against|toward|towards|before|after|beneath|under|over|into|past|through|without|between|among|upon';

interface Rule {
  pattern: RegExp;
  replace: string | ((...args: string[]) => string);
}

/**
 * Order is load-bearing. Possessives and contractions have to be consumed
 * before the bare-pronoun rules, and the object cases before the subject
 * fallback.
 */
const RULES: Rule[] = [
  // --- Possessives and reflexives (longest first) ------------------------
  { pattern: /\bYourselves\b/g, replace: 'Ourselves' },
  { pattern: /\byourselves\b/g, replace: 'ourselves' },
  { pattern: /\bYourself\b/g, replace: 'Myself' },
  { pattern: /\byourself\b/g, replace: 'myself' },
  { pattern: /\bYours\b/g, replace: 'Mine' },
  { pattern: /\byours\b/g, replace: 'mine' },
  { pattern: /\bYour\b/g, replace: 'My' },
  { pattern: /\byour\b/g, replace: 'my' },

  // --- Contractions -------------------------------------------------------
  { pattern: /\bYou're\b/g, replace: "I'm" },
  { pattern: /\byou're\b/g, replace: "I'm" },
  { pattern: /\bYou’re\b/g, replace: 'I’m' },
  { pattern: /\byou’re\b/g, replace: 'I’m' },
  { pattern: /\bYou've\b/g, replace: "I've" },
  { pattern: /\byou've\b/g, replace: "I've" },
  { pattern: /\bYou’ve\b/g, replace: 'I’ve' },
  { pattern: /\byou’ve\b/g, replace: 'I’ve' },
  { pattern: /\bYou'll\b/g, replace: "I'll" },
  { pattern: /\byou'll\b/g, replace: "I'll" },
  { pattern: /\bYou’ll\b/g, replace: 'I’ll' },
  { pattern: /\byou’ll\b/g, replace: 'I’ll' },
  { pattern: /\bYou'd\b/g, replace: "I'd" },
  { pattern: /\byou'd\b/g, replace: "I'd" },
  { pattern: /\bYou’d\b/g, replace: 'I’d' },
  { pattern: /\byou’d\b/g, replace: 'I’d' },

  // --- Plural you ---------------------------------------------------------
  // Has to run before the to-be rules: "both of you were sent home" is
  // "both of us were sent home", and letting `you were → I was` fire first
  // strands the quantifier on a singular pronoun.
  {
    pattern:
      /\b(both|all|each|either|neither|one|some|many|none|two|three|most|any) of you\b/gi,
    replace: (_m: string, q: string) => `${q} of us`,
  },

  // --- To be, the only verb that actually conjugates differently ---------
  { pattern: /\bYou are\b/g, replace: 'I am' },
  { pattern: /\byou are\b/g, replace: 'I am' },
  { pattern: /\bYou were\b/g, replace: 'I was' },
  { pattern: /\byou were\b/g, replace: 'I was' },
  { pattern: /\bYou aren't\b/g, replace: "I'm not" },
  { pattern: /\byou aren't\b/g, replace: "I'm not" },
  { pattern: /\bYou weren't\b/g, replace: "I wasn't" },
  { pattern: /\byou weren't\b/g, replace: "I wasn't" },

];


/**
 * Small set of phrases the mechanical rules get wrong, fixed after the fact.
 *
 * Kept deliberately short — every entry here is a rule that did not
 * generalise, and a long list would mean the rules above are wrong.
 */
const REPAIRS: [RegExp, string][] = [
  // "I am" starting a sentence that was an imperative aimed at the player.
  [/\bI am not old enough\b/g, 'I was not old enough'],
  // Double capitals from a sentence-initial object rule.
  [/(^|[.!?]\s+)Me\b/g, '$1I'],
  // "as far as I can" reads better than the mechanical "as far as me".
  [/\bas far as me\b/g, 'as far as I can'],
];

/**
 * Words after which a bare `you` is reading as a subject rather than an
 * object: sentence connectors and subordinators.
 */
const SUBORDINATORS = new Set(
  ('and but so if when because while that what which who whom whose unless ' +
    'though although as until since whether once where how why then or nor ' +
    'yet maybe perhaps now suddenly still already also')
    .split(' '),
);

/** Prepositions. A `you` straight after one of these can only be an object. */
const PREP_SET = new Set(PREPOSITIONS.split('|'));

/**
 * Prepositions that are also conjunctions, so they decide nothing on their
 * own: "wider than you hoped" is a subject, "taller than you" is an object.
 * These fall through to the following-word check instead.
 */
const AMBIGUOUS_PREPS = new Set(['than', 'like', 'of', 'as', 'before', 'after']);

/**
 * Verbs after which `you` is the object, even when another verb follows it.
 *
 * English perception and causative constructions — "saw you play", "watched
 * you go", "let you back in" — put the pronoun in the object case even though
 * it is doing the second verb. Without this the following-word check reads
 * that second verb and guesses subject.
 */
const OBJECT_PRECEDERS = new Set(
  ('saw see seen watch watched watching hear heard hearing let lets letting ' +
    'made make makes making help helped helps had has have got gets getting ' +
    'want wants wanted need needs needed tell tells telling told ask asks ' +
    'asked give gives giving gave beat beats paid pay pays owe owes owed ' +
    'notice notices noticed call calls calling called sent send bring ' +
    'brought put keep kept leave leaves leaving left found find finds ' +
    'took take takes taking picked pick')
    .split(' '),
);

/**
 * Words that, following a `you`, mark it as the subject of a clause — the
 * auxiliaries and adverbs that only ever precede a verb.
 */
const SUBJECT_FOLLOWERS = new Set(
  ('will would can could should must might may have had has do did does ' +
    'never always still just already only probably barely hardly nearly ' +
    'apparently obviously clearly finally almost ' +
    // Common bare verbs, for the cases the auxiliaries do not cover.
    'know knew think thought say said want need play go went get got see saw ' +
    'win won lose lost stay leave left come came make made take took keep ' +
    'run ran sit sat put hear heard feel felt')
    .split(' '),
);

/**
 * Decide whether one occurrence of `you` is a subject or an object.
 *
 * Position does the work: what comes immediately before it, and — when that
 * is inconclusive — what comes immediately after.
 */
function isSubject(full: string, offset: number): boolean {
  const before = full.slice(0, offset).replace(/\s+$/, '');

  // Start of the string, or the start of a new sentence or clause.
  if (before === '') return true;
  if (/[.!?;:]["'’”)]?$/.test(before)) return true;
  if (/[—–]$/.test(before)) return true;
  if (/[,(]$/.test(before)) return true;

  const prev = (before.match(/([A-Za-z’']+)$/) ?? [])[1]?.toLowerCase();
  if (prev && SUBORDINATORS.has(prev)) return true;

  if (prev && PREP_SET.has(prev) && !AMBIGUOUS_PREPS.has(prev)) return false;
  if (prev && OBJECT_PRECEDERS.has(prev)) return false;

  // Inconclusive: a following auxiliary, adverb or verb means this `you` is
  // doing something rather than having something done to it.
  const after = full.slice(offset + 3).replace(/^\s+/, '');
  const next = (after.match(/^([A-Za-z’']+)/) ?? [])[1]?.toLowerCase();
  if (next && SUBJECT_FOLLOWERS.has(next)) return true;
  // A bare past-tense verb is the commonest case the lists miss.
  if (next && /ed$/.test(next) && next.length > 3) return true;

  // Anything left is the object of whatever verb came before it.
  return false;
}

export function toFirstPerson(text: string): string {
  let out = text;
  for (const rule of RULES) {
    out =
      typeof rule.replace === 'string'
        ? out.replace(rule.pattern, rule.replace)
        : out.replace(rule.pattern, rule.replace as (...a: string[]) => string);
  }

  out = out.replace(/\b(You|you)\b/g, (match, _c: string, offset: number) => {
    if (isSubject(out, offset)) return 'I';
    return match === 'You' ? 'Me' : 'me';
  });

  for (const [pattern, replacement] of REPAIRS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Nothing in the feed should still be addressing the player. */
export function hasSecondPerson(text: string): boolean {
  return /\b(you|your|yours|yourself|yourselves|you're|you’re|you've|you’ve|you'll|you’ll|you'd|you’d)\b/i.test(
    text,
  );
}
