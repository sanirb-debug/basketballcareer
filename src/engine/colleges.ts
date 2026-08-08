import type { Program, ProgramTier } from './types';

/**
 * The college landscape (SPEC §10, §14).
 *
 * Eight conferences of eight, plus four junior colleges. Tiers gate on
 * national ranking, off-court character, and academics — three different
 * things, so falling short on any one of them closes a different door.
 * Bluebloods will not touch a non-qualifier no matter how good he is; JUCO
 * will take anyone, which is what makes it the floor rather than a fail state.
 *
 * Names are invented (SPEC §19 rules out real teams), but the shape of the
 * landscape is real: a handful of national powers, a broad high-major middle,
 * and a long tail where most scholarships actually live.
 */

export const CONFERENCES = [
  'Atlantic Crown',
  'Mid-Continent',
  'Pacific Alliance',
  'Southern Athletic',
  'Great Lakes',
  'Heartland',
  'Coastal',
  'Northern',
] as const;

export type Conference = (typeof CONFERENCES)[number];

interface ProgramSeed {
  id: string;
  name: string;
  state: string;
  tier: ProgramTier;
  strength: number;
  characterFloor: number;
}

/** Rank cutoffs and staffing standards follow from the tier. */
const TIER_DEFAULTS: Record<
  ProgramTier,
  { rankCutoff: number; rosterDepth: number; coachQuality: number }
> = {
  blueblood: { rankCutoff: 40, rosterDepth: 86, coachQuality: 92 },
  'high-major': { rankCutoff: 130, rosterDepth: 76, coachQuality: 80 },
  'mid-major': { rankCutoff: 260, rosterDepth: 64, coachQuality: 66 },
  'low-major': { rankCutoff: 400, rosterDepth: 52, coachQuality: 54 },
  juco: { rankCutoff: 9999, rosterDepth: 44, coachQuality: 46 },
};

