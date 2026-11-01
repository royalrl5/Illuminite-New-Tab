"use strict";
/* ---------- Desktop mode ---------- */
let osOn = false, osZ = 1, osN = 0, osStart = 0, activeWin = null, pendingPos = null;
const wins = new Map();
const selKeys = new Set();
const PAD = 14;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVG = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const GL = {
	notepad: '<path d="M7 3h8l4 4v14H7z"/><path d="M10 12h6M10 16h6"/>',
	calc: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/>',
	clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
	paint: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2.5 1.5-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
	tasks: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
	globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
	gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
};
const BUILTIN = [
	{ id: "notepad", name: "Notepad", g: "notepad", c: ["#ffd86b", "#ff9f43"], w: 520, h: 400 },
	{ id: "calc", name: "Calculator", g: "calc", c: ["#6be3d2", "#2a9d8f"], w: 320, h: 460 },
	{ id: "clock", name: "Clock", g: "clock", c: ["#a78bfa", "#6d4aff"], w: 340, h: 420 },
	{ id: "paint", name: "Paint", g: "paint", c: ["#ff7eb3", "#ff4f7b"], w: 760, h: 520 },
	{ id: "tasks", name: "Task Manager", g: "tasks", c: ["#7bd0ff", "#3584e4"], w: 460, h: 380 },
	{ id: "browser", name: "Browser", g: "globe", c: ["#4ade80", "#16a34a"], w: 900, h: 560 },
	{ id: "settings", name: "Settings", g: "gear", c: ["#9aa4b2", "#5b6676"], w: 880, h: 600 },
];
const gi = (b) => {
	const d = document.createElement("div");
	d.className = "gi";
	d.style.background = `linear-gradient(145deg,${b.c[0]},${b.c[1]})`;
	d.innerHTML = SVG(GL[b.g]);
	return d;
};
const allApps = () => [
	...BUILTIN.map((b) => ({ key: "b:" + b.id, b, name: b.name })),
	...apps.map((a) => ({ key: "a:" + a.id, a, name: a.name })),
];
const iconOf = (e) => (e.b ? gi(e.b) : icon(e.a));
function download(data, name) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(data); a.download = name; a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Skeleton ---------- */
const os = document.createElement("div");
os.id = "os"; os.hidden = true;
os.innerHTML = `
<div id="ds"></div>
<div id="marq" hidden></div>
<div id="wins"></div>
<div id="start" hidden>
	<div class="s-search">${SVG('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>')}<input id="ss" type="text" placeholder="Search for apps and shortcuts" autocomplete="off" aria-label="Search apps" /></div>
	<div class="s-body">
		<div class="s-h"><b id="s-ph">Pinned</b></div><div id="sg"></div>
		<div class="s-h" id="s-rh"><b>Recommended</b></div><div id="sr"></div>
	</div>
	<div class="s-foot"><div class="user"><img src="icons/favicon.svg" alt="" /><span>Illuminite</span></div>
		<div><button id="sf-set" title="Settings" aria-label="Settings">${SVG(GL.gear)}</button><button id="sf-pow" title="Power" aria-label="Power">${SVG('<path d="M12 3v8M6.5 6.8a8 8 0 1 0 11 0"/>')}</button></div></div>
</div>
<div id="task">
	<span></span>
	<div id="tg"><button id="sb" aria-label="Start menu"><img src="icons/favicon.svg" alt="" /></button><div id="tb"></div></div>
	<div id="tray">
		<button id="t-th" aria-label="Toggle theme" title="Toggle theme"></button>
		<button id="t-snd" aria-label="Sound" title="Sound"></button>
		<button id="t-clk" title="Open clock"><span id="tc"></span><span id="td"></span></button>
		<button id="t-sd" aria-label="Show desktop" title="Show desktop"></button>
	</div>
</div>
<div id="boot" hidden>
	<div class="orbs"><i></i><i></i><i></i></div>
	<img src="icons/favicon.svg" alt="" />
	<div class="bt">Desktop Mode</div>
	<div class="bp"><b></b></div>
</div>`;
document.body.append(os);

