import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { Calendar } from './api';
import { playGiftOpening } from './giftSound';
import { Lock, Gingerbread, CandyCane, Mitten, SnowmanOrnament, StarOrnament, Robin } from './Illustrations';
import { GiftBox } from './GiftBox';
import { ArrowUpRight, Check } from './Icons';
import { Bulb } from './Festive';
import { GarlandCanvas } from './GarlandCanvas';
import { bezier, segment, type Point } from './garlandMath';

type Vars = CSSProperties & Record<`--${string}`, string>;

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

function garlandPath(points: Point[]) {
  return points.slice(1).reduce((path, _, offset) => {
    const [, b, c, d] = segment(points, offset + 1);
    return `${path} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

type Ornament = 'bauble' | 'gingerbread' | 'candy' | 'robin' | 'star' | 'mitten' | 'snowman';
const ornamentCycle: Ornament[] = ['bauble', 'gingerbread', 'bauble', 'candy', 'robin', 'bauble', 'star', 'mitten', 'bauble', 'snowman', 'robin', 'bauble'];
const ornamentArt: Record<Exclude<Ornament, 'bauble'>, () => ReactNode> = {
  gingerbread: () => <Gingerbread />, candy: () => <CandyCane />, robin: () => <Robin />,
  star: () => <StarOrnament />, mitten: () => <Mitten />, snowman: () => <SnowmanOrnament />,
};

function layout(points: Point[]) {
  const bulbs: { x: number; y: number; tilt: number }[] = [];
  const ornaments: { x: number; y: number; kind: Ornament; index: number }[] = [];
  for (let index = 1; index < points.length; index++) {
    const curve = segment(points, index);
    for (const t of [.16, .33, .67, .84]) {
      const point = bezier(curve, t);
      bulbs.push({ ...point, tilt: (bulbs.length % 2 ? 1 : -1) * (6 + (bulbs.length % 3) * 4) });
    }
    ornaments.push({ ...bezier(curve, .5), kind: ornamentCycle[(index - 1) % ornamentCycle.length], index });
  }
  return { bulbs, ornaments };
}

const layouts = [
  { name: 'desktop', height: desktopHeight, points: desktopPoints, path: garlandPath(desktopPoints), ...layout(desktopPoints) },
  { name: 'mobile', height: mobileHeight, points: mobilePoints, path: garlandPath(mobilePoints), ...layout(mobilePoints) },
];

export function GiftGarland({ days, preview, onSelect, labels, interactive = false }: {
  days: Calendar['days']; preview: boolean; onSelect: (day: number) => void;
  /** Overrides the caption under each gift (admin view). */ labels?: Record<number, string>;
  /** Lets every gift be clicked, even the locked ones (admin / debug). */ interactive?: boolean;
}) {
  const trail = useRef<HTMLDivElement>(null);
  return <div className="gift-trail" ref={trail}>
    {layouts.map(wire => <div key={wire.name} className={`garland-layer garland-${wire.name}`} aria-hidden="true">
      <svg className="garland-wire" viewBox={`0 0 1000 ${wire.height}`} preserveAspectRatio="none" fill="none">
        <path className="garland-shadow" d={wire.path} />
      </svg>
      <GarlandCanvas points={wire.points} height={wire.height} />
      {wire.ornaments.map(({ x, y, kind, index }) => {
        const style: Vars = {
          left: `${x / 10}%`, top: `${y}px`,
          '--len': `${[30, 46, 24, 38, 52][index % 5]}px`,
          '--swing': `${(3.2 + (index % 4) * .7).toFixed(1)}s`,
          '--delay': `${(-(index * .9) % 4).toFixed(1)}s`,
        };
        return <span key={index} className={`ornament ornament-${kind} ornament-tone-${index % 4}`} style={style}>
          <span className="ornament-swing">
            {kind !== 'robin' && <i className="ornament-thread" />}
            <span className="ornament-body">{kind === 'bauble' ? <i className="bauble"><i className="bauble-glint" /></i> : ornamentArt[kind]()}</span>
          </span>
        </span>;
      })}
      {wire.bulbs.map((bulb, index) =>
        <Bulb key={index} index={index} left={`${bulb.x / 10}%`} top={`${bulb.y}px`} tilt={bulb.tilt} />)}
    </div>)}
    {days.map(({ day, state }) => {
      const shown = preview ? 'available' : state;
      const point = desktopPoints[day - 1];
      const mobile = mobilePoints[day - 1];
      const style: Vars = {
        '--gift-x': `${point.x / 10}%`, '--gift-y': `${point.y}px`,
        '--mobile-x': `${mobile.x / 10}%`, '--mobile-y': `${mobile.y}px`,
        '--tie-length': `${[40, 56, 34, 50, 44, 62][day % 6]}px`,
        '--sway': `${(4.6 + (day % 5) * .55).toFixed(2)}s`,
        '--sway-delay': `${(-(day * 1.3) % 5).toFixed(1)}s`,
      };
      return <div className="gift-position" key={day} style={style}>
        <div className="gift-hang">
          <span className="gift-tie" aria-hidden="true" />
          {/* The button itself stays still (stable hit target); only its visual content sways on the tie. */}
          <button className={`gift-btn ${shown}`} disabled={!preview && !interactive && state === 'locked'}
            aria-label={`${day} décembre — ${labels?.[day] ?? (preview ? 'Prévisualiser' : stateLabels[state])}`} onClick={() => { if (state !== 'locked' || preview || interactive) playGiftOpening(); onSelect(day); }}>
            <span className="gift-sway" aria-hidden="true">
              {shown === 'available' && <span className="gift-halo"><i /><i /><i /></span>}
              <GiftBox variant={day % 6} label={String(day).padStart(2, '0')} state={shown} />
              <span className="gift-badge">{preview ? <ArrowUpRight /> : state === 'locked' ? <Lock /> : state === 'opened' ? <Check /> : <ArrowUpRight />}</span>
            </span>
          </button>
        </div>
        {(labels?.[day] ?? (preview ? 'Prévisualiser' : state === 'locked' ? '' : stateLabels[state])) !== '' && <span className={`gift-caption caption-${shown}`}>{labels?.[day] ?? (preview ? 'Prévisualiser' : stateLabels[state])}</span>}
      </div>;
    })}
  </div>;
}
