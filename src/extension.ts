import * as vscode from "vscode";
import { COLOUR_DIRS, COLOUR_FILES, SCENE_FILES, UI_FILES } from "./sprites";
import { countDirty, DiagnosticLike, errorRefs } from "./world";

// Diagnostics arrive in bursts while a language server catches up, and each one
// would otherwise be a message the renderer has to act on. One post per beat is
// plenty for something the user only glances at.
const WORLD_DEBOUNCE_MS = 300;

let view: vscode.WebviewView | undefined;
let statusBarItem: vscode.StatusBarItem;
let worldTimer: NodeJS.Timeout | undefined;
let lastPostedWorld = "";
// What the island reads besides diagnostics. Held here, not in the page, because
// the webview is rebuilt from nothing each time it opens and has to be handed
// all of it.
let dirty = 0;
// Keyed by the task's source and name rather than its execution object. VS Code
// hands both process events the same object while the task runs, but forgets it
// when the task ends, and a key that cannot be missed is cheaper than finding out
// the order the two end events come in.
const runningBuilds = new Set<string>();
const taskKey = (task: vscode.Task) => `${task.source}|${task.name}`;
let testsFailed: string | null = null;
// Every file an error has been reported in this session. The chronicle can only
// ask to open one of these: the page is ours, but a message from it is still
// input, and it has no business opening anything else.
const reportedUris = new Set<string>();
let isDev = false;
let extensionVersion = "";
let extensionFsPath = "";

export function activate(context: vscode.ExtensionContext) {
  // Two builds can claim this view - the Marketplace install and the Extension
  // Development Host running out of the workspace - and the activity bar icon
  // is the same picture for both. The launch config disables the installed one
  // so only one icon is left, but which one that is is not visible anywhere.
  // The extension mode is the only reliable tell, so it gets said in the two
  // places you actually look: the view header and the status bar.
  const dev = context.extensionMode === vscode.ExtensionMode.Development;
  const version = context.extension.packageJSON.version as string;
  isDev = dev;
  extensionVersion = version;
  extensionFsPath = context.extensionUri.fsPath;

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "pixelKnight.open";
  const firstLook = readDiagnostics();
  updateStatusBar(firstLook.errors.length, firstLook.warnings);
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
        lastPostedWorld = "";
        postWorld();
        context.subscriptions.push(
          webviewView.webview.onDidReceiveMessage(openFromChronicle)
        );
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
    vscode.languages.onDidChangeDiagnostics(scheduleWorld)
  );
  watchGit(context);
  watchTasks(context);
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

// Every error as plain data, for world.ts to give an identity, and the number of
// warnings, in one pass over the diagnostics.
function readDiagnostics(): { errors: DiagnosticLike[]; warnings: number } {
  const errors: DiagnosticLike[] = [];
  let warnings = 0;
  for (const [uri, diags] of vscode.languages.getDiagnostics()) {
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error)
        errors.push({
          uri: uri.toString(),
          line: d.range.start.line,
          code: typeof d.code === "object" ? d.code.value : d.code,
          message: d.message,
        });
      else if (d.severity === vscode.DiagnosticSeverity.Warning) warnings++;
    }
  }
  return { errors, warnings };
}

function updateStatusBar(errors: number, warnings: number) {
  if (!statusBarItem) return;
  const suffix = isDev ? " [dev]" : "";
  if (errors > 0) {
    statusBarItem.text = `$(error) ${errors} error${errors === 1 ? "" : "s"}${suffix}`;
  } else if (warnings > 0) {
    statusBarItem.text = `$(warning) ${warnings} warning${warnings === 1 ? "" : "s"}${suffix}`;
  } else {
    statusBarItem.text = `$(shield) Clean${suffix}`;
  }
  const summary =
    errors > 0
      ? `${errors} error${errors === 1 ? "" : "s"}${warnings > 0 ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}`
      : warnings > 0
        ? `${warnings} warning${warnings === 1 ? "" : "s"}`
        : "clean";
  statusBarItem.tooltip = isDev
    ? `Pixel Knights (${summary}) - development build ${extensionVersion} from ${extensionFsPath}\nClick to open Companion View`
    : `Pixel Knights (${summary})\nClick to open Companion View`;
}

