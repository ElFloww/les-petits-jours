import type { CSSProperties } from 'react';
import type { Calendar } from './api';
import { Lock } from './Illustrations';

type Point = { x: number; y: number };
type GiftStyle = CSSProperties & Record<'--gift-x' | '--gift-y' | '--mobile-x' | '--mobile-y' | '--tie-length', string>;

const stateLabels = { locked: 'À patienter', available: 'À découvrir', opened: 'Déjà ouvert' };
const desktopPoints: Point[] = [
  { x: 50, y: 40 }, { x: 320, y: 105 }, { x: 620, y: 80 }, { x: 920, y: 160 },
  { x: 880, y: 385 }, { x: 610, y: 445 }, { x: 340, y: 400 }, { x: 70, y: 465 },
  { x: 110, y: 705 }, { x: 380, y: 770 }, { x: 650, y: 730 }, { x: 950, y: 805 },
  { x: 850, y: 1055 }, { x: 570, y: 1100 }, { x: 280, y: 1040 }, { x: 40, y: 1120 },
  { x: 100, y: 1370 }, { x: 350, y: 1420 }, { x: 630, y: 1380 }, { x: 910, y: 1450 },
  { x: 860, y: 1690 }, { x: 580, y: 1760 }, { x: 310, y: 1715 }, { x: 70, y: 1800 },
];
const mobilePoints: Point[] = desktopPoints.map((_, index) => ({
  x: [100, 850, 900, 180, 60, 780, 920, 240][index % 8],
  y: 40 + index * 210,
}));
const desktopHeight = 2050;
const mobileHeight = 5150;

// Interpolate through the attachment points, so the wire and gifts stay aligned at any width.
function garlandPath(points: Point[]) {
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const start = points[index - 1];
    const before = points[Math.max(0, index - 2)];
    const after = points[Math.min(points.length - 1, index + 1)];
    return `${path} C ${start.x + (point.x - before.x) / 6} ${start.y + (point.y - before.y) / 6}, ${point.x - (after.x - start.x) / 6} ${point.y - (after.y - start.y) / 6}, ${point.x} ${point.y}`;
  }, '');
}

const wires = [
  { name: 'desktop', height: desktopHeight, path: garlandPath(desktopPoints) },
  { name: 'mobile', height: mobileHeight, path: garlandPath(mobilePoints) },
];

export function GiftGarland({ days, preview, onSelect }: {
  days: Calendar['days']; preview: boolean; onSelect: (day: number) => void;
}) {
  return <div className="gift-trail">
    <div className="garland-decorations" aria-hidden="true">
      <span className="hanging-bauble bauble-red" /><span className="hanging-bauble bauble-gold" />
      <span className="floating-snowflake">❄</span><span className="floating-star">✧</span>
    </div>
    {wires.map(wire => <svg key={wire.name} className={`garland-wire garland-${wire.name}`}
      viewBox={`0 0 1000 ${wire.height}`} preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path className="garland-foliage" d={wire.path} />
      <path className="garland-cord" d={wire.path} />
      <path className="garland-lights" d={wire.path} />
    </svg>)}
    {days.map(({ day, state }) => {
      const point = desktopPoints[day - 1];
      const mobile = mobilePoints[day - 1];
      const style: GiftStyle = {
        '--gift-x': `${point.x / 10}%`, '--gift-y': `${point.y}px`,
        '--mobile-x': `${mobile.x / 10}%`, '--mobile-y': `${mobile.y}px`,
        '--tie-length': `${[48, 64, 42, 58, 52, 70][day % 6]}px`,
      };
      return <div className="gift-position" key={day} style={style}>
        <span className="gift-tie" aria-hidden="true" />
        <button className={`gift gift-${day % 6} ${preview ? 'available' : state}`} disabled={!preview && state === 'locked'}
          aria-label={`${day} décembre — ${preview ? 'Prévisualiser' : stateLabels[state]}`} onClick={() => onSelect(day)}>
          <span className="gift-bow" aria-hidden="true" /><span className="gift-lid" aria-hidden="true" />
          <span className="gift-ribbon" aria-hidden="true" /><span className="gift-number">{String(day).padStart(2, '0')}</span>
          <span className="gift-badge">{preview ? '↗' : state === 'locked' ? <Lock /> : state === 'opened' ? '✓' : '↗'}</span>
        </button>
        <span className={`gift-caption caption-${preview ? 'available' : state}`}>{preview ? 'Prévisualiser' : state === 'locked' ? `${day} décembre` : stateLabels[state]}</span>
      </div>;
    })}
  </div>;
}