const BY_CONFERENCE: Record<string, ProgramSeed[]> = {
  'Atlantic Crown': [
    { id: 'ridgemont', name: 'Ridgemont State', state: 'North Carolina', tier: 'blueblood', strength: 92, characterFloor: 45 },
    { id: 'kensington', name: 'Kensington', state: 'Kentucky', tier: 'blueblood', strength: 94, characterFloor: 55 },
    { id: 'st-crispin', name: 'St. Crispin', state: 'Indiana', tier: 'blueblood', strength: 90, characterFloor: 62 },
    { id: 'mercer-hill', name: 'Mercer Hill', state: 'Virginia', tier: 'high-major', strength: 82, characterFloor: 48 },
    { id: 'tidewater', name: 'Tidewater', state: 'Virginia', tier: 'high-major', strength: 79, characterFloor: 38 },
    { id: 'castleton', name: 'Castleton', state: 'Maryland', tier: 'high-major', strength: 80, characterFloor: 42 },
    { id: 'brackenridge', name: 'Brackenridge', state: 'Pennsylvania', tier: 'high-major', strength: 77, characterFloor: 35 },
    { id: 'oldfield', name: 'Oldfield', state: 'New York', tier: 'high-major', strength: 78, characterFloor: 50 },
  ],
  'Mid-Continent': [
    { id: 'blue-harbor', name: 'Blue Harbor', state: 'Kansas', tier: 'blueblood', strength: 93, characterFloor: 40 },
    { id: 'westlake', name: 'Westlake', state: 'California', tier: 'blueblood', strength: 91, characterFloor: 38 },
    { id: 'lake-city', name: 'Lake City', state: 'Illinois', tier: 'high-major', strength: 84, characterFloor: 30 },
    { id: 'northfield', name: 'Northfield', state: 'Michigan', tier: 'high-major', strength: 83, characterFloor: 52 },
    { id: 'alderman', name: 'Alderman', state: 'Texas', tier: 'high-major', strength: 81, characterFloor: 44 },
    { id: 'stonebridge', name: 'Stonebridge', state: 'Missouri', tier: 'high-major', strength: 79, characterFloor: 36 },
    { id: 'fort-belmont', name: 'Fort Belmont', state: 'Oklahoma', tier: 'high-major', strength: 76, characterFloor: 28 },
    { id: 'kearney-tech', name: 'Kearney Tech', state: 'Nebraska', tier: 'high-major', strength: 75, characterFloor: 33 },
  ],
  'Pacific Alliance': [
    { id: 'cascade-state', name: 'Cascade State', state: 'Oregon', tier: 'high-major', strength: 82, characterFloor: 32 },
    { id: 'goldstrand', name: 'Goldstrand', state: 'California', tier: 'high-major', strength: 85, characterFloor: 40 },
    { id: 'sierra-pacific', name: 'Sierra Pacific', state: 'California', tier: 'high-major', strength: 80, characterFloor: 36 },
    { id: 'puget', name: 'Puget', state: 'Washington', tier: 'high-major', strength: 77, characterFloor: 44 },
    { id: 'red-mesa', name: 'Red Mesa', state: 'Arizona', tier: 'high-major', strength: 78, characterFloor: 26 },
    { id: 'silver-basin', name: 'Silver Basin', state: 'Nevada', tier: 'mid-major', strength: 70, characterFloor: 22 },
    { id: 'coast-range', name: 'Coast Range', state: 'Oregon', tier: 'mid-major', strength: 68, characterFloor: 30 },
    { id: 'harbor-point', name: 'Harbor Point', state: 'Washington', tier: 'mid-major', strength: 66, characterFloor: 34 },
  ],
  'Southern Athletic': [
    { id: 'granite-tech', name: 'Granite Tech', state: 'Georgia', tier: 'high-major', strength: 83, characterFloor: 35 },
    { id: 'port-royal', name: 'Port Royal', state: 'Florida', tier: 'high-major', strength: 84, characterFloor: 28 },
    { id: 'magnolia-state', name: 'Magnolia State', state: 'Alabama', tier: 'high-major', strength: 81, characterFloor: 30 },
    { id: 'cypress-a-m', name: 'Cypress A&M', state: 'Louisiana', tier: 'high-major', strength: 79, characterFloor: 25 },
    { id: 'hollow-creek', name: 'Hollow Creek', state: 'Tennessee', tier: 'mid-major', strength: 71, characterFloor: 30 },
    { id: 'palmetto', name: 'Palmetto', state: 'South Carolina', tier: 'mid-major', strength: 69, characterFloor: 33 },
    { id: 'gulfport-state', name: 'Gulfport State', state: 'Mississippi', tier: 'mid-major', strength: 67, characterFloor: 20 },
    { id: 'live-oak', name: 'Live Oak', state: 'Florida', tier: 'mid-major', strength: 70, characterFloor: 27 },
  ],
  'Great Lakes': [
    { id: 'fairmount', name: 'Fairmount', state: 'Ohio', tier: 'mid-major', strength: 72, characterFloor: 25 },
    { id: 'iron-river', name: 'Iron River', state: 'Iowa', tier: 'mid-major', strength: 70, characterFloor: 22 },
    { id: 'saint-anne', name: 'Saint Anne', state: 'Pennsylvania', tier: 'mid-major', strength: 71, characterFloor: 40 },
    { id: 'briarcliff', name: 'Briarcliff', state: 'New Jersey', tier: 'mid-major', strength: 69, characterFloor: 34 },
    { id: 'copperfield', name: 'Copperfield', state: 'Ohio', tier: 'mid-major', strength: 66, characterFloor: 28 },
    { id: 'marquette-bay', name: 'Marquette Bay', state: 'Wisconsin', tier: 'mid-major', strength: 68, characterFloor: 31 },
    { id: 'steelton', name: 'Steelton', state: 'Indiana', tier: 'mid-major', strength: 65, characterFloor: 24 },
    { id: 'lakeview-state', name: 'Lakeview State', state: 'Michigan', tier: 'mid-major', strength: 67, characterFloor: 29 },
  ],
  Heartland: [
    { id: 'delta-valley', name: 'Delta Valley', state: 'Missouri', tier: 'mid-major', strength: 68, characterFloor: 20 },
    { id: 'prairie-state', name: 'Prairie State', state: 'Kansas', tier: 'mid-major', strength: 66, characterFloor: 23 },
    { id: 'cimarron', name: 'Cimarron', state: 'Oklahoma', tier: 'mid-major', strength: 64, characterFloor: 18 },
    { id: 'wheatland', name: 'Wheatland', state: 'Nebraska', tier: 'low-major', strength: 58, characterFloor: 16 },
    { id: 'high-plains', name: 'High Plains', state: 'Colorado', tier: 'low-major', strength: 56, characterFloor: 20 },
    { id: 'red-river', name: 'Red River', state: 'Texas', tier: 'low-major', strength: 57, characterFloor: 14 },
    { id: 'ozark-hill', name: 'Ozark Hill', state: 'Arkansas', tier: 'low-major', strength: 55, characterFloor: 17 },
    { id: 'saltfork', name: 'Saltfork', state: 'Kansas', tier: 'low-major', strength: 54, characterFloor: 12 },
  ],
  Coastal: [
    { id: 'clayton-a-m', name: 'Clayton A&M', state: 'Maryland', tier: 'low-major', strength: 58, characterFloor: 15 },
    { id: 'penn-ridge', name: 'Penn Ridge', state: 'Pennsylvania', tier: 'low-major', strength: 57, characterFloor: 18 },
    { id: 'ashland-poly', name: 'Ashland Poly', state: 'New York', tier: 'low-major', strength: 56, characterFloor: 22 },
    { id: 'seabright', name: 'Seabright', state: 'New Jersey', tier: 'low-major', strength: 55, characterFloor: 19 },
    { id: 'cape-fear', name: 'Cape Fear', state: 'North Carolina', tier: 'low-major', strength: 54, characterFloor: 13 },
    { id: 'tidal-basin', name: 'Tidal Basin', state: 'Virginia', tier: 'low-major', strength: 53, characterFloor: 16 },
    { id: 'harborview', name: 'Harborview', state: 'Massachusetts', tier: 'low-major', strength: 55, characterFloor: 25 },
    { id: 'lowcountry', name: 'Lowcountry', state: 'South Carolina', tier: 'low-major', strength: 52, characterFloor: 11 },
  ],
  Northern: [
    { id: 'south-fork', name: 'South Fork', state: 'Nebraska', tier: 'low-major', strength: 55, characterFloor: 12 },
    { id: 'crestview', name: 'Crestview', state: 'Montana', tier: 'low-major', strength: 53, characterFloor: 16 },
    { id: 'birchwood', name: 'Birchwood', state: 'Minnesota', tier: 'low-major', strength: 56, characterFloor: 21 },
    { id: 'north-cascade', name: 'North Cascade', state: 'Idaho', tier: 'low-major', strength: 52, characterFloor: 14 },
    { id: 'glacier-state', name: 'Glacier State', state: 'Montana', tier: 'low-major', strength: 51, characterFloor: 10 },
    { id: 'granite-falls', name: 'Granite Falls', state: 'Vermont', tier: 'low-major', strength: 50, characterFloor: 18 },
    { id: 'kettle-river', name: 'Kettle River', state: 'North Dakota', tier: 'low-major', strength: 49, characterFloor: 9 },
    { id: 'aurora-north', name: 'Aurora North', state: 'Alaska', tier: 'low-major', strength: 48, characterFloor: 8 },
  ],
};