/* ---------- Windows ---------- */
const CAP = {
	max: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
	res: SVG('<rect x="6" y="9" width="9" height="9" rx="1.5"/><path d="M9 9V7.5A1.5 1.5 0 0 1 10.500 6H16.500A1.5 1.5 0 0 1 18 7.500V13.500A1.5 1.5 0 0 1 16.500 15H15"/>'),
};
function openWin({ key, title, ic, w = 560, h = 380, build }) {
	if (key && wins.has(key)) {
		const x = wins.get(key);
		if (x.min) toggleMin(x, false); else focusWin(x);
		return x;
	}
	const n = osN++, id = key || "w" + n;
	w = Math.min(w, innerWidth - 24); h = Math.min(h, innerHeight - 80);
	const el = document.createElement("div");
	el.className = "win";
	el.style.cssText = `width:${w}px;height:${h}px;left:${Math.max(8, Math.min(110 + (n % 7) * 30, innerWidth - w - 8))}px;top:${40 + (n % 7) * 26}px`;
	el.innerHTML = `<div class="wt"><span class="wi"></span><span class="wn"></span><div class="wb">
		<button data-a="min" aria-label="Minimize">${SVG('<path d="M7 12h10"/>')}</button>
		<button data-a="max" aria-label="Maximize">${CAP.max}</button>
		<button data-a="x" class="x" aria-label="Close">${SVG('<path d="M7 7l10 10M17 7 7 17"/>')}</button></div></div><div class="wc"></div>`;
	$(".wi", el).append(ic);
	$(".wn", el).textContent = title;
	const btn = document.createElement("button");
	btn.className = "tbtn"; btn.title = title;
	btn.append(ic.cloneNode(true));
	$("#tb").append(btn);
	const x = { id, el, title, btn, min: false, max: false, close: null };
	wins.set(id, x);

	$(".wb", el).onclick = (e) => {
		const a = e.target.closest("button")?.dataset.a;
		if (a === "min") toggleMin(x, true);
		else if (a === "max") toggleMax(x);
		else if (a === "x") closeWin(x);
	};
	btn.onclick = () => (x.min ? toggleMin(x, false) : activeWin === x ? toggleMin(x, true) : focusWin(x));
	el.addEventListener("pointerdown", () => focusWin(x), true);

	const wt = $(".wt", el);
	wt.ondblclick = (e) => { if (!e.target.closest("button")) toggleMax(x); };
	wt.onpointerdown = (e) => {
		if (e.button !== 0 || e.target.closest("button") || x.max) return;
		const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
		os.classList.add("dragging");
		wt.setPointerCapture(e.pointerId);
		const mv = (ev) => {
			el.style.left = Math.max(80 - r.width, Math.min(innerWidth - 80, ev.clientX - ox)) + "px";
			el.style.top = Math.max(0, Math.min(innerHeight - 100, ev.clientY - oy)) + "px";
		};
		const up = () => { os.classList.remove("dragging"); wt.removeEventListener("pointermove", mv); wt.removeEventListener("pointerup", up); };
		wt.addEventListener("pointermove", mv);
		wt.addEventListener("pointerup", up);
	};

	$("#wins").append(el);
	build($(".wc", el), x);
	requestAnimationFrame(() => el.classList.add("in"));
	focusWin(x);
	sfx.open();
	return x;
}
function focusWin(x) {
	activeWin = x;
	x.el.style.zIndex = ++osZ;
	wins.forEach((w) => { w.el.classList.toggle("active", w === x); w.btn.classList.toggle("on", w === x && !w.min); w.btn.classList.toggle("open", true); });
	closeStart();
}
function toggleMin(x, min) {
	x.min = min;
	x.el.classList.toggle("min", min);
	x.btn.classList.toggle("on", !min);
	if (min) { if (activeWin === x) activeWin = null; sfx.click(); } else focusWin(x);
}
function toggleMax(x) {
	x.max = !x.max;
	x.el.classList.toggle("max", x.max);
	$('[data-a="max"]', x.el).innerHTML = x.max ? CAP.res : CAP.max;
	sfx.click();
}
function closeWin(x, instant = false) {
	x.close?.();
	wins.delete(x.id);
	x.btn.remove();
	if (instant) x.el.remove();
	else { x.el.classList.remove("in"); x.el.classList.add("out"); setTimeout(() => x.el.remove(), 200); sfx.click(); }
	if (activeWin === x) {
		activeWin = null;
		const top = [...wins.values()].filter((w) => !w.min).sort((a, b) => a.el.style.zIndex - b.el.style.zIndex).pop();
		if (top && !instant) focusWin(top);
	}
}
let hidAll = [];
function showDesktop() {
	const open = [...wins.values()].filter((w) => !w.min);
	if (open.length) { hidAll = open; open.forEach((w) => toggleMin(w, true)); }
	else { hidAll.filter((w) => wins.has(w.id)).forEach((w) => toggleMin(w, false)); hidAll = []; }
}

