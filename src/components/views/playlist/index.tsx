import { useState, useMemo } from "react";
import {
  Plus,
  ArrowsClockwise,
  CheckCircle,
  ArrowCounterClockwise,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button, EmptyState } from "@/components/ui";
import { useApp } from "@/hooks/useAppData";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import { useI18n } from "@/lib/i18n";
import type { Playlist } from "@/lib/types";
import { computePlaylistSensStats } from "@/lib/sens-analytics";
import { ActiveRunnerStep } from "./ActiveRunnerStep";
import { StepSequenceList } from "./StepSequenceList";
import { StepSensCard } from "./StepSensCard";
import { PlaylistCard } from "./PlaylistCard";
import { PlaylistManagerDialog } from "@/components/dialogs/PlaylistManagerDialog";

export interface PlaylistViewProps {
  className?: string;
  onOpenManager?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlaylistView({ className, onOpenManager }: PlaylistViewProps) {
  const { t } = useI18n();
  const {
    appData,
    playlistRunner,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncGamePlaylists,
  } = useApp();

  const {
    settings: randomizerSettings,
    syncScenarioSens,
  } = useSensRandomizer();

  const [managerOpen, setManagerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const playlists = appData.playlists ?? [];
  const tasks = appData.tasks;
  const dpi = randomizerSettings.mouseDpi;

  const activeStats = useMemo(() => {
    if (!playlistRunner.activePlaylist) return null;
    return computePlaylistSensStats(
      playlistRunner.activePlaylist,
      tasks,
      "equilibrado",
      dpi
    );
  }, [playlistRunner.activePlaylist, tasks, dpi]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncGamePlaylists(true);
    } finally {
      setSyncing(false);
    }
  };

  const handleApplySens = async (sensCm: number, _scenarioName?: string) => {
    await syncScenarioSens(sensCm, true);
  };

  const handleOpenManager = () => {
    if (onOpenManager) {
      onOpenManager();
    } else {
      setManagerOpen(true);
    }
  };

  const handleEditPlaylist = (_pl: Playlist) => {
    handleOpenManager();
  };

  // Case 1: Runner is actively running or has an active playlist
  if (playlistRunner.isRunning && playlistRunner.activePlaylist && !playlistRunner.isFinished) {
    return (
      <div className={cn("grid grid-cols-12 gap-4", className)}>
        {/* Big Step Runner Stage */}
        <div className="col-span-12 lg:col-span-8">
          <ActiveRunnerStep
            runner={playlistRunner}
            tasks={tasks}
            mouseDpi={dpi}
            playlistStats={activeStats}
            onApplySens={handleApplySens}
          />
        </div>

        {/* Step Sequence List */}
        <div className="col-span-12 lg:col-span-4">
          <StepSequenceList
            runner={playlistRunner}
            tasks={tasks}
          />
        </div>

        {/* Sensitivity Breakdown for all Steps */}
        <StepSensCard
          playlist={playlistRunner.activePlaylist}
          tasks={tasks}
          mouseDpi={dpi}
          onApplySens={handleApplySens}
        />
      </div>
    );
  }

  // Case 2: Runner finished all steps
  if (playlistRunner.isFinished && playlistRunner.activePlaylist) {
    const totalSecs = playlistRunner.playlistElapsedSeconds;
    const isShortSession =
      playlistRunner.activePlaylist.items.length >= 3 &&
      totalSecs > 0 &&
      totalSecs < 900;

    return (
      <div className={cn("grid grid-cols-12 gap-4", className)}>
        <div className="liquid-surface col-span-12 p-8 text-center rounded-tile space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-soft text-emerald flex items-center justify-center mx-auto shadow-1">
            <CheckCircle size={28} weight="fill" />
          </div>
          <h2 className="text-xl font-bold text-text-main font-sans">
            {t("runner.completed")}
          </h2>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            {t("runner.completedDesc")}
          </p>
          {totalSecs > 0 && (
            <p className="text-xs font-mono text-text-faint tabular-nums">
              {t("runner.sessionDuration", { duration: formatDuration(totalSecs) })}
            </p>
          )}
          {isShortSession && (
            <div className="max-w-lg mx-auto p-3.5 rounded-control bg-amber/10 border border-amber/30 text-left flex items-start gap-2.5">
              <WarningCircle size={18} weight="bold" className="text-amber shrink-0 mt-0.5" />
              <p className="text-xs text-text-main leading-relaxed">
                {t("runner.shortSessionWarning", { duration: formatDuration(totalSecs) })}
              </p>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={playlistRunner.restart}
              icon={<ArrowCounterClockwise size={14} weight="bold" />}
            >
              {t("runner.restart")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={playlistRunner.stop}
            >
              {t("runner.chooseOther")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Idle Playlist catalog view
  return (
    <div className={cn("grid grid-cols-12 gap-4", className)}>
      {/* Top Header / Actions */}
      <div className="col-span-12 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 py-1">
        <div>
          <h2 className="text-base font-bold text-text-main font-sans">
            {t("playlist.title")}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {t("playlist.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full"
            loading={syncing}
            onClick={handleSync}
            icon={<ArrowsClockwise size={13} weight="bold" />}
          >
            {syncing ? t("playlist.syncing") : t("playlist.syncGamesShort")}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            className="rounded-full"
            onClick={handleOpenManager}
            icon={<Plus size={13} weight="bold" />}
          >
            {t("playlist.createNew")}
          </Button>
        </div>
      </div>

      {/* Playlist Grid */}
      {playlists.length === 0 ? (
        <div className="col-span-12 liquid-surface p-8 rounded-tile">
          <EmptyState
            title={t("playlist.emptyList")}
            description={t("playlist.subtitle")}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleOpenManager}
                icon={<Plus size={14} weight="bold" />}
              >
                {t("playlist.createNew")}
              </Button>
            }
          />
        </div>
      ) : (
        playlists.map((playlist) => (
          <div key={playlist.id} className="col-span-12 md:col-span-6 xl:col-span-4">
            <PlaylistCard
              playlist={playlist}
              tasks={tasks}
              mouseDpi={dpi}
              onStart={(pl) => playlistRunner.start(pl)}
              onEdit={handleEditPlaylist}
              onDelete={deletePlaylist}
            />
          </div>
        ))
      )}

      {/* Embedded Manager dialog fallback if onOpenManager not wired */}
      {!onOpenManager && (
        <PlaylistManagerDialog
          open={managerOpen}
          onClose={() => setManagerOpen(false)}
          playlists={playlists}
          tasks={tasks}
          onCreatePlaylist={async (pl) => {
            await createPlaylist(pl.name, pl.items);
          }}
          onUpdatePlaylist={updatePlaylist}
          onDeletePlaylist={deletePlaylist}
          onStartPlaylist={(pl) => playlistRunner.start(pl)}
          onSyncGames={handleSync}
        />
      )}
    </div>
  );
}

export default PlaylistView;
