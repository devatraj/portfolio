// Spinning, lit planets on <canvas>: an equirectangular texture wrapped onto a sphere with a
// per-pixel lookup table, so each frame is one array walk. The Moon uses NASA's LRO colour map
// (public domain); the others are generated here from 3D noise, so they wrap without seams.
// One rAF loop drives every sphere; spheres off-screen, in a hidden tab, or under
// prefers-reduced-motion are drawn once and left still.

const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- noise ---------------- */
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}
function fbm(x, y, z, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s / (1 - 0.5 ** oct);
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------------- textures ---------------- */
// Paint an equirectangular texture: fn(lat, lon, x, y, z) -> [r, g, b] with (x, y, z) on the unit sphere.
function paint(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) {
    const lat = Math.PI / 2 - ((j + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * 2 * Math.PI - Math.PI;
      const c = fn(lat, lon, cl * Math.cos(lon), sl, cl * Math.sin(lon));
      const k = (j * w + i) * 4;
      data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
    }
  }
  return { w, h, data };
}

const D = 180 / Math.PI;
const PAINTERS = {
  jupiter: (lat, lon, x, y, z) => {
    const L = lat * D;
    const warp = (fbm(x * 3, y * 9, z * 3) - 0.5) * 9;
    const b = L + warp;
    const t = 0.5 + 0.5 * Math.sin(b * 0.38 + Math.sin(b * 0.13) * 1.6);
    let c = mix(hex('#f1e4cc'), hex('#c58f62'), t);
    // Darker belts either side of the equator, paler zones between.
    c = mix(c, hex('#9a6243'), smooth(6, 0, Math.abs(Math.abs(b) - 14)) * 0.55);
    c = mix(c, hex('#f6ecd9'), smooth(4, 0, Math.abs(b)) * 0.5);
    c = mix(c, hex('#8c8a86'), smooth(55, 80, Math.abs(L)) * 0.65);
    // Great Red Spot.
    const dl = ((lon * D + 360 - 30) % 360) - 180, dt = L + 22;
    const spot = (dl / 13) ** 2 + (dt / 6) ** 2;
    if (spot < 1.6) c = mix(c, hex('#bb5a3b'), smooth(1.6, 0.4, spot) * 0.85);
    const fine = (fbm(x * 16, y * 40, z * 16, 3) - 0.5) * 26;
    return [c[0] + fine, c[1] + fine, c[2] + fine];
  },
  saturn: (lat, lon, x, y, z) => {
    const L = lat * D + (fbm(x * 4, y * 12, z * 4, 3) - 0.5) * 3;
    const t = 0.5 + 0.5 * Math.sin(L * 0.42);
    let c = mix(hex('#e9d6a6'), hex('#c9a66a'), t * 0.7);
    c = mix(c, hex('#a8a58f'), smooth(60, 85, Math.abs(lat * D)) * 0.7);
    const fine = (fbm(x * 20, y * 50, z * 20, 2) - 0.5) * 12;
    return [c[0] + fine, c[1] + fine, c[2] + fine];
  },
  venus: (lat, lon, x, y, z) => {
    const n = fbm(x * 2.2 + fbm(x, y * 3, z) * 1.5, y * 5, z * 2.2);
    return mix(hex('#c9a165'), hex('#f5e7c4'), smooth(0.3, 0.75, n));
  },
  mars: (lat, lon, x, y, z) => {
    const n = fbm(x * 2.4, y * 2.4, z * 2.4), m = fbm(x * 9, y * 9, z * 9, 3);
    let c = mix(hex('#d5784a'), hex('#a9482a'), smooth(0.4, 0.6, m));
    c = mix(c, hex('#5e2c1d'), smooth(0.52, 0.66, n) * 0.85);
    const cap = smooth(74, 80, Math.abs(lat * D) + (m - 0.5) * 8);
    return mix(c, hex('#f4efe8'), cap);
  },
  earth: (lat, lon, x, y, z) => {
    const n = fbm(x * 1.8, y * 1.8, z * 1.8, 6), m = fbm(x * 6, y * 6, z * 6, 3);
    const land = smooth(0.52, 0.55, n);
    const ocean = mix(hex('#0e3567'), hex('#1f5f9e'), smooth(0.35, 0.52, n));
    const ground = mix(hex('#3d7a37'), hex('#a48a55'), smooth(0.45, 0.65, m) * (0.4 + Math.abs(lat) / 2));
    let c = mix(ocean, ground, land);
    c = mix(c, hex('#f2f6fa'), smooth(68, 74, Math.abs(lat * D) + (m - 0.5) * 10));
    const cloud = smooth(0.56, 0.72, fbm(x * 3 + 7, y * 6, z * 3 - 3, 5));
    return mix(c, hex('#ffffff'), cloud * 0.85);
  },
  sun: (lat, lon, x, y, z) => {
    const g = fbm(x * 14, y * 14, z * 14, 3), big = fbm(x * 3, y * 3, z * 3, 3);
    let c = mix(hex('#ff9a2e'), hex('#ffe38a'), smooth(0.25, 0.75, g * 0.7 + big * 0.3));
    const spot = smooth(0.78, 0.84, fbm(x * 5 + 11, y * 5, z * 5, 3)) * smooth(40, 10, Math.abs(lat * D));
    return mix(c, hex('#6b2a07'), spot * 0.8);
  },
};

const cache = new Map();
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      res({ w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data });
    };
    img.onerror = rej;
    img.src = src;
  });
}
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 16)));

