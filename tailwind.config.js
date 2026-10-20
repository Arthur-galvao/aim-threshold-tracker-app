/** @type {import('tailwindcss').Config} */
const status = (name) => ({
  DEFAULT: `rgb(var(--${name}-rgb) / <alpha-value>)`,
  soft: `var(--${name}-soft)`,
  ...(name === "score" ? {} : { edge: `var(--${name}-edge)` }),
});

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "var(--base)",
        surface: "var(--surface)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-hover": "var(--surface-hover)",
        edge: "var(--edge)",
        "edge-strong": "var(--edge-strong)",
        glass: "var(--glass-1)",
        "glass-2": "var(--glass-2)",
        "glass-edge": "var(--glass-edge)",
        "text-main": "var(--text-main)",
        "text-secondary": "var(--text-secondary)",
        "text-faint": "var(--text-faint)",
        score: status("score"),
        emerald: status("emerald"),
        amber: status("amber"),
        red: status("red"),
      },
      borderRadius: {
        tile: "var(--r-tile)",
        control: "var(--r-control)",
        float: "var(--r-float)",
      },
      fontFamily: {
        sans: [
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI Variable Display"',
          '"Segoe UI Variable Text"',
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          '"Cascadia Mono"',
          '"Consolas"',
          "ui-monospace",
          "monospace",
        ],
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        spring: "var(--ease-spring)",
      },
      animation: {
        "pop-in": "pop-in 220ms var(--ease-out) both",
      },
    },
  },
  plugins: [],
};
