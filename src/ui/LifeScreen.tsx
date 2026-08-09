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
import { ACTIONS } from '../engine/actions';
import type { ActionId } from '../engine/types';
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

/**
 * Colour carries meaning in the feed, and only where it earns it.
 *
 * Most lines are plain — if everything is coloured then nothing is. Games,
 * growth and money-adjacent news get a tint; a decision is set apart because
 * it is the one line the player wrote themselves; and milestones and injuries
 * are pulled out into cards entirely, because those are the moments you want
 * to see when you scroll back through a career.
 */
const KIND_TONE: Record<string, string> = {
  game: 'text-sky-300',
  growth: 'text-emerald-300',
  recruiting: 'text-violet-300',
  academics: 'text-teal-300/90',
  life: 'text-neutral-400',
  training: 'text-neutral-400',
  decision: 'font-medium text-neutral-100',
  system: 'text-neutral-300',
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

  // What the month is committed to, collapsed into "Shooting ×4 · Film ×2"
  // so the strip reads as a plan rather than a progress bar.
  const plan = (() => {
    const counts = new Map<string, number>();
    for (const action of chosen) {
      const id = typeof action === 'string' ? action : action.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()].map(([id, n]) =>
      n > 1 ? `${ACTIONS[id as ActionId].label} ×${n}` : ACTIONS[id as ActionId].label,
    );
  })();

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-[96rem] flex-col overflow-hidden bg-neutral-950 lg:border-x lg:border-neutral-800">
      {/* --- Header ------------------------------------------------------- */}
      <header className="shrink-0 bg-gradient-to-b from-orange-600 to-orange-700">
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <span className="text-[17px] font-black tracking-tight text-white">
            HOOP<span className="text-orange-200/90">LIFE</span>
          </span>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-orange-100/90 transition hover:bg-white/10"
          >
            Save &amp; exit
          </button>
        </div>

        <div className="flex items-end gap-3.5 px-5 pb-4 pt-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-inner">
            {view.nationality.flag}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[19px] font-semibold leading-tight text-white">
              {view.player.name}
            </div>
            <div className="truncate text-[13px] leading-tight text-orange-100/80">
              {titleFor(view)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[17px] font-semibold leading-tight tabular-nums text-white">
              ${view.money.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium uppercase leading-tight tracking-wider text-orange-100/70">
              {view.date}
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 lg:gap-0">
      <div className="flex min-h-0 flex-1 flex-col lg:border-r lg:border-neutral-800">
      {/* --- The feed ----------------------------------------------------- */}
      {/*
        Chat layout: `justify-end` on a scrolling flex column pins short
        content to the bottom, so a new career starts with its first month
        just above the button rather than stranded at the top of an empty
        screen. Long careers scroll normally.
      */}
      <div className="flex flex-1 flex-col justify-end overflow-y-auto px-5 py-6">
        {view.feed.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nothing has happened yet. Play the month.
          </p>
        )}
        {/*
          A timeline rather than a list: a hairline rail down the left with a
          date marker on it, so a career reads as one continuous thing you
          scroll rather than a stack of disconnected blocks. Line length is
          capped independently of the shell — prose stops getting more
          readable somewhere around seventy characters.
        */}
        {view.feed.map((block) => (
          <section
            key={block.monthsElapsed}
            className="relative mx-auto w-full max-w-[44rem] shrink-0 border-l border-neutral-800/70 pb-7 pl-6"
          >
            <span className="absolute -left-[4.5px] top-[7px] h-2 w-2 rounded-full bg-orange-500 ring-4 ring-neutral-950" />
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-400/90">
              {block.date}
            </h2>
            <ul className="space-y-1.5">
              {block.lines.map((line, i) => {
                const headline = line.kind === 'hype' || line.kind === 'injury';
                return (
                  <li
                    key={i}
                    className={
                      headline
                        ? `rounded-lg border px-4 py-3 text-[15px] font-medium leading-snug ${
                            line.kind === 'injury'
                              ? 'border-red-900/70 bg-red-950/30 text-red-200'
                              : 'border-amber-800/60 bg-amber-950/25 text-amber-100'
                          }`
                        : `text-[15px] leading-relaxed ${
                            KIND_TONE[line.kind] ?? 'text-neutral-300'
                          }`
                    }
                  >
                    {line.text}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <div ref={feedEnd} />
      </div>

      {/* --- What this month is committed to ------------------------------ */}
      <button
        type="button"
        onClick={() => setSheet('activities')}
        className="flex shrink-0 items-center gap-3 border-t border-neutral-800 bg-neutral-900 px-4 py-2.5 text-left transition hover:bg-neutral-800/70"
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {view.phase}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {plan.length === 0 ? (
            <span className="text-neutral-500">Nothing planned this month</span>
          ) : (
            <span className="text-neutral-200">{plan.join(' · ')}</span>
          )}
        </span>
        <span className="shrink-0 text-xs font-medium text-orange-400">
          {spent}/{points} · Plan →
        </span>
      </button>

      {/* --- Bottom nav --------------------------------------------------- */}
      {/*
        On desktop the side column already carries these four, so the row
        collapses to just the button that moves time — two identical navs a
        few hundred pixels apart was the main thing making the screen feel
        cluttered.
      */}
      <nav className="relative flex shrink-0 items-stretch justify-center border-t border-neutral-800 bg-neutral-900">
        <NavButton
          label="Career"
          icon="💼"
          onClick={() => setSheet('career')}
        />
        <NavButton label="Money" icon="💰" onClick={() => setSheet('money')} />

        <div className="relative w-24 shrink-0 lg:flex lg:w-auto lg:items-center lg:py-2">
          <button
            type="button"
            onClick={onNextMonth}
            disabled={saving || blocked}
            className="absolute -top-5 left-1/2 flex h-[4.5rem] w-[4.5rem] -translate-x-1/2 flex-col items-center justify-center rounded-full border-4 border-neutral-900 bg-orange-600 shadow-lg transition hover:bg-orange-500 disabled:bg-neutral-700 disabled:text-neutral-500 lg:static lg:h-12 lg:w-auto lg:translate-x-0 lg:flex-row lg:gap-2 lg:border-0 lg:px-10"
          >
            <span className="text-2xl font-black leading-none text-white lg:text-xl">
              +
            </span>
            <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-white lg:mt-0 lg:text-sm">
              {saving ? 'Saving…' : 'Play the month'}
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
      <div className="grid shrink-0 grid-cols-4 gap-px border-t border-neutral-800 bg-neutral-800">
        <Meter label="Overall" value={view.player.overall} tone="orange" />
        <Meter label="Trust" value={view.coachTrust} tone="violet" />
        <Meter label="Fame" value={view.rankings.hype} tone="amber" />
        {view.nightlife.unlocked ? (
          <Meter
            label="Focus"
            value={100 - view.nightlife.distraction}
            tone="sky"
          />
        ) : (
          <Meter label="Grades" value={view.academics.gpa * 25} tone="emerald" display={view.academics.gpa.toFixed(2)} />
        )}
      </div>
      </div>

      {/*
        Desktop gets the sheets as a permanent second column instead of an
        overlay: on a 1400px screen a phone-width app with 900px of empty
        either side is the wrong answer, and the panels are the thing there
        is room for.
      */}
      <aside className="hidden min-h-0 w-[26rem] shrink-0 flex-col lg:flex xl:w-[34rem] 2xl:w-[42rem]">
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
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition hover:bg-neutral-800 lg:hidden"
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

/**
 * One meter.
 *
 * Rendered as a tile with the number large enough to read at a glance rather
 * than a hairline bar with a 10px label beside it — these are the four
 * numbers that decide the career, and they were the smallest thing on the
 * screen.
 */
function Meter({
  label,
  value,
  tone,
  display,
}: {
  label: string;
  value: number;
  tone: string;
  display?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="bg-neutral-950 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          {label}
        </span>
        <span className="text-base font-semibold tabular-nums text-neutral-100">
          {display ?? pct}
        </span>
      </div>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <span
          className={`block h-full rounded-full ${TONE[tone]} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
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
    /*
      Matches the shell's own width rather than a phone's. Capping this at
      28rem meant that on an 860px window — wider than a phone, narrower than
      the two-column breakpoint — the sheet opened as a narrow strip floating
      over the feed.
    */
    <div className="fixed inset-0 z-40 mx-auto flex h-[100dvh] w-full max-w-[80rem] flex-col bg-neutral-950">
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
