export type ForecastVariable = "volume" | "revenue";

export type ForecastMethod = "cagr" | "trend" | "manual";

export interface UploadIssue {
  level: "warning" | "error";
  message: string;
  context?: string;
}

export interface UploadSummary {
  filename: string;
  processedAt: string;
  strict: boolean;
  insertedRows: number;
  updatedRows: number;
  errors?: string[];
}

export interface DeleteSummary {
  deletedRows: number;
  processedAt: string;
}

export interface YearAggregate {
  year: number;
  volume: number;
  revenue: number;
}

export interface SummarySnapshot {
  totals: YearAggregate[];
  baseline: YearAggregate[];
  combinations: number;
}

export interface RecordsMeta {
  total_records: number;
}

export interface FilterOptions {
  anos: number[];
  diretores: string[];
  ufs: string[];
  tipos_produto: string[];
  familias: string[];
  familias_producao: string[];
  marcas: string[];
  situacoes: string[];
  codigos: string[];
  produtos: string[];
}

export interface TypeProductBaseline {
  tipo_produto: string;
  historico: YearAggregate[];
  baseline: YearAggregate[];
}

export interface AggregateRow {
  key: Record<string, string | number>;
  values: YearAggregate[];
}

export interface AggregateResponse {
  group_by: string[];
  metric: "volume" | "revenue";
  rows: AggregateRow[];
}

export interface ForecastRow {
  key: Record<string, string | number>;
  historico: YearAggregate[];
  baseline: YearAggregate[];
}

export interface ForecastResponse {
  group_by: string[];
  rows: ForecastRow[];
}

export interface ScenarioSeriesData {
  id: string;
  label: string;
  description: string;
  totals: YearAggregate[];
}

export interface PreprocessSnapshot {
  filters: Record<string, string | null>;
  total_records: number;
  scenarios: ScenarioSeriesData[];
}

export interface CombinationSnapshot {
  id: number;
  diretor: string;
  sigla_uf: string;
  tipo_produto: string;
  familia: string;
  familia_producao: string;
  marca: string;
  cod_produto: string;
  produto: string;
  registros: number;
  first_year: number;
  last_year: number;
  volume_total: number;
  receita_total: number;
}

export type NotificationStatus = "running" | "completed" | "failed";

export interface NotificationItem {
  id: string;
  category: string;
  title: string;
  message: string;
  status: NotificationStatus;
  progress?: number | null;
  processed_rows?: number | null;
  total_rows?: number | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface ScenarioFilterPayload {
  diretor?: string;
  sigla_uf?: string;
  tipo_produto?: string;
  familia?: string;
  familia_producao?: string;
  marca?: string;
  situacao_lista?: string;
  cod_produto?: string;
  produto?: string;
}

export interface CombinationFilterPayload extends ScenarioFilterPayload {
  ano?: number;
  limit?: number;
}

export interface ManualGrowthRule {
  scope: "tipoProduto" | "familia";
  key: string;
  growth: number;
}

export interface PlanningRecord {
  id: number;
  ano: number;
  diretor: string;
  sigla_uf: string;
  tipo_produto: string;
  familia: string;
  familia_producao: string;
  marca: string;
  situacao_lista: string;
  cod_produto: string;
  produto: string;
  fat_liq_kg: number;
  fat_liq_reais: number;
}

export interface PlanningTableRow {
  id: string;
  parentId?: string;
  depth: number;
  level: HierarchyLevel;
  name: string;
  volumeBase: number;
  volumePlan: number;
  revenueBase: number;
  revenuePlan: number;
  pricePlan: number;
  contributionPlan: number;
  childrenIds: string[];
}

export interface YearOverride {
  volumePct?: number;
  revenuePct?: number;
}

export type RowOverride = Record<number, YearOverride>;

export interface ForecastSettings {
  variable: ForecastVariable;
  method: ForecastMethod;
  smoothingYears: number;
  manualRules: ManualGrowthRule[];
}

export type PriceMode = "fixed" | "annualGrowth";

export interface PriceSettings {
  mode: PriceMode;
  annualGrowthPct: number;
  basePriceYear: number;
}

export interface MetricSnapshot {
  year: number;
  volume: number;
  revenue: number;
}

export type HierarchyLevel =
  | "diretor"
  | "uf"
  | "tipoProduto"
  | "familia"
  | "marca"
  | "sku";

export interface HierarchyNode {
  id: string;
  level: HierarchyLevel;
  name: string;
  volume: number;
  revenue: number;
  trend: number;
  children?: HierarchyNode[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  lastSaved: string;
  isPrimary?: boolean;
}

export interface ForecastState {
  activeTab: string;
  uploadSummary: UploadSummary | null;
  forecastSettings: ForecastSettings;
  priceSettings: PriceSettings;
  hierarchy: HierarchyNode[];
  selectedNode?: HierarchyNode;
  scenarios: Scenario[];
  planningTableRows: PlanningTableRow[];
  rowOverrides: Record<string, RowOverride>;
  priceOverrides: Record<string, Record<number, number>>;
  records: PlanningRecord[];
  recordsMeta?: RecordsMeta;
  notifications: NotificationItem[];
  activeUploadFilename: string | null;
  loadingUpload: boolean;
  loadingDelete: boolean;
  deleteSummary: DeleteSummary | null;
  summary?: SummarySnapshot;
  filters?: FilterOptions;
  typeProductBaselines?: TypeProductBaseline[];
  aggregateData?: AggregateResponse;
  forecastDetail?: ForecastResponse;
  preprocessSnapshot?: PreprocessSnapshot;
  combinationsSnapshot?: CombinationSnapshot[];
  loadingPreprocess: boolean;
  setActiveTab: (tab: string) => void;
  updateForecastSettings: (partial: Partial<ForecastSettings>) => void;
  updatePriceSettings: (partial: Partial<PriceSettings>) => void;
  setSelectedNode: (node?: HierarchyNode) => void;
  setManualRule: (rule: ManualGrowthRule) => void;
  removeManualRule: (key: string, scope: ManualGrowthRule["scope"]) => void;
  setRowOverride: (id: string, year: number, override: YearOverride) => void;
  resetRowOverride: (id: string, year?: number) => void;
  uploadDataset: (payload: { file: File; strict: boolean }) => Promise<void>;
  fetchRecords: (filters?: number | Record<string, unknown>) => Promise<void>;
  wipeDataset: (confirmation: string) => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchFilters: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchRecordsMeta: () => Promise<void>;
  fetchTypeProductBaseline: () => Promise<void>;
  fetchPreprocessSnapshot: (filters?: ScenarioFilterPayload) => Promise<void>;
  fetchCombinationsSnapshot: (filters?: CombinationFilterPayload) => Promise<void>;
  setPriceOverride: (type: string, year: number, value?: number) => void;
  resetPriceOverride: (type: string) => void;
  fetchAggregate: (metric: "volume" | "revenue", groupBy: string[]) => Promise<void>;
  fetchForecastDetail: (groupBy: string[]) => Promise<void>;
}
