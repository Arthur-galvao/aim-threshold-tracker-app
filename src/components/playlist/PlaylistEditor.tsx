import { useState } from "react";
import type { Playlist, PlaylistItem, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { getRecommendedSens } from "@/lib/viscose";

interface PlaylistEditorProps {
  initialPlaylist?: Playlist | null;
  tasks: Task[];
  initialTaskIds?: string[];
  onSave: (playlist: Playlist) => void;
  onCancel: () => void;
}

function getCategoryPriority(category: string): number {
  switch (category) {
    case "Click Timing":
      return 1;
    case "Control Tracking":
      return 2;
    case "Flick Tech":
      return 3;
    case "Reactive Tracking":
      return 4;
    default:
      return 5;
  }
}

export function PlaylistEditor({
  initialPlaylist,
  tasks,
  initialTaskIds,
  onSave,
  onCancel,
}: PlaylistEditorProps) {
  const { t } = useI18n();

  const [name, setName] = useState(initialPlaylist?.name ?? "");
  const [items, setItems] = useState<PlaylistItem[]>(() => {
    if (initialPlaylist) {
      return [...initialPlaylist.items];
    }
    if (initialTaskIds && initialTaskIds.length > 0) {
      return initialTaskIds.map((taskId, idx) => ({
        id: `item_${Date.now()}_${idx}`,
        taskId,
        targetMode: "reps" as const,
        targetValue: 5,
      }));
    }
    return [];
  });

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [selectedTaskToAdd, setSelectedTaskToAdd] = useState<string>("");

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const handleDragStart = (index: number) => {
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (index: number) => {
    if (draggedIdx === null || draggedIdx === index) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...items];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(index, 0, moved);
    setItems(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleUpdateItem = (
    index: number,
    updates: Partial<PlaylistItem>
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = (taskId: string) => {
    if (!taskId) return;
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${prev.length}`,
        taskId,
        targetMode: "reps",
        targetValue: 5,
      },
    ]);
    setSelectedTaskToAdd("");
  };

  const handleSuggestOrder = () => {
    const sorted = [...items].sort((a, b) => {
      const taskA = taskMap.get(a.taskId);
      const taskB = taskMap.get(b.taskId);
      const prioA = taskA ? getCategoryPriority(taskA.category) : 5;
      const prioB = taskB ? getCategoryPriority(taskB.category) : 5;
      if (prioA !== prioB) return prioA - prioB;
      return (taskA?.name ?? "").localeCompare(taskB?.name ?? "");
    });
    setItems(sorted);
  };

  const isValid = name.trim().length > 0 && items.length > 0;

  const handleSave = () => {
    if (!isValid) return;
    const playlist: Playlist = {
      id: initialPlaylist?.id ?? `pl_${Date.now()}`,
      name: name.trim(),
      items,
      createdAt: initialPlaylist?.createdAt ?? new Date().toISOString(),
    };
    onSave(playlist);
  };

  return (
    <div className="space-y-5">
      {/* Name Input */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
          {t("playlist.name")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("playlist.namePh")}
          className="minimal-input text-sm w-full font-medium"
        />
      </div>

      {/* Header controls for items */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-edge">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-main">
            {t("scenarioList.title")}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-edge font-medium">
            {t("playlist.itemsCount", { n: items.length })}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSuggestOrder}
          title={t("playlist.orderSuggestTooltip")}
          disabled={items.length < 2}
          className="minimal-btn-secondary px-3 py-1.5 text-xs font-medium gap-1.5 text-text-secondary hover:text-text-main border-edge rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            className="w-3.5 h-3.5 text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span>{t("playlist.orderSuggest")}</span>
        </button>
      </div>

      {/* Drag & Drop Items List */}
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-transparent">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-faint border border-dashed border-edge rounded-xl">
            {t("playlist.validationEmpty")}
          </div>
        ) : (
          items.map((item, index) => {
            const task = taskMap.get(item.taskId);
            const isDragging = draggedIdx === index;
            const isOver = dragOverIdx === index && !isDragging;
            const recSens = task
              ? getRecommendedSens(task.category, task.subcategory)
              : null;

            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-move ${
                  isDragging
                    ? "opacity-30 border-dashed border-blue-500 bg-surface-subtle"
                    : isOver
                    ? "border-blue-500 bg-blue-500/10 shadow-sm"
                    : "bg-surface border-edge hover:border-white/20"
                }`}
              >
                {/* Drag handle & Scenario info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="text-text-faint hover:text-text-main cursor-grab shrink-0 p-1">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="9" cy="5" r="1" />
                      <circle cx="9" cy="12" r="1" />
                      <circle cx="9" cy="19" r="1" />
                      <circle cx="15" cy="5" r="1" />
                      <circle cx="15" cy="12" r="1" />
                      <circle cx="15" cy="19" r="1" />
                    </svg>
                  </div>

                  <span className="w-5 h-5 rounded-full bg-surface-subtle border border-edge text-[10px] font-mono flex items-center justify-center text-text-faint shrink-0">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-text-main truncate">
                      {task ? task.name : `Task #${item.taskId}`}
                    </div>
                    {task && (
                      <div className="flex items-center gap-1.5 text-[10px] text-text-faint mt-0.5">
                        <span>{task.category}</span>
                        <span>·</span>
                        <span>{task.subcategory}</span>
                        {recSens && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{recSens}cm</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Target configuration */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {/* Mode toggle */}
                  <div className="flex items-center bg-surface-subtle p-0.5 rounded-lg border border-edge">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateItem(index, {
                          targetMode: "reps",
                          targetValue: item.targetMode === "reps" ? item.targetValue : 5,
                        })
                      }
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        item.targetMode === "reps"
                          ? "bg-blue-500 text-white shadow-xs"
                          : "text-text-secondary hover:text-text-main"
                      }`}
                    >
                      {t("playlist.repsUnit")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateItem(index, {
                          targetMode: "time",
                          targetValue: item.targetMode === "time" ? item.targetValue : 120,
                        })
                      }
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        item.targetMode === "time"
                          ? "bg-blue-500 text-white shadow-xs"
                          : "text-text-secondary hover:text-text-main"
                      }`}
                    >
                      {t("playlist.timeUnit")}
                    </button>
                  </div>

                  {/* Value input */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={item.targetMode === "reps" ? 200 : 3600}
                      step={item.targetMode === "reps" ? 1 : 10}
                      value={item.targetValue}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        handleUpdateItem(index, { targetValue: val });
                      }}
                      className="minimal-input text-xs py-1 px-2 w-16 text-center tabular-nums font-semibold"
                    />
                    <span className="text-[10px] text-text-faint font-medium">
                      {item.targetMode === "reps"
                        ? t("playlist.repsUnit")
                        : t("playlist.timeUnit")}
                    </span>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    title={t("playlist.removeItem")}
                    className="p-1 rounded-full text-text-faint hover:text-red hover:bg-red-500/10 transition-colors ml-1"
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
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add more scenarios dropdown */}
      <div className="pt-2 border-t border-edge flex items-center gap-2">
        <select
          value={selectedTaskToAdd}
          onChange={(e) => setSelectedTaskToAdd(e.target.value)}
          className="minimal-input text-xs py-1.5 flex-1 cursor-pointer font-medium"
        >
          <option value="">{t("playlist.addScenarios")}...</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name} ({task.category})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => handleAddItem(selectedTaskToAdd)}
          disabled={!selectedTaskToAdd}
          className="minimal-btn-secondary px-3 py-1.5 text-xs font-medium border-edge rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + {t("playlist.addScenarios")}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
        <button
          type="button"
          onClick={onCancel}
          className="minimal-btn-secondary px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-main border-edge rounded-xl"
        >
          {t("playlist.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className="minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("playlist.save")}
        </button>
      </div>
    </div>
  );
}
