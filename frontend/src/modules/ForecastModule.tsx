import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { SectionCard } from "../components/SectionCard";
import { useForecastStore } from "../store/useForecastStore";
import type {
  ForecastMethod,
  ForecastVariable,
  ManualGrowthRule
} from "../types/forecast";
import { KpiCard } from "../components/KpiCard";

const formSchema = z.object({
  variable: z.enum(["volume", "revenue"]),
  method: z.enum(["cagr", "trend", "manual"]),
  smoothingYears: z.coerce.number().min(1).max(5)
});

type ForecastFormValues = z.infer<typeof formSchema>;

const methodDescriptions: Record<ForecastMethod, string> = {
  cagr:
    "Cálculo de CAGR com base nos dados 2017–2026, com suavização configurável.",
  trend:
    "Regressão linear simples projetando tendência até 2030, ponderada pelo histórico recente.",
  manual:
    "Aplicação de percentuais customizados por Tipo de Produto ou Família."
};

const variableLabels: Record<ForecastVariable, string> = {
  volume: "Kg (Fat Liq)",
  revenue: "R$ (Receita Líquida)"
};

const samplePreview = [
  { year: 2026, volume: 18250, revenue: 58_400_000 },
  { year: 2027, volume: 18930, revenue: 61_100_000 },
  { year: 2028, volume: 19780, revenue: 64_900_000 },
  { year: 2029, volume: 20640, revenue: 68_200_000 },
  { year: 2030, volume: 21410, revenue: 71_400_000 }
];

