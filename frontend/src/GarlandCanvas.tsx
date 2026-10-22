import { useEffect, useRef } from 'react';
import { bezier, segment, type Point } from './garlandMath';

/**
 * The garland, drawn as a real fir bough: a woody stem with hundreds of leafy sprigs radiating
 * around it, every sprig combed with individual needles. Drawn in device pixels (not stretched with
 * the SVG), in three depth passes — dark inner mass, mid greens, sunlit needles and pale new growth.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Sample { x: number; y: number; tx: number; ty: number; }

function sampleCurve(points: Point[], sx: number): Sample[] {
  const dense: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    const curve = segment(points, i);
    for (let k = 0; k < 120; k++) { const p = bezier(curve, k / 120); dense.push({ x: p.x * sx, y: p.y }); }
  }
  dense.push({ x: points[points.length - 1].x * sx, y: points[points.length - 1].y });
  const out: Sample[] = [];
  let acc = 0;
  const step = 1.6;
  let prev = dense[0];
  out.push({ x: prev.x, y: prev.y, tx: 1, ty: 0 });
  for (let i = 1; i < dense.length; i++) {
    const p = dense[i];
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    if (acc >= step) {
      const ref = dense[Math.max(0, i - 3)], ahead = dense[Math.min(dense.length - 1, i + 3)];
      let tx = ahead.x - ref.x, ty = ahead.y - ref.y;
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      out.push({ x: p.x, y: p.y, tx, ty });
      acc = 0;
    }
    prev = p;
  }
  return out;
}

const SHADES = 6;

export function drawGarland(canvas: HTMLCanvasElement, points: Point[], width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const k = width < 520 ? 0.78 : 1;            // slimmer bough on phones
  const random = mulberry32(2026);
  const R = (a: number, b: number) => a + random() * (b - a);
  const line = sampleCurve(points, width / 1000);

  // Low-frequency thickness variation: the bough swells and thins like a real one.
  const thickness = (i: number) => 0.8 + 0.28 * Math.sin(i * 0.0042 + 1.3) * Math.sin(i * 0.0011 + 2.1) + 0.14 * Math.sin(i * 0.021);

  interface Pass { name: string; spacing: number; angle: [number, number]; sprig: [number, number]; needle: [number, number]; hue: [number, number]; light: [number, number]; sat: number; width: number; twig: boolean; }
  const passes: Pass[] = [
    { name: 'back', spacing: 2.4, angle: [0.35, 1.5], sprig: [24, 42], needle: [12, 18], hue: [155, 168], light: [4, 9], sat: 52, width: 1.5, twig: true },
    { name: 'mid', spacing: 2.2, angle: [0.3, 1.45], sprig: [21, 38], needle: [11, 16.5], hue: [146, 158], light: [10, 18], sat: 50, width: 1.25, twig: true },
    { name: 'front', spacing: 2.6, angle: [0.25, 1.3], sprig: [16, 32], needle: [10, 14.5], hue: [138, 152], light: [18, 30], sat: 46, width: 1.05, twig: false },
  ];

  // Woody central stem.
  ctx.beginPath();
  line.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = '#2b1d12'; ctx.lineWidth = 5.5 * k; ctx.stroke();
  ctx.strokeStyle = '#4a3322'; ctx.lineWidth = 2.2 * k; ctx.stroke();

  const tipPaths = Array.from({ length: 3 }, () => new Path2D());
  const snowPath = new Path2D();

  for (const pass of passes) {
    const shadeA = Array.from({ length: SHADES }, () => new Path2D());   // pointing downward / shaded
    const shadeB = Array.from({ length: SHADES }, () => new Path2D());   // pointing upward / sunlit
    const twigs = new Path2D();
    const stride = Math.max(1, Math.round(pass.spacing / 1.6));
    for (let i = 0; i < line.length; i += stride) {
      const base = line[i];
      const th = thickness(i) * k;
      for (const side of [-1, 1]) {
        if (random() < 0.12) continue;
        const jitter = R(-0.8, 0.8);
        const ang = side * R(pass.angle[0], pass.angle[1]) + jitter * 0.1;
        // Sprig direction: the bough tangent rotated by `ang` (forward-leaning like real foliage).
        const c = Math.cos(ang), s = Math.sin(ang);
        let dx = base.tx * c - base.ty * s, dy = base.tx * s + base.ty * c;
        // A few sprigs lean toward the viewer: short and steeper.
        const len = R(pass.sprig[0], pass.sprig[1]) * th * (random() < 0.18 ? 0.55 : 1);
        const droop = 0.22;
        const nodes = Math.max(3, Math.round(len / 3.1));
        let px = base.x, py = base.y;
        if (pass.twig) twigs.moveTo(px, py);
        for (let j = 1; j <= nodes; j++) {
          const t = j / nodes;
          // Curved sprig: gravity bends it down a little.
          const nx = base.x + dx * len * t;
          const ny = base.y + dy * len * t + droop * len * t * t;
          const ddx = nx - px, ddy = ny - py;
          if (pass.twig) twigs.lineTo(nx, ny);
          // Needles: a comb on both sides of the sprig, longest mid-way, tiny at the end.
          const taper = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.8));
          const nl = R(pass.needle[0], pass.needle[1]) * taper * k * (0.85 + th * 0.25);
          const base0 = Math.atan2(ddy, ddx);
          for (const ns of [-1, 1]) {
            const a = base0 + ns * R(0.5, 0.95);
            const ex = nx + Math.cos(a) * nl, ey = ny + Math.sin(a) * nl;
            const up = Math.sin(a) < -0.15;                      // pointing up on screen → catches the light
            const bucket = Math.min(SHADES - 1, Math.floor(random() * SHADES));
            const target = up ? shadeB[bucket] : shadeA[bucket];
            target.moveTo(nx, ny); target.lineTo(ex, ey);
            if (t > 0.78 && pass.name !== 'back' && random() < 0.16) { const tp = tipPaths[Math.floor(random() * 3)]; tp.moveTo(nx, ny); tp.lineTo(nx + (ex - nx) * 0.9, ny + (ey - ny) * 0.9); }
            if (up && pass.name === 'front' && t > 0.4 && random() < 0.016) { snowPath.moveTo(nx + (ex - nx) * 0.35, ny + (ey - ny) * 0.35 - 0.6); snowPath.lineTo(ex, ey - 0.4); }
          }
          px = nx; py = ny;
          dx += 0; dy += 0;
        }
      }
    }
    if (pass.twig) { ctx.strokeStyle = pass.name === 'back' ? '#1e150d' : '#34261a'; ctx.lineWidth = 1.5 * k; ctx.stroke(twigs); }
    ctx.lineWidth = pass.width * k;
    for (let b = 0; b < SHADES; b++) {
      const f = b / (SHADES - 1);
      const hue = pass.hue[0] + (pass.hue[1] - pass.hue[0]) * f;
      ctx.strokeStyle = `hsl(${hue} ${pass.sat}% ${pass.light[0] + (pass.light[1] - pass.light[0]) * f * 0.8}%)`;
      ctx.stroke(shadeA[b]);
      ctx.strokeStyle = `hsl(${hue} ${pass.sat + 6}% ${pass.light[0] + (pass.light[1] - pass.light[0]) * (0.35 + f * 0.65) + 5}%)`;
      ctx.stroke(shadeB[b]);
    }
  }

  // New growth (pale yellow-green) and a light dusting of frost.
  ctx.lineWidth = 1.05 * k;
  ['hsl(92 48% 36%)', 'hsl(104 46% 33%)', 'hsl(118 44% 30%)'].forEach((color, i) => { ctx.strokeStyle = color; ctx.stroke(tipPaths[i]); });
  ctx.lineWidth = 1.7 * k; ctx.strokeStyle = 'rgba(246, 251, 254, .85)'; ctx.stroke(snowPath);
}

export function GarlandCanvas({ points }: { points: Point[]; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || typeof ResizeObserver === 'undefined') return;
    let frame = 0, lastWidth = 0, lastHeight = 0;
    const paint = () => {
      const width = parent.clientWidth, height = parent.clientHeight;
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width; lastHeight = height;
      drawGarland(canvas, points, width, height);
    };
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); });
    observer.observe(parent);
    paint();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [points]);
  return <canvas ref={ref} className="garland-canvas" aria-hidden="true" />;
}
