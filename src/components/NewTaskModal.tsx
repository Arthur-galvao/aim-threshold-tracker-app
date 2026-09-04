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
    <div className="fixed inset-0 modal-scrim z-50 flex items-center justify-center p-4">
      <div className="panel p-6 max-w-md w-full shadow-2xl rounded-2xl transition-all duration-200">
        <div className="flex justify-between items-center border-b border-edge pb-3.5">
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("modal.title")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text-faint hover:text-text-main hover:bg-surface-subtle transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label
              htmlFor="newTaskName"
              className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5"
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
              className="minimal-input text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                {t("modal.category")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="minimal-input text-xs cursor-pointer font-medium"
              >
                {Object.keys(VISCOSE_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                {t("modal.subcategory")}
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="minimal-input text-xs cursor-pointer font-medium"
              >
                {(VISCOSE_CATEGORIES[category] ?? ["Geral"]).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 minimal-btn-secondary text-xs font-semibold rounded-full"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 minimal-btn text-xs font-bold uppercase tracking-wider rounded-full"
            >
              {t("modal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
