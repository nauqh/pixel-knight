# Changelog

All notable changes to Pixel Knight are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-09-02

First release.

### Added

- **An island in the sidebar.** A terraced pixel-art island rendered on a single
  canvas in a webview, drawn from the
  [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords) pack by Pixel Frog.
  A keep on the high ground, barracks and watchtower on the middle terrace, a
  village on the ground floor, and grass stairs cut into each cliff on opposite
  sides so the levels read as a switchback.
- **Raids driven by your error diagnostics.** One red raider per error, capped at
  three. They wade in from the right shore and form a beachhead, and the island
  answers:
  - the knight marches to meet them and works a cycle of two swings and a guard,
    so he fights back rather than only blocking;
  - the lancer leaves his post by the keep, walks the switchback stairs down to
    the shore, and thrusts from the second rank;
  - garrison archers hold their towers and put arrows on the beach;
  - the villagers — pawn, sheep, roaming archer — clear out of the way.

  Fixing an error kills the raider nearest the fight in a puff of dust. Fixing
  the last one ends the raid and the lancer walks back up to his post.
- **Layout computed from the pane**, so the scene re-composes when you resize the
  sidebar instead of clipping. The shore is kept clear of tall scenery so the
  fight stays readable at sidebar width.
- **Two faction colours** via `pixelKnight.colour` (`colour1` blue, `colour2`
  black), swapped live with no reload. The knight, the garrison and every
  building change together. Raiders stay red whichever you pick.
- **`Pixel Knight: Focus Companion View`** in the command palette, and a status
  bar entry that does the same.

### Notes

- Nothing leaves your machine. No accounts, no telemetry, no network calls.
- Diagnostics are debounced, and an unchanged error count is dropped rather than
  posted, so a busy language server does not wake the render loop.
