import { useEffect, useRef } from "react";

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface DustGrain {
  /** Position along filament [0..1] */
  u: number;
  /** Cross-filament offsets */
  v: number;
  w: number;
  /** Dynamic velocity & displacement from mouse interaction */
  vx: number;
  vy: number;
  dx: number;
  dy: number;
  size: number;
  alpha: number;
  colorMix: number;
  twinklePhase: number;
  filamentId: number;
}

interface NebulaPuff {
  u: number;
  v: number;
  radius: number;
  alpha: number;
  colorType: 0 | 1 | 2 | 3;
  filamentId: number;
}

function parseRgbVar(raw: string, fallback: RGB): RGB {
  const cleaned = raw.trim().replace(/,/g, " ");
  const parts = cleaned.split(/\s+/).map(Number);
  if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
    return { r: parts[0], g: parts[1], b: parts[2] };
  }
  return fallback;
}

function readThemePalette(): { primary: RGB; secondary: RGB; accent: RGB } {
  const style = getComputedStyle(document.documentElement);
  return {
    primary: parseRgbVar(style.getPropertyValue("--nebula-primary-rgb"), {
      r: 56,
      g: 189,
      b: 248,
    }),
    secondary: parseRgbVar(style.getPropertyValue("--nebula-secondary-rgb"), {
      r: 124,
      g: 58,
      b: 237,
    }),
    accent: parseRgbVar(style.getPropertyValue("--nebula-accent-rgb"), {
      r: 99,
      g: 102,
      b: 241,
    }),
  };
}

/**
 * Evaluates a 3D twisted cosmic filament spine in screen space.
 * Positioned directly across the UI stage (TopBar, KPIStrip, ProgressChart, SessionHistory)
 * while leaving the outer screen margins in deep cosmic void (#020308), matching HubX.
 */
function evaluateFilamentPoint(
  filamentId: number,
  u: number,
  v: number,
  w: number,
  t: number,
  width: number,
  height: number
): { x: number; y: number; depth: number } {
  let baseX = 0;
  let baseY = 0;

  if (filamentId === 0) {
    // Main HubX diagonal cosmic ridge: top-left (10%, 4%) sweeping right behind KPIStrip & ProgressChart to (56%, 86%)
    baseX = width * (0.08 + u * 0.52) + Math.sin(u * 5.2 + t * 0.45) * width * 0.065;
    baseY = height * (0.03 + u * 0.84) + Math.cos(u * 4.1 - t * 0.35) * height * 0.075;
  } else if (filamentId === 1) {
    // Upper canopy filament: sweeping across TopBar, MiniPlaylistRunner & KPIStrip (16%, 6% -> 84%, 44%)
    baseX = width * (0.15 + u * 0.70) + Math.cos(u * 5.6 - t * 0.38) * width * 0.055;
    baseY = height * (0.05 + u * 0.42) + Math.sin(u * 4.8 + t * 0.4) * height * 0.07;
  } else {
    // Right-stage cosmic branch: behind KPIStrip right half & SessionHistory (46%, 18% -> 88%, 82%)
    baseX = width * (0.44 + u * 0.44) + Math.sin(u * 4.5 + t * 0.32 + 1.5) * width * 0.06;
    baseY = height * (0.16 + u * 0.68) + Math.cos(u * 4.0 + t * 0.28) * height * 0.07;
  }

  // Fibrous 3D curl-wave folds (creates sharp bright ridges and wispy tendrils like HubX)
  const twistAngle = u * 7.8 + t * 0.55 + filamentId * 2.1;
  const pinch = 0.45 + 0.55 * Math.sin(u * Math.PI);
  const spreadX = width * 0.068 * pinch;
  const spreadY = height * 0.082 * pinch;

  const curlX =
    Math.cos(twistAngle) * v * spreadX +
    Math.sin(twistAngle * 1.9 + w * 3.6) * w * spreadX * 0.55;
  const curlY =
    Math.sin(twistAngle) * v * spreadY +
    Math.cos(twistAngle * 1.6 - u * 4.5) * w * spreadY * 0.55;

  const depth = 0.5 + 0.5 * Math.sin(twistAngle + v * 1.8);

  return {
    x: baseX + curlX,
    y: baseY + curlY,
    depth,
  };
}

/**
 * Interactive 3D Cosmic Dust & Space Nebula Backdrop.
 * Renders a deep pitch-black void with high-contrast fibrous 3D stardust filaments and nebula gas
 * directly behind the Liquid Glass UI cards, reactive to mouse movement and theme palette.
 */
