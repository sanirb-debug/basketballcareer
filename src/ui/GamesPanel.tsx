import type { GameRecord } from '../engine/types';

interface Props {
  games: GameRecord[];
  playoff: boolean;
}

export default function GamesPanel({ games, playoff }: Props) {
  if (games.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
        {playoff ? 'Postseason' : 'Last month'}
      </h2>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-neutral-600">
            <th className="pb-2 font-medium">Opponent</th>
            <th className="pb-2 text-center font-medium">Result</th>
            <th className="pb-2 text-right font-medium">Min</th>
            <th className="pb-2 text-right font-medium">Pts</th>
            <th className="pb-2 text-right font-medium">Reb</th>
            <th className="pb-2 text-right font-medium">Ast</th>
            <th className="pb-2 text-right font-medium">FG</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {games.map((game) => (
            <tr key={game.id} className="border-t border-neutral-900">
              <td className="py-1.5 text-neutral-300">
                {game.home ? '' : '@ '}
                {game.opponent}
                {game.playoff && (
                  <span className="ml-2 rounded bg-amber-950 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-400">
                    Playoff
                  </span>
                )}
              </td>
              <td className="py-1.5 text-center">
                <span className={game.win ? 'text-emerald-400' : 'text-red-400'}>
                  {game.win ? 'W' : 'L'}
                </span>{' '}
                <span className="text-neutral-500">
                  {game.teamScore}–{game.oppScore}
                </span>
              </td>
              {game.note ? (
                <td colSpan={5} className="py-1.5 text-right text-neutral-600">
                  {game.note}
                </td>
              ) : (
                <>
                  <td className="py-1.5 text-right text-neutral-400">
                    {game.box.minutes}
                  </td>
                  <td className="py-1.5 text-right font-medium text-neutral-100">
                    {game.box.points}
                  </td>
                  <td className="py-1.5 text-right text-neutral-400">
                    {game.box.rebounds}
                  </td>
                  <td className="py-1.5 text-right text-neutral-400">
                    {game.box.assists}
                  </td>
                  <td className="py-1.5 text-right text-neutral-500">
                    {game.box.fgm}/{game.box.fga}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
