import { clamp, type Rng } from './rng';
import { DRAFT } from './draft';
import type {
  Award,
  Contract,
  ProRole,
  ProState,
  ProTeam,
} from './types';

/**
 * The professional league (SPEC §14).
 *
 * Thirty fictional franchises (SPEC §19 rules out real teams), rookie-scale
 * and veteran contracts, roles that move with performance, and an aging curve
 * that eventually ends every career.
 */

interface TeamSeed {
  id: string;
  name: string;
  conference: 'East' | 'West';
}

const TEAM_SEEDS: readonly TeamSeed[] = [
  { id: 'bal', name: 'Baltimore Ironsides', conference: 'East' },
  { id: 'bos', name: 'Boston Wolves', conference: 'East' },
  { id: 'bkn', name: 'Brooklyn Current', conference: 'East' },
  { id: 'cha', name: 'Charlotte Kings', conference: 'East' },
  { id: 'chi', name: 'Chicago Foundry', conference: 'East' },
  { id: 'cle', name: 'Cleveland Sentinels', conference: 'East' },
  { id: 'det', name: 'Detroit Assembly', conference: 'East' },
  { id: 'ind', name: 'Indiana Rail', conference: 'East' },
  { id: 'mia', name: 'Miami Reef', conference: 'East' },
  { id: 'mil', name: 'Milwaukee Forge', conference: 'East' },
  { id: 'nyk', name: 'New York Sentinel', conference: 'East' },
  { id: 'orl', name: 'Orlando Comets', conference: 'East' },
  { id: 'phi', name: 'Philadelphia Liberty', conference: 'East' },
  { id: 'tor', name: 'Toronto North', conference: 'East' },
  { id: 'was', name: 'Washington Monument', conference: 'East' },
  { id: 'dal', name: 'Dallas Lonestars', conference: 'West' },
  { id: 'den', name: 'Denver Summit', conference: 'West' },
  { id: 'gsw', name: 'Golden State Bay', conference: 'West' },
  { id: 'hou', name: 'Houston Launch', conference: 'West' },
  { id: 'lac', name: 'Los Angeles Coast', conference: 'West' },
  { id: 'lal', name: 'Los Angeles Royals', conference: 'West' },
  { id: 'mem', name: 'Memphis Delta', conference: 'West' },
  { id: 'min', name: 'Minnesota Timber', conference: 'West' },
  { id: 'nop', name: 'New Orleans Brass', conference: 'West' },
  { id: 'okc', name: 'Oklahoma City Plains', conference: 'West' },
  { id: 'phx', name: 'Phoenix Heat Wave', conference: 'West' },
  { id: 'por', name: 'Portland Timberline', conference: 'West' },
  { id: 'sac', name: 'Sacramento Gold', conference: 'West' },
  { id: 'sas', name: 'San Antonio Missions', conference: 'West' },
  { id: 'uta', name: 'Utah Summit Peak', conference: 'West' },
];

export const PRO = {
  TEAMS: TEAM_SEEDS.length,
  /** Games in a pro regular season. */
  GAMES: 84,
  /** Age at which decline begins in earnest. */
  DECLINE_AGE: 30,
  /** Nobody plays past this without exceptional durability. */
  HARD_RETIREMENT_AGE: 40,
  /** Rookie-scale contract length in years. */
  ROOKIE_YEARS: 4,
  TWO_WAY_SALARY: 0.6,
  MINIMUM_SALARY: 2.1,
  MAX_SALARY: 49,
} as const;

export function generateLeague(rng: Rng): ProTeam[] {
  return TEAM_SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    conference: seed.conference,
    strength: clamp(rng.normal(62, 11), 30, 95),
    wins: 0,
    losses: 0,
  }));
}

export function teamById(league: ProTeam[], id: string): ProTeam | undefined {
  return league.find((t) => t.id === id);
}

/**
 * Which franchise holds a given pick.
 *
 * Worse teams pick earlier, which is what makes landing spot matter: a
 * lottery pick lands somewhere he will play, a late first lands somewhere
 * he has to wait.
 */
export function teamForPick(league: ProTeam[], pick: number): ProTeam {
  const order = [...league].sort((a, b) => a.strength - b.strength);
  return order[(pick - 1) % order.length] as ProTeam;
}

/** Rookie-scale money by draft slot, in millions per year. */
export function rookieContract(pick: number): Contract {
  if (pick <= 0) {
    return { type: 'two-way', salary: PRO.TWO_WAY_SALARY, yearsLeft: 2, teamOption: true };
  }
  const scale = clamp(11.5 - (pick - 1) * 0.32, 1.2, 11.5);
  return {
    type: 'rookie-scale',
    salary: Math.round(scale * 10) / 10,
    yearsLeft: pick <= DRAFT.ROUND_SIZE ? PRO.ROOKIE_YEARS : 2,
    teamOption: pick > DRAFT.ROUND_SIZE,
  };
}

