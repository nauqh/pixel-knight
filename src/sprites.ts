// The asset manifest: every sheet the renderer can ask for, and where it lives
// under media/. Kept apart from extension.ts because it is data rather than
// behaviour, and because it is the half of the sprite contract the host owns -
// the keys here must match the ones media/companion.js looks up in its SPR and
// NATIVE tables, so adding a sprite is an edit to this file and that one.

// Everything the knight's colour setting swaps: his own sheets, the companion
// units, and the buildings, so the island reads as one faction.
export const COLOUR_DIRS: Record<
  string,
  { units: string; buildings: string }
> = {
  colour1: {
    units: "tiny-swords/Units/Blue Units",
    buildings: "tiny-swords/Buildings/Blue Buildings",
  },
  colour2: {
    units: "tiny-swords/Units/Black Units",
    buildings: "tiny-swords/Buildings/Black Buildings",
  },
};

// Keys match the SPR table in media/companion.js. Paths are relative to the
// colour's units/buildings directory.
export const COLOUR_FILES: Record<
  string,
  [keyof typeof COLOUR_DIRS.colour1, string]
> = {
  warrior_Idle: ["units", "Warrior/Warrior_Idle.png"],
  warrior_Run: ["units", "Warrior/Warrior_Run.png"],
  warrior_Guard: ["units", "Warrior/Warrior_Guard.png"],
  warrior_Attack1: ["units", "Warrior/Warrior_Attack1.png"],
  archer_idle: ["units", "Archer/Archer_Idle.png"],
  archer_run: ["units", "Archer/Archer_Run.png"],
  archer_shoot: ["units", "Archer/Archer_Shoot.png"],
  // The arrow is a loose projectile the renderer flies itself, not a frame of
  // the shoot sheet, which ends at the release.
  arrow: ["units", "Archer/Arrow.png"],
  lancer_idle: ["units", "Lancer/Lancer_Idle.png"],
  lancer_run: ["units", "Lancer/Lancer_Run.png"],
  // Of the pack's four directional attacks only the level thrust is used: the
  // lancer always sallies rightward, at the shore.
  lancer_attack: ["units", "Lancer/Lancer_Right_Attack.png"],
  // The monastery's one resident. He walks, stands, and heals the knight when
  // a test task passes, which is what the heal and its glow are for.
  monk_idle: ["units", "Monk/Idle.png"],
  monk_run: ["units", "Monk/Run.png"],
  monk_heal: ["units", "Monk/Heal.png"],
  heal_fx: ["units", "Monk/Heal_Effect.png"],
  pawn_idle: ["units", "Pawn/Pawn_Idle.png"],
  pawn_run: ["units", "Pawn/Pawn_Run.png"],
  // The carry and interact variants are what let the village look worked
  // rather than walked through: a pawn fells a tree, shoulders the log and
  // hauls it to a depot, and every frame of that is already in the pack.
  pawn_axe: ["units", "Pawn/Pawn_Interact Axe.png"],
  pawn_run_wood: ["units", "Pawn/Pawn_Run Wood.png"],
  pawn_idle_wood: ["units", "Pawn/Pawn_Idle Wood.png"],
  // A pawn walking out empty-handed and then swinging an axe that appeared
  // with the swing was the tell that the errand was staged. The pack ships
  // every tool as a carried pair too, so he takes it there and brings it back.
  pawn_idle_axe: ["units", "Pawn/Pawn_Idle Axe.png"],
  pawn_run_axe: ["units", "Pawn/Pawn_Run Axe.png"],
  // Swung in place while a build task runs.
  pawn_hammer: ["units", "Pawn/Pawn_Interact Hammer.png"],
  castle: ["buildings", "Castle.png"],
  tower: ["buildings", "Tower.png"],
  barracks: ["buildings", "Barracks.png"],
  archery: ["buildings", "Archery.png"],
  house: ["buildings", "House1.png"],
  house2: ["buildings", "House2.png"],
  house3: ["buildings", "House3.png"],
  monastery: ["buildings", "Monastery.png"],
};

