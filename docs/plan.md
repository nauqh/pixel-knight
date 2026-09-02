# Pixel Knight — Product Plan

**Decision: free forever. No monetization.** The knight is a gift to the community.
Success = installs, retention, love, word of mouth. Money is not a goal.

---

## 1. Position

> "Your code, as an island. Bugs land as raiders, unfinished work is carried
> across the fields, and the settlement you've built is the work you've shipped."

The knight is not a pet you play with. There is nothing to click, feed or steer.

**The island is a readout of your codebase.** Your code is the controller. You
glance at the sidebar the way you glance out of a window — and what you see is
true, right now, about the repo you're in.

Two axes, and keeping them separate is the whole design:

> **The island's activity is your code right now.
> The island's size is your history.**

How busy it is tells you the state of your work this minute. How built-up it is
tells you the months you've put in.

## 2. Current state (what exists)

An ambient scene with seven reflexes bolted on. The scene is the good part.

### 2.1 The island is a settlement, not one knight

| Who | Where | Behaviour |
|---|---|---|
| Warrior — *the* knight | wanders the lower band | the only unit that reacts to the editor |
| Pawn | wanders a smaller patch | villager, ambient |
| Archer | wanders, only if island area ≥ 90 | ambient |
| Sheep | wanders the bottom edge | ambient |
| Warrior ×2 | garrison, on castle and barracks decks | static, rides the building |
| Archer | garrison, on the tower deck | static, rides the building |

Up to **three Warriors and two Archers** on screen at once. Below, "the knight"
means only the wandering Warrior; everyone else is the cast. This is an asset: a
settlement can be besieged and can grow, where a lone pet can only be watched.

### 2.2 The seven reflexes, and why they fail

| Trigger | Result | Duration |
|---|---|---|
| Save file | Attack1 | 333ms |
| 8 edits in 2s | Attack1 | 333ms |
| Error count rises | Guard | 600ms |
| ≥10 errors | Guard, held | 600ms |
| Errors → 0 | Attack2 | 333ms |
| Git HEAD changes | Attack2 | 333ms |
| Idle 60s | Guard | 600ms |

Normal typing is 5–8 keystrokes per second and every one is a `contentChange`, so
the burst hook fires **roughly every 1.2 seconds, continuously, while you type**.
Diagnostics fire Guard on every *rise* in the error count, and mid-typing your
syntax is broken constantly, so that machine-guns too.

Meanwhile `mode === "reaction"` sets `knight.moving = false`. So while you type,
the knight stops walking and twitches — swing, stand, swing, stand — and your eyes
are on the editor the entire time.

**Three of the seven hooks fire during typing, when nobody is looking at the
sidebar, and they interrupt the one behaviour that is legible: the wandering.**

It is not a size problem. The Warrior frame is 192px native, halved to 96px, and a
300px sidebar renders at `Z=1` — he is a third of the pane wide. The failure is
timing. A sidebar is peripheral; anything that exists for 333ms is missed by
construction.

Also missing: **nothing is remembered.** Close VS Code → everything resets.

### 2.3 Constraints the build must respect

**The webview is stateless and disposable.** `resolveWebviewView` rebuilds the HTML
every time the view resolves, there is no `retainContextWhenHidden`, and messages
flow host → webview only. Collapse the sidebar and every variable in
`companion.js` is gone.

→ **The extension host owns all state; the webview is a pure renderer.** Do not
reach for `retainContextWhenHidden: true` to dodge this — it costs memory
permanently and only hides the fact that state is in the wrong place.

**The pack contains no monsters.** `Units/` has Archer, Lancer, Monk, Pawn and
Warrior in Black, Blue, Purple, Red and Yellow. No creatures.

→ **Raiders are the Red faction.** Red Warrior ships the same sheet set the
player's knight uses, so the existing `makeUnit` / `updateUnit` movement drives an
enemy with no new code, and `COLOUR_DIRS` already resolves a faction directory. No
new art, no `monsters/` directory.

**`countErrors()` returns a count, not identities.** Fix one error while another
appears and the count is flat — the kill is silently lost.

→ Diagnostics are keyed `${uri}:${range.start.line}:${code}` in a `Map`. Key
appears → spawn. Key disappears → that raider dies.

**The island is small.** In a 300px sidebar the walk band is roughly 220px wide and
already holds four figures.

→ **Cap raiders at 3 and haulers at 3.** Past the cap, one figure means "many" and
the real number lives in the status bar. Crowding turns the scene into mush.

## 3. Principles (non-negotiables)

1. **No monetization. Ever.** No store, no Pro tier, no ads, no nagging.
2. **No dark patterns.** No guilt streaks, no "come back or your pet dies".
3. **Runs entirely locally.** No accounts, no telemetry, no login. State lives in
   VS Code's own `globalState`. Private by design — a first-class marketing point.
