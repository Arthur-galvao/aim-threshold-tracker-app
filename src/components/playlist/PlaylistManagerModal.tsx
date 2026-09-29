import { useState, useEffect } from "react";
import type { Playlist, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { PlaylistEditor } from "./PlaylistEditor";

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
  onSyncKovaak?: () => Promise<void>;
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
  onSyncKovaak,
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
    if (!onSyncKovaak || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncKovaak();
    } finally {
      setIsSyncing(false);
    }
  };

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="fixed inset-0 modal-scrim z-50 flex items-center justify-center p-4">
      <div className="panel p-6 max-w-2xl w-full shadow-2xl rounded-2xl transition-all duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-edge pb-3.5 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                {isCreating || editingPlaylist
                  ? editingPlaylist
                    ? t("playlist.edit")
                    : t("playlist.createNew")
                  : t("playlist.title")}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text-faint hover:text-text-main hover:bg-surface-subtle transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-transparent">
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
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-3">
                  <div className="text-xs font-semibold text-blue-400 mb-2">
                    {t("playlist.selectPlaylistToAdd")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => handleAppendToExisting(pl)}
                        className="px-3 py-1.5 rounded-lg bg-surface text-xs font-medium border border-edge hover:border-blue-400 text-text-main transition-colors"
                      >
                        + {pl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Top action to create and sync */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-text-faint">
                  {t("playlist.subtitle")}
                </span>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {onSyncKovaak && (
                    <button
                      type="button"
                      onClick={handleSyncKovaak}
                      disabled={isSyncing}
                      className="minimal-btn-secondary px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border-edge text-text-secondary hover:text-text-main disabled:opacity-50 transition-all"
                      title={t("playlist.syncKovaak")}
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                      <span>{isSyncing ? t("playlist.syncing") : t("playlist.syncKovaak")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1.5 px-3.5 rounded-full text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <span className="text-xs font-bold leading-none">+</span>
                    <span>{t("playlist.createNew")}</span>
                  </button>
                </div>
              </div>

              {/* Playlists List */}
              {playlists.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-faint border border-dashed border-edge rounded-xl">
                  {t("playlist.emptyList")}
                </div>
              ) : (
                <div className="space-y-3">
                  {playlists.map((playlist) => {
                    return (
                      <div
                        key={playlist.id}
                        className="p-4 rounded-xl border border-edge bg-surface hover:border-white/20 transition-all flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-text-main truncate">
                              {playlist.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-text-faint mt-1">
                              <span className="font-medium text-text-secondary">
                                {t("playlist.itemsCount", {
                                  n: playlist.items.length,
                                })}
                              </span>
                              <span>·</span>
                              <span>
                                {new Date(playlist.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onStartPlaylist(playlist);
                                onClose();
                              }}
                              className="minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all"
                            >
                              <svg
                                className="w-3 h-3 fill-current"
                                viewBox="0 0 24 24"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              <span>{t("playlist.start")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingPlaylist(playlist)}
                              className="minimal-btn-secondary px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-main border-edge rounded-lg"
                            >
                              {t("playlist.edit")}
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeletePlaylist(playlist.id)}
                              className="p-1.5 rounded-lg text-text-faint hover:text-red hover:bg-red-500/10 transition-colors"
                              title={t("playlist.delete")}
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Scenario chips preview */}
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-edge/60">
                          {playlist.items.slice(0, 6).map((item, idx) => {
                            const task = taskMap.get(item.taskId);
                            return (
                              <span
                                key={item.id}
                                className="px-2 py-0.5 rounded-md bg-surface-subtle border border-edge text-[11px] text-text-secondary flex items-center gap-1"
                              >
                                <span className="text-[10px] text-text-faint font-mono">
                                  {idx + 1}.
                                </span>
                                <span className="truncate max-w-[130px]">
                                  {task ? task.name : `#${item.taskId}`}
                                </span>
                                <span className="text-[10px] text-text-faint font-medium">
                                  ({item.targetValue}
                                  {item.targetMode === "reps" ? "r" : "s"})
                                </span>
                              </span>
                            );
                          })}
                          {playlist.items.length > 6 && (
                            <span className="px-2 py-0.5 rounded-md bg-surface-subtle border border-edge text-[10px] text-text-faint">
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
      </div>
    </div>
  );
}
