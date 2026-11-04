import { useEffect, useState } from "react";
import { FolderOpen, Warning } from "@phosphor-icons/react";
import {
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
} from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { getLoadReport, revealInFolder } from "@/lib/tauri-bridge";
import type { LoadReport } from "@/lib/types";

/**
 * Avisa o usuário quando o arquivo de dados estava corrompido e foi recuperado
 * (de backup ou iniciado vazio). Mostra o aviso uma vez por inicialização.
 */
export function RecoveryNotice() {
  const { t } = useI18n();
  const [report, setReport] = useState<LoadReport | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLoadReport()
      .then((r) => {
        if (cancelled || !r || r.kind !== "recovered") return;
        setReport(r);
        setOpen(true);
      })
      .catch((err) => {
        console.error("Erro ao obter relatório de carregamento:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!report) return null;

  const quarantined = report.quarantined;
  const fromBackup = report.fromBackup;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="dialog" className="max-w-md">
          <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-edge">
            <div className="w-8 h-8 rounded-control bg-score-soft text-score border border-edge flex items-center justify-center shrink-0 shadow-1">
              <Warning size={16} weight="bold" />
            </div>
            <DialogTitle className="text-sm font-semibold text-text-main font-sans">
              {t("recovery.title")}
            </DialogTitle>
          </div>

          <div className="space-y-2 text-xs text-text-secondary">
            <p>{t("recovery.bodyCorrupt")}</p>
            <p>
              {fromBackup
                ? t("recovery.bodyRestored", { backup: fromBackup })
                : t("recovery.bodyEmpty")}
            </p>
            {quarantined && (
              <p>
                {t("recovery.preserved", { path: quarantined })}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-5">
            {quarantined && (
              <Button
                variant="secondary"
                icon={<FolderOpen size={14} />}
                onClick={() => void revealInFolder(quarantined)}
              >
                {t("recovery.openFolder")}
              </Button>
            )}
            <Button variant="primary" onClick={() => setOpen(false)}>
              {t("recovery.ok")}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