const JUCO_SEEDS: ProgramSeed[] = [
  { id: 'copper-basin-cc', name: 'Copper Basin CC', state: 'Arizona', tier: 'juco', strength: 48, characterFloor: 0 },
  { id: 'lakeshore-cc', name: 'Lakeshore CC', state: 'Michigan', tier: 'juco', strength: 46, characterFloor: 0 },
  { id: 'rio-hondo-cc', name: 'Rio Hondo CC', state: 'Texas', tier: 'juco', strength: 47, characterFloor: 0 },
  { id: 'ferrisburg-cc', name: 'Ferrisburg CC', state: 'Ohio', tier: 'juco', strength: 45, characterFloor: 0 },
];

function build(seed: ProgramSeed, conference: string): Program {
  const defaults = TIER_DEFAULTS[seed.tier];
  return {
    id: seed.id,
    name: seed.name,
    tier: seed.tier,
    state: seed.state,
    conference,
    strength: seed.strength,
    characterFloor: seed.characterFloor,
    requiresQualifier: seed.tier !== 'juco',
    rankCutoff: defaults.rankCutoff,
    // Stronger rosters are harder to crack, tracking team quality.
    rosterDepth: Math.round(defaults.rosterDepth + (seed.strength - 70) * 0.35),
    coachQuality: Math.round(defaults.coachQuality + (seed.strength - 70) * 0.2),
  };
}

export const PROGRAMS: readonly Program[] = [
  ...CONFERENCES.flatMap((conference) =>
    (BY_CONFERENCE[conference] ?? []).map((seed) => build(seed, conference)),
  ),
  ...JUCO_SEEDS.map((seed) => build(seed, 'Junior College')),
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

export function programsInConference(conference: string): Program[] {
  return PROGRAMS.filter((p) => p.conference === conference);
}

export function jucoPrograms(): Program[] {
  return PROGRAMS.filter((p) => p.tier === 'juco');
}
