import { clamp, type Rng } from './rng';
import { POSITIONS, type Position, type Prospect, type RankedProspect } from './types';

/**
 * The living recruiting class (SPEC §11).
 *
 * ~400 other prospects progress on their own lightweight sim. The spec is
 * emphatic that this only works if it is a race rather than set dressing: the
 * board has to move whether or not the player does anything, some prospects
 * bust and some rise, and the player's rank is a *percentile among them*
 * rather than a number handed out for hitting thresholds.
 */

export const CLASS_SIZE = 400;

/** Where the rival starts relative to the player: better, but catchable. */
export const RIVAL_RANK_MIN = 10;
export const RIVAL_RANK_MAX = 20;

const FIRST_NAMES = [
  'Jalen', 'Marcus', 'DeAndre', 'Tyrese', 'Cam', 'Amari', 'Zion', 'Kai',
  'Malachi', 'Trey', 'Isaiah', 'Jaden', 'Quentin', 'Damari', 'Elijah',
  'Xavier', 'Cortez', 'Rashad', 'Brandon', 'Julius', 'Devin', 'Keon',
  'Terrance', 'Micah', 'Jerome', 'Antoine', 'Darius', 'Kendrick', 'Omar',
  'Silas', 'Bryce', 'Nasir', 'Landon', 'Emeka', 'Dominic', 'Rylan',
  'Josiah', 'Tariq', 'Colby', 'Ezra', 'Marquise', 'Donovan', 'Hakeem',
  'Luka', 'Bogdan', 'Mateo', 'Yusuf', 'Idris', 'Finn', 'Grant',
];

const LAST_NAMES = [
  'Whitfield', 'Carraway', 'Bledsoe', 'Ferrell', 'Okafor', 'Sampson',
  'Vaughn', 'Delgado', 'Mensah', 'Pritchard', 'Bassett', 'Ricks',
  'Lyle', 'Calhoun', 'Bannister', 'Ives', 'Marchetti', 'Oyelaran',
  'Steward', 'Hollins', 'Ferreira', 'Dunlap', 'Abara', 'Kessler',
  'Roundtree', 'Njoku', 'Winslow', 'Pettigrew', 'Salamone', 'Boateng',
  'Crowder', 'Achebe', 'Vandermeer', 'Trotter', 'Sowinski', 'Guillory',
  'Redmond', 'Ekwueme', 'Bautista', 'Halloran', 'Nwosu', 'Cardoza',
  'Landry', 'Stallworth', 'Ivory', 'Beaumont', 'Osei', 'Quintero',
];

const STATES = [
  'California', 'Texas', 'Florida', 'Georgia', 'Illinois', 'New York',
  'North Carolina', 'Ohio', 'Indiana', 'Pennsylvania', 'New Jersey',
  'Michigan', 'Maryland', 'Virginia', 'Tennessee', 'Missouri', 'Kentucky',
  'Kansas', 'Oregon', 'Iowa', 'Nebraska', 'Montana', 'Alaska',
];

/**
 * Composite that drives the board.
 *
 * Weighted toward hype rather than skill on purpose — SPEC §7 requires actual
 * overall and national ranking to be able to diverge, so that you can be a 90
 * overall ranked #180 because you play in Montana.
 */
export function rankingScore(rating: number, hype: number): number {
  return hype * 0.58 + rating * 0.42;
}

export function generateClass(rng: Rng): Prospect[] {
  const prospects: Prospect[] = [];

  for (let i = 0; i < CLASS_SIZE; i++) {
    // Talent is roughly normal; hype tracks it loosely, which is what creates
    // the underrated/overrated tails.
    const rating = clamp(rng.normal(52, 12), 25, 99);
    const hype = clamp(rating + rng.normal(0, 14), 5, 99);

    prospects.push({
      id: `p${i}`,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      position: rng.pick(POSITIONS) as Position,
      homeState: rng.pick(STATES) as string,
      rating,
      hype,
      // Most hold roughly steady; the tails are the ones who blow up or bust.
      trajectory: rng.normal(0, 0.42),
      isRival: false,
    });
  }

  return prospects;
}