/* ---------- Built-in apps ---------- */
function notepad(c) {
	c.innerHTML = `<div class="tool"><button>Save .txt</button><button>Clear</button><span class="dim"></span></div><textarea class="np" spellcheck="false" placeholder="Start typing. Everything saves automatically."></textarea>`;
	const [sv, cl] = c.querySelectorAll(".tool button"), ta = $("textarea", c), n = $(".dim", c);
	ta.value = S.notes || "";
	const upd = () => (n.textContent = ta.value.length + " characters");
	upd();
	let t;
	ta.oninput = () => { S.notes = ta.value; upd(); clearTimeout(t); t = setTimeout(save, 400); };
	sv.onclick = () => download(new Blob([ta.value], { type: "text/plain" }), "notes.txt");
	cl.onclick = () => { ta.value = ""; ta.oninput(); };
}
function calc(s) {
	const t = s.match(/\d*\.?\d+|[()+\-*/%]/g) || [];
	let i = 0;
	const ex = () => { let v = tm(); while (t[i] === "+" || t[i] === "-") { const o = t[i++], r = tm(); v = o === "+" ? v + r : v - r; } return v; };
	const tm = () => { let v = un(); while (t[i] === "*" || t[i] === "/") { const o = t[i++], r = un(); v = o === "*" ? v * r : v / r; } return v; };
	const un = () => { if (t[i] === "-") { i++; return -un(); } let v = pr(); while (t[i] === "%") { i++; v /= 100; } return v; };
	const pr = () => { const k = t[i++], n = parseFloat(k); if (isNaN(n)) throw 0; return n; };
	const r = ex();
	if (i < t.length) throw 0;
	return r;
}
function calcApp(c) {
	c.innerHTML = `<div class="cd"><div class="ce"></div><div class="cr">0</div></div><div class="ck"></div>`;
	const keys = ["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];
	const ce = $(".ce", c), cr = $(".cr", c);
	let ex = "";
	const show = (v) => (cr.textContent = v || "0");
	for (const k of keys) {
		const b = document.createElement("button");
		b.textContent = k;
		if ("÷×−+%".includes(k)) b.className = "op";
		if (k === "=") b.className = "eq";
		if (k === "0") b.className = "z";
		b.onclick = () => {
			sfx.click();
			if (k === "C") { ex = ""; ce.textContent = ""; }
			else if (k === "⌫") ex = ex.slice(0, -1);
			else if (k === "=") {
				try {
					const r = calc(ex.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-"));
					ce.textContent = ex + " =";
					ex = isFinite(r) ? String(+r.toFixed(10)) : "";
					if (!isFinite(r)) { show("Error"); return; }
				} catch { ex = ""; show("Error"); return; }
			} else ex += k;
			show(ex);
		};
		$(".ck", c).append(b);
	}
}
function clockApp(c, x) {
	let ticks = "";
	for (let i = 0; i < 12; i++) ticks += `<line class="tk" y1="-42" y2="${i % 3 ? -39 : -36}" transform="rotate(${i * 30})"/>`;
	c.innerHTML = `<div class="clk"><svg viewBox="-50 -50 100 100"><circle r="47" class="face"/>${ticks}<line class="hh" y2="-22"/><line class="mh" y2="-34"/><line class="sh" y2="-38"/><circle r="2.5" class="pin"/></svg><div class="dt"></div><div class="dd"></div></div>`;
	const hh = $(".hh", c), mh = $(".mh", c), sh = $(".sh", c);
	const upd = () => {
		const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
		hh.setAttribute("transform", `rotate(${h * 30})`);
		mh.setAttribute("transform", `rotate(${m * 6})`);
		sh.setAttribute("transform", `rotate(${s * 6})`);
		$(".dt", c).textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: !S.clock24 });
		$(".dd", c).textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
	};
	upd();
	const t = setInterval(upd, 250);
	x.close = () => clearInterval(t);
}
function paintApp(c) {
	c.innerHTML = `<div class="tool"><input type="color" value="#ff4f7b" aria-label="Color" /><input type="range" min="1" max="48" value="8" aria-label="Brush size" /><button class="on">Brush</button><button>Eraser</button><button>Clear</button><button>Save PNG</button></div><div class="pc"><canvas width="1000" height="640"></canvas></div>`;
	const cv = $("canvas", c), g = cv.getContext("2d");
	const col = $('input[type="color"]', c), size = $('input[type="range"]', c);
	const [bb, eb, cb, sb] = c.querySelectorAll(".tool button");
	let erase = false, last = null;
	g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
	g.lineCap = g.lineJoin = "round";
	const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
	cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); last = pos(e); stroke(last, last); };
	cv.onpointermove = (e) => { if (!last) return; const p = pos(e); stroke(last, p); last = p; };
	cv.onpointerup = cv.onpointercancel = () => (last = null);
	const stroke = (a, b) => {
		g.strokeStyle = erase ? "#fff" : col.value;
		g.lineWidth = +size.value;
		g.beginPath(); g.moveTo(...a); g.lineTo(b[0] + 0.01, b[1]); g.stroke();
	};
	const tool = (er) => { erase = er; bb.classList.toggle("on", !er); eb.classList.toggle("on", er); sfx.click(); };
	bb.onclick = () => tool(false);
	eb.onclick = () => tool(true);
	cb.onclick = () => { g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); sfx.del(); };
	sb.onclick = () => cv.toBlob((b) => download(b, "painting.png"));
}
function tasksApp(c, x) {
	c.innerHTML = `<div class="tm"><div class="dim sum"></div><div class="list"></div></div>`;
	let sig = "";
	const draw = () => {
		const list = [...wins.values()];
		const up = Math.floor((Date.now() - osStart) / 1000);
		const mem = performance.memory ? ` · ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB memory` : "";
		$(".sum", c).textContent = `${list.length} open · up ${Math.floor(up / 60)}m ${String(up % 60).padStart(2, "0")}s${mem}`;
		const s = list.map((w) => w.id + w.min).join();
		if (s === sig) return;
		sig = s;
		const box = $(".list", c);
		box.replaceChildren();
		for (const w of list) {
			const r = document.createElement("div");
			r.className = "tr";
			r.innerHTML = "<b></b><span class='dim'></span><button>End task</button>";
			$("b", r).textContent = w.title;
			$("span", r).textContent = w.min ? "Minimized" : "Running";
			$("button", r).onclick = () => { closeWin(w); sig = ""; };
			box.append(r);
		}
	};
	draw();
	const t = setInterval(draw, 1000);
	x.close = () => clearInterval(t);
}
const frameTools = (input) =>
	`<div class="tool"><button data-a="r" title="Reload">${SVG('<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5"/>')}</button><input type="text" ${input} /><button data-a="w" title="Open in new window">${SVG('<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>')}</button></div>`;
