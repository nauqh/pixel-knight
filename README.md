# Pixel Knight

![VS Code](https://img.shields.io/badge/VS%20Code-1.90-blue?colorA=363a4f&colorB=8aadf4&style=for-the-badge&logo=visualstudiocode&logoColor=cad3f5)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?colorA=363a4f&colorB=b7bdf8&style=for-the-badge&logo=typescript&logoColor=cad3f5)
![esbuild](https://img.shields.io/badge/esbuild-0.23-blue?colorA=363a4f&colorB=eed49f&style=for-the-badge&logo=esbuild&logoColor=cad3f5)
![Canvas](https://img.shields.io/badge/Canvas-2D-blue?colorA=363a4f&colorB=8bd5ca&style=for-the-badge&logo=html5&logoColor=cad3f5)
![Tiny Swords](https://img.shields.io/badge/Tiny%20Swords-Pixel%20Frog-blue?colorA=363a4f&colorB=a6da95&style=for-the-badge&logo=itchdotio&logoColor=cad3f5)

A pixel knight who lives in your sidebar. He swings when you save, braces when
the errors pile up, and celebrates when you clear them. The whole thing is one
canvas in a webview - no accounts, no telemetry, nothing leaves your machine.

## Features

- A **terraced island** drawn from the [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords) tileset - keep on top, barracks and watchtower below, village on the ground floor
- Grass stairs cut into each cliff, on opposite sides, so the levels read as a switchback
- The knight **reacts to what you do**: saves, typing bursts, diagnostics, git commits
- Layout is computed from the pane, so the scene re-composes when you resize the sidebar instead of clipping
- Two faction colours, swapped live from settings - knight, garrison and buildings all change together
- Status bar entry opens the view, and `Pixel Knight: Focus Companion View` does the same from the command palette

## Quick start

```sh
npm install
npm run build
```

Then press **F5** in VS Code. That launches an Extension Development Host with
Pixel Knight loaded; open it from the activity bar or from the status bar.

Packaging to a `.vsix` needs two things this repo does not have yet: `vsce`
installed, and a `publisher` field in `package.json`, which `vsce` refuses to
run without.

```sh
npm i -D @vscode/vsce
npm run package                                 # produces pixel-knight-0.0.1.vsix
code --install-extension pixel-knight-0.0.1.vsix
```

## How he reacts

Every reaction is a one-shot animation that returns to Idle. Nothing is
remembered between sessions yet - see [plan.md](plan.md).

| Trigger | Animation | Note |
|---|---|---|
| Save a file | Attack1 | Fires on every `onDidSaveTextDocument` |
| Typing burst | Attack1 | 8 document changes inside 2s |
| New errors appear | Guard | Any rise in the error diagnostic count |
| Errors pile up | Guard, held | ≥10 errors, at most once per 4s |
| Errors all cleared | Attack2 | Count goes from above zero to zero |
| New commit | Attack2 | Watches `HEAD` through the built-in Git extension |
| Idle | Guard | After `idleTimeoutSeconds`, then rests 45s before fidgeting again |

## The island

Tiny Swords is authored at 1x on a 64px world grid, which is far too big for a
sidebar, so the scene is not just CSS-scaled down. Two rules hold the pixels
straight:

1. **One resample, ever.** Each sheet is drawn once into an offscreen canvas at
   half size with smoothing off. Every runtime blit then reads from that cache
   1:1. When the pane is wide enough to earn it, the whole viewport is upscaled
   by an **integer** factor - never a fraction.
2. **Integer destinations.** No sprite ever lands on a half pixel, so nothing
   shimmers as it moves.

Units are not normalised to a common body height - they are stood on the ground
contact point baked into each sprite's own shadow, which is why the Lancer
(mostly spear) comes out the right size next to the Warrior. Draw order is a
painter's sort on that same contact point.

The terrain is assembled from the pack's tilemap rather than pre-cut images: a
nine-slice for the shoreline, another for each plateau, and a stone wall row
that stands on grass. The stairs are the pack's diagonal grass ramp, two tiles
tall, and each level's edge steps down a row where the ramp meets it - without
that step the ramp reads as a mound rather than a descent.

## Configuration

| Setting | Default | Does |
|---|---|---|
| `pixelKnight.colour` | `colour1` | Faction palette. `colour1` is blue, `colour2` black. Applies to the knight, the garrison and every building at once |
| `pixelKnight.idleTimeoutSeconds` | `60` | Quiet seconds before the knight is considered idle |

Colour changes are pushed to the open view immediately - no reload.

## Development

```
src/extension.ts     activation, event hooks, webview host, asset manifest
media/companion.js   the entire renderer: layout, tilemap, animation, sprites
media/tiny-swords/   the vendored asset pack
plan.md              where this is going
```

`npm run watch` rebuilds `src/` on save. The renderer is plain browser
JavaScript with no build step of its own, so editing `media/companion.js` only
needs a reload of the Extension Development Host.

Two constants have to agree across the boundary: `ANIM_FPS` and `FRAME_COUNTS`
in `src/extension.ts` are used to time the reaction cooldowns, and must match
the per-sprite `fps` and frame counts in the `NATIVE` table in
`media/companion.js`.

## Credits

Art is the **[Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords)** pack
by **[Pixel Frog](https://pixelfrog-assets.itch.io/)**, used under the terms on
its itch.io page: free for personal and commercial work, modification allowed,
crediting optional but welcome, redistribution and resale not permitted. Every
sprite, tile and decoration in this extension comes from that pack; none of it
is mine.
