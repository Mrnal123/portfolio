'use client';

import { useEffect, useRef } from 'react';
import { gsap, registerGsap, prefersReducedMotion } from '@/lib/motion';

/**
 * Custom cursor — a lagging ring plus a tight dot.
 *
 * From "+19 Mouse Effect/19", using the same `gsap.quickTo` approach the
 * truus-clone reference uses for its cursor bubble: quickTo mutates a single
 * cached tween instead of allocating one per pointermove.
 *
 * Renders nothing at all on touch devices or under reduced motion, so the
 * native cursor and full-size touch targets are never taken away.
 */
export default function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    registerGsap();
    const ringEl = ring.current;
    const dotEl = dot.current;
    if (!ringEl || !dotEl) return;

    document.body.classList.add('cursor-host');
    gsap.set([ringEl, dotEl], { autoAlpha: 0, xPercent: -50, yPercent: -50 });

    const ringX = gsap.quickTo(ringEl, 'x', { duration: 0.5, ease: 'power3' });
    const ringY = gsap.quickTo(ringEl, 'y', { duration: 0.5, ease: 'power3' });
    const dotX = gsap.quickTo(dotEl, 'x', { duration: 0.12, ease: 'power3' });
    const dotY = gsap.quickTo(dotEl, 'y', { duration: 0.12, ease: 'power3' });

    // A one-shot "shown" flag strands the cursor: once the pointer leaves the
    // window, the hide tween runs and the flag never resets, so the cursor
    // stays invisible forever while `cursor: none` hides the native one too —
    // leaving no cursor at all. Track visibility as state that BOTH handlers
    // can flip instead.
    let visible = false;

    const show = () => {
      if (visible) return;
      visible = true;
      gsap.to([ringEl, dotEl], { autoAlpha: 1, duration: 0.25, overwrite: 'auto' });
    };

    const hide = () => {
      if (!visible) return;
      visible = false;
      gsap.to([ringEl, dotEl], { autoAlpha: 0, duration: 0.2, overwrite: 'auto' });
    };

    const onMove = (e: PointerEvent) => {
      // Jump straight to the pointer the first time, so the cursor fades in
      // where the mouse actually is rather than flying in from the origin.
      if (!visible) {
        gsap.set([ringEl, dotEl], { x: e.clientX, y: e.clientY });
      }
      show();
      ringX(e.clientX);
      ringY(e.clientY);
      dotX(e.clientX);
      dotY(e.clientY);
    };

    // Grow the ring over anything interactive.
    const onOver = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest(
        'a, button, [data-cursor="grow"]'
      );
      gsap.to(ringEl, {
        scale: t ? 2.1 : 1,
        borderColor: t
          ? 'var(--color-amber)'
          : 'rgba(239,235,227,0.4)',
        duration: 0.35,
        ease: 'power3.out',
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    // documentElement, not document: pointerleave on `document` is unreliable
    // across browsers, and window blur covers alt-tabbing away.
    document.documentElement.addEventListener('pointerleave', hide);
    document.documentElement.addEventListener('pointerenter', show);
    window.addEventListener('blur', hide);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      document.documentElement.removeEventListener('pointerleave', hide);
      document.documentElement.removeEventListener('pointerenter', show);
      window.removeEventListener('blur', hide);
      document.body.classList.remove('cursor-host');
    };
  }, []);

  return (
    // Must outrank every full-screen overlay. At z-70 the menu panel (z-75)
    // and the preloader (z-100) painted straight over it, and because
    // `cursor: none` is on <body> the native pointer was hidden too — so
    // those surfaces had no cursor at all. Only the skip link (z-200), a
    // real focusable control, sits above this.
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[150] hidden [@media(pointer:fine)]:block">
      <div
        ref={ring}
        className="fixed left-0 top-0 h-9 w-9 rounded-full border border-[rgba(239,235,227,0.4)] opacity-0 will-change-transform"
      />
      <div
        ref={dot}
        className="fixed left-0 top-0 h-1 w-1 rounded-full bg-[var(--color-amber)] opacity-0 will-change-transform"
      />
    </div>
  );
}
