import { useEffect, useRef, useState } from 'react';
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
import type { NightId, PartyId } from '../engine/nightlife';
import type { DateId, IntimacyId, WeddingTierId } from '../engine/dating';

import ActionPicker from './ActionPicker';
import ActivitiesPanel from './ActivitiesPanel';
import AttributesPanel from './AttributesPanel';
import BigChoicesPanel from './BigChoicesPanel';
import CareerArchive from './CareerArchive';
import CareerPanel from './CareerPanel';
import DatingPanel from './DatingPanel';
import GamesPanel from './GamesPanel';
import LifePanel from './LifePanel';
import NightlifePanel from './NightlifePanel';
import PeoplePanel from './PeoplePanel';
import RankingsPanel from './RankingsPanel';
import RecruitingPanel from './RecruitingPanel';

/**
 * The life screen (SPEC §17).
 *
 * A life sim is a diary you scroll, not a dashboard you read. So the month
 * screen is now a narrative feed: every month appends its lines under a date
 * header, in first person, and the whole run reads back as one continuous
 * story. Everything else — the ratings, the recruiting board, the people, the
 * money — lives behind a bottom nav and opens as a sheet over the feed.
 *
 * The structure is deliberately borrowed from the genre's best-known example,
 * because the shape is the genre: one big button that advances time, a feed
 * above it, and a permanent row of meters underneath so the cost of every
 * choice is visible without opening anything.
 *
 * What is *not* borrowed is the action economy. This game asks the player to
 * spend a month, not just live through it, so the strip above the button
 * shows what has been committed and the button refuses to advance until the
 * blocking decisions are answered.
 */

type Sheet = 'career' | 'money' | 'people' | 'activities' | null;

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
  onGoOut: (nightId: NightId) => void;
  onMeetPeople: () => void;
  onAskOut: (candidateId: string) => void;
  onDate: (dateId: DateId) => void;
  onStayOver: (intimacy: IntimacyId) => void;
  onPropose: () => void;
  onMarry: (tier: WeddingTierId) => void;
  onParty: (partyId: PartyId) => void;
}

/** What the identity bar calls you right now. */
function titleFor(view: PublicView): string {
  if (view.pro) return `${view.pro.role} · ${view.pro.teamName}`;
  if (view.college) {
    return `${view.college.programName} · Year ${view.college.year}`;
  }
  if (view.stage === 'highschool') {
    return `${view.gradeLabel} · ${view.school.name}`;
  }
  return view.stageLabel;
}

const KIND_TONE: Record<string, string> = {
  game: 'text-sky-700 dark:text-sky-300',
  growth: 'text-emerald-700 dark:text-emerald-300',
  injury: 'text-red-700 dark:text-red-300',
  recruiting: 'text-violet-700 dark:text-violet-300',
  hype: 'text-amber-700 dark:text-amber-300',
  life: 'text-rose-700 dark:text-rose-300',
  academics: 'text-teal-700 dark:text-teal-300',
};

