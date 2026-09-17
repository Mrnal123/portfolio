'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import {
  gsap,
  ScrollTrigger,
  registerGsap,
  prefersReducedMotion,
  useViewportHeight,
} from '@/lib/motion';

/**
 * Wires Lenis inertia scrolling into GSAP's ticker so every ScrollTrigger
 * reads the same clock. This is the pattern both reference sites use and it
 * is the difference between "animated" and "buttery".
 *
 * Reduced motion gets no Lenis at all — native scroll, no interception.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useViewportHeight();

  useEffect(() => {
    registerGsap();

    // Tell CSS that JS is alive, so the pre-animation hidden states apply.
    // Without this class, every reveal renders visible — a real no-JS page.
    document.documentElement.classList.add('js-ready');

    if (prefersReducedMotion()) {
      // Content stays fully visible; ScrollTrigger still drives the
      // section-progress indicator, which is motion-free information.
      ScrollTrigger.refresh();
      return () => {
        document.documentElement.classList.remove('js-ready');
      };
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Never smooth touch — it fights native momentum and feels broken.
      syncTouch: false,
      touchMultiplier: 1.6,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Anchor links must route through Lenis or they jump past pinned sections.
    const onAnchorClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href^="#"]'
      );
      if (!anchor) return;
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: 0, duration: 1.4 });
      // Move focus so keyboard users land where the page just scrolled.
      (target as HTMLElement).setAttribute('tabindex', '-1');
      (target as HTMLElement).focus({ preventScroll: true });
    };

    document.addEventListener('click', onAnchorClick);

    // Recalculate after fonts land — display type shifts line boxes.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      document.removeEventListener('click', onAnchorClick);
      gsap.ticker.remove(raf);
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      document.documentElement.classList.remove('js-ready');
    };
  }, []);

  return <>{children}</>;
}