export function texture(kind, size = 256) {
  const key = `${kind}:${size}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      if (kind === 'moon') return loadImage('/textures/moon.webp');
      if (kind === 'mercury') {
        // Mercury looks much like the Moon: reuse its craters, darker and warmer.
        const m = await texture('moon');
        const data = new Uint8ClampedArray(m.data.length);
        for (let i = 0; i < data.length; i += 4) {
          const l = (m.data[i] * 0.3 + m.data[i + 1] * 0.59 + m.data[i + 2] * 0.11) * 0.82;
          data[i] = l + 14; data[i + 1] = l + 6; data[i + 2] = l; data[i + 3] = 255;
        }
        return { w: m.w, h: m.h, data };
      }
      await idle();
      return paint(size * 2, size, PAINTERS[kind]);
    })());
  }
  return cache.get(key);
}

/* ---------------- sphere ---------------- */
const LIGHT = norm3([-0.55, -0.4, 0.73]);
function norm3([x, y, z]) { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }

// Light direction for a moon phase (0 new, 0.5 full): lit from the right while waxing.
export function phaseLight(phase) {
  const a = phase * 2 * Math.PI;
  return norm3([Math.sin(a), -0.08, -Math.cos(a)]);
}

const spheres = new Set();
let raf = 0, lastT = 0;

export class Sphere {
  // opts: { kind, texSize, spin (turns/sec), wobble (moon), roll (deg), light, ambient, limb,
  //         emissive, rings: { inner, outer, tilt } (radii in planet radii) }
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.o = { spin: 0, roll: 0, ambient: 0.05, limb: 0.35, light: LIGHT, ...opts };
    this.ctx = canvas.getContext('2d');
    this.offset = 0; this.drawnAt = -1; this.visible = true;
    texture(this.o.kind, this.o.texSize).then((t) => { this.tex = t; this.layout(); this.draw(0, true); });
    spheres.add(this);
    io?.observe(canvas);
    canvas.__sphere = this;
  }

  layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const css = this.canvas.clientWidth || 100;
    const W = Math.max(8, Math.round(css * dpr));
    this.canvas.width = W; this.canvas.height = W;
    const scale = this.o.rings ? this.o.rings.outer * 1.04 : 1;
    const N = Math.max(8, Math.round(W / scale));
    this.N = N;
    this.img = new ImageData(N, N);
    if (this.o.rings) {
      this.off = this.off ?? document.createElement('canvas');
      this.off.width = N; this.off.height = N;
      this.offCtx = this.off.getContext('2d');
    }
    // Lookup table: for every pixel on the disc, its texture column/row and its light.
    const { w, h } = this.tex, roll = (this.o.roll * Math.PI) / 180, cr = Math.cos(roll), sr = Math.sin(roll);
    const [lx, ly, lz] = this.o.light;
    const px = [], u = [], v = [], shade = [], alpha = [];
    const R = N / 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const nx = (i + 0.5 - R) / R, ny = (j + 0.5 - R) / R, rr = nx * nx + ny * ny;
      if (rr > 1.02) continue;
      const nz = Math.sqrt(Math.max(0, 1 - rr));
      const bx = nx * cr + ny * sr, by = -nx * sr + ny * cr;
      const lat = Math.asin(Math.max(-1, Math.min(1, -by))), lon = Math.atan2(bx, nz);
      px.push(j * N + i);
      u.push(((lon / (2 * Math.PI) + 0.5) * w) % w);
      v.push(Math.min(h - 1, Math.floor((0.5 - lat / Math.PI) * h)) * w);
      let s;
      if (this.o.emissive) s = 0.62 + 0.45 * Math.pow(nz, 0.45);
      else {
        const d = nx * lx + ny * ly + nz * lz;
        s = this.o.ambient + (1 - this.o.ambient) * smooth(-0.06, 0.25, d) * (0.55 + 0.45 * Math.max(d, 0));
        s *= 1 - this.o.limb * (1 - nz) ** 2;
      }
      shade.push(s);
      alpha.push(clamp01((1 - Math.sqrt(rr)) * R + 0.5));
    }
    this.lut = { px: Int32Array.from(px), u: Float32Array.from(u), v: Int32Array.from(v), shade: Float32Array.from(shade), alpha: Float32Array.from(alpha) };
    this.drawnAt = -1;
  }

  draw(t, force = false) {
    if (!this.tex || !this.lut) return;
    const { w, data: T } = this.tex, o = this.o;
    let off = o.spin * w * (t / 1000);
    if (o.wobble) off = Math.sin(t / 9000) * w * 0.018;
    const step = Math.floor(off);
    if (!force && step === this.drawnAt) return;
    this.drawnAt = step;
    const out = this.img.data, { px, u, v, shade, alpha } = this.lut;
    out.fill(0);
    for (let k = 0; k < px.length; k++) {
      let uu = (u[k] - step) % w; if (uu < 0) uu += w;
      const ti = (v[k] + (uu | 0)) * 4, oi = px[k] * 4, s = shade[k];
      out[oi] = T[ti] * s; out[oi + 1] = T[ti + 1] * s; out[oi + 2] = T[ti + 2] * s; out[oi + 3] = alpha[k] * 255;
    }
    const c = this.ctx, W = this.canvas.width;
    if (!o.rings) { c.putImageData(this.img, (W - this.N) / 2 | 0, (W - this.N) / 2 | 0); return; }
    this.offCtx.putImageData(this.img, 0, 0);
    c.clearRect(0, 0, W, W);
    this.ring(c, W, true);
    c.drawImage(this.off, (W - this.N) / 2, (W - this.N) / 2);
    this.ring(c, W, false);
  }

  // Saturn's rings in two halves: the far half behind the globe, the near half in front.
  ring(c, W, back) {
    const { inner, outer, tilt } = this.o.rings, R = this.N / 2;
    c.save();
    c.translate(W / 2, W / 2);
    c.rotate((this.o.roll * Math.PI) / 180);
    c.beginPath();
    if (back) c.rect(-W, -W, 2 * W, W); else c.rect(-W, 0, 2 * W, W);
    c.clip();
    c.scale(1, tilt);
    const bands = [[0, 0.25], [0.12, 0.55], [0.38, 0.85], [0.62, 0.05], [0.68, 0.7], [0.9, 0.45], [1, 0.2]];
    const steps = Math.max(10, Math.round((outer - inner) * R));
    for (let s = 0; s < steps; s++) {
      const f = s / steps, r = R * (inner + (outer - inner) * f);
      let a = 0;
      for (let b = 1; b < bands.length; b++) if (f <= bands[b][0]) { const [f0, a0] = bands[b - 1], [f1, a1] = bands[b]; a = a0 + (a1 - a0) * ((f - f0) / (f1 - f0)); break; }
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.strokeStyle = `rgba(${f < 0.6 ? '226,205,160' : '205,186,150'},${a * (back ? 0.75 : 0.95)})`;
      c.lineWidth = ((outer - inner) * R) / steps + 0.6;
      c.stroke();
    }
    c.restore();
  }

  destroy() { spheres.delete(this); io?.unobserve(this.canvas); }
}

const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((es) => es.forEach((e) => { if (e.target.__sphere) e.target.__sphere.visible = e.isIntersecting; }), { rootMargin: '120px' })
  : null;

function loop(t) {
  raf = requestAnimationFrame(loop);
  if (t - lastT < 33) return; // ~30 fps is plenty for slow spins
  lastT = t;
  for (const s of spheres) if (s.visible) s.draw(t);
}

export function start() {
  if (reduce || raf) return;
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf); raf = 0;
    if (!document.hidden) raf = requestAnimationFrame(loop);
  });
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => spheres.forEach((s) => { if (s.tex) { s.layout(); s.draw(performance.now(), true); } }), 200);
  });
}

// Build every <canvas data-sphere="kind"> on the page. Options come from data-* attributes.
export function mountAll(root = document) {
  root.querySelectorAll('canvas[data-sphere]').forEach((c) => {
    if (c.__sphere) return;
    const d = c.dataset, kind = d.sphere;
    const opts = { kind, texSize: +d.tex || 256, spin: +d.spin || 0, roll: +d.roll || 0 };
    if (d.phase) opts.light = phaseLight(+d.phase);
    if (kind === 'moon') { opts.wobble = true; opts.ambient = 0.09; opts.limb = 0.15; }
    if (kind === 'mercury') opts.limb = 0.2;
    if (kind === 'venus') { opts.ambient = 0.3; opts.limb = 0.15; }
    if (kind === 'sun') opts.emissive = true;
    if (kind === 'saturn') opts.rings = { inner: 1.25, outer: 2.25, tilt: +d.tilt || 0.3 };
    new Sphere(c, opts);
  });
  start();
}
