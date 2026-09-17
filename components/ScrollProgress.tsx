'use client';

import { useEffect, useState } from 'react';

/**
 * Reading-progress rail, pinned to the right edge.
 *
 * The scrollytelling literature is blunt about this: a long scroll-driven
 * page without a length indicator leaves people unsure how much they have
 * committed to. This is the cheapest possible fix — one transform-only bar
 * and a percentage readout.
 *
 * It is information, not decoration, so it stays on under reduced motion;
 * only the easing transition is dropped.
 */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };

    // rAF-throttled: scroll fires far more often than we can usefully paint.
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed right-[var(--gutter)] top-1/2 z-[65] hidden -translate-y-1/2 flex-col items-center gap-3 md:flex"
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <span className="font-mono text-[0.6rem] tracking-[0.2em] text-[var(--color-mute)] tabular-nums">
        {String(Math.round(progress * 100)).padStart(2, '0')}
      </span>
      <span className="relative block h-32 w-px bg-[var(--color-line)]">
        <span
          className="absolute inset-x-0 top-0 origin-top bg-[var(--color-amber)]"
          style={{ height: `${progress * 100}%` }}
        />
      </span>
    </div>
  );
}
