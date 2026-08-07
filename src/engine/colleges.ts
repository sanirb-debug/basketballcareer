import type { Program, ProgramTier } from './types';

/**
 * The program catalog (SPEC §10).
 *
 * Tiers gate on national ranking, off-court character, and academics — three
 * different things, so falling short on any one of them closes a different
 * door. Bluebloods will not touch a non-qualifier no matter how good he is;
 * JUCO will take anyone, which is what makes it the floor rather than a fail
 * state.
 */

export const PROGRAMS: readonly Program[] = [
  // --- Blueblood ---------------------------------------------------------
  { id: 'ridgemont', name: 'Ridgemont State', tier: 'blueblood', rankCutoff: 35, characterFloor: 45, requiresQualifier: true, state: 'North Carolina' },
  { id: 'kensington', name: 'Kensington', tier: 'blueblood', rankCutoff: 30, characterFloor: 55, requiresQualifier: true, state: 'Kentucky' },
  { id: 'blue-harbor', name: 'Blue Harbor', tier: 'blueblood', rankCutoff: 40, characterFloor: 40, requiresQualifier: true, state: 'Kansas' },
  { id: 'st-crispin', name: 'St. Crispin', tier: 'blueblood', rankCutoff: 38, characterFloor: 62, requiresQualifier: true, state: 'Indiana' },
  { id: 'westlake', name: 'Westlake', tier: 'blueblood', rankCutoff: 45, characterFloor: 38, requiresQualifier: true, state: 'California' },

  // --- High-major --------------------------------------------------------
  { id: 'granite-tech', name: 'Granite Tech', tier: 'high-major', rankCutoff: 110, characterFloor: 35, requiresQualifier: true, state: 'Georgia' },
  { id: 'lake-city', name: 'Lake City', tier: 'high-major', rankCutoff: 130, characterFloor: 30, requiresQualifier: true, state: 'Illinois' },
  { id: 'mercer-hill', name: 'Mercer Hill', tier: 'high-major', rankCutoff: 120, characterFloor: 48, requiresQualifier: true, state: 'Virginia' },
  { id: 'port-royal', name: 'Port Royal', tier: 'high-major', rankCutoff: 140, characterFloor: 28, requiresQualifier: true, state: 'Florida' },
  { id: 'northfield', name: 'Northfield', tier: 'high-major', rankCutoff: 125, characterFloor: 52, requiresQualifier: true, state: 'Michigan' },
  { id: 'cascade-state', name: 'Cascade State', tier: 'high-major', rankCutoff: 150, characterFloor: 32, requiresQualifier: true, state: 'Oregon' },
  { id: 'alderman', name: 'Alderman', tier: 'high-major', rankCutoff: 135, characterFloor: 44, requiresQualifier: true, state: 'Texas' },

  // --- Mid-major ---------------------------------------------------------
  { id: 'fairmount', name: 'Fairmount', tier: 'mid-major', rankCutoff: 240, characterFloor: 25, requiresQualifier: true, state: 'Ohio' },
  { id: 'iron-river', name: 'Iron River', tier: 'mid-major', rankCutoff: 260, characterFloor: 22, requiresQualifier: true, state: 'Iowa' },
  { id: 'saint-anne', name: 'Saint Anne', tier: 'mid-major', rankCutoff: 230, characterFloor: 40, requiresQualifier: true, state: 'Pennsylvania' },
  { id: 'delta-valley', name: 'Delta Valley', tier: 'mid-major', rankCutoff: 275, characterFloor: 20, requiresQualifier: true, state: 'Missouri' },
  { id: 'hollow-creek', name: 'Hollow Creek', tier: 'mid-major', rankCutoff: 250, characterFloor: 30, requiresQualifier: true, state: 'Tennessee' },
  { id: 'briarcliff', name: 'Briarcliff', tier: 'mid-major', rankCutoff: 265, characterFloor: 34, requiresQualifier: true, state: 'New Jersey' },

  // --- Low-major ---------------------------------------------------------
  { id: 'clayton-a-m', name: 'Clayton A&M', tier: 'low-major', rankCutoff: 400, characterFloor: 15, requiresQualifier: true, state: 'Maryland' },
  { id: 'penn-ridge', name: 'Penn Ridge', tier: 'low-major', rankCutoff: 400, characterFloor: 18, requiresQualifier: true, state: 'Pennsylvania' },
  { id: 'south-fork', name: 'South Fork', tier: 'low-major', rankCutoff: 400, characterFloor: 12, requiresQualifier: true, state: 'Nebraska' },
  { id: 'ashland-poly', name: 'Ashland Poly', tier: 'low-major', rankCutoff: 400, characterFloor: 22, requiresQualifier: true, state: 'New York' },
  { id: 'crestview', name: 'Crestview', tier: 'low-major', rankCutoff: 400, characterFloor: 16, requiresQualifier: true, state: 'Montana' },

  // --- JUCO: the floor, and never a closed door -------------------------
  { id: 'copper-basin-cc', name: 'Copper Basin CC', tier: 'juco', rankCutoff: 9999, characterFloor: 0, requiresQualifier: false, state: 'Arizona' },
  { id: 'lakeshore-cc', name: 'Lakeshore CC', tier: 'juco', rankCutoff: 9999, characterFloor: 0, requiresQualifier: false, state: 'Michigan' },
  { id: 'rio-hondo-cc', name: 'Rio Hondo CC', tier: 'juco', rankCutoff: 9999, characterFloor: 0, requiresQualifier: false, state: 'Texas' },
];

export const TIER_LABEL: Record<ProgramTier, string> = {
  blueblood: 'Blueblood',
  'high-major': 'High-Major',
  'mid-major': 'Mid-Major',
  'low-major': 'Low-Major',
  juco: 'JUCO',
};

/** Ordering for display and for judging which offer is the best one. */
export const TIER_RANK: Record<ProgramTier, number> = {
  blueblood: 5,
  'high-major': 4,
  'mid-major': 3,
  'low-major': 2,
  juco: 1,
};

export function programById(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}

export function isDivisionOne(tier: ProgramTier): boolean {
  return tier !== 'juco';
}
