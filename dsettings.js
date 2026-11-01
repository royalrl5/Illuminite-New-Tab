"use strict";
/* ---------- Look, cursor and the desktop Settings app ---------- */
function applyLook() {
	const r = document.documentElement;
	r.style.setProperty("--accent", S.accent || "#0078d4");
	r.style.setProperty("--is", dims()[2] + "px");
	r.classList.toggle("no-blur", !S.transparency);
	r.classList.toggle("sq", !S.rounded);
	r.classList.toggle("no-anim", !S.anim);
	os.classList.toggle("hide-labels", !S.labels);
	os.classList.toggle("hide-icons", !S.icons);
	os.classList.toggle("tl", S.align === "left");
	applyTheme();
	applyCursor();
	if (osOn) { tickTray(); paintTray(); }
}
globalThis.onBoot = () => { applyLook(); if (S.startDesktop) enterDesktop(); };

/* Cursor: built-in styles, custom colors, or an uploaded .cur / .ani / image */
let aniT;
function applyCursor() {
	clearTimeout(aniT);
	const r = document.documentElement.style, sz = S.curSize || 32;
	document.body.classList.toggle("sys-cursor", S.cursor === "system");
	const mk = (a, b, line) => {
		const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><path d='M5 3 L5 25 L11 19.5 L15.5 29 L19.5 27 L15 18 L23 18 Z' fill='url(#g)' stroke='${line}' stroke-width='1.7' stroke-linejoin='round'/></svg>`;
		return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round((5 * sz) / 32)} ${Math.round((3 * sz) / 32)}`;
	};
	const set = (a, p = a) => { r.setProperty("--cur", a); r.setProperty("--cur-p", p); };
	const f = S.curFile;
	if (S.cursor === "file" && f?.frames?.length) {
		const steps = f.steps?.length ? f.steps : [[0, 100]];
		let i = 0;
		const go = () => {
			const u = `url("${f.frames[steps[i][0]]}")`;
			set(u);
			if (steps.length > 1) { aniT = setTimeout(go, Math.max(40, steps[i][1])); i = (i + 1) % steps.length; }
		};
		go();
	} else if (S.cursor === "color") set(mk(S.curFill, S.curFill, S.curLine), mk(S.curLine, S.curLine, S.curFill));
	else set(mk("#ffffff", "#c9b8ff", "#4b2fd6"), mk("#ff4fa3", "#2de2e6", "#2a1466"));
}
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
function parseAni(buf) {
	const v = new DataView(buf), u = new Uint8Array(buf);
	const tag = (o) => String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]);
	if (tag(0) !== "RIFF" || tag(8) !== "ACON") throw new Error("Not an .ani file");
	let hdr = null, rate = null, seq = null;
	const frames = [];
	const walk = (o, end) => {
		while (o + 8 <= end) {
			const id = tag(o), sz = v.getUint32(o + 4, true), d = o + 8;
			if (id === "anih") hdr = { n: v.getUint32(d + 4, true), rate: v.getUint32(d + 28, true) };
			else if (id === "rate") rate = Array.from({ length: sz >> 2 }, (_, i) => v.getUint32(d + i * 4, true));
			else if (id === "seq ") seq = Array.from({ length: sz >> 2 }, (_, i) => v.getUint32(d + i * 4, true));
			else if (id === "LIST") { if (tag(d) === "fram") walk(d + 4, d + sz); }
			else if (id === "icon") frames.push("data:image/x-icon;base64," + b64(u.subarray(d, d + sz)));
			o = d + sz + (sz & 1);
		}
	};
	walk(12, Math.min(buf.byteLength, 8 + v.getUint32(4, true)));
	if (!frames.length) throw new Error("No frames found");
	const order = seq || frames.map((_, i) => i);
	const steps = order.map((fi, i) => [Math.min(fi, frames.length - 1), Math.round(((rate ? rate[i] : hdr?.rate || 6) * 1000) / 60)]);
	return { frames, steps };
}
async function loadCursorFile(file) {
	try {
		if (file.size > 800000) throw new Error("File is too big (800 KB max)");
		const ext = file.name.split(".").pop().toLowerCase(), buf = await file.arrayBuffer();
		let out;
		if (ext === "ani") out = parseAni(buf);
		else if (ext === "cur" || ext === "ico") out = { frames: ["data:image/x-icon;base64," + b64(new Uint8Array(buf))], steps: [[0, 100]] };
		else if (file.type.startsWith("image/")) out = { frames: ["data:" + file.type + ";base64," + b64(new Uint8Array(buf))], steps: [[0, 100]] };
		else throw new Error("Use a .cur, .ani or image file");
		S.curFile = { name: file.name, ...out };
		S.cursor = "file";
		save(); applyCursor(); sfx.add();
		toast(`Cursor loaded: ${file.name}`);
		return true;
	} catch (err) { sfx.err(); toast(err.message || "Couldn't read that cursor file"); return false; }
}

