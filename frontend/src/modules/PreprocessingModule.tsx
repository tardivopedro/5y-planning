import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { KpiCard } from "../components/KpiCard";
import { StatusPill } from "../components/StatusPill";
import { useForecastStore } from "../store/useForecastStore";
import type { ScenarioFilterPayload } from "../types/forecast";

const scenarioColors = ["#2563eb", "#22c55e", "#f97316"];

function formatVolume(value?: number) {
  if (value === undefined) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function formatRevenue(value?: number) {
  if (value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PreprocessingModule() {
  const {
    filters,
    fetchFilters,
    preprocessSnapshot,
    fetchPreprocessSnapshot,
    loadingPreprocess,
    combinationsSnapshot,
    fetchCombinationsSnapshot
  } = useForecastStore((state) => ({
    filters: state.filters,
    fetchFilters: state.fetchFilters,
    preprocessSnapshot: state.preprocessSnapshot,
    fetchPreprocessSnapshot: state.fetchPreprocessSnapshot,
    loadingPreprocess: state.loadingPreprocess,
    combinationsSnapshot: state.combinationsSnapshot,
    fetchCombinationsSnapshot: state.fetchCombinationsSnapshot
  }));

  const [filterState, setFilterState] = useState<ScenarioFilterPayload>({});
  const [comboYear, setComboYear] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchFilters().catch(() => null);
    fetchPreprocessSnapshot().catch(() => null);
    fetchCombinationsSnapshot({ limit: 15 }).catch(() => null);
  }, [fetchFilters, fetchPreprocessSnapshot, fetchCombinationsSnapshot]);

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
    }, 350);
    return () => clearTimeout(timer);
  }, [filterState, comboYear, fetchPreprocessSnapshot, fetchCombinationsSnapshot]);

  const handleClearFilters = () => {
    setFilterState({});
    setComboYear(undefined);
  };

  const renderSelect = (
    label: string,
    field: keyof ScenarioFilterPayload,
    options: string[] = []
  ) => (
    <label className="flex flex-col gap-1 text-sm text-slate-600" key={field}>
      <span className="font-medium">{label}</span>
      <select
        value={filterState[field] ?? ""}
        onChange={(event) =>
          setFilterState((prev) => ({
            ...prev,
            [field]: event.target.value || undefined
          }))
        }
        className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );

  const scenarios = preprocessSnapshot?.scenarios ?? [];
  const hasActiveFilters = useMemo(
    () =>
      Object.values(filterState).some((value) => Boolean(value)) ||
      typeof comboYear === "number",
    [filterState, comboYear]
  );

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
        <div className="grid gap-4 md:grid-cols-6">
          {renderSelect("Diretor", "diretor", filterOptions.diretores)}
          {renderSelect("UF", "sigla_uf", filterOptions.ufs)}
          {renderSelect("Tipo de Produto", "tipo_produto", filterOptions.tipos_produto)}
          {renderSelect("Família", "familia", filterOptions.familias)}
          {renderSelect("Família Produção", "familia_producao", filterOptions.familias_producao)}
          {renderSelect("Marca", "marca", filterOptions.marcas)}
          {renderSelect("Situação na Lista", "situacao_lista", filterOptions.situacoes)}
          {renderSelect("Código do Produto", "cod_produto", filterOptions.codigos)}
          {renderSelect("Produto", "produto", filterOptions.produtos)}
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
