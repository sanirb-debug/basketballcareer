import { useState } from 'react';
import {
  ASSETS,
  PLATFORMS,
  POST_KINDS,
  canBuy,
  canPost,
  formatFollowers,
  platformById,
  totalFollowers,
  type AssetCategory,
  type PostKind,
} from '../engine/activities';
import type {
  CareerStage,
  OwnedAsset,
  SocialAccount,
  SocialPlatformId,
} from '../engine/types';
import type { PublicView } from '../engine/selectors';
import type { NightId } from '../engine/nightlife';
import NightlifePanel from './NightlifePanel';

/**
 * Activities (SPEC §6, §12) — the things to do with a month that are not a
 * training rep.
 *
 * Two halves. **Buy** is what the money is for: most of the catalog converts
 * dollars into training rate, energy or durability, so being paid actually
 * changes how the career develops rather than just incrementing a number.
 * **Social** converts on-court results into reach, and reach into hype.
 *
 * Neither spends an action point. They are capped by money and by one post
 * per platform per month.
 */

interface Props {
  view: PublicView;
  money: number;
  stage: CareerStage;
  assets: OwnedAsset[];
  social: SocialAccount[];
  monthsElapsed: number;
  onBuy: (assetId: string) => void;
  onJoin: (platformId: SocialPlatformId) => void;
  onPost: (platformId: SocialPlatformId, kind: PostKind) => void;
  onGoOut: (nightId: NightId) => void;
}

const CATEGORIES: { id: AssetCategory; title: string; blurb: string }[] = [
  {
    id: 'training',
    title: 'Training',
    blurb: 'Buys reps you would not otherwise get.',
  },
  {
    id: 'gear',
    title: 'Gear',
    blurb: 'Small, cheap, and it adds up over ten years.',
  },
  {
    id: 'life',
    title: 'Life',
    blurb: 'Some of it helps. Some of it is just the point of all this.',
  },
];

export default function ActivitiesPanel({
  view,
  money,
  stage,
  assets,
  social,
  monthsElapsed,
  onBuy,
  onJoin,
  onPost,
  onGoOut,
}: Props) {
  const [posting, setPosting] = useState<SocialPlatformId | null>(null);
  const reach = totalFollowers(social);

  return (
    <div className="space-y-10">
      {view.nightlife.unlocked && (
        <NightlifePanel view={view} onGoOut={onGoOut} />
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Social
          </h3>
          <p className="text-sm tabular-nums text-neutral-500">
            {formatFollowers(reach)} followers across {social.length} account
            {social.length === 1 ? '' : 's'}
          </p>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          Reach follows results. Posting a highlight when you have not had one
          does close to nothing — and talking travels either way.
        </p>

        <ul className="mt-3 divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
          {PLATFORMS.map((platform) => {
            const account = social.find((a) => a.id === platform.id);
            const postable = account && canPost(account, monthsElapsed);

            return (
              <li
                key={platform.id}
                className="flex items-center gap-4 bg-neutral-950 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-neutral-100">
                      {platform.label}
                    </span>
                    {account && (
                      <span className="text-xs tabular-nums text-neutral-500">
                        {formatFollowers(account.followers)}
                        {account.viralPosts > 0 &&
                          ` · ${account.viralPosts} viral`}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {platform.detail}
                  </p>
                </div>

                {account ? (
                  <button
                    type="button"
                    disabled={!postable}
                    onClick={() => setPosting(platform.id)}
                    className="shrink-0 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:text-neutral-700"
                  >
                    {postable ? 'Post' : 'Posted'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onJoin(platform.id)}
                    className="shrink-0 rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-700"
                  >
                    Sign up
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {CATEGORIES.map((category) => {
        const items = ASSETS.filter((a) => a.category === category.id);
        return (
          <section key={category.id}>
            <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              {category.title}
            </h3>
            <p className="mt-1 text-xs text-neutral-600">{category.blurb}</p>

            <ul className="mt-3 divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
              {items.map((def) => {
                const owned = assets.some((a) => a.id === def.id);
                const check = canBuy(def, assets, money, stage);
                const perks = [
                  def.trainingBonus &&
                    `+${Math.round((def.trainingBonus - 1) * 100)}% training`,
                  def.energyPerMonth && `+${def.energyPerMonth} energy/mo`,
                  def.injuryFactor &&
                    `−${Math.round((1 - def.injuryFactor) * 100)}% injury`,
                  def.hypePerMonth && `+${def.hypePerMonth} hype/mo`,
                ].filter(Boolean) as string[];

                return (
                  <li
                    key={def.id}
                    className="flex items-center gap-4 bg-neutral-950 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={`font-medium ${
                            owned ? 'text-neutral-500' : 'text-neutral-100'
                          }`}
                        >
                          {def.label}
                        </span>
                        {perks.length > 0 && (
                          <span className="text-xs text-emerald-500/80">
                            {perks.join(' · ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        {def.detail}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm tabular-nums text-neutral-400">
                        ${def.price.toLocaleString()}
                      </div>
                      {owned ? (
                        <span className="text-xs text-neutral-600">Owned</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!check.ok}
                          onClick={() => onBuy(def.id)}
                          title={check.reason}
                          className="mt-1 rounded-md bg-neutral-800 px-3 py-1 text-xs text-neutral-200 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-neutral-700"
                        >
                          {check.ok ? 'Buy' : check.reason}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {posting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-950 p-6">
            <h3 className="text-lg font-medium text-neutral-100">
              Post to {platformById(posting).label}
            </h3>
            <ul className="mt-5 space-y-2">
              {POST_KINDS.map((kind) => (
                <li key={kind.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPost(posting, kind.id);
                      setPosting(null);
                    }}
                    className="w-full rounded-lg border border-neutral-800 px-4 py-3 text-left transition hover:border-neutral-600"
                  >
                    <span className="block text-sm text-neutral-100">
                      {kind.label}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {kind.detail}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPosting(null)}
              className="mt-5 w-full rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
