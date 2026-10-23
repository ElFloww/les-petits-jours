import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { GarlandCanvas } from './GarlandCanvas';
import type { Point } from './garlandMath';

/* Realistic-ish Christmas decorations: every piece is built from gradients, highlights and cast
   shadows rather than flat shapes, and the fir boughs reuse the needle-by-needle canvas renderer. */

let uid = 0;
const useId = (prefix: string) => useMemo(() => `${prefix}${++uid}`, [prefix]);

export function Pinecone({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const id = useId('pc');
  const rows = 9;
  const scales: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const y = 12 + r * 9.5;
    const half = 5 + Math.sin((r / (rows - 1)) * Math.PI) * 13 + 2;
    const count = Math.max(3, Math.round(half / 3.4));
    for (let c = 0; c < count; c++) {
      const x = 30 + (c - (count - 1) / 2) * (half * 2 / count) + (r % 2 ? 2.4 : 0);
      scales.push(<path key={`${r}-${c}`} d={`M${x - 4.6} ${y}Q${x} ${y - 4} ${x + 4.6} ${y}Q${x + 4.2} ${y + 9} ${x} ${y + 11}Q${x - 4.2} ${y + 9} ${x - 4.6} ${y}Z`}
        fill={`url(#${id}s)`} stroke="#2a170b" strokeWidth=".7" />);
    }
  }
  return <svg className={className} style={style} viewBox="0 0 60 110" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}s`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#a8754a" /><stop offset=".55" stopColor="#6e4223" /><stop offset="1" stopColor="#3a210f" /></linearGradient>
    </defs>
    <ellipse cx="30" cy="104" rx="14" ry="3" fill="#00000033" />
    <path d="M26 0h8l1 14H25Z" fill="#4a3220" />
    <g>{scales}</g>
    <g fill="#fff" opacity=".8"><circle cx="23" cy="40" r="1.2" /><circle cx="36" cy="53" r="1" /><circle cx="29" cy="68" r="1.3" /></g>
  </svg>;
}

export function Holly({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const id = useId('hl');
  const leaf = 'M0 0C6-6 10-14 18-16L22-23 27-15 35-18 37-9 46-8 43 0 49 7 40 9 40 17 31 14 25 21 20 13 11 15 8 7Z';
  return <svg className={className} style={style} viewBox="0 0 110 90" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}l`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#3f8a4d" /><stop offset=".5" stopColor="#1f5e33" /><stop offset="1" stopColor="#0f3a22" /></linearGradient>
      <radialGradient id={`${id}b`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ff7d7d" /><stop offset=".35" stopColor="#d6213a" /><stop offset="1" stopColor="#7a0e22" /></radialGradient>
    </defs>
    {[[-32, 1], [24, 1], [-96, .9], [92, .85]].map(([rotation, scale], index) =>
      <g key={index} transform={`translate(52 52) rotate(${rotation}) scale(${scale} ${scale})`}>
        <path d={leaf} transform="translate(1 2)" fill="#00000030" />
        <path d={leaf} fill={`url(#${id}l)`} stroke="#0b2d1a" strokeWidth=".8" />
        <path d="M2 1C14 0 28 2 42 4" stroke="#8fcf96" strokeWidth=".9" fill="none" opacity=".7" />
        <path d="M10 1 16-9M18 2 25-10M27 3 33-5M14 2 18 11M24 4 28 14M34 5 36 12" stroke="#7bbf86" strokeWidth=".5" fill="none" opacity=".5" />
      </g>)}
    {[[48, 50, 7], [58, 56, 6.6], [50, 61, 6.2]].map(([x, y, r], index) => <g key={index}>
      <circle cx={x + 1} cy={y + 2} r={r} fill="#00000033" />
      <circle cx={x} cy={y} r={r} fill={`url(#${id}b)`} />
      <ellipse cx={x - r * .35} cy={y - r * .4} rx={r * .28} ry={r * .18} fill="#fff" opacity=".85" />
    </g>)}
  </svg>;
}

