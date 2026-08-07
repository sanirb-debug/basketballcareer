import { ageInMonths, formatAge, formatClock, formatHeight, phaseFor } from './calendar';
import { overallFor } from './attributes';
import type { Attributes, Body, GameState, Origin, Position } from './types';

/**
 * The player-facing projection of game state.
 *
 * SPEC §4 requires the genetic roll to stay hidden and be revealed slowly. The
 * enforcement is structural: this selector is the only thing the UI reads, and
 * it cannot leak `hidden` or `hiddenMeta` because it never copies them. The
 * Phase 1 verification deep-scans the result to prove it.
 */

export interface PublicOrigin extends Omit<Origin, 'exposureMultiplier'> {}

export interface PublicView {
  seed: number;
  monthsElapsed: number;
  date: string;
  phase: string;
  actionPoints: number;
  ageMonths: number;
  ageLabel: string;
  player: {
    name: string;
    position: Position;
    jerseyNumber: number;
    handedness: string;
    body: Body;
    heightLabel: string;
    attributes: Attributes;
    overall: number;
  };
  origin: PublicOrigin;
  recentLog: { text: string; date: string }[];
}

export function toPublicView(state: GameState): PublicView {
  const { player, clock } = state;
  const phase = phaseFor(clock);
  const months = ageInMonths(clock, player.birthYear, player.birthMonth);

  // Destructured out rather than deleted, so adding a hidden field later
  // cannot accidentally start leaking through this selector.
  const { exposureMultiplier: _exposure, ...publicOrigin } = state.origin;
  void _exposure;

  return {
    seed: state.seed,
    monthsElapsed: state.monthsElapsed,
    date: formatClock(clock),
    phase: phase.label,
    actionPoints: phase.actionPoints,
    ageMonths: months,
    ageLabel: formatAge(months),
    player: {
      name: player.name,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      handedness: player.handedness,
      body: { ...player.body },
      heightLabel: formatHeight(player.body.heightInches),
      attributes: { ...player.attributes },
      overall: overallFor(player.attributes, player.position),
    },
    origin: publicOrigin,
    recentLog: state.log
      .slice(-8)
      .reverse()
      .map((entry) => ({
        text: entry.text,
        date: formatClock({ year: entry.year, month: entry.month }),
      })),
  };
}
