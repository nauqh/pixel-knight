import * as vscode from "vscode";
import { COLOUR_DIRS, COLOUR_FILES, SCENE_FILES } from "./sprites";

// Diagnostics arrive in bursts while a language server catches up, and each one
// would otherwise be a message the renderer has to act on. One post per beat is
// plenty for something the user only glances at.
const WORLD_DEBOUNCE_MS = 300;

let view: vscode.WebviewView | undefined;
let statusBarItem: vscode.StatusBarItem;
let worldTimer: NodeJS.Timeout | undefined;
let lastPostedErrors = -1;

export function activate(context: vscode.ExtensionContext) {
  // Two builds can claim this view - the Marketplace install and the Extension
  // Development Host running out of the workspace - and the activity bar icon
  // is the same picture for both. The launch config disables the installed one
  // so only one icon is left, but which one that is is not visible anywhere.
  // The extension mode is the only reliable tell, so it gets said in the two
  // places you actually look: the view header and the status bar.
  const dev = context.extensionMode === vscode.ExtensionMode.Development;
  const version = context.extension.packageJSON.version as string;

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = dev ? "$(shield) Warrior [dev]" : "$(shield) Warrior";
  statusBarItem.command = "pixelKnight.open";
  statusBarItem.tooltip = dev
    ? `Open Pixel Knights - development build ${version} from ${context.extensionUri.fsPath}`
    : "Open Pixel Knights";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("pixelKnight.view", {
      resolveWebviewView(webviewView) {
        view = webviewView;
        if (dev) {
          webviewView.title = "Pixel Knights [DEV]";
          webviewView.description = version;
        }
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
