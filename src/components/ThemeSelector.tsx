import { useState, useRef, useEffect } from "react";
import { Palette, Check } from "@phosphor-icons/react";
import { APP_THEMES, type AppTheme } from "@/lib/theme";
import { Tooltip } from "@/components/ui/Tooltip";
import { motion, AnimatePresence } from "motion/react";

interface ThemeSelectorProps {
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
}

export function ThemeSelector({ currentTheme, onThemeChange }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const activeConfig = APP_THEMES.find((t) => t.id === currentTheme) ?? APP_THEMES[0];

  return (
    <div className="relative" ref={containerRef}>
      <Tooltip content={`Tema Visual (${activeConfig.name})`}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="h-8 px-2.5 rounded-lg border border-edge bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-main flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs select-none"
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs transition-colors duration-200"
            style={{ backgroundColor: activeConfig.color }}
          />
          <Palette size={14} weight="bold" />
        </button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface border border-edge-strong shadow-lg p-1.5 z-50 overflow-hidden"
          >
            <div className="px-2 py-1 mb-1 border-b border-edge flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-text-faint font-semibold">
              <span>PALETA DE CORES</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-surface-subtle text-text-muted">THEMES</span>
            </div>

            <div className="space-y-1">
              {APP_THEMES.map((theme) => {
                const isSelected = theme.id === currentTheme;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      onThemeChange(theme.id);
                      setOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-mono transition-all flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                      isSelected
                        ? "bg-surface-subtle text-text-main font-bold border border-edge shadow-xs"
                        : "hover:bg-surface-hover/80 text-text-secondary hover:text-text-main"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/30 shadow-xs"
                        style={{ backgroundColor: theme.color }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate leading-tight">{theme.name}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={12} weight="bold" className="text-score shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
