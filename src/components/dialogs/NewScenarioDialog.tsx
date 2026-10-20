import { useState, useEffect, type FormEvent } from "react";
import { Plus, Target } from "@phosphor-icons/react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  Field,
  Input,
  Select,
  Button,
} from "@/components/ui";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";

export interface NewScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate?: (name: string, category: string, subcategory: string) => Promise<void> | void;
}

const CATEGORY_KEYS = Object.keys(VISCOSE_CATEGORIES);

export function NewScenarioDialog({
  open,
  onOpenChange,
  onCreate,
}: NewScenarioDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Click Timing");
  const [subcategory, setSubcategory] = useState("Precision");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const subs = VISCOSE_CATEGORIES[category] ?? ["General"];
    setSubcategory(subs[0] ?? "General");
  }, [category]);

  const handleClose = () => {
    setName("");
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      if (onCreate) {
        await onCreate(trimmed, category, subcategory);
      }
      setName("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="dialog" className="max-w-md">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-edge">
            <div className="w-8 h-8 rounded-control bg-score-soft text-score border border-edge flex items-center justify-center shrink-0 shadow-1">
              <Target size={16} weight="bold" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-text-main font-sans">
                {t("modal.title")}
              </DialogTitle>
              <p className="text-[11px] text-text-faint">
                {t("session.autoText")}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t("modal.name")} required>
              <Input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("modal.namePh")}
                className="font-mono text-xs"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("modal.category")} required>
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="font-mono text-xs"
                >
                  {CATEGORY_KEYS.map((cat) => (
                    <option key={cat} value={cat} className="bg-surface text-text-main">
                      {cat}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t("modal.subcategory")} required>
                <Select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="font-mono text-xs"
                >
                  {(VISCOSE_CATEGORIES[category] ?? ["General"]).map((sub) => (
                    <option key={sub} value={sub} className="bg-surface text-text-main">
                      {sub}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClose}
              >
                {t("modal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={submitting}
                disabled={!name.trim()}
                icon={<Plus size={14} weight="bold" />}
              >
                {t("modal.create")}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export default NewScenarioDialog;
