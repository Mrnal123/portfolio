'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* GSAP plugins are registered exactly once, on the client only. */
let registered = false;
export function registerGsap() {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export { gsap, ScrollTrigger };

/** useLayoutEffect that does not warn during SSR. */
export const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * The single source of truth for "should this animate?".
 * Reads the media query live, so toggling the OS setting takes effect
 * without a reload.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true; // SSR: assume the safe path
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(): boolean {
  // Start `true` so the first client render matches the SSR markup and
  // nothing is hidden before we know the user's preference.
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * True only on a device that can actually afford WebGL spectacle.
 * Checks pointer type, core count, device memory and WebGL availability.
 * Anything that fails drops to the CSS fallback path.
 */
export function useHighEndDevice(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth < 768;

    // Phones get the 2D fallback regardless of specs — sustained WebGL
    // drains battery and thermal-throttles into a worse experience.
    if (coarse || narrow) return;
    if (cores < 4 || memory < 4) return;

    // Confirm a real WebGL context is obtainable before promising one.
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!gl) return;
      const lose = (gl as WebGLRenderingContext).getExtension(
        'WEBGL_lose_context'
      );
      lose?.loseContext();
    } catch {
      return;
    }

    setCapable(true);
  }, []);

  return capable;
}

/**
 * Splits an element's text into line-wrapped spans for masked reveals.
 * Returns a cleanup that restores the original markup — important because
 * ScrollTrigger refreshes on resize and we re-split from clean text.
 */
export function splitLines(el: HTMLElement): () => void {
  const original = el.innerHTML;
  const text = el.textContent ?? '';
  const words = text.split(/\s+/).filter(Boolean);

  el.innerHTML = '';
  const probe = document.createElement('span');
  probe.style.display = 'inline';

  // Measure where the browser actually wraps, then group words into lines.
  const wordSpans = words.map((w) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.display = 'inline-block';
    el.appendChild(s);
    el.appendChild(document.createTextNode(' '));
    return s;
  });

  const lines: string[][] = [];
  let currentTop: number | null = null;
  wordSpans.forEach((span, i) => {
    const top = span.offsetTop;
    if (currentTop === null || top !== currentTop) {
      lines.push([]);
      currentTop = top;
    }
    lines[lines.length - 1].push(words[i]);
  });

  probe.remove();
  el.innerHTML = lines
    .map(
      (line) =>
        `<span class="split-line"><span>${line.join(' ')}</span></span>`
    )
    .join('');

  return () => {
    el.innerHTML = original;
  };
}

/** Writes the true viewport height to --vh. Mobile browser chrome lies. */
export function useViewportHeight() {
  useEffect(() => {
    const set = () => {
      document.documentElement.style.setProperty(
        '--vh',
        `${window.innerHeight}px`
      );
    };
    set();
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    return () => {
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);
}
