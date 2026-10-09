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
    >
      <div className="space-y-6">
        <p className="text-[11px] text-text-muted">
          Sincronize seu histórico de treino do Aim Lab. Você pode buscar o banco de dados local automaticamente ou fazer o upload do arquivo CSV exportado pelo jogo.
        </p>

        {error && (
          <div className="p-3 bg-red/10 border border-red/20 rounded text-[11px] text-red font-mono">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 border border-edge bg-surface-subtle/30 rounded-md">
            <h4 className="text-[11px] font-mono font-bold text-text-main mb-2 flex items-center gap-2">
              <Database size={14} /> Opção 2: Auto-Sync (Local SQLite)
            </h4>
            <p className="text-[11px] text-text-muted mb-4">
              Busca o arquivo <code className="text-text-main">Klutch.bytes</code> do Aim Lab e extrai todas as pontuações salvadas localmente. Pode não recuperar a sensibilidade de runs antigas.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={handleAutoSync}
              disabled={loading}
              className="w-full"
              icon={<DownloadSimple size={14} weight="bold" />}
            >
              {loading ? "Sincronizando..." : "Sincronizar LocalDB Agora"}
            </Button>
          </div>

          <div className="p-4 border border-edge bg-surface-subtle/30 rounded-md">
            <h4 className="text-[11px] font-mono font-bold text-text-main mb-2 flex items-center gap-2">
              <UploadSimple size={14} /> Opção 1: Importar CSV Manual
            </h4>
            <p className="text-[11px] text-text-muted mb-4">
              Faça o download do seu histórico pelo perfil do Aim Lab na nuvem e importe o arquivo CSV aqui para uma cópia completa dos seus dados.
            </p>
            
            <label className={`w-full inline-flex items-center justify-center font-sans tracking-tight cursor-pointer select-none h-8 px-3 text-[10px] font-mono tracking-widest uppercase gap-2 rounded-lg font-medium bg-surface-subtle text-text-main border border-edge hover:bg-surface-hover transition-all duration-150 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <UploadSimple size={14} weight="bold" />
              <span>{loading ? "Processando..." : "Selecionar arquivo .csv"}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Extract path using Tauri's extended File object
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
