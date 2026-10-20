import { useState, type ChangeEvent } from "react";
import { DownloadSimple, Database, UploadSimple, WarningCircle, CheckCircle } from "@phosphor-icons/react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  Button,
} from "@/components/ui";
import { syncAimlabSqlite, importAimlabCsv } from "@/lib/tauri-bridge";
import { useI18n } from "@/lib/i18n";

export interface AimLabSyncDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (stats: { total: number; new: number; skipped: number }) => void;
}

export function AimLabSyncDialog({
  open,
  onClose,
  onImportComplete,
}: AimLabSyncDialogProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAutoSync = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      const stats = await syncAimlabSqlite();
      setSuccessMsg(
        t("aimlab.success", {
          total: stats.total,
          new: stats.new,
          skipped: stats.skipped,
        })
      );
      if (onImportComplete) {
        onImportComplete(stats);
      }
    } catch (err: unknown) {
      setError(String(err) || "Erro ao sincronizar banco do Aim Lab");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const filePath = (file as unknown as { path?: string }).path;
    if (!filePath) {
      setError("Não foi possível obter o caminho absoluto do arquivo no sistema.");
      e.target.value = "";
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      const stats = await importAimlabCsv(filePath);
      setSuccessMsg(
        t("aimlab.success", {
          total: stats.total,
          new: stats.new,
          skipped: stats.skipped,
        })
      );
      if (onImportComplete) {
        onImportComplete(stats);
      }
    } catch (err: unknown) {
      setError(String(err) || "Erro ao importar arquivo CSV do Aim Lab");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="dialog" className="max-w-lg">
          {/* Header */}
          <div className="flex items-center gap-2.5 pb-3.5 mb-4 border-b border-edge">
            <div className="w-8 h-8 rounded-control bg-score-soft text-score border border-edge flex items-center justify-center shadow-1">
              <Database size={16} weight="bold" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-text-main font-sans">
                {t("aimlab.title")}
              </DialogTitle>
              <p className="text-[11px] text-text-faint">
                {t("aimlab.subtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-soft border border-red-edge rounded-control text-xs text-red font-mono flex items-start gap-2">
                <WarningCircle size={15} weight="bold" className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-soft border border-emerald-edge rounded-control text-xs text-emerald font-mono flex items-start gap-2">
                <CheckCircle size={15} weight="fill" className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Auto-Sync card */}
            <div className="glass-inset p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-score" weight="bold" />
                <span className="text-xs font-semibold text-text-main">
                  {t("aimlab.autoTitle")}
                </span>
              </div>
              <p className="text-[11px] text-text-faint leading-relaxed">
                {t("aimlab.autoDesc")}
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={loading}
                onClick={handleAutoSync}
                className="w-full"
                icon={<DownloadSimple size={14} weight="bold" />}
              >
                {loading ? t("aimlab.autoSyncing") : t("aimlab.autoBtn")}
              </Button>
            </div>

            {/* CSV manual upload card */}
            <div className="glass-inset p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <UploadSimple size={15} className="text-score" weight="bold" />
                <span className="text-xs font-semibold text-text-main">
                  {t("aimlab.csvTitle")}
                </span>
              </div>
              <p className="text-[11px] text-text-faint leading-relaxed">
                {t("aimlab.csvDesc")}
              </p>

              <label
                className={`glass-control w-full h-8 px-2.5 text-xs rounded-control gap-1.5 text-text-main inline-flex items-center justify-center font-medium select-none transition cursor-pointer press ${
                  loading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <UploadSimple size={14} weight="bold" />
                <span>{loading ? t("aimlab.csvReading") : t("aimlab.csvBtn")}</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvChange}
                />
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-edge">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClose}
              >
                {t("modal.cancel")}
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export default AimLabSyncDialog;
