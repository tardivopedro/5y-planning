import { useEffect, useMemo } from "react";
import { useForecastStore } from "../store/useForecastStore";
import { SectionCard } from "../components/SectionCard";
import { KpiCard } from "../components/KpiCard";

const futureYears = [2027, 2028, 2029, 2030];

export function PricingModule() {
  const {
    priceSettings,
    updatePriceSettings,
    typeProductBaselines,
    fetchTypeProductBaseline,
    priceOverrides,
    setPriceOverride,
    resetPriceOverride
  } = useForecastStore();

  useEffect(() => {
    if (!typeProductBaselines) {
      fetchTypeProductBaseline().catch(() => null);
    }
  }, [typeProductBaselines, fetchTypeProductBaseline]);

  const basePrice = useMemo(() => {
    if (!typeProductBaselines?.length) return 0;
    const totals = typeProductBaselines
      .map((entry) => {
        const base = entry.historico.find((item) => item.year === 2026);
        if (!base || base.volume === 0) return 0;
        return base.revenue / base.volume;
      })
      .filter(Boolean);
    if (!totals.length) return 0;
    return totals.reduce((acc, price) => acc + price, 0) / totals.length;
  }, [typeProductBaselines]);

  const price2030 = useMemo(() => {
    if (priceSettings.mode === "fixed") return basePrice;
    return basePrice * (1 + priceSettings.annualGrowthPct / 100) ** 4;
  }, [basePrice, priceSettings]);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Regras de preço"
        description="Escolha como o preço médio agregado evolui. Os ajustes por Tipo Produto complementam esta regra global."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-600">Modo de preço</span>
            <select
              value={priceSettings.mode}
              onChange={(event) =>
                updatePriceSettings({
                  mode: event.target.value as typeof priceSettings.mode
                })
              }
              className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="fixed">Congelar preço de 2026</option>
              <option value="annualGrowth">
                Aplicar crescimento percentual anual
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-600">
              Percentual anual (%)
            </span>
            <input
              type="number"
              value={priceSettings.annualGrowthPct}
              onChange={(event) =>
                updatePriceSettings({
                  annualGrowthPct: Number(event.target.value)
                })
              }
              className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              disabled={priceSettings.mode === "fixed"}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-600">
              Ano base do preço
            </span>
            <input
              type="number"
              value={priceSettings.basePriceYear}
              onChange={(event) =>
                updatePriceSettings({
                  basePriceYear: Number(event.target.value)
                })
              }
              className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Impacto agregado"
        description="Resumo do preço médio ponderado considerando todos os tipos de produto."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label="Preço médio 2026"
            value={basePrice ? basePrice.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL"
            }) : "—"}
            accent="brand"
            helper="Preço ponderado por volume usando os dados carregados para 2026."
          />
          <KpiCard
            label="Preço médio 2030"
            value={price2030 ? price2030.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL"
            }) : "—"}
            accent="brand"
            helper="Aplicação das regras globais + ajustes específicos por tipo de produto."
          />
          <KpiCard
            label="Tipos de produto"
            value={typeProductBaselines?.length.toString() ?? "0"}
            accent="success"
            helper="Quantidade total de tipos com histórico carregado."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Ajustes por Tipo Produto"
        description="Informe percentuais de incremento ano a ano. O ajuste é aplicado sobre o preço ajustado do ano anterior."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Tipo Produto</th>
                  <th className="px-3 py-2 text-right font-semibold">Preço 2026</th>
                  {futureYears.map((year) => (
                    <th key={year} className="px-3 py-2 text-right font-semibold">
                      {year} %
                    </th>
                  ))}
                  {futureYears.map((year) => (
                    <th key={`adj-${year}`} className="px-3 py-2 text-right font-semibold">
                      Preço {year}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {typeProductBaselines?.map((entry) => {
                  const base2026 = entry.historico.find((item) => item.year === 2026);
                  const basePriceType = base2026 && base2026.volume > 0 ? base2026.revenue / base2026.volume : 0;
                  let previous = basePriceType;
                  const overrides = priceOverrides[entry.tipo_produto] ?? {};

                  return (
                    <tr key={entry.tipo_produto}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {entry.tipo_produto}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {previous.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL"
                        })}
                      </td>
                      {futureYears.map((year) => (
                        <td key={`input-${entry.tipo_produto}-${year}`} className="px-3 py-2 text-right">
                          <input
                            type="number"
                            value={overrides[year] ?? ""}
                            placeholder="0,0"
                            onChange={(event) =>
                              setPriceOverride(
                                entry.tipo_produto,
                                year,
                                event.target.value === "" ? undefined : Number(event.target.value)
                              )
                            }
                            className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-right text-sm font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                          />
                        </td>
                      ))}
                      {futureYears.map((year) => {
                        const adjustment = overrides[year] ?? 0;
                        previous = previous * (1 + adjustment / 100);
                        return (
                          <td key={`calc-${entry.tipo_produto}-${year}`} className="px-3 py-2 text-right font-semibold">
                            {previous.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL"
                            })}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        {priceOverrides[entry.tipo_produto] ? (
                          <button
                            type="button"
                            onClick={() => resetPriceOverride(entry.tipo_produto)}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                          >
                            Limpar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          * Ajustes personalizados serão aplicados sobre o baseline calculado por tipo de produto. Registre percentuais positivos ou negativos conforme necessário.
        </p>
      </SectionCard>
    </div>
  );
}
