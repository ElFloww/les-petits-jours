import { useId } from 'react';
import { cachedFir, Fillers, Foliage, StaticBaubles } from './ChristmasTree';

/** x, ground y, scale, variant (0 | 1), decorated */
export type TreePlace = [number, number, number, number, boolean?];

const variants = [{ seed: 3, tiers: 8 }, { seed: 11, tiers: 7 }];
const fir = (variant: number) => cachedFir(variants[variant].seed, variants[variant].tiers, .5, .62);
const place = ([x, ground, scale]: TreePlace) => `translate(${x} ${ground}) scale(${scale}) translate(-200 -528)`;

/** Static realistic firs for the background scenery. Each variant is drawn once and instanced with <use>. */
export function ForestTrees({ places, tint = '' }: { places: TreePlace[]; tint?: string }) {
  const id = useId().replace(/:/g, '');
  return <g className={tint}>
    <defs>
      {variants.map((_, v) => {
        const tree = fir(v);
        return <g key={v} id={`${id}-fir${v}`}>
          <path d="M187 440h26l5 90h-36Z" fill="#4a2e22" />
          <Fillers fir={tree} fill="#0b3a2c" />
          <Foliage boughs={tree.boughs} />
        </g>;
      })}
      <g id={`${id}-deco`}>
        <StaticBaubles fir={fir(0)} every={4} offset={1} />
      </g>
    </defs>
    {places.map((p, i) => <g key={i} transform={place(p)}>
      <use href={`#${id}-fir${p[3]}`} />
      {p[4] && p[3] === 0 && <use href={`#${id}-deco`} />}
    </g>)}
  </g>;
}

/** Animated fairy lights for the same places — kept apart so the foliage layer stays static. */
export function ForestLights({ places }: { places: TreePlace[] }) {
  return <>
    {places.map((p, i) => {
      const tree = fir(p[3]);
      const [x, ground, scale] = p;
      const spots = [...tree.mids, ...tree.tips].filter((_, k) => (k + i) % 4 === 0);
      return <g key={i}>
        {spots.map((s, k) => <circle key={k} className={`tree-light tl-${(k + i) % 4}`} r={Math.max(1.5, 7 * scale)}
          cx={(x + (s.x - 200) * scale).toFixed(1)} cy={(ground + (s.y + 5 - 528) * scale).toFixed(1)} />)}
        <path className="tree-star" transform={`translate(${x} ${(ground + (56 - 528) * scale).toFixed(1)}) scale(${(scale * 2.2).toFixed(2)})`}
          d="M0-9l2.6 5.8 6.3.7-4.7 4.3 1.3 6.2L0 4.7l-5.5 3.1 1.3-6.2-4.700-4.300 6.300-.7Z" fill="#ffd772" />
      </g>;
    })}
  </>;
}
