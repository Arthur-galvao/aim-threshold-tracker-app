/** @type {import('tailwindcss').Config} */
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
        "text-main": "var(--text-main)",
        "text-secondary": "var(--text-secondary)",
        "text-faint": "var(--text-faint)",
        primary: "var(--primary)",
        "primary-fg": "var(--primary-foreground)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          edge: "var(--accent-edge)",
        },
        amber: {
          DEFAULT: "var(--amber)",
          soft: "var(--amber-soft)",
          edge: "var(--amber-edge)",
        },
        emerald: {
          DEFAULT: "var(--emerald)",
          soft: "var(--emerald-soft)",
          edge: "var(--emerald-edge)",
        },
        red: {
          DEFAULT: "var(--red)",
          soft: "var(--red-soft)",
          edge: "var(--red-edge)",
        },
      },
      fontFamily: {
        sans: [
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Inter"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"Cascadia Code"',
          '"Cascadia Mono"',
          '"Segoe UI Mono"',
          "Consolas",
          "ui-monospace",
          "monospace",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
        "glass-sm": "0 4px 16px 0 rgba(0, 0, 0, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
        "glass-hover": "0 12px 40px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
        "glow-cyan": "0 0 25px -5px rgba(56, 189, 248, 0.35)",
        "glow-amber": "0 0 25px -5px rgba(251, 191, 36, 0.35)",
      },
    },
  },
  plugins: [],
};
