/**
 * robot-face.js — "solo occhi" robot face engine. Zero dependencies, framework-agnostic ES module.
 *
 *   import { createRobotFace, EXPRESSIONS, staticSVG } from './robot-face.js';
 *   const face = createRobotFace(document.getElementById('face'), { color: '#FAF6EF' });
 *   face.setExpression('happy');      // morphs (never fades) to the new expression
 *   face.setMode('talking');          // 'idle' | 'talking' | 'listening'
 *   face.setSpeechLevel(0.7);         // optional: drive talking from real audio (0–1). Omit → procedural syllables
 *   face.blink(); face.destroy();
 *
 * Coordinate system: viewBox 0 0 100 100. Each eye is ONE closed polygon with a fixed number of points (N),
 * so every transition is a pure point-to-point interpolation (shape morph), including glyph eyes (heart / x / chevron).
 */

// ——— Expressions ——————————————————————————————————————————————————————————————
// Eye params: dx/dy gaze offset, w/h size, r corner radius, lt top lid (0–1), tilt (+ = inner side lower → angry,
// − = inner side higher → sad), lb bottom lid (0–1), bc bottom-lid curvature (+ = happy arch). glyph: 'heart'|'x'|'chev'.
const EYE0 = { dx: 0, dy: 0, w: 16, h: 22, r: 6, lt: 0, tilt: 0, lb: 0, bc: 0 };
const X = (e, extra = {}) => ({ L: { ...EYE0, ...e, ...(extra.L || {}) }, R: { ...EYE0, ...e, ...(extra.R || {}) }, glyph: extra.glyph || null });

export const EXPRESSIONS = [
  { id: 'neutral', label: 'Neutro', pose: X({}) },
  { id: 'happy', label: 'Felice', pose: X({ lb: 0.3, bc: 6 }) },
  { id: 'laugh', label: 'Risata', pose: X({ lb: 0.5, bc: 9, dy: -2 }) },
  { id: 'excited', label: 'Emozionato', pose: X({ w: 18, h: 24, lb: 0.2, bc: 5, dy: -2 }) },
  { id: 'sad', label: 'Triste', pose: X({ lt: 0.22, tilt: -7, dy: 3, h: 20 }) },
  { id: 'worried', label: 'Preoccupato', pose: X({ w: 14, h: 24, lt: 0.35, tilt: -9, lb: 0.1, dy: -1 }) },
  { id: 'angry', label: 'Arrabbiato', pose: X({ lt: 0.2, tilt: 9 }) },
  { id: 'determined', label: 'Determinato', pose: X({ lt: 0.3, tilt: 3, lb: 0.15 }) },
  { id: 'shocked', label: 'Scioccato', pose: X({ w: 20, h: 28, r: 8 }) },
  { id: 'surprised', label: 'Sorpreso', pose: X({ w: 18, h: 18, r: 9 }) },
  { id: 'in-love', label: 'Innamorato', pose: X({}, { glyph: 'heart' }) },
  { id: 'ko', label: 'KO', pose: X({}, { glyph: 'x' }) },
  { id: 'amused', label: 'Divertito', pose: X({}, { glyph: 'chev' }) },
  { id: 'serene', label: 'Sereno', pose: X({ lt: 0.35, lb: 0.25, bc: 4 }) },
  { id: 'sleepy', label: 'Assonnato', pose: X({ lt: 0.7, dy: 3 }) },
  { id: 'bored', label: 'Annoiato', pose: X({ lt: 0.5, h: 20 }) },
  { id: 'skeptical', label: 'Scettico', pose: X({}, { L: { lt: 0.45 }, R: { lt: 0.05, h: 24 } }) },
  { id: 'wink', label: 'Occhiolino', pose: X({}, { R: { lb: 0.45, bc: 8 } }) },
  { id: 'sly', label: 'Furbo', pose: X({ dx: 5, lb: 0.22, bc: 0 }, { L: { lt: 0.5, tilt: -2 }, R: { lt: 0.36, tilt: -2 } }) },
  { id: 'nervous', label: 'Nervoso', pose: X({ w: 14, h: 18, lt: 0.2, tilt: 3, dx: -5 }) },
  { id: 'thinking', label: 'Pensante', pose: X({ w: 13, h: 17, r: 6, dx: 8, dy: -9, lb: 0.15 }) },
  { id: 'shy', label: 'Timido', pose: X({ w: 14, h: 18, dx: -4, dy: 5, lb: 0.2, bc: 4 }) },
  { id: 'listening', label: 'Ascolto', pose: X({ w: 10, h: 14, r: 5, dx: -2 }) },
  { id: 'confused', label: 'Confuso', pose: X({}, { L: { w: 14, h: 14, r: 7 }, R: { w: 16, h: 24 } }) },
];
const IDX = Object.fromEntries(EXPRESSIONS.map((e, i) => [e.id, i]));