/* ---------- Settings app ---------- */
function openSettingsApp(section) {
	const x = openWin({ key: "settings", title: "Settings", ic: gi(BUILTIN.find((b) => b.id === "settings")), w: 880, h: 600, build: buildSettings });
	if (section) x.go?.(section);
}
const mkRow = (main, label, desc, ...ctl) => {
	const r = document.createElement("div");
	r.className = "sr2";
	const t = document.createElement("div");
	t.innerHTML = "<b></b><small></small>";
	t.firstChild.textContent = label; t.lastChild.textContent = desc || "";
	r.append(t);
	if (ctl.length) { const w = document.createElement("div"); w.className = "ctl"; w.append(...ctl); r.append(w); }
	main.append(r);
};
const mkHead = (main, t) => { const h = document.createElement("div"); h.className = "sect"; h.textContent = t; main.append(h); };
const cSwitch = (k, after) => { const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("role", "switch"); i.checked = !!S[k]; i.onchange = () => { S[k] = i.checked; save(); applyLook(); sfx.click(); after?.(i.checked); }; return i; };
const cSelect = (k, opts, num, after) => { const s = document.createElement("select"); opts.forEach(([v, l]) => s.append(new Option(l, v))); s.value = String(S[k]); s.onchange = () => { S[k] = num ? +s.value : s.value; save(); applyLook(); sfx.click(); after?.(S[k]); }; return s; };
const cColor = (k) => { const i = document.createElement("input"); i.type = "color"; i.value = S[k]; i.oninput = () => { S[k] = i.value; applyLook(); }; i.onchange = save; return i; };
const cRange = (k, min, max) => { const i = document.createElement("input"); i.type = "range"; i.min = min; i.max = max; i.value = S[k]; i.oninput = () => { S[k] = +i.value; applyLook(); }; i.onchange = () => { save(); sfx.click(); }; return i; };
const cBtn = (label, fn) => { const b = document.createElement("button"); b.className = "cbtn"; b.textContent = label; b.onclick = fn; return b; };
const cFile = (label, accept, fn) => { const l = document.createElement("label"); l.className = "cbtn"; l.textContent = label; const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.hidden = true; i.onchange = async () => { const f = i.files[0]; i.value = ""; if (f) await fn(f); }; l.append(i); return l; };

const GUIDE = `
<h3>Desktop basics</h3>
<ul><li>Double-click an icon to open it in a window (or turn on single-click in Desktop &amp; taskbar).</li>
<li>Drag windows by the title bar, resize from the bottom-right corner, double-click the title bar to maximize.</li>
<li>Click the Start button, or just type after opening it, to find apps. Recently used apps show under Recommended.</li></ul>
<h3>Icons</h3>
<ul><li>Drag any icon to move it. Icons snap to a grid (change this in Settings) and never overlap.</li>
<li>Press and drag on empty desktop to draw a selection box and pick several icons. Hold Ctrl or Shift to add to the selection.</li>
<li>Drag a selected icon to move the whole group. Right-click the selection to open, align or remove them together.</li>
<li>Right-click the desktop and choose New shortcut to add a website right where you clicked.</li>
<li>Select an icon and press F2 to rename it, or Delete to remove a shortcut.</li></ul>
<h3>Apps</h3>
<ul><li>Notepad saves automatically. Calculator, Clock, Paint, Task Manager and a simple Browser are built in.</li>
<li>Websites open in a window. If a site shows a blank page, it doesn't allow being embedded: use Open in new window.</li></ul>
<h3>Leaving</h3>
<ul><li>Use Start, then the power button, then Exit desktop mode. The sliver at the far right of the taskbar shows the desktop.</li></ul>`;

