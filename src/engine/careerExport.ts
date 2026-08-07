import { formatClock, formatHeight } from './calendar';
import { TIER_LABEL, programById } from './colleges';
import { describeEligibility } from './academics';
import { endingScore } from './endings';
import { AAU_LABEL } from './hype';
import { overallFor } from './attributes';
import { activeOffers } from './recruiting';
import { gradeLabel } from './season';
import type { GameState } from './types';

/**
 * The career archive and its one-tap text export (SPEC §16.4).
 *
 * Plain text on purpose: the point is that a finished run can be copied out
 * and pasted anywhere — a group chat, a forum, a notes app — and still read
 * like a story rather than a data dump.
 */

function line(label: string, value: string): string {
  return `${label.padEnd(20)} ${value}`;
}

export function exportCareerText(state: GameState): string {
  const { player, history, academics, hype, recruiting } = state;
  const out: string[] = [];

  out.push('='.repeat(60));
  out.push(`HOOP LIFE — ${player.name}`);
  out.push('='.repeat(60));
  out.push('');

  out.push(line('Position', player.position));
  out.push(line('Hometown', `${state.origin.homeCity}, ${state.origin.homeState}`));
  out.push(line('High school', state.school.name));
  out.push(line('Final height', formatHeight(player.body.heightInches)));
  out.push(line('Final weight', `${Math.round(player.body.weightLbs)} lb`));
  out.push(line('Overall', String(overallFor(player.attributes, player.position))));
  out.push(line('National rank', `#${hype.nationalRank}`));
  out.push(line('Hype', String(Math.round(hype.hype))));
  out.push(line('AAU circuit', AAU_LABEL[hype.aauTier]));
  out.push(line('Seed', String(state.seed)));
  out.push('');

  out.push('-- ACADEMICS ' + '-'.repeat(46));
  out.push(line('GPA', academics.gpa.toFixed(2)));
  out.push(line('Core credits', `${academics.coreCredits} / 16`));
  out.push(
    line('Test score', academics.testScore > 0 ? String(academics.testScore) : 'never sat'),
  );
  out.push(line('Standing', describeEligibility(academics.status)));
  out.push('');

  if (history.length > 0) {
    out.push('-- SEASON BY SEASON ' + '-'.repeat(39));
    out.push(
      `${'Year'.padEnd(12)}${'Record'.padEnd(10)}${'GP'.padEnd(5)}${'PPG'.padEnd(7)}${'RPG'.padEnd(7)}${'APG'.padEnd(7)}MPG`,
    );
    for (const season of history) {
      const gp = Math.max(1, season.games);
      out.push(
        gradeLabel(season.grade).padEnd(12) +
          `${season.wins}-${season.losses}`.padEnd(10) +
          String(season.games).padEnd(5) +
          (season.totals.points / gp).toFixed(1).padEnd(7) +
          (season.totals.rebounds / gp).toFixed(1).padEnd(7) +
          (season.totals.assists / gp).toFixed(1).padEnd(7) +
          (season.totals.minutes / gp).toFixed(1),
      );
    }

    const career = history.reduce(
      (acc, s) => ({
        games: acc.games + s.games,
        points: acc.points + s.totals.points,
        rebounds: acc.rebounds + s.totals.rebounds,
        assists: acc.assists + s.totals.assists,
        wins: acc.wins + s.wins,
        losses: acc.losses + s.losses,
      }),
      { games: 0, points: 0, rebounds: 0, assists: 0, wins: 0, losses: 0 },
    );
    const gp = Math.max(1, career.games);
    out.push('');
    out.push(
      line(
        'Career',
        `${career.wins}-${career.losses}, ${career.games} games, ` +
          `${(career.points / gp).toFixed(1)} / ${(career.rebounds / gp).toFixed(1)} / ` +
          `${(career.assists / gp).toFixed(1)}`,
      ),
    );
    out.push('');
  }

  const offers = activeOffers(recruiting);
  out.push('-- RECRUITING ' + '-'.repeat(45));
  if (offers.length === 0) {
    out.push('No scholarship offers.');
  } else {
    for (const offer of offers) {
      const program = programById(offer.programId);
      if (program) out.push(`  ${program.name} (${TIER_LABEL[program.tier]})`);
    }
  }
  if (recruiting.commitment) {
    const program = programById(recruiting.commitment.programId);
    out.push('');
    out.push(
      line(
        recruiting.signed ? 'Signed with' : 'Committed to',
        program ? `${program.name} (${TIER_LABEL[program.tier]})` : 'unknown',
      ),
    );
  }
  if (recruiting.decommits > 0) {
    out.push(line('Decommits', String(recruiting.decommits)));
  }
  out.push('');

  if (state.events.decisions.length > 0) {
    out.push('-- DECISIONS ' + '-'.repeat(46));
    for (const decision of state.events.decisions) {
      out.push(`  [month ${String(decision.monthsElapsed).padStart(2)}] ${decision.choice}`);
    }
    out.push('');
  }

  out.push('-- MONTH BY MONTH ' + '-'.repeat(41));
  for (const entry of state.log) {
    const when = formatClock({ year: entry.year, month: entry.month });
    // Long outcome lines get a hanging indent so the export stays paste-able
    // into a chat window without wrapping into soup.
    const [first, ...rest] = wrap(entry.text, 74).split('\n');
    out.push(`  ${when.padEnd(18)} ${first}`);
    for (const line of rest) out.push(`  ${' '.repeat(18)} ${line}`);
  }
  out.push('');

  if (state.careerEnd) {
    out.push('='.repeat(60));
    out.push(`HOW IT ENDED — ${state.careerEnd.reason.toUpperCase()}`);
    out.push('='.repeat(60));
    out.push('');
    out.push(wrap(state.careerEnd.detail, 60));
    out.push('');
    out.push('What decided it:');
    out.push(wrap(state.careerEnd.decision, 60));
    out.push('');
    out.push(line('Career score', `${endingScore(state.careerEnd.endingId)} / 100`));
  }

  return out.join('\n');
}

function wrap(text: string, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.join('\n');
}