// ——— Geometry ——————————————————————————————————————————————————————————————————
const N = 72, S = 1.35;
function resample(poly, n) {
  const seg = []; let tot = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); tot += l; }
  const out = []; let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * tot;
    while (acc + seg[i] < target && i < seg.length - 1) { acc += seg[i]; i++; }
    const a = poly[i], b = poly[(i + 1) % poly.length], t = seg[i] ? (target - acc) / seg[i] : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
// rotate so point 0 is "top-centre" → consistent correspondence between different shapes
function align(pts, cx) {
  let best = 0, bv = Infinity;
  pts.forEach((p, i) => { const v = Math.abs(p[0] - cx) * 3 + p[1]; if (v < bv) { bv = v; best = i; } });
  return pts.slice(best).concat(pts.slice(0, best));
}
function rrPoly(cx, cy, w, h, r) {
  r = Math.min(r, w / 2, h / 2); const p = [], x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  const corner = (ox, oy, a0) => { for (let j = 0; j <= 8; j++) { const a = a0 + (j / 8) * Math.PI / 2; p.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]); } };
  corner(x1 - r, y0 + r, -Math.PI / 2); corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI);
  return p;
}
// eye with a bottom lid: top corners like the rounded rect, bottom edge = circular arc (or flat), rounded tips
function archPoly(cx, top, x0, x1, yb, bc, r, tipR = 2.4) {
  const hgt = yb - top; r = Math.min(r, (x1 - x0) / 2, hgt / 2);
  const rt = Math.min(tipR * S, hgt / 2), p = [];
  const arcPts = (ox, oy, rad, a0, a1, n = 10) => { for (let j = 0; j <= n; j++) { const a = a0 + (a1 - a0) * j / n; p.push([ox + rad * Math.cos(a), oy + rad * Math.sin(a)]); } };
  arcPts(x1 - r, top + r, r, -Math.PI / 2, 0);
  arcPts(x1 - rt, yb - rt, rt, 0, Math.PI / 2);
  const c = x1 - x0 - 2 * rt;
  bc = Math.min(bc, c * 0.3);
  if (bc > 0.01 && c > 0) {
    const R = (c * c / 4 + bc * bc) / (2 * bc), oy = yb - bc + R;
    for (let j = 1; j < 30; j++) { const x = x1 - rt - c * j / 30, dx = x - cx; p.push([x, oy - Math.sqrt(Math.max(0, R * R - dx * dx))]); }
  }
  arcPts(x0 + rt, yb - rt, rt, Math.PI / 2, Math.PI);
  arcPts(x0 + r, top + r, r, Math.PI, Math.PI * 1.5);
  return p;
}
// fillet every vertex with its own radius (quadratic) → same corner language as the rest
function roundPoly(verts, radii) {
  const out = [], n = verts.length;
  for (let i = 0; i < n; i++) {
    const v = verts[i], p = verts[(i - 1 + n) % n], q = verts[(i + 1) % n];
    const l1 = Math.hypot(p[0] - v[0], p[1] - v[1]), l2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const t = Math.min(radii[i], l1 * 0.48, l2 * 0.48);
    const a = [v[0] + (p[0] - v[0]) / l1 * t, v[1] + (p[1] - v[1]) / l1 * t], b = [v[0] + (q[0] - v[0]) / l2 * t, v[1] + (q[1] - v[1]) / l2 * t];
    for (let j = 0; j <= 8; j++) { const s = j / 8, m = 1 - s; out.push([m * m * a[0] + 2 * m * s * v[0] + s * s * b[0], m * m * a[1] + 2 * m * s * v[1] + s * s * b[1]]); }
  }
  return out;
}
// heart = two 45° capsules joined at the bottom (parallel sides only)
function heartPoly(cx, cy, k) {
  const h = 4.1, d = 5.6, yb = 2.4, r2 = Math.SQRT2, V = [], R = [];
  const add = (x, y, r = 0) => { V.push([cx + x * k, cy + y * k]); R.push(r * k); };
  const cap = (ex, ey, a0) => { for (let j = 1; j < 12; j++) { const a = a0 + Math.PI * j / 12; add(ex + h * Math.cos(a), ey + h * Math.sin(a)); } };
  add(0, yb - h * r2, 1.4);
  add(d - h / r2, yb - d - h / r2); cap(d, yb - d, -3 * Math.PI / 4); add(d + h / r2, yb - d + h / r2);
  add(0, yb + h * r2, 2.6);
  add(-d - h / r2, yb - d + h / r2); cap(-d, yb - d, 3 * Math.PI / 4 - Math.PI / 4 + Math.PI / 4); add(-d + h / r2, yb - d - h / r2);
  return roundPoly(V, R);
}
function xPoly(cx, cy, s, t) {
  const a = t / 2, P = [[a, 0], [s, s - a], [s - a, s], [0, a], [-s + a, s], [-s, s - a], [-a, 0], [-s, -s + a], [-s + a, -s], [0, -a], [s - a, -s], [s, -s + a]];
  const k = P.findIndex(q => q[0] === 0 && q[1] < 0);
  return P.slice(k).concat(P.slice(0, k)).map(([x, y]) => [cx + x, cy + y]);
}
function chevPoly(cx, cy, dir, k) {
  const p = [[-2.2, -11.3], [9.1, 0], [-2.2, 11.3], [-6.8, 6.7], [-0.1, 0], [-6.8, -6.7]].map(([x, y]) => [cx + x * k * dir, cy + y * k]);
  return dir > 0 ? p : p.reverse();
}
// happyShape: 'arc' (curved bottom lid) | 'sharp-arc' (curved, near-square tips) | 'flat' (straight bottom lid)
function eyeGeo(e, bx, dir, glyph, st) {
  const cx = 50 + (bx + e.dx - 50) * S, cy = 50 + e.dy * S, w = e.w * S, hh = e.h * S;
  let raw;
  if (glyph === 'heart') raw = heartPoly(cx, cy, S);
  else if (glyph === 'x') { const V = xPoly(cx, cy, 9 * S, 6.5 * S); raw = roundPoly(V, V.map((_, i) => (i % 3 === 0 ? 1.2 : 2.4) * S)); }
  else if (glyph === 'chev') { const V = chevPoly(cx, cy, dir, S); raw = roundPoly(V, (dir > 0 ? [2, 3, 2, 2, 1.2, 2] : [2, 1.2, 2, 2, 3, 2]).map(r => r * S)); }
  const top = cy - hh / 2, bot = cy + hh / 2, yl = top + e.lt * hh, tilt = e.tilt * S;
  const yA = dir > 0 ? yl : yl + tilt, yB = dir > 0 ? yl + tilt : yl, x0 = cx - w / 2;
  if (!glyph) {
    const yb = bot - e.lb * hh, bc = st === 'flat' ? 0 : Math.max(0, Math.min(e.bc * S, yb - Math.max(yA, yB) - 6 * S));
    raw = e.lb > 0 ? archPoly(cx, top, x0, x0 + w, yb, bc, e.r * S, st === 'sharp-arc' ? 0.7 : 2.4) : rrPoly(cx, cy, w, hh, e.r * S);
  }
  let pts = align(resample(raw, N), cx);
  if (!glyph) pts = pts.map(([x, y]) => [x, Math.max(y, yA + (yB - yA) * (x - x0) / w)]); // top lid = constraint on the outline
  return { cx, cy, pts };
}
const geo = (p, st) => ({ L: eyeGeo(p.L, 36, 1, p.glyph, st), R: eyeGeo(p.R, 64, -1, p.glyph, st) });
const GEOS = {};
const getGeo = st => GEOS[st] || (GEOS[st] = EXPRESSIONS.map(x => geo(x.pose, st)));
function lerp(a, b, t) {
  if (Array.isArray(a)) return a.map((v, i) => lerp(v, b[i], t));
  if (typeof a === 'object') { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], t); return o; }
  return a + (b - a) * t;
}
const toD = pts => 'M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z';
const M_ID = { blink: 1, sx: 1, sy: 1, ox: 0, oy: 0, rot: 0 };
// mod: blink, sx/sy (scale both eyes), ox/oy (offset), rot (head tilt, deg, around 50,50), eye.{L,R}.{sx,sy,ox,oy,rot} per-eye
function eyePaths(g, mod = M_ID) {
  const a = mod.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return ['L', 'R'].map(s => {
    const e = g[s], l = (mod.eye && mod.eye[s]) || {}, lr = (l.rot || 0) * Math.PI / 180, lc = Math.cos(lr), ls = Math.sin(lr);
    const lsx = l.sx ?? 1, lsy = l.sy ?? 1, lox = l.ox || 0, loy = l.oy || 0;
    return toD(e.pts.map(([x, y]) => {
      let qx = (x - e.cx) * lsx, qy = (y - e.cy) * lsy;
      [qx, qy] = [qx * lc - qy * ls, qx * ls + qy * lc];
      let px = e.cx + lox + qx * mod.sx, py = e.cy + loy + qy * mod.sy * mod.blink;
      px -= 50; py -= 50;
      return [50 + px * ca - py * sa + mod.ox, 50 + px * sa + py * ca + mod.oy];
    }));
  });
}

