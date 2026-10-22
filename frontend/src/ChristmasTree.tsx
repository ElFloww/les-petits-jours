import { useEffect, useId, useMemo, useRef, type CSSProperties } from 'react';
import { buildFir, palettes, type Bough, type Fir } from './fir';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const lightColors = ['#ffd166', '#ff5c6c', '#7fe0a6', '#76cfff', '#ff9bd2'];
const balls: [string, string, string][] = [
  ['#ff7d89', '#c8273b', '#6d0f1f'], ['#ffe9a8', '#d9a441', '#7c5414'], ['#a2e4ff', '#3b8fd0', '#12385f'],
  ['#c7f2d4', '#35966a', '#0e3d27'], ['#ffd0ea', '#d85f9a', '#6d1b46'], ['#fff7e8', '#d9d2c4', '#8a8372'],
];

const trees = new Map<string, Fir>();
export function cachedFir(seed: number, tiers: number, density: number, snow: number) {
  const key = `${seed}-${tiers}-${density}-${snow}`;
  let fir = trees.get(key);
  if (!fir) { fir = buildFir({ seed, tiers, density, snow }); trees.set(key, fir); }
  return fir;
}

function starPath(cx: number, cy: number, outer: number, inner: number, points = 5) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? inner : outer;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d + 'Z';
}

/** The painted foliage of a set of boughs: soft body, then needles dark → light, then snow. */
export function Foliage({ boughs, snow = true, body = true }: { boughs: Bough[]; snow?: boolean; body?: boolean }) {
  return <>
    {boughs.map((b, index) => {
      const p = palettes[b.palette];
      return <g key={index}>
        {body && b.body && <path d={b.body} fill={p.body} stroke={p.body} strokeWidth="3" strokeLinejoin="round" />}
        <path d={b.dark} stroke={p.dark} strokeWidth="2.3" strokeLinecap="round" />
        <path d={b.mid} stroke={p.mid} strokeWidth="1.9" strokeLinecap="round" />
        {b.light && <path d={b.light} stroke={p.light} strokeWidth="1.5" strokeLinecap="round" />}
        {snow && b.snow && <path d={b.snow} stroke="#f4f9fd" strokeWidth="2.6" strokeLinecap="round" opacity=".9" />}
      </g>;
    })}
  </>;
}

