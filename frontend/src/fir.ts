/**
 * Procedural fir tree geometry.
 *
 * A real fir is a stack of whorls of drooping boughs; each bough is a flat spray of short needles
 * along a curved spine, darker underneath and lit on top. We generate exactly that: every bough is a
 * curved spine (rises out of the trunk, then droops and curls up at the tip), a soft filled body and
 * thousands of tiny needle strokes in three greens. Everything is deterministic (seeded) so the
 * tree is identical between renders, and string-based so it renders as a handful of <path>s.
 *
 * Coordinates live in a 400 × 560 box, trunk at x = 200, ground at y = 520.
 */

export type Pt = { x: number; y: number };

export interface Bough {
  layer: 'back' | 'front';
  palette: number;
  dark: string; mid: string; light: string; snow: string; body: string;
  /** Spine points, root → tip. */
  spine: Pt[];
  tier: number;
  side: -1 | 0 | 1;
}

export interface FirOptions {
  seed?: number;
  tiers?: number;
  /** 1 = lush (hero tree), ~.5 = lighter forest tree. */
  density?: number;
  /** Amount of snow lying on the boughs, 0‥1. */
  snow?: number;
}

export interface Fir {
  boughs: Bough[];
  tiers: { y: number; width: number; tipY: number; rootY: number }[];
  /** Tier-by-tier filler silhouettes (dark inner mass that avoids holes between boughs). */
  fillers: string[];
  /** Candidate spots for hanging ornaments / lights (tips and mid-spines of front boughs). */
  tips: (Pt & { tier: number; t: number })[];
  mids: (Pt & { tier: number; t: number })[];
  /** Left & right tip of the first front bough per tier, used to hang garlands. */
  garlandEnds: { l: Pt; r: Pt; tier: number }[];
}

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function makeSpine(random: () => number, root: Pt, tip: Pt, curl: number, steps: number): Pt[] {
  const phase = random() * 6;
  const pts: Pt[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    let y = root.y + (tip.y - root.y) * Math.pow(t, 1.3);
    y += Math.sin(t * Math.PI * 2.1 + phase) * 1.7 * t;
    y -= curl * smooth(.72, 1, t) ** 1.6;
    pts.push({ x: root.x + (tip.x - root.x) * t, y });
  }
  return pts;
}

interface Needles { dark: string[]; mid: string[]; light: string[]; snow: string[]; body: string }

function needles(random: () => number, spine: Pt[], opts: { len: number; step: number; density: number; snow: number; sideBias?: number; lit: boolean }): Needles {
  const out: Needles = { dark: [], mid: [], light: [], snow: [], body: '' };
  const n = spine.length - 1;
  const upper: Pt[] = [];
  const lower: Pt[] = [];
  for (let k = 1; k <= n; k++) {
    const p = spine[k];
    const q = spine[k - 1];
    let tx = p.x - q.x, ty = p.y - q.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const t = k / n;
    // The normal that points up on screen.
    let nx = ty, ny = -tx;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const taper = Math.sin(Math.PI * Math.min(1, .12 + t * .9)) ** .7;
    const bodyWidth = (opts.len * .55 + 3) * taper;
    upper.push({ x: p.x + nx * bodyWidth * .75, y: p.y + ny * bodyWidth * .75 });
    lower.push({ x: p.x - nx * bodyWidth * 1.05, y: p.y - ny * bodyWidth * 1.05 + 2 });
    if (t < .07) continue;
    const base = opts.len * (1.05 - .5 * t) * (.8 + random() * .45);
    // How many needle pairs per spine sample, so long and short boughs are equally dense.
    const reps = Math.max(1, Math.round(opts.density * (opts.step > 3 ? 1 : 2)));
    for (let rep = 0; rep < reps; rep++) {
      for (const side of [1, -1]) {
        const a = side * (26 + random() * 42) * Math.PI / 180;
        const dx = tx * Math.cos(a) - ty * Math.sin(a);
        const dy = tx * Math.sin(a) + ty * Math.cos(a) + .34;
        const len = base * (.75 + random() * .5);
        const sx = p.x + (random() - .5) * 3, sy = p.y + (random() - .5) * 3;
        const seg = `M${r1(sx)} ${r1(sy)}l${r1(dx * len)} ${r1(dy * len)}`;
        const isUp = (dx * nx + dy * ny) > 0;
        if (random() < .55) out.dark.push(seg);
        else out.mid.push(`M${r1(sx)} ${r1(sy)}l${r1(dx * len * .8)} ${r1(dy * len * .8)}`);
        if (opts.lit && isUp && random() < .7) out.light.push(`M${r1(sx)} ${r1(sy)}l${r1(dx * len * .62)} ${r1(dy * len * .62)}`);
      }
    }
    // Leading tuft at the very tip.
    if (k === n) for (let j = -1; j <= 1; j++) {
      const a = j * .45;
      const dx = tx * Math.cos(a) - ty * Math.sin(a), dy = tx * Math.sin(a) + ty * Math.cos(a) + .2;
      out.mid.push(`M${r1(p.x)} ${r1(p.y)}l${r1(dx * base)} ${r1(dy * base)}`);
      out.light.push(`M${r1(p.x)} ${r1(p.y)}l${r1(dx * base * .7)} ${r1(dy * base * .7)}`);
    }
    // Snow resting along the top of the bough, clumping toward the tips.
    if (opts.snow > 0 && random() < opts.snow * (.25 + t * .45)) {
      const o = bodyWidth * .32;
      const sx = p.x + nx * o, sy = p.y + ny * o;
      const w = 1.6 + random() * 3.2 * (.5 + t);
      out.snow.push(`M${r1(sx - tx * w)} ${r1(sy - ty * w)}L${r1(sx + tx * w)} ${r1(sy + ty * w)}`);
    }
  }
  const ring = [...upper, ...lower.reverse()];
  out.body = `M${spine[0].x} ${spine[0].y}` + ring.map(p => `L${r1(p.x)} ${r1(p.y)}`).join('') + 'Z';
  return out;
}