function scheduleWorld() {
  if (worldTimer) clearTimeout(worldTimer);
  worldTimer = setTimeout(postWorld, WORLD_DEBOUNCE_MS);
}

// The host publishes state, never animation commands: the renderer decides what
// the errors, warnings, uncommitted files and tasks should look like. A world
// identical to the last one posted is dropped, so a noisy language server
// doesn't wake the render loop for nothing.
function postWorld() {
  worldTimer = undefined;
  const diags = readDiagnostics();
  updateStatusBar(diags.errors.length, diags.warnings);
  if (!view) return;
  const errors = errorRefs(diags.errors);
  for (const e of errors) reportedUris.add(e.uri);
  const world = {
    type: "world",
    errors,
    warnings: diags.warnings,
    dirty,
    building: runningBuilds.size > 0,
    testsFailed,
  };
  const json = JSON.stringify(world);
  if (json === lastPostedWorld) return;
  lastPostedWorld = json;
  view.webview.postMessage(world);
}

// Something that happened once, for the chronicle: a commit, or a build or
// test task ending. Lost if the view is closed at the time, which is fine: the
// state it changed arrives with the next world anyway.
function postEvent(event: Record<string, unknown>) {
  view?.webview.postMessage({ type: "event", ...event });
}

// The one thing the page asks of the host: open the file a chronicle line
// names, at its line. Only files this session has reported an error in.
function openFromChronicle(msg: unknown) {
  const m = msg as { type?: unknown; uri?: unknown; line?: unknown };
  if (m?.type !== "open" || typeof m.uri !== "string") return;
  if (!reportedUris.has(m.uri)) return;
  const line =
    typeof m.line === "number" && Number.isInteger(m.line) && m.line >= 1
      ? m.line - 1
      : 0;
  const at = new vscode.Position(line, 0);
  vscode.window
    .showTextDocument(vscode.Uri.parse(m.uri), {
      selection: new vscode.Range(at, at),
      preview: true,
    })
    .then(undefined, () => undefined);
}

// Just enough of the built-in git extension's API, version 1, for the island:
// the change lists, the HEAD commit, and a commit's parents and diff. Checked
// against the git extension that ships with VS Code rather than a typings
// package, which this project does not have.
interface GitChange {
  readonly uri: vscode.Uri;
}
interface GitRepository {
  readonly state: {
    readonly HEAD: { readonly commit?: string } | undefined;
    readonly indexChanges: GitChange[];
    readonly workingTreeChanges: GitChange[];
    readonly untrackedChanges?: GitChange[];
    readonly onDidChange: vscode.Event<void>;
  };
  getCommit(ref: string): Promise<{ readonly parents: string[] }>;
  diffBetween(ref1: string, ref2: string): Promise<GitChange[]>;
}
interface GitApi {
  readonly repositories: GitRepository[];
  readonly onDidOpenRepository: vscode.Event<GitRepository>;
}
interface GitExtension {
  getAPI(version: 1): GitApi;
}

// Uncommitted files become the village's workload, and a commit is a delivery.
// Without the git extension, or with git switched off, the village is simply
// never busy.
function watchGit(context: vscode.ExtensionContext) {
  const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!ext) return;
  const heads = new Map<GitRepository, string | undefined>();
  const start = (git: GitExtension) => {
    let api: GitApi;
    try {
      api = git.getAPI(1);
    } catch {
      return;
    }
    const refresh = () => {
      dirty = countDirty(
        api.repositories.map((r) => ({
          index: r.state.indexChanges.map((c) => c.uri.toString()),
          workingTree: r.state.workingTreeChanges.map((c) => c.uri.toString()),
          untracked: (r.state.untrackedChanges ?? []).map((c) => c.uri.toString()),
        }))
      );
      scheduleWorld();
    };
    const follow = (repo: GitRepository) => {
      heads.set(repo, repo.state.HEAD?.commit);
      context.subscriptions.push(
        repo.state.onDidChange(() => {
          const before = heads.get(repo);
          const after = repo.state.HEAD?.commit;
          heads.set(repo, after);
          if (before && after && before !== after) reportCommit(repo, before, after);
          refresh();
        })
      );
      refresh();
    };
    api.repositories.forEach(follow);
    context.subscriptions.push(api.onDidOpenRepository(follow));
  };
  if (ext.isActive) start(ext.exports);
  else ext.activate().then(start, () => undefined);
}

