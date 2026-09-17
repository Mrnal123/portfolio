'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from '@/lib/motion';
import { TouchTexture } from './TouchTexture';
import { particleVertex, particleFragment } from './shaders';

type Props = {
  /** The word rendered as a particle cloud. Short is better — 2–8 chars. */
  text: string;
  className?: string;
};

/**
 * The hero's single WebGL instance.
 *
 * Renders `text` into an offscreen canvas, then spawns one instanced quad per
 * bright pixel. Particles start scattered and resolve into the letterforms —
 * the site's opening narrative beat: noise becomes signal.
 *
 * This is the ONLY Three.js scene on the page, per the library's
 * dependency-hygiene rule. Everything else is GSAP or CSS.
 */
export default function ParticleField({ text, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    // next/font obfuscates the family name, and rasterising before the face
    // loads would bake the fallback's letterforms into the particle
    // positions permanently. So: wait for fonts, then read the real family
    // off a probe element that uses the same class the headings do.
    const init = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* fonts API unavailable — fall through with whatever is resolved */
      }
      if (disposed) return;
      teardown = build();
    };

    const build = (): (() => void) | null => {
    const probe = document.createElement('span');
    probe.className = 't-display';
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const displayFamily =
      getComputedStyle(probe).fontFamily || 'Impact, sans-serif';
    probe.remove();

    /* ---------------------------------------------------------------- *
     * 1. Rasterise the text to an offscreen canvas — this is our source *
     * ---------------------------------------------------------------- */
    const src = document.createElement('canvas');
    const sctx = src.getContext('2d', { willReadFrequently: true });
    if (!sctx) return null;

    // Size the canvas to the TEXT, rather than rendering text into a fixed
    // canvas. A fixed 440x230 left "MS" occupying only 176 units of width,
    // so the camera framed mostly empty space and had to splay its FOV to
    // fit it — which smeared the glyph. Measuring first keeps the field
    // tight around the letterforms.
    sctx.font = `100px ${displayFamily}`;
    const m = sctx.measureText(text);
    const glyphW100 = m.width || 100;
    // actualBoundingBox is well supported; the fallback covers old engines.
    const glyphH100 =
      (m.actualBoundingBoxAscent || 72) + (m.actualBoundingBoxDescent || 0);

    // Particle spacing is 1 world unit, so these numbers ARE the particle
    // grid resolution. ~240 tall gives a dense but affordable field.
    const H = (src.height = 240);
    const fontSize = Math.round((H * 0.88) / (glyphH100 / 100));
    const glyphW = glyphW100 * (fontSize / 100);
    const W = (src.width = Math.round(glyphW + H * 0.18));

    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, W, H);
    sctx.fillStyle = '#fff';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.font = `${fontSize}px ${displayFamily}`;
    sctx.fillText(text, W / 2, H / 2);

    const imageData = sctx.getImageData(0, 0, W, H).data;

    /* ---------------------------------------------------------------- *
     * 2. One particle per bright pixel                                  *
     * ---------------------------------------------------------------- */
    const threshold = 34;
    const visible: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (imageData[i * 4] > threshold) visible.push(i);
    }
    const count = visible.length;
    if (count === 0) return null;

    const offsets = new Float32Array(count * 3);
    const indices = new Float32Array(count);
    const angles = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const pixel = visible[i];
      offsets[i * 3 + 0] = pixel % W;
      offsets[i * 3 + 1] = Math.floor(pixel / W);
      offsets[i * 3 + 2] = 0;
      indices[i] = pixel;
      angles[i] = Math.random() * Math.PI * 2;
    }

    /* ---------------------------------------------------------------- *
     * 3. Scene                                                          *
     * ---------------------------------------------------------------- */
    const renderer = new THREE.WebGLRenderer({
      antialias: false, // particles are round sprites; AA buys nothing here
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    // Cap DPR at 1.75 — beyond that we pay 4x fill rate for no visible gain.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    // A gentle, fixed FOV. The field is fitted by moving the camera, never
    // by widening the lens — a wide FOV magnifies each particle's z-offset
    // into a radial smear and the letterforms dissolve into streaks.
    const FOV = 40;
    const camera = new THREE.PerspectiveCamera(
      FOV,
      mount.clientWidth / mount.clientHeight,
      1,
      10000
    );
    camera.position.z = 600;

    const sourceTexture = new THREE.Texture(src);
    sourceTexture.minFilter = THREE.LinearFilter;
    sourceTexture.magFilter = THREE.LinearFilter;
    // Keep UV space top-down so it matches the row indices baked into the
    // `offset` attribute. The shader handles the world-space Y inversion.
    sourceTexture.flipY = false;
    sourceTexture.needsUpdate = true;

    const touch = new TouchTexture();

    // A single quad, instanced `count` times.
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.instanceCount = count;

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0], 3)
    );
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)
    );
    geometry.setIndex(
      new THREE.BufferAttribute(new Uint16Array([0, 2, 1, 2, 3, 1]), 1)
    );

    geometry.setAttribute(
      'pindex',
      new THREE.InstancedBufferAttribute(indices, 1, false)
    );
    geometry.setAttribute(
      'offset',
      new THREE.InstancedBufferAttribute(offsets, 3, false)
    );
    geometry.setAttribute(
      'angle',
      new THREE.InstancedBufferAttribute(angles, 1, false)
    );

    const uniforms = {
      uTime: { value: 0 },
      uRandom: { value: 2.0 },
      uDepth: { value: 3.0 },
      // Particles sit on a 1-unit grid, so a size near 1 keeps them distinct.
      // The old 1.4 (peaking ~4 units after the noise term) made every sprite
      // overlap its neighbours into an opaque blob.
      uSize: { value: 0.72 },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uTextureSize: { value: new THREE.Vector2(W, H) },
      uTexture: { value: sourceTexture },
      uTouch: { value: touch.texture },
      uColorA: { value: new THREE.Color('#E9A55C') },
      uColorB: { value: new THREE.Color('#3FB8C4') },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    /* ---------------------------------------------------------------- *
     * 4. Pointer interaction                                            *
     * ---------------------------------------------------------------- */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    scene.add(hitPlane);

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(hitPlane)[0];
      if (!hit) return;
      touch.addTouch({
        x: hit.uv!.x,
        y: hit.uv!.y,
      });
    };
    // Passive: we never preventDefault, so the compositor keeps scrolling at 60fps.
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    /* ---------------------------------------------------------------- *
     * 5. Entrance — noise resolves into the letterforms                 *
     * ---------------------------------------------------------------- */
    const intro = gsap.timeline({ delay: 0.15 });
    intro
      .to(uniforms.uOpacity, { value: 1, duration: 1.2, ease: 'power2.out' }, 0)
      .to(uniforms.uProgress, { value: 1, duration: 2.6, ease: 'power3.inOut' }, 0)
      .to(uniforms.uRandom, { value: 1.1, duration: 2.6, ease: 'power3.inOut' }, 0);

    /* ---------------------------------------------------------------- *
     * 6. Loop — paused whenever it is not actually on screen            *
     * ---------------------------------------------------------------- */
    const clock = new THREE.Clock();
    let frame = 0;
    let onScreen = true;
    let docVisible = !document.hidden;

    const render = () => {
      frame = requestAnimationFrame(render);
      if (!onScreen || !docVisible) return;
      uniforms.uTime.value = clock.getElapsedTime();
      touch.update();
      renderer.render(scene, camera);
    };
    render();

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(mount);

    const onVisibility = () => {
      docVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    /* ---------------------------------------------------------------- *
     * 7. Resize                                                         *
     * ---------------------------------------------------------------- */
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;

      // Pull the camera back until the whole W x H field fits, whichever
      // axis binds. Distance-fitting keeps perspective gentle at every
      // container shape; FOV-fitting did not.
      const margin = 1.18;
      const halfFov = (FOV / 2) * (Math.PI / 180);
      const distForHeight = (H * margin) / 2 / Math.tan(halfFov);
      const distForWidth =
        (W * margin) / 2 / (Math.tan(halfFov) * camera.aspect);
      camera.position.z = Math.max(distForHeight, distForWidth);

      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    /* ---------------------------------------------------------------- *
     * 8. Teardown — WebGL leaks are permanent, so this matters          *
     * ---------------------------------------------------------------- */
    return () => {
      cancelAnimationFrame(frame);
      intro.kill();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);

      geometry.dispose();
      material.dispose();
      sourceTexture.dispose();
      touch.dispose();
      hitPlane.geometry.dispose();
      (hitPlane.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    };

    init();

    return () => {
      disposed = true;
      teardown?.();
      teardown = null;
    };
  }, [text]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
