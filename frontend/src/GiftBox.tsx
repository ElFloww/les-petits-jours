import type { CSSProperties, ReactNode } from 'react';

type Vars = CSSProperties & Record<`--${string}`, string>;
export type BoxState = 'locked' | 'available' | 'opened';

// width, height, depth (px) and resting rotation of each of the six box models.
const models: [number, number, number, number][] = [
  [94, 74, 82, -28], [82, 86, 76, 24], [100, 68, 88, -20],
  [86, 90, 78, 30], [102, 72, 76, -32], [88, 82, 86, 22],
];

function Faces({ front }: { front?: ReactNode }) {
  return <>
    <i className="face f-front">{front}</i><i className="face f-back" />
    <i className="face f-right" /><i className="face f-left" />
    <i className="face f-top" /><i className="face f-bottom" />
  </>;
}

/** A gift box drawn as two real CSS 3D cuboids (body + lid), with a bow, a tag and a state. */
export function GiftBox({ variant, label, state, className = '' }: {
  variant: number; label?: string; state: BoxState; className?: string;
}) {
  const [width, height, depth, rotation] = models[variant % models.length];
  const style: Vars = { '--w': `${width}px`, '--h': `${height}px`, '--d': `${depth}px`, '--ry': `${rotation}deg` };
  return <span className={`box3d box-v${variant % models.length} box-${state} ${className}`} style={style} aria-hidden="true">
    <span className="cuboid box-body"><Faces front={label && <b className="box-tag">{label}</b>} /></span>
    <span className="cuboid box-lid">
      <Faces />
      {state === 'locked' && <i className="snowcap" />}
      <span className="box-bow"><i /><i /><b /></span>
    </span>
    {state === 'opened' && <span className="box-magic"><i /><i /><i /><i /></span>}
  </span>;
}
