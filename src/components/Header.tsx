import type { WatcherStatus } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { GUIDE_URL } from "@/lib/links";
import { openExternalUrl } from "@/lib/tauri-bridge";

interface HeaderProps {
  onOpenSettings: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onLoadDemo: () => void;
  onClear: () => void;
  watcherStatus: WatcherStatus;
}

export function Header({
  onOpenSettings,
  onExport,
  onImport,
  onLoadDemo,
  onClear,
  watcherStatus,
}: HeaderProps) {
  const { theme, cycleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  return (
    <header className="sticky top-0 z-40 chrome border-b border-white/[0.06] transition-all duration-200">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 min-h-[68px] flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-surface-subtle border border-edge flex items-center justify-center shrink-0 text-text-main">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="8" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-xs font-bold tracking-wider uppercase text-text-main truncate">
              Aim Threshold Tracker
            </h1>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Watcher Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
              watcherStatus.active
                ? "bg-emerald-soft text-emerald border-emerald-edge"
                : "bg-surface-subtle text-text-faint border-edge"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {watcherStatus.active && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  watcherStatus.active ? "bg-emerald" : "bg-text-faint"
                }`}
              />
            </span>
            <span>
              {watcherStatus.active
                ? t("header.watcherActive")
                : t("header.watcherInactive")}
            </span>
          </div>

          {/* Prominent GUIA Button */}
          <button
            type="button"
            onClick={() => void openExternalUrl(GUIDE_URL)}
            className="guide-btn px-3.5 h-8 text-xs font-semibold gap-1.5 shrink-0 rounded-full cursor-pointer"
            title="Guia de Treino de Mira"
          >
            <svg
              className="w-3.5 h-3.5 text-text-secondary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span>{t("header.guide")}</span>
            <svg
              className="w-3 h-3 text-text-faint"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>

          {/* Language Selector */}
          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className="w-8 h-8 rounded-full minimal-btn-secondary text-xs font-bold"
            title={t("header.language")}
          >
            {lang.toUpperCase()}
          </button>

          {/* Theme Selector */}
          <button
            onClick={cycleTheme}
            className="w-8 h-8 rounded-full minimal-btn-secondary text-xs"
            title={t("header.theme")}
          >
            {theme === "dark" ? "●" : theme === "light" ? "○" : "◐"}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-full minimal-btn-secondary text-xs"
            title={t("header.settings")}
          >
            ⚙
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            className="px-3 h-8 rounded-full minimal-btn-secondary text-xs font-medium hidden sm:inline-flex"
          >
            {t("header.export")}
          </button>

          {/* Import */}
          <label className="px-3 h-8 rounded-full minimal-btn-secondary text-xs font-medium hidden sm:inline-flex cursor-pointer">
            {t("header.import")}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = "";
              }}
            />
          </label>

          {/* Demo */}
          <button
            onClick={onLoadDemo}
            className="px-3 h-8 rounded-full minimal-btn-secondary text-xs font-medium"
          >
            {t("header.demo")}
          </button>

          {/* Clear */}
          <button
            onClick={onClear}
            className="px-3 h-8 rounded-full minimal-btn-secondary text-xs text-text-faint hover:text-red hover:border-red-500/30"
            title={t("header.clearTitle")}
          >
            {t("header.clear")}
          </button>

        </div>
      </div>
    </header>
  );
}