function webApp(a) {
	openWin({
		key: "app" + a.id, title: a.name, ic: icon(a), w: 900, h: 560,
		build(c) {
			c.innerHTML = frameTools("readonly") + `<iframe allow="fullscreen" referrerpolicy="no-referrer"></iframe><div class="hint">Blank page? Some sites don't allow being shown inside a window. <button>Open in new window</button></div>`;
			const f = $("iframe", c);
			$(".tool input", c).value = a.url;
			f.src = a.url;
			$('[data-a="r"]', c).onclick = () => { f.src = a.url; };
			$('[data-a="w"]', c).onclick = $(".hint button", c).onclick = () => openWindow(a.url);
		},
	});
}
function browserApp(c) {
	c.innerHTML = frameTools('placeholder="Search or enter an address"') + `<iframe hidden allow="fullscreen" referrerpolicy="no-referrer"></iframe><div class="empty">Type an address or a search above.</div><div class="hint">Blank page? Some sites don't allow being shown inside a window. <button>Open in new window</button></div>`;
	const f = $("iframe", c), inp = $(".tool input", c);
	inp.onkeydown = (e) => {
		if (e.key !== "Enter" || !inp.value.trim()) return;
		const v = inp.value.trim();
		const direct = !/\s/.test(v) && /\.[a-z]{2,}(\/|$)/i.test(v) ? normUrl(v) : null;
		const url = direct ?? ENGINES[S.engine][1] + encodeURIComponent(v);
		f.dataset.url = url; f.src = url; f.hidden = false; $(".empty", c).hidden = true; inp.value = url; sfx.click();
	};
	$('[data-a="r"]', c).onclick = () => f.dataset.url && (f.src = f.dataset.url);
	$('[data-a="w"]', c).onclick = $(".hint button", c).onclick = () => openWindow(f.dataset.url || ENGINES[S.engine][1].split("?")[0]);
	inp.focus();
}
const BUILD = { notepad, calc: calcApp, clock: clockApp, paint: paintApp, tasks: tasksApp, browser: browserApp };
function launch(e) {
	S.recent = [e.key, ...(S.recent || []).filter((k) => k !== e.key)].slice(0, 6);
	save();
	if (e.a) return webApp(e.a);
	if (e.b.id === "settings") return openSettingsApp();
	openWin({ key: e.b.id, title: e.b.name, ic: gi(e.b), w: e.b.w, h: e.b.h, build: BUILD[e.b.id] });
}

