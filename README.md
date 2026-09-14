# RuneChain

A real-time 1v1 chain-casting duel, built to the spec in
[RUNECHAIN-DESIGN.md](https://gist.github.com/u9g/de18f34c442d60f7069c1f324c076666).
The game is a browser app sized for a phone; the iOS app is a thin Swift wrapper
around it.

```
web/     the game — vanilla JS, one canvas, no build step
ios/     WKWebView wrapper (xcodegen + SwiftUI)
tools/   headless sim, balance sweeps, rule tests, icon render
```

## Run

```sh
cd web && python3 -m http.server 8731     # then open http://localhost:8731
node tools/test.js                        # 19 rule tests over the [LOCKED] mechanics
node tools/sim.js 300                     # AI-vs-AI balance probe
```

## Build the app

```sh
cd ios && xcodegen generate && open RuneChain.xcodeproj
```

`web/` is bundled as a folder reference, so editing the web files and rebuilding
is all that is needed — no copy step. The wrapper does three things: full-bleed
WKWebView with scrolling and zoom off, portrait-only, and a `haptic` message
handler that maps the web side's vibration calls onto `UIImpactFeedbackGenerator`.
The web layout owns the safe area via `env(safe-area-inset-*)`.

## Scope

Built: milestones M1–M3. One board per side, the full chain gesture, cast time
and telegraph, strike/ward/mend resolution, per-family ascension across four
tiers, six heroes with rule-bending passives, the 16-slot affinity-filtered
loadout editor, and the live opponent mirror against a local AI that reveals its
drag progressively (the M2 kill gate).

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