// ——— Per-emotion idle motion (t = seconds since the expression started) ——————————————
const sq = (x, k = 4) => Math.sign(x) * Math.min(1, Math.abs(x) * k);
const ss = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const pop = (t, d = 0.55, a = 0.22) => t < d ? Math.sin(t / d * Math.PI) * (1 - t / d) * a : 0;
const beat = t => { const p = t % 1.1; return Math.exp(-Math.pow((p - 0.08) / 0.06, 2)) + 0.65 * Math.exp(-Math.pow((p - 0.3) / 0.06, 2)); };
const MOTION = {
  neutral: t => ({ ox: 4 * sq(Math.sin(t * 0.8 + 1), 6), oy: 1.5 * sq(Math.sin(t * 0.55 + 2), 6) }),
  happy: t => { const b = Math.abs(Math.sin(t * 3.2)); return { oy: -2.5 * b, sy: 1 - 0.05 * (1 - b), sx: 1 + 0.03 * (1 - b) }; },
  laugh: t => { const b = Math.abs(Math.sin(t * 9)); return { oy: -3.5 * b, rot: 3 * Math.sin(t * 4.5), sy: 1 - 0.08 * (1 - b), sx: 1 + 0.05 * (1 - b) }; },
  excited: t => { const b = Math.abs(Math.sin(t * 6.5)), s = 1 + pop(t, 0.5, 0.2) + 0.04 * b; return { oy: -4.5 * b, sx: s, sy: s }; },
  sad: t => ({ oy: 3 + Math.sin(t * 1.1) * 1.2, sy: 0.97, rot: -2 * Math.sin(t * 0.6) }),
  worried: t => ({ ox: Math.sin(t * 13) * 0.9 * (0.5 + 0.5 * sq(Math.sin(t * 1.3), 3)), oy: -1, sy: 1 + 0.03 * Math.sin(t * 5) }),
  angry: t => { const puff = Math.pow(Math.max(0, Math.sin(t * 1.6)), 6); return { ox: Math.sin(t * 43) * (0.6 + 0.8 * puff), oy: Math.cos(t * 37) * 0.4, sx: 1 + 0.08 * puff, sy: 1 + 0.08 * puff }; },
  determined: t => { const s = 1 + 0.05 * (0.5 - 0.5 * Math.cos(t * 1.8)); return { sx: s, sy: s, oy: 1 }; },
  shocked: t => { const s = 1 + pop(t, 0.6, 0.3); return { sx: s, sy: s, ox: t > 0.6 ? Math.sin(t * 50) * 0.35 : 0 }; },
  surprised: t => { const s = 1 + pop(t, 0.5, 0.25); return { sx: s, sy: s, oy: -2 * ss(t / 0.4) }; },
  'in-love': t => { const s = 1 + 0.13 * beat(t); return { oy: Math.sin(t * 1.6) * 2, rot: 3 * Math.sin(t * 0.9), eye: { L: { sx: s, sy: s }, R: { sx: s, sy: s } } }; },
  ko: t => ({ rot: 7 * Math.sin(t * 2.1), ox: 3 * Math.sin(t * 1.05), eye: { L: { rot: t * 160 }, R: { rot: -t * 160 } } }),
  amused: t => { const b = 0.5 + 0.5 * Math.sin(t * 11); return { sx: 1 + 0.1 * b, sy: 1 - 0.1 * b, rot: 2.5 * Math.sin(t * 5.5), oy: -1.5 * b }; },
  serene: t => { const a = 7 + 4 * Math.sin(t * 1.4); return { rot: 3 * Math.sin(t * 0.8), oy: Math.sin(t * 1.6) * 1.2, eye: { L: { rot: -a }, R: { rot: a } } }; },
  sleepy: t => { const c = (t % 4.2) / 4.2, d = c < 0.86 ? ss(c / 0.86) : 1 - ss((c - 0.86) / 0.06); return { oy: 6 * d, sy: 1 - 0.25 * d, rot: 4 * d }; },
  bored: t => ({ ox: 5 * Math.sin(t * 0.6), oy: 1 }),
  skeptical: t => ({ rot: 5, ox: -2, eye: { L: { sy: 1 - 0.15 * (0.5 - 0.5 * Math.cos(t * 2.4)) } } }),
  wink: t => { const s = 1 + pop(t, 0.45, 0.15); return { rot: 7 * ss(t / 0.35), sx: s, sy: s, eye: { R: { sy: 1 - 0.3 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 8) } } }; },
  sly: t => { const c = t % 2.6, w = c < 0.36 ? Math.abs(Math.sin(c / 0.36 * Math.PI * 2)) : 0; return { ox: 3 * sq(Math.sin(t * 0.7), 2), oy: -3 * w, rot: 5, eye: { L: { sy: 1 + 0.12 * w }, R: { sy: 1 + 0.12 * w } } }; },
  nervous: t => ({ ox: 4 * sq(Math.sin(t * 3.4), 5) + Math.sin(t * 37) * 0.5, sx: 0.96, sy: 0.96 }),
  thinking: t => ({ ox: 1.5 * Math.cos(t * 0.9), oy: -1.5 + 1.5 * Math.sin(t * 0.9), rot: -3 }),
  shy: t => { const peek = Math.pow(Math.max(0, Math.sin(t * 0.9)), 10); return { ox: 5 * peek, oy: 2 - 3 * peek, rot: -4 + 4 * peek }; },
  listening: t => ({ oy: Math.sin(t * 1.2) * 1, sx: 1 + 0.03 * Math.sin(t * 2.4), sy: 1 + 0.03 * Math.sin(t * 2.4) }),
  confused: t => ({ rot: 8 * sq(Math.sin(t * 0.9), 3), ox: -2 * sq(Math.sin(t * 0.9), 3) }),
};
const NO_BLINK = new Set(['in-love', 'ko', 'amused', 'laugh', 'wink', 'sleepy']);
function motionAt(i, t, a) {
  const m = (MOTION[EXPRESSIONS[i].id] || (() => ({})))(t), o = { sx: 1 + ((m.sx ?? 1) - 1) * a, sy: 1 + ((m.sy ?? 1) - 1) * a, ox: (m.ox || 0) * a, oy: (m.oy || 0) * a, rot: (m.rot || 0) * a, eye: {} };
  ['L', 'R'].forEach(s => { const e = (m.eye && m.eye[s]) || {}; o.eye[s] = { sx: 1 + ((e.sx ?? 1) - 1) * a, sy: 1 + ((e.sy ?? 1) - 1) * a, ox: (e.ox || 0) * a, oy: (e.oy || 0) * a, rot: (e.rot || 0) * a }; });
  return o;
}