/* ---------- Desktop icons: free placement, snapping, selection ---------- */
const dims = () => ({ s: [88, 96, 40], m: [100, 112, 52], l: [112, 128, 66] }[S.iconSize] || [100, 112, 52]);
const gridSize = () => { const [cw, ch] = dims(), ds = $("#ds"); return { cols: Math.max(1, Math.floor((ds.clientWidth - PAD) / cw)), rows: Math.max(1, Math.floor((ds.clientHeight - PAD) / ch)) }; };
const cellOf = (x, y) => { const [cw, ch] = dims(); return [Math.max(0, Math.round((x - PAD) / cw)), Math.max(0, Math.round((y - PAD) / ch))]; };
const cellXY = (c, r) => { const [cw, ch] = dims(); return { x: PAD + c * cw, y: PAD + r * ch }; };
function freeCell(x, y, taken) {
	const { cols, rows } = gridSize();
	let [c, r] = cellOf(x, y);
	c = Math.min(c, cols - 1); r = Math.min(r, rows - 1);
	for (let d = 0; d <= cols + rows; d++)
		for (let dc = -d; dc <= d; dc++)
			for (let dr = -d; dr <= d; dr++) {
				if (Math.max(Math.abs(dc), Math.abs(dr)) !== d) continue;
				const cc = c + dc, rr = r + dr;
				if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || taken.has(cc + "," + rr)) continue;
				taken.add(cc + "," + rr);
				return cellXY(cc, rr);
			}
	return { x, y };
}
const iconEl = (key) => $$(".di").find((d) => d.dataset.key === key);
function placeIcon(key, p) {
	S.pos[key] = p;
	const el = iconEl(key);
	if (el) { el.style.left = p.x + "px"; el.style.top = p.y + "px"; }
}
function buildIcons() {
	const ds = $("#ds");
	ds.replaceChildren();
	S.pos ||= {};
	const list = allApps();
	for (const k of Object.keys(S.pos)) if (!list.some((e) => e.key === k)) delete S.pos[k];
	const taken = new Set(list.filter((e) => S.pos[e.key]).map((e) => cellOf(S.pos[e.key].x, S.pos[e.key].y).join()));
	const { cols, rows } = gridSize();
	let n = 0;
	list.forEach((e, i) => {
		if (!S.pos[e.key]) {
			if (pendingPos) { S.pos[e.key] = freeCell(pendingPos.x, pendingPos.y, taken); pendingPos = null; }
			else { let c, r; do { c = Math.floor(n / rows); r = n % rows; n++; } while (taken.has(c + "," + r) && c < cols + 40); taken.add(c + "," + r); S.pos[e.key] = cellXY(c, r); }
		}
		const p = S.pos[e.key];
		const b = document.createElement("button");
		b.className = "di"; b.dataset.key = e.key; b.style.setProperty("--i", i);
		b.style.left = Math.min(p.x, Math.max(0, ds.clientWidth - 90)) + "px";
		b.style.top = Math.min(p.y, Math.max(0, ds.clientHeight - 90)) + "px";
		const s = document.createElement("span");
		s.textContent = e.name;
		b.append(iconOf(e), s);
		b.title = e.name;
		b.onpointerdown = (ev) => iconDown(ev, b, e);
		b.ondblclick = () => !S.singleClick && launch(e);
		b.onkeydown = (ev) => { if (ev.key === "Enter") launch(e); };
		b.oncontextmenu = (ev) => { ev.preventDefault(); ev.stopPropagation(); iconMenu(ev, e); };
		ds.append(b);
	});
	save();
	paintSel();
}
globalThis.onAppsChanged = () => { if (osOn) buildIcons(); };
function paintSel() { $$(".di").forEach((d) => d.classList.toggle("sel", selKeys.has(d.dataset.key))); }