export function Bow({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const id = useId('bw');
  return <svg className={className} style={style} viewBox="0 0 160 120" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}r`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e23a4e" /><stop offset=".5" stopColor="#b3162e" /><stop offset="1" stopColor="#6e0a1c" /></linearGradient>
      <linearGradient id={`${id}d`} x1="0" x2="1"><stop offset="0" stopColor="#5c0816" /><stop offset=".5" stopColor="#9c1229" /><stop offset="1" stopColor="#5c0816" /></linearGradient>
    </defs>
    <path d="M78 66C60 90 52 110 42 118L62 108 72 118 82 74Z" fill={`url(#${id}d)`} />
    <path d="M82 66C100 90 108 110 118 118L98 108 88 118 78 74Z" fill={`url(#${id}d)`} />
    <path d="M78 58C54 20 14 10 6 34 0 58 40 70 78 62Z" fill={`url(#${id}r)`} stroke="#4f0714" strokeWidth="1.2" />
    <path d="M82 58C106 20 146 10 154 34 160 58 120 70 82 62Z" fill={`url(#${id}r)`} stroke="#4f0714" strokeWidth="1.2" />
    <path d="M70 56C48 34 26 28 16 36M90 56C112 34 134 28 144 36" stroke="#ff8c97" strokeWidth="1.6" fill="none" opacity=".55" strokeLinecap="round" />
    <path d="M66 62C46 54 26 54 14 48M94 62C114 54 134 54 146 48" stroke="#4f0714" strokeWidth="1" fill="none" opacity=".5" />
    <rect x="66" y="48" width="28" height="26" rx="9" fill={`url(#${id}r)`} stroke="#4f0714" strokeWidth="1.2" />
    <path d="M72 54c4-3 12-3 16 0" stroke="#ff8c97" strokeWidth="1.6" fill="none" opacity=".6" strokeLinecap="round" />
  </svg>;
}

export function Poinsettia({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const id = useId('ps');
  const petal = 'M0 0C-14-10-18-38-4-56 0-60 0-60 4-56 18-38 14-10 0 0Z';
  return <svg className={className} style={style} viewBox="0 0 150 150" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}r`} x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="#7d0b1f" /><stop offset=".6" stopColor="#c4162f" /><stop offset="1" stopColor="#e5384b" /></linearGradient>
      <linearGradient id={`${id}g`} x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="#0f3a22" /><stop offset="1" stopColor="#2f7a46" /></linearGradient>
    </defs>
    <g transform="translate(75 82)">
      {[0, 60, 120, 180, 240, 300].map(angle => <path key={`g${angle}`} d={petal} transform={`rotate(${angle + 30}) scale(.95)`} fill={`url(#${id}g)`} />)}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => <g key={angle} transform={`rotate(${angle})`}>
        <path d={petal} fill={`url(#${id}r)`} stroke="#6a0a1a" strokeWidth=".8" />
        <path d="M0-4V-50" stroke="#ff9aa4" strokeWidth=".8" opacity=".6" />
      </g>)}
      {[0, 60, 120, 180, 240, 300].map(angle => <g key={`i${angle}`} transform={`rotate(${angle + 15}) scale(.62)`}>
        <path d={petal} fill={`url(#${id}r)`} stroke="#6a0a1a" strokeWidth="1" />
      </g>)}
      {[[0, 0], [5, -4], [-5, -3], [3, 5], [-4, 5], [0, -8], [8, 2], [-8, 1]].map(([x, y], index) =>
        <circle key={index} cx={x} cy={y} r="3" fill="#e6b832" stroke="#9a6d12" strokeWidth=".6" />)}
    </g>
  </svg>;
}

