/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        base: "var(--base)",
        surface: "var(--surface)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-hover": "var(--surface-hover)",
        edge: "var(--edge)",
        "edge-strong": "var(--edge-strong)",
        "text-main": "var(--text-main)",
        "text-secondary": "var(--text-secondary)",
        "text-faint": "var(--text-faint)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          fg: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          fg: "hsl(var(--accent-foreground) / <alpha-value>)",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
