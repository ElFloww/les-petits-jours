import type { CSSProperties } from 'react';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Small deterministic pseudo-random generator, so decorations stay put between renders. */
export function seeded(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export const bulbColors = ['#ffcf5c', '#ff5c6c', '#62d98f', '#6cc8ff', '#ff94cf'];

export function Bulb({ index, left, top, tilt = 0, size }: { index: number; left: string; top: string; tilt?: number; size?: 'small' }) {
  const duration = [1.7, 2.3, 2.9][index % 3];
  const style: Vars = {
    left, top,
    '--c': bulbColors[index % bulbColors.length],
    '--t': `${tilt}deg`,
    '--dur': `${duration}s`,
    '--delay': `${-((index * 0.27) % duration).toFixed(2)}s`,
  };
  return <span className={`bulb ${size === 'small' ? 'bulb-small' : ''}`} style={style}><i className="bulb-glow" /><i className="bulb-glass" /></span>;
}

/** The scalloped string of lights hanging under the header. */
export function HeaderLights({ count = 28, period = 62, sag = 16 }: { count?: number; period?: number; sag?: number }) {
  const width = count * period;
  const path = Array.from({ length: count }, (_, index) =>
    `${index === 0 ? 'M 0 2' : ''} Q ${index * period + period / 2} ${sag * 2} ${(index + 1) * period} 2`).join(' ');
  return <div className="header-lights" aria-hidden="true">
    <div className="header-lights-strip" style={{ width }}>
      <svg width={width} height="40" viewBox={`0 0 ${width} 40`} fill="none"><path d={path} /></svg>
      {Array.from({ length: count }, (_, index) =>
        <Bulb key={index} index={index} left={`${index * period + period / 2}px`} top={`${sag + 1}px`} tilt={(index % 2 ? 1 : -1) * 6} />)}
    </div>
  </div>;
}

/** Falling snow: a sticky viewport inside the landscape, so flakes keep falling while the page scrolls. */
export function Snowfall({ count, layer }: { count: number; layer: 'back' | 'front' }) {
  return <div className={`snow-layer snow-${layer}`} aria-hidden="true">
    <div className="snow-viewport">
      {Array.from({ length: count }, (_, index) => {
        const seed = index + (layer === 'front' ? 500 : 0);
        const size = layer === 'front' ? 5 + seeded(seed) * 7 : 2 + seeded(seed) * 3.5;
        const duration = (layer === 'front' ? 9 : 16) + seeded(seed + 1) * 10;
        const style: Vars = {
          left: `${(seeded(seed + 2) * 100).toFixed(2)}%`,
          '--size': `${size.toFixed(1)}px`,
          '--dur': `${duration.toFixed(1)}s`,
          '--delay': `${(-seeded(seed + 3) * duration).toFixed(1)}s`,
          '--drift': `${((seeded(seed + 4) - .5) * 120).toFixed(0)}px`,
          '--alpha': (layer === 'front' ? .75 : .45 + seeded(seed + 5) * .35).toFixed(2),
        };
        return <i key={index} className={layer === 'front' && index % 4 === 0 ? 'flake flake-crystal' : 'flake'} style={style}>
          {layer === 'front' && index % 4 === 0 ? '❄' : null}
        </i>;
      })}
    </div>
  </div>;
}

export function SkyStars({ count = 60 }: { count?: number }) {
  return <div className="sky-stars" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => {
      const style: Vars = {
        left: `${(seeded(index + 900) * 100).toFixed(2)}%`,
        top: `${(seeded(index + 950) * 100).toFixed(2)}%`,
        '--size': `${(1 + seeded(index + 990) * 2.4).toFixed(1)}px`,
        '--dur': `${(2 + seeded(index + 1030) * 4).toFixed(1)}s`,
        '--delay': `${(-seeded(index + 1070) * 5).toFixed(1)}s`,
      };
      return <i key={index} className={index % 9 === 0 ? 'sky-star sky-star-big' : 'sky-star'} style={style} />;
    })}
    <i className="shooting-star" /><i className="shooting-star shooting-star-late" />
  </div>;
}

/** A burst of confetti when a gift is unwrapped. */
export function Confetti({ pieces = 46 }: { pieces?: number }) {
  const colors = ['#e2364a', '#f6c955', '#3fae6b', '#6cc8ff', '#ff94cf', '#fff3d6'];
  return <div className="confetti" aria-hidden="true">
    {Array.from({ length: pieces }, (_, index) => {
      const angle = (index / pieces) * Math.PI * 2 + seeded(index) * .5;
      const distance = 120 + seeded(index + 40) * 220;
      const style: Vars = {
        '--dx': `${(Math.cos(angle) * distance).toFixed(0)}px`,
        '--dy': `${(Math.sin(angle) * distance * .7 - 40).toFixed(0)}px`,
        '--fall': `${(160 + seeded(index + 80) * 220).toFixed(0)}px`,
        '--rot': `${(seeded(index + 120) * 900 - 450).toFixed(0)}deg`,
        '--delay': `${(seeded(index + 160) * .18).toFixed(2)}s`,
        background: colors[index % colors.length],
      };
      return <i key={index} className={`confetti-piece confetti-${index % 3}`} style={style} />;
    })}
  </div>;
}

export function MiniLights({ count = 16 }: { count?: number }) {
  return <div className="mini-lights" aria-hidden="true">
    <svg viewBox="0 0 100 16" preserveAspectRatio="none" fill="none"><path d="M0 1 Q 50 15 100 1" /></svg>
    {Array.from({ length: count }, (_, index) => {
      const x = (index + .5) / count;
      const y = 1 + 2 * x * (1 - x) * 14;
      return <Bulb key={index} index={index + 3} size="small" left={`${(x * 100).toFixed(2)}%`} top={`${y.toFixed(1)}px`} tilt={(index % 2 ? 1 : -1) * 8} />;
    })}
  </div>;
}
