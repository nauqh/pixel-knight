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
		warrior_Guard: [192, 192, 6, 94, 137, 10],
		// The swing dips below the feet, so this sheet's own shadow measures ~155.
		// It keeps the family's 137 anyway: matching its siblings is what stops the
		// knight hopping as he alternates guard and swing.
		warrior_Attack1: [192, 192, 4, 94, 137, 12],
		// Red faction, same sheets as the knight's own, so the anchors match.
		enemy_Idle: [192, 192, 8, 94, 137, 10],
		enemy_Run: [192, 192, 6, 94, 137, 12],
		enemy_Attack1: [192, 192, 4, 94, 137, 12],
		archer_idle: [192, 192, 6, 95, 136, 6],
		archer_run: [192, 192, 4, 95, 136, 9],
		archer_shoot: [192, 192, 8, 95, 136, 12],
		// Lancer sheets all keep the idle's anchor. Measured apart they differ by
		// about 4 native pixels, which is below the halved grid and not worth a pop
		// between animations.
		lancer_idle: [320, 320, 12, 156, 198, 6],
		lancer_run: [320, 320, 6, 156, 198, 12],
		lancer_attack: [320, 320, 3, 156, 198, 8],
		// A projectile, so it anchors on its centre and spins about it rather than
		// standing on the ground.
		arrow: [64, 64, 1, 32, 32, 1],
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
		SPR[k] = [
			v[0] / DIV,
			v[1] / DIV,
			v[2],
			Math.round(v[3] / DIV),
			Math.round(v[4] / DIV),
			v[5],
		];
	}

	// Troops stationed on a building's open wooden deck
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
	// Where a landing gets met. Fixed rather than wherever the knight happens to
	// be standing: a front that tracked a wandering target would have every
	// defender re-aiming every frame, and the fight would never read as a line.
	let front = { x: 0, y: 0 };
	// Ground kept clear of props so the fight stays readable.
	let battle = { l: 0, r: 0, t: 0, b: 0 };
	// The lancer's sentry post on the keep's terrace, and the stair-by-stair
	// route down to the shore. Null on an island too small to have terraces.
	let lancerPost = null;
	let sallyPath = [];
	// The post, the stairs and the battle station as one walkable list.
	let lancerRoute = [];

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
		// Both are terrace-derived, so a pane too short for a keep simply has no
		// lancer rather than one standing on the lawn with nowhere to sally from.
		lancerPost = null;
		sallyPath = [];
		if (ih >= 15 && iw >= 7) {
			// The upper terrace's deeper end reaches TOP_H and its cliff the row after,
			// so the middle one has to start MID_H rows below that or its buildings
			// stand tall enough to hide the step entirely.
			// side -1 puts the stair on the left, +1 on the right
			terraces.push({
				landRows: TOP_H + 2 + MID_H,
				c0: 0,
				cw: iw,
				side: 1,
			});
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

		// Raiders come off the right shore, so the beachhead sits over there and
		// the whole defence forms up to its left. Held clear of walk.r by more than
		// half a body so a landed raider is on the grass, not in the surf, and low
		// in the band so the village has the whole top of it to itself.
		front = {
			x: Math.round(walk.r - 56),
			y: Math.round(walk.b - 30),
		};
		// Ground reserved for the fight. A 220px band cannot hold both a village
		// and a battle line, and the first attempt put a pine tree over the raiders
		// and a bush between the knight and his target. Props inside this rectangle
		// are dropped rather than nudged: a thinner village costs nothing, and
		// dropping is what keeps the rule holding at pane sizes nobody tuned by eye.
		battle = {
			l: front.x - 100,
			r: front.x + 52,
			t: front.y - 58,
			b: front.y + 46,
		};

		const span = walk.b - walk.t;
		const ly = (fr) => walk.t + fr * span;
		decor = [];
		// A prop's anchor is its base, so its own height caps how high it may
		// stand before it would crop off the top of the viewport. Anything TALL
		// that ends up on the battlefield is dropped instead of placed: a pine over
		// the raiders is what the reservation exists to prevent. Short things --
		// rocks, dropped stores -- are let through, because they sit below knee
		// height on a fighter and read as ground rather than as cover. Without
		// them the shore is a bald lawn for as long as nothing is attacking it,
		// which is nearly all of the time.
		const onField = (key, x, y) =>
			SPR[key][4] > 30 &&
			x > battle.l &&
			x < battle.r &&
			y > battle.t &&
			y < battle.b;
		const place = (key, x, y) => {
			const py = Math.round(Math.max(y, SPR[key][4] + 2));
			if (onField(key, x, py)) return;
			decor.push({ key, x: Math.round(x), y: py });
		};

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
				: {
						l: island.ox + (t.stairCol + 1) * T,
						r: island.ox + (t.c0 + t.cw) * T,
					};

		if (terraces.length) {
			// Keep on the highest ground, military buildings on the middle terrace,
			// so the levels each have a reason to exist.
			const upper = terraces[terraces.length - 1];
			const upperBase = island.oy + upper.landRows * T - 8;
			const up = terraceSpan(upper);
			spreadRow(
				up.r - up.l >= BUILD_W.castle ? ["castle"] : ["tower"],
				upperBase,
				up.l,
				up.r,
			);

			// One sentry at the head of the stair, on the flat side rather than over
			// the drop. The buildings already carry a garrison each, so more
			// free-standing soldiers just read as a crowd.
			//
			// He is a unit rather than a prop because he sallies: the stairs were
			// built as a switchback and this is the one thing on the island that
			// actually uses them.
			const head = island.ox + upper.stairCol * T + T / 2;
			lancerPost = {
				x: Math.round(head - upper.side * 30),
				y: upperBase + 6,
			};

			// Each terrace is left by its own stair, which occupies the two rows
			// below its land. Walking the top of one to the foot of it is what keeps
			// the lancer on the ramp instead of stepping off the cliff beside it.
			sallyPath = [];
			for (let i = terraces.length - 1; i >= 0; i--) {
				const t = terraces[i];
				const sx = Math.round(island.ox + t.stairCol * T + T / 2);
				sallyPath.push({ x: sx, y: island.oy + t.landRows * T - 4 });
				sallyPath.push({ x: sx, y: island.oy + (t.landRows + 2) * T });
			}

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
			place("house", walk.l + 28, ly(0.16));
			if (iw >= 8) place("house3", walk.r - 34, ly(0.06));
			if (iw >= 12) place("archery", walk.l + 58, ly(0.44));
		}

		// Things for the village to be about, so the lower level reads as lived-in
		// rather than as lawn: a woodcutting stand, a gold seam being worked, and
		// stores stacked by the houses.
		//
		// The bottom of the band is the landing ground, so the village keeps to the
		// top of it and the woods to the left shore. Anything still standing on the
		// battlefield is dropped by `place`, which is what holds this together at
		// pane sizes these fractions were never tuned against.
		place("tree", walk.l + 22, ly(0.64));
		if (ih >= 10) {
			place("tree3", walk.l + 16, ly(0.84));
			place("tree4", walk.l + 44, ly(0.96));
			place("stump", walk.l + 24, ly(0.44));
		}
		if (iw >= 7) {
			place("gold", walk.r - 84, ly(0.24));
			place("gold_res", walk.r - 40, ly(0.3));
		}
		place("wood_res", walk.l + 74, ly(0.3));
		place("sheep_graze", walk.l + 50, ly(0.54));

		// Ground cover scattered to a density, not a fixed count, so a big island
		// doesn't read as an empty lawn. Seeded from the island size so the scene
		// is stable frame to frame but re-composes when the pane is resized.
		const bandW = walk.r - walk.l;
		const target = Math.max(5, Math.min(26, Math.round((iw * ih) / 9)));
		let seed = (iw * 73856093) ^ (ih * 19349663);
		const rnd = () =>
			(seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
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
			// Rejected here rather than left to `place`, so the roll is spent
			// somewhere useful instead of counting against the density target.
			if (onField(key, x, y)) continue;
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

		// A garrison figure is drawn as part of its building, but an archer also
		// has to shoot, which needs somewhere to keep its draw clock. Resolved into
		// the decor entry once per layout rather than rebuilt every frame.
		for (const d of decor) {
			const troops = GARRISON[d.key];
			if (!troops) continue;
			d.troops = troops.map(([gx, gy, who]) => ({
				x: d.x + gx,
				y: d.y + gy,
				who,
				flip: gx > 0,
				nockedAt: -1,
				loosed: false,
			}));
		}

		lancerRoute = lancerPost
			? [lancerPost].concat(sallyPath, [
					{
						x: front.x + STATION.lancer[0],
						y: front.y + STATION.lancer[1],
					},
				])
			: [];

		clampAll();
	}

	// --- drawing -----------------------------------------------------------
	function drawSprite(key, gx, gy, frameIdx, flip) {
		const sheet = sheetFor(key);
		if (!sheet) return;
		const s = SPR[key];
		const fw = s[0],
			fh = s[1],
			ax = s[3],
			ay = s[4];
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
		return (
			Math.floor((now / 1000) * SPR[key][5] + (offset || 0)) % SPR[key][2]
		);
	}

	function drawTile(r, c, x, y) {
		const sheet = sheetFor("tilemap");
		if (!sheet) return;
		ctx.drawImage(
			sheet,
			c * T,
			r * T,
			T,
			T,
			Math.round(x),
			Math.round(y),
			T,
			T,
		);
	}

	function drawLand(px, py, w, h, base) {
		for (let j = 0; j < h; j++) {
			const r = sliceIndex(j, h);
			for (let i = 0; i < w; i++)
				drawTile(r, base + sliceIndex(i, w), px + i * T, py + j * T);
		}
	}

	function drawTerrain(now) {
		const { ox, oy, w, h } = island;
		// Animated foam ring: one foam sprite centred on each perimeter tile,
		// behind the land, so only its outer white edge shows.
		for (let j = 0; j < h; j++) {
			for (let i = 0; i < w; i++) {
				if (i > 0 && i < w - 1 && j > 0 && j < h - 1) continue;
				drawSprite(
					"foam",
					ox + i * T + T / 2,
					oy + j * T + T / 2,
					frameAt("foam", now, i + j),
					false,
				);
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
						j === d - 1 && gi === lobe
							? t.side > 0
								? 0
								: 2
							: sliceIndex(i, t.cw);
					drawTile(
						sliceIndex(j, d),
						LAND_PLATEAU + cs,
						ox + gi * T,
						oy + j * T,
					);
				}
				// Wall row 4, not 5: row 5 is the same stone footed in water and so
				// carries a white shoreline, wrong for a cliff standing on grass.
				if (gi !== sc)
					drawTile(
						4,
						5 + sliceIndex(i, t.cw),
						ox + gi * T,
						oy + d * T,
					);
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
		drawSprite(
			"wrock1",
			ox - 10,
			oy + 44,
			frameAt("wrock1", now, 0),
			false,
		);
		drawSprite(
			"wrock3",
			ox + w * T + 12,
			oy + h * T - 34,
			frameAt("wrock3", now, 3),
			false,
		);
		drawSprite(
			"duck",
			Math.min(VW - 12, ox + w * T + 10),
			oy + 24,
			frameAt("duck", now, 0),
			false,
		);
	}

	// --- entities ----------------------------------------------------------
	const ARRIVE = 3;

	// home = where in the walkable band this unit lives, as a fraction of it;
	// roam = how far it strays. Giving each unit its own patch is what stops the
	// cast from piling up on one spot and keeps the scene composed.
	function makeUnit(kind, speed, idleKey, runKey, home, roam) {
		return {
			kind,
			speed,
			idleKey,
			runKey,
			home,
			roam,
			x: 0,
			y: 0,
			placed: false,
			target: null,
			pauseUntil: 0,
			facing: 1,
			moving: false,
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
			hx,
			hy,
			l: Math.max(walk.l, hx - rx),
			r: Math.min(walk.r, hx + rx),
			t: Math.max(walk.t, hy - ry),
			b: Math.min(walk.b, hy + ry),
		};
	}

	const knight = makeUnit(
		"knight",
		16,
		"warrior_Idle",
		"warrior_Run",
		[0.45, 0.66],
		0.42,
	);
	const units = [knight];
	let archer = null;
	let pawn = null;
	// Not in `units`: he has a post and a route rather than a patch to wander,
	// so none of the roaming machinery applies to him.
	let lancer = null;

	// Somewhere to be while a raid is on, for the figures with no business at the
	// shore. The battlefield is only kept clear of props, so without this the
	// pawn and the sheep wander straight through the line.
	function retreatsTo(u, home) {
		u.peaceHome = u.home;
		u.warHome = home;
		return u;
	}

	// A villager rather than a second soldier: every building already carries a
	// garrison, so the ground level should look worked, not patrolled.
	function ensureCompanions() {
		if (!pawn) {
			pawn = makeUnit(
				"pawn",
				11,
				"pawn_idle",
				"pawn_run",
				[0.24, 0.3],
				0.17,
			);
			units.push(retreatsTo(pawn, [0.16, 0.14]));
		}
		if (island.w * island.h >= 90 && !archer) {
			archer = makeUnit(
				"archer",
				10,
				"archer_idle",
				"archer_run",
				[0.8, 0.46],
				0.14,
			);
			units.push(retreatsTo(archer, [0.74, 0.1]));
		}
		if (lancerPost && !lancer)
			lancer = {
				x: 0,
				y: 0,
				facing: -1,
				moving: false,
				fighting: false,
				leg: 0,
			};
		if (!lancerPost) lancer = null;
	}

	const sheep = makeUnit(
		"sheep",
		6,
		"sheep_idle",
		"sheep_move",
		[0.34, 0.9],
		0.12,
	);
	units.push(retreatsTo(sheep, [0.12, 0.72]));

	function clampAll() {
		ensureCompanions();
		// A resize moves the shore and every station with it, so anything mid-march
		// would be walking to a place that no longer exists. Drop the raid and let
		// syncRaiders land a fresh wave against the new layout; the lancer goes
		// back to his post the same way, since his route was rebuilt under him.
		raiders = [];
		arrows = [];
		if (lancer) {
			lancer.x = lancerPost.x;
			lancer.y = lancerPost.y;
			lancer.leg = 0;
			lancer.fighting = false;
			lancer.act = null;
		}
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
			u.target = {
				x: b.l + Math.random() * (b.r - b.l),
				y: b.t + Math.random() * (b.b - b.t),
			};
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

	// --- war -----------------------------------------------------------------
	// The island is a readout of the codebase: one raider per error. The host
	// sends the count, the renderer decides what that looks like -- and what it
	// looks like is a defence, not a beating. Red lands on the shore, the
	// garrison forms a line and hits back.
	//
	// Capped at three because the walk band is only about 240px wide in a normal
	// sidebar and the line already holds three defenders. Past three the scene
	// turns to mush, and "several" reads the same as "many" at this size anyway.
	const RAIDER_CAP = 3;
	// Landed positions relative to the front: one in the van, two behind it.
	const RAIDER_SLOTS = [
		[0, 0],
		[30, -20],
		[30, 21],
	];
	const RAIDER_SPEED = 26;
	// Defenders cross open ground faster than they patrol it. A garrison that
	// strolled to the shore at wandering speed would let the raid look unopposed
	// for the several seconds that matter most.
	const MARCH_SPEED = 44;
	// The sally is about 450px of switchback in a sidebar-sized pane. Slower than
	// this and the lancer never arrives before a normal error is fixed; faster
	// and he skates down the stairs.
	const LANCER_SPEED = 68;
	const ENGAGE = 3;

	// Battle stations relative to the front. Each defender stands at the range
	// its own sheet reaches, which is also what keeps them out of each other:
	// the lancer's thrust carries 75px and the knight's swing 34, so posting them
	// at one distance would bury one inside the other. The lancer's row sits low
	// enough that his levelled spear passes below the knight's feet instead of
	// through his shins.
	//
	// The ground archer is deliberately not in the line. Adding him spread it to
	// 170px across a 220px band, which left no room for the village and buried
	// the fight in trees; the covering fire comes from the towers, where an
	// archer is already standing and costs the line nothing.
	// Measured off the attack sheet: the levelled spear reaches 75px forward but
	// sits only 13px above the lancer's own feet, so he has to stand almost level
	// with what he is hitting. That is why he takes the low raider rather than
	// the one the knight has -- aimed at the same target he would be standing in
	// the knight's place, and aimed from further back the thrust lands in the
	// grass short of anybody.
	const STATION = {
		knight: [-30, -10],
		lancer: [-56, 12],
	};

	// Two blows then a beat of guard. Swinging without pause reads as a windmill;
	// the guard is what makes it look like an exchange rather than one animation
	// left running. Entries may cap their own duration, which the lancer's idle
	// needs -- played whole it is a two-second stand-around between thrusts.
	const KNIGHT_CYCLE = [
		["warrior_Attack1"],
		["warrior_Attack1"],
		["warrior_Guard"],
	];
	// The lancer just jabs. His idle was tried as the recovery beat and reads as
	// parade rest -- spear straight up, plainly not fighting -- because that is
	// what the sheet is. A spearman working a line does not pause anyway.
	const LANCER_CYCLE = [["lancer_attack"]];
	const RAIDER_CYCLE = [["enemy_Attack1"], ["enemy_Idle", 300]];
	// The frame the arrow leaves the bow, measured off the sheet: its drawn width
	// jumps from +37 to +45 native pixels here and nowhere else.
	const ARCHER_SHOT_FRAME = 5;
	const ARROW_SPEED = 190;

	let errorCount = 0;
	let raiders = [];
	let arrows = [];

	function dist2(a, b) {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return dx * dx + dy * dy;
	}

	// Walk one unit at another point, reporting arrival. Snaps once this frame's
	// step would carry it past: a plain threshold gets stepped over on a slow
	// frame, leaving the unit oscillating around the spot instead of settling.
	function stepToward(u, tx, ty, speed, dt) {
		const dx = tx - u.x;
		const dy = ty - u.y;
		const dist = Math.hypot(dx, dy);
		const step = speed * dt;
		if (dist <= Math.max(ENGAGE, step)) {
			u.x = tx;
			u.y = ty;
			u.moving = false;
			return true;
		}
		u.x += (dx / dist) * step;
		u.y += (dy / dist) * step;
		if (Math.abs(dx) > 2) u.facing = dx < 0 ? -1 : 1;
		u.moving = true;
		return false;
	}

	function animMs(key) {
		return (SPR[key][2] / SPR[key][5]) * 1000;
	}
	// One play-through, held on the last frame if it overruns its slot.
	function playFrame(key, since, now) {
		return Math.min(
			SPR[key][2] - 1,
			Math.floor(((now - since) / 1000) * SPR[key][5]),
		);
	}
	// Step a fighter through its cycle. Each entry is played whole, so a blow is
	// never cut off part-way by the next one starting.
	function beat(u, now, cycle) {
		if (!u.act || now >= u.actUntil) {
			u.step = ((u.step || 0) + 1) % cycle.length;
			const e = cycle[u.step];
			u.act = e[0];
			u.actAt = now;
			u.actUntil = now + (e[1] || animMs(e[0]));
		}
		return u.act;
	}

	function syncRaiders(now) {
		const want = Math.min(errorCount, RAIDER_CAP);
		// They wade in from off the right shore, so an arrival reads as a landing
		// rather than as a figure blinking into existence on the lawn.
		while (raiders.length < want)
			raiders.push({
				x: walk.r + 30 + raiders.length * 26,
				y: front.y,
				facing: -1,
				fighting: false,
			});
		// A raider leaving means its error was fixed, so it dies where it stood.
		// Always the one nearest the front: killing the newest instead would drop
		// whichever is still wading in, puffing dust out over open water.
		while (raiders.length > want) {
			let k = 0;
			for (let i = 1; i < raiders.length; i++)
				if (dist2(raiders[i], front) < dist2(raiders[k], front)) k = i;
			const gone = raiders.splice(k, 1)[0];
			puff(gone.x, gone.y, now);
		}
	}

	function updateRaider(r, i, dt) {
		const slot = RAIDER_SLOTS[i % RAIDER_SLOTS.length];
		r.fighting = stepToward(
			r,
			front.x + slot[0],
			front.y + slot[1],
			RAIDER_SPEED,
			dt,
		);
		// The defence is always to their left, so a landed raider stops turning.
		if (r.fighting) r.facing = -1;
	}

	// Post, then the foot of each stair, then the battle station. The lancer
	// holds an index into this and walks it forward under attack and backward
	// after, so he uses the switchback in both directions rather than stepping
	// off the cliff beside it.
	function updateLancer(dt) {
		if (!lancer) return;
		const want = raiders.length ? lancerRoute.length - 1 : 0;
		lancer.fighting =
			lancer.leg === lancerRoute.length - 1 && lancerRoute.length > 1;
		if (lancer.leg === want) {
			lancer.moving = false;
			if (lancer.fighting) lancer.facing = 1;
			return;
		}
		const next = lancer.leg + (want > lancer.leg ? 1 : -1);
		if (
			stepToward(
				lancer,
				lancerRoute[next].x,
				lancerRoute[next].y,
				LANCER_SPEED,
				dt,
			)
		)
			lancer.leg = next;
	}

	// --- arrows --------------------------------------------------------------
	function spawnArrow(x, y, tx, ty) {
		const d = Math.hypot(tx - x, ty - y);
		if (!d) return;
		const ang = Math.atan2(ty - y, tx - x);
		arrows.push({
			x,
			y,
			ang,
			vx: ((tx - x) / d) * ARROW_SPEED,
			vy: ((ty - y) / d) * ARROW_SPEED,
			left: d / ARROW_SPEED,
		});
	}
	function updateArrows(dt) {
		for (const a of arrows) {
			a.x += a.vx * dt;
			a.y += a.vy * dt;
			a.left -= dt;
		}
		arrows = arrows.filter((a) => a.left > 0);
	}
	// The one place the no-resampling rule bends. An arrow that only ever flew
	// level would be worse than a rotated one, and with smoothing off the
	// rotation stays nearest-neighbour: jagged rather than blurred, which is the
	// right way for pixel art to fail.
	function drawArrow(a) {
		const sheet = sheetFor("arrow");
		if (!sheet) return;
		const s = SPR.arrow;
		ctx.save();
		ctx.translate(Math.round(a.x), Math.round(a.y));
		ctx.rotate(a.ang);
		ctx.drawImage(sheet, 0, 0, s[0], s[1], -s[3], -s[4], s[0], s[1]);
		ctx.restore();
	}
	// Loop the shoot sheet and loose the instant the release frame comes up. The
	// sheet stops at the release, so the arrow has to fly on its own from here.
	function volley(a, now) {
		const n = SPR.archer_shoot[2];
		if (a.nockedAt < 0) a.nockedAt = now;
		let f = Math.floor(((now - a.nockedAt) / 1000) * SPR.archer_shoot[5]);
		if (f >= n) {
			a.nockedAt = now;
			f = 0;
		}
		if (f !== ARCHER_SHOT_FRAME) a.loosed = false;
		else if (!a.loosed && raiders.length) {
			a.loosed = true;
			// Spread the volley over the landing party rather than focusing one
			// raider, so the tower reads as covering the beach.
			const mark = raiders[(Math.random() * raiders.length) | 0];
			spawnArrow(a.x + 16, a.y - 26, mark.x, mark.y - 22);
		}
		return f;
	}

	// --- poses ---------------------------------------------------------------
	// Each returns [sheet, frame]: combat frames run off the unit's own beat
	// clock, ambient ones off wall time, so a swing never starts mid-arc.
	function knightPose(now) {
		if (!raiders.length || !knight.atPost) {
			knight.act = null;
			const k = knight.moving ? "warrior_Run" : "warrior_Idle";
			return [k, frameAt(k, now, 0)];
		}
		const k = beat(knight, now, KNIGHT_CYCLE);
		return [k, playFrame(k, knight.actAt, now)];
	}
	function lancerPose(now) {
		if (!lancer.fighting) {
			lancer.act = null;
			const k = lancer.moving ? "lancer_run" : "lancer_idle";
			return [k, frameAt(k, now, lancer.x)];
		}
		const k = beat(lancer, now, LANCER_CYCLE);
		return [k, playFrame(k, lancer.actAt, now)];
	}
	function raiderPose(r, now) {
		if (!r.fighting) return ["enemy_Run", frameAt("enemy_Run", now, r.x)];
		if (!r.engaged) {
			r.act = null;
			return ["enemy_Idle", frameAt("enemy_Idle", now, r.x)];
		}
		const k = beat(r, now, RAIDER_CYCLE);
		return [k, playFrame(k, r.actAt, now)];
	}
	function unitPose(u, now) {
		if (u === knight) return knightPose(now);
		const k = u.moving ? u.runKey : u.idleKey;
		return [k, frameAt(k, now, u.x)];
	}

	// --- dust --------------------------------------------------------------
	const DUST_MS = (SPR.dust[2] / SPR.dust[5]) * 1000;
	let dust = [];
	let lastDustAt = 0;
	function puff(x, y, now) {
		dust.push({ x, y, at: now });
	}
	// The knight's own footfalls are rate-limited; a raider's death is not.
	function spawnDust(now) {
		if (now - lastDustAt < 380) return;
		lastDustAt = now;
		puff(knight.x, knight.y, now);
	}
	function drawDust(now) {
		dust = dust.filter((p) => now - p.at < DUST_MS);
		for (const p of dust) {
			const f = Math.floor(((now - p.at) / 1000) * SPR.dust[5]);
			drawSprite(
				"dust",
				p.x,
				p.y + 2,
				Math.min(f, SPR.dust[2] - 1),
				false,
			);
		}
	}

	// --- frame loop --------------------------------------------------------
	let lastTick = 0;

	function tick(ts) {
		const dt = lastTick ? Math.min((ts - lastTick) / 1000, 0.1) : 0;
		lastTick = ts;

		syncRaiders(ts);
		const war = raiders.length > 0;
		if (war) {
			for (let i = 0; i < raiders.length; i++)
				updateRaider(raiders[i], i, dt);
			// Defenders march to a fixed station rather than to whichever raider is
			// closest. A line that re-forms every time a raider shifts never settles,
			// and the fight stops being readable as two sides facing each other.
			knight.target = null;
			knight.atPost = stepToward(
				knight,
				front.x + STATION.knight[0],
				front.y + STATION.knight[1],
				MARCH_SPEED,
				dt,
			);
			if (knight.atPost) knight.facing = 1;
			if (knight.moving) spawnDust(ts);
		} else {
			knight.atPost = false;
			knight.act = null;
			updateUnit(knight, dt, ts);
			if (knight.moving) spawnDust(ts);
		}
		updateLancer(dt);

		// Who is actually being fought, and so who swings back. The knight takes
		// the raider in the van and the lancer the one furthest back, which spreads
		// the blows across the line -- three sword arcs in one place read as a
		// single bright smear and the fight stops being countable.
		for (const r of raiders) r.engaged = false;
		if (war && knight.atPost) raiders[0].engaged = true;
		if (war && lancer && lancer.fighting)
			raiders[raiders.length - 1].engaged = true;

		// Everyone with no business at the shore gets out of it. A villager or a
		// sheep wandering through the line reads as an accident rather than a
		// scene, and the battlefield is only kept clear of props, not of units.
		for (const u of units) {
			if (u.warHome) u.home = war ? u.warHome : u.peaceHome;
			if (u !== knight) updateUnit(u, dt, ts);
		}
		updateArrows(dt);

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
					if (!d.troops) return;
					for (const t of d.troops) {
						// The towers hold their archers through the whole raid: they are
						// the wall, and a wall that walks off to fight is not a wall.
						if (t.who === "archer_idle" && war)
							drawSprite(
								"archer_shoot",
								t.x,
								t.y,
								volley(t, ts),
								t.flip,
							);
						else
							drawSprite(
								t.who,
								t.x,
								t.y,
								frameAt(t.who, ts, t.x),
								t.flip,
							);
					}
				},
			});
		}
		for (const u of units) {
			order.push({
				y: u.y,
				draw: () => {
					const [key, f] = unitPose(u, ts);
					drawSprite(key, u.x, u.y, f, u.facing === -1);
				},
			});
		}
		if (lancer)
			order.push({
				y: lancer.y,
				draw: () => {
					const [key, f] = lancerPose(ts);
					drawSprite(
						key,
						lancer.x,
						lancer.y,
						f,
						lancer.facing === -1,
					);
				},
			});
		for (const r of raiders) {
			order.push({
				y: r.y,
				draw: () => {
					const [key, f] = raiderPose(r, ts);
					drawSprite(key, r.x, r.y, f, r.facing === -1);
				},
			});
		}
		order.sort((a, b) => a.y - b.y);
		for (const o of order) o.draw();

		// Arrows are in the air, so they pass over the whole scene rather than
		// sorting into it on a ground contact point they do not have.
		for (const a of arrows) drawArrow(a);

		requestAnimationFrame(tick);
	}

	// --- host messages -----------------------------------------------------
	window.addEventListener("message", (event) => {
		const msg = event.data;
		if (msg.type === "world") {
			errorCount = msg.errors || 0;
		} else if (msg.type === "colour") {
			colour = msg.colour;
			preload();
		}
	});

	new ResizeObserver(layout).observe(stage);
	layout();
	requestAnimationFrame(tick);
})();