// HEAD moved. It is a commit only if the new commit's parent is where HEAD was:
// a checkout or a rebase moves HEAD too, and neither is work being delivered.
// The file count is the commit's own diff.
//
// ponytail: a pull that fast-forwards by exactly one commit passes the same
// test and is announced as a delivery. Telling them apart needs the reflog.
async function reportCommit(repo: GitRepository, before: string, after: string) {
  try {
    const commit = await repo.getCommit(after);
    if (!commit.parents.includes(before)) return;
    const changes = await repo.diffBetween(before, after);
    postEvent({ kind: "commit", files: changes.length });
  } catch {
    // A commit that cannot be read is not worth a line.
  }
}

// Build and test tasks. Results in the Test Explorer are not visible to other
// extensions through the stable API, so a test run means a task in the Test
// group, such as npm test, and its exit code.
function watchTasks(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.tasks.onDidStartTaskProcess((e) => {
      const task = e.execution.task;
      // A watch task never ends, and hammering for the whole session says
      // nothing, so only builds that finish count.
      if (task.group?.id === vscode.TaskGroup.Build.id && !task.isBackground) {
        runningBuilds.add(taskKey(task));
        scheduleWorld();
      }
    }),
    // A task that ends without a process event to say so still stops the
    // hammering, just without a verdict for the chronicle.
    vscode.tasks.onDidEndTask((e) => {
      if (runningBuilds.delete(taskKey(e.execution.task))) scheduleWorld();
    }),
    vscode.tasks.onDidEndTaskProcess((e) => {
      const task = e.execution.task;
      if (runningBuilds.delete(taskKey(task))) {
        postEvent({ kind: "build", ok: e.exitCode === 0, name: task.name });
        scheduleWorld();
      }
      // No exit code means the task was stopped, which is not a result.
      if (task.group?.id === vscode.TaskGroup.Test.id && e.exitCode !== undefined) {
        const passed = e.exitCode === 0;
        postEvent({
          kind: "tests",
          passed,
          fixed: passed && testsFailed !== null,
          name: task.name,
        });
        testsFailed = passed ? null : task.name;
        scheduleWorld();
      }
    })
  );
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
  const uiUris: Record<string, string> = {};
  for (const key of Object.keys(UI_FILES)) {
    const uri = vscode.Uri.joinPath(context.extensionUri, "media", UI_FILES[key]);
    uiUris[key] = webview.asWebviewUri(uri).toString();
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
  /* The island can be taller than the pane, so the stage scrolls and #world is
     the island's full height. The canvas stays the size of the pane and sticks
     to the top of it, and the renderer reads scrollTop as its camera. The gutter
     is kept even when nothing scrolls, so a scrollbar appearing never narrows
     the pane and re-lays the island. The canvas is an exact integer multiple of
     the art resolution, so any remainder shows as water, never as a
     fractionally-scaled row of pixels. */
  #stage { position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; scrollbar-gutter: stable; }
  #stage:focus { outline: none; }
  #stage:focus-visible { outline: 1px solid var(--vscode-focusBorder, #3794ff); outline-offset: -1px; }
  canvas { position: sticky; top: 0; margin: 0 auto; image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
  /* The HUD is dressed in the pack's own UI art. The panel is framed in
     SpecialPaper, a slate board with gold corners, cut into its nine pieces by
     background position, so no edited copy of the art has to ship. The sheet is
     a 5x5 grid of 64px cells with the pieces on the even ones: a size of 500%
     makes one cell fill its box, and 0%, 50% and 100% pick the column or row.
     Every piece is drawn at half size, the same scale as the island, and the
     toggle copies the paper's edge in plain CSS because it is too small for
     the corners. */
  #activity-hud {
    --knight-well: #1f252c;
    --knight-slate: #525b66;
    --knight-rim: #444553;
    --knight-gold-line: #ecc76a;
    --knight-stone-light: #8ca0ad;
    --knight-wood: #d6a26e;
    --knight-paper: #f3dda0;
    --knight-red: #ef7a6e;
    --knight-gold: #e7bd4d;
    --knight-green: #9fc77d;
    --knight-blue: #8fbce0;
    position: absolute;
    top: 8px;
    /* Clear of the stage's scrollbar. */
    right: 18px;
    left: 8px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    font: 11px/1.4 var(--vscode-font-family, sans-serif);
    color: var(--knight-paper);
    pointer-events: none;
  }
  #activity-toggle {
    align-self: flex-end;
    max-width: 100%;
    border: 1px solid var(--knight-rim);
    border-radius: 3px;
    padding: 5px 9px;
    background: var(--knight-slate);
    color: var(--knight-paper);
    box-shadow: inset 0 0 0 1px var(--knight-slate), inset 0 0 0 2px var(--knight-gold-line), 2px 2px 0 rgba(16, 27, 39, .6);
    cursor: pointer;
    font: inherit;
    text-align: left;
    text-shadow: 1px 1px 0 rgba(0, 0, 0, .45);
    pointer-events: auto;
    transition: transform 140ms ease-out, background-color 140ms ease-out;
  }
  #activity-toggle:hover { background: #5f6975; }
  #activity-toggle:active { transform: scale(.98); }
  #activity-toggle:focus-visible { outline: 2px solid var(--vscode-focusBorder, #3794ff); outline-offset: 2px; }
  /* The pack's own icons rather than text glyphs: its shield or sword before the
     state, and its arrow after it. The arrow points left in the pack, so a
     quarter turn points it down while the panel is shut and up while it is
     open. A quarter turn of pixel art moves whole pixels, so it stays crisp. */
  #activity-mark, #activity-chevron { width: 16px; height: 16px; vertical-align: -3px; image-rendering: pixelated; }
  #activity-mark { margin-right: 6px; }
  #activity-chevron { margin-left: 7px; transform: rotate(-90deg); transition: transform 140ms ease-out; }
  #activity-toggle[aria-expanded="true"] #activity-chevron { transform: rotate(90deg); }
  #activity-state { font-weight: 700; letter-spacing: .02em; }
  #activity-panel {
    position: relative;
    align-self: flex-end;
    box-sizing: border-box;
    width: min(290px, 100%);
    margin-top: 4px;
    padding: 17px 14px 19px;
    pointer-events: auto;
    filter: drop-shadow(2px 3px 0 rgba(16, 27, 39, .55));
  }
  .paper { position: absolute; inset: 0; display: grid; grid-template: 32px 1fr 32px / 32px 1fr 32px; pointer-events: none; }
  .paper i { display: block; background-image: var(--ui-frame); background-repeat: no-repeat; image-rendering: pixelated; }
  .paper .tl { background-size: 160px 160px; background-position: 0 0; }
  .paper .t { background-size: 500% 160px; background-position: 50% 0; }
  .paper .tr { background-size: 160px 160px; background-position: 100% 0; }
  .paper .l { background-size: 160px 500%; background-position: 0 50%; }
  .paper .c { background: var(--knight-slate); }
  .paper .r { background-size: 160px 500%; background-position: 100% 50%; }
  .paper .bl { background-size: 160px 160px; background-position: 0 100%; }
  .paper .b { background-size: 500% 160px; background-position: 50% 100%; }
  .paper .br { background-size: 160px 160px; background-position: 100% 100%; }
  .activity-section { position: relative; padding: 2px; }
  .activity-section + .activity-section { margin-top: 6px; }
  .activity-heading { margin: 0 0 4px 1px; color: var(--knight-gold); font-size: 9px; font-weight: 800; letter-spacing: .14em; text-shadow: 1px 1px 0 rgba(0, 0, 0, .5); }
  #activity-live, #activity-log { padding: 4px 7px; border-radius: 2px; background: var(--knight-well); box-shadow: inset 0 0 0 1px var(--knight-rim); }
  .activity-row { display: flex; gap: 7px; min-height: 18px; padding: 1px 0; align-items: center; }
  .activity-actor { display: flex; flex: 0 0 86px; gap: 5px; align-items: center; overflow: hidden; font-weight: 700; }
  .activity-badge { display: inline-flex; width: 15px; height: 15px; align-items: center; justify-content: center; border: 1px solid currentColor; border-radius: 1px; font-size: 9px; line-height: 1; }
  .activity-action { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .activity-combat { color: var(--knight-red); }
  .activity-work { color: var(--knight-gold); }
  .activity-defense { color: var(--knight-blue); }
  .activity-muted { color: var(--knight-stone-light); }
  /* The chronicle, set like a strategy game's chat frame: a timestamp, then who
     did what, with names and items in brackets and the newest line at the
     bottom. A fixed height, so the frame does not grow as lines arrive. */
  #activity-log { height: min(10.5em, 24vh); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #6b7580 transparent; }
  /* A wrapped line hangs under its own first word, so the timestamps stay a
     clean left edge to scan down. */
  .chat-line { padding: 1px 0 1px 1.2em; text-indent: -1.2em; overflow-wrap: anywhere; }
  .chat-time, .chat-note { color: var(--knight-stone-light); }
  .chat-system { color: var(--knight-gold); }
  .chat-warning { color: var(--knight-red); font-weight: 700; }
  .chat-loot { color: var(--knight-green); }
  .chat-travel { color: #c9d1d8; }
  .chat-who { font-weight: 700; }
  .who-knight, .who-warrior { color: #e0b573; }
  .who-lancer { color: var(--knight-blue); }
  .who-archer, .who-archers { color: var(--knight-green); }
  .who-monk { color: #ffffff; }
  .who-pawn { color: var(--knight-wood); }
  .who-red-raider, .who-red-pawn { color: var(--knight-red); }
  /* The file and line an error is on, which opens it. */
  .chat-link { color: var(--knight-paper); text-decoration: underline; text-decoration-color: rgba(243, 221, 160, .45); text-underline-offset: 2px; cursor: pointer; }
  .chat-link:hover { text-decoration-color: currentColor; }
  .chat-link:focus-visible { outline: 1px solid var(--vscode-focusBorder, #3794ff); outline-offset: 1px; }
  .chat-item { color: var(--knight-paper); white-space: nowrap; }
  .chat-item img { width: 16px; height: 16px; margin-right: 1px; vertical-align: -4px; image-rendering: pixelated; }
  @media (prefers-reduced-motion: reduce) {
    #activity-toggle, #activity-chevron { transition: none; }
  }
</style>
</head>
<body>
  <div id="stage" tabindex="0" aria-label="Pixel Knights island"><div id="world"><canvas id="knight"></canvas></div></div>
  <section id="activity-hud" aria-label="Pixel Knights activity">
    <button id="activity-toggle" type="button" aria-expanded="false" aria-controls="activity-panel">
      <img id="activity-mark" alt="" /><span id="activity-state">Island at peace</span><img id="activity-chevron" alt="" />
    </button>
    <div id="activity-panel" hidden>
      <div class="paper" aria-hidden="true"><i class="tl"></i><i class="t"></i><i class="tr"></i><i class="l"></i><i class="c"></i><i class="r"></i><i class="bl"></i><i class="b"></i><i class="br"></i></div>
      <div class="activity-section">
        <div class="activity-heading">LIVE ACTIVITY</div>
        <div id="activity-live" role="list"></div>
      </div>
      <div class="activity-section">
        <div class="activity-heading">CHRONICLE</div>
        <div id="activity-log" role="log" aria-live="polite"></div>
      </div>
    </div>
  </section>
  <script>
    window.__SPRITES__ = ${JSON.stringify(spriteUris)};
    window.__INITIAL_COLOUR__ = ${JSON.stringify(getColour())};
    window.__SCENE__ = ${JSON.stringify(sceneUris)};
    window.__UI__ = ${JSON.stringify(uiUris)};
  </script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

export function deactivate() {}
