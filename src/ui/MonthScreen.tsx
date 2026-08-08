import { useState } from 'react';
import type { PublicView } from '../engine/selectors';
import type {
  LogEntry,
  MonthAction,
  Position,
  SchoolTier,
  SocialPlatformId,
  TrainingState,
} from '../engine/types';
import type { InteractionId } from '../engine/people';
import type { PostKind } from '../engine/activities';
import ActionPicker from './ActionPicker';
import GamesPanel from './GamesPanel';
import RecruitingPanel from './RecruitingPanel';
import RankingsPanel from './RankingsPanel';
import LifePanel from './LifePanel';
import CareerArchive from './CareerArchive';
import CareerPanel from './CareerPanel';
import BigChoicesPanel from './BigChoicesPanel';
import AttributesPanel from './AttributesPanel';
import PeoplePanel from './PeoplePanel';
import ActivitiesPanel from './ActivitiesPanel';

/**
 * The month screen (SPEC §17), which deliberately changes shape by season
 * phase.
 *
 * SPEC §2 calls this the highest-priority constraint in the whole document:
 * across ~264 ticks, a month that always renders the same menu turns the game
 * into a spreadsheet. So the accent, the headline, and crucially the *order of
 * sections* all change — in season the games come first and you only get two
 * action points; in the offseason the training menu leads with four.
 */

type Tab =
  | 'month'
  | 'ratings'
  | 'career'
  | 'recruiting'
  | 'rankings'
  | 'people'
  | 'activities'
  | 'life'
  | 'archive';

interface Props {
  view: PublicView;
  training: TrainingState;
  chosen: MonthAction[];
  monthLog: LogEntry[];
  saving: boolean;
  exportText: () => string;
  onChange: (next: MonthAction[]) => void;
  onNextMonth: () => void;
  onExit: () => void;
  onCommit: (programId: string) => void;
  onDecommit: () => void;
  onSign: () => void;
  onRedshirt: () => void;
  onEnterPortal: () => void;
  onTransfer: (programId: string) => void;
  onDeclare: (testingWaters: boolean) => void;
  onWithdraw: () => void;
  onRequestTrade: () => void;
  onChangePosition: (position: Position) => void;
  onTransferSchool: (tier: SchoolTier) => void;
  onReclassify: () => void;
  onInteract: (personId: string, interaction: InteractionId) => void;
  onBuy: (assetId: string) => void;
  onJoinPlatform: (platformId: SocialPlatformId) => void;
  onPost: (platformId: SocialPlatformId, kind: PostKind) => void;
}

interface PhaseSkin {
  accent: string;
  border: string;
  headline: string;
  sub: string;
  gamesFirst: boolean;
}

function skinFor(phase: string): PhaseSkin {
  switch (phase) {
    case 'Season':
      return {
        accent: 'text-sky-400',
        border: 'border-sky-900/60 bg-sky-950/20',
        headline: 'In season',
        sub: 'Games every week. Your minutes are the coach’s call, not yours.',
        gamesFirst: true,
      };
    case 'Playoffs':
      return {
        accent: 'text-amber-400',
        border: 'border-amber-900/60 bg-amber-950/20',
        headline: 'Postseason',
        sub: 'Win or the season is over. One action point — spend it well.',
        gamesFirst: true,
      };
    case 'AAU / Spring Circuit':
      return {
        accent: 'text-violet-400',
        border: 'border-violet-900/60 bg-violet-950/20',
        headline: 'Spring circuit',
        sub: 'Travel ball and exposure events. Three action points.',
        gamesFirst: false,
      };
    case 'Live Period':
      return {
        accent: 'text-rose-400',
        border: 'border-rose-900/60 bg-rose-950/20',
        headline: 'July live period',
        sub: 'The month coaches are allowed to watch. Everything you do counts double.',
        gamesFirst: false,
      };
    default:
      return {
        accent: 'text-emerald-400',
        border: 'border-emerald-900/60 bg-emerald-950/20',
        headline: 'Offseason',
        sub: 'The most action points you will get all year. This is where careers are built.',
        gamesFirst: false,
      };
  }
}

