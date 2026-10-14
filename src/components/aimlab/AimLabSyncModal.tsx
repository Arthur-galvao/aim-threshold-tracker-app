import { useState } from "react";
import { DownloadSimple, Database, UploadSimple } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { syncAimlabSqlite, importAimlabCsv } from "@/lib/tauri-bridge";

interface AimLabSyncModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (stats: { total: number; new: number; skipped: number }) => void;
}

export function AimLabSyncModal({ open, onClose, onImportComplete }: AimLabSyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAutoSync = async () => {
    try {
      setLoading(true);
      setError(null);
      const stats = await syncAimlabSqlite();
      onImportComplete(stats);
      onClose();
    } catch (err: any) {
      setError(err?.toString() || "Erro desconhecido ao tentar sincronizar banco do Aim Lab");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Aim Lab Integration"
      maxWidth="md"
      className="glass-floating"
    >
      <div className="space-y-5">
        <p className="text-xs text-text-secondary leading-relaxed">
          Sincronize seu histórico de treino do Aim Lab. Você pode buscar o banco de dados local automaticamente ou fazer o upload do arquivo CSV exportado pelo jogo.
        </p>

        {error && (
          <div className="p-3 bg-red-soft border border-red-edge rounded-xl text-xs text-red font-mono">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="p-4 sm:p-5 border border-edge bg-surface-subtle/60 rounded-2xl enter space-y-3" style={{ "--i": 0 } as React.CSSProperties}>
            <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
              <Database size={15} className="text-score" />
              <span>Opção 2: Auto-Sync (Local SQLite)</span>
            </h4>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Busca o arquivo <code className="text-text-main font-mono bg-surface px-1.5 py-0.5 rounded border border-edge">Klutch.bytes</code> do Aim Lab e extrai todas as pontuações salvas localmente.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={handleAutoSync}
              disabled={loading}
              className="w-full press"
              icon={<DownloadSimple size={14} weight="bold" />}
            >
              {loading ? "Sincronizando..." : "Sincronizar LocalDB Agora"}
            </Button>
          </div>

          <div className="p-4 sm:p-5 border border-edge bg-surface-subtle/60 rounded-2xl enter space-y-3" style={{ "--i": 1 } as React.CSSProperties}>
            <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
              <UploadSimple size={15} className="text-score" />
              <span>Opção 1: Importar CSV Manual</span>
            </h4>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Faça o download do seu histórico pelo perfil do Aim Lab na nuvem e importe o arquivo CSV aqui para uma cópia completa dos seus dados.
            </p>
            
            <label className={`w-full press inline-flex items-center justify-center font-sans tracking-tight cursor-pointer select-none h-9 px-3.5 text-xs gap-2 rounded-xl font-medium bg-surface-subtle text-text-main border border-edge hover:bg-surface-hover hover:border-edge-strong transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <UploadSimple size={14} weight="bold" />
              <span>{loading ? "Processando..." : "Selecionar arquivo .csv"}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const filePath = (file as any).path;
                    if (filePath) {
                      try {
                        setLoading(true);
                        setError(null);
                        const stats = await importAimlabCsv(filePath);
                        onImportComplete(stats);
                        onClose();
                      } catch (err: any) {
                        setError(err?.toString() || "Erro ao ler o CSV.");
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      setError("Não foi possível obter o caminho do arquivo no sistema.");
                    }
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