/**
 * Pick the rival (SPEC §11): same class, ranked 10–20 spots above the player,
 * with his own hidden progression. Returns a new array with him flagged.
 */
export function designateRival(
  prospects: Prospect[],
  playerScore: number,
  rng: Rng,
): Prospect[] {
  const sorted = [...prospects].sort(
    (a, b) => rankingScore(b.rating, b.hype) - rankingScore(a.rating, a.hype),
  );

  // Where the player currently sits among them.
  let playerIndex = sorted.findIndex(
    (p) => rankingScore(p.rating, p.hype) < playerScore,
  );
  if (playerIndex < 0) playerIndex = sorted.length;

  const gap = rng.int(RIVAL_RANK_MIN, RIVAL_RANK_MAX);
  const rivalIndex = clamp(playerIndex - gap, 0, sorted.length - 1);
  const rivalId = (sorted[rivalIndex] as Prospect).id;

  // Give the rival a stronger arc than the field — he is meant to be a
  // persistent antagonist, not a name that quietly busts in year two.
  return prospects.map((p) =>
    p.id === rivalId
      ? { ...p, isRival: true, trajectory: Math.abs(p.trajectory) + 0.25 }
      : p,
  );
}

/**
 * Advance every prospect one month.
 *
 * Cheap by design — one RNG draw each. Hype chases rating with noise, so a
 * prospect who is quietly good drifts up the board over time and a hyped one
 * who stops producing slides back down.
 */
export function advanceClass(prospects: Prospect[], rng: Rng): Prospect[] {
  return prospects.map((p) => {
    const shock = rng.normal(0, 1);
    const rating = clamp(p.rating + p.trajectory * 0.35 + shock * 0.22, 25, 99);
    const hype = clamp(p.hype + (rating - p.hype) * 0.06 + shock * 1.15, 3, 99);
    return { ...p, rating, hype };
  });
}

export interface PlayerEntry {
  name: string;
  position: Position;
  homeState: string;
  rating: number;
  hype: number;
}

/**
 * Rank the player inside the class. The player is inserted into the same
 * sorted list as everyone else rather than scored against a fixed table.
 */
export function rankBoard(
  prospects: Prospect[],
  player: PlayerEntry,
): RankedProspect[] {
  const entries: RankedProspect[] = prospects.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    homeState: p.homeState,
    score: rankingScore(p.rating, p.hype),
    rank: 0,
    isPlayer: false,
    isRival: p.isRival,
  }));

  entries.push({
    id: 'player',
    name: player.name,
    position: player.position,
    homeState: player.homeState,
    score: rankingScore(player.rating, player.hype),
    rank: 0,
    isPlayer: true,
    isRival: false,
  });

  entries.sort((a, b) => b.score - a.score);
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });
  return entries;
}

export function playerRank(
  prospects: Prospect[],
  player: PlayerEntry,
): number {
  const score = rankingScore(player.rating, player.hype);
  // Rank is 1 + however many prospects are ahead — no need to sort the class.
  let ahead = 0;
  for (const p of prospects) {
    if (rankingScore(p.rating, p.hype) > score) ahead++;
  }
  return ahead + 1;
}

export function findRival(prospects: Prospect[]): Prospect | null {
  return prospects.find((p) => p.isRival) ?? null;
}

export function rivalRank(prospects: Prospect[], player: PlayerEntry): number {
  const rival = findRival(prospects);
  if (!rival) return 0;
  const score = rankingScore(rival.rating, rival.hype);
  const playerScore = rankingScore(player.rating, player.hype);

  let ahead = 0;
  for (const p of prospects) {
    if (p.id !== rival.id && rankingScore(p.rating, p.hype) > score) ahead++;
  }
  if (playerScore > score) ahead++;
  return ahead + 1;
}
