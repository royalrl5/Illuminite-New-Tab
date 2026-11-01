"use strict";

const $ = (s, r = document) => r.querySelector(s);
const api = globalThis.browser ?? globalThis.chrome;

/* ---------- Video storage (IndexedDB, too big for storage.local) ---------- */
const idb = () =>
	new Promise((res, rej) => {
		const r = indexedDB.open("browos", 1);
		r.onupgradeneeded = () => r.result.createObjectStore("b");
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
async function blob(op, key, val) {
	const db = await idb();
	return new Promise((res, rej) => {
		const s = db.transaction("b", op === "get" ? "readonly" : "readwrite").objectStore("b");
		const q = op === "get" ? s.get(key) : op === "set" ? s.put(val, key) : s.delete(key);
		q.onsuccess = () => res(q.result);
		q.onerror = () => rej(q.error);
	});
}

/* ---------- State (saved in extension storage: survives until uninstall) ---------- */
const WALLS = [
	{ n: "Dusk", c: "linear-gradient(160deg,#241f4a,#7a3b69 55%,#e8845a)" },
	{ n: "Deep sea", c: "linear-gradient(160deg,#04111f,#0b4a6b 60%,#2fa4a0)" },
	{ n: "Forest", c: "linear-gradient(160deg,#0d1f17,#1f5a3d 60%,#8bbf6a)" },
	{ n: "Graphite", c: "linear-gradient(160deg,#1a1b1e,#34373d 60%,#5a6070)" },
	{ n: "Ember", c: "radial-gradient(circle at 20% 20%,#ffb36b,transparent 40%),linear-gradient(160deg,#2b0f1f,#8a2c3c)" },
	{ n: "Lagoon", c: "radial-gradient(circle at 80% 10%,#6be3d2,transparent 45%),linear-gradient(160deg,#10204a,#2a5fb0)" },
];
const ENGINES = {
	ddg: ["DuckDuckGo", "https://duckduckgo.com/?q="],
	google: ["Google", "https://www.google.com/search?q="],
	bing: ["Bing", "https://www.bing.com/search?q="],
	brave: ["Brave", "https://search.brave.com/search?q="],
	startpage: ["Startpage", "https://www.startpage.com/do/search?q="],
	ecosia: ["Ecosia", "https://www.ecosia.org/search?q="],
	yahoo: ["Yahoo", "https://search.yahoo.com/search?p="],
};
const S = { wall: 0, custom: false, sound: true, engine: "ddg", idle: 0, theme: "system" };
let wallData = null;
let apps = [
	{ id: 1, name: "Wikipedia", url: "https://www.wikipedia.org" },
	{ id: 2, name: "GitHub", url: "https://github.com" },
	{ id: 3, name: "YouTube", url: "https://www.youtube.com" },
];
const save = () => api.storage.local.set({ browos: { apps, S, wall: wallData } }).catch(() => {});

async function fitImage(file) {
	const bmp = await createImageBitmap(file);
	const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
	const c = document.createElement("canvas");
	c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
	c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
	return c.toDataURL("image/jpeg", 0.88);
}
async function load() {
	let d;
	try { d = (await api.storage.local.get("browos")).browos; } catch {}
	if (!d) {
		// Migrate from v1.1 (localStorage + IndexedDB wallpaper)
		const ls = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
		d = { apps: ls("apps"), S: ls("settings") || {} };
		try { const b = await blob("get", "wall"); if (b) d.wall = await fitImage(b); } catch {}
	}
	if (Array.isArray(d.apps)) apps = d.apps;
	Object.assign(S, d.S);
	wallData = d.wall || null;
	save();
	navigator.storage?.persist?.();
}

/* ---------- Sound FX (synthesised) ---------- */
let ac;
function tone(f, d = 0.08, type = "sine", v = 0.05, at = 0) {
	if (!S.sound) return;
	ac ??= new AudioContext();
	const t = ac.currentTime + at;
	const o = ac.createOscillator(), g = ac.createGain();
	o.type = type; o.frequency.value = f;
	g.gain.setValueAtTime(v, t);
	g.gain.exponentialRampToValueAtTime(0.0001, t + d);
	o.connect(g).connect(ac.destination);
	o.start(t); o.stop(t + d);
}
const sfx = {
	click: () => tone(720, 0.05, "triangle"),
	open: () => { tone(440, 0.09); tone(660, 0.12, "sine", 0.05, 0.07); },
	add: () => { tone(523, 0.08); tone(659, 0.08, "sine", 0.05, 0.07); tone(784, 0.14, "sine", 0.05, 0.14); },
	del: () => { tone(330, 0.1, "triangle"); tone(220, 0.14, "triangle", 0.05, 0.08); },
	lift: () => tone(540, 0.07, "sine", 0.05),
	drop: () => tone(400, 0.09, "triangle", 0.05),
	err: () => tone(160, 0.2, "square", 0.03),
};

/* ---------- Helpers ---------- */
let toastT;
function toast(msg) {
	const t = $("#toast");
	t.textContent = msg; t.classList.add("on");
	clearTimeout(toastT);
	toastT = setTimeout(() => t.classList.remove("on"), 2200);
}
function normUrl(v) {
	v = String(v || "").trim();
	if (!v) return null;
	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = "https://" + v;
	try {
		const u = new URL(v);
		if (!/^https?:$/.test(u.protocol) || (!u.hostname.includes(".") && u.hostname !== "localhost")) return null;
		return u.href;
	} catch { return null; }
}
const openTab = (url) => window.open(url, "_blank", "noopener");
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

/* ---------- Theme ---------- */
const mq = matchMedia("(prefers-color-scheme: light)");
const effTheme = () => (S.theme === "system" ? (mq.matches ? "light" : "dark") : S.theme);
const applyTheme = () => (document.documentElement.dataset.theme = effTheme());
mq.onchange = applyTheme;

/* ---------- Clock ---------- */
function tick() {
	const d = new Date();
	$("#clock").textContent = d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
	$("#sclock").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
setInterval(tick, 5000);
tick();

/* ---------- Wallpaper ---------- */
function paintWall() {
	const w = $("#wall");
	if (S.custom && wallData) {
		w.style.background = "";
		w.style.backgroundImage = `url("${wallData}")`;
	} else {
		w.style.backgroundImage = "";
		w.style.background = (WALLS[S.wall] ?? WALLS[0]).c;
	}
}
function buildWalls() {
	const box = $("#walls");
	box.replaceChildren();
	WALLS.forEach((w, i) => {
		const b = document.createElement("button");
		b.style.background = w.c;
		b.title = w.n; b.setAttribute("aria-label", w.n);
		b.setAttribute("aria-pressed", String(!S.custom && S.wall === i));
		b.onclick = () => { S.wall = i; S.custom = false; save(); sfx.click(); paintWall(); buildWalls(); };
		box.append(b);
	});
}

/* ---------- Apps ---------- */
function icon(app) {
	const host = new URL(app.url).hostname;
	const img = document.createElement("img");
	img.className = "ic"; img.alt = ""; img.draggable = false;
	img.src = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
	img.onerror = () => {
		const l = document.createElement("div");
		l.className = "ic letter";
		l.style.background = `hsl(${hue(host)} 45% 42%)`;
		l.textContent = (app.name[0] || "?").toUpperCase();
		img.replaceWith(l);
	};
	return img;
}
function renderApps() {
	const box = $("#apps");
	box.replaceChildren();
	for (const a of apps) {
		const b = document.createElement("button");
		b.className = "app"; b.title = a.url; b.dataset.id = a.id;
		const n = document.createElement("span");
		n.className = "n"; n.textContent = a.name;
		b.append(icon(a), n);
		b.onclick = () => { sfx.open(); openTab(a.url); };
		b.oncontextmenu = (e) => {
			e.preventDefault(); e.stopPropagation();
			showMenu(e.clientX, e.clientY, [
				["Open", () => { sfx.open(); openTab(a.url); }],
				["Rename", () => appDialog("rename", a)],
				["Edit link", () => appDialog("edit", a)],
				"-",
				["Remove", () => { apps = apps.filter((x) => x.id !== a.id); save(); sfx.del(); renderApps(); toast(`Removed ${a.name}`); }, "danger"],
			]);
		};
		b.onpointerdown = (e) => press(b, e);
		box.append(b);
	}
	const add = document.createElement("button");
	add.className = "app add";
	add.innerHTML = '<div class="ic"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div><span class="n">Add app</span>';
	add.onclick = () => appDialog("add");
	box.append(add);
}

/* ---------- Press and hold to drag (1 second) ---------- */
let drag = null, suppress = false;
const tiles = () => [...$("#apps").querySelectorAll(".app:not(.add)")];
function press(tile, e) {
	if (e.button !== 0 || drag) return;
	const sx = e.clientX, sy = e.clientY;
	const off = () => {
		removeEventListener("pointermove", mv);
		removeEventListener("pointerup", end);
		removeEventListener("pointercancel", end);
	};
	const end = () => { clearTimeout(timer); off(); };
	const mv = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) end(); };
	const timer = setTimeout(() => { off(); lift(tile, sx, sy); }, 1000);
	addEventListener("pointermove", mv);
	addEventListener("pointerup", end);
	addEventListener("pointercancel", end);
}
function lift(tile, x, y) {
	const r = tile.getBoundingClientRect();
	const clone = tile.cloneNode(true);
	clone.classList.add("drag");
	clone.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
	document.body.append(clone);
	tile.classList.add("ghost");
	drag = { tile, clone, ox: x - r.left, oy: y - r.top, lock: 0 };
	sfx.lift(); navigator.vibrate?.(12);
	clone.getBoundingClientRect();
	clone.classList.add("lifted");
	addEventListener("pointermove", dragMove);
	addEventListener("pointerup", dragEnd);
	addEventListener("pointercancel", dragEnd);
	document.addEventListener("touchmove", noScroll, { passive: false });
}
const noScroll = (e) => e.preventDefault();
function dragMove(e) {
	const { clone, tile } = drag;
	clone.style.left = e.clientX - drag.ox + "px";
	clone.style.top = e.clientY - drag.oy + "px";
	if (performance.now() < drag.lock) return;
	const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".app:not(.add)");
	if (!over || over === tile) return;
	// Only tiles whose slot changes animate: the ones between the dragged tile and the hovered one.
	const list = tiles();
	const before = new Map(list.map((t) => [t, t.getBoundingClientRect()]));
	over.after(tile);
	if (list.indexOf(tile) > list.indexOf(over)) over.before(tile);
	for (const t of list) {
		if (t === tile) continue;
		const a = before.get(t), b = t.getBoundingClientRect();
		const dx = a.left - b.left, dy = a.top - b.top;
		if (dx || dy) t.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
	}
	drag.lock = performance.now() + 220;
	sfx.click();
}
function dragEnd() {
	const { tile, clone } = drag;
	removeEventListener("pointermove", dragMove);
	removeEventListener("pointerup", dragEnd);
	removeEventListener("pointercancel", dragEnd);
	document.removeEventListener("touchmove", noScroll);
	const r = tile.getBoundingClientRect();
	clone.classList.add("drop");
	clone.classList.remove("lifted");
	clone.style.left = r.left + "px"; clone.style.top = r.top + "px";
	suppress = true; setTimeout(() => (suppress = false), 60);
	drag = null;
	setTimeout(() => { tile.classList.remove("ghost"); clone.remove(); }, 210);
	const ids = tiles().map((t) => +t.dataset.id);
	apps.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
	save(); sfx.drop();
}
addEventListener("click", (e) => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);

