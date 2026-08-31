import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "att-theme";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  });

  const [systemPref, setSystemPref] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setSystemPref(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemPref : theme;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(resolvedTheme);
  }, [theme, resolvedTheme]);

  const cycleTheme = useCallback(() => {
    setTheme((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light"
    );
  }, []);

  return { theme, resolvedTheme, setTheme, cycleTheme };
}