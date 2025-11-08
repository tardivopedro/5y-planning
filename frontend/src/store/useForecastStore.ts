import { create } from "zustand";
import {
  ForecastSettings,
  ForecastState,
  HierarchyNode,
  ManualGrowthRule,
  PlanningTableRow,
  PriceSettings,
  RowOverride,
  ScenarioFilterPayload
} from "../types/forecast";
import {
  deleteAllRecords,
  fetchFilters as fetchFiltersApi,
  fetchRecords as fetchRecordsApi,
  RecordFilters,
  fetchSummary as fetchSummaryApi,
  fetchTypeProductBaseline,
  uploadDataset as uploadDatasetApi,
  fetchAggregate,
  fetchForecastDetail,
  fetchPreprocessSnapshot as fetchPreprocessSnapshotApi,
  fetchCombinationsSnapshot as fetchCombinationsSnapshotApi,
  fetchRecordsMeta as fetchRecordsMetaApi,
  fetchNotifications as fetchNotificationsApi,
  startLevelScoreRun as startLevelScoreRunApi,
  processLevelScoreChunk as processLevelScoreChunkApi,
  fetchLevelScoreStatus as fetchLevelScoreStatusApi,
  fetchLevelScoreResults as fetchLevelScoreResultsApi
} from "../services/uploadApi";

