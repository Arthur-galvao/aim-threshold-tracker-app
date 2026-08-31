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
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
