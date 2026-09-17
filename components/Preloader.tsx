'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap, registerGsap, prefersReducedMotion } from '@/lib/motion';
import { identity } from '@/lib/data';

/**
 * The cold open.
 *
 * Ported from "+24 Hero Animations/20 — Cinematic loader entrance": two
 * horizontal bands slide counter-directionally, then split apart along a
 * clip-path to reveal the page, like a film gate opening.
 *
 * Skipped entirely under reduced motion, and hard-capped at ~3.2s so it can
 * never become the thing standing between a recruiter and your work.
 */
export default function Preloader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setGone(true);
      onDone();
      return;
    }

    registerGsap();
    // Lock scroll while the curtain is down.
    document.body.style.overflow = 'hidden';

    const ctx = gsap.context(() => {
      const counter = { n: 0 };
      const tl = gsap.timeline({
        onComplete: () => {
          document.body.style.overflow = '';
          setGone(true);
          onDone();
        },
      });

      tl.to(counter, {
        n: 100,
        duration: 1.9,
        ease: 'power2.inOut',
        onUpdate: () => setCount(Math.round(counter.n)),
      })
        // Bands sweep past each other.
        .from(
          '.pl-band-top .pl-track',
          { xPercent: 12, duration: 2.1, ease: 'power3.inOut' },
          0
        )
        .from(
          '.pl-band-bottom .pl-track',
          { xPercent: -12, duration: 2.1, ease: 'power3.inOut' },
          0
        )
        // The seam draws across, then retracts as the gate opens.
        .fromTo(
          '.pl-seam',
          { scaleX: 0, opacity: 0 },
          { scaleX: 1, opacity: 1, duration: 1.7, ease: 'power3.inOut' },
          0.15
        )
        .to('.pl-meta', { opacity: 0, duration: 0.4, ease: 'power2.in' }, 1.75)
        .to(
          '.pl-seam',
          { scaleX: 0, transformOrigin: 'right', duration: 0.7, ease: 'power3.inOut' },
          1.9
        )
        // The gate opens.
        .to(
          '.pl-band-top',
          { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'power4.inOut' },
          1.95
        )
        .to(
          '.pl-band-bottom',
          { clipPath: 'inset(100% 0 0 0)', duration: 1.1, ease: 'power4.inOut' },
          1.95
        )
        .to('.pl-root', { autoAlpha: 0, duration: 0.3 }, 2.75);
    }, root);

    return () => {
      ctx.revert();
      document.body.style.overflow = '';
    };
  }, [onDone]);

  if (gone) return null;

  // The marquee alternates the name and the role. Both bands clip the SAME
  // line at the seam, so they must render byte-identical content — hence one
  // shared definition rather than two hand-written copies that can drift.
  // Styling may differ BETWEEN items (solid name, outlined role); it must
  // never differ between the two bands.
  const strip = [
    { text: identity.name.toUpperCase(), outlined: false },
    { text: identity.role.toUpperCase(), outlined: true },
  ];
  const items = Array.from({ length: 4 }).flatMap(() => strip);

  const Track = () => (
    <>
      {items.map((item, i) => (
        <span
          key={i}
          className={
            item.outlined
              ? 't-display text-transparent opacity-90 [-webkit-text-stroke:1px_var(--color-mute)]'
              : 't-display text-[var(--color-bone)] opacity-90'
          }
        >
          {item.text}
          <span className="mx-6 text-[var(--color-amber)] [-webkit-text-stroke:0]">
            /
          </span>
        </span>
      ))}
    </>
  );

  return (
    <div
      ref={root}
      className="pl-root fixed inset-0 z-[100] bg-[var(--color-void)]"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="sr-only">Loading, {count} percent</span>

      <div className="pl-band-top absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-[var(--color-void)]">
        <div className="pl-track absolute bottom-0 flex translate-y-1/2 items-center gap-8 whitespace-nowrap">
          <Track />
        </div>
      </div>

      {/* The seam. Both bands clip the SAME line at this exact y, so the two
          halves must carry identical text, size and styling — otherwise you
          see the top half of one string butted against the bottom half of
          another, which reads as garbage rather than a cut. */}
      <div className="pl-band-bottom absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-[var(--color-void)]">
        <div className="pl-track absolute top-0 flex -translate-y-1/2 items-center gap-8 whitespace-nowrap">
          <Track />
        </div>
      </div>

      {/* Hairline on the cut. It gives the shear a reason to exist — the two
          halves are sliding along a visible edge, not just misregistering. */}
      <span
        aria-hidden="true"
        className="pl-seam absolute left-0 top-1/2 z-10 block h-px w-full origin-left bg-[var(--color-amber)]"
      />

      <div className="pl-meta pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-6 p-[var(--gutter)] pb-8">
        <span className="t-mono max-w-[60%]">
          {identity.role} — {identity.location}
        </span>
        <span className="t-mono tabular-nums text-[var(--color-bone)]">
          {String(count).padStart(3, '0')}
        </span>
      </div>
    </div>
  );
}
