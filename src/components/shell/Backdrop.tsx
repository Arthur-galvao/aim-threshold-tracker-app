export function Backdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-base select-none"
    >
      {/* 1. Deep Atmospheric Horizon Base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #0d1b38 0%, #070d1c 48%, #04070f 100%)",
        }}
      />

      {/* 2. iOS 26 Liquid Ribbons & Chromatic Folds (SVG high-contrast shapes for backdrop-filter refraction) */}
      <svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-90 backdrop-drift"
      >
        <defs>
          {/* Cyan-Cobalt Primary Ribbon */}
          <linearGradient id="ios-ribbon-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#2563eb" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.05" />
          </linearGradient>

          {/* Bioluminescent Emerald-Teal Ribbon */}
          <linearGradient id="ios-ribbon-emerald" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.48" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>

          {/* Deep Indigo-Violet Counterfold */}
          <linearGradient id="ios-ribbon-indigo" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#3b82f6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.08" />
          </linearGradient>

          {/* Warm Amber Caustic Accent */}
          <radialGradient id="ios-caustic-amber" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.26" />
            <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>

          {/* Soft optical blur filters so ribbons have distinct edges for glass to refract */}
          <filter id="ribbon-blur-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id="ribbon-blur-md" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="38" />
          </filter>
        </defs>

        {/* Top-left to center sweeping liquid fold (passes right behind TopBar & KPIStrip) */}
        <path
          d="M-120,80 C260,-60 540,280 920,160 C1240,60 1460,-40 1720,140 L1720,420 C1380,260 1120,440 760,340 C380,230 140,420 -120,280 Z"
          fill="url(#ios-ribbon-cyan)"
          filter="url(#ribbon-blur-sm)"
        />

        {/* Diagonal emerald wave (passes behind Chart & Side Inspector / Randomizer) */}
        <path
          d="M1680,180 C1340,320 1180,120 820,290 C460,460 280,260 -100,480 L-100,740 C260,540 520,680 890,510 C1240,350 1420,520 1680,410 Z"
          fill="url(#ios-ribbon-emerald)"
          filter="url(#ribbon-blur-md)"
        />

        {/* Lower spatial indigo-cyan petal (grounds bottom of viewport) */}
        <path
          d="M-80,680 C280,520 640,820 1040,640 C1320,510 1520,620 1700,520 L1700,1040 L-80,1040 Z"
          fill="url(#ios-ribbon-indigo)"
          filter="url(#ribbon-blur-sm)"
        />

        {/* Warm caustic focal glow behind the center-left hero threshold */}
        <ellipse
          cx="420"
          cy="260"
          rx="290"
          ry="170"
          fill="url(#ios-caustic-amber)"
          filter="url(#ribbon-blur-md)"
        />

        {/* Crisp specular light threads that visibly bend under backdrop-filter */}
        <path
          d="M-60,190 C340,40 680,340 1120,180 C1360,90 1540,140 1680,80"
          fill="none"
          stroke="rgba(186, 230, 253, 0.22)"
          strokeWidth="3"
        />
        <path
          d="M-40,560 C380,380 760,640 1220,420 C1420,320 1560,380 1680,330"
          fill="none"
          stroke="rgba(110, 231, 183, 0.18)"
          strokeWidth="2.5"
        />
      </svg>

      {/* 3. Subtle Spatial Grid Overlay (gives glass lenses geometric reference to blur) */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.55) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 85% 75% at 50% 35%, black 20%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 75% at 50% 35%, black 20%, transparent 100%)",
        }}
      />
    </div>
  );
}
