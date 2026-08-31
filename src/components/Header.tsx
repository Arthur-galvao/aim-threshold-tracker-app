import type { WatcherStatus } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

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
    <header className="sticky top-0 z-40 chrome backdrop-blur-md border-b border-edge">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary text-primary-fg flex items-center justify-center font-mono font-bold text-xs shrink-0">
            /
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs font-semibold uppercase tracking-wider text-text-main truncate">
              Aim Threshold Tracker
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle text-text-secondary border border-edge truncate">
              {t("header.badge")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
              watcherStatus.active
                ? "bg-emerald-soft text-emerald border-emerald-edge"
                : "bg-surface-subtle text-text-faint border-edge"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                watcherStatus.active ? "bg-emerald animate-pulse" : "bg-text-faint"
              }`}
            />
            {watcherStatus.active
              ? t("header.watcherActive")
              : t("header.watcherInactive")}
          </div>

          <div className="h-4 w-px bg-edge mx-1 hidden sm:block" />

          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className="w-8 h-8 rounded-lg minimal-btn-secondary flex items-center justify-center text-[10px] font-mono font-semibold"
            title={t("header.language")}
          >
            {lang.toUpperCase()}
          </button>

          <button
            onClick={cycleTheme}
            className="w-8 h-8 rounded-lg minimal-btn-secondary flex items-center justify-center text-xs"
            title={t("header.theme")}
          >
            {theme === "dark" ? "●" : theme === "light" ? "○" : "◐"}
          </button>

          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-lg minimal-btn-secondary flex items-center justify-center text-xs"
            title={t("header.settings")}
          >
            ⚙
          </button>

          <button
            onClick={onExport}
            className="px-2.5 h-8 rounded-lg minimal-btn-secondary text-[11px] font-medium hidden sm:inline-flex items-center"
          >
            {t("header.export")}
          </button>

          <label className="px-2.5 h-8 rounded-lg minimal-btn-secondary text-[11px] font-medium hidden sm:inline-flex items-center cursor-pointer">
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

          <button
            onClick={onLoadDemo}
            className="px-3 h-8 rounded-lg minimal-btn text-[11px]"
          >
            {t("header.demo")}
          </button>

          <button
            onClick={onClear}
            className="px-3 h-8 rounded-lg minimal-btn-secondary text-[11px]"
            title={t("header.clearTitle")}
          >
            {t("header.clear")}
          </button>
        </div>
      </div>
    </header>
  );
}