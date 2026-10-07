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
        score: {
          DEFAULT: "var(--score)",
          soft: "var(--score-soft)",
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
          '"Geist Variable"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Inter"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"Geist Mono Variable"',
          '"Cascadia Code"',
          '"Cascadia Mono"',
          '"Segoe UI Mono"',
          "Consolas",
          "ui-monospace",
          "monospace",
        ],
      },
      boxShadow: {
        panel: "0 2px 10px -2px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        "panel-dark": "0 4px 20px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        overlay: "0 20px 50px -12px rgba(0, 0, 0, 0.5)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "pop-in": "popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
