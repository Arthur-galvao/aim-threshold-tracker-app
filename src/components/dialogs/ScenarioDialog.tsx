import { useState, useEffect, type FormEvent } from "react";
import { Plus, Target, X } from "@phosphor-icons/react";
import { Dialog as BaseDialog } from "@base-ui/react";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";

export interface ScenarioDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onCreate?: (name: string, category: string, subcategory: string) => void | Promise<void>;
}

export function ScenarioDialog({
  open,
  onOpenChange,
  onClose,
  onCreate,
}: ScenarioDialogProps) {
  const { actions } = useTrackerWorkspace();
  const { createTask } = actions;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Click Timing");
  const [subcategory, setSubcategory] = useState("Precision");

  const categories = Object.keys(VISCOSE_CATEGORIES);

  useEffect(() => {
    const subs = VISCOSE_CATEGORIES[category] ?? ["General"];
    setSubcategory(subs[0]);
  }, [category]);

  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (onCreate) {
      await onCreate(name.trim(), category, subcategory);
    } else {
      await createTask(name.trim(), category, subcategory);
    }
    setName("");
    handleClose();
  };

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else if (onOpenChange) onOpenChange(true);
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md transition-opacity duration-200 animate-fade-in" />
        <BaseDialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none focus:outline-none">
          <div className="pointer-events-auto relative w-full max-w-md glass-floating p-6 rounded-2xl flex flex-col animate-pop-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-glass-edge">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-score-soft text-score border border-score/30 flex items-center justify-center shadow-xs">
                  <Target size={16} weight="bold" />
                </div>
                <h3 className="text-sm font-semibold text-text-main font-sans">
                  Novo Cenário
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-lg glass-card-interactive press flex items-center justify-center text-text-faint hover:text-text-main transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5 px-0.5">
                  Nome do Cenário (KovaaK&apos;s)
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Ex: 1wall6targets small, Pasu, VT..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5 px-0.5">
                    Categoria Viscose
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="glass-input text-xs font-mono"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c} className="bg-surface text-text-main">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5 px-0.5">
                    Subcategoria
                  </label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="glass-input text-xs font-mono"
                  >
                    {(VISCOSE_CATEGORIES[category] ?? ["General"]).map((sub) => (
                      <option key={sub} value={sub} className="bg-surface text-text-main">
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-glass-edge">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main glass-card-interactive press cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="px-4 py-2 rounded-xl bg-score text-primary-foreground font-semibold text-xs flex items-center gap-1.5 press hover:brightness-105 disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  <Plus size={14} weight="bold" />
                  <span>Cadastrar Cenário</span>
                </button>
              </div>
            </form>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