4. **Zero config.** Works the moment it's installed. Nothing the user already
   controls may be taken away and sold back as a reward.
5. **Persistent over transient.** Everything the island shows must still be true
   thirty seconds later. Instant feedback belongs in the status bar, which is in
   your field of view while you code. The island is glanceable, so it carries state.
6. **Nothing to operate.** No clicking, feeding or steering. The code is the input.

## 4. The design

### 4.1 The mapping

| Your code | The island | Sprites — all already vendored |
|---|---|---|
| Errors > 0 | Red **Warriors** land. Knight charges, garrison archer covers | `Red Units/Warrior/*`, `Archer_Shoot`, `Arrow` |
| Warnings > 0 | Red **Pawns** loiter at the shoreline. Nobody engages them | `Red Units/Pawn/Pawn_Idle` |
| Uncommitted files | Your Pawns **haul wood and gold** toward the castle | `Pawn_Run Wood`, `Pawn_Idle Gold`, `Pawn_Interact Hammer` |
| Commit | Haul delivered, pawns walk back empty | existing Run / Idle |
| Clean, no errors | Peace. Cast wanders, sheep grazes | already built |

Counts scale to the caps in §2.3. Warnings are deliberately *ignored* by the
cast — that reads as "known about, not urgent" without a word of UI.

The hauling mapping is the one to protect. Those carry-variant Pawn sheets sit
unused in the pack, and "work in progress is literally being carried across the
island" needs no explanation to anyone who sees it once.

### 4.2 The fight — same sheets, opposite triggering

The Attack and Guard sheets are not the problem; the reflexes were. A 333ms swing
fired by a keystroke is a twitch. A swing **looped for as long as the errors
exist** is a battle you can walk away from and come back to.

| Sheet | Old use | New use |
|---|---|---|
| Guard | 600ms blip on every diagnostic rise | **held** while raiders stand and the knight has not closed |
| Attack1 | 333ms twitch every 1.2s of typing | **looped** while the knight is adjacent to a raider |
| Attack2 | blip on save and commit | one-shot when the **last** raider falls |
| Idle / Run | ambient | unchanged |

A raider dies when its diagnostic key disappears: the knight walks it down, it
pops on the existing `dust` sheet, `bugsSlain += 1`. All clear → Attack2, and the
Monk's `Heal_Effect.png` over the island.

While raiders stand, the rest of the cast changes state too — the Pawn stops
hauling and takes cover, the garrison Warriors hold Guard on their decks. A
settlement under attack should look like one. Every unit already draws through the
same sprite path, so this is a state flag, not a system.

**This also dissolves the "which of the three Warriors is mine" problem.** In a
fight the knight is the one who charges. Motion names him. No marker needed.

### 4.3 Persistence — the history layer

- `context.globalState` holds `xp`, `level`, `streakDays`, `lastSeenDay`,
  `bugsSlain`, `commits`, `focusSeconds`. Survives restarts, shared across
  workspaces — the identity is the user's, not the workspace's.
- One typed wrapper (`store.ts`) is the only thing that touches `globalState`.
  Whole-object writes, no partial updates scattered through the hooks.
- XP sources: save +5, commit +15, a raider felled +20, five minutes of activity
  +10. Every award goes through one `award(reason, amount)` so cooldowns, dedupe
  and write-batching live in one place.
- Levels: `xpForLevel(n) = 100 * n²`. Cheap at first, slower later.
- **XP is never animated.** It is a number in the status bar and a bar in the Hall.
  The island expresses it structurally, below.

### 4.4 Progression — the settlement grows

The pack has no armour-trim variants of the Warrior, so "the knight's look
upgrades" would mean drawing new sprites. The licence permits it; it is still art
work, not a free win. What the pack gives for nothing:

- **Levels gate buildings.** Put a building in the layout and its garrison arrives
  with it — `GARRISON_NATIVE` already rides the decor, sorted and drawn, with no
  new code. Early levels add the Archery, then a second tower. Later, Lancer and
  Monk posts; both units are in the pack and unused today.
- **New factions unlock.** Purple and Yellow are complete and unused. They become
  level rewards, while `pixelKnight.colour` stays a free user setting — a setting
  the user already has must not become a locked prize (principle 4).

Level is therefore read off the island at a glance: a bare rock early, a walled
settlement with a full garrison later. Persistent, and you notice it tomorrow —
which is exactly right for a peripheral surface.

### 4.5 Streaks (gentle)

- A streak day is earned by any commit or ≥15 minutes of activity.
- Status bar shows "🔥 12". Nothing more.
- No loss guilt. If broken, silently restart at 0.

### 4.6 Events (surprise = return visits)

- Weekday: small chance of a duck wandering through (`Rubber duck.png`, already in
  the scene manifest).