export function ForecastModule() {
  const {
    forecastSettings,
    updateForecastSettings,
    setManualRule,
    removeManualRule,
    summary,
    fetchSummary,
    forecastDetail,
    fetchForecastDetail
  } = useForecastStore();

  const historicalTrend = useMemo(() => {
    if (!summary?.totals?.length) return 0;
    const totals = summary.totals.filter((item) => item.year <= 2026);
    if (totals.length < 2) return 0;
    const first = totals[0];
    const last = totals[totals.length - 1];
    const periods = totals.length - 1;
    if (periods === 0 || first.volume <= 0 || last.volume <= 0) return 0;
    const cagr = (last.volume / first.volume) ** (1 / periods) - 1;
    return cagr * 100;
  }, [summary]);

  const preview = useMemo(() => {
    if (!forecastDetail) return [];
    const merged = new Map<number, { volume: number; revenue: number }>();
    forecastDetail.rows.forEach((row) => {
      row.historico.forEach((item) => {
        const current = merged.get(item.year) ?? { volume: 0, revenue: 0 };
        current.volume += item.volume;
        current.revenue += item.revenue;
        merged.set(item.year, current);
      });
      row.baseline.forEach((item) => {
        const current = merged.get(item.year) ?? { volume: 0, revenue: 0 };
        current.volume += item.volume;
        current.revenue += item.revenue;
        merged.set(item.year, current);
      });
    });
    return Array.from(merged.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, value]) => ({
        year,
        volume: value.volume,
        revenue: value.revenue
      }));
  }, [forecastDetail]);

  useEffect(() => {
    if (!summary) {
      fetchSummary().catch(() => null);
    }
  }, [summary, fetchSummary]);

  useEffect(() => {
    if (!forecastDetail) {
      fetchForecastDetail(["cod_produto", "diretor", "sigla_uf", "tipo_produto", "familia"]).catch(
        () => null
      );
    }
  }, [forecastDetail, fetchForecastDetail]);

  const { register, watch } = useForm<ForecastFormValues>({
    defaultValues: forecastSettings,
    resolver: zodResolver(formSchema),
    mode: "onChange"
  });

  const selectedMethod = watch("method");

  const [manualForm, setManualForm] = useState<ManualGrowthRule>({
    scope: "tipoProduto",
    key: "",
    growth: 0
  });

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Configuração do Forecast"
        description="Ajuste a lógica de projeção automática de acordo com a metodologia desejada. Os cálculos consideram o histórico carregado e o plano base de 2026."
        actions={
          <button
            type="button"
            onClick={() => {
              fetchSummary().catch(() => null);
              fetchForecastDetail(["cod_produto", "diretor", "sigla_uf", "tipo_produto", "familia"]).catch(() => null);
            }}
            className="rounded-full border border-brand-400 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
          >
            Reprocessar forecast
          </button>
        }
      >
        <form className="grid gap-6 lg:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-600">
              Variável de referência
            </span>
            <select
              {...register("variable", {
                onChange: (event) =>
                  updateForecastSettings({
                    variable: event.target.value as ForecastVariable
                  })
              })}
              className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              defaultValue={forecastSettings.variable}
            >
              <option value="volume">Volume (Kg)</option>
              <option value="revenue">Receita (R$)</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-600">
              Método automático
            </span>
            <select
              {...register("method", {
                onChange: (event) =>
                  updateForecastSettings({
                    method: event.target.value as ForecastMethod
                  })
              })}
              className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              defaultValue={forecastSettings.method}
            >
              <option value="cagr">Crescimento Linear (CAGR)</option>
              <option value="trend">Regressão com tendência</option>
              <option value="manual">Percentual manual</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="flex items-center justify-between font-medium text-slate-600">
              Janela da média móvel
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {forecastSettings.smoothingYears} anos
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              defaultValue={forecastSettings.smoothingYears}
              {...register("smoothingYears", {
                onChange: (event) =>
                  updateForecastSettings({
                    smoothingYears: Number(event.target.value)
                  })
              })}
              className="accent-brand-500"
            />
          </label>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          {methodDescriptions[selectedMethod]}
        </p>
      </SectionCard>

      <SectionCard
        title="Pré-visualização rápida"
        description="Comparativo de volumes e receitas projetadas considerando as configurações atuais. Valores de 2026 são utilizados como base."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <KpiCard
            label="Variável ativa"
            value={variableLabels[forecastSettings.variable]}
            trend={historicalTrend}
            helper="A taxa exibida considera o CAGR histórico 2017–2026 com base na seleção atual."
          />
          <KpiCard
            label="Método selecionado"
            value={
              selectedMethod === "cagr"
                ? "CAGR 2017–2026"
                : selectedMethod === "trend"
                  ? "Regressão linear"
                  : "Percentual manual"
            }
            helper="Você pode salvar cenários diferentes para comparar no módulo de visões."
          />
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left font-medium text-slate-600">
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Volume projetado (Kg)</th>
                <th className="px-4 py-3">Receita projetada (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {preview.map((item) => (
                <tr key={item.year} className="text-slate-700">
                  <td className="px-4 py-3 font-medium">{item.year}</td>
                  <td className="px-4 py-3">
                    {item.volume.toLocaleString("pt-BR", {
                      maximumFractionDigits: 0
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {item.revenue.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          * Valores históricos consideram todos os registros carregados.
          Projeções futuras são calculadas automaticamente pelo backend com base no CAGR global.
        </p>
      </SectionCard>

      <SectionCard
        title="Ajustes manuais"
        description="Inclua regras adicionais por Tipo de Produto ou Família quando optar pelo método manual."
        actions={
          <button
            type="button"
            onClick={() => {
              if (!manualForm.key.trim()) {
                return;
              }
              setManualRule(manualForm);
              setManualForm({ ...manualForm, key: "", growth: 0 });
            }}
            className="rounded-full border border-brand-400 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            disabled={!manualForm.key.trim()}
          >
            Adicionar regra
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-[180px,1fr,160px]">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Nível
            <select
              value={manualForm.scope}
              onChange={(event) =>
                setManualForm((prev) => ({
                  ...prev,
                  scope: event.target.value as ManualGrowthRule["scope"]
                }))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="tipoProduto">Tipo Produto</option>
              <option value="familia">Família</option>
            </select>
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Chave
            <input
              value={manualForm.key}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, key: event.target.value }))
              }
              placeholder="Ex: Biscoitos Integrais"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Crescimento %
            <input
              type="number"
              value={manualForm.growth}
              onChange={(event) =>
                setManualForm((prev) => ({
                  ...prev,
                  growth: Number(event.target.value)
                }))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
        </div>
        <div className="mt-5 space-y-3">
          {forecastSettings.manualRules.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma regra manual aplicada ainda.
            </p>
          ) : (
            forecastSettings.manualRules.map((rule) => (
              <div
                key={`${rule.scope}-${rule.key}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {rule.key}{" "}
                    <span className="text-xs uppercase text-slate-500">
                      ({rule.scope === "tipoProduto" ? "Tipo Produto" : "Família"}
                      )
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Crescimento aplicado:{" "}
                    <span className="text-brand-600">
                      {rule.growth >= 0
                        ? `+${rule.growth.toFixed(1)}%`
                        : `${rule.growth.toFixed(1)}%`}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeManualRule(rule.key, rule.scope)}
                  className="text-sm font-semibold text-rose-500 hover:text-rose-600"
                >
                  Remover
                </button>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