function iconDown(ev, b, e) {
	if (ev.button !== 0) return;
	const was = selKeys.has(e.key), multi = ev.ctrlKey || ev.metaKey || ev.shiftKey;
	if (multi) { was ? selKeys.delete(e.key) : selKeys.add(e.key); paintSel(); if (was) return; }
	else if (!was) { selKeys.clear(); selKeys.add(e.key); paintSel(); }
	const keys = [...selKeys];
	const start = new Map(keys.map((k) => { const el = iconEl(k); return [k, { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }]; }));
	const sx = ev.clientX, sy = ev.clientY;
	let dragging = false;
	const ds = $("#ds"), maxX = ds.clientWidth - 90, maxY = ds.clientHeight - 90;
	const mv = (m) => {
		const dx = m.clientX - sx, dy = m.clientY - sy;
		if (!dragging && Math.hypot(dx, dy) < 5) return;
		dragging = true;
		for (const k of keys) { const el = iconEl(k), s = start.get(k); el.classList.add("moving"); el.style.left = Math.max(0, Math.min(maxX, s.x + dx)) + "px"; el.style.top = Math.max(0, Math.min(maxY, s.y + dy)) + "px"; }
	};
	const up = () => {
		removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
		if (!dragging) {
			if (!multi && was && keys.length > 1) { selKeys.clear(); selKeys.add(e.key); paintSel(); }
			if (S.singleClick && !multi) launch(e);
			return;
		}
		const taken = new Set($$(".di").filter((d) => !selKeys.has(d.dataset.key)).map((d) => cellOf(parseFloat(d.style.left), parseFloat(d.style.top)).join()));
		for (const k of keys) {
			const el = iconEl(k);
			el.classList.remove("moving");
			let p = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
			if (S.snap) p = freeCell(p.x, p.y, taken);
			el.classList.add("settle");
			placeIcon(k, p);
			setTimeout(() => el.classList.remove("settle"), 220);
		}
		save(); sfx.drop();
	};
	addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
function alignIcons() {
	const items = $$(".di").map((d) => ({ k: d.dataset.key, x: parseFloat(d.style.left), y: parseFloat(d.style.top) })).sort((a, b) => a.x - b.x || a.y - b.y);
	const taken = new Set();
	for (const it of items) placeIcon(it.k, freeCell(it.x, it.y, taken));
	save(); sfx.click();
}
function resetIcons() { S.pos = {}; buildIcons(); sfx.click(); toast("Icon layout reset"); }

/* Drag a box on the desktop to select several icons */
os.addEventListener("pointerdown", (ev) => {
	if (ev.button !== 0 || !(ev.target.id === "ds" || ev.target === os)) return;
	const add = ev.ctrlKey || ev.metaKey || ev.shiftKey, base = new Set(add ? selKeys : []);
	const m = $("#marq"), sx = ev.clientX, sy = ev.clientY;
	let moved = false;
	const mv = (e) => {
		if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 4) return;
		moved = true;
		const l = Math.min(sx, e.clientX), t = Math.min(sy, e.clientY), w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
		m.hidden = false;
		m.style.cssText = `left:${l}px;top:${t}px;width:${w}px;height:${h}px`;
		selKeys.clear();
		base.forEach((k) => selKeys.add(k));
		for (const d of $$(".di")) { const r = d.getBoundingClientRect(); if (r.left < l + w && r.right > l && r.top < t + h && r.bottom > t) selKeys.add(d.dataset.key); }
		paintSel();
	};
	const up = () => {
		removeEventListener("pointermove", mv); removeEventListener("pointerup", up);
		m.hidden = true;
		if (!moved && !add) { selKeys.clear(); paintSel(); }
	};
	addEventListener("pointermove", mv); addEventListener("pointerup", up);
	ev.preventDefault();
});
const selEntries = () => allApps().filter((e) => selKeys.has(e.key));
function removeShortcuts(list) {
	const ids = new Set(list.filter((e) => e.a).map((e) => e.a.id));
	if (!ids.size) return;
	for (const id of ids) wins.get("app" + id) && closeWin(wins.get("app" + id), true);
	apps = apps.filter((a) => !ids.has(a.id));
	selKeys.clear(); save(); renderApps(); buildIcons(); sfx.del();
	toast(ids.size === 1 ? "Shortcut removed" : `${ids.size} shortcuts removed`);
}
function iconMenu(ev, e) {
	if (!selKeys.has(e.key)) { selKeys.clear(); selKeys.add(e.key); paintSel(); }
	const list = selEntries(), webs = list.filter((x) => x.a);
	if (list.length === 1) {
		const items = [["Open", () => launch(e)]];
		if (e.a) items.push(["Open in new window", () => { sfx.open(); openWindow(e.a.url); }], ["Open in new tab", () => { sfx.open(); openTab(e.a.url); }], "-", ["Rename", () => appDialog("rename", e.a)], ["Edit link", () => appDialog("edit", e.a)], "-", ["Remove shortcut", () => removeShortcuts(list), "danger"]);
		return showMenu(ev.clientX, ev.clientY, items);
	}
	const items = [[`Open ${list.length} items`, () => list.forEach(launch)]];
	if (webs.length) items.push([`Open ${webs.length} in new windows`, () => webs.forEach((x) => openWindow(x.a.url))], [`Open ${webs.length} in new tabs`, () => webs.forEach((x) => openTab(x.a.url))]);
	items.push(["Align to grid", alignIcons]);
	if (webs.length) items.push("-", [`Remove ${webs.length} shortcut${webs.length > 1 ? "s" : ""}`, () => removeShortcuts(list), "danger"]);
	showMenu(ev.clientX, ev.clientY, items);
}
addEventListener("keydown", (e) => {
	if (!osOn || e.target.closest?.("input, textarea, select, dialog")) return;
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !e.target.closest?.(".win")) { e.preventDefault(); allApps().forEach((x) => selKeys.add(x.key)); paintSel(); }
	else if (e.key === "Delete" && selKeys.size) removeShortcuts(selEntries());
	else if (e.key === "F2" && selEntries().length === 1 && selEntries()[0].a) appDialog("rename", selEntries()[0].a);
});

