import { useState, useEffect } from "react";
import { Plus, Play, PencilSimple, Trash, ArrowsClockwise } from "@phosphor-icons/react";
import type { Playlist, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { PlaylistEditor } from "./PlaylistEditor";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

interface PlaylistManagerModalProps {
  open: boolean;
  onClose: () => void;
  playlists: Playlist[];
  tasks: Task[];
  initialTaskIds?: string[];
  onCreatePlaylist: (playlist: Playlist) => Promise<void>;
  onUpdatePlaylist: (playlist: Playlist) => Promise<void>;
  onDeletePlaylist: (id: string) => Promise<void>;
  onStartPlaylist: (playlist: Playlist) => void;
  onSyncGames?: () => Promise<void>;
}

export function PlaylistManagerModal({
  open,
  onClose,
  playlists,
  tasks,
  initialTaskIds,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onStartPlaylist,
  onSyncGames,
}: PlaylistManagerModalProps) {
  const { t } = useI18n();
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // If opened with initialTaskIds, open directly into creating mode
  useEffect(() => {
    if (open && initialTaskIds && initialTaskIds.length > 0) {
      setIsCreating(true);
      setEditingPlaylist(null);
    } else if (!open) {
      setIsCreating(false);
      setEditingPlaylist(null);
    }
  }, [open, initialTaskIds]);

  if (!open) return null;

  const handleSave = async (playlist: Playlist) => {
    if (editingPlaylist) {
      await onUpdatePlaylist(playlist);
    } else {
      await onCreatePlaylist(playlist);
    }
    setIsCreating(false);
    setEditingPlaylist(null);
  };

  const handleAppendToExisting = async (playlist: Playlist) => {
    if (!initialTaskIds || initialTaskIds.length === 0) return;
    const newItems = initialTaskIds.map((taskId, idx) => ({
      id: `item_${Date.now()}_${idx}`,
      taskId,
      targetMode: "reps" as const,
      targetValue: 5,
    }));
    const updated: Playlist = {
      ...playlist,
      items: [...playlist.items, ...newItems],
    };
    await onUpdatePlaylist(updated);
    onClose();
  };

  const handleSyncKovaak = async () => {
    if (!onSyncGames || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncGames();
    } finally {
      setIsSyncing(false);
    }
  };

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const modalTitle = isCreating || editingPlaylist
    ? editingPlaylist
      ? t("playlist.edit")
      : t("playlist.createNew")
    : t("playlist.title");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={modalTitle}
      maxWidth="2xl"
      className="glass-floating"
    >
      <div className="flex-1 pr-1">
        {isCreating || editingPlaylist ? (
          <PlaylistEditor
            initialPlaylist={editingPlaylist}
            tasks={tasks}
            initialTaskIds={initialTaskIds}
            onSave={handleSave}
            onCancel={() => {
              setIsCreating(false);
              setEditingPlaylist(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Option to append selection to existing if initialTaskIds is provided */}
            {initialTaskIds && initialTaskIds.length > 0 && playlists.length > 0 && (
              <div className="p-3.5 bg-score-soft border border-score/25 rounded-2xl mb-3 enter" style={{ "--i": 0 } as React.CSSProperties}>
                <div className="text-xs font-semibold text-score mb-2">
                  {t("playlist.selectPlaylistToAdd")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => handleAppendToExisting(pl)}
                      className="press px-3 py-1.5 rounded-xl bg-surface text-xs font-medium border border-edge hover:border-score text-text-main transition-colors"
                    >
                      + {pl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top action to create and sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs text-text-secondary">
                {t("playlist.subtitle")}
              </span>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {onSyncGames && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSyncKovaak}
                    disabled={isSyncing}
                    title={t("playlist.syncGames")}
                    className="press"
                    icon={<ArrowsClockwise size={13} weight="bold" className={isSyncing ? "animate-spin" : ""} />}
                  >
                    {isSyncing ? t("playlist.syncing") : t("playlist.syncGames")}
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  className="press"
                  icon={<Plus size={13} weight="bold" />}
                >
                  {t("playlist.createNew")}
                </Button>
              </div>
            </div>

            {/* Playlists List */}
            {playlists.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-faint border border-dashed border-edge rounded-2xl">
                {t("playlist.emptyList")}
              </div>
            ) : (
              <div className="space-y-3">
                {playlists.map((playlist, index) => {
                  return (
                    <div
                      key={playlist.id}
                      className="glass-card-interactive p-4 sm:p-5 rounded-2xl border border-edge flex flex-col gap-3 enter"
                      style={{ "--i": index } as React.CSSProperties}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-text-main truncate">
                            {playlist.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                            <span className="font-medium tabular-nums">
                              {t("playlist.itemsCount", {
                                n: playlist.items.length,
                              })}
                            </span>
                            <span className="text-text-faint">·</span>
                            <span className="text-text-faint tabular-nums">
                              {new Date(playlist.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              onStartPlaylist(playlist);
                              onClose();
                            }}
                            className="press"
                            icon={<Play size={12} weight="bold" />}
                          >
                            {t("playlist.start")}
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingPlaylist(playlist)}
                            className="press"
                            icon={<PencilSimple size={12} weight="bold" />}
                          >
                            {t("playlist.edit")}
                          </Button>

                          <IconButton
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeletePlaylist(playlist.id)}
                            aria-label={t("playlist.delete")}
                            className="press text-text-faint hover:text-red hover:bg-red-soft"
                          >
                            <Trash size={14} weight="regular" />
                          </IconButton>
                        </div>
                      </div>

                      {/* Scenario chips preview */}
                      <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-edge">
                        {playlist.items.slice(0, 6).map((item, idx) => {
                          const task = taskMap.get(item.taskId);
                          return (
                            <span
                              key={item.id}
                              className="px-2.5 py-1 rounded-lg bg-surface-subtle border border-edge text-xs text-text-secondary flex items-center gap-1.5"
                            >
                              <span className="text-[10px] text-text-faint font-mono tabular-nums">
                                {idx + 1}.
                              </span>
                              <span className="truncate max-w-[130px]">
                                {task ? task.name : `#${item.taskId}`}
                              </span>
                              <span className="text-[10px] text-text-faint font-medium font-mono tabular-nums">
                                ({item.targetValue}
                                {item.targetMode === "reps" ? "r" : "s"})
                              </span>
                            </span>
                          );
                        })}
                        {playlist.items.length > 6 && (
                          <span className="px-2.5 py-1 rounded-lg bg-surface-subtle border border-edge text-xs text-text-faint font-mono tabular-nums">
                            +{playlist.items.length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

