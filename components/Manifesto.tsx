'use client';

import { useEffect, useRef } from 'react';
import { gsap, registerGsap, prefersReducedMotion } from '@/lib/motion';
import { manifesto } from '@/lib/data';

/**
 * Act I — the thesis.
 *
 * Words brighten from muted to bone as the section scrolls through, scrubbed
 * to scroll position so the reader sets the pace. From "+14 Text Animations/1
 * — on-scroll text motion", reduced to its most restrained form: this section
 * is the one place on the site where the words should out-shout the motion.
 */
export default function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    registerGsap();
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.man-word',
        { opacity: 0.12 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.35,
          scrollTrigger: {
            trigger: el,
            start: 'top 72%',
            end: 'bottom 62%',
            scrub: 0.8,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="border-t border-[var(--color-line)] py-24 md:py-40"
      aria-label={manifesto.eyebrow}
    >
      <div className="shell">
        <p className="t-mono mb-10">Act I — {manifesto.eyebrow}</p>
        <p className="t-h2 max-w-5xl text-balance leading-[1.1]">
          {manifesto.lines.map((line, li) => (
            <span key={li} className="block">
              {line.split(' ').map((word, wi) => (
                <span key={wi} className="man-word inline-block">
                  {word}
                  {/* Non-breaking space keeps the inline-block words apart
                      without letting the line collapse at narrow widths. */}
                  {' '}
                </span>
              ))}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
