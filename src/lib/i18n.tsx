import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "pt" | "en";

const STORAGE_KEY = "att-lang";

const dict = {
  pt: {
    "app.footer": "Aim Threshold Tracker · com base em Viscose & Escalate por uno neon",
    "app.footerFov": "FOV 103 Standardized",
    "toast.copiedEscalate": "Histórico copiado no formato do Escalate!",
    "toast.noData": "Sem dados para copiar!",
    "toast.noKovaaK": "Nenhuma instalação do KovaaK's encontrada.",
    "toast.pathDetected": "Pasta detectada: {path}",
    "toast.pathUpdated": "Pasta do KovaaK's atualizada!",
    "toast.demoLoaded": "Dados de exemplo carregados",
    "toast.dataCleared": "Dados de exemplo removidos",
    "toast.exported": "Backup exportado com sucesso",
    "toast.imported": "Dados importados com sucesso",
    "toast.taskCreated": "Task \"{name}\" criada",
    "toast.taskRemoved": "Task removida",
    "toast.selectTask": "Selecione uma task primeiro",
    "toast.sessionsAdded": "{n} run(s) adicionada(s)",
    "toast.sessionDeleted": "Registro excluído",
    "toast.importedFirstRun": "Importados {n} runs de {total} arquivos",
    "toast.newRun": "Nova Run: {score} pts · Thresh: {threshold}",
    "toast.watcherError": "Erro no watcher: {error}",
    "toast.importSummary": "Importação: +{n} novos, {skipped} ignorados",
    "header.watcherActive": "Live Watcher",
    "header.watcherInactive": "Watcher Inativo",
    "header.theme": "Alternar Tema",
    "header.settings": "Configurações",
    "header.export": "Exportar",
    "header.import": "Importar",
    "header.demo": "Demo",
    "header.clear": "Limpar",
    "header.clearTitle": "Remover dados de exemplo",
    "header.language": "Idioma / Language",
    "header.guide": "Guia de Treino",
    "task.active": "Cenário Ativo",
    "task.new": "+ Novo",
    "task.none": "Nenhum cenário cadastrado",
    "task.sens": "Sens:",
    "task.count": "{n} cadastrada(s)",
    "task.delete": "Excluir Cenário",
    "session.title": "Registro Manual",
    "session.goal": "Meta Estabelecida",
    "session.first": "1º Registro",
    "session.goalText":
      "Tente atingir ou superar essa pontuação hoje.",
    "session.autoText":
      "Runs do KovaaK's também são detectadas automaticamente.",
    "session.date": "Data",
    "session.sens": "Sens (cm/360)",
    "session.scores": "Pontuações das Runs",
    "session.separator": "Separe valores com espaço ou vírgula",
    "session.newThreshold": "NOVO THRESHOLD ESTIMADO",
    "session.save": "Salvar Sessão",
    "session.detailNoTask": "Nenhuma task selecionada.",
    "session.detailFirst":
      "Primeira sessão: {n} run(s). Threshold inicial: {t} pts.",
    "session.detailTypeScores": "Digite suas pontuações para ver a análise.",
    "session.detailGoal": "Objetivo para hoje: {t} pts.",
    "session.detailEvolved": "Evolução! Threshold elevado para {t} pts.",
    "session.detailMaintained": "Threshold mantido em {t} pts.",
    "metric.pb": "Recorde Pessoal (PB)",
    "metric.pts": "pts",
    "metric.threshold": "Threshold Meta",
    "metric.target": "alvo",
    "metric.consistency": "Consistência",
    "metric.sens": "Sensibilidade",
    "chart.title": "Progressão Linear & Médias",
    "chart.subtitle": "Histórico temporal de desempenho",
    "chart.empty": "Nenhum dado para exibir no momento.",
    "chart.moving": "Média Móvel (3)",
    "chart.overall": "Média Geral",
    "chart.score": "Score",
    "chart.threshold": "Threshold",
    "chart.avgMoving": "Média (3)",
    "chart.avgOverall": "Média Total",
    "hist.title": "Histórico de Sessões",
    "hist.count": "{n} registro(s) arquivado(s)",
    "hist.copy": "Copiar Escalate",
    "hist.colDate": "DATA",
    "hist.colSens": "SENS",
    "hist.colScore": "SCORE",
    "hist.colThreshold": "THRESHOLD",
    "hist.colAction": "AÇÃO",
    "hist.empty": "Nenhuma sessão registrada para este cenário.",
    "hist.delete": "Excluir Registro",
    "modal.title": "Adicionar Novo Cenário",
    "modal.name": "Nome do Cenário",
    "modal.namePh": "Ex: 1w2ts Pasu Perfected",
    "modal.category": "Categoria Viscose",
    "modal.subcategory": "Subcategoria",
    "modal.cancel": "Cancelar",
    "modal.create": "Criar Cenário",
    "settings.title": "Configuração KovaaK's Watcher",
    "settings.dir": "Diretório de Estatísticas (Stats)",
    "settings.active": "Status: Ativo",
    "settings.inactive": "Status: Desativado",
    "settings.none": "Nenhum diretório configurado",
    "settings.manual": "Definir Caminho Manualmente",
    "settings.save": "Salvar",
    "settings.detect": "Detectar Automaticamente",
    "settings.pick": "Selecionar Pasta...",
    "settings.stop": "Parar Watcher",
    "settings.start": "Iniciar Watcher",
    "settings.reimport": "Reimportar CSVs",
    "settings.guide": "Guia",
  },
  en: {
    "app.footer": "Aim Threshold Tracker · com base em Viscose & Escalate por uno neon",
    "app.footerFov": "FOV 103 Standardized",
    "toast.copiedEscalate": "History copied in Escalate format!",
    "toast.noData": "No data to copy!",
    "toast.noKovaaK": "No KovaaK's installation found.",
    "toast.pathDetected": "Folder detected: {path}",
    "toast.pathUpdated": "KovaaK's folder updated!",
    "toast.demoLoaded": "Sample data loaded",
    "toast.dataCleared": "Sample data removed",
    "toast.exported": "Backup exported successfully",
    "toast.imported": "Data imported successfully",
    "toast.taskCreated": "Task \"{name}\" created",
    "toast.taskRemoved": "Task removed",
    "toast.selectTask": "Select a task first",
    "toast.sessionsAdded": "{n} run(s) added",
    "toast.sessionDeleted": "Record deleted",
    "toast.importedFirstRun": "Imported {n} runs from {total} files",
    "toast.newRun": "New Run: {score} pts · Thresh: {threshold}",
    "toast.watcherError": "Watcher error: {error}",
    "toast.importSummary": "Import: +{n} new, {skipped} skipped",
    "header.watcherActive": "Live Watcher",
    "header.watcherInactive": "Watcher Inactive",
    "header.theme": "Toggle Theme",
    "header.settings": "Settings",
    "header.export": "Export",
    "header.import": "Import",
    "header.demo": "Demo",
    "header.clear": "Clear",
    "header.clearTitle": "Remove sample data",
    "header.language": "Language / Idioma",
    "header.guide": "Aim Guide",
    "task.active": "Active Scenario",
    "task.new": "+ New",
    "task.none": "No scenario registered",
    "task.sens": "Sens:",
    "task.count": "{n} registered",
    "task.delete": "Delete Scenario",
    "session.title": "Manual Log",
    "session.goal": "Established Goal",
    "session.first": "1st Record",
    "session.goalText": "Try to reach or beat this score today.",
    "session.autoText": "KovaaK's runs are also detected automatically.",
    "session.date": "Date",
    "session.sens": "Sens (cm/360)",
    "session.scores": "Run Scores",
    "session.separator": "Separate values with space or comma",
    "session.newThreshold": "NEW ESTIMATED THRESHOLD",
    "session.save": "Save Session",
    "session.detailNoTask": "No task selected.",
    "session.detailFirst": "First session: {n} run(s). Initial threshold: {t} pts.",
    "session.detailTypeScores": "Type your scores to see the analysis.",
    "session.detailGoal": "Goal for today: {t} pts.",
    "session.detailEvolved": "Progress! Threshold raised to {t} pts.",
    "session.detailMaintained": "Threshold kept at {t} pts.",
    "metric.pb": "Personal Best (PB)",
    "metric.pts": "pts",
    "metric.threshold": "Threshold Target",
    "metric.target": "target",
    "metric.consistency": "Consistency",
    "metric.sens": "Sensitivity",
    "chart.title": "Linear Progression & Averages",
    "chart.subtitle": "Performance timeline",
    "chart.empty": "No data to display right now.",
    "chart.moving": "Moving Average (3)",
    "chart.overall": "Overall Average",
    "chart.score": "Score",
    "chart.threshold": "Threshold",
    "chart.avgMoving": "Average (3)",
    "chart.avgOverall": "Total Average",
    "hist.title": "Session History",
    "hist.count": "{n} record(s) archived",
    "hist.copy": "Copy Escalate",
    "hist.colDate": "DATE",
    "hist.colSens": "SENS",
    "hist.colScore": "SCORE",
    "hist.colThreshold": "THRESHOLD",
    "hist.colAction": "ACTION",
    "hist.empty": "No session recorded for this scenario.",
    "hist.delete": "Delete Record",
    "modal.title": "Add New Scenario",
    "modal.name": "Scenario Name",
    "modal.namePh": "e.g. 1w2ts Pasu Perfected",
    "modal.category": "Viscose Category",
    "modal.subcategory": "Subcategory",
    "modal.cancel": "Cancel",
    "modal.create": "Create Scenario",
    "settings.title": "KovaaK's Watcher Settings",
    "settings.dir": "Stats Directory",
    "settings.active": "Status: Active",
    "settings.inactive": "Status: Disabled",
    "settings.none": "No directory configured",
    "settings.manual": "Set Path Manually",
    "settings.save": "Save",
    "settings.detect": "Detect Automatically",
    "settings.pick": "Select Folder...",
    "settings.stop": "Stop Watcher",
    "settings.start": "Start Watcher",
    "settings.reimport": "Reimport CSVs",
    "settings.guide": "Guide",
  },
} as const;

type Key = keyof typeof dict.pt;
type Params = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Key, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "pt";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: Key, params?: Params) => format(dict[lang][key], params),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}