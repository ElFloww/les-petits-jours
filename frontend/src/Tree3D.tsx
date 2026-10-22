import { useEffect, useRef, useState } from 'react';
import { ChristmasTree } from './ChristmasTree';
import type { TreeHandle } from './realTreeScene';

function webglAvailable() {
  if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch { return false; }
}

/**
 * The realistic 3D fir (three.js, loaded on demand). While it loads — or when WebGL is
 * unavailable — the illustrated SVG tree is shown instead, so the page is never empty.
 */
export function Tree3D({ className = '', quality, snow = true }: { className?: string; quality?: 'high' | 'low'; snow?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [supported] = useState(webglAvailable);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supported || !host.current) return;
    const element = host.current;
    let handle: TreeHandle | undefined;
    let cancelled = false;
    const small = window.matchMedia?.('(max-width: 760px), (pointer: coarse)').matches ?? false;
    const chosen = quality ?? (small ? 'low' : 'high');
    // Let the first paint happen before the (CPU heavy) tree generation.
    const timer = window.setTimeout(() => {
      void import('./realTreeScene').then(({ mountTree }) => {
        if (cancelled) return;
        try {
          handle = mountTree(element, { quality: chosen, snow });
          setReady(true);
        } catch { setFailed(true); }
      }).catch(() => setFailed(true));
    }, 60);
    const observer = new IntersectionObserver(([entry]) => handle?.setVisible(entry.isIntersecting), { rootMargin: '120px' });
    observer.observe(element);
    return () => { cancelled = true; window.clearTimeout(timer); observer.disconnect(); handle?.dispose(); };
  }, [supported, quality, snow]);

  if (!supported || failed) return <ChristmasTree className={className} />;
  return <div className={`rtree ${ready ? 'rtree-ready' : ''} ${className}`} ref={host} aria-hidden="true">
    <ChristmasTree className="rtree-fallback" />
  </div>;
}
