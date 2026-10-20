import { useState, useMemo } from "react";
import { Plus, Sparkle } from "@phosphor-icons/react";
import { Button, Input, Select, Field } from "@/components/ui";
import type { Playlist, PlaylistItem, Task } from "@/lib/types";
import { PlaylistItemRow } from "./PlaylistItemRow";
import { useI18n } from "@/lib/i18n";

export interface PlaylistEditorProps {
  initialPlaylist?: Playlist | null;
  tasks: Task[];
  initialTaskIds?: string[];
  onSave: (playlist: Playlist) => Promise<void> | void;
  onCancel: () => void;
}

export function PlaylistEditor({
  initialPlaylist,
  tasks,
  initialTaskIds = [],
  onSave,
  onCancel,
}: PlaylistEditorProps) {
  const { t } = useI18n();
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const [name, setName] = useState(initialPlaylist?.name ?? "");
  const [items, setItems] = useState<PlaylistItem[]>(() => {
    if (initialPlaylist?.items && initialPlaylist.items.length > 0) {
      return [...initialPlaylist.items];
    }
    if (initialTaskIds.length > 0) {
      return initialTaskIds.map((taskId) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `item-${Math.random().toString(36).substring(2, 9)}`,
        taskId,
        targetMode: "reps",
        targetValue: 5,
      }));
    }
    return [];
  });
  const [selectedTaskToAdd, setSelectedTaskToAdd] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddItem = (taskId: string) => {
    if (!taskId) return;
    const newItem: PlaylistItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      taskId,
      targetMode: "reps",
      targetValue: 5,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedTaskToAdd("");
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleUpdateItem = (
    index: number,
    partial: Partial<Pick<PlaylistItem, "targetMode" | "targetValue">>
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...partial } : item))
    );
  };

  const handleAutoOrder = () => {
    const categoryWeights: Record<string, number> = {
      "Click Timing": 1,
      Tracking: 2,
      "Target Switching": 3,
    };

    setItems((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const taskA = taskMap.get(a.taskId);
        const taskB = taskMap.get(b.taskId);
        const weightA = taskA ? categoryWeights[taskA.category] ?? 4 : 5;
        const weightB = taskB ? categoryWeights[taskB.category] ?? 4 : 5;
        if (weightA !== weightB) return weightA - weightB;
        return (taskA?.name ?? "").localeCompare(taskB?.name ?? "");
      });
      return sorted;
    });
  };

  const handleSave = async () => {
    if (!name.trim() || items.length === 0 || saving) return;
    setSaving(true);
    try {
      const playlist: Playlist = {
        id: initialPlaylist?.id ?? (crypto.randomUUID ? crypto.randomUUID() : `pl-${Date.now()}`),
        name: name.trim(),
        items,
        createdAt: initialPlaylist?.createdAt ?? new Date().toISOString(),
      };
      await onSave(playlist);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Playlist Name & Auto Order */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end justify-between">
        <Field label={t("playlist.name")} required className="flex-1">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("playlist.namePh")}
            className="font-mono text-xs"
            autoFocus
          />
        </Field>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAutoOrder}
          disabled={items.length < 2}
          icon={<Sparkle size={13} weight="bold" />}
          title={t("playlist.orderSuggestTooltip")}
          className="shrink-0"
        >
          {t("playlist.orderSuggest")}
        </Button>
      </div>

      {/* Playlist Items List */}
      <div className="glass-inset p-3 space-y-2 max-h-64 overflow-y-auto scroll-y">
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-faint">
            {t("playlist.validationEmpty")}
          </div>
        ) : (
          items.map((item, index) => (
            <PlaylistItemRow
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              task={taskMap.get(item.taskId)}
              onMove={handleMove}
              onUpdate={handleUpdateItem}
              onRemove={handleRemoveItem}
            />
          ))
        )}
      </div>

      {/* Add scenario select */}
      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
        <Select
          value={selectedTaskToAdd}
          onChange={(e) => setSelectedTaskToAdd(e.target.value)}
          className="font-mono text-xs flex-1"
        >
          <option value="">{t("playlist.addScenarios")}...</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id} className="bg-surface text-text-main">
              {task.name} ({task.category})
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!selectedTaskToAdd}
          onClick={() => handleAddItem(selectedTaskToAdd)}
          icon={<Plus size={13} weight="bold" />}
          className="w-full sm:w-auto"
        >
          {t("playlist.addScenarios")}
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2.5 pt-3 border-t border-edge">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
        >
          {t("playlist.cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={saving}
          disabled={!name.trim() || items.length === 0}
          onClick={handleSave}
        >
          {t("playlist.save")}
        </Button>
      </div>
    </div>
  );
}

export default PlaylistEditor;
