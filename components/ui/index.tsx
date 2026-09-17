'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  gsap,
  ScrollTrigger,
  registerGsap,
  prefersReducedMotion,
  splitLines,
  useIsoLayoutEffect,
} from '@/lib/motion';

/* ==========================================================================
 * Reveal — the workhorse scroll-triggered entrance.
 * Uses `data-reveal`, which CSS hides ONLY when `.js-ready` is on <html>.
 * ======================================================================== */

export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  y = 40,
  className = '',
}: {
  children: ReactNode;
  as?: 'div' | 'section' | 'li' | 'article' | 'span' | 'p';
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsap();

    if (prefersReducedMotion()) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [delay, y]);

  return (
    // @ts-expect-error — polymorphic tag, ref type widens correctly at runtime
    <Tag ref={ref} data-reveal className={className}>
      {children}
    </Tag>
  );
}

/* ==========================================================================
 * SplitHeading — line-masked headline reveal.
 * Re-splits on resize because line breaks move with the viewport.
 * ======================================================================== */

export function SplitHeading({
  text,
  className = '',
  as: Tag = 'h2',
  stagger = 0.09,
}: {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  stagger?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsap();
    if (prefersReducedMotion()) return;

    let restore: (() => void) | null = null;
    let ctx: gsap.Context | null = null;

    const build = () => {
      restore?.();
      ctx?.revert();
      restore = splitLines(el);
      ctx = gsap.context(() => {
        gsap.to(el.querySelectorAll('.split-line > span'), {
          y: '0%',
          duration: 1.1,
          stagger,
          ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      }, el);
    };

    build();

    // Debounced: resize fires continuously and re-splitting is layout-heavy.
    let t: number;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        build();
        ScrollTrigger.refresh();
      }, 220);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
      ctx?.revert();
      restore?.();
    };
  }, [text, stagger]);

  return (
    <Tag ref={ref as never} className={className}>
      {text}
    </Tag>
  );
}

/* ==========================================================================
 * Magnetic — element leans toward the cursor.
 * From "+24 Hover Effects/19 Magnetic cards". Pointer-fine only.
 * ======================================================================== */

export function Magnetic({
  children,
  strength = 0.35,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    registerGsap();
    const xTo = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.4)' });

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/* ==========================================================================
 * Marquee — infinite scrolling band. CSS animation, not JS.
 * Duplicated track so the loop seam is invisible.
 * ======================================================================== */

export function Marquee({
  words,
  speed = 40,
  reverse = false,
}: {
  words: readonly string[];
  speed?: number;
  reverse?: boolean;
}) {
  const track = [...words, ...words];
  return (
    <div
      className="relative flex overflow-hidden border-y border-[var(--color-line)] py-5"
      aria-hidden="true"
    >
      <div
        className="flex shrink-0 items-center gap-10 whitespace-nowrap will-change-transform motion-reduce:animate-none"
        style={{
          animation: `marquee ${speed}s linear infinite${reverse ? ' reverse' : ''}`,
        }}
      >
        {track.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="t-mono flex items-center gap-10 text-[0.8rem] tracking-[0.3em] text-[var(--color-mute)]"
          >
            {w}
            <span className="inline-block h-1 w-1 rounded-full bg-[var(--color-amber)]" />
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translate3d(0,0,0); }
          to   { transform: translate3d(-50%,0,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] > div { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ==========================================================================
 * Counter — number counts up when scrolled into view.
 * Renders the final value immediately under reduced motion.
 * ======================================================================== */

export function Counter({
  value,
  suffix = '',
  decimals,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  // Derive precision from the value itself. Defaulting to 1 decimal place
  // silently rounded 98.29 to "98.3" — misreporting a real measured figure,
  // which is worse than any animation bug on this page.
  const places =
    decimals ??
    (Number.isInteger(value) ? 0 : (String(value).split('.')[1] ?? '').length);

  // Grouping separators so 4803 reads as "4,803".
  const format = (n: number) =>
    n.toLocaleString('en-US', {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    });

  const [display, setDisplay] = useState(() => format(value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsap();

    if (prefersReducedMotion()) {
      setDisplay(format(value));
      return;
    }

    const obj = { n: 0 };
    setDisplay(format(0));

    const ctx = gsap.context(() => {
      gsap.to(obj, {
        n: value,
        duration: 2,
        ease: 'power2.out',
        onUpdate: () => setDisplay(format(obj.n)),
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    }, el);

    return () => ctx.revert();
  }, [value, places]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}