/* ---------- Start menu and taskbar ---------- */
function tile(e, row) {
	const b = document.createElement("button");
	b.className = row ? "srow" : "stile";
	const s = document.createElement("span");
	s.textContent = e.name;
	b.append(iconOf(e), s);
	b.onclick = () => { closeStart(); launch(e); };
	return b;
}
function buildStart(q = "") {
	const g = $("#sg"), r = $("#sr"), all = allApps();
	g.replaceChildren(); r.replaceChildren();
	const f = q.trim().toLowerCase();
	const items = f ? all.filter((e) => e.name.toLowerCase().includes(f)) : all;
	g.className = f ? "rows" : "grid";
	$("#s-ph").textContent = f ? "Best match" : "Pinned";
	items.forEach((e) => g.append(tile(e, !!f)));
	if (f && !items.length) g.innerHTML = '<p class="dim">No apps found</p>';
	const rec = (S.recent || []).map((k) => all.find((e) => e.key === k)).filter(Boolean);
	$("#s-rh").hidden = r.hidden = !!f || !rec.length;
	rec.forEach((e) => r.append(tile(e, true)));
	return items;
}
function openStart() { $("#ss").value = ""; buildStart(); $("#start").hidden = false; $("#ss").focus(); sfx.click(); }
function closeStart() { $("#start").hidden = true; }
$("#sb").onclick = () => ($("#start").hidden ? openStart() : closeStart());
$("#ss").oninput = (e) => buildStart(e.target.value);
$("#ss").onkeydown = (e) => { if (e.key === "Enter") { const f = buildStart(e.target.value)[0]; if (f) { closeStart(); launch(f); } } };
os.addEventListener("pointerdown", (e) => { if (!e.target.closest("#start,#sb")) closeStart(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && osOn) closeStart(); });
$("#sf-set").onclick = () => { closeStart(); openSettingsApp(); };
$("#sf-pow").onclick = (e) => {
	e.stopPropagation();
	const r = e.currentTarget.getBoundingClientRect();
	showMenu(r.left - 150, r.top - 120, [["Start screensaver", () => { closeStart(); startSaver(); }], ["Exit desktop mode", exitDesktop]]);
};
$("#t-clk").onclick = () => launch({ key: "b:clock", b: BUILTIN[2] });
$("#t-sd").onclick = showDesktop;

const SUN = SVG('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>');
const MOON = SVG('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>');
const VOL = SVG('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.500 8.500a5 5 0 0 1 0 7"/>');
const MUTE = SVG('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 4 6m0-6-4 6"/>');
const paintTray = () => { $("#t-th").innerHTML = effTheme() === "dark" ? MOON : SUN; $("#t-snd").innerHTML = S.sound ? VOL : MUTE; };
$("#t-th").onclick = () => { toggleTheme(); paintTray(); };
$("#t-snd").onclick = () => { S.sound = !S.sound; save(); paintTray(); sfx.click(); };
function tickTray() {
	const d = new Date();
	$("#tc").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: S.seconds ? "2-digit" : undefined, hour12: !S.clock24 });
	$("#td").textContent = d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" });
	$("#td").hidden = !S.showDate;
}
setInterval(() => osOn && tickTray(), 1000);