const PALETTES = [
  { dark: '#0a3328', mid: '#14543b', light: '#2f8059', body: '#0c3b2d' },
  { dark: '#0c3a2c', mid: '#186446', light: '#3c9568', body: '#0f4333' },
  { dark: '#0d4033', mid: '#1c7050', light: '#52a878', body: '#124a39' },
];

export function buildFir({ seed = 7, tiers = 10, density = 1, snow = .55 }: FirOptions = {}): Fir {
  const random = rng(seed);
  const boughs: Bough[] = [];
  const result: Fir = { boughs, tiers: [], fillers: [], tips: [], mids: [], garlandEnds: [] };
  const step = density >= .9 ? 3 : 4.2;

  const push = (layer: 'back' | 'front', spine: Pt[], tier: number, side: -1 | 0 | 1, palette: number, len: number, lit: boolean, snowAmount: number) => {
    const n = needles(random, spine, { len, step, density, snow: snowAmount, lit });
    boughs.push({ layer, palette, spine, tier, side, dark: n.dark.join(''), mid: n.mid.join(''), light: n.light.join(''), snow: n.snow.join(''), body: n.body.length > 2 ? n.body : '' });
  };
  const paletteFor = (layer: 'back' | 'front', f: number) => layer === 'back' ? 0 : f < .5 ? 1 : 2;

  // Top leader: a vertical spray of upward needles.
  {
    const spine: Pt[] = [];
    for (let k = 0; k <= 12; k++) spine.push({ x: 200 + Math.sin(k * .5) * .8, y: 122 - k * 5.2 });
    // Needles on a vertical spine would point sideways-down; the +.34 gravity is fine for a leader.
    push('front', spine, -1, 0, 1, 15, true, snow * .5);
  }

  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1);
    const width = 20 + 168 * Math.pow(f, .88);
    const tipY = 100 + f * 372;
    const rootY = tipY - (40 + 26 * f);
    result.tiers.push({ y: (tipY + rootY) / 2, width, tipY, rootY });

    // Filler silhouette with a scalloped hem: the dark mass behind the boughs.
    const bumps = Math.max(3, Math.round(width / 24));
    let d = `M200 ${r1(rootY - 14)}L${r1(200 - width * .96)} ${r1(tipY + 4)}`;
    for (let b = 0; b < bumps; b++) {
      const x0 = 200 - width * .96 + (b / bumps) * width * 1.92;
      const x1 = 200 - width * .96 + ((b + 1) / bumps) * width * 1.92;
      d += `Q${r1((x0 + x1) / 2)} ${r1(tipY + 15 + random() * 8)} ${r1(x1)} ${r1(tipY + 4)}`;
    }
    result.fillers.push(d + 'Z');

    const boughLen = 18 + f * 5;
    const layers: ['back' | 'front', number, number][] = [['back', 2, .8], ['front', 2, 1]];
    for (const [layer, count, lenScale] of layers) {
      for (const side of [-1, 1] as const) {
        for (let c = 0; c < count; c++) {
          const jitter = (random() - .5) * 8;
          const reach = width * (layer === 'back' ? .72 + c * .22 : .95 - c * .2) * (.94 + random() * .1);
          const yTip = tipY + (c === 0 ? 0 : -16 - random() * 8) + (layer === 'back' ? -14 : 0) + jitter;
          const yRoot = rootY + (layer === 'back' ? -6 : c * 8) + jitter * .5;
          const spine = makeSpine(random, { x: 200 + side * 5, y: yRoot }, { x: 200 + side * reach, y: yTip }, 7 + random() * 6, Math.max(8, Math.round(reach / step)));
          push(layer, spine, i, side, paletteFor(layer, f), boughLen * lenScale, layer === 'front', layer === 'front' ? snow * (.5 + f * .5) : 0);
          if (layer === 'front') {
            const tip = spine[spine.length - 1];
            result.tips.push({ ...tip, tier: i, t: 1 });
            for (const t of [.45, .7]) {
              const p = spine[Math.round(t * (spine.length - 1))];
              result.mids.push({ ...p, tier: i, t });
            }
            if (c === 0) {
              const slot = result.garlandEnds.find(e => e.tier === i) ?? (result.garlandEnds[result.garlandEnds.push({ l: tip, r: tip, tier: i }) - 1]);
              if (side < 0) slot.l = tip; else slot.r = tip;
            }
          }
        }
      }
    }

    // Front-centre tufts hide the trunk and give the tree depth towards the viewer.
    for (const a of [-.55, 0, .55]) {
      const len = 30 + f * 26 + random() * 10;
      const spine: Pt[] = [];
      for (let k = 0; k <= 9; k++) {
        const t = k / 9;
        spine.push({ x: 200 + Math.sin(a) * len * t * 1.2, y: rootY + 6 + Math.cos(a) * len * t * 1.05 + t * t * 8 });
      }
      push('front', spine, i, 0, paletteFor('front', f), boughLen * .85, true, snow * .3);
    }
  }
  return result;
}

export const palettes = PALETTES;
