import type { Key } from "./i18n.tsx";
export type AppTheme = "cyber-lab" | "tactical-emerald" | "amethyst-purple" | "obsidian-amber";

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  color: string;
  /** Chave i18n da descrição (traduzida onde é exibida). */
  descKey: Key;
}

export const APP_THEMES: ThemeConfig[] = [
  {
    id: "cyber-lab",
    name: "Cyber Lab",
    color: "#38bdf8",
    descKey: "theme.desc.cyberLab",
  },
  {
    id: "tactical-emerald",
    name: "Tactical Emerald",
    color: "#10b981",
    descKey: "theme.desc.tacticalEmerald",
  },
  {
    id: "amethyst-purple",
    name: "Amethyst Purple",
    color: "#a855f7",
    descKey: "theme.desc.amethystPurple",
  },
  {
    id: "obsidian-amber",
    name: "Obsidian Amber",
    color: "#f59e0b",
    descKey: "theme.desc.obsidianAmber",
  },
];

const THEME_STORAGE_KEY = "aim_app_theme";

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