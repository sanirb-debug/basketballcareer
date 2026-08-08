# Hoop Life

A single-player basketball life simulation. You create a 13-year-old prospect
and live their career **month by month** — high school, recruiting, college or
JUCO or the pro-alternative routes, the draft, the league, and retirement.

**▶ Play it: https://sanirb-debug.github.io/basketballcareer/**

Everything runs in your browser. No account, no backend, no data leaves your
machine — saves live in IndexedDB.

---

## Running it locally

```bash
npm install
npm run dev
```

Then open the `http://localhost:5173` link it prints.

## The idea

You start at 13 and you do not know how tall you finish. A hidden genetic roll
decides your ceiling, and a randomised growth spurt can reshape the whole
career — you build a handle-and-floater game and wake up a 6'9" forward. The
game tells you when your body has outgrown your position; responding to that is
your call.

Every month you spend action points, and everything competes for them. Training,
rest, school, exposure, relationships, a job if your family needs the money.
Studying costs exactly what a shooting workout costs. That is the whole design.

Two things drive the rest:

- **Coach trust decides your minutes, not your talent.** You can be the best
  player in the gym and ride the bench for a season.
- **Hype is separate from skill.** A 90 overall in Montana can sit outside the
  top 150 while a 78 who dunked on somebody in July cracks the top 15.

## Where a career can end

Sixteen named endings, from the rec league to the Hall of Fame. Each one names
the specific decision that produced it, read from your actual run.

A long career as a rotation player with a ring scores above a starrier one
without — that is deliberate. Most sims only reward becoming the best player
alive; this one is built so a 6th man who lasts a decade reads as a success.

## Development

```bash
npm test              # all 237 tests
npm run verify:phase0 # …through verify:phase10, one per build phase
npm run typecheck
npm run build
```

`verify:phase10` is a balance regression test: it plays whole careers under
different policies and asserts that playing well beats playing badly by a wide
margin, that reaching the league stays an achievement rather than a formality,
and that outcomes do not collapse into a single funnel.

Built from `SPEC.md` in phases; the git history follows it phase by phase.
