# Cinematic AI/ML Portfolio

**Live: https://mrunal-portofolio.vercel.app**

A scroll-driven, WebGL-accelerated portfolio built from the **Awwwards Pack**
component library, following the scrollytelling skill's narrative-first method.

Deployed on Vercel from `main` — every push to this branch ships to production.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

---

## Make it yours

**Edit [`lib/data.ts`](lib/data.ts) and nothing else.** Every string, project,
metric, link and nav item on the site comes from that one file. Placeholder
values are marked `// [PLACEHOLDER]` — search for that comment and you have
your complete to-do list.

The three things to change first:

1. `identity` — your name, role, location, email, tagline.
2. `socials` — currently pointing at `yourhandle`.
3. `projects` — four invented projects (Atlas, Foundry, Tideline, Relay).

Add project images by dropping files into `public/` and setting `image:` on a
project. Until then, each card uses its `accent` colour as a wash.

---

## The narrative

Scrollytelling only works when it serves a story, so the page is structured as
six acts rather than a list of sections:

| Act | Section | The beat |
|-----|---------|----------|
| 0 | `Preloader` | A film gate opens |
| I | `Hero` | Noise resolves into your name |
| I | `Manifesto` | The thesis, one line at a time |
| II | `Pipeline` | **Five ML stages, pinned** — the scrollytelling core |
| III | `Work` | The evidence |
| IV | `CardStack` | Capabilities, as a card fan that flips |
| V | `Experience` | The path and the toolkit |
| VI | `Contact` | The close |

The **Pipeline** section is the centrepiece and the one that most earns its
motion: the sticky visual literally depicts the transformation each step
describes — raw scatter, then clustering, then convergence, then an evaluation
grid, then a live inference stream.

---

## Components used from the Awwwards Pack

Each pick, and why:

| Library component | Used as | Why |
|---|---|---|
| `+24 Hero Animations/20` Cinematic loader | `Preloader.tsx` | Film-gate curtain — the literal "cinematic" open |
| `+17 Webgl/9` Interactive particles | `webgl/ParticleField.tsx` | The one WebGL instance; text forming from noise matches the ML thesis |
| `+54 Scroll Animation/44` Lusion 3D cards | `CardStack.tsx` | Pinned spread-then-flip for the four capabilities |
| `+21 Navigation Menus/16` Noir menu | `Nav.tsx` | Dark moody overlay, matches the grade |
| `+14 Text Animations/1` On-scroll text | `Manifesto.tsx` | Word-by-word brightening, scrubbed to scroll |
| `+10 Grid Animations/7` Layout formation | `Work.tsx` | Cards assemble rather than merely fade |
| `+24 Hover Effects/19` Magnetic cards | `ui/Magnetic` | Cursor lean on cards and CTAs |
| `+19 Mouse Effect/19` GSAP cursor | `Cursor.tsx` | `quickTo` ring + dot, same approach as truus-clone |
| `+11 SVG Animations/5` Path draw | `Experience.tsx` | Timeline rail draws as you scroll |
| `+54 Scroll Animation/10` Telescope zoom | `Contact.tsx` | Outro headline scales in |

### Two deliberate departures

- **No Framer Motion**, despite the kintarowwwards reference using it. GSAP is
  already the tween engine; adding a second one breaks the library's
  dependency-hygiene rule and ships a redundant ~32KB.
- **The pipeline visual is Canvas 2D, not a second WebGL context.** The rule is
  one Three.js instance per page. A 2D point field morphs just as convincingly
  at a fraction of the cost — which means phones get the real visual instead of
  a static fallback.

---

## Performance

- **167 KB First Load JS.** Three.js is dynamically imported and is *not* in the
  initial bundle.
- WebGL only initialises on a device that passes `useHighEndDevice()` —
  pointer-fine, ≥768px, ≥4 cores, ≥4GB RAM, and a real WebGL context. Phones
  deliberately get the CSS aurora fallback: sustained WebGL thermal-throttles
  into a *worse* experience.
- Every animation loop pauses via `IntersectionObserver` when off-screen and via
  `visibilitychange` when the tab is hidden.
- Animation is confined to `transform` and `opacity`; scroll listeners are
  `passive` and rAF-throttled.
- Device pixel ratio is capped at 1.75 for WebGL, 2 for Canvas.

## Accessibility

- **`prefers-reduced-motion` is a first-class path, not an afterthought.** It
  skips the preloader, disables Lenis entirely (native scroll returns), stops
  every timeline, and — critically — the CSS force-reveals all pre-animation
  hidden states so nothing can be stranded at `opacity: 0`.
- Reveal states are gated behind a `.js-ready` class set by JS, so if JS fails
  the page renders fully visible rather than blank.
- The menu traps focus, closes on Escape, restores focus to its trigger, locks
  scroll, and is `inert` when closed.
- Anchor navigation moves focus to the target, not just the scroll position.
- Scroll progress is exposed as a `role="progressbar"`, and stays on under
  reduced motion because it is information, not decoration.
- Skip link, visible focus rings, and the custom cursor is suppressed entirely
  on touch and reduced-motion so native targets are never taken away.

## Known gaps

- **The four projects are real** (`github.com/Mrnal123`), and every figure on
  those cards comes from the repo's own README. **Everything else on the page
  is still invented placeholder copy** — the headline `metrics`, the per-step
  `pipeline` figures, and the whole `experience` timeline. Real repo links
  sitting next to "2.4M daily inference calls served" is the fastest way to
  lose a reader's trust, so fix those before this goes public.
- LinkedIn URL is still `yourhandle`.
- No real images yet — cards use accent-colour washes.
- Worth adding once they have READMEs: `Satyanetra_Backend` (Next.js + Java,
  Dockerised, deployed to AWS ECS via GitHub Actions — the strongest infra
  work in the account) and the NanoTox line (DFT descriptors, toxicity
  screening). Both were skipped here because there was nothing to describe
  them from without guessing.
- Verified in the built-in browser at 375px, 719px and 1280px. Not yet tested on
  physical iOS/Android hardware, which is the only reliable way to confirm the
  mobile browser-chrome and momentum-scroll behaviour.