os.addEventListener("contextmenu", (e) => {
	if (e.target.closest(".wc textarea, .wc input")) { e.stopPropagation(); return; }
	e.preventDefault(); e.stopPropagation();
	if (e.target.closest(".win, #task, #start")) return;
	const { x, y } = { x: e.clientX, y: e.clientY - 0 };
	showMenu(x, y, [
		["New shortcut", () => { pendingPos = { x: x - 40, y: y - 34 }; appDialog("add"); }],
		["Select all", () => { allApps().forEach((a) => selKeys.add(a.key)); paintSel(); }],
		["Align icons to grid", alignIcons],
		"-",
		["Personalize", () => openSettingsApp("personalization")],
		["Mouse settings", () => openSettingsApp("mouse")],
		[effTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme", () => { toggleTheme(); paintTray(); }],
		["Start screensaver", startSaver],
		"-",
		["Exit desktop mode", exitDesktop],
	]);
});
$("#dlg").addEventListener("close", () => setTimeout(() => (pendingPos = null), 0));

/* ---------- Boot sound: a swell, a rising shimmer, then a bell arpeggio into a warm chord ---------- */
function bootSound() {
	if (!S.sound || S.bootSound === false || S.vol <= 0) return;
	ac ??= new AudioContext();
	ac.resume?.();
	const t0 = ac.currentTime + 0.05;
	const master = ac.createGain();
	master.gain.value = 0.55 * (S.vol / 100);
	const d = ac.createDelay(), fb = ac.createGain(), wet = ac.createGain();
	d.delayTime.value = 0.27; fb.gain.value = 0.4; wet.gain.value = 0.45;
	d.connect(fb).connect(d);
	master.connect(d); d.connect(wet).connect(ac.destination); master.connect(ac.destination);
	const note = (f, t, dur, type, vol, att = 0.02) => {
		const o = ac.createOscillator(), g = ac.createGain();
		o.type = type; o.frequency.setValueAtTime(f, t0 + t);
		g.gain.setValueAtTime(0.0001, t0 + t);
		g.gain.exponentialRampToValueAtTime(vol, t0 + t + att);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + dur);
		o.connect(g).connect(master);
		o.start(t0 + t); o.stop(t0 + t + dur + 0.05);
	};
	[73.4, 110, 146.8].forEach((f) => note(f, 0, 2.8, "sine", 0.13, 0.9));
	const sw = ac.createOscillator(), sg = ac.createGain(), lp = ac.createBiquadFilter();
	sw.type = "sawtooth";
	sw.frequency.setValueAtTime(110, t0); sw.frequency.exponentialRampToValueAtTime(880, t0 + 1.2);
	lp.type = "lowpass";
	lp.frequency.setValueAtTime(300, t0); lp.frequency.exponentialRampToValueAtTime(5000, t0 + 1.2);
	sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.05, t0 + 0.8); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
	sw.connect(lp).connect(sg).connect(master);
	sw.start(t0); sw.stop(t0 + 1.6);
	[587.3, 740, 880, 987.8, 1174.7, 1480].forEach((f, i) => { note(f, 1.0 + i * 0.11, 1.6, "sine", 0.09); note(f * 2, 1.0 + i * 0.11, 0.8, "triangle", 0.02); });
	[293.7, 370, 440, 554.4, 659.3].forEach((f) => note(f, 1.9, 2.8, "triangle", 0.07, 0.05));
}

/* ---------- Enter and exit ---------- */
let bootT;
function enterDesktop() {
	if (osOn) return;
	osOn = true; osStart = Date.now();
	hideMenu();
	document.body.classList.add("os-mode");
	document.title = "New Tab (Desktop Mode)";
	os.hidden = false; os.classList.remove("ready");
	applyLook(); selKeys.clear();
	buildIcons(); tickTray(); paintTray();
	const b = $("#boot");
	b.hidden = false; b.classList.remove("out", "run");
	void b.offsetWidth;
	b.classList.add("run");
	bootSound();
	clearTimeout(bootT);
	bootT = setTimeout(() => {
		if (!osOn) return;
		os.classList.add("ready");
		b.classList.add("out");
		setTimeout(() => { b.hidden = true; }, 750);
	}, 2700);
}
function exitDesktop() {
	if (!osOn) return;
	osOn = false;
	clearTimeout(bootT);
	[...wins.values()].forEach((w) => closeWin(w, true));
	closeStart();
	os.hidden = true; os.classList.remove("ready");
	$("#boot").hidden = true;
	document.body.classList.remove("os-mode");
	document.title = "New Tab";
	tone(660, 0.12, "sine", 0.05); tone(440, 0.18, "sine", 0.05, 0.1); tone(330, 0.26, "sine", 0.04, 0.2);
}
$("#corner").onclick = () => enterDesktop();
