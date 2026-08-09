/**
 * Where you are from (SPEC §4).
 *
 * Nationality is not decoration here — it is the single biggest variable in
 * how hard the climb is, and the game says so out loud. A guard in Indiana is
 * seen by fifty college coaches before he turns sixteen. A guard in Kathmandu
 * is seen by none of them, and everything he gets he has to go and find.
 *
 * Three fields do the work:
 *
 * - `exposure` scales how much of what you do is *noticed*. It is brutal for
 *   most of the world and that is the point (SPEC §7's whole argument is that
 *   hype and skill are different numbers).
 * - `pipeline` is how established the road out is — academies, national team
 *   programmes, scouts who already have the country on a list. It softens the
 *   exposure penalty for places that have built something.
 * - `nbaPlayersEver` is the game world's count of how many players born there
 *   have ever reached the league. It is what makes a milestone a *headline*:
 *   at zero, everything you do is the first time anyone from your country has
 *   done it.
 *
 * The counts are this game's history, tuned so the milestone system has range
 * — a deep basketball nation should not be handing out "first ever" headlines.
 * They are not a sourced real-world dataset and are not presented as one.
 */

export interface Country {
  id: string;
  name: string;
  /** "Nepalese", "French" — what the headline calls you. */
  demonym: string;
  flag: string;
  /** How much of what you do gets seen. 1.0 is a strong American state. */
  exposure: number;
  /** How built-out the road to professional basketball is, 0–1. */
  pipeline: number;
  /** How many players born here have ever reached the league, in this world. */
  nbaPlayersEver: number;
  /** The domestic league, for the overseas route. */
  league?: string;
}

/**
 * Ordered so the deep basketball nations come first and the long tail is
 * alphabetical after that — the creation screen renders it in this order.
 */