export function Candle({ className = '', style, height = 90 }: { className?: string; style?: CSSProperties; height?: number }) {
  const id = useId('cd');
  return <svg className={`candle ${className}`} style={style} viewBox="0 0 60 150" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}w`} x1="0" x2="1"><stop offset="0" stopColor="#d9c9a4" /><stop offset=".4" stopColor="#fff6dd" /><stop offset="1" stopColor="#cbb98f" /></linearGradient>
      <linearGradient id={`${id}b`} x1="0" x2="1"><stop offset="0" stopColor="#7a5a1d" /><stop offset=".45" stopColor="#f0d17a" /><stop offset="1" stopColor="#7a5a1d" /></linearGradient>
      <radialGradient id={`${id}h`}><stop offset="0" stopColor="#ffd26a" stopOpacity=".55" /><stop offset="1" stopColor="#ffd26a" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}f`} cx=".5" cy=".75" r=".6"><stop offset="0" stopColor="#fff9d8" /><stop offset=".45" stopColor="#ffc94a" /><stop offset="1" stopColor="#ff7a18" stopOpacity="0" /></radialGradient>
    </defs>
    <circle className="candle-glow" cx="30" cy={150 - height - 22} r="70" fill={`url(#${id}h)`} />
    <path d="M10 148h40l-4-14H14Z" fill={`url(#${id}b)`} />
    <ellipse cx="30" cy="134" rx="22" ry="4" fill={`url(#${id}b)`} />
    <rect x="17" y={150 - height} width="26" height={height - 14} rx="2" fill={`url(#${id}w)`} />
    <path d={`M17 ${150 - height + 2}q13 8 26 0v6q-13 8-26 0Z`} fill="#fffaf0" opacity=".9" />
    <path d={`M24 ${150 - height + 6}q1 14 4 16 3-3 1-16Z`} fill="#fff6dd" />
    <path d={`M30 ${150 - height - 2}v-8`} stroke="#2a2118" strokeWidth="1.6" strokeLinecap="round" />
    <g transform={`translate(30 ${150 - height - 8})`}><g className="candle-flame">
      <path d="M0-30C9-18 9-6 0-1-9-6-9-18 0-30Z" fill={`url(#${id}f)`} />
      <path d="M0-16C4-10 4-4 0-2-4-4-4-10 0-16Z" fill="#fffbe6" opacity=".9" />
    </g></g>
  </svg>;
}

