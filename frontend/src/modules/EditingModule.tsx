import { useEffect, useMemo, useState } from "react";
import { useForecastStore } from "../store/useForecastStore";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

const DIMENSION_OPTIONS = [
  { value: "diretor", label: "Diretor" },
  { value: "sigla_uf", label: "UF" },
  { value: "tipo_produto", label: "Tipo Produto" },
  { value: "familia", label: "Família" },
  { value: "familia_producao", label: "Família Produção" },
  { value: "marca", label: "Marca" },
  { value: "situacao_lista", label: "Situação" },
  { value: "cod_produto", label: "Código" },
  { value: "produto", label: "Produto" }
];

const FILTER_FIELD_MAP: Record<string, string> = {
  diretor: "diretores",
  sigla_uf: "ufs",
  tipo_produto: "tipos_produto",
  familia: "familias",
  familia_producao: "familias_producao",
  marca: "marcas",
  situacao_lista: "situacoes",
  cod_produto: "codigos",
  produto: "produtos"
};

const DEFAULT_GROUP = ["diretor", "sigla_uf", "tipo_produto", "familia"];
const YEARS = Array.from({ length: 14 }, (_, index) => 2017 + index);
const FUTURE_YEARS = YEARS.filter((year) => year >= 2027);

function keyToId(key: Record<string, string | number>): string {
  return JSON.stringify(key, Object.keys(key).sort());
}