export function Fillers({ fir, fill }: { fir: Fir; fill: string }) {
  return <>{fir.fillers.map((d, i) => <path key={i} d={d} fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round" />)}</>;
}

export function GoldGarlands({ fir }: { fir: Fir }) {
  return <>
    {fir.garlandEnds.filter(end => end.tier >= 1 && end.tier % 2 === 1 && end.tier < 9).map(({ l, r, tier }) => {
      const sag = 20 + tier * 2.4;
      const d = `M${l.x.toFixed(1)} ${l.y.toFixed(1)}Q200 ${((l.y + r.y) / 2 + sag * 2).toFixed(1)} ${r.x.toFixed(1)} ${r.y.toFixed(1)}`;
      return <g key={tier} className="tree-garland">
        <path d={d} stroke="#6b4a12" strokeWidth="5.4" strokeDasharray="0.1 8.5" strokeLinecap="round" transform="translate(0 1.5)" opacity=".55" />
        <path d={d} stroke="#e9c261" strokeWidth="4.6" strokeDasharray="0.1 8.5" strokeLinecap="round" />
        <path d={d} stroke="#fff0b8" strokeWidth="1.6" strokeDasharray="0.1 8.5" strokeDashoffset="-1.5" strokeLinecap="round" />
        <path d={d} stroke="#c9a04a" strokeWidth=".9" opacity=".8" />
      </g>;
    })}
  </>;
}

export function StaticBaubles({ fir, every = 3, offset = 0 }: { fir: Fir; every?: number; offset?: number }) {
  return <>
    {fir.tips.filter((_, i) => i % every === offset).map((tip, i) => {
      const [c1, c2, c3] = balls[i % balls.length];
      const r = 4.5 + (i % 3) * 1.4;
      return <g key={i}>
        <path d={`M${tip.x.toFixed(1)} ${(tip.y + 2).toFixed(1)}v${(7 + (i % 2) * 3)}`} stroke="#d7b266" strokeWidth=".9" />
        <circle cx={tip.x} cy={tip.y + 9 + (i % 2) * 3 + r} r={r} fill={c2} />
        <circle cx={tip.x - r * .3} cy={tip.y + 9 + (i % 2) * 3 + r - r * .3} r={r * .62} fill={c1} opacity=".85" />
        <circle cx={tip.x - r * .35} cy={tip.y + 9 + (i % 2) * 3 + r - r * .4} r={r * .2} fill="#fff" />
        <path d={`M${tip.x - r * .8} ${tip.y + 9 + (i % 2) * 3 + r + r * .3}a${r * .9} ${r * .9} 0 0 0 ${r * 1.6} 0`} stroke={c3} strokeWidth=".8" fill="none" opacity=".5" />
      </g>;
    })}
  </>;
}

/** A fully dressed, softly animated Christmas tree built from three stacked SVG layers for real parallax depth. */
export function ChristmasTree({ className = '', lights = true }: { className?: string; lights?: boolean }) {
  const id = useId().replace(/:/g, '');
  const fir = useMemo(() => cachedFir(7, 10, 1, .55), []);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(window.innerWidth / 2, 1);
        const dy = (event.clientY - (rect.top + rect.height / 2)) / Math.max(window.innerHeight / 2, 1);
        element.style.setProperty('--ry', (Math.max(-1, Math.min(1, dx)) * 16).toFixed(2));
        element.style.setProperty('--rx', (Math.max(-1, Math.min(1, dy)) * -5).toFixed(2));
      });
    };
    window.addEventListener('pointermove', move);
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, []);

  const back = fir.boughs.filter(b => b.layer === 'back');
  const front = fir.boughs.filter(b => b.layer === 'front');
  const lampSpots = useMemo(() => [...fir.mids, ...fir.tips].filter((_, i) => i % 2 === 0 || i % 7 === 0), [fir]);
  const ornaments = useMemo(() => fir.tips.filter((_, i) => i % 3 === 1), [fir]);

  return <div className={`xtree ${className}`} ref={root} aria-hidden="true">
    <div className="xtree-stage"><div className="xtree-sway">
      {/* Back: glow, trunk, skirt, inner mass and the far boughs. */}
      <svg className="xtree-layer xtree-back" viewBox="0 0 400 560" fill="none" focusable="false">
        <defs>
          <radialGradient id={`${id}-aura`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffe29a" stopOpacity=".55" /><stop offset=".6" stopColor="#ffc86b" stopOpacity=".14" /><stop offset="1" stopColor="#ffc86b" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}-trunk`} x1="0" x2="1"><stop offset="0" stopColor="#3a2417" /><stop offset=".45" stopColor="#7a4d2e" /><stop offset="1" stopColor="#2e1b11" /></linearGradient>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f4636" /><stop offset="1" stopColor="#0a3126" /></linearGradient>
          <radialGradient id={`${id}-shadow`}><stop offset="0" stopColor="#1b0f0a" stopOpacity=".42" /><stop offset="1" stopColor="#1b0f0a" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse className="tree-aura" cx="200" cy="300" rx="210" ry="270" fill={`url(#${id}-aura)`} />
        <ellipse cx="200" cy="530" rx="140" ry="16" fill={`url(#${id}-shadow)`} />
        <path d="M184 420h32l6 108h-44Z" fill={`url(#${id}-trunk)`} />
        <path d="M193 430l-2 90M201 430v92M208 430l3 90" stroke="#24150d" strokeWidth="1.2" opacity=".5" />
        <Fillers fir={fir} fill={`url(#${id}-fill)`} />
        <Foliage boughs={back} snow={false} />
      </svg>
      <svg className="xtree-layer xtree-front" viewBox="0 0 400 560" fill="none" focusable="false">
        <Foliage boughs={front} />
        {/* Tree skirt in front of the trunk. */}
        <path d="M92 521c6-10 50-17 108-17s102 7 108 17c-14 8-56 13-108 13S106 529 92 521Z" fill="#f6efe0" />
        <path d="M92 521c14 8 56 13 108 13s94-5 108-13c-2 7-6 10-12 13-24 7-56 10-96 10s-72-3-96-10c-6-3-10-6-12-13Z" fill="#c8323f" />
        <path d="M110 524c24 6 56 9 90 9s66-3 90-9" stroke="#fff" strokeWidth="1.4" strokeDasharray="1 6" strokeLinecap="round" opacity=".8" />
      </svg>
      {/* Front: everything that glows, swings or sparkles. */}
      <svg className="xtree-layer xtree-fx" viewBox="0 0 400 560" fill="none" focusable="false">
        <defs>
          {lightColors.map((color, k) => <radialGradient key={color} id={`${id}-g${k}`}><stop offset="0" stopColor={color} stopOpacity=".95" /><stop offset=".35" stopColor={color} stopOpacity=".4" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>)}
          {balls.map(([c1, c2, c3], k) => <radialGradient key={k} id={`${id}-b${k}`} cx=".33" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".14" stopColor={c1} /><stop offset=".6" stopColor={c2} /><stop offset="1" stopColor={c3} /></radialGradient>)}
          <radialGradient id={`${id}-starglow`}><stop offset="0" stopColor="#fff2b8" stopOpacity=".95" /><stop offset=".4" stopColor="#ffd36a" stopOpacity=".35" /><stop offset="1" stopColor="#ffd36a" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}-star`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset=".5" stopColor="#f7c948" /><stop offset="1" stopColor="#d99a1e" /></linearGradient>
        </defs>
        <GoldGarlands fir={fir} />
        {ornaments.map((tip, i) => {
          const k = i % balls.length;
          const r = 6 + (i % 3) * 1.6;
          const drop = 9 + (i % 3) * 3;
          const style: Vars = { transformOrigin: `${tip.x.toFixed(1)}px ${(tip.y + 1).toFixed(1)}px`, '--d': `${(-(i * .7) % 4).toFixed(1)}s`, '--s': `${(3 + (i % 4) * .6).toFixed(1)}s` };
          return <g key={i} className="tree-ornament" style={style}>
            <path d={`M${tip.x.toFixed(1)} ${(tip.y + 1).toFixed(1)}v${drop}`} stroke="#e4c27a" strokeWidth="1" />
            <rect x={tip.x - 2.2} y={tip.y + drop - 1} width="4.4" height="3.4" rx="1" fill="#d9b45a" />
            <circle cx={tip.x} cy={tip.y + drop + r + 1.6} r={r} fill={`url(#${id}-b${k})`} />
            <circle cx={tip.x - r * .36} cy={tip.y + drop + r - r * .25} r={r * .16} fill="#fff" className="tree-glint" style={{ animationDelay: `${(-(i * .53) % 3.4).toFixed(2)}s` }} />
          </g>;
        })}
        {lights && lampSpots.map((spot, i) => {
          const k = i % lightColors.length;
          const x = spot.x, y = spot.y + 5;
          const style: Vars = { '--dur': `${[1.6, 2.2, 2.8][i % 3]}s`, '--delay': `${(-(i * .31) % 2.8).toFixed(2)}s` };
          return <g key={i} className="tree-lamp" style={style}>
            <circle cx={x} cy={y} r="15" fill={`url(#${id}-g${k})`} />
            <circle cx={x} cy={y} r="3.4" fill={lightColors[k]} />
            <circle cx={x - 1} cy={y - 1} r="1.1" fill="#fff" />
          </g>;
        })}
        <g className="tree-topper">
          <circle className="tree-topper-glow" cx="200" cy="54" r="52" fill={`url(#${id}-starglow)`} />
          <g className="tree-rays" stroke="#fff3c0" strokeLinecap="round">
            <path d="M200 14v80M160 54h80" strokeWidth="1.6" opacity=".8" />
            <path d="M172 26l56 56M228 26l-56 56" strokeWidth="1" opacity=".55" />
          </g>
          <path d={starPath(200, 56, 21, 9.5)} fill={`url(#${id}-star)`} stroke="#e8a92e" strokeWidth="1.5" strokeLinejoin="round" />
          <path d={starPath(200, 57, 12, 5.5)} fill="#fff7cf" opacity=".7" />
        </g>
        {[[58, 190, 0], [345, 150, 1.1], [90, 300, 2.1], [330, 330, .6], [150, 440, 1.6], [275, 470, 2.5], [236, 118, 1.4], [162, 205, .3]].map(([x, y, d], i) =>
          <path key={i} className="tree-sparkle" d={`M${x} ${y - 8}c.8 4.6 2.6 6.4 7 7.200-4.400.8-6.200 2.600-7 7.200-.8-4.600-2.600-6.400-7-7.200 4.400-.8 6.200-2.600 7-7.200Z`} fill="#fff3c0"
            style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` } as CSSProperties} />)}
      </svg>
    </div></div>
  </div>;
}
