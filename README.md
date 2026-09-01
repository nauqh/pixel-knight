# Pixel Knight

![VS Code](https://img.shields.io/badge/VS%20Code-1.90-blue?colorA=363a4f&colorB=8aadf4&style=for-the-badge&logo=visualstudiocode&logoColor=cad3f5)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?colorA=363a4f&colorB=b7bdf8&style=for-the-badge&logo=typescript&logoColor=cad3f5)
![esbuild](https://img.shields.io/badge/esbuild-0.23-blue?colorA=363a4f&colorB=eed49f&style=for-the-badge&logo=esbuild&logoColor=cad3f5)
![Canvas](https://img.shields.io/badge/Canvas-2D-blue?colorA=363a4f&colorB=8bd5ca&style=for-the-badge&logo=html5&logoColor=cad3f5)
![Tiny Swords](https://img.shields.io/badge/Tiny%20Swords-Pixel%20Frog-blue?colorA=363a4f&colorB=a6da95&style=for-the-badge&logo=itchdotio&logoColor=cad3f5)

A pixel knight who lives in your sidebar, on an island that is a readout of your
error diagnostics. Break the build and raiders land on the shore. Fix the errors
and the garrison cuts them down. The whole thing is one canvas in a webview - no
accounts, no telemetry, nothing leaves your machine.

## Features

- A **terraced island** drawn from the [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords) tileset - keep on top, barracks and watchtower below, village on the ground floor
- Grass stairs cut into each cliff, on opposite sides, so the levels read as a switchback
- **Raids driven by your errors** - one red raider per error, capped at three, fought off by the knight, the lancer and the tower archers
- Layout is computed from the pane, so the scene re-composes when you resize the sidebar instead of clipping
- Two faction colours, swapped live from settings - knight, garrison and buildings all change together
- Status bar entry opens the view, and `Pixel Knight: Focus Companion View` does the same from the command palette

## Install

Search **Pixel Knight** in the Extensions view, or:

```sh
code --install-extension nauqh.pixel-knight
```

## How he reacts

The host publishes one thing to the renderer: the current count of **error**
diagnostics. Everything below is the renderer's reading of that number, so the
island responds to whatever produces your errors - a language server, a linter,
a compile task - and not to any particular editor event.

| Error count | What happens |
|---|---|
| Rises above zero | A raider wades in from the right shore for each error, capped at three, and forms a beachhead |
| Stays above zero | The knight marches to meet them and cycles two swings and a guard; the lancer walks the switchback down from the keep and thrusts from the second rank; the tower archers put arrows on the beach; the villagers clear out |
| Falls | The raider nearest the fight dies in a puff of dust |
| Reaches zero | The raid ends and the lancer walks back up to his post |

Diagnostics are debounced by 300ms, and an unchanged count is dropped rather
than posted, so a busy language server does not wake the render loop.

How much of the garrison turns out depends on the pane. The lancer needs a keep
terrace wide enough to hold a sentry post, and a narrow sidebar gets a watchtower
on the high ground instead of the castle, so at the smallest widths the knight
meets the beachhead alone.

Nothing is remembered between sessions yet - see [plan.md](plan.md).

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
| `pixelKnight.colour` | `colour1` | Faction palette. `colour1` is blue, `colour2` black. Applies to the knight, the garrison and every building at once. Raiders stay red either way |

Colour changes are pushed to the open view immediately - no reload.

## Development

```sh
npm install
npm run build
```

Then press **F5**. That launches an Extension Development Host with Pixel Knight
loaded; open it from the activity bar or from the status bar. `npm run package`
builds a `.vsix` you can install locally with `code --install-extension`.

```
src/extension.ts     activation, diagnostics hook, webview host, asset manifest
media/companion.js   the entire renderer: layout, tilemap, animation, sprites
media/tiny-swords/   the vendored asset pack
plan.md              where this is going
```

`npm run watch` rebuilds `src/` on save. The renderer is plain browser
JavaScript with no build step of its own, so editing `media/companion.js` only
needs a reload of the Extension Development Host.

One thing has to agree across the boundary: the sprite keys in `COLOUR_FILES`
and `SCENE_FILES` in `src/extension.ts`, which build the URI manifest, must
match the keys the renderer looks up in the `SPR` and `NATIVE` tables in
`media/companion.js`. Adding a sprite means touching both.

Adding a sprite from an excluded part of the pack also means loosening
`.vscodeignore`, which trims the unreferenced factions out of the `.vsix`.

## Credits

Every sprite, tile and decoration in this extension is from the
**[Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords)** pack by
**[Pixel Frog](https://pixelfrog-assets.itch.io/)**. None of the art is mine,
and none of it is covered by this project's MIT licence - see
[LICENSE](LICENSE), which scopes the code and the artwork separately.

The pack's terms allow use in personal and commercial projects and allow
modification, but do not allow redistributing, reselling or repackaging the
assets. The art is bundled here for one reason: the extension cannot draw the
island without it. It is not offered as an asset download, it is not repackaged
or resold, and nothing here is meant to substitute for getting the pack from
Pixel Frog.

**If you want Tiny Swords, get it from
[its itch.io page](https://pixelfrog-assets.itch.io/tiny-swords).** Don't take
it out of this repository or out of the `.vsix` - forking or vendoring this
project does not pass any right to the artwork along to you.

Pixel Frog: if you would prefer this extension not ship your art, open an issue
and I will pull it.
