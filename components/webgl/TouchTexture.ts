import * as THREE from 'three';

type TrailPoint = { x: number; y: number; age: number; force: number };

/**
 * A small CPU-painted canvas fed to the particle shader as `uTouch`.
 * Each cursor sample drops a radial blob that fades over ~`maxAge` frames,
 * so particles bloom behind the pointer and settle again.
 *
 * Ported from the Awwwards Pack "Interactive Particles" component.
 */
export class TouchTexture {
  size = 64;
  maxAge = 64;
  radius = 0.15;
  trail: TrailPoint[] = [];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.Texture;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('TouchTexture: 2D context unavailable');
    this.ctx = ctx;
    this.clear();

    this.texture = new THREE.Texture(this.canvas);
    // Same top-down UV convention as the source texture: the shader samples
    // both with the particle's row-from-top, and drawPoint() already converts
    // the incoming bottom-up UV into canvas coordinates.
    this.texture.flipY = false;
    this.texture.needsUpdate = true;
  }

  private clear() {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** `point` is normalised 0..1 in texture space. */
  addTouch(point: { x: number; y: number }) {
    let force = 0;
    const last = this.trail[this.trail.length - 1];
    if (last) {
      const dx = last.x - point.x;
      const dy = last.y - point.y;
      force = Math.min(Math.sqrt(dx * dx + dy * dy) * 10000, 1);
    }
    this.trail.push({ x: point.x, y: point.y, age: 0, force });
  }

  update() {
    this.clear();

    // Age the trail and drop expired points.
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      const slowdown = 1 - p.age / this.maxAge;
      p.age += 1;
      // Ease the force out so the bloom decays rather than snapping off.
      p.force *= slowdown > 0 ? 0.985 : 0;
      if (p.age > this.maxAge) this.trail.splice(i, 1);
    }

    this.trail.forEach((p) => this.drawPoint(p));
    this.texture.needsUpdate = true;
  }

  private drawPoint(point: TrailPoint) {
    const pos = {
      x: point.x * this.size,
      y: (1 - point.y) * this.size,
    };

    const easeOutQuart = (t: number) => 1 - --t * t * t * t;
    const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);

    let intensity = 1;
    const half = this.maxAge * 0.3;
    if (point.age < half) {
      intensity = easeOutSine(point.age / half);
    } else {
      intensity = easeOutQuart(1 - (point.age - half) / (this.maxAge - half));
    }
    intensity *= point.force;

    const radius = this.size * this.radius * intensity;
    if (radius <= 0) return;

    const grd = this.ctx.createRadialGradient(
      pos.x,
      pos.y,
      radius * 0.25,
      pos.x,
      pos.y,
      radius
    );
    grd.addColorStop(0, `rgba(255,255,255,${0.2 + intensity * 0.8})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');

    this.ctx.beginPath();
    this.ctx.fillStyle = grd;
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  dispose() {
    this.trail.length = 0;
    this.texture.dispose();
  }
}