export default function MonthScreen({
  view,
  training,
  chosen,
  monthLog,
  saving,
  exportText,
  onChange,
  onNextMonth,
  onExit,
  onCommit,
  onDecommit,
  onSign,
  onRedshirt,
  onEnterPortal,
  onTransfer,
  onDeclare,
  onWithdraw,
  onRequestTrade,
  onChangePosition,
  onTransferSchool,
  onReclassify,
  onInteract,
  onBuy,
  onJoinPlatform,
  onPost,
}: Props) {
  const [tab, setTab] = useState<Tab>('month');
  const inHighSchool = view.stage === 'highschool';
  const skin = skinFor(view.phase);
  const season = view.season;

  const visitsQueued = chosen
    .filter((a) => typeof a !== 'string' && a.id === 'visit')
    .map((a) => (typeof a === 'string' ? '' : (a.target ?? '')));

  const queueVisit = (programId: string) => {
    if (chosen.length >= view.actionPoints) return;
    onChange([...chosen, { id: 'visit', target: programId }]);
  };

  const actions = (
    <ActionPicker
      budget={view.actionPoints}
      chosen={chosen}
      training={training}
      energy={view.energy}
      onChange={onChange}
    />
  );

  const games = (
    <GamesPanel
      games={view.gamesThisMonth}
      playoff={view.gamesThisMonth.some((g) => g.playoff)}
    />
  );

  // Tabs follow the stage: recruiting and the national board stop mattering
  // the moment high school is over, and a career panel takes their place.
  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: 'month', label: 'Month' },
    { id: 'ratings', label: 'Ratings', badge: String(view.player.overall) },
    ...(inHighSchool
      ? ([
          {
            id: 'recruiting' as Tab,
            label: 'Recruiting',
            ...(view.recruiting.offerCount > 0
              ? { badge: String(view.recruiting.offerCount) }
              : {}),
          },
          {
            id: 'rankings' as Tab,
            label: 'Rankings',
            badge: `#${view.rankings.nationalRank}`,
          },
        ])
      : ([
          {
            id: 'career' as Tab,
            label: view.pro ? 'Contract' : 'Program',
            ...(view.draft && !view.draft.completed
              ? { badge: `#${view.draft.projection}` }
              : {}),
          },
        ])),
    {
      id: 'people',
      label: 'People',
      badge: String(view.people.filter((p) => p.active).length),
    },
    { id: 'activities', label: 'Activities' },
    { id: 'life', label: 'Life' },
    { id: 'archive', label: 'Archive' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <div
            className={`text-xs font-medium uppercase tracking-widest ${skin.accent}`}
          >
            {skin.headline}
          </div>
          <h1 className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {view.date}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-500">{skin.sub}</p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          Save &amp; exit
        </button>
      </div>

      <div className="mt-6 text-sm text-neutral-400">
        {view.player.name} · #{view.player.jerseyNumber} · {view.player.position} ·{' '}
        {inHighSchool
          ? view.school.name
          : (view.pro?.teamName ?? view.college?.programName ?? view.stageLabel)}
        <span className="text-neutral-600">
          {' '}
          ·{' '}
          {inHighSchool
            ? view.gradeLabel
            : view.college
              ? `Year ${view.college.year}`
              : view.pro
                ? `${view.pro.seasons} seasons`
                : view.stageLabel}
          {season && ` · ${season.wins}–${season.losses}`}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800">
        <Stat label="Age" value={view.ageLabel} />
        <Stat label="Height" value={view.player.heightLabel} />
        <Stat label="Overall" value={String(view.player.overall)} />
        <Stat
          label="Energy"
          value={String(view.energy)}
          tone={view.energy < 35 ? 'bad' : undefined}
        />
        <Stat label="Trust" value={String(view.coachTrust)} />
        {inHighSchool ? (
          <>
            <Stat label="Rank" value={`#${view.rankings.nationalRank}`} />
            <Stat
              label="GPA"
              value={view.academics.gpa.toFixed(2)}
              tone={view.academics.status === 'non-qualifier' ? 'bad' : undefined}
            />
          </>
        ) : (
          <>
            <Stat
              label={view.pro ? 'Role' : 'Year'}
              value={view.pro ? view.pro.role : String(view.college?.year ?? 1)}
            />
            <Stat
              label={view.pro ? 'Salary' : 'Draft'}
              value={
                view.pro
                  ? `$${view.pro.salary}M`
                  : `#${view.draft?.projection ?? '—'}`
              }
            />
          </>
        )}
      </dl>

      {view.injury && (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-5 py-3">
          <div className="text-sm font-medium text-red-300">
            Out with a {view.injury.name}
          </div>
          <div className="mt-0.5 text-sm text-red-400/80">
            {view.injury.monthsRemaining} month
            {view.injury.monthsRemaining === 1 ? '' : 's'} of rehab left.
          </div>
        </div>
      )}

      {monthLog.length > 0 && (
        <div className={`mt-4 rounded-lg border px-5 py-3 ${skin.border}`}>
          <ul className="space-y-1 text-sm text-neutral-300">
            {monthLog.map((entry, i) => (
              <li key={i}>{entry.text}</li>
            ))}
          </ul>
        </div>
      )}

      <nav className="mt-8 flex gap-1 border-b border-neutral-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              tab === t.id
                ? 'border-orange-500 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
            {t.badge && (
              <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-400">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === 'month' && (
          <div className="grid grid-cols-[1fr_18rem] gap-10">
            <div className="space-y-9">
              <BigChoicesPanel
                view={view}
                onChangePosition={onChangePosition}
                onTransferSchool={onTransferSchool}
                onReclassify={onReclassify}
              />
              {skin.gamesFirst ? (
                <>
                  {games}
                  {actions}
                </>
              ) : (
                <>
                  {actions}
                  {games}
                </>
              )}
            </div>

            <aside className="space-y-8">
              {season && (
                <section>
                  <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                    {season.gradeLabel} season
                  </h2>
                  <dl className="mt-3 space-y-1 text-sm tabular-nums">
                    <Row label="Record" value={`${season.wins}–${season.losses}`} />
                    <Row label="Games" value={String(season.gamesPlayed)} />
                    <Row label="PPG" value={season.ppg.toFixed(1)} />
                    <Row label="RPG" value={season.rpg.toFixed(1)} />
                    <Row label="APG" value={season.apg.toFixed(1)} />
                    <Row label="MPG" value={season.mpg.toFixed(1)} />
                  </dl>

                  <h3 className="mt-6 text-xs font-medium uppercase tracking-widest text-neutral-500">
                    Around the league
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm tabular-nums">
                    {season.standings.slice(0, 5).map((team) => (
                      <li key={team.name} className="flex justify-between gap-3">
                        <span className="truncate text-neutral-400">
                          {team.name}
                        </span>
                        <span className="text-neutral-600">
                          {team.wins}–{team.losses}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {view.history.length > 0 && (
                <section>
                  <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                    Career
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm tabular-nums">
                    {view.history.map((s) => (
                      <li key={s.seasonYear} className="flex justify-between gap-3">
                        <span className="text-neutral-400">Grade {s.grade}</span>
                        <span className="text-neutral-500">
                          {(s.totals.points / Math.max(1, s.games)).toFixed(1)} ppg ·{' '}
                          {s.wins}–{s.losses}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                  Recent
                </h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {view.recentLog.slice(0, 6).map((entry, i) => (
                    <li key={i}>
                      <div className="text-xs tabular-nums text-neutral-600">
                        {entry.date}
                      </div>
                      <div className="text-neutral-400">{entry.text}</div>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        )}

        {tab === 'ratings' && <AttributesPanel view={view} />}
        {tab === 'career' && (
          <CareerPanel
            view={view}
            onRedshirt={onRedshirt}
            onEnterPortal={onEnterPortal}
            onTransfer={onTransfer}
            onDeclare={onDeclare}
            onWithdraw={onWithdraw}
            onRequestTrade={onRequestTrade}
          />
        )}
        {tab === 'recruiting' && (
          <RecruitingPanel
            view={view}
            visitsQueued={visitsQueued}
            onQueueVisit={queueVisit}
            onCommit={onCommit}
            onDecommit={onDecommit}
            onSign={onSign}
          />
        )}
        {tab === 'rankings' && <RankingsPanel view={view} />}
        {tab === 'people' && (
          <PeoplePanel
            people={view.people}
            monthsElapsed={view.monthsElapsed}
            money={view.money}
            onInteract={onInteract}
          />
        )}
        {tab === 'activities' && (
          <ActivitiesPanel
            money={view.money}
            stage={view.stage}
            assets={view.assets}
            social={view.social}
            monthsElapsed={view.monthsElapsed}
            onBuy={onBuy}
            onJoin={onJoinPlatform}
            onPost={onPost}
          />
        )}
        {tab === 'life' && <LifePanel view={view} />}
        {tab === 'archive' && (
          <CareerArchive view={view} exportText={exportText} />
        )}
      </div>

      <button
        type="button"
        onClick={onNextMonth}
        disabled={saving}
        className="mt-10 rounded-md bg-orange-600 px-6 py-3 text-lg font-medium hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
      >
        {saving ? 'Saving…' : 'Play the month →'}
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'bad' | undefined;
}) {
  return (
    <div className="bg-neutral-950 px-3 py-3">
      <dt className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-lg tabular-nums ${
          tone === 'bad' ? 'text-red-400' : 'text-neutral-100'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{value}</dd>
    </div>
  );
}
