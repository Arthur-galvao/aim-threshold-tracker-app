import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "@phosphor-icons/react";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, category: string, subcategory: string) => void;
}

export function NewTaskModal({ open, onClose, onCreate }: NewTaskModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Flick Tech");
  const [subcategory, setSubcategory] = useState("Speed");
  const { t } = useI18n();

  useEffect(() => {
    const subs = VISCOSE_CATEGORIES[category] ?? ["Geral"];
    setSubcategory(subs[0]);
  }, [category]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), category, subcategory);
    setName("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("modal.title")}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="newTaskName"
            className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5"
          >
            {t("modal.name")}
          </label>
          <input
            type="text"
            id="newTaskName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("modal.namePh")}
            required
            className="minimal-input text-xs font-medium w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              {t("modal.category")}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="minimal-input text-xs cursor-pointer font-medium w-full"
            >
              {Object.keys(VISCOSE_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              {t("modal.subcategory")}
            </label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="minimal-input text-xs cursor-pointer font-medium w-full"
            >
              {(VISCOSE_CATEGORIES[category] ?? ["Geral"]).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-edge mt-6">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            {t("modal.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={<Plus size={14} weight="bold" />}
          >
            {t("modal.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