// Colour-independent terrain and decoration, relative to media/. The scene is
// tiled straight from the pack's own 64px tilemap now, so the hand-cropped
// scene/grass_tile.png this used to fill with is no longer referenced.
export const SCENE_FILES: Record<string, string> = {
  // Raiders are the pack's Red faction. They live here rather than in
  // COLOUR_FILES because the enemy is always red whichever colour the player
  // picks, which also means their sheets survive a colour switch uncached.
  enemy_Idle: "tiny-swords/Units/Red Units/Warrior/Warrior_Idle.png",
  enemy_Run: "tiny-swords/Units/Red Units/Warrior/Warrior_Run.png",
  enemy_Attack1: "tiny-swords/Units/Red Units/Warrior/Warrior_Attack1.png",
  // Warnings: Red Pawns, who only stand about and walk.
  rpawn_idle: "tiny-swords/Units/Red Units/Pawn/Pawn_Idle.png",
  rpawn_run: "tiny-swords/Units/Red Units/Pawn/Pawn_Run.png",
  tilemap: "tiny-swords/Terrain/Tileset/Tilemap_color1.png",
  foam: "tiny-swords/Terrain/Tileset/Water Foam.png",
  rock: "tiny-swords/Terrain/Decorations/Rocks/Rock1.png",
  rock2: "tiny-swords/Terrain/Decorations/Rocks/Rock2.png",
  rock3: "tiny-swords/Terrain/Decorations/Rocks/Rock3.png",
  rock4: "tiny-swords/Terrain/Decorations/Rocks/Rock4.png",
  bush: "tiny-swords/Terrain/Decorations/Bushes/Bushe1.png",
  bush2: "tiny-swords/Terrain/Decorations/Bushes/Bushe2.png",
  bush3: "tiny-swords/Terrain/Decorations/Bushes/Bushe3.png",
  bush4: "tiny-swords/Terrain/Decorations/Bushes/Bushe4.png",
  tree: "tiny-swords/Terrain/Resources/Wood/Trees/Tree1.png",
  tree2: "tiny-swords/Terrain/Resources/Wood/Trees/Tree2.png",
  tree3: "tiny-swords/Terrain/Resources/Wood/Trees/Tree3.png",
  tree4: "tiny-swords/Terrain/Resources/Wood/Trees/Tree4.png",
  // Each tree has its own stump: 1 and 2 for the pines, 3 and 4 for the birches.
  stump: "tiny-swords/Terrain/Resources/Wood/Trees/Stump 1.png",
  stump2: "tiny-swords/Terrain/Resources/Wood/Trees/Stump 2.png",
  stump3: "tiny-swords/Terrain/Resources/Wood/Trees/Stump 3.png",
  stump4: "tiny-swords/Terrain/Resources/Wood/Trees/Stump 4.png",
  wood_res: "tiny-swords/Terrain/Resources/Wood/Wood Resource/Wood Resource.png",
  // Tools as props lying on the grass, which the pack ships and nothing used
  // until now. A felled tree is two jobs - cut it, then carry it - and nobody
  // carries a log with an axe still in hand, so the axe goes down at the stump
  // and is collected on the way home.
  tool_axe: "tiny-swords/Terrain/Resources/Tools/Tool_02.png",
  sheep_idle: "tiny-swords/Terrain/Resources/Meat/Sheep/Sheep_Idle.png",
  sheep_move: "tiny-swords/Terrain/Resources/Meat/Sheep/Sheep_Move.png",
  sheep_graze: "tiny-swords/Terrain/Resources/Meat/Sheep/Sheep_Grass.png",
  wrock1:
    "tiny-swords/Terrain/Decorations/Rocks in the Water/Water Rocks_01.png",
  wrock3:
    "tiny-swords/Terrain/Decorations/Rocks in the Water/Water Rocks_03.png",
  duck: "tiny-swords/Terrain/Decorations/Rubber Duck/Rubber duck.png",
  dust: "tiny-swords/Particle FX/Dust_01.png",
  // Burning on a village roof while the last test task failed. Fire_01 is left
  // out: at half scale its flame is 11px, too small to read on a roof.
  fire2: "tiny-swords/Particle FX/Fire_02.png",
  fire3: "tiny-swords/Particle FX/Fire_03.png",
};

// The activity HUD's art, relative to media/. The webview draws these with CSS
// and <img> rather than on the canvas, so they are not in the renderer's SPR
// and NATIVE tables. Keys match what media/companion.js reads off window.__UI__:
// the paper the panel is framed in, and one icon per item a Pawn can carry.
export const UI_FILES: Record<string, string> = {
  frame: "tiny-swords/UI Elements/UI Elements/Papers/SpecialPaper.png",
  wood: "tiny-swords/UI Elements/UI Elements/Icons/Icon_02.png",
  // The toggle button: the shield at peace, the sword once there are errors,
  // and the arrow, which the CSS turns to point down or up.
  shield: "tiny-swords/UI Elements/UI Elements/Icons/Icon_06.png",
  sword: "tiny-swords/UI Elements/UI Elements/Icons/Icon_05.png",
  arrow: "tiny-swords/UI Elements/UI Elements/Icons/Icon_08.png",
};