export function Backdrop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let palette = readThemePalette();

    // 1. 1,900 ultra-fine 3D cosmic dust grains clustered along fibrous nebula ridges
    const GRAIN_COUNT = 1900;
    const grains: DustGrain[] = [];

    for (let i = 0; i < GRAIN_COUNT; i++) {
      const filamentId = i < 860 ? 0 : i < 1420 ? 1 : 2;
      const u = Math.random();
      // Tightly concentrated distribution for sharp bright filament ridges + wispy outer dust
      const g1 = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      const g2 = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;

      const isDeepField = i % 12 === 0;
      const v = isDeepField ? (Math.random() - 0.5) * 5.2 : g1 * 2.1;
      const w = isDeepField ? (Math.random() - 0.5) * 5.2 : g2 * 2.1;

      const ridgeDensity = Math.max(0, 1 - Math.hypot(v, w) * 0.85);

      grains.push({
        u,
        v,
        w,
        vx: 0,
        vy: 0,
        dx: 0,
        dy: 0,
        // Fine stardust specks (0.45px to 1.3px) — crisp galactic texture
        size: isDeepField
          ? 0.45 + Math.random() * 0.55
          : 0.45 + Math.random() * 0.75 + ridgeDensity * 0.35,
        alpha: isDeepField
          ? 0.14 + Math.random() * 0.28
          : (0.24 + Math.random() * 0.62) * (0.35 + ridgeDensity * 0.65),
        colorMix: Math.random(),
        twinklePhase: Math.random() * Math.PI * 2,
        filamentId,
      });
    }

    // 2. High-contrast volumetric nebula clouds along the filament spines (behind the cards)
    const puffs: NebulaPuff[] = [];
    const PUFF_COUNT = 44;
    for (let i = 0; i < PUFF_COUNT; i++) {
      const filamentId = i < 20 ? 0 : i < 33 ? 1 : 2;
      const u = (i % 15) / 14 + (Math.random() - 0.5) * 0.06;
      const isHotCore = i % 5 === 0;
      puffs.push({
        u: Math.max(0.02, Math.min(0.98, u)),
        v: (Math.random() - 0.5) * (isHotCore ? 0.25 : 0.65),
        radius: isHotCore ? 65 + Math.random() * 65 : 110 + Math.random() * 140,
        alpha: isHotCore ? 0.16 + Math.random() * 0.1 : 0.09 + Math.random() * 0.09,
        colorType: isHotCore ? 3 : ((i % 3) as 0 | 1 | 2),
        filamentId,
      });
    }

    const mouse = {
      x: width * 0.42,
      y: height * 0.38,
      targetX: width * 0.42,
      targetY: height * 0.38,
      vx: 0,
      vy: 0,
      active: false,
    };

    const handlePointerMove = (e: PointerEvent) => {
      mouse.vx = e.clientX - mouse.targetX;
      mouse.vy = e.clientY - mouse.targetY;
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
      document.documentElement.style.setProperty("--cursor-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${e.clientY}px`);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    let isPaused =
      document.hidden ||
      document.documentElement.classList.contains("app-backgrounded");

    let rafId = 0;
    let time = 0;

    const getNebulaColor = (mix: number): RGB => {
      if (mix < 0.36) return palette.secondary;
      if (mix < 0.72) return palette.primary;
      if (mix < 0.88) return palette.accent;
      return { r: 242, g: 248, b: 255 };
    };

    const renderFrame = () => {
      rafId = 0;
      time += 0.009;

      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;
      mouse.vx *= 0.88;
      mouse.vy *= 0.88;

      const parallaxX = ((mouse.x - width * 0.5) / Math.max(1, width)) * 42;
      const parallaxY = ((mouse.y - height * 0.5) / Math.max(1, height)) * 32;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      // Pass 1: Volumetric nebula clouds & hot ridge cores behind the cards
      for (let i = 0; i < puffs.length; i++) {
        const puff = puffs[i];
        const pos = evaluateFilamentPoint(
          puff.filamentId,
          puff.u,
          puff.v,
          0,
          time,
          width,
          height
        );
        const px = pos.x - parallaxX * 0.55 * pos.depth;
        const py = pos.y - parallaxY * 0.55 * pos.depth;

        // Fluid nebula gas displacement when the mouse passes over
        const mdx = px - mouse.x;
        const mdy = py - mouse.y;
        const mDist = Math.hypot(mdx, mdy);
        const push = mDist < 280 && mDist > 1 ? ((280 - mDist) / 280) * 34 : 0;
        const finalX = px + (mDist > 1 ? (mdx / mDist) * push : 0);
        const finalY = py + (mDist > 1 ? (mdy / mDist) * push : 0);

        const rgb =
          puff.colorType === 0
            ? palette.secondary
            : puff.colorType === 1
              ? palette.primary
              : puff.colorType === 2
                ? palette.accent
                : {
                    r: Math.min(255, Math.round((palette.primary.r + 255) * 0.5)),
                    g: Math.min(255, Math.round((palette.primary.g + 245) * 0.5)),
                    b: 255,
                  };

        const r = puff.radius * (0.82 + 0.35 * pos.depth);
        const grad = ctx.createRadialGradient(finalX, finalY, 0, finalX, finalY, r);
        grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${puff.alpha})`);
        grad.addColorStop(
          0.42,
          `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${puff.alpha * 0.45})`
        );
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(finalX, finalY, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pass 2: Interactive cursor nebula glow
      if (mouse.active) {
        const auraR = 240;
        const auraGrad = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          auraR
        );
        auraGrad.addColorStop(
          0,
          `rgba(${palette.primary.r}, ${palette.primary.g}, ${palette.primary.b}, 0.15)`
        );
        auraGrad.addColorStop(
          0.48,
          `rgba(${palette.secondary.r}, ${palette.secondary.g}, ${palette.secondary.b}, 0.07)`
        );
        auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, auraR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pass 3: 1,900 fine-grained 3D cosmic dust specks with fluid mouse vortex physics
      const mouseRadius = 210;
      const mouseRadiusSq = mouseRadius * mouseRadius;

      for (let i = 0; i < grains.length; i++) {
        const g = grains[i];

        g.u += 0.00032 * (0.6 + g.colorMix * 0.7);
        if (g.u > 1) g.u -= 1;

        const basePos = evaluateFilamentPoint(
          g.filamentId,
          g.u,
          g.v,
          g.w,
          time,
          width,
          height
        );

        const targetX = basePos.x - parallaxX * basePos.depth;
        const targetY = basePos.y - parallaxY * basePos.depth;

        const curX = targetX + g.dx;
        const curY = targetY + g.dy;

        let mouseExcite = 0;
        const rx = curX - mouse.x;
        const ry = curY - mouse.y;
        const distSq = rx * rx + ry * ry;

        if (distSq < mouseRadiusSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const factor = 1 - dist / mouseRadius;
          const force = factor * factor * 0.85 * basePos.depth;
          const nx = rx / dist;
          const ny = ry / dist;

          // Radial dispersion + tangential vortex swirl + cursor momentum drag
          g.vx += nx * force - ny * force * 0.7 + mouse.vx * 0.026 * factor;
          g.vy += ny * force + nx * force * 0.7 + mouse.vy * 0.026 * factor;
          mouseExcite = factor;
        }

        // Elastic spring back to the 3D filament ridge
        g.vx += -g.dx * 0.026;
        g.vy += -g.dy * 0.026;
        g.vx *= 0.91;
        g.vy *= 0.91;
        g.dx += g.vx;
        g.dy += g.vy;

        const finalX = targetX + g.dx;
        const finalY = targetY + g.dy;

        const rgb = getNebulaColor(g.colorMix);
        const twinkle = 0.72 + 0.28 * Math.sin(time * 3.8 + g.twinklePhase);
        const alpha = Math.min(
          1,
          g.alpha * twinkle * basePos.depth + mouseExcite * 0.5
        );
        const radius = g.size * (0.75 + 0.45 * basePos.depth + mouseExcite * 0.4);

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        ctx.fillRect(finalX - radius, finalY - radius, radius * 2, radius * 2);
      }

      ctx.globalCompositeOperation = "source-over";

      if (!isPaused) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const startLoop = () => {
      if (!rafId && !isPaused) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const stopLoop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const handleResize = () => {
      resize();
      renderFrame();
    };
    window.addEventListener("resize", handleResize, { passive: true });

    renderFrame();
    startLoop();

    const handleVisibilityChange = () => {
      isPaused =
        document.hidden ||
        document.documentElement.classList.contains("app-backgrounded");
      if (isPaused) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    const handleContentVisibility = (event: Event) => {
      const cvEvent = event as Event & { skipped?: boolean };
      if (cvEvent.skipped) {
        isPaused = true;
        stopLoop();
      } else {
        isPaused =
          document.hidden ||
          document.documentElement.classList.contains("app-backgrounded");
        startLoop();
      }
    };

    const rootObserver = new MutationObserver(() => {
      palette = readThemePalette();
      const bgPaused =
        document.hidden ||
        document.documentElement.classList.contains("app-backgrounded");
      if (bgPaused !== isPaused) {
        isPaused = bgPaused;
        if (isPaused) stopLoop();
        else startLoop();
      }
    });

    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    container.addEventListener(
      "contentvisibilityautostatechange",
      handleContentVisibility
    );

    return () => {
      stopLoop();
      rootObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      container.removeEventListener(
        "contentvisibilityautostatechange",
        handleContentVisibility
      );
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
      style={{
        backgroundColor: "var(--base)",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 100vw auto 100vh",
      }}
    >
      {/* Subtle deep-space ambient core glow behind the stage (radial-gradient) */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: `
            radial-gradient(50% 45% at 28% 22%, rgb(var(--nebula-secondary-rgb) / 0.16) 0%, transparent 70%),
            radial-gradient(48% 45% at 52% 48%, rgb(var(--nebula-primary-rgb) / 0.11) 0%, transparent 70%),
            radial-gradient(45% 45% at 72% 66%, rgb(var(--nebula-accent-rgb) / 0.12) 0%, transparent 70%)
          `,
        }}
      />

      {/* Interactive 3D Cosmic Dust & Filament Nebula Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
    </div>
  );
}
