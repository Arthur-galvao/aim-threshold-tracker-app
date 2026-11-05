import { useEffect, useState } from "react";
import { Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, Button, Input, Field } from "@/components/ui";
import type { Task } from "@/lib/types";
import { updateTaskMeta } from "@/lib/tauri-bridge";
import { MAX_INTENT_CUE_CHARS, normalizeIntentCue } from "@/lib/playlist-step";
import { useI18n } from "@/lib/i18n";

export interface IntentCueEditorProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  /** Cue padrão (mechanicKey da Viscose traduzido), mostrado quando não há cue salvo. */
  defaultCue: string;
}

/** Edita o cue de intenção de um cenário (Plano 07, T7.7). Vazio salva e volta ao padrão. */
export function IntentCueEditor({ open, onClose, task, defaultCue }: IntentCueEditorProps) {
  const { t } = useI18n();
  // Chaves novas vivem em docs/plans/i18n-pending/T7-playlist.json até a integração (o tipo Key ainda não as conhece).
  const [value, setValue] = useState(task.intentCue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(task.intentCue ?? "");
      setError(null);
    }
  }, [open, task.id, task.intentCue]);

  const save = async (raw: string) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateTaskMeta(task.id, { intentCue: normalizeIntentCue(raw) });
      onClose();
    } catch (err) {
      console.error("Erro ao salvar cue de intenção:", err);
      setError(t("intent.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="dialog" className="max-w-md p-0 flex flex-col overflow-hidden">
          <div className="p-6 pb-4 border-b border-edge">
            <DialogTitle className="text-sm font-semibold text-text-main font-sans">
              {t("intent.editorTitle")}
            </DialogTitle>
            <p className="text-[11px] text-text-faint mt-1">
              {task.name} · {t("intent.editorDesc")}
            </p>
          </div>

          <div className="p-6 space-y-3">
            <Field label={t("intent.label")}>
              <Input
                type="text"
                value={value}
                maxLength={MAX_INTENT_CUE_CHARS}
                placeholder={defaultCue}
                onChange={(e) => setValue(e.target.value)}
                className="text-xs"
                autoFocus
              />
            </Field>
            <div className="flex items-center justify-between gap-2 text-[11px] text-text-faint">
              <span>{t("intent.defaultHint", { cue: defaultCue })}</span>
              <span className="font-mono tabular-nums shrink-0">
                {t("intent.counter", { count: Array.from(value).length, max: MAX_INTENT_CUE_CHARS })}
              </span>
            </div>
            {error && <p className="text-xs text-red">{error}</p>}
          </div>

          <div className="flex items-center justify-between gap-2 p-4 border-t border-edge">
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void save("")}>
              {t("intent.reset")}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
                {t("intent.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={saving}
                onClick={() => void save(value)}
              >
                {t("intent.save")}
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export default IntentCueEditor;
