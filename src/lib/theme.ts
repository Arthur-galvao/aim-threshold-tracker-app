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