import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import {
  MagnifyingGlass,
  Plus,
  FileArrowDown,
  FileArrowUp,
  FolderOpen,
  Check,
  Command,
  ArrowsDownUp,
  Sparkle,
} from "@phosphor-icons/react";
import { Dialog, Switch, Menu, Tabs } from "@base-ui/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import { cn } from "@/lib/utils";

const CATEGORY_KEYS = ["All", ...Object.keys(VISCOSE_CATEGORIES)];

export interface CommandBarProps {
  className?: string;
  onNewScenario?: () => void;
  onOpenSettings?: () => void;
}

export function CommandBarBrand() {
  return (
    <div className="flex items-center gap-2.5 shrink-0 select-none">
      <div className="w-9 h-9 rounded-xl bg-score-soft border border-score/30 flex items-center justify-center text-score shadow-xs shrink-0 font-mono font-bold text-xs tracking-wider press">
        AT
      </div>
    </div>
  );
}

export function CommandBarCategoryTabs({ className }: { className?: string }) {
  const { state, actions } = useTrackerWorkspace();
  const { activeCategory, tasks } = state;
  const { selectCategory } = actions;

  // Compute scenario count per category
  const counts = useMemo(() => {
    const map: Record<string, number> = { All: tasks.length };
    for (const t of tasks) {
      if (t.category) {
        map[t.category] = (map[t.category] || 0) + 1;
      }
    }
    return map;
  }, [tasks]);

  return (
    <Tabs.Root
      value={activeCategory}
      onValueChange={(val) => selectCategory(String(val))}
      className={cn("hidden xl:flex items-center", className)}
    >
      <Tabs.List
        aria-label="Categorias Viscose"
        className="flex items-center p-1 rounded-xl bg-surface-subtle/60 border border-glass-edge relative shadow-xs"
      >
        {CATEGORY_KEYS.map((cat) => {
          const isActive = activeCategory === cat;
          const count = counts[cat] || 0;
          const label = cat === "All" ? "Todas" : cat;
          return (
            <Tabs.Tab
              key={cat}
              value={cat}
              className={cn(
                "relative px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer z-10 select-none flex items-center gap-1.5 press",
                isActive
                  ? "text-score font-bold"
                  : "text-text-secondary hover:text-text-main"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="viscose-category-pill"
                  className="absolute inset-0 rounded-lg liquid-glass-control shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span>{label}</span>
              <span className={cn(
                "text-[10px] tabular-nums font-mono px-1.5 py-0.5 rounded-full",
                isActive ? "bg-score-soft text-score border border-score/30" : "text-text-faint bg-glass-bg border border-glass-edge"
              )}>
                {count}
              </span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}

export function CommandBarScenarioPicker({
  onNewScenario,
}: {
  onNewScenario?: () => void;
}) {
  const { state, actions } = useTrackerWorkspace();
  const { tasks, activeCategory, activeTask } = state;
  const { selectTask } = actions;

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Global Ctrl+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (activeCategory !== "All") {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.subcategory && t.subcategory.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tasks, activeCategory, searchQuery]);

  const handleSelect = useCallback(
    (id: string) => {
      selectTask(id);
      setPaletteOpen(false);
      setSearchQuery("");
    },
    [selectTask]
  );

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl liquid-glass-control text-left cursor-pointer transition-all hover:brightness-105 max-w-[280px] sm:max-w-[340px] press"
        title="Buscar ou Trocar Cenário (Ctrl+K)"
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-mono font-bold text-text-main truncate leading-tight">
            {activeTask?.name ?? "Selecionar Cenário..."}
          </div>
          <div className="text-[10px] font-mono text-text-faint truncate leading-none mt-0.5">
            {activeTask ? `${activeTask.category}${activeTask.subcategory ? ` • ${activeTask.subcategory}` : ""}` : "Nenhum ativo"}
          </div>
        </div>

        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-glass-input text-[10px] font-mono border border-glass-edge text-text-faint shrink-0">
          <Command size={10} />K ▾
        </kbd>
      </button>

      {onNewScenario && (
        <button
          type="button"
          onClick={onNewScenario}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass-control text-xs font-mono font-semibold text-score hover:brightness-105 cursor-pointer shrink-0 transition-all press"
          title="Criar Novo Cenário (+ Nova Task)"
          aria-label="Nova Task"
        >
          <Plus size={14} weight="bold" />
          <span className="hidden sm:inline">+ Cenário</span>
        </button>
      )}

      <Dialog.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 modal-scrim transition-opacity duration-200 animate-fade-in" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 pointer-events-none focus:outline-none">
            <div className="pointer-events-auto relative w-full max-w-lg liquid-glass-floating p-5 rounded-2xl shadow-float border border-glass-edge z-10 flex flex-col animate-pop-in">
              <div className="flex items-center gap-3 pb-3 border-b border-glass-edge">
                <MagnifyingGlass size={18} className="text-score shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar cenário (Ex: pasu, 1w4ts, tracking)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm font-mono text-text-main placeholder:text-text-faint focus:outline-none"
                />
                <kbd className="px-1.5 py-0.5 rounded bg-glass-input border border-glass-edge text-[10px] font-mono text-text-faint">
                  ESC
                </kbd>
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto custom-scrollbar space-y-1">
                {filteredTasks.length === 0 ? (
                  <div className="p-6 text-center text-xs font-mono text-text-faint">
                    Nenhum cenário encontrado.
                  </div>
                ) : (
                  filteredTasks.map((t) => {
                    const isSelected = activeTask?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelect(t.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-mono transition-colors cursor-pointer press",
                          isSelected
                            ? "bg-score-soft text-score font-bold border border-score/30 shadow-xs"
                            : "hover:bg-glass-bg-elevated text-text-main"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isSelected && <Check size={14} className="text-score shrink-0" />}
                          <span className="truncate">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-text-faint">
                          <span>{t.category}</span>
                          {t.subcategory && <span>({t.subcategory})</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {onNewScenario && (
                <div className="pt-3 mt-3 border-t border-glass-edge flex justify-between items-center text-xs font-mono">
                  <span className="text-[10px] text-text-faint">Não encontrou o que procura?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPaletteOpen(false);
                      onNewScenario();
                    }}
                    className="flex items-center gap-1.5 text-score hover:brightness-105 font-bold px-3 py-1.5 rounded-xl liquid-glass-control cursor-pointer press"
                  >
                    <Plus size={13} weight="bold" />
                    <span>Criar Novo Cenário</span>
                  </button>
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export function CommandBarWatcherBadge() {
  const { state, actions } = useTrackerWorkspace();
  const { watcherStatus } = state;
  const { toggleWatcher } = actions;

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl liquid-glass-control select-none">
      <Switch.Root
        checked={watcherStatus.active}
        onCheckedChange={() => void toggleWatcher()}
        aria-label="Toggle KovaaK's Watcher"
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-glass-edge transition-colors duration-200 ease-in-out focus:outline-none press",
          watcherStatus.active ? "bg-emerald-soft border-emerald-edge" : "bg-glass-input"
        )}
      >
        <Switch.Thumb
          className={cn(
            "pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-xs transition duration-200 ease-in-out mt-0.5",
            watcherStatus.active
              ? "translate-x-3.5 bg-emerald"
              : "translate-x-0.5 bg-text-faint"
          )}
        />
      </Switch.Root>

      <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
        <span className="relative flex h-2 w-2 items-center justify-center">
          {watcherStatus.active && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              watcherStatus.active ? "bg-emerald shadow-xs" : "bg-text-faint/50"
            )}
          />
        </span>
        <span className={watcherStatus.active ? "text-emerald" : "text-text-faint"}>
          {watcherStatus.active ? "KovaaK's Watcher: ATIVO" : "Watcher: IDLE"}
        </span>
      </div>
    </div>
  );
}

export function CommandBarSystemMenu({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const { actions } = useTrackerWorkspace();
  const { toggleTheme, exportBackupJson, importBackupJson } = actions;

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void importBackupJson(file);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* JSON Import/Export Menu */}
      <Menu.Root>
        <Menu.Trigger
          aria-label="Ações de Backup JSON"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass-control text-xs font-mono font-medium text-text-secondary hover:text-text-main transition-all cursor-pointer press"
          title="Importar e Exportar Backup JSON"
        >
          <ArrowsDownUp size={14} weight="bold" />
          <span>JSON ⇅</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={8}>
            <Menu.Popup className="w-56 rounded-2xl liquid-glass-floating p-1.5 shadow-float border border-glass-edge z-50 animate-pop-in text-xs font-mono space-y-1">
              <Menu.Item
                closeOnClick
                onClick={exportBackupJson}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-glass-bg-elevated text-text-main cursor-pointer transition-colors press"
              >
                <FileArrowDown size={15} className="text-score" />
                <span>Exportar Backup JSON</span>
              </Menu.Item>

              <label className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-glass-bg-elevated text-text-main cursor-pointer transition-colors press">
                <FileArrowUp size={15} className="text-emerald" />
                <span>Importar Backup JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>

              {onOpenSettings && (
                <Menu.Item
                  closeOnClick
                  onClick={onOpenSettings}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-glass-bg-elevated text-text-main cursor-pointer transition-colors border-t border-glass-edge pt-2 press"
                >
                  <FolderOpen size={15} className="text-text-secondary" />
                  <span>Configurações KovaaK&apos;s</span>
                </Menu.Item>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Theme Toggle Button: Frutiger Aero / Obsidian */}
      <button
        type="button"
        onClick={toggleTheme}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass-control text-xs font-mono font-medium text-text-secondary hover:text-text-main transition-all cursor-pointer press"
        title="Alternar Tema (Aero / Obsidian)"
        aria-label="Alternar Tema"
      >
        <Sparkle size={14} weight="fill" className="text-amber" />
        <span className="hidden sm:inline">✦ Aero</span>
      </button>
    </div>
  );
}

/**
 * Unified CommandBar: Single master top navigation HUD in 100% Liquid Glass.
 * Strict specifications:
 * - Exactly ONE navbar in the application (replaces redundant header)
 * - h-16 (64px), px-5 rounded-2xl flex items-center justify-between gap-4
 * - Left: Compact AT logo + Active Scenario Picker + "+ Cenário" button
 * - Center: Viscose Category Tabs with animated active pill
 * - Right: KovaaK's Watcher Live Badge + JSON Backup menu + Theme Toggle
 */
export function CommandBar({
  className,
  onNewScenario,
  onOpenSettings,
}: CommandBarProps) {
  return (
    <header
      className={cn(
        "w-full h-16 px-5 rounded-2xl liquid-glass-pill flex items-center justify-between gap-4 select-none shrink-0 transition-colors duration-200",
        className
      )}
    >
      {/* Left Zone: Brand + Active Scenario Picker + New Scenario Button */}
      <div className="flex items-center gap-3 shrink-0">
        <CommandBarBrand />
        <CommandBarScenarioPicker onNewScenario={onNewScenario} />
      </div>

      {/* Center Zone: Viscose Category Tabs with Fluid Indicator */}
      <CommandBarCategoryTabs />

      {/* Right Zone: KovaaK's Watcher Status, JSON Backup, Theme Toggle */}
      <div className="flex items-center gap-2.5 shrink-0">
        <CommandBarWatcherBadge />
        <CommandBarSystemMenu onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}

// Compound component attachments for idiomatic composition
CommandBar.Brand = CommandBarBrand;
CommandBar.CategoryTabs = CommandBarCategoryTabs;
CommandBar.ScenarioPicker = CommandBarScenarioPicker;
CommandBar.WatcherBadge = CommandBarWatcherBadge;
CommandBar.SystemMenu = CommandBarSystemMenu;