- Seasonal: Halloween, Christmas, New Year fireworks.
- Sparse on purpose. Predictability kills it.
- Lowest priority in the plan. First to cut if the schedule slips.

### 4.7 Surfaces

**The status bar is the numbers.** It is visible without opening the sidebar, which
is where users spend the day. `$(shield) Warrior` becomes `$(shield) Lv 4 · 🔥 7`,
tooltip a `MarkdownString` with the full ledger. Roughly thirty lines for the
largest felt change in the plan — so it ships early, not late.

**Knight's Hall is the detail.** Level, XP bar, bugs slain, streak, commits, focus
time. A `WebviewPanel` behind a command, not a second sidebar view. Its art is all
vendored and unused: `Papers/RegularPaper.png` as the backdrop, `Icons/Icon_01–12`
for the rows, `Human Avatars/` for the portrait.

## 5. Architecture

```
src/
  extension.ts     — watchers, ledger, world-state derivation
  store.ts         — NEW: globalState wrapper (typed, whole-object writes)
  stats.ts         — NEW: Knight's Hall panel
media/
  companion.js     — add: raiders, haulers, fight state machine, fx list
```

**`play` dies; `world` replaces it.** The host stops issuing animation commands and
starts publishing state:

```
{ type: "world", errors: [key…], warnings: n, dirty: n, level: n }
```

Full snapshot when the view resolves, deltas after, debounced to at most one
message per second. The webview derives every animation from it and decides
nothing on its own. State flows one way; the webview never persists.

Deleted outright: the typing-burst hook, save → animation, idle fidget, the
`braced` flag, `BRACE_ERROR_THRESHOLD`, `FIDGET_COOLDOWN_MS`, and `play()` itself.

Prerequisite for the deaths: generalise the existing one-shot `dust` list into a
generic `fx` list. It is already the right shape — spawn, age out, draw sorted.

New scene assets to register, all already vendored: `Heal_Effect.png`,
`BigBar_Base.png`, `BigBar_Fill.png`, `Banner.png`.

## 6. Distribution (free growth)

1. **Marketplace launch** — polished icon, animated GIF demo, honest description.
   Blocked until `package.json` gains a `publisher` field; `vsce` refuses without one.
2. **Shareable stat card** — a command copying
   `⚔️ lvl 12 · 505 bugs slain · 21-day streak — my VS Code knight (Pixel Knight)`
   to the clipboard. Devs flex; every paste is a free install. The cheapest growth
   lever there is and about fifteen lines — so it ships with the ledger, not last.
3. **Launch posts**: r/vscode, r/programming, Product Hunt, X, YouTube Shorts. The
   demo GIF writes itself: split screen, errors appearing in the editor on one
   side, raiders landing on the other.
4. **Open source** — repo public, MIT for the code. The Tiny Swords licence forbids
   redistributing the assets, so going public means the pack leaves git and the
   README gains a download step. Decide before the first public push — assets
   already committed must be rewritten out of history, not merely deleted.
5. **README badge** — generated locally. Later, only if installs justify it.

## 7. Non-goals (explicit)

- ❌ Any payment, store, Pro tier, ads, sponsored content
- ❌ Accounts, cloud sync, telemetry, login
- ❌ Productivity features (metrics for managers, code analytics)
- ❌ Tamagotchi death/guilt mechanics
- ❌ Anything the user clicks, feeds or steers — the code is the only input
- ❌ Drawing new sprites. Everything ships from what the pack already contains

## 8. Milestones

| # | Build | Time |
|---|---|---|
| 1 | `store.ts`, the `world` message, strip the seven reflexes | ~2 days |
| 2 | Errors → red Warriors, held Guard, looped Attack1, death on key vanish | ~3 days |
| 3 | Dirty files → hauling Pawns; warnings → loitering red Pawns | ~2 days |
| 4 | XP ledger + status bar HUD + stat card | ~2 days |
| 5 | Levels gate buildings, garrison rides along, faction unlocks | ~2 days |
| 6 | Gentle streak + Knight's Hall | ~2 days |
| 7 | Events | ~1 day |
| 8 | Launch: publisher field, marketplace, README, GIF, posts | ~2 days |

Total ~16 focused days.

**Milestone 2 is the product.** After it, the island already reflects your code and
the extension is worth installing. Everything from 3 on is depth. If the schedule
collapses, ship after 4.

Milestone 1 is load-bearing — every later milestone assumes host-owned state and
the `world` message. Nothing else starts until it lands.

## 9. First user feedback loop

After launch, wait 2–3 weeks. Watch:

- Install count and uninstall rate (marketplace analytics)
- GitHub issues asking for **more** — the best signal there is
- Don't add features; fix what stops people returning.

Growth is doing the boring loop well, not adding shiny.

---

*Free forever. Made with love. The knight fights for you.*
