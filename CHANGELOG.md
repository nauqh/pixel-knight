# Changelog

## [0.0.5] - 2026-09-04

### Added

- **Walkable elevations.** Every elevation is walkable and has the stair that
  leads off it, so any unit can reach any other elevation on foot. The stairs were
  previously used by the Lancer only, once per raid.
- **Garrison units leave their posts.** A unit on a building deck is now a unit
  with a post rather than a fixed offset drawn with the building. One at a time
  leaves, walks the village and returns. Tower Archers never leave. Buildings are
  solid, so a unit on a deck uses the door: it steps inside, comes out at the foot
  of the building, and reverses that on the way back. It previously walked the
  straight line from deck to ground, which passed through the stonework.
- **Jobs.** Units run short queued jobs on top of their wandering: a walk up to
  the castle and back, a stay inside a building, and for the Pawn, working a
  resource and carrying the load to a building. Uses the Tiny Swords carry and
  interact sheets for the Pawn, which were not previously used. The Sheep now
  grazes in place as well as walking.
- **Resources change when worked.** A cut tree becomes a stump and regrows after
  one to two minutes. A gold rock switches to the pack's highlight sheet while it
  is being worked, which is what makes the Pawn findable at sidebar width. The
  last standing tree is never cut, and wood is weighted as the rarest of the three
  jobs, so the island does not end up bare.
- **The Pawn carries its tools.** It carries the axe, pickaxe or knife to the job
  and back, rather than the tool appearing on the first swing and disappearing
  after the last.
- **A third resource.** A meat stand next to the Sheep, worked with the knife and
  carried as meat, on islands wide enough to hold it.
- **A raid cancels every job.** Any unit above the ground walks down the stairs,
  any unit indoors comes out, and any unit away from its post returns to it before
  the line forms.
- **Buildings post groups of units.** A building can now post several units, and a
  post can be on the ground in front of the building as well as on its deck. The
  castle posts one Archer on the deck and two Lancers on the ground, the barracks
  two Warriors, and each tower one Archer. A unit posted on the ground walks off
  and back directly, since the door is only needed to reach a deck. The guard is
  kept small on purpose: a castle elevation is about 190px of ledge at a normal
  sidebar and the castle covers 156 of it, so a larger guard fills the ledge end
  to end and reads as a queue.
- **Greenery on the upper elevations.** Bushes, rocks and the two short trees are
  now scattered on the elevations as well as on the ground, following the pack's
  own promo art, where scrub grows along the lip of every cliff. It sits on the
  lip rather than spread over the elevation, because a building stands taller
  than the three tiles of grass behind it and hides anything placed there. Where
  there is no room beside a building, which is the normal case at sidebar width,
  it grows at the foot of the wall instead, at the building's outer corners and
  never across its gate. Only Tree3 and Tree4 are used, since Tree1 and Tree2
  stand taller than the elevation itself, and they are scenery rather than
  timber, so the Pawn never cuts one.
- **A tower on the edge of each elevation.** Each stands on the lower step beside
  its elevation's stair, which is two tiles of ground the layout used to leave
  bare. Since the stairs alternate sides, the top tower is always on the left and
  the one below it is always on the right. Standing there also means the tower
  does not compete with the castle for the flat span, which side by side needs a
  346px sidebar, so both towers appear at every pane size. Neither is a valid
  errand target, because the step is a tile below the walkable band and a unit
  sent to its door would walk down without using the stairs.

### Changed

- **Units in armour are posted at buildings instead of on the shore.** Each lives
  on its building's elevation and walks down to the village on a job. The knight
  is the barracks' second Warrior, and the Lancer that goes out to fight is taken
  from the castle's group of three rather than being a separate unit, so the
  posted counts hold either way. The roaming ground Archer has been removed;
  Archers are now on the decks.
- **Raids are answered in two stages.** Archers fire immediately from their
  posts. The Warrior and the Lancer then come down the stairs at the same speed,
  which is the sally speed rather than the walking speed. Measured median time to
  the battle line is about five seconds at a 300px sidebar and thirteen at 500px,
  where the island is much larger. Both walk back up when the shore is clear.
- **Archers pause between volleys.** Looped, the shoot sheet fires every 0.67s,
  which put eleven arrows in the air with four Archers posted. Peak is now five.
- **The asset manifest moved to its own file.** `COLOUR_DIRS`, `COLOUR_FILES` and
  `SCENE_FILES` are now in `src/sprites.ts`, leaving `src/extension.ts` for
  activation, the diagnostics hook and the webview host. No behaviour change;
  esbuild inlines the import and the bundle is the same size.

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
  - the villagers (pawn, sheep, roaming archer) clear out of the way.

  Fixing an error kills the raider nearest the fight in a puff of dust. Fixing
  the last one ends the raid and the lancer walks back up to his post.
- **Layout computed from the pane**, so the scene re-composes when you resize the
  sidebar instead of clipping. The shore is kept clear of tall scenery so the
  fight stays readable at sidebar width.
- **Two faction colours** via `pixelKnight.colour` (`colour1` blue, `colour2`
  black), swapped live with no reload. The knight, the garrison and every
  building change together. Raiders stay red whichever you pick.
- **`Pixel Knights: Focus Companion View`** in the command palette, and a status
  bar entry that does the same.