export function GiftStack({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const id = useId('gs');
  const box = (x: number, y: number, w: number, h: number, a: string, b: string, ribbon: string, key: string) => <g key={key}>
    <rect x={x + 3} y={y + 3} width={w} height={h} fill="#0000002a" />
    <rect x={x} y={y} width={w} height={h} fill={`url(#${id}${a})`} />
    <rect x={x} y={y} width={w} height={h} fill={`url(#${id}p)`} opacity=".25" />
    <rect x={x - 3} y={y - 9} width={w + 6} height="11" rx="2" fill={`url(#${id}${a})`} stroke="#00000030" strokeWidth=".6" />
    <rect x={x + w / 2 - 4} y={y - 9} width="8" height={h + 9} fill={ribbon} />
    <path d={`M${x + w / 2} ${y - 9}C${x + w / 2 - 20} ${y - 30} ${x + w / 2 - 22} ${y - 8} ${x + w / 2} ${y - 9}C${x + w / 2 + 20} ${y - 30} ${x + w / 2 + 22} ${y - 8} ${x + w / 2} ${y - 9}Z`} fill={ribbon} stroke="#00000033" strokeWidth=".6" />
    <path d={`M${x + 4} ${y + 4}V${y + h - 4}`} stroke={b} strokeOpacity=".5" strokeWidth="2" />
  </g>;
  return <svg className={className} style={style} viewBox="0 0 190 130" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}r`} x1="0" x2="1"><stop offset="0" stopColor="#c01f37" /><stop offset="1" stopColor="#7e0f23" /></linearGradient>
      <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#2f7a50" /><stop offset="1" stopColor="#154a30" /></linearGradient>
      <linearGradient id={`${id}c`} x1="0" x2="1"><stop offset="0" stopColor="#f7ecd0" /><stop offset="1" stopColor="#d5c196" /></linearGradient>
      <pattern id={`${id}p`} width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="#fff" /><circle cx="9" cy="9" r="1" fill="#fff" /></pattern>
    </defs>
    <ellipse cx="95" cy="124" rx="90" ry="6" fill="#0000001f" />
    {box(8, 62, 78, 58, 'g', '#fff', '#e9c36a', 'a')}
    {box(96, 76, 80, 44, 'r', '#fff', '#f6e7b8', 'b')}
    {box(52, 18, 56, 44, 'c', '#c01f37', '#b3162e', 'c')}
  </svg>;
}

/** A fir bough drawn needle by needle, with decorations laid on top. `points` use a 1000-wide x axis, y in px. */
export function DecorBough({ className = '', width, height, points, flip = false, children }: {
  className?: string; width: number; height: number; points: Point[]; flip?: boolean; children?: ReactNode;
}) {
  return <div className={`decor-bough ${flip ? 'decor-flip' : ''} ${className}`} style={{ width, height }} aria-hidden="true">
    <GarlandCanvas points={points} height={height} />
    {children}
  </div>;
}

export function Wreath({ className = '', size = 300 }: { className?: string; size?: number }) {
  const points = useMemo<Point[]>(() => {
    const r = size * .34, c = size / 2;
    return Array.from({ length: 15 }, (_, i) => {
      const a = (-Math.PI / 2) + (i / 14) * Math.PI * 2 * .985 + .14;
      return { x: (c + Math.cos(a) * r) * (1000 / size), y: c + Math.sin(a) * r };
    });
  }, [size]);
  return <DecorBough className={`wreath ${className}`} width={size} height={size} points={points}>
    <Pinecone className="decor-item" style={{ left: '14%', top: '58%', width: size * .085, transform: 'rotate(-40deg)' }} />
    <Pinecone className="decor-item" style={{ left: '78%', top: '24%', width: size * .085, transform: 'rotate(55deg)' }} />
    <Holly className="decor-item" style={{ left: '66%', top: '70%', width: size * .2, transform: 'rotate(20deg)' }} />
    <Holly className="decor-item" style={{ left: '10%', top: '22%', width: size * .18, transform: 'rotate(-110deg)' }} />
    <Bow className="decor-item" style={{ left: '50%', top: '2%', width: size * .36, marginLeft: -size * .18 }} />
  </DecorBough>;
}

export const cornerBough: Point[] = [
  { x: -30, y: 28 }, { x: 170, y: 52 }, { x: 360, y: 96 }, { x: 540, y: 150 }, { x: 700, y: 214 }, { x: 830, y: 262 },
];
export const mantelBough: Point[] = [
  { x: -20, y: 84 }, { x: 170, y: 70 }, { x: 330, y: 92 }, { x: 500, y: 74 }, { x: 670, y: 94 }, { x: 830, y: 72 }, { x: 1020, y: 84 },
];

/** Draped bough with candles, presents and flowers, laid along the mantel before the footer. */
export function Mantel() {
  return <section className="decor-mantel" aria-hidden="true">
    <DecorBough className="mantel-bough" width={1000} height={170} points={mantelBough}>
      <Pinecone className="decor-item" style={{ left: '17%', top: '52%', width: 38, transform: 'rotate(-62deg)' }} />
      <Pinecone className="decor-item" style={{ left: '63%', top: '56%', width: 36, transform: 'rotate(70deg)' }} />
      <Holly className="decor-item" style={{ left: '30%', top: '40%', width: 108 }} />
      <Holly className="decor-item" style={{ left: '74%', top: '38%', width: 100, transform: 'scaleX(-1)' }} />
      <Poinsettia className="decor-item" style={{ left: '46%', top: '12%', width: 118 }} />
      <Poinsettia className="decor-item" style={{ left: '4%', top: '24%', width: 96 }} />
      <Poinsettia className="decor-item" style={{ left: '88%', top: '22%', width: 96 }} />
    </DecorBough>
    <Candle className="mantel-candle mc-1" height={96} /><Candle className="mantel-candle mc-2" height={70} /><Candle className="mantel-candle mc-3" height={84} />
    <GiftStack className="mantel-gifts" />
  </section>;
}
