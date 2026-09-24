import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "att-theme";

const getSystemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
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

  return { theme, resolvedTheme, setTheme, cycleTheme };
}