const sampleHierarchy: HierarchyNode[] = [
  {
    id: "diretor-norte",
    level: "diretor",
    name: "Diretor Norte",
    volume: 12400,
    revenue: 38_500_000,
    trend: 6.5,
    children: [
      {
        id: "uf-pa",
        level: "uf",
        name: "PA",
        volume: 6200,
        revenue: 19_750_000,
        trend: 7.1,
        children: [
          {
            id: "tipo-massas",
            level: "tipoProduto",
            name: "Massas",
            volume: 3800,
            revenue: 11_450_000,
            trend: 8.2,
            children: [
              {
                id: "familia-talharim",
                level: "familia",
                name: "Talharim",
                volume: 2100,
                revenue: 6_900_000,
                trend: 9.4,
                children: [
                  {
                    id: "marca-domus",
                    level: "marca",
                    name: "Domus",
                    volume: 1320,
                    revenue: 4_440_000,
                    trend: 10.8,
                    children: [
                      {
                        id: "sku-talharim-500",
                        level: "sku",
                        name: "Talharim 500g",
                        volume: 720,
                        revenue: 2_420_000,
                        trend: 11.2
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "diretor-sudeste",
    level: "diretor",
    name: "Diretor Sudeste",
    volume: 18600,
    revenue: 57_200_000,
    trend: 4.8,
    children: [
      {
        id: "uf-sp",
        level: "uf",
        name: "SP",
        volume: 11_400,
        revenue: 35_100_000,
        trend: 5.3
      },
      {
        id: "uf-rj",
        level: "uf",
        name: "RJ",
        volume: 5200,
        revenue: 15_600_000,
        trend: 4.9
      }
    ]
  }
];

const planningTableRows: PlanningTableRow[] = [
  {
    id: "diretor-norte",
    depth: 0,
    level: "diretor",
    name: "Diretor Norte",
    volumeBase: 30120,
    volumePlan: 32180,
    revenueBase: 90_360_000,
    revenuePlan: 96_540_000,
    pricePlan: 3.0,
    contributionPlan: 0.36,
    childrenIds: ["diretor-norte|pa", "diretor-norte|am"]
  },
  {
    id: "diretor-norte|pa",
    parentId: "diretor-norte",
    depth: 1,
    level: "uf",
    name: "PA",
    volumeBase: 19_200,
    volumePlan: 20_500,
    revenueBase: 57_600_000,
    revenuePlan: 61_500_000,
    pricePlan: 3.0,
    contributionPlan: 0.18,
    childrenIds: ["diretor-norte|pa|massas", "diretor-norte|pa|biscoitos"]
  },
  {
    id: "diretor-norte|pa|massas",
    parentId: "diretor-norte|pa",
    depth: 2,
    level: "tipoProduto",
    name: "Massas",
    volumeBase: 11_400,
    volumePlan: 12_200,
    revenueBase: 34_800_000,
    revenuePlan: 37_200_000,
    pricePlan: 3.05,
    contributionPlan: 0.11,
    childrenIds: ["diretor-norte|pa|massas|talharim"]
  },
  {
    id: "diretor-norte|pa|massas|talharim",
    parentId: "diretor-norte|pa|massas",
    depth: 3,
    level: "familia",
    name: "Talharim",
    volumeBase: 5_900,
    volumePlan: 6_480,
    revenueBase: 18_300_000,
    revenuePlan: 20_448_000,
    pricePlan: 3.16,
    contributionPlan: 0.06,
    childrenIds: []
  },
  {
    id: "diretor-norte|pa|biscoitos",
    parentId: "diretor-norte|pa",
    depth: 2,
    level: "familia",
    name: "Biscoitos Integrais",
    volumeBase: 5_200,
    volumePlan: 5_480,
    revenueBase: 15_600_000,
    revenuePlan: 17_100_000,
    pricePlan: 3.12,
    contributionPlan: 0.05,
    childrenIds: []
  },
  {
    id: "diretor-norte|am",
    parentId: "diretor-norte",
    depth: 1,
    level: "uf",
    name: "AM",
    volumeBase: 10_920,
    volumePlan: 11_680,
    revenueBase: 32_760_000,
    revenuePlan: 35_040_000,
    pricePlan: 3.0,
    contributionPlan: 0.12,
    childrenIds: ["diretor-norte|am|massas", "diretor-norte|am|farinhas"]
  },
  {
    id: "diretor-norte|am|massas",
    parentId: "diretor-norte|am",
    depth: 2,
    level: "tipoProduto",
    name: "Massas",
    volumeBase: 6_240,
    volumePlan: 6_720,
    revenueBase: 19_200_000,
    revenuePlan: 21_100_000,
    pricePlan: 3.14,
    contributionPlan: 0.07,
    childrenIds: []
  },
  {
    id: "diretor-norte|am|farinhas",
    parentId: "diretor-norte|am",
    depth: 2,
    level: "tipoProduto",
    name: "Farinhas",
    volumeBase: 3_150,
    volumePlan: 3_320,
    revenueBase: 9_450_000,
    revenuePlan: 10_190_000,
    pricePlan: 3.07,
    contributionPlan: 0.03,
    childrenIds: []
  },
  {
    id: "diretor-sudeste",
    depth: 0,
    level: "diretor",
    name: "Diretor Sudeste",
    volumeBase: 43_650,
    volumePlan: 46_200,
    revenueBase: 130_950_000,
    revenuePlan: 145_530_000,
    pricePlan: 3.15,
    contributionPlan: 0.44,
    childrenIds: ["diretor-sudeste|sp", "diretor-sudeste|rj"]
  },
  {
    id: "diretor-sudeste|sp",
    parentId: "diretor-sudeste",
    depth: 1,
    level: "uf",
    name: "SP",
    volumeBase: 27_100,
    volumePlan: 28_900,
    revenueBase: 81_300_000,
    revenuePlan: 91_035_000,
    pricePlan: 3.15,
    contributionPlan: 0.29,
    childrenIds: [
      "diretor-sudeste|sp|premium",
      "diretor-sudeste|sp|mainstream"
    ]
  },
  {
    id: "diretor-sudeste|sp|premium",
    parentId: "diretor-sudeste|sp",
    depth: 2,
    level: "tipoProduto",
    name: "Linha Premium",
    volumeBase: 9_800,
    volumePlan: 10_420,
    revenueBase: 33_320_000,
    revenuePlan: 36_470_000,
    pricePlan: 3.5,
    contributionPlan: 0.12,
    childrenIds: []
  },
  {
    id: "diretor-sudeste|sp|mainstream",
    parentId: "diretor-sudeste|sp",
    depth: 2,
    level: "tipoProduto",
    name: "Linha Mainstream",
    volumeBase: 14_600,
    volumePlan: 15_220,
    revenueBase: 43_800_000,
    revenuePlan: 46_430_000,
    pricePlan: 3.05,
    contributionPlan: 0.16,
    childrenIds: []
  },
  {
    id: "diretor-sudeste|rj",
    parentId: "diretor-sudeste",
    depth: 1,
    level: "uf",
    name: "RJ",
    volumeBase: 11_200,
    volumePlan: 11_900,
    revenueBase: 34_720_000,
    revenuePlan: 37_485_000,
    pricePlan: 3.15,
    contributionPlan: 0.11,
    childrenIds: [
      "diretor-sudeste|rj|farinhas",
      "diretor-sudeste|rj|biscoitos"
    ]
  },
  {
    id: "diretor-sudeste|rj|farinhas",
    parentId: "diretor-sudeste|rj",
    depth: 2,
    level: "tipoProduto",
    name: "Farinhas",
    volumeBase: 5_400,
    volumePlan: 5_780,
    revenueBase: 16_200_000,
    revenuePlan: 18_140_000,
    pricePlan: 3.14,
    contributionPlan: 0.05,
    childrenIds: []
  },
  {
    id: "diretor-sudeste|rj|biscoitos",
    parentId: "diretor-sudeste|rj",
    depth: 2,
    level: "tipoProduto",
    name: "Biscoitos",
    volumeBase: 3_900,
    volumePlan: 4_150,
    revenueBase: 11_700_000,
    revenuePlan: 13_090_000,
    pricePlan: 3.15,
    contributionPlan: 0.03,
    childrenIds: []
  }
];

const defaultForecastSettings: ForecastSettings = {
  variable: "volume",
  method: "cagr",
  smoothingYears: 3,
  manualRules: [
    {
      scope: "tipoProduto",
      key: "Massas",
      growth: 4.5
    }
  ]
};

const defaultPriceSettings: PriceSettings = {
  mode: "annualGrowth",
  annualGrowthPct: 3,
  basePriceYear: 2026
};

export const useForecastStore = create<ForecastState>((set, get) => ({
  activeTab: "upload",
  uploadSummary: null,
  forecastSettings: defaultForecastSettings,
  priceSettings: defaultPriceSettings,
  hierarchy: sampleHierarchy,
  planningTableRows,
  rowOverrides: {},
  priceOverrides: {},
  records: [],
  recordsMeta: undefined,
  notifications: [],
  activeUploadFilename: null,
  loadingUpload: false,
  loadingDelete: false,
  deleteSummary: null,
  summary: undefined,
  filters: undefined,
  typeProductBaselines: undefined,
  aggregateData: undefined,
  forecastDetail: undefined,
  preprocessSnapshot: undefined,
  combinationsSnapshot: undefined,
  loadingPreprocess: false,
  levelScoreRun: undefined,
  levelScoreResults: [],
  loadingLevelScore: false,
  scenarios: [
    {
      id: "base",
      name: "Base 2030",
      description: "Projeção automática com ajustes manuais validados.",
      lastSaved: "12/08/2024 18:10",
      isPrimary: true
    },
    {
      id: "otimista",
      name: "Otimista",
      description: "Crescimento +2pp em Massas e Marcas Premium.",
      lastSaved: "08/08/2024 09:44"
    },
    {
      id: "pessimista",
      name: "Pessimista",
      description: "Cenário com retração macro de 3%.",
      lastSaved: "04/08/2024 16:22"
    }
  ],
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateForecastSettings: (partial) =>
    set({
      forecastSettings: {
        ...get().forecastSettings,
        ...partial
      }
    }),
  updatePriceSettings: (partial) =>
    set({
      priceSettings: {
        ...get().priceSettings,
        ...partial
      }
    }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setManualRule: (rule: ManualGrowthRule) => {
    const current = get().forecastSettings.manualRules;
    const filtered = current.filter(
      (item) => !(item.scope === rule.scope && item.key === rule.key)
    );
    set({
      forecastSettings: {
        ...get().forecastSettings,
        manualRules: [...filtered, rule]
      }
    });
  },
  removeManualRule: (key, scope) => {
    const current = get().forecastSettings.manualRules;
    set({
      forecastSettings: {
        ...get().forecastSettings,
        manualRules: current.filter(
          (item) => !(item.key === key && item.scope === scope)
        )
      }
    });
  },
  setRowOverride: (id, year, override) =>
    set((state) => {
      const currentRow = state.rowOverrides[id] ?? {};
      const currentYear = currentRow[year] ?? {};
      const nextYear = { ...currentYear, ...override };

      if (override.volumePct === undefined) delete nextYear.volumePct;
      if (override.revenuePct === undefined) delete nextYear.revenuePct;

      const nextRow = { ...currentRow };
      if (Object.keys(nextYear).length === 0) {
        delete nextRow[year];
      } else {
        nextRow[year] = nextYear;
      }

      if (Object.keys(nextRow).length === 0) {
        const { [id]: _, ...rest } = state.rowOverrides;
        return { rowOverrides: rest };
      }

      return {
        rowOverrides: {
          ...state.rowOverrides,
          [id]: nextRow
        }
      };
    }),
  resetRowOverride: (id, year) =>
    set((state) => {
      const currentRow = state.rowOverrides[id];
      if (!currentRow) return {};
      if (year === undefined) {
        const { [id]: _, ...rest } = state.rowOverrides;
        return { rowOverrides: rest };
      }
      const nextRow = { ...currentRow };
      delete nextRow[year];
      if (Object.keys(nextRow).length === 0) {
        const { [id]: _, ...rest } = state.rowOverrides;
        return { rowOverrides: rest };
      }
      return {
        rowOverrides: {
          ...state.rowOverrides,
          [id]: nextRow
        }
      };
    }),
  uploadDataset: async ({ file, strict }) => {
    set({ loadingUpload: true, activeUploadFilename: file.name });
    try {
      const summary = await uploadDatasetApi({
        file,
        strict
      });
      set({ uploadSummary: summary });
      await get().fetchRecords();
      await Promise.allSettled([
        get().fetchSummary(),
        get().fetchFilters(),
        get().fetchTypeProductBaseline(),
        get().fetchAggregate("volume", ["diretor", "sigla_uf", "tipo_produto"]),
        get().fetchForecastDetail(["cod_produto", "diretor", "sigla_uf", "tipo_produto", "familia"]),
        get().fetchRecordsMeta(),
        get().fetchNotifications()
      ]);
    } finally {
      set({ loadingUpload: false, activeUploadFilename: null });
    }
  },
  fetchRecords: async (limitOrFilters: number | RecordFilters = 100) => {
    const params =
      typeof limitOrFilters === "number"
        ? { limit: limitOrFilters }
        : limitOrFilters;
    const records = await fetchRecordsApi(params);
    set({ records });
  },
  fetchRecordsMeta: async () => {
    const recordsMeta = await fetchRecordsMetaApi();
    set({ recordsMeta });
  },
  wipeDataset: async (confirmation: string) => {
    set({ loadingDelete: true });
    try {
      const { deleted_rows } = await deleteAllRecords(confirmation);
      set({
        deleteSummary: {
          deletedRows: deleted_rows,
          processedAt: new Date().toISOString()
        },
        uploadSummary: null,
        records: []
      });
      await Promise.allSettled([get().fetchRecordsMeta(), get().fetchNotifications()]);
    } finally {
      set({ loadingDelete: false });
    }
  },
  fetchSummary: async () => {
    const summary = await fetchSummaryApi();
    set({ summary });
  },
  fetchFilters: async (payload?: ScenarioFilterPayload) => {
    const filters = await fetchFiltersApi(payload);
    set({ filters });
  },
  fetchNotifications: async () => {
    try {
      const notifications = await fetchNotificationsApi();
      set({ notifications });
    } catch {
      // mantém notificações atuais se falhar
    }
  },
  fetchTypeProductBaseline: async () => {
    const typeProductBaselines = await fetchTypeProductBaseline();
    set({ typeProductBaselines });
  },
  fetchPreprocessSnapshot: async (filters) => {
    set({ loadingPreprocess: true });
    try {
      const snapshot = await fetchPreprocessSnapshotApi(filters ?? {});
      set({ preprocessSnapshot: snapshot });
    } finally {
      set({ loadingPreprocess: false });
    }
  },
  fetchCombinationsSnapshot: async (filters) => {
    const combinations = await fetchCombinationsSnapshotApi(filters ?? {});
    set({ combinationsSnapshot: combinations });
  },
  fetchAggregate: async (metric, groupBy) => {
    const aggregateData = await fetchAggregate(metric, groupBy as string[]);
    set({ aggregateData });
  },
  fetchForecastDetail: async (groupBy) => {
    const forecastDetail = await fetchForecastDetail(groupBy as string[]);
    set({ forecastDetail });
  },
  startLevelScoreRun: async (levels) => {
    set({ loadingLevelScore: true });
    try {
      const run = await startLevelScoreRunApi(levels);
      set({ levelScoreRun: run, levelScoreResults: [] });
    } finally {
      set({ loadingLevelScore: false });
    }
  },
  processLevelScoreChunk: async (runId) => {
    const run = await processLevelScoreChunkApi(runId);
    set({ levelScoreRun: run });
    if (run.status === "completed") {
      const rows = await fetchLevelScoreResultsApi(run.id);
      set({ levelScoreResults: rows });
    }
  },
  fetchLevelScoreStatus: async (runId) => {
    const run = await fetchLevelScoreStatusApi(runId);
    set({ levelScoreRun: run });
  },
  fetchLevelScoreResults: async (runId) => {
    const rows = await fetchLevelScoreResultsApi(runId);
    set({ levelScoreResults: rows });
  },
  setPriceOverride: (type, year, value) =>
    set((state) => {
      const current = state.priceOverrides[type] ?? {};
      const next = { ...current };
      if (value === undefined || Number.isNaN(value)) {
        delete next[year];
      } else {
        next[year] = value;
      }
      return {
        priceOverrides: {
          ...state.priceOverrides,
          [type]: next
        }
      };
    }),
  resetPriceOverride: (type) =>
    set((state) => {
      const { [type]: _, ...rest } = state.priceOverrides;
      return { priceOverrides: rest };
    })
}));