function buildSettings(c, x) {
	c.innerHTML = '<div class="set"><nav></nav><main></main></div>';
	const nav = $("nav", c), main = $("main", c);
	const SECT = [["personalization", "Personalization"], ["desktop", "Desktop & taskbar"], ["mouse", "Mouse & cursor"], ["sound", "Sound"], ["system", "System"], ["data", "Data & backup"], ["help", "How to use"], ["about", "About"]];
	const R = (...a) => mkRow(main, ...a);
	const page = {
		personalization() {
			R("Theme", "Light, dark, or match your system", cSelect("theme", [["system", "Match system"], ["light", "Light"], ["dark", "Dark"]], false, () => paintTray?.()));
			const sw = document.createElement("div"); sw.className = "swatches";
			for (const col of ["#0078d4", "#7a3bff", "#e5484d", "#10a37f", "#f5a524", "#ff4fa3"]) {
				const b = document.createElement("button"); b.style.background = col; b.setAttribute("aria-label", col);
				b.onclick = () => { S.accent = col; save(); applyLook(); sfx.click(); go("personalization"); };
				sw.append(b);
			}
			const ci = document.createElement("input"); ci.type = "color"; ci.value = S.accent || "#0078d4"; ci.oninput = () => { S.accent = ci.value; applyLook(); }; ci.onchange = save;
			R("Accent color", "Used for buttons, switches and highlights", sw, ci);
			R("Transparency effects", "Frosted glass on the taskbar, Start menu and tiles", cSwitch("transparency"));
			R("Rounded corners", "Soft corners on windows and icons", cSwitch("rounded"));
			R("Animations", "Window, menu and icon motion", cSwitch("anim"));
			mkHead(main, "Background");
			const g = document.createElement("div"); g.className = "thumbs";
			WALLS.forEach((w, i) => { const b = document.createElement("button"); b.style.background = w.c; b.title = w.n; b.setAttribute("aria-label", w.n); b.setAttribute("aria-pressed", String(!S.custom && S.wall === i)); b.onclick = () => { S.wall = i; S.custom = false; save(); paintWall(); sfx.click(); go("personalization"); }; g.append(b); });
			main.append(g);
			R("Your own picture", S.custom ? "Using your uploaded picture" : "Upload an image to use as the desktop background", cFile("Browse", "image/*", async (f) => { try { wallData = await fitImage(f); S.custom = true; save(); paintWall(); sfx.add(); go("personalization"); } catch { sfx.err(); toast("Couldn't read that image"); } }));
		},
		desktop() {
			mkHead(main, "Desktop");
			R("Icon size", "", cSelect("iconSize", [["s", "Small"], ["m", "Medium"], ["l", "Large"]], false, () => { buildIcons(); alignIcons(); }));
			R("Show icon names", "", cSwitch("labels"));
			R("Show desktop icons", "", cSwitch("icons"));
			R("Snap icons to grid", "Keeps icons neatly lined up when you move them", cSwitch("snap"));
			R("Single-click to open", "Open icons with one click instead of two", cSwitch("singleClick"));
			R("Icon layout", "Align icons to the grid, or put them back in their starting places", cBtn("Align", alignIcons), cBtn("Reset", resetIcons));
			mkHead(main, "Taskbar");
			R("Taskbar alignment", "Center the Start button and apps, or keep them left", cSelect("align", [["center", "Center"], ["left", "Left"]]));
			R("Show date", "Below the time in the corner of the taskbar", cSwitch("showDate"));
			R("Show seconds", "", cSwitch("seconds"));
			R("24-hour clock", "", cSwitch("clock24"));
			mkHead(main, "Startup");
			R("Open in desktop mode", "Start every new tab in desktop mode. The startup sound needs a click first, so it may stay silent", cSwitch("startDesktop"));
		},
		mouse() {
			R("Cursor style", "Applies in desktop mode", cSelect("cursor", [["system", "Windows default"], ["illuminite", "Illuminite"], ["color", "Custom colors"], ["file", "Uploaded file"]], false, () => go("mouse")));
			R("Cursor size", "For the Illuminite and custom-color styles", cSelect("curSize", [["24", "Small"], ["32", "Medium"], ["48", "Large"]], true));
			R("Cursor fill", "Used with Custom colors", cColor("curFill"));
			R("Cursor outline", "Used with Custom colors. Clickable items swap the two colors", cColor("curLine"));
			R("Cursor file", S.curFile ? `${S.curFile.name}${S.curFile.steps.length > 1 ? " (animated)" : ""}` : "Upload a .cur, .ani or image file (up to 128 px). Animated .ani files play frame by frame", cFile("Upload", ".cur,.ani,.ico,image/*", async (f) => { if (await loadCursorFile(f)) go("mouse"); }), ...(S.curFile ? [cBtn("Remove", () => { S.curFile = null; if (S.cursor === "file") S.cursor = "illuminite"; save(); applyCursor(); go("mouse"); })] : []));
			const t = document.createElement("div"); t.className = "curtest"; t.textContent = "Move your pointer here to try it";
			main.append(t);
			R("Double-click to open icons", "Switch to single-click in Desktop & taskbar", cBtn("Open", () => go("desktop")));
		},
		sound() {
			R("Sound effects", "Clicks, window sounds and notifications", cSwitch("sound", () => paintTray()));
			R("Startup sound", "Plays when you enter desktop mode", cSwitch("bootSound"));
			R("Volume", "", cRange("vol", 0, 100));
			R("Try it", "", cBtn("Sound effect", () => sfx.add()), cBtn("Startup sound", () => bootSound()));
		},
		system() {
			R("Search engine", "Used by the search bar and the Browser app", cSelect("engine", Object.entries(ENGINES).map(([k, v]) => [k, v[0]]), false, () => paintEng()));
			mkHead(main, "Screensaver");
			R("Start automatically", "After no activity for a while", cSelect("idle", [["0", "Never"], ["2", "After 2 minutes"], ["5", "After 5 minutes"], ["10", "After 10 minutes"]], true, () => armIdle()));
			R("Screensaver video", "Use your own video, or the built-in animation", cFile("Upload", "video/*", async (f) => { await blob("set", "video", f); sfx.add(); toast("Screensaver video saved"); }), cBtn("Use default", async () => { await blob("del", "video"); sfx.click(); toast("Using the default screensaver"); }));
			R("Try it now", "Press Esc to leave", cBtn("Start", startSaver));
		},
		data() {
			R("Save a backup", "Downloads your apps, layout, wallpaper and settings as a file", cBtn("Save to file", exportFile));
			R("Restore a backup", "Load a file you saved earlier", cBtn("Load from file", () => $("#imp").click()));
			R("Storage", "Everything is kept in the extension and stays until you uninstall it");
		},
		help() { const d = document.createElement("div"); d.className = "guide"; d.innerHTML = GUIDE; main.append(d); },
		about() {
			R("Illuminite New Tab", `Version ${api.runtime?.getManifest?.().version ?? ""}`);
			R("Made to look beautiful", "Your data never leaves your browser, apart from the icons fetched for your shortcuts");
		},
	};
	function go(id) {
		main.replaceChildren();
		const name = SECT.find((s) => s[0] === id)?.[1] ?? "";
		const h = document.createElement("h2"); h.textContent = name; main.append(h);
		page[id]();
		$$("button", nav).forEach((b) => b.classList.toggle("on", b.dataset.id === id));
	}
	for (const [id, label] of SECT) { const b = document.createElement("button"); b.dataset.id = id; b.textContent = label; b.onclick = () => { sfx.click(); go(id); }; nav.append(b); }
	x.go = go;
	go("personalization");
}
