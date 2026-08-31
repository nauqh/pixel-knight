(function () {
  "use strict";

  // --- Pixel-art rendering contract -------------------------------------
  // Tiny Swords art is authored at 1x (one image pixel = one art pixel) on a
  // 64px world grid, which is far too big for a sidebar. So every sheet is
  // downscaled ONCE into an offscreen canvas with nearest-neighbour and every
  // runtime blit reads from that cache at 1:1. Two rules hold:
  //   1. No per-draw fractional scaling. The only resample is the one-time
  //      1/DIV cache build; the whole viewport is then upscaled by an integer
  //      factor Z when the pane is wide enough to earn it.
  //   2. Every destination coordinate is an integer, so a sprite never lands
  //      on a half pixel and shimmers as it moves.
  // Nearest was chosen over box/bilinear by comparison: the smooth filters
  // blur the 1px outlines into mud against the water.
  const DIV = 2; // art is halved -- 64px tiles become 32px
  const T = 64 / DIV;
  const WATER = "#47aba9"; // = Terrain/Tileset/Water Background color.png
  // Past this pane width the upscale factor steps up instead of the art area.
  const ART_W_PER_STEP = 700;

  // Native metrics: [frameW, frameH, frames, anchorX, anchorY, fps].
  //
  // anchorX/anchorY is the ground contact point, measured from each sprite's
  // own baked shadow. Every unit is drawn at the SAME scale and simply stood
  // on its anchor -- no per-unit rescaling, no cropping. The pack already
  // draws every unit in proportion on a shared world grid, so normalising them
  // to a common "body height" (what this used to do) is what shrank the
  // Lancer: its frame is mostly spear, so fitting the whole frame to a body
  // height squashed the body to roughly half size.
  const NATIVE = {
    warrior_Idle: [192, 192, 8, 94, 137, 10],
    warrior_Run: [192, 192, 6, 94, 137, 12],
    warrior_Attack1: [192, 192, 4, 94, 137, 12],
    warrior_Attack2: [192, 192, 4, 94, 137, 12],
    warrior_Guard: [192, 192, 6, 94, 137, 10],
    archer_idle: [192, 192, 6, 95, 136, 6],
    archer_run: [192, 192, 4, 95, 136, 9],
    // Lancer appears only as a standing sentry, so it needs no run sheet.
    lancer_idle: [320, 320, 12, 156, 198, 6],
    pawn_idle: [192, 192, 8, 96, 135, 8],
    pawn_run: [192, 192, 6, 96, 135, 10],
    sheep_idle: [128, 128, 6, 62, 84, 5],
    sheep_move: [128, 128, 4, 62, 84, 7],
    sheep_graze: [128, 128, 12, 63, 84, 5],
    tree: [192, 256, 8, 96, 241, 4],
    tree2: [192, 256, 8, 96, 249, 4],
    tree3: [192, 192, 8, 96, 170, 4],
    tree4: [192, 192, 8, 96, 168, 4],
    stump: [192, 256, 1, 99, 240, 1],
    bush: [128, 128, 8, 64, 79, 4],
    bush2: [128, 128, 8, 64, 76, 4],
    bush3: [128, 128, 8, 62, 84, 4],
    bush4: [128, 128, 8, 63, 79, 4],
    gold: [128, 128, 1, 66, 86, 1],
    gold_res: [128, 128, 1, 63, 75, 1],
    wood_res: [64, 64, 1, 32, 46, 1],
    meat_res: [64, 64, 1, 32, 52, 1],
    rock2: [64, 64, 1, 32, 53, 1],
    rock3: [64, 64, 1, 33, 52, 1],
    rock4: [64, 64, 1, 31, 56, 1],
    castle: [320, 256, 1, 160, 249, 1],
    tower: [128, 256, 1, 64, 230, 1],
    barracks: [192, 256, 1, 96, 245, 1],
    archery: [192, 256, 1, 94, 240, 1],
    house: [128, 192, 1, 64, 173, 1],
    house2: [128, 192, 1, 64, 178, 1],
    house3: [128, 192, 1, 64, 172, 1],
    rock: [64, 64, 1, 31, 51, 1],
    // Foam is a tile-sized ring drawn *behind* the land, so it anchors on its
    // centre rather than a ground line.
    foam: [192, 192, 16, 96, 100, 8],
    wrock1: [64, 64, 16, 31, 48, 6],
    wrock3: [64, 64, 16, 33, 48, 6],
    duck: [32, 32, 3, 16, 28, 3],
    dust: [64, 64, 8, 31, 46, 16],
  };
  const SPR = {};
  for (const k of Object.keys(NATIVE)) {
    const v = NATIVE[k];
    SPR[k] = [v[0] / DIV, v[1] / DIV, v[2], Math.round(v[3] / DIV), Math.round(v[4] / DIV), v[5]];
  }

  // Troops stationed on a building's open wooden deck, as sample.gif does.
  // [dx, dy, sprite], native, relative to the building's base anchor, landing
  // the figure's feet on the front edge of the deck.
  //
  // The reference art hides the legs behind the parapet, but clipping to that
  // lip reads as junk at half scale: the shield and sword survive the cut and
  // the head does not, so the figure stops looking like a soldier. Standing
  // the whole figure on the deck is less faithful and much more legible.
  const GARRISON_NATIVE = {
    tower: [[0, -103, "archer_idle"]],
    barracks: [[0, -102, "warrior_Idle"]],
    castle: [[-58, -107, "warrior_Idle"]],
  };
  const GARRISON = {};
  for (const k of Object.keys(GARRISON_NATIVE)) {
    GARRISON[k] = GARRISON_NATIVE[k].map((g) => [
      Math.round(g[0] / DIV),
      Math.round(g[1] / DIV),
      g[2],
    ]);
  }

  // Half-scale footprint widths, used to decide which keep buildings fit.
  const BUILD_W = { castle: 156, tower: 60, barracks: 92, archery: 92 };

  const SCATTER_BUSH = ["bush", "bush2", "bush3", "bush4"];
  const SCATTER_ROCK = ["rock", "rock2", "rock3", "rock4"];
  const SCATTER_ODDS = ["stump", "wood_res", "gold_res"];

  // Both terrain sets are a nine-slice at rows 0-2. Cols 0-2 are the shoreline
  // (grass meeting water, white foam edge); cols 5-7 are the raised plateau
  // top (dark edge). Row 3 / the 4th column hold the "edges on both sides"
  // variants for land only one tile wide or tall. Rows 4-5 cols 5-8 are the
  // stone cliff face that walls a plateau in.
  const LAND_SHORE = 0;
  const LAND_PLATEAU = 5;
  function sliceIndex(i, n) {
    return n === 1 ? 3 : i === 0 ? 0 : i === n - 1 ? 2 : 1;
  }

  // Land rows in island column `gi` of terrace `t`: one more past the stair,
  // which is the step the diagonal stair tile descends.
  function colDepth(t, gi) {
    const deeper = t.side > 0 ? gi > t.stairCol : gi < t.stairCol;
    return t.landRows + (deeper ? 1 : 0);
  }

  const canvas = document.getElementById("knight");
  const stage = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const sprites = window.__SPRITES__; // per-colour unit + building sheets
  const sceneSrc = window.__SCENE__ || {}; // colour-independent terrain/decor
  let colour = window.__INITIAL_COLOUR__;

  // --- one-time downscale cache -----------------------------------------
  const sheets = {};
  function sheetFor(key) {
    // Terrain and decor are colour-independent, so they cache under a stable
    // key and survive a colour switch instead of being fetched again.
    const tinted = sprites[colour] && sprites[colour][key];
    const src = tinted !== undefined ? tinted : sceneSrc[key];
    if (!src) return null;
    const id = tinted !== undefined ? colour + "/" + key : key;
    let entry = sheets[id];
    if (!entry) {
      entry = sheets[id] = { canvas: null };
      const img = new Image();
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth / DIV));
        c.height = Math.max(1, Math.round(img.naturalHeight / DIV));
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, c.width, c.height);
        entry.canvas = c;
      };
      img.src = src;
    }
    return entry.canvas;
  }
  function preload() {
    for (const k of Object.keys(SPR)) sheetFor(k);
    sheetFor("tilemap");
  }
  preload();

  // --- viewport ----------------------------------------------------------
  let Z = 1;
  let VW = 320;
  let VH = 320;
  let island = { ox: 0, oy: 0, w: 4, h: 4 };
  // Stacked terraces, lowest first. Each spans the island's full width from
  // row 0 down to landRows, with a cliff face on the row below it, so higher
  // ground is literally drawn on top of lower ground.
  let terraces = [];
  let walk = { l: 0, r: 0, t: 0, b: 0 };
  let decor = [];

  function layout() {
    const rect = stage.getBoundingClientRect();
    const paneW = Math.max(120, Math.floor(rect.width));
    const paneH = Math.max(120, Math.floor(rect.height));

    Z = Math.max(1, Math.floor(paneW / ART_W_PER_STEP));
    VW = Math.floor(paneW / Z);
    VH = Math.floor(paneH / Z);

    canvas.width = VW * Z;
    canvas.height = VH * Z;
    canvas.style.width = VW * Z + "px";
    canvas.style.height = VH * Z + "px";
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(Z, 0, 0, Z, 0, 0);

    const iw = Math.max(4, Math.min(16, Math.floor((VW - 26) / T)));
    let ih = Math.max(4, Math.min(24, Math.floor((VH - 26) / T)));
    // A keep on the plateau stands ~125px above its base, so the island has to
    // sit lower or the castle gets shoved off the top of the viewport (and, in
    // being shoved, ends up below the plateau it is supposed to stand on).
    if (ih >= 9) ih = Math.max(9, Math.min(24, Math.floor((VH - 84) / T)));
    island = {
      ox: Math.floor((VW - iw * T) / 2),
      oy: Math.floor((VH - ih * T) / 2),
      w: iw,
      h: ih,
    };

    // Every level spans the island, the ground floor included, so the terraces
    // read as one hill cut into steps rather than as a wedding cake. What marks
    // a level is its cliff and the stair cut into it, not a narrower footprint.
    //
    // The two stairs sit on opposite sides, so the flights read as a
    // switchback: down the keep's left, across the middle level, down its right.
    //
    // Upper terrace is 3 rows, middle 3 more, each with a 1-row cliff under
    // it. Both only appear if enough rows are left over for a usable bottom.
    const TOP_H = 3;
    const MID_H = 3;
    terraces = [];
    if (ih >= 15 && iw >= 7) {
      // The upper terrace's deeper end reaches TOP_H and its cliff the row after,
      // so the middle one has to start MID_H rows below that or its buildings
      // stand tall enough to hide the step entirely.
      // side -1 puts the stair on the left, +1 on the right
      terraces.push({ landRows: TOP_H + 2 + MID_H, c0: 0, cw: iw, side: 1 });
      terraces.push({ landRows: TOP_H, c0: 0, cw: iw, side: -1 });
    } else if (ih >= 9) {
      terraces.push({ landRows: TOP_H, c0: 0, cw: iw, side: 1 });
    }
    // The stair is one diagonal tile, so the edge it sits in has to step down a
    // row for it to run along. The last LOBE columns on the stair's side sit a
    // row deeper and the stair spans the corner between the two depths.
    const LOBE = 2;
    for (const t of terraces)
      t.stairCol = t.side > 0 ? t.c0 + t.cw - 1 - LOBE : t.c0 + LOBE;

    const right = island.ox + iw * T;
    const bottom = island.oy + ih * T;
    // The lowest terrace's deeper end reaches one row past landRows and its
    // cliff sits on the row after that, so open ground starts two below.
    const lowestTerrace = terraces.length ? terraces[0].landRows + 2 : 0;
    const lowerTop = island.oy + lowestTerrace * T;
    // Against a cliff the village tucks in and looks right. With no terrace at
    // all it needs headroom, or a house's roof overhangs the top shoreline and
    // floats on the water.
    const bandTop = lowerTop + (terraces.length ? 34 : 100);

    walk = { l: island.ox + 18, r: right - 18, t: bandTop, b: bottom - 14 };
    if (walk.t > walk.b - 40) walk.t = Math.max(lowerTop + 8, walk.b - 40);

    const span = walk.b - walk.t;
    const ly = (fr) => walk.t + fr * span;
    decor = [];
    // A prop's anchor is its base, so its own height caps how high it may
    // stand before it would crop off the top of the viewport.
    const place = (key, x, y) =>
      decor.push({
        key,
        x: Math.round(x),
        y: Math.round(Math.max(y, SPR[key][4] + 2)),
      });

    // Fit as many of `wanted` between l and r as will go, then spread them
    // evenly along that span and report where each landed.
    function spreadRow(wanted, baseY, l, r) {
      const inner = r - l;
      const GAP = 8;
      const chosen = [];
      let used = 0;
      for (const k of wanted) {
        const w = BUILD_W[k] + (chosen.length ? GAP : 0);
        if (used + w <= inner) {
          chosen.push(k);
          used += w;
        }
      }
      const at = {};
      if (!chosen.length) return at;
      const slack = (inner - used) / (chosen.length + 1);
      let bx = l + slack;
      for (const k of chosen) {
        at[k] = bx + BUILD_W[k] / 2;
        place(k, at[k], baseY);
        bx += BUILD_W[k] + GAP + slack;
      }
      return at;
    }

    // A terrace's buildable span: the flat, shallower part, stopping at the
    // stair. Past it the ground is a row lower, so a building there would sit
    // at the wrong height and hang over the drop.
    const terraceSpan = (t) =>
      t.side > 0
        ? { l: island.ox + t.c0 * T, r: island.ox + t.stairCol * T }
        : { l: island.ox + (t.stairCol + 1) * T, r: island.ox + (t.c0 + t.cw) * T };

    if (terraces.length) {
      // Keep on the highest ground, military buildings on the middle terrace,
      // so the levels each have a reason to exist.
      const upper = terraces[terraces.length - 1];
      const upperBase = island.oy + upper.landRows * T - 8;
      const up = terraceSpan(upper);
      spreadRow(
        up.r - up.l >= BUILD_W.castle ? ["castle"] : ["tower"],
        upperBase, up.l, up.r
      );

      // One sentry at the head of the stair, on the flat side rather than over
      // the drop. The buildings already carry a garrison each, so more
      // free-standing soldiers just read as a crowd.
      const head = island.ox + upper.stairCol * T + T / 2;
      place("lancer_idle", head - upper.side * 30, upperBase + 6);

      if (terraces.length > 1) {
        const mid = terraces[0];
        const midBase = island.oy + mid.landRows * T - 8;
        const ms = terraceSpan(mid);
        spreadRow(["barracks", "tower"], midBase, ms.l, ms.r);
      }
    }

    // Village on the ground level. Staggered down the level and alternating
    // sides rather than lined up along the cliff, so the buildings occupy the
    // whole of the space instead of leaving the bottom half an empty lawn.
    if (terraces.length || ih >= 7) {
      if (iw >= 7) place("house2", walk.l + 82, ly(0.04));
      place("house", walk.l + 28, ly(0.14));
      if (iw >= 8) place("house3", walk.r - 34, ly(0.34));
      if (iw >= 12) place("archery", walk.l + 64, ly(0.58));
    }

    // Things for the village to be about, so the lower level reads as lived-in
    // rather than as lawn: a woodcutting stand, a gold seam being worked, and
    // stores stacked by the houses.
    place("tree", walk.r - 26, ly(0.8));
    if (ih >= 10) {
      place("tree3", walk.r - 76, ly(0.92));
      place("tree4", walk.l + 34, ly(0.7));
      place("stump", walk.l + 88, ly(0.84));
    }
    if (iw >= 7) {
      place("gold", walk.r - 24, ly(0.5));
      place("gold_res", walk.r - 62, ly(0.44));
    }
    place("wood_res", walk.l + 26, ly(0.26));
    place("sheep_graze", walk.r - 104, ly(0.64));

    // Ground cover scattered to a density, not a fixed count, so a big island
    // doesn't read as an empty lawn. Seeded from the island size so the scene
    // is stable frame to frame but re-composes when the pane is resized.
    const bandW = walk.r - walk.l;
    const target = Math.max(5, Math.min(26, Math.round((iw * ih) / 9)));
    let seed = (iw * 73856093) ^ (ih * 19349663);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const placed = decor.map((d) => [d.x, d.y]);
    let added = 0;
    for (let tries = 0; tries < target * 12 && added < target; tries++) {
      // Draw from every variant the pack ships, not one bush and one rock --
      // repeating a single sprite is what made the ground read as wallpaper.
      const roll = rnd();
      const key =
        roll < 0.54
          ? SCATTER_BUSH[(rnd() * SCATTER_BUSH.length) | 0]
          : roll < 0.84
          ? SCATTER_ROCK[(rnd() * SCATTER_ROCK.length) | 0]
          : SCATTER_ODDS[(rnd() * SCATTER_ODDS.length) | 0];
      const x = walk.l + rnd() * bandW;
      const y = walk.t + rnd() * span;
      let ok = true;
      for (const [px, py] of placed) {
        if (Math.abs(px - x) < 34 && Math.abs(py - y) < 26) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      placed.push([x, y]);
      place(key, x, y);
      added++;
    }

    clampAll();
  }

  // --- drawing -----------------------------------------------------------
  function drawSprite(key, gx, gy, frameIdx, flip) {
    const sheet = sheetFor(key);
    if (!sheet) return;
    const s = SPR[key];
    const fw = s[0], fh = s[1], ax = s[3], ay = s[4];
    const sx = (frameIdx % s[2]) * fw;
    const dx = Math.round(gx - ax);
    const dy = Math.round(gy - ay);
    if (flip) {
      ctx.save();
      ctx.translate(dx + fw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, 0, fw, fh, 0, 0, fw, fh);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, 0, fw, fh, dx, dy, fw, fh);
    }
  }

  function frameAt(key, now, offset) {
    return Math.floor((now / 1000) * SPR[key][5] + (offset || 0)) % SPR[key][2];
  }

  function drawTile(r, c, x, y) {
    const sheet = sheetFor("tilemap");
    if (!sheet) return;
    ctx.drawImage(sheet, c * T, r * T, T, T, Math.round(x), Math.round(y), T, T);
  }

  function drawLand(px, py, w, h, base) {
    for (let j = 0; j < h; j++) {
      const r = sliceIndex(j, h);
      for (let i = 0; i < w; i++) drawTile(r, base + sliceIndex(i, w), px + i * T, py + j * T);
    }
  }

  function drawTerrain(now) {
    const { ox, oy, w, h } = island;
    // Animated foam ring: one foam sprite centred on each perimeter tile,
    // behind the land, so only its outer white edge shows.
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (i > 0 && i < w - 1 && j > 0 && j < h - 1) continue;
        drawSprite("foam", ox + i * T + T / 2, oy + j * T + T / 2, frameAt("foam", now, i + j), false);
      }
    }
    drawLand(ox, oy, w, h, LAND_SHORE);
    // Lowest terrace first, so the next one up stacks cleanly on its land.
    for (const t of terraces) {
      const sc = t.stairCol;
      const lobe = t.side > 0 ? sc + 1 : sc - 1; // deeper end's column by the stair
      for (let i = 0; i < t.cw; i++) {
        const gi = t.c0 + i;
        const d = colDepth(t, gi);
        for (let j = 0; j < d; j++) {
          // The deeper end is its own block, so its first column needs a side
          // edge on the row the shallower part never reaches.
          const cs =
            j === d - 1 && gi === lobe ? (t.side > 0 ? 0 : 2) : sliceIndex(i, t.cw);
          drawTile(sliceIndex(j, d), LAND_PLATEAU + cs, ox + gi * T, oy + j * T);
        }
        // Wall row 4, not 5: row 5 is the same stone footed in water and so
        // carries a white shoreline, wrong for a cliff standing on grass.
        if (gi !== sc) drawTile(4, 5 + sliceIndex(i, t.cw), ox + gi * T, oy + d * T);
      }
      // The stair is cut into the cliff, not into the lawn, so the wall carries
      // on behind it: one tile for the drop to the deeper end, another for the
      // drop off that, which the ramp spans in one go. Each is the end cap of
      // the run it belongs to, and the runs sit on opposite sides of the stair.
      const cap = t.side > 0 ? 7 : 5;
      drawTile(4, cap, ox + sc * T, oy + t.landRows * T);
      drawTile(4, 12 - cap, ox + sc * T, oy + (t.landRows + 1) * T);
      // Cols 0 and 3 of rows 4-5 are a grass ramp two tiles tall, and it runs
      // diagonally: col 0 falls to the left, col 3 to the right. It only reads
      // as a stair if the edge it sits in steps down by a row to match, which
      // is what the deeper end above is for.
      const rc = t.side > 0 ? 0 : 3;
      drawTile(4, rc, ox + sc * T, oy + t.landRows * T);
      drawTile(5, rc, ox + sc * T, oy + (t.landRows + 1) * T);
    }
  }

  function drawWater(now) {
    const { ox, oy, w, h } = island;
    drawSprite("wrock1", ox - 10, oy + 44, frameAt("wrock1", now, 0), false);
    drawSprite("wrock3", ox + w * T + 12, oy + h * T - 34, frameAt("wrock3", now, 3), false);
    drawSprite("duck", Math.min(VW - 12, ox + w * T + 10), oy + 24, frameAt("duck", now, 0), false);
  }

  // --- entities ----------------------------------------------------------
  const ARRIVE = 3;

  // home = where in the walkable band this unit lives, as a fraction of it;
  // roam = how far it strays. Giving each unit its own patch is what stops the
  // cast from piling up on one spot and keeps the scene composed.
  function makeUnit(kind, speed, idleKey, runKey, home, roam) {
    return {
      kind, speed, idleKey, runKey, home, roam,
      x: 0, y: 0, placed: false, target: null,
      pauseUntil: 0, facing: 1, moving: false,
    };
  }

  function unitBounds(u) {
    const bw = walk.r - walk.l;
    const bh = walk.b - walk.t;
    const hx = walk.l + u.home[0] * bw;
    const hy = walk.t + u.home[1] * bh;
    const rx = u.roam * bw;
    const ry = u.roam * bh;
    return {
      hx, hy,
      l: Math.max(walk.l, hx - rx), r: Math.min(walk.r, hx + rx),
      t: Math.max(walk.t, hy - ry), b: Math.min(walk.b, hy + ry),
    };
  }

  const knight = makeUnit("knight", 16, "warrior_Idle", "warrior_Run", [0.45, 0.66], 0.42);
  const units = [knight];
  let archer = null;
  let pawn = null;

  // A villager rather than a second soldier: every building already carries a
  // garrison, so the ground level should look worked, not patrolled.
  function ensureCompanions() {
    if (!pawn) {
      pawn = makeUnit("pawn", 11, "pawn_idle", "pawn_run", [0.24, 0.3], 0.17);
      units.push(pawn);
    }
    if (island.w * island.h >= 90 && !archer) {
      archer = makeUnit("archer", 10, "archer_idle", "archer_run", [0.8, 0.46], 0.14);
      units.push(archer);
    }
  }

  const sheep = makeUnit("sheep", 6, "sheep_idle", "sheep_move", [0.34, 0.9], 0.12);
  units.push(sheep);

  function clampAll() {
    ensureCompanions();
    for (const u of units) {
      const b = unitBounds(u);
      if (!u.placed || u.x < b.l || u.x > b.r || u.y < b.t || u.y > b.b) {
        u.x = b.hx;
        u.y = b.hy;
        u.placed = true;
      }
      u.target = null;
    }
  }

  function updateUnit(u, dt, now) {
    if (now < u.pauseUntil) {
      u.moving = false;
      return;
    }
    if (!u.target) {
      const b = unitBounds(u);
      u.target = { x: b.l + Math.random() * (b.r - b.l), y: b.t + Math.random() * (b.b - b.t) };
    }
    const dx = u.target.x - u.x;
    const dy = u.target.y - u.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ARRIVE) {
      u.target = null;
      u.pauseUntil = now + 900 + Math.random() * 2200;
      u.moving = false;
      return;
    }
    u.x += (dx / dist) * u.speed * dt;
    u.y += (dy / dist) * u.speed * dt;
    if (Math.abs(dx) > 2) u.facing = dx < 0 ? -1 : 1;
    u.moving = true;
  }

  // --- knight reaction state --------------------------------------------
  let mode = "wander"; // "wander" | "reaction"
  let reactionKey = null;
  let reactionOnce = false;
  let reactionFrame = 0;
  let reactionLastAt = 0;

  function knightKey() {
    if (mode === "reaction") return reactionKey;
    return knight.moving ? "warrior_Run" : "warrior_Idle";
  }

  // --- dust --------------------------------------------------------------
  const DUST_MS = (SPR.dust[2] / SPR.dust[5]) * 1000;
  let dust = [];
  let lastDustAt = 0;
  function spawnDust(now) {
    if (now - lastDustAt < 380) return;
    lastDustAt = now;
    dust.push({ x: knight.x, y: knight.y, at: now });
  }
  function drawDust(now) {
    dust = dust.filter((p) => now - p.at < DUST_MS);
    for (const p of dust) {
      const f = Math.floor(((now - p.at) / 1000) * SPR.dust[5]);
      drawSprite("dust", p.x, p.y + 2, Math.min(f, SPR.dust[2] - 1), false);
    }
  }

  // --- frame loop --------------------------------------------------------
  let lastTick = 0;

  function tick(ts) {
    const dt = lastTick ? Math.min((ts - lastTick) / 1000, 0.1) : 0;
    lastTick = ts;

    if (mode === "wander") {
      updateUnit(knight, dt, ts);
      if (knight.moving) spawnDust(ts);
    } else {
      knight.moving = false;
      const s = SPR[reactionKey];
      if (ts - reactionLastAt >= 1000 / s[5]) {
        reactionLastAt = ts;
        if (reactionFrame >= s[2] - 1) {
          if (reactionOnce) mode = "wander";
        } else {
          reactionFrame++;
        }
      }
    }
    for (const u of units) if (u !== knight) updateUnit(u, dt, ts);

    ctx.setTransform(Z, 0, 0, Z, 0, 0);
    ctx.fillStyle = WATER;
    ctx.fillRect(0, 0, VW, VH);

    drawWater(ts);
    drawTerrain(ts);
    drawDust(ts);

    // Painter's algorithm: everything standing on the ground sorts by its
    // contact point, so units walk in front of and behind props correctly.
    const order = [];
    for (const d of decor) {
      order.push({
        y: d.y,
        draw: () => {
          drawSprite(d.key, d.x, d.y, frameAt(d.key, ts, d.x), false);
          // Garrison rides with its building so it always draws just after it.
          const troops = GARRISON[d.key];
          if (!troops) return;
          for (const [gx, gy, who] of troops) {
            drawSprite(who, d.x + gx, d.y + gy, frameAt(who, ts, d.x + gx), gx > 0);
          }
        },
      });
    }
    for (const u of units) {
      order.push({
        y: u.y,
        draw: () => {
          const key = u === knight ? knightKey() : u.moving ? u.runKey : u.idleKey;
          const f =
            u === knight && mode === "reaction"
              ? reactionFrame
              : frameAt(key, ts, u === knight ? 0 : u.x);
          drawSprite(key, u.x, u.y, f, u.facing === -1);
        },
      });
    }
    order.sort((a, b) => a.y - b.y);
    for (const o of order) o.draw();

    requestAnimationFrame(tick);
  }

  // --- host messages -----------------------------------------------------
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "play") {
      if (msg.anim === "Idle") {
        mode = "wander";
        return;
      }
      const key = "warrior_" + msg.anim;
      if (!SPR[key]) return;
      mode = "reaction";
      reactionKey = key;
      reactionOnce = !!msg.once;
      reactionFrame = 0;
      reactionLastAt = 0;
    } else if (msg.type === "colour") {
      colour = msg.colour;
      preload();
    }
  });

  new ResizeObserver(layout).observe(stage);
  layout();
  requestAnimationFrame(tick);
})();