/* ---------- Add / rename / edit (rename never touches the link) ---------- */
let editing = null, mode = "add";
function appDialog(m, app = null) {
	sfx.click();
	mode = m; editing = app;
	const f = $("#appform");
	f.reset();
	$("#dlg-err").textContent = "";
	$("#dlg-title").textContent = { add: "Add app", rename: "Rename app", edit: "Edit link" }[m];
	$("#dlg-ok").textContent = { add: "Add", rename: "Rename", edit: "Save" }[m];
	$("#f-name").hidden = m === "edit";
	$("#f-url").hidden = m === "rename";
	f.name.required = m !== "edit";
	if (app) { f.name.value = app.name; f.url.value = app.url; }
	$("#dlg").showModal();
	const t = m === "edit" ? f.url : f.name;
	t.focus(); t.select?.();
}
$("#dlg-cancel").onclick = () => $("#dlg").close();
$("#appform").onsubmit = (e) => {
	e.preventDefault();
	const f = e.target, name = f.name.value.trim();
	if (mode === "rename") {
		editing.name = name;
	} else {
		const url = normUrl(f.url.value);
		if (!url) { $("#dlg-err").textContent = "Enter a valid link, like example.com"; sfx.err(); return; }
		if (mode === "edit") editing.url = url;
		else apps.push({ id: Date.now(), name: name || new URL(url).hostname.replace(/^www\./, ""), url });
	}
	save(); renderApps(); $("#dlg").close();
	mode === "add" ? sfx.add() : sfx.click();
};