export default function LifeScreen(props: Props) {
  const { view, chosen, saving, onNextMonth, onExit } = props;
  const [sheet, setSheet] = useState<Sheet>(null);
  const feedEnd = useRef<HTMLDivElement>(null);

  // The feed is a diary: new months arrive at the bottom and the view follows
  // them, the way a chat does.
  useEffect(() => {
    feedEnd.current?.scrollIntoView({ block: 'end' });
  }, [view.monthsElapsed]);

  const blocked = view.pendingEvent !== null || view.awaitingPath;
  const spent = chosen.length;
  const points = view.actionPoints;

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-[80rem] flex-col overflow-hidden bg-neutral-950 lg:border-x lg:border-neutral-800">
      {/* --- App bar ------------------------------------------------------ */}
      <header className="flex shrink-0 items-center justify-between bg-orange-600 px-4 py-2.5">
        <span className="text-lg font-black tracking-tight text-white">
          HOOP<span className="text-orange-200">LIFE</span>
        </span>
        <button
          type="button"
          onClick={onExit}
          className="rounded px-2 py-1 text-xs font-medium text-orange-100 transition hover:bg-orange-700"
        >
          Save &amp; exit
        </button>
      </header>

      {/* --- Identity ----------------------------------------------------- */}
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-600 text-lg">
          🏀
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-neutral-50">
            {view.player.name}
          </div>
          <div className="truncate text-xs text-neutral-400">
            {titleFor(view)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-emerald-400">
            ${view.money.toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">
            {view.date}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 lg:gap-0">
      <div className="flex min-h-0 flex-1 flex-col lg:border-r lg:border-neutral-800">
      {/* --- The feed ----------------------------------------------------- */}
      {/*
        Chat layout: `justify-end` on a scrolling flex column pins short
        content to the bottom, so a new career starts with its first month
        just above the button rather than stranded at the top of an empty
        screen. Long careers scroll normally.
      */}
      <div className="flex flex-1 flex-col justify-end overflow-y-auto bg-neutral-950 px-4 py-4">
        {view.feed.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nothing has happened yet. Play the month.
          </p>
        )}
        {view.feed.map((block) => (
          <section key={block.monthsElapsed} className="mb-5 shrink-0">
            <h2 className="mb-1 text-sm font-bold text-orange-500">
              {block.date}
            </h2>
            <ul className="space-y-0.5">
              {block.lines.map((line, i) => (
                <li
                  key={i}
                  className={`text-[15px] leading-snug ${
                    KIND_TONE[line.kind] ?? 'text-neutral-300'
                  }`}
                >
                  {line.text}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div ref={feedEnd} />
      </div>

      {/* --- What this month is committed to ------------------------------ */}
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-900 px-4 py-2">
        <button
          type="button"
          onClick={() => setSheet('activities')}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-1.5">
            {Array.from({ length: points }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-6 rounded-full ${
                  i < spent ? 'bg-orange-500' : 'bg-neutral-700'
                }`}
              />
            ))}
          </span>
          <span className="text-xs text-neutral-400">
            {view.phase} · {spent} of {points} planned
            <span className="ml-2 text-orange-400">Plan →</span>
          </span>
        </button>
      </div>

      {/* --- Bottom nav --------------------------------------------------- */}
      <nav className="relative flex shrink-0 items-stretch border-t border-neutral-800 bg-neutral-900">
        <NavButton
          label="Career"
          icon="💼"
          onClick={() => setSheet('career')}
        />
        <NavButton label="Money" icon="💰" onClick={() => setSheet('money')} />

        <div className="relative w-24 shrink-0">
          <button
            type="button"
            onClick={onNextMonth}
            disabled={saving || blocked}
            className="absolute -top-5 left-1/2 flex h-[4.5rem] w-[4.5rem] -translate-x-1/2 flex-col items-center justify-center rounded-full border-4 border-neutral-900 bg-orange-600 shadow-lg transition hover:bg-orange-500 disabled:bg-neutral-700 disabled:text-neutral-500"
          >
            <span className="text-2xl font-black leading-none text-white">
              +
            </span>
            <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {saving ? '…' : 'Month'}
            </span>
          </button>
        </div>

        <NavButton
          label="People"
          icon="❤️"
          onClick={() => setSheet('people')}
        />
        <NavButton
          label="Activities"
          icon="🏋️"
          onClick={() => setSheet('activities')}
        />
      </nav>

      {/* --- Meters ------------------------------------------------------- */}
      <div className="shrink-0 space-y-1 border-t border-neutral-800 bg-neutral-900 px-4 py-2.5">
        <Meter label="Overall" value={view.player.overall} tone="orange" />
        {view.nightlife.unlocked && (
          <Meter
            label="Focus"
            value={100 - view.nightlife.distraction}
            tone="sky"
          />
        )}
        <Meter label="Trust" value={view.coachTrust} tone="violet" />
        <Meter label="Fame" value={view.rankings.hype} tone="amber" />
      </div>
      </div>

      {/*
        Desktop gets the sheets as a permanent second column instead of an
        overlay: on a 1400px screen a phone-width app with 900px of empty
        either side is the wrong answer, and the panels are the thing there
        is room for.
      */}
      <aside className="hidden min-h-0 w-[26rem] shrink-0 flex-col lg:flex xl:w-[34rem]">
        <div className="flex shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-900 px-2">
          {(['career', 'money', 'people', 'activities'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSheet(id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-medium uppercase tracking-wide transition ${
                (sheet ?? 'activities') === id
                  ? 'border-orange-500 text-neutral-100'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {sheetTitle(id)}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <SheetBody sheet={sheet ?? 'activities'} {...props} />
        </div>
      </aside>
      </div>

      {/* The overlay is the small-screen presentation only. */}
      {sheet && (
        <div className="lg:hidden">
          <SheetView title={sheetTitle(sheet)} onClose={() => setSheet(null)}>
            <SheetBody sheet={sheet} {...props} />
          </SheetView>
        </div>
      )}
    </div>
  );
}

function sheetTitle(sheet: Exclude<Sheet, null>): string {
  return {
    career: 'Career',
    money: 'Money',
    people: 'Relationships',
    activities: 'Activities',
  }[sheet];
}

function NavButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition hover:bg-neutral-800"
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
    </button>
  );
}

const TONE: Record<string, string> = {
  orange: 'bg-orange-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
};

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-medium text-neutral-400">
        {label}
      </span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <span
          className={`block h-full rounded-full ${TONE[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
        {pct}
      </span>
    </div>
  );
}

/** A full-height sheet over the feed. */
function SheetView({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 mx-auto flex h-[100dvh] max-w-[28rem] flex-col bg-neutral-950">
      <header className="flex shrink-0 items-center justify-between bg-orange-600 px-4 py-2.5">
        <span className="text-base font-bold text-white">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-3 py-1 text-sm font-medium text-orange-100 transition hover:bg-orange-700"
        >
          Done
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-5">{children}</div>
    </div>
  );
}

/** Which existing panels each sheet is made of. */
function SheetBody({ sheet, ...props }: Props & { sheet: Exclude<Sheet, null> }) {
  const { view, chosen, onChange } = props;
  const inHighSchool = view.stage === 'highschool';

  const visitsQueued = chosen
    .filter((a) => typeof a !== 'string' && a.id === 'visit')
    .map((a) => (typeof a === 'string' ? '' : (a.target ?? '')));

  const queueVisit = (programId: string) => {
    if (chosen.length >= view.actionPoints) return;
    onChange([...chosen, { id: 'visit', target: programId }]);
  };

  if (sheet === 'career') {
    return (
      <div className="space-y-10">
        <GamesPanel
          games={view.gamesThisMonth}
          playoff={view.gamesThisMonth.some((g) => g.playoff)}
        />
        {inHighSchool ? (
          <>
            <RecruitingPanel
              view={view}
              visitsQueued={visitsQueued}
              onQueueVisit={queueVisit}
              onCommit={props.onCommit}
              onDecommit={props.onDecommit}
              onSign={props.onSign}
            />
            <RankingsPanel view={view} />
          </>
        ) : (
          <CareerPanel
            view={view}
            onRedshirt={props.onRedshirt}
            onEnterPortal={props.onEnterPortal}
            onTransfer={props.onTransfer}
            onDeclare={props.onDeclare}
            onWithdraw={props.onWithdraw}
            onRequestTrade={props.onRequestTrade}
          />
        )}
        <BigChoicesPanel
          view={view}
          onChangePosition={props.onChangePosition}
          onTransferSchool={props.onTransferSchool}
          onReclassify={props.onReclassify}
        />
        <AttributesPanel view={view} />
        <LifePanel view={view} />
        <CareerArchive view={view} exportText={props.exportText} />
      </div>
    );
  }

  if (sheet === 'money') {
    return (
      <ActivitiesPanel
        money={view.money}
        stage={view.stage}
        assets={view.assets}
        social={view.social}
        monthsElapsed={view.monthsElapsed}
        onBuy={props.onBuy}
        onJoin={props.onJoinPlatform}
        onPost={props.onPost}
      />
    );
  }

  if (sheet === 'people') {
    return (
      <div className="space-y-12">
        {view.romance.unlocked && (
          <DatingPanel
            view={view}
            onMeetPeople={props.onMeetPeople}
            onAskOut={props.onAskOut}
            onDate={props.onDate}
            onStayOver={props.onStayOver}
            onPropose={props.onPropose}
            onMarry={props.onMarry}
            onParty={props.onParty}
          />
        )}
        <PeoplePanel
          people={view.people}
          monthsElapsed={view.monthsElapsed}
          money={view.money}
          ageYears={view.ageMonths / 12}
          onInteract={props.onInteract}
        />
      </div>
    );
  }

  // activities
  return (
    <div className="space-y-12">
      <ActionPicker
        budget={view.actionPoints}
        chosen={chosen}
        training={props.training}
        energy={view.energy}
        onChange={onChange}
      />
      {view.nightlife.unlocked && (
        <NightlifePanel view={view} onGoOut={props.onGoOut} />
      )}
    </div>
  );
}
