import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/hooks/useAppData";
import { useSettings } from "@/hooks/useSettings";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import { useLabRanges } from "@/hooks/useLabRanges";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_LAB_SETTINGS, type Task } from "@/lib/types";
import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY } from "@/lib/viscose";
import { GAMES, findGame, gameToCm } from "@/lib/lab/games";
import {
  DEFAULT_GAME_WEIGHTS,
  directionalPhrase,
  suggestForGame,
  verdict,
} from "@/lib/lab/game-suggestion";
import {
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { GameCard } from "./game-card";
import { CategoryRangeCard } from "./category-range-card";
import { CategoryCards } from "./category-cards";

export interface LabViewProps {
  className?: string;
}

/**
 * Laboratório de sens (experimental, Plano 06 / T6.4). Sugestões direcionais em faixas;
 * nunca um número único como verdade. Só muda o randomizer com confirmação explícita.
 */
export function LabView({ className }: LabViewProps) {
  const { t } = useI18n();

  const { appData } = useApp();
  const tasks = appData.tasks;
  const playlists = appData.playlists ?? [];
  const { settings, updateSettings } = useSettings();
  const { settings: randomizerSettings, saveSettings: saveRandomizerSettings } = useSensRandomizer();

  const lab = useLabRanges(tasks, settings);
  const labSettings = settings?.lab ?? DEFAULT_LAB_SETTINGS;
  const game = findGame(labSettings.gameId) ?? GAMES[0];
  const dpi = lab.mouseDpi;

  const suggestion = useMemo(
    () => suggestForGame(lab.ranges, DEFAULT_GAME_WEIGHTS[game.id] ?? {}),
    [lab.ranges, game.id],
  );

  const savedSens = labSettings.inGameSens;
  const currentCm = savedSens !== null && savedSens > 0 ? gameToCm(savedSens, dpi, game) : null;

  const phrase = useMemo(() => {
    const p = directionalPhrase(suggestion, game, dpi, currentCm);
    return t(p.key, p.params);
  }, [suggestion, game, dpi, currentCm, t]);

  const verdictKind =
    suggestion.status === "ok" && currentCm !== null
      ? verdict(currentCm, suggestion.loCm, suggestion.hiCm).kind
      : null;

  // Campo da sens atual: rascunho local, sincronizado quando a setting muda (ex.: carregamento).
  const [sensDraft, setSensDraft] = useState(savedSens !== null ? String(savedSens) : "");
  const [sensInvalid, setSensInvalid] = useState(false);
  useEffect(() => {
    setSensDraft(savedSens !== null ? String(savedSens) : "");
    setSensInvalid(false);
  }, [savedSens]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const usingLabCenter = randomizerSettings.centerSource === "lab";
  const hasLabCenters = Object.keys(lab.labCenters).length > 0;

  const saveLab = useCallback(
    (patch: Partial<typeof labSettings>) => {
      if (!settings) return;
      updateSettings({ lab: { ...labSettings, ...patch } }).catch((err: unknown) => {
        console.error("Falha ao salvar ajustes do Laboratório:", err);
      });
    },
    [settings, updateSettings, labSettings],
  );

  const commitSens = useCallback(() => {
    const text = sensDraft.trim().replace(",", ".");
    if (text === "") {
      setSensInvalid(false);
      if (savedSens !== null) saveLab({ inGameSens: null });
      return;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value <= 0) {
      setSensInvalid(true);
      return;
    }
    setSensInvalid(false);
    if (value !== savedSens) saveLab({ inGameSens: value });
  }, [sensDraft, savedSens, saveLab]);

  const handleConfirmCenter = useCallback(async () => {
    setConfirmOpen(false);
    try {
      await saveRandomizerSettings({ ...randomizerSettings, centerSource: "lab" });
    } catch (err) {
      console.error("Falha ao definir o centro do randomizer:", err);
    }
  }, [randomizerSettings, saveRandomizerSettings]);

  const handleRevertCenter = useCallback(async () => {
    try {
      await saveRandomizerSettings({ ...randomizerSettings, centerSource: "personal_relative" });
    } catch (err) {
      console.error("Falha ao reverter o centro do randomizer:", err);
    }
  }, [randomizerSettings, saveRandomizerSettings]);

  // Tasks agrupadas por "Categoria/Subcategoria" (com o mesmo default do cálculo).
  const tasksBySub = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const cat = task.category || DEFAULT_CATEGORY;
      const sub = task.subcategory || DEFAULT_SUBCATEGORY;
      const key = `${cat}/${sub}`;
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [tasks]);

  const sortedRanges = useMemo(
    () => [...lab.ranges].sort((a, b) => b.nRuns - a.nRuns),
    [lab.ranges],
  );

  if (!settings) {
    return <div className={cn("py-16 text-center text-xs text-text-faint", className)}>{t("lab.loading")}</div>;
  }

  return (
    <div className={cn("space-y-4 pb-6", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xs font-semibold text-text-main tracking-tight">{t("lab.title")}</h2>
          <Badge variant="amber" className="uppercase font-mono text-[9px]">
            {t("lab.badge")}
          </Badge>
        </div>
        <p className="text-[11px] text-text-faint">{t("lab.banner")}</p>
      </div>

      {tasks.length === 0 ? (
        <div className="liquid-surface p-8 rounded-tile text-center text-xs text-text-faint">
          {t("lab.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <GameCard
              game={game}
              dpi={dpi}
              suggestion={suggestion}
              phrase={phrase}
              sensDraft={sensDraft}
              currentCm={currentCm}
              verdictKind={verdictKind}
              onGameChange={(gameId) => saveLab({ gameId })}
              onSensDraftChange={(value) => {
                setSensDraft(value);
                setSensInvalid(false);
              }}
              onSensSave={commitSens}
            />
            {sensInvalid && (
              <p role="alert" className="text-[11px] text-red -mt-3">
                {t("lab.game.invalidSens")}
              </p>
            )}

            <section className="liquid-surface p-5 rounded-tile space-y-3">
              <h3 className="text-xs font-semibold text-text-main">{t("lab.center.title")}</h3>
              {usingLabCenter ? (
                <>
                  <p className="text-[11px] text-text-secondary">{t("lab.center.active")}</p>
                  <Button variant="secondary" size="sm" onClick={handleRevertCenter} className="rounded-full">
                    {t("lab.center.revert")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-text-faint">{t("lab.center.help")}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!hasLabCenters}
                    onClick={() => setConfirmOpen(true)}
                    className="rounded-full"
                  >
                    {t("lab.center.button")}
                  </Button>
                  {!hasLabCenters && (
                    <p className="text-[11px] text-text-faint">{t("lab.center.noCenters")}</p>
                  )}
                </>
              )}
            </section>
          </div>

          <div className="col-span-12 lg:col-span-7 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-text-main">{t("lab.subcats.title")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedRanges.map((range) => (
                <CategoryRangeCard
                  key={`${range.category}/${range.subcategory}`}
                  range={range}
                  subTasks={tasksBySub.get(`${range.category}/${range.subcategory}`) ?? []}
                  game={game}
                  dpi={dpi}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] text-text-faint">{t("lab.legacy.note")}</p>
          <CategoryCards tasks={tasks} playlists={playlists} mouseDpi={dpi} />
        </section>
      )}

      <Dialog open={confirmOpen} onOpenChange={(next) => !next && setConfirmOpen(false)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup variant="dialog" className="max-w-md">
            <DialogTitle className="text-sm font-semibold text-text-main font-sans">
              {t("lab.center.confirmTitle")}
            </DialogTitle>
            <DialogDescription className="mt-3 text-xs text-text-secondary leading-relaxed">
              {t("lab.center.confirmBody")}
            </DialogDescription>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} className="rounded-full">
                {t("lab.center.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmCenter} className="rounded-full">
                {t("lab.center.confirm")}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

export default LabView;
