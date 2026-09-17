'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { gsap, registerGsap, prefersReducedMotion, useHighEndDevice } from '@/lib/motion';
import { identity } from '@/lib/data';

// Three.js is ~600KB. It must never be in the initial bundle, and must never
// run on the server — so it loads on demand, client-side only, and only after
// useHighEndDevice() has said this machine can afford it.
const ParticleField = dynamic(() => import('./webgl/ParticleField'), {
  ssr: false,
});

export default function Hero({ ready }: { ready: boolean }) {
  const root = useRef<HTMLElement>(null);
  const intro = useRef<gsap.core.Timeline | null>(null);
  const webglOk = useHighEndDevice();

  // Build the intro ONCE, at mount, paused.
  //
  // It used to be built when `ready` flipped — but `ready` flips from the
  // Preloader's onComplete, which is immediately followed by the Preloader
  // unmounting and calling ctx.revert(). The hero timeline was being created
  // and killed inside that same tick, so its first fromTo rendered the
  // start state and then never played: the headline stayed stuck offscreen
  // while the later tweens showed their end state.
  //
  // Creating it up front and merely play()-ing it later removes the race.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    registerGsap();
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      // Mirror the start state CSS already holds, so GSAP has explicit
      // numeric origins rather than resolving a percentage mid-flight.
      gsap.set('.hero-line > span', { yPercent: 108 });
      gsap.set('.hero-fade', { opacity: 0, y: 24 });
      gsap.set('.hero-rule', { scaleX: 0, transformOrigin: 'left' });

      const tl = gsap.timeline({ paused: true, delay: 0.1 });
      tl.to('.hero-line > span', {
        yPercent: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: 'power4.out',
      })
        .to(
          '.hero-fade',
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' },
          '-=0.7'
        )
        .to(
          '.hero-rule',
          { scaleX: 1, duration: 1.1, ease: 'power3.inOut' },
          '-=0.8'
        );

      intro.current = tl;

      // The whole hero drifts up and dims as you scroll past it — a depth cue
      // that hands the viewer off to the next section.
      gsap.to('.hero-parallax', {
        yPercent: -18,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
    }, el);

    return () => {
      intro.current = null;
      ctx.revert();
    };
  }, []);

  // Release the intro once the preloader is out of the way.
  useEffect(() => {
    if (ready) intro.current?.play();
  }, [ready]);

  return (
    <section
      ref={root}
      id="hero"
      className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden pb-10"
    >
      {/* --- Backdrop ------------------------------------------------- *
        * The headline sits bottom-left, so the particle field is pushed to
        * the upper-right rather than centred — otherwise the letterforms
        * collide with the name and neither reads.                        */}
      <div className="hero-parallax pointer-events-none absolute inset-0 -z-10">
        {webglOk ? (
          <ParticleField
            text={identity.initials}
            className="absolute right-0 top-0 h-[72%] w-full opacity-90 md:left-auto md:w-[58%]"
          />
        ) : (
          // 2D fallback: a soft aurora wash. Mobile and low-power machines get
          // atmosphere without a GPU bill.
          <div className="absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-amber)] opacity-[0.12] blur-[90px]" />
            <div className="absolute left-[38%] top-[42%] h-[45vmin] w-[45vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-teal)] opacity-[0.10] blur-[80px]" />
            {/* Sits high, matching where the WebGL field renders, so it
                never lands on top of the headline or the status line. */}
            <div
              aria-hidden="true"
              className="t-display absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 select-none text-transparent opacity-[0.07] [-webkit-text-stroke:1px_var(--color-bone)]"
            >
              {identity.initials}
            </div>
          </div>
        )}
      </div>

      {/* --- Content -------------------------------------------------- */}
      <div className="hero-parallax shell relative">
        <p className="hero-fade t-mono mb-6 flex items-center gap-3">
          {identity.available && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-amber)] opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-amber)]" />
            </span>
          )}
          {identity.availableLabel}
        </p>

        <h1 className="t-display mb-8">
          <span className="hero-line block overflow-hidden">
            <span className="block">{identity.name.split(' ')[0]}</span>
          </span>
          <span className="hero-line block overflow-hidden">
            <span className="block text-transparent [-webkit-text-stroke:1px_var(--color-bone)]">
              {identity.name.split(' ').slice(1).join(' ')}
            </span>
          </span>
        </h1>

        <hr className="hero-rule rule mb-8" />

        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="hero-fade t-lead max-w-xl text-balance">
            {identity.tagline}
          </p>
          <div className="hero-fade flex flex-col gap-1 md:text-right">
            <span className="t-mono">{identity.role}</span>
            <span className="t-mono">{identity.location}</span>
          </div>
        </div>
      </div>

      {/* --- Scroll cue ------------------------------------------------ */}
      <div className="hero-fade shell mt-12 flex items-center gap-3">
        <span className="t-mono">Scroll</span>
        <span className="relative block h-px w-16 overflow-hidden bg-[var(--color-line)]">
          <span className="absolute inset-y-0 left-0 w-1/3 bg-[var(--color-amber)] motion-safe:animate-[cue_2.2s_ease-in-out_infinite]" />
        </span>
      </div>

      <style>{`
        @keyframes cue {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </section>
  );
}
