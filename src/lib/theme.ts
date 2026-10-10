import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type AppTheme = "cyber-lab" | "tactical-emerald" | "amethyst-purple" | "obsidian-amber";

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  color: string;
  desc: string;
}

export const APP_THEMES: ThemeConfig[] = [
  {
    id: "cyber-lab",
    name: "Cyber Lab",
    color: "#38bdf8",
    desc: "Ciano elétrico esportivo, estética de laboratório de alta precisão.",
  },
  {
    id: "tactical-emerald",
    name: "Tactical Emerald",
    color: "#10b981",
    desc: "Verde esmeralda militar tático, foco cirúrgico de atirador.",
  },
  {
    id: "amethyst-purple",
    name: "Amethyst Purple",
    color: "#a855f7",
    desc: "Violeta elétrico vibrante, estética noturna de alto contraste.",
  },
  {
    id: "obsidian-amber",
    name: "Obsidian Amber",
    color: "#f59e0b",
    desc: "Âmbar aeroespacial mecânico, alto contraste industrial analógico.",
  },
];

const THEME_STORAGE_KEY = "aim_app_theme";
const STORAGE_KEY = "att-theme";

const getSystemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === "system" ? getSystemTheme() : theme
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const resolved = theme === "system" ? (mql.matches ? "dark" : "light") : theme;
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };

    localStorage.setItem(STORAGE_KEY, theme);
    update();

    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : prev === "dark" ? "system" : "light"));
  }, []);

  return { theme, resolvedTheme: (resolvedTheme === "light" ? "light" : "dark") as ResolvedTheme, setTheme, cycleTheme };
}

export function getStoredTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    if (saved && APP_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // fallback if localStorage not accessible
  }
  return "cyber-lab";
}

export function applyTheme(paletteTheme: AppTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, paletteTheme);
  } catch {
    // ignore
  }

  const root = document.documentElement;
  root.setAttribute("data-theme", paletteTheme);
  // Ensure dark class is present for our sleek theme styles
  root.classList.add("dark");
}