export const COUNTRIES: Country[] = [
  { id: 'usa', name: 'United States', demonym: 'American', flag: '🇺🇸', exposure: 1, pipeline: 1, nbaPlayersEver: 4200, league: 'the NBA' },
  { id: 'canada', name: 'Canada', demonym: 'Canadian', flag: '🇨🇦', exposure: 0.72, pipeline: 0.86, nbaPlayersEver: 62, league: 'the CEBL' },
  { id: 'france', name: 'France', demonym: 'French', flag: '🇫🇷', exposure: 0.55, pipeline: 0.9, nbaPlayersEver: 38, league: 'the LNB Pro A' },
  { id: 'serbia', name: 'Serbia', demonym: 'Serbian', flag: '🇷🇸', exposure: 0.5, pipeline: 0.92, nbaPlayersEver: 34, league: 'the KLS' },
  { id: 'australia', name: 'Australia', demonym: 'Australian', flag: '🇦🇺', exposure: 0.52, pipeline: 0.88, nbaPlayersEver: 41, league: 'the NBL' },
  { id: 'spain', name: 'Spain', demonym: 'Spanish', flag: '🇪🇸', exposure: 0.52, pipeline: 0.9, nbaPlayersEver: 29, league: 'the Liga ACB' },
  { id: 'nigeria', name: 'Nigeria', demonym: 'Nigerian', flag: '🇳🇬', exposure: 0.3, pipeline: 0.55, nbaPlayersEver: 26, league: 'the BAL' },
  { id: 'germany', name: 'Germany', demonym: 'German', flag: '🇩🇪', exposure: 0.48, pipeline: 0.84, nbaPlayersEver: 24, league: 'the BBL' },
  { id: 'lithuania', name: 'Lithuania', demonym: 'Lithuanian', flag: '🇱🇹', exposure: 0.42, pipeline: 0.9, nbaPlayersEver: 21, league: 'the LKL' },
  { id: 'brazil', name: 'Brazil', demonym: 'Brazilian', flag: '🇧🇷', exposure: 0.42, pipeline: 0.7, nbaPlayersEver: 22, league: 'the NBB' },
  { id: 'england', name: 'England', demonym: 'English', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', exposure: 0.4, pipeline: 0.6, nbaPlayersEver: 14, league: 'the BBL' },
  { id: 'greece', name: 'Greece', demonym: 'Greek', flag: '🇬🇷', exposure: 0.42, pipeline: 0.85, nbaPlayersEver: 17, league: 'the GBL' },
  { id: 'croatia', name: 'Croatia', demonym: 'Croatian', flag: '🇭🇷', exposure: 0.4, pipeline: 0.88, nbaPlayersEver: 20, league: 'the HT Premijer' },
  { id: 'slovenia', name: 'Slovenia', demonym: 'Slovenian', flag: '🇸🇮', exposure: 0.38, pipeline: 0.86, nbaPlayersEver: 12, league: 'the Liga Nova KBM' },
  { id: 'argentina', name: 'Argentina', demonym: 'Argentine', flag: '🇦🇷', exposure: 0.4, pipeline: 0.75, nbaPlayersEver: 13, league: 'the Liga Nacional' },
  { id: 'italy', name: 'Italy', demonym: 'Italian', flag: '🇮🇹', exposure: 0.44, pipeline: 0.82, nbaPlayersEver: 15, league: 'the LBA' },
  { id: 'turkey', name: 'Türkiye', demonym: 'Turkish', flag: '🇹🇷', exposure: 0.4, pipeline: 0.82, nbaPlayersEver: 14, league: 'the BSL' },
  { id: 'senegal', name: 'Senegal', demonym: 'Senegalese', flag: '🇸🇳', exposure: 0.26, pipeline: 0.6, nbaPlayersEver: 11, league: 'the BAL' },
  { id: 'cameroon', name: 'Cameroon', demonym: 'Cameroonian', flag: '🇨🇲', exposure: 0.24, pipeline: 0.52, nbaPlayersEver: 9, league: 'the BAL' },
  { id: 'drc', name: 'DR Congo', demonym: 'Congolese', flag: '🇨🇩', exposure: 0.2, pipeline: 0.42, nbaPlayersEver: 7, league: 'the BAL' },
  { id: 'dominican', name: 'Dominican Republic', demonym: 'Dominican', flag: '🇩🇴', exposure: 0.3, pipeline: 0.6, nbaPlayersEver: 8, league: 'the LNB' },
  { id: 'puertorico', name: 'Puerto Rico', demonym: 'Puerto Rican', flag: '🇵🇷', exposure: 0.38, pipeline: 0.72, nbaPlayersEver: 10, league: 'the BSN' },
  { id: 'mexico', name: 'Mexico', demonym: 'Mexican', flag: '🇲🇽', exposure: 0.3, pipeline: 0.55, nbaPlayersEver: 6, league: 'the LNBP' },
  { id: 'georgia-country', name: 'Georgia', demonym: 'Georgian', flag: '🇬🇪', exposure: 0.3, pipeline: 0.7, nbaPlayersEver: 5, league: 'the Superliga' },
  { id: 'latvia', name: 'Latvia', demonym: 'Latvian', flag: '🇱🇻', exposure: 0.32, pipeline: 0.8, nbaPlayersEver: 6, league: 'the LBL' },
  { id: 'ukraine', name: 'Ukraine', demonym: 'Ukrainian', flag: '🇺🇦', exposure: 0.3, pipeline: 0.68, nbaPlayersEver: 6, league: 'the Superleague' },
  { id: 'israel', name: 'Israel', demonym: 'Israeli', flag: '🇮🇱', exposure: 0.34, pipeline: 0.75, nbaPlayersEver: 5, league: 'the Ligat HaAl' },
  { id: 'japan', name: 'Japan', demonym: 'Japanese', flag: '🇯🇵', exposure: 0.34, pipeline: 0.6, nbaPlayersEver: 4, league: 'the B.League' },
  { id: 'china', name: 'China', demonym: 'Chinese', flag: '🇨🇳', exposure: 0.36, pipeline: 0.62, nbaPlayersEver: 7, league: 'the CBA' },
  { id: 'philippines', name: 'Philippines', demonym: 'Filipino', flag: '🇵🇭', exposure: 0.28, pipeline: 0.5, nbaPlayersEver: 2, league: 'the PBA' },
  { id: 'newzealand', name: 'New Zealand', demonym: 'New Zealander', flag: '🇳🇿', exposure: 0.32, pipeline: 0.6, nbaPlayersEver: 4, league: 'the NBL' },
  { id: 'southsudan', name: 'South Sudan', demonym: 'South Sudanese', flag: '🇸🇸', exposure: 0.16, pipeline: 0.34, nbaPlayersEver: 5, league: 'the BAL' },
  { id: 'sudan', name: 'Sudan', demonym: 'Sudanese', flag: '🇸🇩', exposure: 0.14, pipeline: 0.28, nbaPlayersEver: 3 },
  { id: 'angola', name: 'Angola', demonym: 'Angolan', flag: '🇦🇴', exposure: 0.18, pipeline: 0.45, nbaPlayersEver: 2, league: 'the BAL' },
  { id: 'jamaica', name: 'Jamaica', demonym: 'Jamaican', flag: '🇯🇲', exposure: 0.24, pipeline: 0.42, nbaPlayersEver: 3 },
  { id: 'ireland', name: 'Ireland', demonym: 'Irish', flag: '🇮🇪', exposure: 0.24, pipeline: 0.4, nbaPlayersEver: 1, league: 'the Super League' },
  { id: 'scotland', name: 'Scotland', demonym: 'Scottish', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', exposure: 0.24, pipeline: 0.4, nbaPlayersEver: 1 },
  { id: 'netherlands', name: 'Netherlands', demonym: 'Dutch', flag: '🇳🇱', exposure: 0.3, pipeline: 0.6, nbaPlayersEver: 3, league: 'the DBL' },
  { id: 'sweden', name: 'Sweden', demonym: 'Swedish', flag: '🇸🇪', exposure: 0.28, pipeline: 0.6, nbaPlayersEver: 3, league: 'the Basketligan' },
  { id: 'poland', name: 'Poland', demonym: 'Polish', flag: '🇵🇱', exposure: 0.3, pipeline: 0.68, nbaPlayersEver: 4, league: 'the PLK' },
  { id: 'egypt', name: 'Egypt', demonym: 'Egyptian', flag: '🇪🇬', exposure: 0.2, pipeline: 0.44, nbaPlayersEver: 2, league: 'the BAL' },
  { id: 'southafrica', name: 'South Africa', demonym: 'South African', flag: '🇿🇦', exposure: 0.22, pipeline: 0.42, nbaPlayersEver: 1, league: 'the BAL' },
  { id: 'kenya', name: 'Kenya', demonym: 'Kenyan', flag: '🇰🇪', exposure: 0.16, pipeline: 0.32, nbaPlayersEver: 0, league: 'the BAL' },
  { id: 'ghana', name: 'Ghana', demonym: 'Ghanaian', flag: '🇬🇭', exposure: 0.18, pipeline: 0.36, nbaPlayersEver: 0, league: 'the BAL' },
  { id: 'india', name: 'India', demonym: 'Indian', flag: '🇮🇳', exposure: 0.18, pipeline: 0.34, nbaPlayersEver: 0, league: 'the UBA' },
  { id: 'pakistan', name: 'Pakistan', demonym: 'Pakistani', flag: '🇵🇰', exposure: 0.12, pipeline: 0.22, nbaPlayersEver: 0 },
  { id: 'bangladesh', name: 'Bangladesh', demonym: 'Bangladeshi', flag: '🇧🇩', exposure: 0.1, pipeline: 0.18, nbaPlayersEver: 0 },
  { id: 'srilanka', name: 'Sri Lanka', demonym: 'Sri Lankan', flag: '🇱🇰', exposure: 0.1, pipeline: 0.18, nbaPlayersEver: 0 },
  { id: 'nepal', name: 'Nepal', demonym: 'Nepalese', flag: '🇳🇵', exposure: 0.08, pipeline: 0.15, nbaPlayersEver: 0 },
  { id: 'bhutan', name: 'Bhutan', demonym: 'Bhutanese', flag: '🇧🇹', exposure: 0.07, pipeline: 0.12, nbaPlayersEver: 0 },
  { id: 'mongolia', name: 'Mongolia', demonym: 'Mongolian', flag: '🇲🇳', exposure: 0.1, pipeline: 0.2, nbaPlayersEver: 0 },
  { id: 'indonesia', name: 'Indonesia', demonym: 'Indonesian', flag: '🇮🇩', exposure: 0.16, pipeline: 0.3, nbaPlayersEver: 0, league: 'the IBL' },
  { id: 'vietnam', name: 'Vietnam', demonym: 'Vietnamese', flag: '🇻🇳', exposure: 0.14, pipeline: 0.26, nbaPlayersEver: 0, league: 'the VBA' },
  { id: 'thailand', name: 'Thailand', demonym: 'Thai', flag: '🇹🇭', exposure: 0.16, pipeline: 0.3, nbaPlayersEver: 0, league: 'the TBL' },
  { id: 'southkorea', name: 'South Korea', demonym: 'South Korean', flag: '🇰🇷', exposure: 0.28, pipeline: 0.55, nbaPlayersEver: 1, league: 'the KBL' },
  { id: 'iran', name: 'Iran', demonym: 'Iranian', flag: '🇮🇷', exposure: 0.22, pipeline: 0.5, nbaPlayersEver: 2, league: 'the IBSL' },
  { id: 'morocco', name: 'Morocco', demonym: 'Moroccan', flag: '🇲🇦', exposure: 0.16, pipeline: 0.3, nbaPlayersEver: 0, league: 'the BAL' },
  { id: 'colombia', name: 'Colombia', demonym: 'Colombian', flag: '🇨🇴', exposure: 0.22, pipeline: 0.42, nbaPlayersEver: 1, league: 'the LBP' },
  { id: 'venezuela', name: 'Venezuela', demonym: 'Venezuelan', flag: '🇻🇪', exposure: 0.24, pipeline: 0.5, nbaPlayersEver: 2, league: 'the SPB' },
  { id: 'haiti', name: 'Haiti', demonym: 'Haitian', flag: '🇭🇹', exposure: 0.16, pipeline: 0.3, nbaPlayersEver: 1 },
  { id: 'iceland', name: 'Iceland', demonym: 'Icelandic', flag: '🇮🇸', exposure: 0.2, pipeline: 0.5, nbaPlayersEver: 0, league: 'the Úrvalsdeild' },
  { id: 'norway', name: 'Norway', demonym: 'Norwegian', flag: '🇳🇴', exposure: 0.24, pipeline: 0.5, nbaPlayersEver: 0, league: 'the BLNO' },
  { id: 'portugal', name: 'Portugal', demonym: 'Portuguese', flag: '🇵🇹', exposure: 0.26, pipeline: 0.55, nbaPlayersEver: 1, league: 'the LPB' },
  { id: 'fiji', name: 'Fiji', demonym: 'Fijian', flag: '🇫🇯', exposure: 0.08, pipeline: 0.14, nbaPlayersEver: 0 },
];

export const DEFAULT_COUNTRY = 'usa';

export function countryById(id: string): Country {
  return COUNTRIES.find((c) => c.id === id) ?? COUNTRIES[0];
}

export function isUSA(id: string): boolean {
  return id === 'usa';
}

/**
 * How much the world sees.
 *
 * `pipeline` is a floor rather than a bonus: a country with academies and a
 * national programme gets its players looked at even when the country itself
 * is not a basketball country. Without it, half this list would be
 * unplayable rather than hard.
 */
export function exposureForCountry(id: string): number {
  const country = countryById(id);
  const raw = Math.max(country.exposure, country.pipeline * 0.35);
  // Compressed onto a floor. Raw exposure spans 0.07–1.0, which sounds right
  // and plays wrong: at a twelfth of an American's visibility a Nepalese
  // career never gets a single offer, so the best story the game can tell
  // becomes unreachable. The floor keeps the gradient real — Nepal is still
  // a third of Indiana — while leaving the door open to somebody who goes
  // and finds the scouts.
  return EXPOSURE_FLOOR + (1 - EXPOSURE_FLOOR) * raw;
}

/**
 * The least visible a player can be, however remote the country.
 *
 * Measured at 0.18 over 45 careers per country on an engaged policy: an
 * American reaches the league in 39, a French player in 38, a Nepalese
 * player in 33. A real penalty that leaves the story reachable — picking a
 * hard country should be a choice about the story you want, not a vow of
 * masochism.
 */
export const EXPOSURE_FLOOR = 0.18;

// --- Milestones -----------------------------------------------------------

/**
 * The moments worth a headline (SPEC §7, §15).
 *
 * The point of tracking these is `nbaPlayersEver`: the same achievement is a
 * line in a local paper for an American and a national event for somebody
 * from a country that has never had one. The copy scales with that, and the
 * rarest version of it — being the first, ever — is the reason to pick a hard
 * country on purpose.
 */
export type MilestoneId =
  | 'first-offer'
  | 'signed-d1'
  | 'college-debut'
  | 'drafted'
  | 'nba-debut'
  | 'nba-starter'
  | 'all-star'
  | 'champion';

interface MilestoneDef {
  id: MilestoneId;
  /** What happened, in the player's own voice. */
  plain: (country: Country) => string;
  /** The version for a country that has never had one. */
  first: (country: Country) => string;
  /** The version for a country with only a handful. */
  rare: (country: Country) => string;
  /** Below this many prior players, the `first`/`rare` copy is used. */
  rareBelow: number;
}

const MILESTONES: MilestoneDef[] = [
  {
    id: 'first-offer',
    rareBelow: 4,
    plain: () => 'I got my first real offer.',
    first: (c) =>
      `I got my first offer. No one from ${c.name} had ever been offered a scholarship in the States before. My mother read the email four times.`,
    rare: (c) =>
      `I got my first offer — one of a handful of ${c.demonym} players ever to get one.`,
  },
  {
    id: 'signed-d1',
    rareBelow: 5,
    plain: () => 'I signed.',
    first: (c) =>
      `I signed. The first player from ${c.name} to sign with an American programme, and the news made it home before I did.`,
    rare: (c) =>
      `I signed. They are calling me the best ${c.demonym} prospect anybody can remember.`,
  },
  {
    id: 'college-debut',
    rareBelow: 4,
    plain: () => 'I played my first college game.',
    first: (c) =>
      `I played my first college game — the first player from ${c.name} ever to do it. Somebody in the stands had brought the flag.`,
    rare: (c) => `I played my first college game. The ${c.demonym} press noticed.`,
  },
  {
    id: 'drafted',
    rareBelow: 6,
    plain: () => 'I heard my name called at the draft.',
    first: (c) =>
      `I heard my name called. The first ${c.demonym} player ever drafted into the NBA. It was four in the morning in ${c.name} and people were in the street.`,
    rare: (c) =>
      `I heard my name called — one of the very few ${c.demonym} players ever drafted.`,
  },
  {
    id: 'nba-debut',
    rareBelow: 6,
    plain: () => 'I played my first NBA game.',
    first: (c) =>
      `I played my first NBA game. No one from ${c.name} had ever done it. Every television back home was on the same channel.`,
    rare: (c) =>
      `I played my first NBA game — the ${c.demonym} flag was up in the away section.`,
  },
  {
    id: 'nba-starter',
    rareBelow: 5,
    plain: () => 'I am a starter in this league now.',
    first: (c) =>
      `I am a starter in this league. The first ${c.demonym} player to be one, and there are kids in ${c.name} playing on courts that did not exist five years ago.`,
    rare: (c) =>
      `I am a starter in this league — something almost no ${c.demonym} player has ever been.`,
  },
  {
    id: 'all-star',
    rareBelow: 8,
    plain: () => 'I made the All-Star team.',
    first: (c) =>
      `I made the All-Star team. The first ${c.demonym} All-Star in the history of the league. They played the anthem and I did not get through it.`,
    rare: (c) => `I made the All-Star team — only a handful of ${c.demonym} players ever have.`,
  },
  {
    id: 'champion',
    rareBelow: 10,
    plain: () => 'I won the championship.',
    first: (c) =>
      `I won the championship. The first ${c.demonym} player to lift it, and the parade at home was bigger than the one here.`,
    rare: (c) => `I won the championship — a rare thing for a ${c.demonym} player.`,
  },
];

export function milestoneById(id: MilestoneId): MilestoneDef | undefined {
  return MILESTONES.find((m) => m.id === id);
}

/**
 * The line for a milestone, scaled to how unprecedented it is.
 *
 * The USA gets the plain version of everything, which is the joke: doing this
 * from Indiana is an achievement, and doing it from Kathmandu is history.
 */
export function milestoneHeadline(
  id: MilestoneId,
  countryId: string,
): string | null {
  const def = milestoneById(id);
  if (!def) return null;
  const country = countryById(countryId);

  if (country.nbaPlayersEver === 0) return def.first(country);
  if (country.nbaPlayersEver < def.rareBelow) return def.rare(country);
  return def.plain(country);
}

/** Whether this country would treat the milestone as national news. */
export function isHistoric(id: MilestoneId, countryId: string): boolean {
  const def = milestoneById(id);
  if (!def) return false;
  return countryById(countryId).nbaPlayersEver < def.rareBelow;
}

/**
 * Hype a historic milestone generates on its own.
 *
 * Being the first player from anywhere to do something is a story that writes
 * itself, and it is the one way a player from a low-exposure country can
 * catch up to an American with the same numbers.
 */
export function milestoneHype(id: MilestoneId, countryId: string): number {
  if (!isHistoric(id, countryId)) return 0;
  const country = countryById(countryId);
  const base = country.nbaPlayersEver === 0 ? 12 : 5;
  return id === 'drafted' || id === 'nba-debut' || id === 'all-star'
    ? base * 1.5
    : base;
}
