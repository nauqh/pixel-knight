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
  pawn_idle: ["units", "Pawn/Pawn_Idle.png"],
  pawn_run: ["units", "Pawn/Pawn_Run.png"],
  // The carry and interact variants are what let the village look worked
  // rather than walked through: a pawn fells a tree, shoulders the log and
  // hauls it to a depot, and every frame of that is already in the pack.
  pawn_axe: ["units", "Pawn/Pawn_Interact Axe.png"],
  pawn_pick: ["units", "Pawn/Pawn_Interact Pickaxe.png"],
  pawn_run_wood: ["units", "Pawn/Pawn_Run Wood.png"],
  pawn_idle_wood: ["units", "Pawn/Pawn_Idle Wood.png"],
  pawn_run_gold: ["units", "Pawn/Pawn_Run Gold.png"],
  pawn_idle_gold: ["units", "Pawn/Pawn_Idle Gold.png"],
  // A pawn walking out empty-handed and then swinging an axe that appeared
  // with the swing was the tell that the errand was staged. The pack ships
  // every tool as a carried pair too, so he takes it there and brings it back.
  pawn_idle_axe: ["units", "Pawn/Pawn_Idle Axe.png"],
  pawn_run_axe: ["units", "Pawn/Pawn_Run Axe.png"],
  pawn_idle_pick: ["units", "Pawn/Pawn_Idle Pickaxe.png"],
  pawn_run_pick: ["units", "Pawn/Pawn_Run Pickaxe.png"],
  // The third trade: butchering the meat crate by the flock.
  pawn_knife: ["units", "Pawn/Pawn_Interact Knife.png"],
  pawn_idle_knife: ["units", "Pawn/Pawn_Idle Knife.png"],
  pawn_run_knife: ["units", "Pawn/Pawn_Run Knife.png"],
  pawn_idle_meat: ["units", "Pawn/Pawn_Idle Meat.png"],
  pawn_run_meat: ["units", "Pawn/Pawn_Run Meat.png"],
  castle: ["buildings", "Castle.png"],
  tower: ["buildings", "Tower.png"],
  barracks: ["buildings", "Barracks.png"],
  archery: ["buildings", "Archery.png"],
  house: ["buildings", "House1.png"],
  house2: ["buildings", "House2.png"],
  house3: ["buildings", "House3.png"],
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
  stump: "tiny-swords/Terrain/Resources/Wood/Trees/Stump 1.png",
  gold: "tiny-swords/Terrain/Resources/Gold/Gold Stones/Gold Stone 4.png",
  gold_res: "tiny-swords/Terrain/Resources/Gold/Gold Resource/Gold_Resource.png",
  // The pack draws a glowing outline of each resource, meant for "this is the
  // thing being worked". At sidebar width it is what lets the eye find a pawn
  // at a seam, so the seam swaps to it while he is on it.
  gold_hl:
    "tiny-swords/Terrain/Resources/Gold/Gold Stones/Gold Stone 4_Highlight.png",
  gold_res_hl:
    "tiny-swords/Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png",
  wood_res: "tiny-swords/Terrain/Resources/Wood/Wood Resource/Wood Resource.png",
  meat_res: "tiny-swords/Terrain/Resources/Meat/Meat Resource/Meat Resource.png",
  sheep_idle: "tiny-swords/Terrain/Resources/Meat/Sheep/Sheep_Idle.png",
  sheep_move: "tiny-swords/Terrain/Resources/Meat/Sheep/Sheep_Move.png",
  sheep_graze: "tiny-swords/Terrain/Resources/Meat/Sheep/Sheep_Grass.png",
  wrock1:
    "tiny-swords/Terrain/Decorations/Rocks in the Water/Water Rocks_01.png",
  wrock3:
    "tiny-swords/Terrain/Decorations/Rocks in the Water/Water Rocks_03.png",
  duck: "tiny-swords/Terrain/Decorations/Rubber Duck/Rubber duck.png",
  dust: "tiny-swords/Particle FX/Dust_01.png",
};
