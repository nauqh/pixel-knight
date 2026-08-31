import * as vscode from "vscode";

type Anim = "Idle" | "Run" | "Attack1" | "Attack2" | "Guard";

const FRAME_COUNTS: Record<Anim, number> = {
  Idle: 8,
  Run: 6,
  Attack1: 4,
  Attack2: 4,
  Guard: 6,
};

// Playback rates must match the table in media/companion.js so that the
// reaction timeouts here line up with the animation actually finishing.
const ANIM_FPS: Record<Anim, number> = {
  Idle: 10,
  Run: 12,
  Attack1: 12,
  Attack2: 12,
  Guard: 10,
};

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
    warrior_Attack1: ["units", "Warrior/Warrior_Attack1.png"],
    warrior_Attack2: ["units", "Warrior/Warrior_Attack2.png"],
    warrior_Guard: ["units", "Warrior/Warrior_Guard.png"],
    archer_idle: ["units", "Archer/Archer_Idle.png"],
    archer_run: ["units", "Archer/Archer_Run.png"],
    lancer_idle: ["units", "Lancer/Lancer_Idle.png"],
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

const BRACE_ERROR_THRESHOLD = 10;
const TYPING_BURST_WINDOW_MS = 2000;
const TYPING_BURST_COUNT = 8;
const FIDGET_COOLDOWN_MS = 45_000;
const BRACE_COOLDOWN_MS = 4000;

let view: vscode.WebviewView | undefined;
let statusBarItem: vscode.StatusBarItem;
let lastActivityAt = Date.now();
let lastFidgetAt = 0;
let lastBraceAt = 0;
let lastErrorCount = 0;
let editEventTimestamps: number[] = [];
let braced = false;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(shield) Warrior";
  statusBarItem.command = "pixelKnight.open";
  statusBarItem.tooltip = "Open Pixel Knight";
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
    vscode.workspace.onDidSaveTextDocument(() => {
      touchActivity();
      play("Attack1");
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.contentChanges.length === 0) return;
      touchActivity();
      const now = Date.now();
      editEventTimestamps.push(now);
      editEventTimestamps = editEventTimestamps.filter(
        (t) => now - t <= TYPING_BURST_WINDOW_MS
      );
      if (editEventTimestamps.length >= TYPING_BURST_COUNT) {
        editEventTimestamps = [];
        play("Attack1");
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      const errorCount = countErrors();
      const now = Date.now();
      if (errorCount > lastErrorCount) {
        if (
          errorCount >= BRACE_ERROR_THRESHOLD &&
          now - lastBraceAt >= BRACE_COOLDOWN_MS
        ) {
          lastBraceAt = now;
          braced = true;
          play("Guard", () => {
            braced = false;
          });
        } else if (!braced) {
          play("Guard");
        }
      } else if (errorCount === 0 && lastErrorCount > 0) {
        play("Attack2");
      }
      lastErrorCount = errorCount;
    })
  );

  hookGit(context);

  const idleTimer = setInterval(() => {
    const cfg = vscode.workspace.getConfiguration("pixelKnight");
    const idleTimeoutMs = cfg.get<number>("idleTimeoutSeconds", 60) * 1000;
    const now = Date.now();
    if (
      now - lastActivityAt >= idleTimeoutMs &&
      now - lastFidgetAt >= FIDGET_COOLDOWN_MS
    ) {
      lastFidgetAt = now;
      play("Guard");
    }
  }, 5000);
  context.subscriptions.push({ dispose: () => clearInterval(idleTimer) });

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

function touchActivity() {
  lastActivityAt = Date.now();
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

function hookGit(context: vscode.ExtensionContext) {
  const gitExt = vscode.extensions.getExtension("vscode.git");
  if (!gitExt) return;
  gitExt.activate().then((git: any) => {
    const api = git.getAPI(1);
    let lastHead: string | undefined;
    const watch = (repo: any) => {
      lastHead = repo.state.HEAD?.commit;
      context.subscriptions.push(
        repo.state.onDidChange(() => {
          const head = repo.state.HEAD?.commit;
          if (head && head !== lastHead) {
            lastHead = head;
            touchActivity();
            play("Attack2");
          }
        })
      );
    };
    api.repositories.forEach(watch);
    context.subscriptions.push(api.onDidOpenRepository(watch));
  });
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
    window.__FRAME_COUNTS__ = ${JSON.stringify(FRAME_COUNTS)};
    window.__INITIAL_COLOUR__ = ${JSON.stringify(getColour())};
    window.__SCENE__ = ${JSON.stringify(sceneUris)};
  </script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

function play(anim: Anim, onDone?: () => void) {
  if (!view) return;
  view.webview.postMessage({ type: "play", anim, once: anim !== "Idle" });
  if (onDone) {
    const durationMs = (FRAME_COUNTS[anim] / ANIM_FPS[anim]) * 1000;
    setTimeout(onDone, durationMs);
  }
}

export function deactivate() {}