// ——— Defaults (the values approved in design review) ——————————————————————————
export const DEFAULTS = {
  color: '#FAF6EF',            // eye colour
  background: '#131518',       // stage colour
  eyeGlow: 'rgba(120,205,255,0.55)', // light-blue eye halo (inner); outer halo uses same hue at ~0.3
  happyShape: 'flat',          // 'flat' | 'arc' | 'sharp-arc'
  motion: 2.5,                 // per-emotion motion intensity (0 = static)
  morphMs: 420,                // shape morph duration
  radius: 0.08,                // stage corner radius as fraction of size (32px @ 400px)
  autoCycle: 0,                // seconds between automatic expression changes (0 = off)
};

/** Static SVG string for one expression (icons, previews, exports). */
export function staticSVG(id, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, g = getGeo(o.happyShape)[IDX[id] ?? 0];
  const [dl, dr] = eyePaths(g);
  const bg = o.transparent ? '' : `<rect width="100" height="100" rx="${o.radius * 100}" fill="${o.background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg}<g fill="${o.color}" stroke="${o.color}" stroke-width="2.5" stroke-linejoin="round"><path d="${dl}"/><path d="${dr}"/></g></svg>`;
}

/** Live animated face. `container` is filled (keep it square). */
export function createRobotFace(container, opts = {}) {
  let o = { ...DEFAULTS, ...opts };
  const ns = 'http://www.w3.org/2000/svg';
  const root = document.createElement('div');
  Object.assign(root.style, { position: 'relative', width: '100%', height: '100%', background: o.background, borderRadius: `${o.radius * 100}%`, overflow: 'hidden' });
  const layer = css => { const d = document.createElement('div'); Object.assign(d.style, { position: 'absolute', pointerEvents: 'none', opacity: 0 }, css); root.appendChild(d); return d; };
  const gB = layer({ left: 0, right: 0, bottom: 0 }), gL = layer({ top: 0, bottom: 0, left: 0 }), gR = layer({ top: 0, bottom: 0, right: 0 });
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  Object.assign(svg.style, { position: 'relative', display: 'block', width: '100%', height: '100%' });
  const paths = [0, 1].map(() => { const p = document.createElementNS(ns, 'path'); p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-width', '2.5'); svg.appendChild(p); return p; });
  root.appendChild(svg); container.appendChild(root);

  const applyGlow = () => {
    const px = Math.min(container.clientWidth, container.clientHeight) || 400, k = px / 400; // il lato corto: fuori dal quadrato gli occhi seguono quello
    const outer = o.eyeGlow.replace(/[\d.]+\)$/, '0.3)');
    svg.style.filter = `drop-shadow(0 0 ${6 * k}px ${o.eyeGlow}) drop-shadow(0 0 ${18 * k}px ${outer})`;
  };
  applyGlow();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(applyGlow) : null; ro && ro.observe(container);

  const st = { idx: 0, mode: 'idle', prevIdx: null, prevT0: 0, mT0: performance.now(), cur: getGeo(o.happyShape)[0], from: null, to: null, t0: 0,
    blinkT: -1, nextBlink: performance.now() + 1800, amp: { talk: 0, listen: 0 }, env: 0, envT: 0, nextSyl: 0, ext: null,
    nodT: -1, nextNod: 0, tiltDir: 1, nextTilt: 0, tilt: 0, nextSwitch: performance.now() + o.autoCycle * 1000 };
  st.from = st.to = st.cur;
  const go = i => { const now = performance.now(); st.prevIdx = st.idx; st.prevT0 = st.mT0; st.mT0 = now; st.from = st.cur; st.to = getGeo(o.happyShape)[i]; st.t0 = now; st.idx = i; };

  let last = performance.now(), raf;
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = Math.min(1, (now - st.t0) / o.morphMs), ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    st.cur = lerp(st.from, st.to, ease);
    if (o.autoCycle > 0 && st.mode === 'idle' && now > st.nextSwitch) { go((st.idx + 1) % EXPRESSIONS.length); st.nextSwitch = now + o.autoCycle * 1000; }
    st.amp.talk += ((st.mode === 'talking' ? 1 : 0) - st.amp.talk) * Math.min(1, dt * 6);
    st.amp.listen += ((st.mode === 'listening' ? 1 : 0) - st.amp.listen) * Math.min(1, dt * 4);
    // TALKING: procedural syllables, or external level via setSpeechLevel()
    if (st.ext == null && now > st.nextSyl) { const pause = Math.random() < 0.18; st.envT = pause ? 0 : 0.35 + Math.random() * 0.65; st.nextSyl = now + (pause ? 260 + Math.random() * 300 : 90 + Math.random() * 130); }
    if (st.ext != null) st.envT = st.ext;
    st.env += (st.envT - st.env) * Math.min(1, dt * 22);
    const T = st.amp.talk * st.env, Lm = st.amp.listen;
    // LISTENING: head tilt switching side, nods, slightly wider eyes, slower blinks
    if (now > st.nextTilt) { st.tiltDir = Math.random() < 0.5 ? -1 : 1; st.nextTilt = now + 3500 + Math.random() * 3000; }
    st.tilt += (st.tiltDir * 7 - st.tilt) * Math.min(1, dt * 2.2);
    if (st.mode === 'listening' && now > st.nextNod) { st.nodT = now; st.nextNod = now + 1600 + Math.random() * 1800; }
    let nod = 0;
    if (st.nodT > 0) { const n = (now - st.nodT) / 700; if (n < 1) nod = Math.sin(n * Math.PI * 2) * (1 - n) * 4; }
    if (now > st.nextBlink && !NO_BLINK.has(EXPRESSIONS[st.idx].id)) { st.blinkT = now; st.nextBlink = now + (st.mode === 'listening' ? 3200 : 2200) + Math.random() * 2600; }
    let blink = 1;
    if (st.blinkT > 0) { const dur = st.mode === 'listening' ? 260 : 160, b = (now - st.blinkT) / dur; blink = b < 1 ? 0.1 + 0.9 * Math.abs(1 - 2 * b) : 1; }
    const mod = { blink, sx: 1 + 0.1 * T + 0.04 * Lm, sy: 1 - 0.24 * T + 0.06 * Lm, ox: st.tilt * 0.5 * Lm, oy: -3 * T + (nod + Math.sin(now / 900) * 0.6) * Lm, rot: st.tilt * Lm };
    // stage glow: bottom ellipse while talking (follows voice), side ellipses while listening (slow breath)
    const n = parseInt(o.color.slice(1), 16), rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    const pulse = (1 - Math.cos(now / 1800 * Math.PI * 2)) / 2;
    gB.style.height = (10 + 15 * st.env).toFixed(2) + '%';
    gB.style.background = `radial-gradient(ellipse 38% 100% at 50% 100%, rgba(${rgb},0.55), rgba(${rgb},0.14) 50%, rgba(${rgb},0) 100%)`;
    gB.style.opacity = (st.amp.talk * (0.1 + 0.9 * st.env)).toFixed(3);
    const w = (9 + 8.5 * pulse).toFixed(2) + '%';
    gL.style.width = gR.style.width = w;
    gL.style.background = `radial-gradient(ellipse 100% 30% at 0% 50%, rgba(${rgb},0.5), rgba(${rgb},0.12) 50%, rgba(${rgb},0) 100%)`;
    gR.style.background = `radial-gradient(ellipse 100% 30% at 100% 50%, rgba(${rgb},0.5), rgba(${rgb},0.12) 50%, rgba(${rgb},0) 100%)`;
    gL.style.opacity = gR.style.opacity = (Lm * (0.2 + 0.8 * pulse)).toFixed(3);
    // per-emotion motion, cross-blended with the previous one; damped while talking/listening
    const mk = Math.min(1, (now - st.mT0) / 500), calm = 1 - 0.65 * Math.max(st.amp.talk, Lm);
    const mN = motionAt(st.idx, (now - st.mT0) / 1000, ss(mk) * calm * o.motion);
    const mP = st.prevIdx != null ? motionAt(st.prevIdx, (now - st.prevT0) / 1000, (1 - ss(mk)) * calm * o.motion) : motionAt(0, 0, 0);
    mod.sx *= mN.sx * mP.sx; mod.sy *= mN.sy * mP.sy; mod.ox += mN.ox + mP.ox; mod.oy += mN.oy + mP.oy; mod.rot += mN.rot + mP.rot;
    mod.eye = {}; ['L', 'R'].forEach(s => { const a = mN.eye[s], b = mP.eye[s]; mod.eye[s] = { sx: a.sx * b.sx, sy: a.sy * b.sy, ox: a.ox + b.ox, oy: a.oy + b.oy, rot: a.rot + b.rot }; });
    eyePaths(st.cur, mod).forEach((d, i) => { paths[i].setAttribute('d', d); paths[i].setAttribute('fill', o.color); paths[i].setAttribute('stroke', o.color); });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    setExpression(id) { const i = IDX[id]; if (i == null) throw new Error('Unknown expression: ' + id); if (i !== st.idx) go(i); },
    getExpression: () => EXPRESSIONS[st.idx].id,
    /** 'idle' | 'talking' | 'listening' — overlays on top of the current expression */
    setMode(m) { if (m === 'listening' && st.mode !== 'listening') { st.nextNod = performance.now() + 900; st.nextTilt = performance.now(); } st.mode = m; },
    /** Drive talking from real audio (0–1). Pass null to go back to procedural syllables. */
    setSpeechLevel(v) { st.ext = v == null ? null : Math.max(0, Math.min(1, v)); },
    blink() { st.blinkT = performance.now(); },
    setOptions(next) { const shapeChanged = next.happyShape && next.happyShape !== o.happyShape; o = { ...o, ...next }; root.style.background = o.background; applyGlow(); if (shapeChanged) { st.from = st.cur; st.to = getGeo(o.happyShape)[st.idx]; st.t0 = performance.now(); } },
    destroy() { cancelAnimationFrame(raf); ro && ro.disconnect(); root.remove(); },
  };
}