/**
 * The role a player holds on his team, from overall relative to the league.
 * Role drives minutes, which drives everything else.
 */
export function roleFor(overall: number, teamStrength: number): ProRole {
  const edge = overall - teamStrength;
  if (overall >= 90 && edge >= 12) return 'franchise';
  if (overall >= 84) return 'star';
  if (overall >= 76) return 'starter';
  if (overall >= 70) return 'sixth-man';
  if (overall >= 62) return 'rotation';
  return 'deep-bench';
}

export const ROLE_LABEL: Record<ProRole, string> = {
  'deep-bench': 'Deep bench',
  rotation: 'Rotation',
  'sixth-man': 'Sixth man',
  starter: 'Starter',
  star: 'Star',
  franchise: 'Franchise player',
};

/** Minutes per game implied by a role. */
export function minutesForRole(role: ProRole): number {
  switch (role) {
    case 'franchise':
      return 36;
    case 'star':
      return 34;
    case 'starter':
      return 30;
    case 'sixth-man':
      return 24;
    case 'rotation':
      return 16;
    default:
      return 5;
  }
}

/**
 * What the market will pay, in millions per year.
 * Deliberately steep at the top — stars are paid very differently.
 */
export function marketValue(overall: number, ageYears: number): number {
  const base =
    overall >= 90
      ? PRO.MAX_SALARY
      : overall >= 84
        ? 34
        : overall >= 78
          ? 22
          : overall >= 72
            ? 12
            : overall >= 66
              ? 6
              : PRO.MINIMUM_SALARY;

  // Teams pay for the years ahead, not the ones behind.
  const agePenalty = ageYears > 31 ? (ageYears - 31) * 0.09 : 0;
  return Math.max(PRO.MINIMUM_SALARY, Math.round(base * (1 - agePenalty) * 10) / 10);
}

export function contractFor(
  overall: number,
  ageYears: number,
  years: number,
): Contract {
  const salary = marketValue(overall, ageYears);
  const type: Contract['type'] =
    salary >= PRO.MAX_SALARY * 0.9
      ? 'max'
      : salary <= PRO.MINIMUM_SALARY + 0.1
        ? 'minimum'
        : 'standard';
  return { type, salary, yearsLeft: years, teamOption: false };
}

/**
 * Age curve for professionals. Peak is 26–29; the drop after 32 is what
 * eventually ends every career.
 */
export function ageMultiplier(ageYears: number): number {
  if (ageYears < 24) return 1 + (ageYears - 22) * 0.02;
  if (ageYears <= 29) return 1.05;
  if (ageYears <= 32) return 1.05 - (ageYears - 29) * 0.035;
  return clamp(0.945 - (ageYears - 32) * 0.06, 0.45, 1);
}

/** Whether a career should end this offseason. */
export function shouldRetire(
  overall: number,
  ageYears: number,
  seasons: number,
  rng: Rng,
): boolean {
  if (ageYears >= PRO.HARD_RETIREMENT_AGE) return true;
  if (ageYears < 29) return false;

  // Ineffective and old is the combination that ends careers.
  const pressure =
    (ageYears - 29) * 0.11 + Math.max(0, (68 - overall) / 100) + seasons * 0.004;
  return rng.chance(clamp(pressure, 0, 0.95));
}

export interface SeasonAwards {
  awards: Award[];
  allStar: boolean;
}

/** Postseason honours, judged against the league rather than a fixed bar. */
export function evaluateAwards(
  season: number,
  overall: number,
  ppg: number,
  role: ProRole,
  teamWins: number,
  isRookie: boolean,
  rng: Rng,
): SeasonAwards {
  const awards: Award[] = [];
  const allStar =
    (role === 'franchise' || role === 'star') && ppg >= 19 && rng.chance(0.8);

  if (allStar) awards.push({ season, name: 'All-Star' });

  if (overall >= 92 && ppg >= 26 && teamWins >= 50 && rng.chance(0.45)) {
    awards.push({ season, name: 'MVP' });
  }
  if (isRookie && ppg >= 15 && rng.chance(0.5)) {
    awards.push({ season, name: 'Rookie of the Year' });
  }
  if (role === 'sixth-man' && ppg >= 15 && rng.chance(0.4)) {
    awards.push({ season, name: 'Sixth Man of the Year' });
  }

  return { awards, allStar };
}

export function initialPro(
  teamId: string,
  contract: Contract,
  league: ProTeam[],
): ProState {
  return {
    teamId,
    contract,
    role: 'deep-bench',
    seasons: 0,
    championships: 0,
    allStars: 0,
    awards: [],
    league,
    tradeRequested: false,
    lastPlayoffRound: 0,
  };
}
