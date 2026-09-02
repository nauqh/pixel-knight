import * as vscode from "vscode";

// Everything the knight's colour setting swaps: his own sheets, the companion
// units, and the buildings, so the island reads as one faction.
const COLOUR_DIRS: Record<string, { units: string; buildings: string }> = {
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
const COLOUR_FILES: Record<string, [keyof typeof COLOUR_DIRS.colour1, string]> =
  {
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
const SCENE_FILES: Record<string, string> = {
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

// Diagnostics arrive in bursts while a language server catches up, and each one
// would otherwise be a message the renderer has to act on. One post per beat is
// plenty for something the user only glances at.
const WORLD_DEBOUNCE_MS = 300;

let view: vscode.WebviewView | undefined;
let statusBarItem: vscode.StatusBarItem;
let worldTimer: NodeJS.Timeout | undefined;
let lastPostedErrors = -1;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(shield) Warrior";
  statusBarItem.command = "pixelKnight.open";
  statusBarItem.tooltip = "Open Pixel Knights";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("pixelKnight.view", {
      resolveWebviewView(webviewView) {
        view = webviewView;
        webviewView.webview.options = {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "media"),
          ],
        };
        webviewView.webview.html = getHtml(context, webviewView.webview);
        // The webview is rebuilt from scratch every time it resolves and keeps
        // no state of its own, so it needs the world handed to it on arrival.
        lastPostedErrors = -1;
        postWorld();
        webviewView.onDidDispose(() => {
          if (view === webviewView) view = undefined;
        });
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("pixelKnight.open", () =>
      vscode.commands.executeCommand("workbench.view.extension.pixelKnight")
    )
  );

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      if (worldTimer) clearTimeout(worldTimer);
      worldTimer = setTimeout(postWorld, WORLD_DEBOUNCE_MS);
    })
  );
  context.subscriptions.push({
    dispose: () => {
      if (worldTimer) clearTimeout(worldTimer);
    },
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("pixelKnight.colour") && view) {
        view.webview.postMessage({
          type: "colour",
          colour: getColour(),
        });
      }
    })
  );
}

function countErrors(): number {
  let count = 0;
  for (const [, diags] of vscode.languages.getDiagnostics()) {
    count += diags.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error
    ).length;
  }
  return count;
}

// The host publishes state, never animation commands: the renderer decides what
// a given error count should look like. Unchanged counts are dropped so a noisy
// language server doesn't wake the render loop for nothing.
function postWorld() {
  worldTimer = undefined;
  if (!view) return;
  const errors = countErrors();
  if (errors === lastPostedErrors) return;
  lastPostedErrors = errors;
  view.webview.postMessage({ type: "world", errors });
}

function getColour(): string {
  return vscode.workspace
    .getConfiguration("pixelKnight")
    .get<string>("colour", "colour1");
}

function getHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview
): string {
  const spriteUris: Record<string, Record<string, string>> = {};
  for (const colour of Object.keys(COLOUR_DIRS)) {
    spriteUris[colour] = {};
    for (const [key, [kind, file]] of Object.entries(COLOUR_FILES)) {
      const uri = vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        COLOUR_DIRS[colour][kind],
        file
      );
      spriteUris[colour][key] = webview.asWebviewUri(uri).toString();
    }
  }
  const sceneUris: Record<string, string> = {};
  for (const key of Object.keys(SCENE_FILES)) {
    const uri = vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      SCENE_FILES[key]
    );
    sceneUris[key] = webview.asWebviewUri(uri).toString();
  }

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "companion.js")
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  html, body { height: 100%; margin: 0; padding: 0; background: #47aba9; overflow: hidden; }
  /* The canvas is sized to an exact integer multiple of the art resolution and
     centred, so the leftover sub-multiple remainder shows as water, never as a
     fractionally-scaled row of pixels. */
  #stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
</style>
</head>
<body>
  <div id="stage"><canvas id="knight"></canvas></div>
  <script>
    window.__SPRITES__ = ${JSON.stringify(spriteUris)};
    window.__INITIAL_COLOUR__ = ${JSON.stringify(getColour())};
    window.__SCENE__ = ${JSON.stringify(sceneUris)};
  </script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

export function deactivate() {}
