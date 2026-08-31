# Pixel Knight — Product Plan

**Decision: free forever. No monetization.** The knight is a gift to the community.
Success = installs, retention, love, word of mouth. Money is not a goal.

---

## 1. Position

> "Your code island. A pixel knight that guards your code —
> he levels up when you ship, and slays the bugs you fix."

The knight is not a toy that reacts to you.
It is a **companion with a memory** — a reason to open VS Code.

## 2. Current state (what exists)

| Habit | Trigger | Animation |
|---|---|---|
| Saving a file | `onDidSaveTextDocument` | Attack1 (celebrate) |
| Typing burst | 8 edits / 2s | Attack1 |
| Errors appear | diagnostics up | Guard (brace) |
| Enough errors | ≥10 errors | Guard + hold |
| Errors all fixed | diagnostics → 0 | Attack2 (victory) |
| Git commit | HEAD changes | Attack2 |
| Idle 60s | no activity | rest |

What's missing: **nothing is remembered.** Close VS Code → knight forgets everything.
No reason to come back. That's the whole problem.

## 3. Principles (non-negotiables)

1. **No monetization. Ever.** No store, no Pro tier, no ads, no nagging.
2. **No dark patterns.** No guilt streaks, no "come back or your pet dies" (tamagotchi
   guilt kills dev goodwill).
3. **Runs entirely locally.** No accounts, no telemetry, no login. Pet state lives in
   VS Code's own storage (`globalState`). Private by design — first-class marketing point.
4. **Zero config.** Works the moment it's installed.
5. **Reactions stay instant.** XP is earned quietly; never a popup interrupting flow.

## 4. The retention engine (what we build)

The goal: instead of "open VS Code → see knight", it becomes
"open VS Code → **check on my knight**".

### 4.1 Persistence — foundation, build first
- Store pet state in `context.globalState` (survives restarts, shared across workspaces):
  - `xp`, `level`, `streakDays`, `lastSeenDay`, `bugsSlain`, `commits`, `focusSeconds`
- Pet identity is the user's, not the workspace's.

### 4.2 XP & levels
- XP sources (all from existing hooks, no new user work):
  - Save file: +5
  - Typing burst: +2
  - Fix a bug (errors → 0): +20
  - Commit: +15
  - Focus time (typing/activity, per 5 min): +10
- Levels: `xpForLevel(n) = 100 * n²` (level 1 cheap, gets slower).
- **Evolution**: thresholds change the knight's look — armor trim, banner, then a
  faction recolour is earned (reuse existing `colour1`→`colour2` swap as the level prize).
- Level-up moment: play Attack1 + confetti burst + status bar badge. 3 seconds, then silent.

### 4.3 Bug Slayer (the hook — half-built already)
Today: ≥10 errors → guard. All fixed → victory swing.
Turn it into a visible game:
- While errors > 0, monsters appear on the island (one per error, capped).
- Knight guards while they're there.
- Errors → 0: knight sweeps through them, they poof, `bugsSlain += n`, bonus XP.
- Big number, visible forever: **bugs slain counter** in status bar tooltip and stats view.
- Pain (error spam) becomes play. Unique to this extension.

### 4.4 Streaks (gentle)
- Earn streak day if: any commit OR ≥15 min activity that day.
- Status bar shows "🔥 12" — nothing more.
- No streak-loss guilt. If broken, silently restart at 0.
- "Don't break the chain" is the strongest known retention loop in apps; we keep the
  carrot part only.

### 4.5 Events (surprise = return visits)
- Calendar-driven one-offs, all free:
  - Weekday: 5% chance of a duck wandering through.
  - Seasonal: Halloween ghost, Christmas-hat knight, New Year fireworks.
  - Rare: meteor shower night sky.
- Sparse on purpose. Surprise is the dopamine; predictability kills it.

### 4.6 Stats view
- Simple "Knight's Hall" panel: level, XP bar, bugs slain, streak, commits, focus time.
- Player doesn't need a story — needs to *see* the numbers they're growing.

## 5. Architect~UI changes

```
src/
  extension.ts     — keep all hooks; add XP/level ledger + event scheduling
  store.ts         — NEW: globalState wrapper (load/save atomic, typed)
  statsView.ts     — NEW: Hall of the Knight webview (or reuse existing view)
media/
  companion.js     — add: monsters, confetti, level-up flash, slot machine of events
  monsters/        — NEW: tiny monster sprites (reuse Tiny Swords enemies)
```

- XP events are **queued and flushed** (one `postMessage` batch per second max) so
  rapid typing never spams the webview.
- Level-up and event animations are fire-and-forget — never block a reaction.

## 6. Distribution (free growth)

1. **Marketplace launch** — polished icon, animated GIF demo, honest description.
2. **Shareable stat card** — command "copy knight's tales" → clipboard text:
   `⚔️ lvl 12 · 505 bugs slain · 21-day streak — my VS Code knight (Pixel Knight)`
   Devs flex; every paste = free install. The single cheapest growth lever.
3. **Launch posts**: r/vscode, r/programming, Product Hunt, X + TikTok/YouTube Shorts
   (pixel-art + coding genre is proven viral).
4. **Open source** — repo public, MIT. Community submits skins/events/fixes.
   GitHub stars feed the loop.
5. **README badge**: `![knight](status.svg?lvl=…)` generated locally for user's README.
   (Later; only if installs justify effort.)

## 7. Non-goals (explicit)

- ❌ Any payment, store, Pro tier, ads, sponsored content
- ❌ Accounts, cloud sync, telemetry, login
- ❌ Productivity features (metrics for managers, code analytics)
- ❌ Tamagotchi death/guilt mechanics
- ❌ Scope creep beyond the knight's island

## 8. Milestones

| # | Build | Time |
|---|---|---|
| 1 | `store.ts` persistence + XP ledger wired to existing hooks | ~3 days |
| 2 | Levels + evolution + level-up flash in `companion.js` | ~2 days |
| 3 | Bug Slayer monsters + slain counter | ~3 days |
| 4 | Gentle streak + stats view (Knight's Hall) | ~2 days |
| 5 | Events (duck, seasonal, rare) | ~2 days |
| 6 | Shareable stat card + status bar polish | ~1 day |
| 7 | Launch: marketplace, README, GIF, launch posts | ~2 days |

Total ~15 focused days to a launchable, sticky, free extension.

## 9. First user feedback loop

After launch, wait 2–3 weeks. Watch:
- Install count & uninstall rate (marketplace analytics)
- GitHub issues asking for **more** (best signal)
- Don't add features; fix what stops people returning.

Growth is doing the boring loop well, not adding shiny.

---

*Free forever. Made with love. The knight fights for you.*