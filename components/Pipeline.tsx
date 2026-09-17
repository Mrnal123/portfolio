'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ScrollTrigger,
  registerGsap,
  useReducedMotion,
} from '@/lib/motion';
import { pipeline } from '@/lib/data';
import PipelineVisual from './PipelineVisual';
import { SplitHeading } from './ui';

/**
 * The scrollytelling spine — the classic side-by-side sticky pattern.
 *
 * Text steps scroll in the left column; the visual stays stuck in the right
 * and re-renders as the active step changes. Uses CSS `position: sticky`
 * rather than JS pinning, so it degrades gracefully and costs nothing.
 *
 * ScrollTrigger is used only to *detect* the active step — it never drives
 * layout — which means the reduced-motion path keeps full step tracking with
 * zero animation.
 *
 * Mobile stacks it: the visual sticks to the top of the viewport at 38svh and
 * the prose scrolls underneath, so text and motion never fight for the same
 * pixels (the "text-graphics conflict" anti-pattern).
 */
export default function Pipeline() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    registerGsap();

    const triggers = pipeline.map((_, i) =>
      ScrollTrigger.create({
        trigger: el.querySelector(`#step-${i}`) as HTMLElement,
        start: 'top 60%',
        end: 'bottom 60%',
        onEnter: () => setActive(i),
        onEnterBack: () => setActive(i),
      })
    );

    return () => triggers.forEach((t) => t.kill());
  }, []);

  const step = pipeline[active];

  return (
    <section
      ref={root}
      id="pipeline"
      className="relative scroll-mt-0 border-t border-[var(--color-line)] py-20 md:py-32"
      aria-label="How I work"
    >
      <div className="shell">
        <header className="mb-14 md:mb-24">
          <p className="t-mono mb-4">Act II — The method</p>
          <SplitHeading
            text="Five stages between a dataset and something someone uses."
            className="t-h2 max-w-3xl text-balance"
          />
        </header>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_1.05fr] md:gap-16">
          {/* ---- Sticky visual -------------------------------------- */}
          {/* Source order puts the visual first so it sticks to the top on
              mobile; `md:order-2` moves it to the right on desktop. */}
          <div className="sticky top-0 z-10 -mx-[var(--gutter)] h-[38svh] bg-[var(--color-void)] md:order-2 md:mx-0 md:h-[100svh] md:bg-transparent">
            <div className="relative h-full w-full">
              <PipelineVisual mode={step.mode} reduced={reduced} />

              {/* Live step readout, overlaid on the visual.
                  Top padding clears the fixed header — without it the step
                  index collides with the logo and menu button. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 pt-[calc(var(--header-h)+0.5rem)] md:p-8 md:pt-[calc(var(--header-h)+1rem)]">
                <div className="flex items-start justify-between">
                  <span className="t-mono text-[var(--color-amber)]">
                    {step.index} / {String(pipeline.length).padStart(2, '0')}
                  </span>
                  <span className="t-mono">{step.id}</span>
                </div>

                <div>
                  <p className="font-mono text-3xl leading-none text-[var(--color-bone)] md:text-5xl">
                    {step.metric.value}
                  </p>
                  <p className="t-mono mt-2">{step.metric.label}</p>
                </div>
              </div>

              {/* Progress rail */}
              <div
                className="absolute bottom-0 left-0 h-px w-full bg-[var(--color-line)]"
                aria-hidden="true"
              >
                <div
                  className="h-full bg-[var(--color-amber)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{
                    width: `${((active + 1) / pipeline.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            {/* On mobile the prose scrolls directly beneath the sticky visual,
                so it needs a hard edge — otherwise text appears to swim out
                from under the canvas. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--color-void)] md:hidden" />
          </div>

          {/* ---- Scrolling prose ------------------------------------ */}
          <ol className="md:order-1">
            {pipeline.map((s, i) => (
              <li
                key={s.id}
                id={`step-${i}`}
                className="flex min-h-[62svh] flex-col justify-center border-b border-[var(--color-line)] py-12 last:border-b-0 md:min-h-[100svh] md:py-0"
              >
                <div
                  className="transition-opacity duration-500 motion-reduce:transition-none"
                  // Dimming inactive steps is the standard scrollytelling
                  // focus cue. Inactive text stays at 0.4 — still readable,
                  // and fully opaque for anyone who prefers reduced motion.
                  style={{ opacity: reduced ? 1 : active === i ? 1 : 0.4 }}
                >
                  <div className="mb-5 flex items-center gap-4">
                    <span className="t-mono text-[var(--color-amber)]">
                      {s.index}
                    </span>
                    <span className="h-px flex-1 bg-[var(--color-line)]" />
                  </div>

                  <h3 className="t-h1 mb-5">{s.title}</h3>
                  <p className="t-body max-w-md text-pretty">{s.body}</p>
                  {/* No inline metric here: the sticky visual above already
                      shows the active step's figure, and repeating it made
                      two different numbers sit inches apart mid-transition. */}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