export function EditingModule() {
  const {
    filters,
    aggregateData,
    forecastDetail,
    fetchAggregate,
    fetchForecastDetail,
    rowOverrides,
    setRowOverride,
    resetRowOverride
  } = useForecastStore((state) => ({
    filters: state.filters,
    aggregateData: state.aggregateData,
    forecastDetail: state.forecastDetail,
    fetchAggregate: state.fetchAggregate,
    fetchForecastDetail: state.fetchForecastDetail,
    rowOverrides: state.rowOverrides,
    setRowOverride: state.setRowOverride,
    resetRowOverride: state.resetRowOverride
  }));

  const [groupBy, setGroupBy] = useState<string[]>(DEFAULT_GROUP);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getFilterValues = (dimension: string): string[] => {
    if (!filters) return [];
    const fieldKey = FILTER_FIELD_MAP[dimension];
    if (!fieldKey) return [];
    const map = filters as unknown as Record<string, string[]>;
    return map[fieldKey] ?? [];
  };


  const handleToggleGroup = (dimension: string) => {
    setGroupBy((prev) => {
      if (prev.includes(dimension)) {
        const next = prev.filter((item) => item !== dimension);
        return next.length ? next : prev;
      }
      return [...prev, dimension];
    });
  };

  const handleFilterChange = (dimension: string, value: string) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [dimension]: value
    }));
  };

  const applyGrouping = async () => {
    setLoading(true);
    setFeedback(null);
    setError(null);
    try {
      await fetchAggregate("volume", groupBy);
      await fetchForecastDetail(groupBy);
      setFeedback("Dados atualizados para a combinação selecionada.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Não foi possível carregar os dados agregados.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!aggregateData || !forecastDetail) {
      applyGrouping().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tableData = useMemo(() => {
    if (!forecastDetail) return { rows: [], totals: {} as Record<number, number> };

    const totals: Record<number, number> = {};
    const rows = forecastDetail.rows
      .map((row) => {
        const id = keyToId(row.key);
        const historyMap = new Map(row.historico.map((item) => [item.year, item.volume]));
        const baselineMap = new Map(row.baseline.map((item) => [item.year, item.volume]));
        const overrides = rowOverrides[id] ?? {};

        const volumes: Record<number, number> = {};
        YEARS.forEach((year) => {
          let value = historyMap.get(year) ?? 0;
          if (!historyMap.has(year)) {
            const baseline = baselineMap.get(year) ?? 0;
            const pct = overrides[year]?.volumePct ?? 0;
            value = baseline * (1 + pct / 100);
          }
          if (value < 0) value = 0;
          volumes[year] = value;
          totals[year] = (totals[year] ?? 0) + value;
        });

        return {
          id,
          key: row.key,
          volumes
        };
      })
      .filter((row) => {
        return Object.entries(selectedFilters).every(([dimension, value]) => {
          if (!value) return true;
          return String(row.key[dimension] ?? "") === value;
        });
      });

    return { rows, totals };
  }, [forecastDetail, rowOverrides, selectedFilters]);

  const shareLookup = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    tableData.rows.forEach((row) => {
      const shares: Record<number, number> = {};
      YEARS.forEach((year) => {
        const total = tableData.totals[year] ?? 0;
        shares[year] = total > 0 ? (row.volumes[year] / total) * 100 : 0;
      });
      map[row.id] = shares;
    });
    return map;
  }, [tableData]);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Configurar visão"
        description="Escolha os agrupamentos e filtros para analisar os dados e aplicar ajustes."
        actions={
          <button
            type="button"
            disabled={loading}
            onClick={applyGrouping}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Carregando..." : "Atualizar visão"}
          </button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Agrupar por
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {DIMENSION_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={groupBy.includes(option.value)}
                    onChange={() => handleToggleGroup(option.value)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Filtros rápidos
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {groupBy.map((dimension) => (
                <label key={dimension} className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {DIMENSION_OPTIONS.find((option) => option.value === dimension)?.label ?? dimension}
                  <select
                    value={selectedFilters[dimension] ?? ""}
                    onChange={(event) => handleFilterChange(dimension, event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  >
                    <option value="">Todos</option>
                    {getFilterValues(dimension).map((value: string) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </div>
        {feedback ? <StatusPill level="info">{feedback}</StatusPill> : null}
        {error ? <StatusPill level="error">{error}</StatusPill> : null}
      </SectionCard>

      <SectionCard
        title="Tabela multinível"
        description="Volumes históricos e projeções (2027–2030). Ajuste percentuais somente nos anos futuros."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {groupBy.map((dimension) => (
                    <th key={dimension} className="px-3 py-3 text-left font-semibold uppercase">
                      {DIMENSION_OPTIONS.find((option) => option.value === dimension)?.label ?? dimension}
                    </th>
                  ))}
                  {YEARS.map((year) => (
                    <th key={year} className="px-3 py-3 text-right font-semibold">
                      {year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {tableData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={groupBy.length + YEARS.length} className="px-4 py-6 text-center text-sm text-slate-500">
                      Nenhum dado encontrado com os filtros atuais. Execute uma nova consulta.
                    </td>
                  </tr>
                ) : (
                  tableData.rows.map((row) => (
                    <tr key={row.id}>
                      {groupBy.map((dimension) => (
                        <td key={dimension} className="px-3 py-2 font-medium text-slate-800">
                          {String(row.key[dimension] ?? "-")}
                        </td>
                      ))}
                      {YEARS.map((year) => {
                        const volume = row.volumes[year] ?? 0;
                        const share = shareLookup[row.id]?.[year] ?? 0;
                        const overridePct = rowOverrides[row.id]?.[year]?.volumePct ?? "";
                        const isFuture = year >= 2027;
                        return (
                          <td key={year} className="px-3 py-2 text-right align-top">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-800">
                                {volume.toLocaleString("pt-BR", {
                                  maximumFractionDigits: 0
                                })}
                              </div>
                              <div className="text-[10px] uppercase text-slate-400">
                                {share.toFixed(1)}%
                              </div>
                              {isFuture ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={overridePct}
                                    placeholder="Δ%"
                                    onChange={(event) =>
                                      setRowOverride(
                                        row.id,
                                        year,
                                        {
                                          volumePct:
                                            event.target.value === ""
                                              ? undefined
                                              : Number(event.target.value)
                                        }
                                      )
                                    }
                                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                                  />
                                  {rowOverrides[row.id]?.[year] ? (
                                    <button
                                      type="button"
                                      onClick={() => resetRowOverride(row.id, year)}
                                      className="text-[10px] font-semibold uppercase text-rose-500"
                                    >
                                      limpar
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          A participação exibida considera a soma das linhas após os ajustes. Valores negativos são truncados para zero automaticamente.
        </p>
      </SectionCard>
    </div>
  );
}
