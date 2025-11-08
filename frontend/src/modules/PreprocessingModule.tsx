import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { KpiCard } from "../components/KpiCard";
import { StatusPill } from "../components/StatusPill";
import { useForecastStore } from "../store/useForecastStore";
import type { ScenarioFilterPayload } from "../types/forecast";

const scenarioColors = ["#2563eb", "#22c55e", "#f97316"];
type FilterField = keyof ScenarioFilterPayload;

function formatVolume(value?: number) {
  if (value === undefined) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function formatRevenue(value?: number) {
  if (value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatSeconds(seconds?: number) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

export function PreprocessingModule() {
  const {
    filters,
    fetchFilters,
    preprocessSnapshot,
    fetchPreprocessSnapshot,
    loadingPreprocess,
    combinationsSnapshot,
    fetchCombinationsSnapshot,
    levelScoreRun,
    levelScoreResults,
    loadingLevelScore,
    startLevelScoreRun,
    processLevelScoreChunk,
    fetchLevelScoreResults
  } = useForecastStore((state) => ({
    filters: state.filters,
    fetchFilters: state.fetchFilters,
    preprocessSnapshot: state.preprocessSnapshot,
    fetchPreprocessSnapshot: state.fetchPreprocessSnapshot,
    loadingPreprocess: state.loadingPreprocess,
    combinationsSnapshot: state.combinationsSnapshot,
    fetchCombinationsSnapshot: state.fetchCombinationsSnapshot,
    levelScoreRun: state.levelScoreRun,
    levelScoreResults: state.levelScoreResults,
    loadingLevelScore: state.loadingLevelScore,
    startLevelScoreRun: state.startLevelScoreRun,
    processLevelScoreChunk: state.processLevelScoreChunk,
    fetchLevelScoreResults: state.fetchLevelScoreResults
  }));

  const [filterState, setFilterState] = useState<ScenarioFilterPayload>({});
  const [comboYear, setComboYear] = useState<number | undefined>(undefined);
  const [openFilter, setOpenFilter] = useState<FilterField | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFilters().catch(() => null);
    fetchPreprocessSnapshot().catch(() => null);
    fetchCombinationsSnapshot({ limit: 15 }).catch(() => null);
  }, [fetchFilters, fetchPreprocessSnapshot, fetchCombinationsSnapshot]);

  useEffect(() => {
    if (!levelScoreRun) return;
    if (levelScoreRun.status === "completed") {
      if (levelScoreResults.length === 0) {
        fetchLevelScoreResults(levelScoreRun.id).catch(() => null);
      }
      return;
    }
    const timer = setTimeout(() => {
      processLevelScoreChunk(levelScoreRun.id).catch(() => null);
    }, 800);
    return () => clearTimeout(timer);
  }, [levelScoreRun, levelScoreResults.length, processLevelScoreChunk, fetchLevelScoreResults]);

  const filterOptions = useMemo(() => {
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
    return {
      diretores: (filters?.diretores ?? []).filter(Boolean).sort(collator.compare),
      ufs: (filters?.ufs ?? []).filter(Boolean).sort(),
      tipos_produto: (filters?.tipos_produto ?? []).filter(Boolean).sort(collator.compare),
      familias: (filters?.familias ?? []).filter(Boolean).sort(collator.compare),
      familias_producao: (filters?.familias_producao ?? []).filter(Boolean).sort(collator.compare),
      marcas: (filters?.marcas ?? []).filter(Boolean).sort(collator.compare),
      situacoes: (filters?.situacoes ?? []).filter(Boolean).sort(collator.compare),
      codigos: (filters?.codigos ?? []).filter(Boolean).sort(),
      produtos: (filters?.produtos ?? []).filter(Boolean).sort(collator.compare),
      anos: filters?.anos ?? []
    };
  }, [filters]);

  const years = useMemo(() => {
    if (!preprocessSnapshot) return [];
    const allYears = new Set<number>();
    preprocessSnapshot.scenarios.forEach((scenario) => {
      scenario.totals.forEach((point) => allYears.add(point.year));
    });
    return Array.from(allYears).sort((a, b) => a - b);
  }, [preprocessSnapshot]);

  const maxVolume = useMemo(() => {
    if (!preprocessSnapshot) return 0;
    return Math.max(
      0,
      ...preprocessSnapshot.scenarios.flatMap((scenario) =>
        scenario.totals.map((item) => item.volume)
      )
    );
  }, [preprocessSnapshot]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreprocessSnapshot(filterState).catch(() => null);
      fetchCombinationsSnapshot({
        ...filterState,
        ano: comboYear,
        limit: 25
      }).catch(() => null);
      fetchFilters(filterState).catch(() => null);
    }, 350);
    return () => clearTimeout(timer);
  }, [filterState, comboYear, fetchPreprocessSnapshot, fetchCombinationsSnapshot, fetchFilters]);

  const updateFilterField = (field: FilterField, values: string[]) => {
    setFilterState((prev) => {
      const next = { ...prev };
      if (values.length) {
        next[field] = values;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setFilterState({});
    setComboYear(undefined);
    setOpenFilter(null);
    setSearchTerms({});
  };

  const renderMultiSelect = (
    label: string,
    field: FilterField,
    options: string[] = []
  ) => {
    const selected = filterState[field] ?? [];
    const isOpen = openFilter === field;
    const searchValue = (searchTerms[field] ?? "").toLowerCase();
    const filteredOptions = searchValue
      ? options.filter((option) => option.toLowerCase().includes(searchValue))
      : options;

    const toggleOption = (option: string) => {
      const current = filterState[field] ?? [];
      const exists = current.includes(option);
      const nextValues = exists
        ? current.filter((item) => item !== option)
        : [...current, option];
      updateFilterField(field, nextValues);
    };

    return (
      <div className="relative flex flex-col gap-1 text-sm text-slate-600" key={field}>
        <span className="font-medium">{label}</span>
        <button
          type="button"
          onClick={() => setOpenFilter(isOpen ? null : field)}
          className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <span>{selected.length === 0 ? "Todos" : `${selected.length} selecionado(s)`}</span>
          <span className="text-xs text-slate-400">{isOpen ? "Fechar" : "Abrir"}</span>
        </button>
        {isOpen ? (
          <div className="absolute z-20 mt-2 w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <input
              type="text"
              value={searchTerms[field] ?? ""}
              onChange={(event) =>
                setSearchTerms((prev) => ({ ...prev, [field]: event.target.value }))
              }
              placeholder="Buscar..."
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <div className="mt-2 max-h-48 overflow-y-auto pr-1">
              {filteredOptions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-500">Nenhum resultado.</p>
              ) : (
                filteredOptions.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 py-1 text-sm font-medium text-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(option)}
                      onChange={() => toggleOption(option)}
                      className="h-4 w-4 accent-brand-500"
                    />
                    <span className="truncate">{option}</span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  updateFilterField(field, []);
                  setSearchTerms((prev) => ({ ...prev, [field]: "" }));
                }}
                className="text-rose-500"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setOpenFilter(null)}
                className="rounded-full bg-brand-500 px-3 py-1 text-white shadow-sm"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const scenarios = preprocessSnapshot?.scenarios ?? [];
  const hasActiveFilters = useMemo(
    () =>
      Object.values(filterState).some((value) => Array.isArray(value) && value.length > 0) ||
      typeof comboYear === "number",
    [filterState, comboYear]
  );
  const levelScoreProgress = levelScoreRun && levelScoreRun.total_combinations
    ? Math.min(levelScoreRun.processed_combinations / levelScoreRun.total_combinations, 1)
    : 0;

  const chartWidth = 640;
  const chartHeight = 220;
  const chartPadding = 16;

  const xForIndex = (index: number) => {
    if (years.length <= 1) return chartWidth / 2;
    const step = (chartWidth - chartPadding * 2) / (years.length - 1);
    return chartPadding + step * index;
  };

  const yForValue = (value: number) => {
    if (maxVolume === 0) return chartHeight - chartPadding;
    const usableHeight = chartHeight - chartPadding * 2;
    const ratio = value / maxVolume;
    return chartHeight - chartPadding - ratio * usableHeight;
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Pré-processamento & Cenários"
        description="Rode o pré-processamento no backend considerando filtros de dimensão e compare os três cenários calculados automaticamente."
      >
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {renderMultiSelect("Diretor", "diretor", filterOptions.diretores)}
          {renderMultiSelect("UF", "sigla_uf", filterOptions.ufs)}
          {renderMultiSelect("Tipo de Produto", "tipo_produto", filterOptions.tipos_produto)}
          {renderMultiSelect("Família", "familia", filterOptions.familias)}
          {renderMultiSelect("Família Produção", "familia_producao", filterOptions.familias_producao)}
          {renderMultiSelect("Marca", "marca", filterOptions.marcas)}
          {renderMultiSelect("Situação na Lista", "situacao_lista", filterOptions.situacoes)}
          {renderMultiSelect("Código do Produto", "cod_produto", filterOptions.codigos)}
          {renderMultiSelect("Produto", "produto", filterOptions.produtos)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <label className="flex flex-col">
            <span className="font-medium">Ano (combinações)</span>
            <select
              value={comboYear ?? ""}
              onChange={(event) =>
                setComboYear(event.target.value ? Number(event.target.value) : undefined)
              }
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="">Todos</option>
              {filterOptions.anos.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition enabled:hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            Limpar filtros
          </button>
          {loadingPreprocess ? (
            <StatusPill level="info">Processando filtros selecionados...</StatusPill>
          ) : hasActiveFilters ? (
            <StatusPill level="info">Filtros aplicados automaticamente.</StatusPill>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Visão geral dos cenários"
        description="Comparativo de volume e receita ano a ano, com destaque para os três cenários processados."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label="Registros filtrados"
            value={
              preprocessSnapshot
                ? preprocessSnapshot.total_records.toLocaleString("pt-BR")
                : "0"
            }
            helper="Total de linhas consideradas nesta execução no backend."
            accent="brand"
          />
          <KpiCard
            label="Anos cobertos"
            value={years.length ? `${years[0]}–${years[years.length - 1]}` : "—"}
            helper="Período consolidado entre histórico e projeções."
            accent="success"
          />
          <KpiCard
            label="Cenários"
            value={scenarios.length.toString()}
            helper="Base, otimista e pessimista calculados automaticamente."
            accent="warning"
          />
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[720px] divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2">Ano</th>
                {scenarios.map((scenario) => (
                  <th key={`${scenario.id}-volume`} className="px-3 py-2 text-right">
                    {scenario.label} (Kg)
                  </th>
                ))}
                {scenarios.map((scenario) => (
                  <th key={`${scenario.id}-revenue`} className="px-3 py-2 text-right">
                    {scenario.label} (R$)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {years.map((year) => (
                <tr key={year}>
                  <td className="px-3 py-2 font-medium">{year}</td>
                  {scenarios.map((scenario) => {
                    const point = scenario.totals.find((item) => item.year === year);
                    return (
                      <td key={`${scenario.id}-volume-${year}`} className="px-3 py-2 text-right">
                        {formatVolume(point?.volume)}
                      </td>
                    );
                  })}
                  {scenarios.map((scenario) => {
                    const point = scenario.totals.find((item) => item.year === year);
                    return (
                      <td key={`${scenario.id}-revenue-${year}`} className="px-3 py-2 text-right">
                        {formatRevenue(point?.revenue)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Volume projetado (Kg)
          </h3>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
            <svg width={chartWidth} height={chartHeight} className="max-w-full">
              {scenarios.map((scenario, index) => {
                const color = scenarioColors[index % scenarioColors.length];
                const points = scenario.totals
                  .filter((item) => years.includes(item.year))
                  .map((item) => {
                    const x = xForIndex(years.indexOf(item.year));
                    const y = yForValue(item.volume);
                    return `${x},${y}`;
                  })
                  .join(" ");
                return points ? (
                  <polyline
                    key={scenario.id}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                ) : null;
              })}
              {years.map((year, index) => {
                const x = xForIndex(index);
                return (
                  <g key={year}>
                    <line
                      x1={x}
                      y1={chartHeight - chartPadding}
                      x2={x}
                      y2={chartHeight - chartPadding + 6}
                      stroke="#94a3b8"
                    />
                    <text
                      x={x}
                      y={chartHeight - chartPadding + 18}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-500"
                    >
                      {year}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="space-y-2 text-sm text-slate-600">
              {scenarios.map((scenario, index) => (
                <div key={scenario.id} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: scenarioColors[index % scenarioColors.length] }}
                  />
                  <div>
                    <p className="font-semibold text-slate-800">{scenario.label}</p>
                    <p className="text-xs text-slate-500">{scenario.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Score de níveis (COV x Complexidade)"
        description="Calcula o melhor nível para rodar forecast estatístico, considerando estabilidade (COV) e quantidade de combinações."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {levelScoreRun ? (
              <StatusPill level={levelScoreRun.status === "completed" ? "info" : "warning"}>
                {levelScoreRun.status === "completed"
                  ? "Execução concluída"
                  : `Processando nível ${levelScoreRun.processed_levels}/${levelScoreRun.total_levels}`}
              </StatusPill>
            ) : null}
            <div className="text-sm text-slate-600">
              {levelScoreRun?.last_message ?? "Nenhuma execução recente."}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => startLevelScoreRun().catch(() => null)}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
              disabled={loadingLevelScore || (levelScoreRun && levelScoreRun.status !== "completed")}
            >
              {levelScoreRun && levelScoreRun.status !== "completed" ? "Execução em andamento" : "Iniciar cálculo"}
            </button>
            {levelScoreRun && levelScoreRun.status !== "completed" ? (
              <button
                type="button"
                onClick={() => processLevelScoreChunk(levelScoreRun.id).catch(() => null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Forçar próximo bloco
              </button>
            ) : null}
            {levelScoreRun && levelScoreRun.status === "completed" ? (
              <button
                type="button"
                onClick={() => fetchLevelScoreResults(levelScoreRun.id).catch(() => null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Atualizar resultados
              </button>
            ) : null}
          </div>

          {levelScoreRun ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Combinações processadas</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {levelScoreRun.processed_combinations.toLocaleString("pt-BR")} / {levelScoreRun.total_combinations.toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Níveis concluídos</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {levelScoreRun.processed_levels}/{levelScoreRun.total_levels}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Tempo estimado</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatSeconds(levelScoreRun.estimated_seconds)}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${Math.round(levelScoreProgress * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Clique em "Iniciar cálculo" para avaliar automaticamente a melhor combinação de dimensões.
            </p>
          )}

          {levelScoreResults.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[720px] divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Nível</th>
                    <th className="px-3 py-2 text-left font-semibold">Dimensões</th>
                    <th className="px-3 py-2 text-right font-semibold">COV</th>
                    <th className="px-3 py-2 text-right font-semibold">Combinações</th>
                    <th className="px-3 py-2 text-right font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {levelScoreResults.map((row) => (
                    <tr key={row.level_id}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{row.level_id}</td>
                      <td className="px-3 py-2 text-slate-600">{row.dimensions.join(" · ")}</td>
                      <td className="px-3 py-2 text-right">{row.cov_nivel.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{row.n_combinacoes.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {row.score_final !== undefined ? row.score_final.toFixed(3) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Combinações estruturais"
        description="Snapshot das combinações únicas processadas no backend, útil para validar a estrutura comercial e de produto."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[960px] divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Diretor</th>
                <th className="px-3 py-2 text-left font-semibold">UF</th>
                <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th className="px-3 py-2 text-left font-semibold">Família</th>
                <th className="px-3 py-2 text-left font-semibold">Marca</th>
                <th className="px-3 py-2 text-left font-semibold">Produto</th>
                <th className="px-3 py-2 text-right font-semibold">Registros</th>
                <th className="px-3 py-2 text-right font-semibold">Volume total</th>
                <th className="px-3 py-2 text-right font-semibold">Receita total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {combinationsSnapshot && combinationsSnapshot.length > 0 ? (
                combinationsSnapshot.slice(0, 25).map((combo) => (
                  <tr key={combo.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{combo.diretor || "—"}</td>
                    <td className="px-3 py-2">{combo.sigla_uf || "—"}</td>
                    <td className="px-3 py-2">{combo.tipo_produto || "—"}</td>
                    <td className="px-3 py-2">{combo.familia || "—"}</td>
                    <td className="px-3 py-2">{combo.marca || "—"}</td>
                    <td className="px-3 py-2">{combo.produto || combo.cod_produto}</td>
                    <td className="px-3 py-2 text-right">{combo.registros.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right">
                      {combo.volume_total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {combo.receita_total.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    Nenhuma combinação encontrada para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
