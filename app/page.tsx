'use client';

import { useCallback, useEffect, useState } from 'react';
import SmoothScroll from '@/components/SmoothScroll';
import Preloader from '@/components/Preloader';
import Cursor from '@/components/Cursor';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Manifesto from '@/components/Manifesto';
import Pipeline from '@/components/Pipeline';
import Work from '@/components/Work';
import CardStack from '@/components/CardStack';
import Experience from '@/components/Experience';
import Contact from '@/components/Contact';
import ScrollProgress from '@/components/ScrollProgress';

/**
 * The narrative spine, in order:
 *
 *   0  Cold open      — the film gate opens
 *   I  Hero           — noise resolves into a name
 *   I  Manifesto      — the thesis, one line at a time
 *  II  Pipeline       — five stages, pinned (the scrollytelling core)
 * III  Work           — the evidence
 *  IV  Capability     — what I actually do, as a card fan
 *   V  Path + toolkit — where I have been
 *  VI  Contact        — the close
 *
 * Every beat earns its motion: each one shows a change of state that the
 * prose is describing, rather than decorating text that would read fine still.
 */
export default function Page() {
  const [ready, setReady] = useState(false);
  const onDone = useCallback(() => setReady(true), []);

  // The hero's start state is held in CSS so it cannot flash in its final
  // position before GSAP takes over. That makes `ready` load-bearing: if the
  // preloader ever failed to call back, the hero would stay hidden forever.
  // This releases it regardless, well after the intro would normally finish.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 4500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <SmoothScroll>
      <Preloader onDone={onDone} />
      <Cursor />
      <ScrollProgress />
      <Nav />

      <main id="main">
        <Hero ready={ready} />
        <Manifesto />
        <Pipeline />
        <Work />
        <CardStack />
        <Experience />
      </main>

      <Contact />
    </SmoothScroll>
  );
}
