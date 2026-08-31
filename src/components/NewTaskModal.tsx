import { useEffect, useState, type FormEvent } from "react";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";

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

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), category, subcategory);
    setName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-scrim backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="panel bg-surface p-6 max-w-md w-full shadow-2xl border-edge-strong transition-colors">
        <div className="flex justify-between items-center border-b border-edge pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-main">
            {t("modal.title")}
          </h3>
          <button
            onClick={onClose}
            className="text-text-faint hover:text-text-main text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label htmlFor="newTaskName" className="block text-[11px] font-medium uppercase tracking-wider text-text-faint mb-1.5">
              {t("modal.name")}
            </label>
            <input
              type="text"
              id="newTaskName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("modal.namePh")}
              required
              className="minimal-input font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-faint mb-1.5">
                {t("modal.category")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="minimal-input"
              >
                {Object.keys(VISCOSE_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-faint mb-1.5">
                {t("modal.subcategory")}
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="minimal-input"
              >
                {(VISCOSE_CATEGORIES[category] ?? ["Geral"]).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 minimal-btn-secondary text-xs"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 minimal-btn text-xs font-semibold"
            >
              {t("modal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
