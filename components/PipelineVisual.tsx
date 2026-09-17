'use client';

import { useEffect, useRef } from 'react';
import type { PipelineStep } from '@/lib/data';

type Mode = PipelineStep['mode'];

const COUNT = 420;
const AMBER = [233, 165, 92] as const;
const TEAL = [63, 184, 196] as const;

type Dot = {
  x: number; y: number;      // current
  tx: number; ty: number;    // target
  seed: number;
  cluster: number;
  tone: number;              // 0 = teal, 1 = amber
};

/**
 * The sticky visual for the pipeline section.
 *
 * Deliberately Canvas 2D rather than a second WebGL context: the hero already
 * owns the page's only Three.js instance, and a 2D point field morphs between
 * states just as convincingly at a fraction of the cost — which means phones
 * get the real visual instead of a static fallback.
 *
 * Each mode is a literal depiction of the step being described:
 *   scatter  → raw unstructured data
 *   cluster  → features grouping into an embedding space
 *   converge → training pulling everything toward a decision boundary
 *   grid     → evaluation, laid out in an ordered matrix
 *   stream   → deployment, flowing continuously through a pipe
 */
export default function PipelineVisual({
  mode,
  reduced,
}: {
  mode: Mode;
  reduced: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;

    const dots: Dot[] = Array.from({ length: COUNT }, (_, i) => ({
      x: 0, y: 0, tx: 0, ty: 0,
      seed: Math.random(),
      cluster: i % 5,
      tone: Math.random(),
    }));

    /** Recompute every dot's target for the active mode. */
    const layout = (m: Mode, t: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.38;

      dots.forEach((d, i) => {
        const n = i / COUNT;

        switch (m) {
          case 'scatter': {
            // Uniform noise, drifting — nothing is organised yet.
            const a = d.seed * Math.PI * 2 + t * 0.08;
            const r = R * (0.25 + d.seed * 1.1);
            d.tx = cx + Math.cos(a) * r * (0.6 + Math.sin(t * 0.3 + i) * 0.4);
            d.ty = cy + Math.sin(a * 1.3) * r * 0.85;
            break;
          }
          case 'cluster': {
            // Five tight groups — features finding their neighbourhoods.
            const ca = (d.cluster / 5) * Math.PI * 2 + t * 0.12;
            const ccx = cx + Math.cos(ca) * R * 0.62;
            const ccy = cy + Math.sin(ca) * R * 0.62;
            const sa = d.seed * Math.PI * 2;
            const sr = R * 0.2 * d.seed;
            d.tx = ccx + Math.cos(sa) * sr;
            d.ty = ccy + Math.sin(sa) * sr;
            break;
          }
          case 'converge': {
            // A ring collapsing inward — the loss surface finding a minimum.
            const a = n * Math.PI * 2 + t * 0.25;
            const pull = 0.25 + Math.sin(t * 0.6) * 0.06;
            d.tx = cx + Math.cos(a) * R * pull * (0.5 + d.seed);
            d.ty = cy + Math.sin(a) * R * pull * (0.5 + d.seed);
            break;
          }
          case 'grid': {
            // An ordered matrix — the evaluation grid.
            const cols = 24;
            const rows = Math.ceil(COUNT / cols);
            const gw = R * 1.7;
            const gh = R * 1.25;
            const col = i % cols;
            const row = Math.floor(i / cols);
            d.tx = cx - gw / 2 + (col / (cols - 1)) * gw;
            d.ty = cy - gh / 2 + (row / (rows - 1)) * gh;
            break;
          }
          case 'stream': {
            // Continuous left-to-right flow — live inference traffic.
            const lane = d.cluster - 2;
            const prog = (n * 3 + t * 0.22) % 1;
            d.tx = cx - R * 1.25 + prog * R * 2.5;
            d.ty =
              cy +
              lane * R * 0.17 +
              Math.sin(prog * Math.PI * 2 + d.seed * 6) * R * 0.07;
            break;
          }
        }
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Seed positions on first layout so dots do not fly in from 0,0.
      layout(modeRef.current, 0);
      dots.forEach((d) => {
        if (d.x === 0 && d.y === 0) {
          d.x = d.tx;
          d.y = d.ty;
        }
      });
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);

      // Connection lines give 'cluster' and 'grid' their structural read.
      const linked = modeRef.current === 'cluster' || modeRef.current === 'grid';
      if (linked) {
        ctx.lineWidth = 1;
        const maxDist = modeRef.current === 'grid' ? 34 : 46;
        for (let i = 0; i < dots.length; i += 2) {
          for (let j = i + 2; j < Math.min(i + 24, dots.length); j += 2) {
            const a = dots[i];
            const b = dots[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist > maxDist) continue;
            ctx.strokeStyle = `rgba(63,184,196,${(1 - dist / maxDist) * 0.16})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      dots.forEach((d) => {
        // Critically damped-ish easing toward the target.
        d.x += (d.tx - d.x) * 0.055;
        d.y += (d.ty - d.y) * 0.055;

        const c = d.tone;
        const r = Math.round(TEAL[0] + (AMBER[0] - TEAL[0]) * c);
        const g = Math.round(TEAL[1] + (AMBER[1] - TEAL[1]) * c);
        const b = Math.round(TEAL[2] + (AMBER[2] - TEAL[2]) * c);

        const pulse =
          modeRef.current === 'converge'
            ? 1 + Math.sin(time * 0.003 + d.seed * 8) * 0.5
            : 1;
        const radius = (0.9 + d.seed * 1.5) * pulse;

        ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + d.seed * 0.5})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Reduced motion: render one static frame of the active mode, no loop.
    if (reduced) {
      layout(modeRef.current, 0);
      dots.forEach((d) => {
        d.x = d.tx;
        d.y = d.ty;
      });
      draw(0);
      let lastMode = modeRef.current;
      const poll = window.setInterval(() => {
        if (modeRef.current === lastMode) return;
        lastMode = modeRef.current;
        layout(modeRef.current, 0);
        dots.forEach((d) => {
          d.x = d.tx;
          d.y = d.ty;
        });
        draw(0);
      }, 250);
      return () => {
        ro.disconnect();
        clearInterval(poll);
      };
    }

    let frame = 0;
    let onScreen = true;
    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (!onScreen || document.hidden) return;
      layout(modeRef.current, time * 0.001);
      draw(time);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      aria-hidden="true"
      role="presentation"
    />
  );
}
