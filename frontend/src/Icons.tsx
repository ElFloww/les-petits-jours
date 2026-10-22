import type { SVGProps } from 'react';

/**
 * Inline SVG icons. They replace Unicode glyphs (↗ ✳ ❄ ♡ ✓ ↻ …) that iOS and Android
 * silently turn into colour emojis, so the interface looks the same on every device.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{children}</svg>;
}

export const ArrowUpRight = (p: IconProps) => <Icon {...p}><path d="M7 17 17 7M8.5 7H17v8.5" /></Icon>;
export const ArrowLeft = (p: IconProps) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const ArrowRight = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ArrowUp = (p: IconProps) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>;
export const ArrowDown = (p: IconProps) => <Icon {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Icon>;
export const Check = (p: IconProps) => <Icon {...p} strokeWidth="2.6"><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const Refresh = (p: IconProps) => <Icon {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></Icon>;
export const Close = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const Plus = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;

export const Heart = (p: IconProps) => <Icon {...p} fill="currentColor" stroke="none">
  <path d="M12 21.2C5.4 16.3 2.5 12.9 2.5 8.9A5 5 0 0 1 12 6.6a5 5 0 0 1 9.5 2.3c0 4-2.9 7.4-9.5 12.3Z" />
</Icon>;

/** Six-armed snowflake with little branches — used for the brand mark and falling crystals. */
export const Snowflake = (p: IconProps) => <Icon {...p} strokeWidth="1.7">
  <g>
    {[0, 60, 120].map(angle => <g key={angle} transform={`rotate(${angle} 12 12)`}>
      <path d="M12 2v20" /><path d="m9 4.6 3 2.6 3-2.6M9 19.4l3-2.6 3 2.6" />
    </g>)}
  </g>
</Icon>;

/** Four-pointed sparkle (replaces ✧ ✦). */
export const Sparkle = (p: IconProps) => <Icon {...p} fill="currentColor" stroke="none">
  <path d="M12 1.5c.9 5.6 3.3 8.7 8.9 9.7v1.6c-5.6 1-8 4.1-8.9 9.7h-.1c-.9-5.6-3.3-8.7-8.9-9.7v-1.6c5.6-1 8-4.100 8.9-9.700Z" />
</Icon>;