/* ---------- Menus ---------- */
function showMenu(x, y, items, anchor) {
	const m = $("#menu");
	m.replaceChildren();
	for (const it of items) {
		if (it === "-") { m.append(document.createElement("hr")); continue; }
		const b = document.createElement("button");
		b.textContent = it[0]; b.setAttribute("role", "menuitem");
		if (it[2]) b.className = it[2];
		b.onclick = () => { hideMenu(); it[1](); };
		m.append(b);
	}
	m.hidden = false;
	const w = m.offsetWidth, h = m.offsetHeight;
	m.style.left = (anchor ? anchor.right - w : Math.min(x, innerWidth - w - 8)) + "px";
	m.style.top = (anchor ? anchor.top - h - 10 : Math.min(y, innerHeight - h - 8)) + "px";
	m.firstElementChild?.focus();
}
const hideMenu = () => ($("#menu").hidden = true);
addEventListener("click", hideMenu);
addEventListener("blur", hideMenu);
addEventListener("keydown", (e) => e.key === "Escape" && hideMenu());

function toggleTheme() {
	S.theme = effTheme() === "dark" ? "light" : "dark";
	save(); applyTheme(); sfx.click();
}
$("#menu-btn").onclick = (e) => {
	e.stopPropagation();
	sfx.click();
	if (!$("#menu").hidden) return hideMenu();
	showMenu(0, 0, [
		["Add app", () => appDialog("add")],
		["Start screensaver", startSaver],
		[effTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme", toggleTheme],
		[S.sound ? "Turn sound effects off" : "Turn sound effects on", () => { S.sound = !S.sound; save(); sfx.click(); toast(S.sound ? "Sound effects on" : "Sound effects off"); }],
		["Settings", openSettings],
		"-",
		["Save to file", exportFile],
		["Load from file", () => $("#imp").click()],
	], $("#menu-btn").getBoundingClientRect());
};
document.addEventListener("contextmenu", (e) => {
	e.preventDefault();
	showMenu(e.clientX, e.clientY, [
		["Add app", () => appDialog("add")],
		["Change wallpaper", openSettings],
		["Start screensaver", startSaver],
	]);
});

/* ---------- Backup file ---------- */
function exportFile() {
	const data = JSON.stringify({ app: "browos", version: 2, apps, settings: S, wallpaper: wallData }, null, 2);
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
	a.download = "browos-backup.json";
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 2000);
	sfx.add(); toast("Saved browos-backup.json");
}
$("#imp").onchange = async (e) => {
	const f = e.target.files[0];
	e.target.value = "";
	if (!f) return;
	try {
		const d = JSON.parse(await f.text());
		if (d.app !== "browos" || !Array.isArray(d.apps)) throw 0;
		apps = d.apps.map((a, i) => ({ id: Date.now() + i, name: String(a.name || "App").slice(0, 40), url: normUrl(a.url) })).filter((a) => a.url);
		Object.assign(S, d.settings);
		wallData = typeof d.wallpaper === "string" && d.wallpaper.startsWith("data:image/") ? d.wallpaper : null;
		save(); applyTheme(); paintWall(); paintEng(); renderApps(); armIdle(); sfx.add(); toast("Loaded your backup");
	} catch { sfx.err(); toast("That isn't a BrowOS backup file"); }
};

