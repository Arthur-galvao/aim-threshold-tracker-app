import { useState, useMemo, useEffect } from "react";
import {
  ListChecks,
  Plus,
  Play,
  PencilSimple,
  Trash,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  Button,
  Badge,
} from "@/components/ui";
import type { Playlist, Task } from "@/lib/types";
import { PlaylistEditor } from "./PlaylistEditor";
import { useI18n } from "@/lib/i18n";

export interface PlaylistManagerDialogProps {
  open: boolean;
  onClose: () => void;
  playlists: Playlist[];
  tasks: Task[];
  onCreatePlaylist: (playlist: Playlist) => Promise<void> | void;
  onUpdatePlaylist: (playlist: Playlist) => Promise<void> | void;
  onDeletePlaylist: (id: string) => Promise<void> | void;
  onStartPlaylist?: (playlist: Playlist) => void;
  onSyncGames?: () => Promise<void>;
  initialTaskIds?: string[];
}

export function PlaylistManagerDialog({
  open,
  onClose,
  playlists,
  tasks,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onStartPlaylist,
  onSyncGames,
  initialTaskIds,
}: PlaylistManagerDialogProps) {
  const { t } = useI18n();
  const [isCreating, setIsCreating] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("create") === "1";
    }
    return false;
  });
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("dialog");
      if (p === "playlist-editor") {
        return playlists[0] ?? null;
      }
    }
    return null;
  });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("dialog");
      if (p === "playlist-editor" && playlists.length > 0 && !editingPlaylist && !isCreating) {
        setEditingPlaylist(playlists[0]);
      }
    }
  }, [playlists, editingPlaylist, isCreating]);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const handleSync = async () => {
    if (!onSyncGames || syncing) return;
    setSyncing(true);
    try {
      await onSyncGames();
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveEditor = async (playlist: Playlist) => {
    if (editingPlaylist) {
      await onUpdatePlaylist(playlist);
    } else {
      await onCreatePlaylist(playlist);
    }
    setIsCreating(false);
    setEditingPlaylist(null);
  };

  const handleClose = () => {
    setIsCreating(false);
    setEditingPlaylist(null);
    onClose();
  };

  const title = isCreating
    ? t("playlist.createNew")
    : editingPlaylist
    ? t("playlist.edit")
    : t("playlist.title");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="dialog" className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b border-edge shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-control bg-score-soft text-score border border-edge flex items-center justify-center shadow-1">
                <ListChecks size={16} weight="bold" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-text-main font-sans">
                  {title}
                </DialogTitle>
                <p className="text-[11px] text-text-faint">
                  {t("playlist.subtitle")}
                </p>
              </div>
            </div>

            {!isCreating && !editingPlaylist && (
              <div className="flex items-center gap-2 pr-8">
                {onSyncGames && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={syncing}
                    onClick={handleSync}
                    icon={<ArrowsClockwise size={13} weight="bold" />}
                  >
                    {syncing ? t("playlist.syncing") : t("playlist.syncGamesShort")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  icon={<Plus size={13} weight="bold" />}
                >
                  {t("playlist.createNew")}
                </Button>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto scroll-y p-6">
            {isCreating || editingPlaylist ? (
              <PlaylistEditor
                initialPlaylist={editingPlaylist}
                tasks={tasks}
                initialTaskIds={initialTaskIds}
                onSave={handleSaveEditor}
                onCancel={() => {
                  setIsCreating(false);
                  setEditingPlaylist(null);
                }}
              />
            ) : playlists.length === 0 ? (
              <div className="glass-inset p-12 text-center text-xs text-text-faint">
                {t("playlist.emptyList")}
              </div>
            ) : (
              <div className="space-y-3">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="glass-inset p-4 rounded-control flex flex-col gap-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-text-main font-sans truncate block">
                          {playlist.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-text-faint font-mono">
                          <span>
                            {t("playlist.itemsCount", { n: playlist.items.length })}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">
                            {new Date(playlist.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onStartPlaylist && (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              onStartPlaylist(playlist);
                              handleClose();
                            }}
                            icon={<Play size={13} weight="fill" />}
                          >
                            {t("playlist.start")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingPlaylist(playlist)}
                          icon={<PencilSimple size={13} weight="bold" />}
                        >
                          {t("playlist.edit")}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`${t("playlist.delete")} "${playlist.name}"?`)) {
                              void onDeletePlaylist(playlist.id);
                            }
                          }}
                          className="p-1.5 rounded-control text-text-faint hover:text-red hover:bg-red-soft transition"
                          title={t("playlist.delete")}
                        >
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </div>

                    {/* Step chips preview */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-edge">
                      {playlist.items.slice(0, 5).map((item, idx) => {
                        const task = taskMap.get(item.taskId);
                        return (
                          <Badge
                            key={item.id}
                            variant="neutral"
                            className="font-mono text-[10px] tabular-nums"
                          >
                            <span className="text-text-faint mr-1">{idx + 1}.</span>
                            <span className="truncate max-w-[120px]">
                              {task ? task.name : `#${item.taskId}`}
                            </span>
                            <span className="text-text-faint ml-1">
                              ({item.targetValue}
                              {item.targetMode === "reps" ? "r" : "s"})
                            </span>
                          </Badge>
                        );
                      })}
                      {playlist.items.length > 5 && (
                        <Badge variant="neutral" className="font-mono text-[10px] text-text-faint">
                          +{playlist.items.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export default PlaylistManagerDialog;
