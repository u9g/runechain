# RuneChain

A real-time 1v1 chain-casting duel, built to the spec in
[RUNECHAIN-DESIGN.md](https://gist.github.com/u9g/de18f34c442d60f7069c1f324c076666).
The game is a browser app sized for a phone; the iOS app is a thin Swift wrapper
around it.

**Play it: https://u9g.github.io/runechain/** — open it on a phone, or in a
desktop browser's device toolbar. It is portrait-only and touch-first.

```
web/     the game — vanilla JS, one canvas, no build step
  js/theme.js      design language: palette, element runes, role marks
  js/render.js     the battle screen
  js/tutorial.js   the scripted first duel
ios/     WKWebView wrapper (xcodegen + SwiftUI)
tools/   headless sim, balance sweeps, rule tests, screenshots, icon render
```

## Run

```sh
cd web && python3 -m http.server 8731     # then open http://localhost:8731
node tools/test.js                        # 19 rule tests over the [LOCKED] mechanics
node tools/sim.js 300                     # AI-vs-AI balance probe
node tools/tutorial-check.js              # asserts the ward lesson cannot be faked
node tools/shot.js                        # iPhone-viewport screenshots into shots/
```

The screenshot tools drive a real browser at 393×852, so they catch layout
collisions that a desktop window hides. `URL=https://… node tools/shot.js`
points them at the deployed build instead of the local server.

## Build the app

```sh
cd ios && xcodegen generate && open RuneChain.xcodeproj
```

`web/` is bundled as a folder reference, so editing the web files and rebuilding
is all that is needed — no copy step. The wrapper does three things: full-bleed
WKWebView with scrolling and zoom off, portrait-only, and a `haptic` message
handler that maps the web side's vibration calls onto `UIImpactFeedbackGenerator`.

The web layout owns the safe area, but `env(safe-area-inset-*)` reports zero
inside a WKWebView that SwiftUI has told to ignore the safe area — the board
draws under the Dynamic Island. So the wrapper reads the window's insets and
hands them to the page via `window.setSafeInsets`.

## Design

**Arcane engraving.** One dark material, etched: element colour is ink stained
into slate, gold hairlines and corner ticks frame every panel, spell names are
set in a serif and labels in tracked small caps. The genre's default is the
chunky-cartoon house style, and §6 of the spec warns against it by name.

**Every element carries a rune as well as a colour** — flame, wave, hexagon,
leaf, star — so the board is readable without relying on hue, and the same
glyphs appear on the loadout cards and the ascension track. Role is a mark
struck over the rune: blade, shield, cross. Anchors wear a gold frame and their
tier numeral, I through IV.

**Naming, everywhere.** The live chain readout above the board names the spell
under your finger, its tier and role, its exact power and cast time, and the
chain length, all before you commit. The lane names what the opponent is
winding up. Regions carry labels — *Their board*, *Ascension*. Loadout tiers
say what unlocks them and every number carries its unit.

## Tutorial

A scripted nine-step duel against a training construct, on the real engine, run
automatically on first launch and replayable from home. The board is rigged per
step and input is gated to the anchor being taught: touch an anchor, drag to
link, release to cast, chain longer, read the mirror, ward before impact, then
ascension.

The ward step is the one that matters, and it cannot be passed by warding after
the hit lands — the construct keeps striking, healing you between passes, until
a ward actually absorbs one. `tools/tutorial-check.js` asserts exactly that.

## Scope

Built: milestones M1–M3. One board per side, the full chain gesture, cast time
and telegraph, strike/ward/mend resolution, per-family ascension across four
tiers, six heroes with rule-bending passives, the 16-slot affinity-filtered
loadout editor, the live opponent mirror against a local AI that reveals its
drag progressively (the M2 kill gate), and a scripted tutorial.

Not built: M4–M6. There is no server, no campaign, no chests, economy, guilds or
ladder. The simulation is local and self-contained, which is the shape §5.3 asks
for anyway — the authoritative server in §5.1 wraps this engine rather than
replacing it.

## Deviations from the spec

Each of these changes an **[OPEN]** value; no **[LOCKED]** rule was touched.

| Spec | Built | Why |
|---|---|---|
| 10 families (5 elements × strike/guard) | 15 (5 × strike/ward/mend) | A "guard" line alternating ward and mend makes ascension charge mean two different things. One role per family keeps the §2.10 "one ward, one mend among the basics" rule a real choice. |
| Ascension 12 / 30 / 55 | 10 / 24 / 42 | At 12/30/55 the ultimate tier landed in ~2% of matches, so the §2.7 arc never completed. `tools/tune.js` |
| `baseHp` 1000 | 2800 | 1000 put matches at ~38s average against the 60–90s target in §2.9. Now ~56s. `tools/tune.js` |
| Token distribution unspecified (§8) | Drawn from the hero's 3 affinities; refills clump with settled neighbours (55%) and favour anchored elements, capped at 14 of 30 cells per element | Uniform refill left the longest available chain at ~2 tokens, which flattens the 1×–4.3× power curve to nothing. `tools/variety.js` |

Current balance, 300 AI-vs-AI matches: 56s average, every match ends on a KO
rather than the time cap, elite tier reached in 68%, ultimate in 16%.