/* ---------- Search ---------- */
$("#search").onsubmit = (e) => {
	e.preventDefault();
	const v = $("#q").value.trim();
	if (!v) return;
	sfx.open();
	const direct = !/\s/.test(v) && /\.[a-z]{2,}(\/|$)/i.test(v) ? normUrl(v) : null;
	openTab(direct ?? ENGINES[S.engine][1] + encodeURIComponent(v));
	$("#q").value = "";
};
function paintEng() {
	if (!ENGINES[S.engine]) S.engine = "ddg";
	$("#eng").textContent = ENGINES[S.engine][0];
	$("#q").placeholder = `Search with ${ENGINES[S.engine][0]} or type a link`;
	$("#s-engine").value = S.engine;
}
function setEngine(k) { S.engine = k; save(); paintEng(); sfx.click(); }
$("#eng").onclick = (e) => {
	e.stopPropagation(); sfx.click();
	const r = e.currentTarget.getBoundingClientRect();
	showMenu(r.right - 200, r.bottom + 8, Object.entries(ENGINES).map(([k, v]) => [(k === S.engine ? "\u2713  " : "\u2003 ") + v[0], () => setEngine(k)]));
};
$("#s-engine").replaceChildren(...Object.entries(ENGINES).map(([k, v]) => new Option(v[0], k)));

