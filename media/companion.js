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
		// Every sheet in the pawn family bottoms out on native row 134, tool and
		// load included, so the whole set shares the idle's anchor and a pawn
		// never hops as he picks something up or puts it down.
		pawn_axe: [192, 192, 6, 96, 135, 10],
		pawn_pick: [192, 192, 6, 96, 135, 10],
		pawn_run_wood: [192, 192, 6, 96, 135, 10],
		pawn_idle_wood: [192, 192, 8, 96, 135, 8],
		pawn_run_gold: [192, 192, 6, 96, 135, 10],
		pawn_idle_gold: [192, 192, 8, 96, 135, 8],
		pawn_idle_axe: [192, 192, 8, 96, 135, 8],
		pawn_run_axe: [192, 192, 6, 96, 135, 10],
		pawn_idle_pick: [192, 192, 8, 96, 135, 8],
		pawn_run_pick: [192, 192, 6, 96, 135, 10],
		pawn_knife: [192, 192, 4, 96, 135, 10],
		pawn_idle_knife: [192, 192, 8, 96, 135, 8],
		pawn_run_knife: [192, 192, 6, 96, 135, 10],
		pawn_idle_meat: [192, 192, 8, 96, 135, 8],
		pawn_run_meat: [192, 192, 6, 96, 135, 10],
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
		// The lit variants are the same art with an animated outline over it, and
		// measure to the same bounding box, so a seam swapping to one does not
		// shift by a pixel.
		gold_hl: [128, 128, 6, 66, 86, 8],
		gold_res_hl: [128, 128, 6, 63, 75, 8],
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

	// A building's garrison: [dx, dy, sprite, spot], native, relative to the
	// building's base anchor.
	//
	// Two kinds of post. A "deck" post is up on the open wooden platform, which
	// is where the bowmen go: an archer is only worth having where he can see,
	// and the deck is the one place on the island with a view of the whole
	// shore. A "ground" post is on the terrace immediately in front of the
	// building, which is where the melee stands -- a spearman on a roof is
	// scenery, a rank of them at the gate is a garrison.
	//
	// The reference art hides a deck figure's legs behind the parapet, but
	// clipping to that lip reads as junk at half scale: the shield and sword
	// survive the cut and the head does not, so the figure stops looking like a
	// soldier. Standing the whole figure on the deck is less faithful and much
	// more legible.
	//
	// Spacing is measured, not guessed. The widest body in the cast is the
	// warrior's at 79 native pixels across (the lancer is 69 and mostly spear,
	// the archer 70), so ranks are set at least 96 native apart and no two
	// soldiers ever share pixels.
	const GARRISON_NATIVE = {
		tower: [[0, -103, "archer_idle", "deck"]],
		// One bowman on the wall and a pair of spearmen at the gate. It was tried
		// at two and three: the terrace is a ledge about 190px wide at a normal
		// sidebar and the castle covers 156 of it, so five figures standing on the
		// remainder left no gap anywhere along it. A smaller guard reads as a
		// guard; the same ledge crowded reads as a queue, and there is nowhere
		// left to put a bush.
		castle: [
			[0, -107, "archer_idle", "deck"],
			// Drawn in toward the gate rather than spread to the corners, which
			// leaves the corners of the wall free for the scrub that grows there.
			[-52, 8, "lancer_idle", "ground"],
			[52, 8, "lancer_idle", "ground"],
		],
		barracks: [
			[-52, 8, "warrior_Idle", "ground"],
			[52, 8, "warrior_Idle", "ground"],
		],
	};
	const GARRISON = {};
	for (const k of Object.keys(GARRISON_NATIVE)) {
		GARRISON[k] = GARRISON_NATIVE[k].map((g) => [
			Math.round(g[0] / DIV),
			Math.round(g[1] / DIV),
			g[2],
			g[3],
		]);
	}

	// Half-scale footprint widths, used to decide which keep buildings fit.
	const BUILD_W = { castle: 156, tower: 60, barracks: 92, archery: 92 };
	// Breathing room between two buildings sharing a terrace.
	const BUILD_GAP = 8;

	const SCATTER_BUSH = ["bush", "bush2", "bush3", "bush4"];
	const SCATTER_ROCK = ["rock", "rock2", "rock3", "rock4"];
	// The short pair. A terrace is three tiles of grass, and Tree1 and Tree2 stand
	// taller than that, so only these two can stand on one without overhanging the
	// top of the island.
	const TERRACE_TREE = ["tree3", "tree4"];
	const SCATTER_ODDS = ["stump", "wood_res", "gold_res"];

	// What the cast can have business with. These read off the decor the layout
	// already produces rather than getting their own placement pass, so an errand
	// can only ever send a unit somewhere the island actually has something.
	const DEPOT_KEYS = [
		"castle",
		"barracks",
		"archery",
		"tower",
		"house",
		"house2",
		"house3",
	];
	const WOOD_KEYS = ["tree", "tree2", "tree3", "tree4"];
	const GOLD_KEYS = ["gold", "gold_res"];
	const MEAT_KEYS = ["meat_res"];
	// Which trade a prop is worked with, so a jobsite is recognised by what the
	// layout put down rather than by a second placement pass.
	const JOB_OF = {};
	for (const k of WOOD_KEYS) JOB_OF[k] = "wood";
	for (const k of GOLD_KEYS) JOB_OF[k] = "gold";
	for (const k of MEAT_KEYS) JOB_OF[k] = "meat";

	// A worksite is a decor prop the errand is allowed to change. It lights up
	// while it is being worked, and a felled tree leaves a stump standing until
	// it grows back -- without that the axe swings and the wood the pawn walks
	// off with comes from a tree that is visibly still there.
	const SITE_WORK = { gold: "gold_hl", gold_res: "gold_res_hl" };
	const SITE_SPENT = {
		tree: "stump",
		tree2: "stump",
		tree3: "stump",
		tree4: "stump",
	};
	// [floor, spread] ms before a site can be worked again. The felled tree is
	// the only one whose cooldown is visible, so it is the only one long enough
	// to notice; the others are just there to stop the pawn working the same
	// seam twice in a row on an island that only has the one.
	const SITE_COOL = {
		wood: [60000, 60000],
		gold: [25000, 20000],
		meat: [25000, 20000],
	};
	// How often each trade is chosen, given the choice. Woodcutting is the only
	// one that leaves a mark on the island, and left at even odds -- three of
	// the six sites being trees -- the woodland spent a quarter of the session
	// as stumps and was never once whole for long. Shortening the regrow barely
	// moved it: the pawn fells trees as fast as they come back, so the rate is
	// what had to come down, not the recovery. Working a seam costs the scene
	// nothing, so it can happen as often as it likes.
	const SITE_WEIGHT = { wood: 1, gold: 3, meat: 3 };
	// The swinging sheet, the sheet for carrying that tool to the job, and
	// whether the work throws chips.
	const SITE_JOB = {
		wood: { tool: "pawn_axe", hold: "axe", dust: true },
		gold: { tool: "pawn_pick", hold: "pick", dust: true },
		meat: { tool: "pawn_knife", hold: "knife", dust: false },
	};

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
	// Where the sallying lancer stands when nothing is happening: one of the
	// castle's three ground posts. Null on an island with no castle on it, which
	// is also an island with no spearmen to send.
	let lancerPost = null;
	// The post, the stairs and the battle station as one walkable list.
	let lancerRoute = [];
	// Every level the cast can stand on, lowest first: index 0 is the shore band,
	// then one per terrace. Each carries the strip of flat ground it is safe to
	// wander and the stair that leaves it downward, which between them make the
	// island navigable -- any unit can reach any level by walking.
	let levels = [];
	// Buildings worth walking to, and the trees and seams worth working. Derived
	// from decor at the end of layout.
	let depots = [];
	let jobsites = [];
	// The figures on the buildings' decks. They used to be drawn as part of the
	// building; they are units now, because a garrison that can come down off the
	// wall and walk the village is most of what makes the island look inhabited.
	let garrison = [];

	// Take one figure of a rank out of the garrison and report where he stood.
	// He was mustered with his rank and spaced with it, so the building fields the
	// number it is supposed to; he simply is not one of the ones who stays put.
	// Always the man nearest the head of his terrace's stair, since he is the one
	// with the shortest walk to anywhere else.
	// Where a building's ground guards will end up standing. The garrison is not
	// built until every prop is placed, so a bush that must not be planted on a
	// man's feet has to work it out from the same table the garrison will use.
	function groundPosts(d) {
		const out = [];
		for (const [gx, , , spot] of GARRISON[d.key] || [])
			if (spot === "ground") out.push(d.x + gx);
		return out;
	}

	function detach(key) {
		const rank = garrison.filter((g) => g.idleKey === key);
		if (!rank.length) return null;
		const lv = levels[rank[0].level];
		const head = lv && lv.stair ? lv.stair.top : rank[0];
		let k = 0;
		for (let i = 1; i < rank.length; i++)
			if (Math.abs(rank[i].x - head.x) < Math.abs(rank[k].x - head.x))
				k = i;
		garrison.splice(garrison.indexOf(rank[k]), 1);
		return { x: rank[k].x, y: rank[k].y, level: rank[k].level };
	}

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
			terraces.push({
				landRows: TOP_H + 2 + MID_H,
				c0: 0,
				cw: iw,
				side: 1,
			});
			terraces.push({ landRows: TOP_H, c0: 0, cw: iw, side: -1 });
		} else if (ih >= 9) {
			// Left, like the upper terrace of a two-terrace island, so the highest
			// ground always has its stair on the left and so always has its corner
			// tower on the left. With only one terrace there is nothing to
			// alternate with, and the span it leaves is the same width either way.
			terraces.push({ landRows: TOP_H, c0: 0, cw: iw, side: -1 });
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
		// `level` is which terrace the prop stands on, so an errand routed to it
		// knows whether it has stairs to walk first. Ground level unless said.
		// Returns what it placed, or null if the battlefield reservation ate it, so
		// a caller can tag the prop with anything the layout knows and the rest of
		// the renderer does not.
		const place = (key, x, y, level) => {
			const py = Math.round(Math.max(y, SPR[key][4] + 2));
			if (onField(key, x, py)) return null;
			const d = { key, x: Math.round(x), y: py, level: level || 0 };
			decor.push(d);
			return d;
		};

		// Fit as many of `wanted` between l and r as will go, then spread them
		// evenly along that span and report where each landed.
		function spreadRow(wanted, baseY, l, r, level) {
			const inner = r - l;
			const chosen = [];
			let used = 0;
			for (const k of wanted) {
				const w = BUILD_W[k] + (chosen.length ? BUILD_GAP : 0);
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
				place(k, at[k], baseY, level);
				bx += BUILD_W[k] + BUILD_GAP + slack;
			}
			return at;
		}

		// The corner tower, standing on the lower step at the stair end of its
		// terrace rather than on the flat part with everything else.
		//
		// That step is LOBE tiles of ground the layout otherwise leaves bare, and
		// it is the outside corner of the level, which is where a watchtower
		// belongs. It is also always the same size whatever the pane, so the tower
		// no longer has to win a fight with the castle for the flat span: side by
		// side they need a 346px sidebar, and below that the tower simply did not
		// appear. Here it appears at every width.
		//
		// The stairs alternate sides, so this puts the keep's tower on the left
		// and the one below it on the right without either being asked for by name.
		function cornerTower(t, level) {
			const lobeW = LOBE * T;
			if (lobeW < BUILD_W.tower) return;
			const l =
				t.side > 0
					? island.ox + (t.stairCol + 1) * T
					: island.ox + t.c0 * T;
			// One row lower than the flat part. That row is what makes it a step,
			// and standing on it is what makes the tower read as a bastion below
			// the wall rather than as a building shoved against the edge.
			const d = place(
				"tower",
				l + lobeW / 2,
				island.oy + (t.landRows + 1) * T - 8,
				level,
			);
			// Not somewhere to run an errand to. It is off the walkable band by a
			// whole tile, and a figure sent to its door would walk down the step
			// without using the stairs, which is the one thing the levels exist to
			// prevent.
			if (d) d.lobe = true;
		}

		// Greenery on a terrace. Until now an upper level was a building, a stair
		// and bare grass, which at sidebar size reads as a shelf rather than as
		// ground. The pack's own promo art puts scrub along the lip of every cliff
		// and trees crowding the keep, and that is most of what makes the land look
		// like land.
		//
		// It goes along the base line, not scattered over the whole terrace, for a
		// reason worth writing down: a terrace is three tiles of grass and its
		// building stands taller than all three, so anything placed behind one is
		// not partly hidden, it is entirely hidden. The lip is the only part of a
		// terrace a building does not already cover.
		//
		// Only the two short trees are eligible. Tree1 and Tree2 stand 120px, which
		// is taller than the terrace they would be standing on; Tree3 and Tree4 are
		// 85 and fill it exactly.
		function dressTerrace(t, level, base) {
			const span = terraceSpan(t);
			const stairX = island.ox + t.stairCol * T + T / 2;
			// Only what is already on this terrace, so a bush is spaced against the
			// castle beside it and not against a house two levels below.
			const here = decor.filter((d) => d.level === level);
			let added = 0;
			for (let tries = 0; tries < 40 && added < 4; tries++) {
				const roll = rnd();
				const key =
					roll < 0.5
						? SCATTER_BUSH[(rnd() * SCATTER_BUSH.length) | 0]
						: roll < 0.78
							? SCATTER_ROCK[(rnd() * SCATTER_ROCK.length) | 0]
							: TERRACE_TREE[(rnd() * TERRACE_TREE.length) | 0];
				// A tree needs a real gap; scrub only needs a corner.
				const mine = BUILD_W[key] ? BUILD_W[key] / 2 : key[0] === "t" ? 40 : 24;
				const x = span.l + rnd() * (span.r - span.l);
				// A tree sits a hair behind the building line so it draws behind the
				// wall rather than fighting it for the same row; scrub sits on the
				// lip, which is where the reference art has it.
				const y = key[0] === "t" ? base - 2 : base - 4 + rnd() * 10;
				// The stair head has to stay clear. It is the one part of a ledge
				// that has to read as a way down, and a bush in it reads as a hedge.
				if (Math.abs(x - stairX) < 40 + mine) continue;
				let ok = true;
				for (const d of here) {
					const theirs = BUILD_W[d.key] ? BUILD_W[d.key] / 2 + 8 : 22;
					if (Math.abs(d.x - x) < theirs + mine) {
						ok = false;
						break;
					}
				}
				if (!ok) continue;
				const put = place(key, x, Math.round(y), level);
				if (put) {
					// Scenery, not timber. A terrace tree that counted as a
					// jobsite would be felled like any other, and Stump 1 stands
					// 120px against Tree3's 85, so cutting one would leave
					// something taller than the tree that was there -- hanging off
					// the top of a terrace only 88px tall. The woodland the Pawn
					// works is on the ground, where the stump has room.
					put.scenery = true;
					here.push(put);
					added++;
				}
			}
			if (added) return;

			// Nothing fitted beside. That is the normal case at sidebar width, and
			// worth stating plainly: the keep terrace is 160px of ledge at a 300px
			// pane and the castle is 156 of it, so "beside the castle" is not a
			// place that exists. Measured across panes, the gap is 4px at 300,
			// 36 at 320, and does not reach the 56 a bush needs until about 420.
			//
			// The lip in front of the wall is a place that exists at every width,
			// and scrub growing at the foot of a wall is what the pack's own art
			// does at every cliff edge in the scene. So it goes there instead:
			// against the outer corners of the building, drawn over its base
			// stonework, never across its gate and never on a guard's feet.
			for (const d of here.slice()) {
				if (!BUILD_W[d.key] || d.lobe) continue;
				for (const side of [-1, 1]) {
					const x = d.x + side * (BUILD_W[d.key] / 2 - 6);
					if (x < span.l - 12 || x > span.r + 12) continue;
					if (Math.abs(x - stairX) < 48) continue;
					if (groundPosts(d).some((p) => Math.abs(p - x) < 45))
						continue;
					const put = place(
						SCATTER_BUSH[(rnd() * SCATTER_BUSH.length) | 0],
						x,
						base + 4,
						level,
					);
					if (put) put.scenery = true;
				}
			}
		}

		// Seeded from the island size, so the scene is identical frame to frame but
		// re-composes when the pane changes. Declared up here because the terraces
		// are dressed before the ground is, and both draw from the one stream.
		let seed = (iw * 73856093) ^ (ih * 19349663);
		const rnd = () =>
			(seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

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

		// The walkable strips, lowest first. A terrace band is a ledge, not a lawn:
		// it runs from just in front of the building line to the lip of the drop,
		// eight pixels of it. That is deliberate and it is a drawing rule, not a
		// walking one. Everything sorts by its ground contact point, so a figure
		// standing even one pixel behind a building's base draws before it and the
		// castle swallows him whole. Keeping the whole band in front of the base
		// line is what makes a visit to the keep something you can actually watch.
		// The stair is a two-tile diagonal, walked as a pair of waypoints -- the
		// head of it on this level, the foot on the one below. Its head lies just
		// off the end of the band but at the same height, so stepping onto it is a
		// walk along the ledge and not a hop up onto one.
		levels = [{ band: walk, stair: null }];
		for (const t of terraces) {
			const base = island.oy + t.landRows * T - 8;
			const s = terraceSpan(t);
			const sx = Math.round(island.ox + t.stairCol * T + T / 2);
			const b = {
				l: s.l + 20,
				r: s.r - 20,
				t: base + 1,
				b: base + 7,
			};
			// A span too narrow to wander collapses to a point rather than
			// inverting, which random targets inside would turn into a unit stuck
			// against an edge.
			if (b.r < b.l) b.r = b.l = Math.round((b.l + b.r) / 2);
			levels.push({
				band: b,
				stair: {
					top: { x: sx, y: island.oy + t.landRows * T - 4 },
					foot: { x: sx, y: island.oy + (t.landRows + 2) * T },
				},
			});
		}

		if (terraces.length) {
			// Keep on the highest ground, military buildings on the middle terrace,
			// so the levels each have a reason to exist. Each terrace is walled at
			// its outer corner by a tower, which is what turns a row of buildings
			// into a fortification: the corners are the bits that look defended.
			const upper = terraces[terraces.length - 1];
			const upperBase = island.oy + upper.landRows * T - 8;
			const up = terraceSpan(upper);
			cornerTower(upper, terraces.length);
			spreadRow(
				up.r - up.l >= BUILD_W.castle ? ["castle"] : ["tower"],
				upperBase,
				up.l,
				up.r,
				terraces.length,
			);
			dressTerrace(upper, terraces.length, upperBase);

			if (terraces.length > 1) {
				const mid = terraces[0];
				const midBase = island.oy + mid.landRows * T - 8;
				const ms = terraceSpan(mid);
				cornerTower(mid, 1);
				spreadRow(["barracks"], midBase, ms.l, ms.r, 1);
				dressTerrace(mid, 1, midBase);
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
		// The butcher's stand, put by the flock rather than anywhere, because it
		// is the third thing the pawn works and it should read as belonging to
		// the sheep. Only on an island wide enough that it is not in the way.
		if (iw >= 8) place("meat_res", walk.l + 92, ly(0.6));

		// Ground cover scattered to a density, not a fixed count, so a big island
		// doesn't read as an empty lawn. Seeded from the island size so the scene
		// is stable frame to frame but re-composes when the pane is resized.
		const bandW = walk.r - walk.l;
		const target = Math.max(5, Math.min(26, Math.round((iw * ih) / 9)));
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

		// The garrison. Each figure stands a post on its building's deck and is
		// mostly furniture, but a warrior comes down off the wall now and then,
		// walks the village and climbs back, so it has to be a unit with a
		// position of its own rather than an offset drawn with the building.
		garrison = [];
		const nowish = performance.now();
		for (const d of decor) {
			const troops = GARRISON[d.key];
			if (!troops) continue;
			for (const [gx, gy, who, spot] of troops) {
				const deck = spot === "deck";
				const archer = who === "archer_idle";
				const lance = who === "lancer_idle";
				// A ground post is on the terrace ledge in front of the building,
				// which is only a few pixels deep. Clamped into the band rather than
				// taken on trust: a building nudged up the screen by the viewport
				// clamp would otherwise post its guard out over the drop.
				const band = levels[d.level] && levels[d.level].band;
				let py = d.y + gy;
				if (!deck && band) py = Math.max(band.t, Math.min(band.b, py));
				garrison.push({
					host: d,
					deck,
					post: { x: d.x + gx, y: py },
					x: d.x + gx,
					y: py,
					level: d.level,
					homeLevel: d.level,
					speed: 15,
					idleKey: who,
					runKey: archer
						? "archer_run"
						: lance
							? "lancer_run"
							: "warrior_Run",
					archer,
					// A deck figure looks out from his building's centre line. A rank
					// on the ground faces the shore, because the shore is the only
					// direction anything ever comes from and a guard turned away from
					// it reads as off duty.
					facing: deck ? (gx > 0 ? -1 : 1) : 1,
					postFacing: deck ? (gx > 0 ? -1 : 1) : 1,
					moving: false,
					onPost: true,
					plan: null,
					pose: null,
					hidden: false,
					// Archers hold their posts whatever happens -- they are the wall,
					// and a wall that walks off is not a wall -- so only the melee
					// ever rotates off duty. Staggered so two never leave together.
					strollAt: archer
						? Infinity
						: nowish + 40000 + Math.random() * 90000,
					nockedAt: -1,
					loosed: false,
					restUntil: 0,
				});
			}
		}

		// Two of the mustered soldiers are the two who actually fight: a spearman
		// out of the keep's rank of three, and a swordsman out of the barracks'
		// pair. They are taken out of the garrison rather than added beside it,
		// which is what keeps the muster honest -- the keep fields three spears
		// and the barracks two swords whether or not one of each is off standing
		// still. The one nearest the head of the stair goes, so peeling off reads
		// as the nearest man going rather than as somebody crossing the whole
		// terrace to reach the steps.
		lancerPost = detach("lancer_idle");
		const knightPost = detach("warrior_Idle");

		// Errand targets, read straight off whatever the layout happened to place.
		depots = decor.filter(
			(d) => DEPOT_KEYS.indexOf(d.key) >= 0 && !d.lobe,
		);
		jobsites = decor
			.filter((d) => JOB_OF[d.key] !== undefined && !d.scenery)
			.map((d) => {
				const carry = JOB_OF[d.key];
				const job = SITE_JOB[carry];
				return {
					// The prop itself, so working it can change what is drawn.
					decor: d,
					x: d.x,
					y: d.y,
					level: d.level,
					key: d.key, // what it looks like at rest
					work: SITE_WORK[d.key] || d.key,
					spent: SITE_SPENT[d.key] || null,
					cool: SITE_COOL[carry],
					carry,
					tool: job.tool,
					hold: job.hold,
					dust: job.dust,
					// Wall-clock time the site is free again; 0 means now.
					until: 0,
				};
			});

		lancerRoute = lancerPost
			? [lancerPost].concat(stairPoints(levels.length - 1, 0), [
					{
						x: front.x + STATION.lancer[0],
						y: front.y + STATION.lancer[1],
					},
				])
			: [];

		// The knight is quartered where he was mustered. Failing a barracks he
		// takes the keep terrace, which is the only walled ground there is; failing
		// any terrace at all there is nowhere to garrison anybody, so he takes the
		// shore and the scene is a hamlet with one guard rather than a fort. He is
		// given the level and not the mark: he paces his terrace rather than
		// standing on a spot, which is the whole difference between him and the man
		// he was mustered beside.
		knight.homeLevel = knightPost
			? knightPost.level
			: terraces.length
				? levels.length - 1
				: 0;

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
			// Which terrace it is standing on, an index into `levels`. Everything
			// off the shore band is reached and left by the stairs.
			level: 0,
			// Where it is quartered, and so where it is put at layout and where it
			// walks back to when a raid ends. A soldier lives by his building, not
			// on the shore -- the village is the villagers'.
			homeLevel: 0,
			// The errand it is on, if any: see the queue below.
			plan: null,
			// A sheet an errand is holding it in, overriding idle/run.
			pose: null,
			// Inside a building, so not drawn.
			hidden: false,
			// A load being carried, which swaps the whole idle/run pair.
			carry: null,
			// When this one may next take a walk up the island. On a cooldown
			// rather than a dice roll per wander leg: a roll cheap enough to fire
			// often enough to be noticed is also cheap enough to fire again the
			// moment the last walk ended, and the shore band empties out. Staggered
			// so the whole cast does not set off together on the first minute.
			strollAt: performance.now() + 30000 + Math.random() * 120000,
		};
	}

	function unitBounds(u) {
		// Off the shore band a unit has no patch of its own: a terrace strip is
		// small enough to be the patch.
		if (u.level > 0 && levels[u.level]) {
			const b = levels[u.level].band;
			return {
				hx: (b.l + b.r) / 2,
				hy: (b.t + b.b) / 2,
				l: b.l,
				r: b.r,
				t: b.t,
				b: b.b,
			};
		}
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

	// The second of the barracks' two warriors, and the one who is never on the
	// deck: he paces his terrace, walks the island, and is first down the stairs
	// when the shore is hit. His home/roam patch only ever applies while he is on
	// the ground -- above it, the terrace ledge is the patch.
	const knight = makeUnit(
		"knight",
		16,
		"warrior_Idle",
		"warrior_Run",
		[0.45, 0.66],
		0.42,
	);
	const units = [knight];
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

	// Villagers rather than soldiers. Every soldier on the island is quartered at
	// a building now, so the ground level is left to the people who work it: it
	// should look worked, not patrolled. The roaming ground archer that used to
	// live down here went up onto the walls with the rest of the bowmen, which is
	// where an archer is worth having anyway.
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
	// Sheep do not climb to the keep to look at the view. It keeps to the grass
	// at the bottom of the island and the only errand it has is eating.
	sheep.strollAt = Infinity;

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
			// The terraces were rebuilt under anyone standing on one, so everybody
			// starts again where he is quartered, with no errand outstanding. A
			// pane too short to have grown the terrace he lives on puts him back on
			// the ground rather than on a level that is no longer there.
			u.level = levels[u.homeLevel] ? u.homeLevel : 0;
			u.plan = null;
			u.pose = null;
			u.hidden = false;
			u.carry = null;
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
		if (u.plan) {
			if (u.plan.length) return runPlan(u, dt, now);
			// A beat between finishing an errand and drifting off again, so the
			// last step of one does not blend straight into the next walk.
			u.plan = null;
			u.pauseUntil = now + 600;
		}
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
			// One roll per wander leg. Anything that comes of it replaces the pause.
			rollErrand(u, now);
			return;
		}
		u.x += (dx / dist) * u.speed * dt;
		u.y += (dy / dist) * u.speed * dt;
		if (Math.abs(dx) > 2) u.facing = dx < 0 ? -1 : 1;
		u.moving = true;
	}

	// --- errands -------------------------------------------------------------
	// A unit's default is to wander its own patch. An errand sits on top of that
	// as a short queue of steps -- walk here, work a while, step inside, come
	// home -- and when the queue empties the unit falls back to wandering.
	//
	// A queue rather than a state machine per behaviour is what lets a haul ("fell
	// a tree, shoulder the log, carry it up to the keep, come back") be written as
	// one list, and what lets a raid cancel any of them the same way.
	//
	// Steps, in the order they are tested:
	//   {to:{x,y}, speed, level}  walk there; on arrival stand on `level`
	//   {carry:'wood'|'gold'|null}  swap to the carrying sheets, no time taken
	//   {act:key, ms, face, dust}   play a sheet in place for ms
	//   {hide:ms}                   step inside a building and out again
	//
	// Stairs are walked faster than a patch is wandered: the switchback is about
	// 450px in a sidebar-sized pane, and at strolling pace a unit spends most of
	// its errand on the ramp.
	const TRAVEL_SPEED = 34;

	// The waypoints between two levels, stair by stair, each tagged with the level
	// a unit is standing on once it gets there.
	function stairPoints(from, to) {
		const out = [];
		for (let l = from; l > to; l--) {
			out.push({ x: levels[l].stair.top.x, y: levels[l].stair.top.y, level: l });
			out.push({
				x: levels[l].stair.foot.x,
				y: levels[l].stair.foot.y,
				level: l - 1,
			});
		}
		for (let l = from + 1; l <= to; l++) {
			out.push({
				x: levels[l].stair.foot.x,
				y: levels[l].stair.foot.y,
				level: l - 1,
			});
			out.push({ x: levels[l].stair.top.x, y: levels[l].stair.top.y, level: l });
		}
		return out;
	}

	function travelSteps(from, to, speed) {
		return stairPoints(from, to).map((p) => ({
			to: { x: p.x, y: p.y },
			level: p.level,
			speed: speed || TRAVEL_SPEED,
		}));
	}

	function pick(list) {
		return list[(Math.random() * list.length) | 0];
	}

	// Buildings on the level the unit is already standing on. An errand that is
	// meant to be a short local trip has to choose from these, or half of them
	// turn into a climb and nobody is left on the shore.
	function nearDepots(u) {
		const near = depots.filter((d) => d.level === u.level);
		return near.length ? near : depots;
	}

	function runPlan(u, dt, now) {
		const s = u.plan[0];
		if (s.to) {
			if (stepToward(u, s.to.x, s.to.y, s.speed || u.speed, dt)) {
				if (s.level !== undefined) u.level = s.level;
				u.plan.shift();
			}
			return;
		}
		// Everything past here happens standing still.
		u.moving = false;
		if (s.carry !== undefined) {
			u.carry = s.carry;
			u.plan.shift();
			return;
		}
		// The errand changing the world rather than moving through it.
		if (s.site) {
			setSite(s.site, s.phase, now);
			u.plan.shift();
			return;
		}
		if (s.at === undefined) s.at = now;
		if (s.act) {
			u.pose = s.act;
			if (s.face) u.facing = s.face;
			// Chips fly while a tool is swinging. Without them the pawn mimes at
			// the tree and nothing on the island answers him.
			if (s.dust && now - (s.dustAt || 0) > 420) {
				s.dustAt = now;
				puff(u.x + u.facing * 14, u.y, now);
			}
		} else if (s.hide) {
			u.hidden = true;
		}
		if (now - s.at < (s.ms || s.hide || 0)) return;
		// A hide may come back out somewhere else: that is how a figure gets
		// between a building's deck and its door without walking up the wall.
		if (s.warp) {
			u.x = s.warp.x;
			u.y = s.warp.y;
			if (s.level !== undefined) u.level = s.level;
		}
		u.pose = null;
		u.hidden = false;
		u.plan.shift();
	}

	// The three states a worksite has: at rest, lit because someone is working
	// it, and spent. Spent is the only one that runs a clock -- a felled tree
	// stands as a stump until it grows back, and until it does the site is not
	// offered to anybody.
	function setSite(site, phase, now) {
		if (phase === "work") {
			site.decor.key = site.work;
		} else if (phase === "spend") {
			site.decor.key = site.spent || site.key;
			site.until = now + site.cool[0] + Math.random() * site.cool[1];
		} else {
			site.decor.key = site.key;
		}
	}

	// Weighted by trade rather than uniform over sites, so adding a fourth tree
	// to a bigger island does not also make woodcutting twice as likely as
	// everything else put together.
	function pickSite(open) {
		let total = 0;
		for (const j of open) total += SITE_WEIGHT[j.carry];
		let r = Math.random() * total;
		for (const j of open) if ((r -= SITE_WEIGHT[j.carry]) <= 0) return j;
		return open[open.length - 1];
	}

	// A stump grows back into its own tree, not a stock one: the site remembers
	// which of the four it was.
	function regrow(now) {
		for (const j of jobsites) {
			if (!j.until || now < j.until) continue;
			j.until = 0;
			j.decor.key = j.key;
		}
	}

	// Fell a tree, work a seam or butcher at the stand, shoulder what comes off
	// it, carry it to a building and come home. The one errand that reads as a
	// job of work rather than a walk, and the reason the carry sheets are
	// vendored at all.
	function planHaul(u, now) {
		// A felled tree is out of the rotation while it is a stump, so the pawn
		// cannot chop the same one twice. The last tree is never taken either:
		// however short the regrow, an island that can reach nought trees will
		// eventually be sat at nought trees while somebody is looking at it.
		const standing = jobsites.filter(
			(j) => j.carry === "wood" && !j.until,
		).length;
		const open = jobsites.filter(
			(j) => !j.until && (j.carry !== "wood" || standing > 1),
		);
		if (!open.length) return null;
		const site = pickSite(open);
		// Mostly to a barn on the same level; now and then the whole load goes up
		// the switchback to the keep, which is the version worth catching.
		const depot = Math.random() < 0.75 ? pick(nearDepots(u)) : pick(depots);
		// Stand beside the thing being worked, on the side he is already on, and
		// face it. Swinging an axe away from the tree is worse than not swinging.
		const side = site.x > u.x ? -1 : 1;
		const home = { x: u.x, y: u.y };
		// The tool is carried like a load: out to the job in hand, swapped for
		// what comes off the job, back in hand once that is delivered, and only
		// put away at home.
		return [{ carry: site.hold }].concat(
			travelSteps(u.level, site.level),
			[
				{ to: { x: site.x + side * 20, y: site.y + 2 } },
				{ site, phase: "work" },
				{
					act: site.tool,
					ms: 2600 + Math.random() * 2000,
					face: -side,
					dust: site.dust,
				},
				{ site, phase: "spend" },
				{ carry: site.carry },
			],
			travelSteps(site.level, depot.level),
			[
				// A load slows him down, which is most of what sells it as a load.
				{ to: { x: depot.x + 14, y: depot.y + 6 }, speed: 8 },
				{ act: CARRY[site.carry][0], ms: 800 },
				{ carry: site.hold },
			],
			travelSteps(depot.level, u.level),
			[{ to: home }, { carry: null }],
		);
	}

	// Up to the keep and back, or down into the village and back. Building the
	// switchback and then having nothing but the lancer ever use it was the waste.
	function planStroll(u) {
		// Anywhere but here. Rolling a level at random instead would spend a third
		// of the cooldown on a walk to the ground the unit is already standing on.
		const others = [];
		for (let i = 0; i < levels.length; i++) if (i !== u.level) others.push(i);
		if (!others.length) return null;
		const to = pick(others);
		const b = levels[to].band;
		const steps = travelSteps(u.level, to);
		const stops = 1 + ((Math.random() * 3) | 0);
		for (let i = 0; i < stops; i++) {
			steps.push({
				to: {
					x: b.l + Math.random() * (b.r - b.l),
					y: b.t + Math.random() * (b.b - b.t),
				},
			});
			steps.push({ act: u.idleKey, ms: 1400 + Math.random() * 3000 });
		}
		// Back to the level he came from; wandering pulls him home from there.
		return steps.concat(travelSteps(to, u.level));
	}

	// In one door and out of it a while later. These sheets have no door drawn on
	// them, so "inside" is the figure walking to the middle of the building and
	// simply not being drawn -- which at this size reads as exactly what it is.
	function planVisit(u) {
		const d = pick(nearDepots(u));
		const steps = travelSteps(u.level, d.level);
		steps.push({ to: { x: d.x + 18, y: d.y + 6 } });
		steps.push({ to: { x: d.x, y: d.y - 2 }, speed: 9 });
		// Short. On an island with one house on it every figure uses that door, and
		// a long stay indoors is the whole cast being invisible at once.
		steps.push({ hide: 4000 + Math.random() * 6000 });
		steps.push({ to: { x: d.x + 18, y: d.y + 6 }, speed: 9 });
		return steps.concat(travelSteps(d.level, u.level));
	}

	// Rolled once per wander leg. The weights are deliberately low: the island
	// should look like a place where something happens now and then, not a stage
	// where everybody is always busy.
	function rollErrand(u, now) {
		if (raiders.length) return;
		let plan = null;
		// The walk up the island is the long errand -- a minute of the unit being
		// somewhere you are not looking -- so it is the one thing on a clock.
		if (levels.length > 1 && now >= u.strollAt) {
			u.strollAt = now + 120000 + Math.random() * 180000;
			plan = planStroll(u);
		} else {
			const r = Math.random();
			if (u === sheep) {
				// A sheep has no errands, only grass.
				if (r < 0.6)
					plan = [
						{ act: "sheep_graze", ms: 3000 + Math.random() * 5000 },
					];
			} else if (
				u === pawn &&
				r < 0.5 &&
				jobsites.length &&
				depots.length
			)
				plan = planHaul(u, now);
			// A disjoint slice of the same roll, so the pawn's chance of stepping
			// indoors is the same as everyone else's rather than what is left over.
			else if (r > 0.92 && depots.length) plan = planVisit(u);
		}
		if (plan && plan.length) u.plan = plan;
	}

	// A raid changes everyone's business. Anybody up a terrace has to come down
	// the stairs rather than off the cliff, and anybody off his post has to be
	// back on it, so a recall is a travel plan and not a teleport.
	function recallAll() {
		for (const u of units) {
			// Down at a run, not at a stroll, and at the same pace as the spearman
			// making the same trip beside him. The garrison is quartered up the
			// island now, so this descent is nearly the whole of the delay between
			// a landing and an answer to it. Left at walking pace it was ten
			// seconds at a normal pane and seventeen at a wide one, which is longer
			// than most raids last.
			u.plan =
				u.level !== 0 ? travelSteps(u.level, 0, SALLY_SPEED) : null;
			u.pose = null;
			u.hidden = false;
			u.carry = null;
			u.target = null;
			u.pauseUntil = 0;
		}
		for (const g of garrison) {
			// Dropping the errand is enough. The next update finds him off his post
			// and builds the way back itself, stairs and door included.
			g.plan = null;
			g.pose = null;
			g.hidden = false;
		}
		// A seam abandoned mid-swing would otherwise glow for the rest of the
		// session. A tree already felled keeps its stump and its clock -- the
		// wood is gone whether or not a raid landed.
		for (const j of jobsites) if (!j.until) j.decor.key = j.key;
	}

	// And the other edge. Everyone the recall pulled down to the shore walks back
	// up to where he is quartered -- without this the knight fights one raid and
	// then lives on the beach for the rest of the session, which is the whole
	// thing this was meant to stop.
	function dismissAll() {
		for (const u of units)
			if (u.level !== u.homeLevel && levels[u.homeLevel])
				u.plan = travelSteps(u.level, u.homeLevel);
	}

	// Stand the post, and now and then leave it. Only one of them is ever away:
	// the keep emptying out is a different scene from a man taking a walk. The
	// test is "off his post", not "on an errand" -- the climb back up to the deck
	// happens after the errand has ended, and counting only the errand let a
	// second man set off while the first was still on the stairs.
	function garrisonAway() {
		for (const g of garrison) if (!g.onPost) return true;
		return false;
	}

	// Buildings are solid. A deck is a balcony a storey up, reached from inside,
	// and the first version had the garrison simply walking the straight line
	// between the deck and the ground -- up the outside of its own tower, through
	// the stonework. So a figure leaving its post steps inside, and comes out of
	// the door at the foot of the building; going back, it walks to the door and
	// reappears on the deck. The pack draws no door, so the door is the middle of
	// the building's base, which is where one would be.
	function gateOf(g) {
		return { x: g.host.x, y: g.host.y + 2 };
	}
	// Standing his own deck, to the pixel. `stepToward` snaps exactly on arrival
	// and the warp assigns the post outright, so this is never off by a fraction
	// -- and being a test on position rather than on the `onPost` flag, it is
	// right on the single frame between a plan emptying and the update noticing.
	// A ground post is never a deck however exactly it is stood on: the man is on
	// the same earth as everybody else and sorts into the scene like everybody
	// else.
	function onDeck(g) {
		return g.deck && g.x === g.post.x && g.y === g.post.y;
	}
	// Long enough to read as "went in and came out", short enough not to look
	// like the man has gone missing.
	const THROUGH_MS = 700;

	function garrisonReturn(g) {
		const back = travelSteps(g.level, g.homeLevel);
		// Only a deck is reached through the building. A man whose post is on the
		// ground in front of it just walks back to his mark.
		if (!g.deck) return back.concat([{ to: g.post }]);
		return back.concat([
			{ to: gateOf(g) },
			{ hide: THROUGH_MS, warp: g.post, level: g.homeLevel },
		]);
	}

	function updateGarrison(g, dt, now, war) {
		if (g.plan) {
			if (g.plan.length) {
				g.onPost = false;
				return runPlan(g, dt, now);
			}
			g.plan = null;
		}
		// Anywhere but the post means the last errand ended out in the open, so
		// the way back is a plan of its own rather than a walk straight at the deck.
		if (g.x !== g.post.x || g.y !== g.post.y) {
			g.onPost = false;
			g.plan = garrisonReturn(g);
			return;
		}
		g.onPost = true;
		g.moving = false;
		g.facing = g.postFacing;
		if (war || now < g.strollAt || garrisonAway()) return;
		// Minutes apart. A walk you catch once in a while is a place with people
		// in it; one you catch every time you look is a parade.
		g.strollAt = now + 150000 + Math.random() * 240000;
		const plan = planStroll(g);
		if (!plan || !plan.length) return;
		// Out of the door first, then the walk -- for a man who was on a deck.
		// planStroll starts from the level he is on, which the warp has not
		// changed, only where he stands on it. A man already on the ground simply
		// sets off.
		g.plan = g.deck
			? [
					{ hide: THROUGH_MS, warp: gateOf(g), level: g.homeLevel },
				].concat(plan)
			: plan;
		// Off duty from this instant, not from the next frame. The rest of the
		// garrison is updated after him in the same loop and asks `garrisonAway`
		// before setting off; leaving the flag until his own next update is a
		// one-frame window in which a second man reads the post as covered and
		// walks out too. Rare, but with three men who rotate it does happen, and
		// what it looks like is the keep emptying.
		g.onPost = false;
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
	// The pace of anyone running to the shore, stairs included. The sally is about
	// 450px of stairs in a sidebar-sized pane. Slower than this and nobody arrives
	// before a normal error is fixed; faster and they skate down the steps. The
	// whole garrison is quartered up the island now, so this is what sets the
	// delay between a landing and an answer to it.
	const SALLY_SPEED = 68;
	const ENGAGE = 3;

	// Battle stations relative to the front. Each defender stands at the range
	// its own sheet reaches, which is also what keeps them out of each other:
	// the lancer's thrust carries 75px and the knight's swing 34, so posting them
	// at one distance would bury one inside the other. The lancer's row sits low
	// enough that his levelled spear passes below the knight's feet instead of
	// through his shins.
	//
	// The line is two men and never more, however many the island musters. It was
	// tried at three by adding an archer on the ground: that spread it to 170px
	// across a 220px band, left no room for the village and buried the fight in
	// trees. So the archers shoot from where they already stand and cost the line
	// nothing, and the rest of the garrison holds its posts -- which is also why
	// the keep can muster five men without the shore turning into a scrum.
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
	// [floor, spread] ms an archer stands easy between volleys. Roughly triples
	// the time between his arrows, which is what a manned keep costs.
	const VOLLEY_REST = 900;

	let errorCount = 0;
	let raiders = [];
	let arrows = [];
	// Peace and war are different régimes for the whole cast, so the change is
	// what everybody reacts to, not the state.
	let wasWar = false;

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
				SALLY_SPEED,
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
	// Play the shoot sheet and loose the instant the release frame comes up, then
	// stand easy for a beat. The sheet stops at the release, so the arrow has to
	// fly on its own from here. Returns -1 while resting, which is the caller's
	// cue to draw him idle instead.
	//
	// The rest is what keeps the sky legible. Looped back to back the sheet
	// looses every two thirds of a second, which was fine when the whole island
	// had one bowman on it; with the keep and both towers manned it put eleven
	// arrows in the air at once and the raid disappeared behind its own covering
	// fire. It also reads better -- an archer firing without pause is a machine,
	// not a man.
	function volley(a, now) {
		const n = SPR.archer_shoot[2];
		if (now < a.restUntil) return -1;
		if (a.nockedAt < 0) a.nockedAt = now;
		let f = Math.floor(((now - a.nockedAt) / 1000) * SPR.archer_shoot[5]);
		if (f >= n) {
			a.restUntil = now + VOLLEY_REST + Math.random() * VOLLEY_REST;
			a.nockedAt = -1;
			a.loosed = false;
			return -1;
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
			if (knight.pose) return [knight.pose, frameAt(knight.pose, now, 0)];
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
	// A load swaps the whole idle/run pair rather than being drawn on top, because
	// the pack ships the carrying animations as complete sheets.
	const CARRY = {
		wood: ["pawn_idle_wood", "pawn_run_wood"],
		gold: ["pawn_idle_gold", "pawn_run_gold"],
		meat: ["pawn_idle_meat", "pawn_run_meat"],
		// A tool in hand is the same mechanism as a load in arms, so it rides in
		// the same table and needs nothing else.
		axe: ["pawn_idle_axe", "pawn_run_axe"],
		pick: ["pawn_idle_pick", "pawn_run_pick"],
		knife: ["pawn_idle_knife", "pawn_run_knife"],
	};

	function unitPose(u, now) {
		if (u === knight) return knightPose(now);
		// An errand holding a unit in a sheet wins: it is the whole point of the
		// step, and it is always a loop, so wall time frames it.
		if (u.pose) return [u.pose, frameAt(u.pose, now, u.x)];
		const load = CARRY[u.carry];
		const k = load
			? u.moving
				? load[1]
				: load[0]
			: u.moving
				? u.runKey
				: u.idleKey;
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
		// The moment a raid starts, every errand on the island is off: the cast
		// walks home down the stairs it came up, and nothing new is rolled until
		// the shore is clear again.
		if (war !== wasWar) {
			wasWar = war;
			if (war) recallAll();
			else dismissAll();
		}
		// Independent of anybody's errand: a stump comes back whether or not the
		// pawn who made it is still on the island's payroll.
		regrow(ts);
		if (war) {
			for (let i = 0; i < raiders.length; i++)
				updateRaider(raiders[i], i, dt);
			// Anyone caught up a terrace when the landing came has stairs to walk
			// before he can form the line; the recall handed him the route.
			if (knight.plan && knight.plan.length) {
				knight.atPost = false;
				knight.act = null;
				runPlan(knight, dt, ts);
				if (knight.moving) spawnDust(ts);
			} else {
				knight.plan = null;
				knight.pose = null;
				// Defenders march to a fixed station rather than to whichever raider
				// is closest. A line that re-forms every time a raider shifts never
				// settles, and the fight stops being readable as two sides facing
				// each other.
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
			}
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
		for (const g of garrison) updateGarrison(g, dt, ts, war);
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
				draw: () =>
					drawSprite(d.key, d.x, d.y, frameAt(d.key, ts, d.x), false),
			});
		}
		for (const g of garrison) {
			if (g.hidden) continue;
			order.push({
				// On the deck he draws just after his building, whatever his feet say:
				// a deck is above the building's own contact point, so sorting him by
				// it would put him behind his own tower. The test is standing on the
				// post exactly, not merely being above the base line -- crossing the
				// terrace behind his own barracks puts him above it too, and he
				// belongs behind the wall there, not painted on the front of it.
				y: onDeck(g) ? g.host.y + 1 : g.y,
				draw: () => {
					// Every archer on the island holds his post through the whole
					// raid, and an archer on his post shoots rather than stands --
					// except between volleys, where he falls through to his idle
					// and is a man catching his breath rather than a gap.
					if (g.archer && g.onPost && war) {
						const f = volley(g, ts);
						if (f >= 0) {
							drawSprite(
								"archer_shoot",
								g.x,
								g.y,
								f,
								g.facing === -1,
							);
							return;
						}
					}
					const key = g.pose
						? g.pose
						: g.moving
							? g.runKey
							: g.idleKey;
					drawSprite(
						key,
						g.x,
						g.y,
						frameAt(key, ts, g.x),
						g.facing === -1,
					);
				},
			});
		}
		for (const u of units) {
			if (u.hidden) continue;
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
