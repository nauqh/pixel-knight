# Changelog

## [0.0.6] - 2026-09-06

### Added

- **Cut wood is a thing on the ground.** Felling a tree now drops a log where it
  fell. The Pawn steps back, sets his axe down at the stump, walks over to the
  log, picks it up and carries it away. Before this he swung at a tree and was
  simply holding wood afterwards, with nothing in between, so the job read as a
  mime rather than as work. The same applies to the other two trades: a worked
  gold seam drops ore and the butcher's stand drops a crate.
- **The Pawn goes back for his axe.** A log is carried in both arms, so the axe
  cannot still be in hand. It lies at the stump until he has made the delivery
  and comes back for it. Uses the pack's Tool sprites, which nothing used until
  now. The knife is the exception and stays on him, because you do not put a
  knife down to pick up what you cut.
- **Deliveries can be seen.** A load carried to a building is stacked at the door
  and stays there for about a minute. One stack per building, refreshed rather
  than added to, so the village does not end up walled in by its own stores.
- **A raid no longer undoes a job.** A raid ends every job on the island where it
  stands. What used to happen then was that the log the Pawn had just cut stopped
  existing along with the plan. Now the log lies where it fell, and once the shore
  is clear the Pawn goes back out for it before he starts anything new. A load in
  his arms when the raid lands is set down where he stood rather than deleted.
- **A tree that is being cut moves.** It jerks a pixel sideways on each stroke of
  the axe and runs its own sway sheet at three times the rate, which reads as a
  lean. When it goes over, chips fly across the whole width of the trunk. The
  pack ships no felling animation, so the swap from a standing tree to a stump is
  a single frame however it is dressed, and the way to make a single frame swap
  read is to put something in front of it.

### Changed

- **Each trade has its own destination.** Wood and meat go to the Pawn's own
  house, which is the house nearest the ground he wanders and is picked once per
  layout, so his deliveries always go the same way. Gold goes up the switchback
  to the castle. It was previously a die roll over every building on the island,
  which is why the wood went to the archery range as often as anywhere.
- **A new extension icon.** The knight now stands on the island with his sword
  and shield, a sheep beside him and a tower behind, which says more about what
  the extension is than the seated figure it replaces.

### Fixed

- **`boost-fps/` is kept out of the package.** An unrelated folder in the working
  tree was being picked up by `vsce`, so the build shipped a batch file and a
  PowerShell script to every user. Both are now ignored.

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