/* ---------- Settings ---------- */
function openSettings() {
	sfx.click();
	buildWalls();
	$("#s-theme").value = S.theme;
	$("#s-engine").value = S.engine;
	$("#s-idle").value = String(S.idle);
	$("#s-snd").checked = S.sound;
	$("#set").showModal();
}
$("#set-close").onclick = () => $("#set").close();
$("#s-theme").onchange = (e) => { S.theme = e.target.value; save(); applyTheme(); };
$("#s-engine").onchange = (e) => setEngine(e.target.value);
$("#s-idle").onchange = (e) => { S.idle = +e.target.value; save(); armIdle(); };
$("#s-snd").onchange = (e) => { S.sound = e.target.checked; save(); sfx.click(); };
$("#up-wall").onchange = async (e) => {
	const f = e.target.files[0];
	e.target.value = "";
	if (!f) return;
	try {
		wallData = await fitImage(f);
		S.custom = true; save(); paintWall(); buildWalls(); sfx.add();
	} catch { sfx.err(); toast("Couldn't read that image"); }
};
$("#up-vid").onchange = async (e) => {
	const f = e.target.files[0];
	e.target.value = "";
	if (!f) return;
	await blob("set", "video", f);
	sfx.add(); toast("Screensaver video saved");
};
$("#clr-vid").onclick = async () => { await blob("del", "video"); sfx.click(); toast("Using the default screensaver"); };

/* ---------- Screensaver ---------- */
let stopAurora, vidUrl, saverOn = false;
function aurora(c) {
	const x = c.getContext("2d");
	let t = 0, raf;
	const fit = () => { c.width = innerWidth; c.height = innerHeight; };
	fit(); addEventListener("resize", fit);
	const loop = () => {
		t += 0.004;
		x.globalCompositeOperation = "source-over";
		x.fillStyle = "rgba(6,8,20,.2)";
		x.fillRect(0, 0, c.width, c.height);
		x.globalCompositeOperation = "lighter";
		for (let i = 0; i < 4; i++) {
			const h = 150 + i * 45 + Math.sin(t + i) * 30;
			const g = x.createLinearGradient(0, c.height * 0.2, 0, c.height);
			g.addColorStop(0, `hsla(${h},90%,60%,.28)`);
			g.addColorStop(1, `hsla(${h},90%,60%,0)`);
			x.fillStyle = g;
			x.beginPath(); x.moveTo(0, c.height);
			for (let px = 0; px <= c.width + 20; px += 20)
				x.lineTo(px, c.height * (0.4 + i * 0.06) + Math.sin(px * 0.003 + t * 2 + i * 1.7) * c.height * 0.12 + Math.sin(px * 0.011 - t * 3) * 16);
			x.lineTo(c.width, c.height); x.fill();
		}
		raf = requestAnimationFrame(loop);
	};
	loop();
	return () => { cancelAnimationFrame(raf); removeEventListener("resize", fit); };
}
const SAVER_EVS = ["mousemove", "keydown", "mousedown", "touchstart"];
async function startSaver() {
	if (saverOn) return;
	saverOn = true; sfx.open();
	const v = $("#sv"), cv = $("#cv");
	const b = await blob("get", "video").catch(() => null);
	if (b) {
		vidUrl = URL.createObjectURL(b);
		v.src = vidUrl; v.hidden = false; cv.hidden = true;
		v.play().catch(() => {});
	} else {
		v.hidden = true; cv.hidden = false;
		stopAurora = aurora(cv);
	}
	tick();
	$("#saver").hidden = false;
	document.documentElement.requestFullscreen?.().catch(() => {});
	setTimeout(() => { if (saverOn) for (const ev of SAVER_EVS) addEventListener(ev, stopSaver, { capture: true }); }, 700);
}
function stopSaver() {
	if (!saverOn) return;
	saverOn = false;
	$("#saver").hidden = true;
	$("#sv").pause(); $("#sv").removeAttribute("src");
	if (vidUrl) URL.revokeObjectURL(vidUrl);
	stopAurora?.(); stopAurora = null;
	if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
	for (const ev of SAVER_EVS) removeEventListener(ev, stopSaver, true);
	armIdle();
}

let idleT;
function armIdle() {
	clearTimeout(idleT);
	if (S.idle > 0 && !saverOn) idleT = setTimeout(startSaver, S.idle * 60000);
}
for (const ev of ["mousemove", "keydown", "mousedown"]) addEventListener(ev, () => !saverOn && armIdle(), { passive: true });

/* ---------- Boot ---------- */
(async () => {
	await load();
	applyTheme(); paintWall(); paintEng(); renderApps(); armIdle();
})();
