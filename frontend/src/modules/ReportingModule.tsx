import { SectionCard } from "../components/SectionCard";
import { useForecastStore } from "../store/useForecastStore";

const sampleContribution = [
  { label: "Massas", value: 42 },
  { label: "Biscoitos", value: 31 },
  { label: "Farinhas", value: 18 },
  { label: "Outros", value: 9 }
];

const sampleTimeseries = [
  { year: 2024, volume: 16200, revenue: 50_400_000 },
  { year: 2025, volume: 16940, revenue: 53_100_000 },
  { year: 2026, volume: 17680, revenue: 55_900_000 },
  { year: 2027, volume: 18520, revenue: 59_300_000 },
  { year: 2028, volume: 19460, revenue: 63_100_000 },
  { year: 2029, volume: 20350, revenue: 66_700_000 },
  { year: 2030, volume: 21180, revenue: 70_200_000 }
];

export function ReportingModule() {
  const { scenarios } = useForecastStore();

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Cenários salvos"
        description="Compare e gerencie diferentes versões do plano. Defina a visão base e exporte quando estiver pronto."
        actions={
          <button className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">
            Criar novo cenário
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <article
              key={scenario.id}
              className={`rounded-2xl border px-4 py-4 text-sm shadow-sm transition hover:border-brand-300 hover:shadow ${
                scenario.isPrimary
                  ? "border-brand-400 bg-brand-50 text-brand-800 shadow-brand-100/70"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <header className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{scenario.name}</h3>
                {scenario.isPrimary ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-600">
                    Base
                  </span>
                ) : null}
              </header>
              <p className="mt-2 text-sm">{scenario.description}</p>
              <p className="mt-3 text-xs uppercase text-slate-500">
                Atualizado em {scenario.lastSaved}
              </p>
              <div className="mt-4 flex gap-2">
                <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Duplicar
                </button>
                <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Exportar
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Visão temporal"
        description="Volume e receita projetados por ano com comparação contra o histórico."
        actions={
          <div className="flex gap-2">
            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Kg
            </button>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              R$
            </button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="relative h-64 bg-gradient-to-r from-brand-50 via-white to-emerald-50">
            <svg
              viewBox="0 0 400 160"
              className="absolute inset-0 h-full w-full text-brand-400"
            >
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,130 60,120 120,110 180,96 240,82 300,70 360,58 400,45"
              />
              <polyline
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,110 60,105 120,100 180,89 240,80 300,72 360,66 400,60"
              />
            </svg>
          </div>
          <div className="p-4">
            <table className="min-w-full text-xs text-slate-600">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold text-slate-500">
                    Ano
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-500">
                    Volume (Kg)
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-500">
                    Receita (R$)
                  </th>
                </tr>
              </thead>
              <tbody>
                {sampleTimeseries.map((row) => (
                  <tr key={row.year} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {row.year}
                    </td>
                    <td className="px-3 py-2">
                      {row.volume.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      {row.revenue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Contribuição por Tipo de Produto"
        description="Distribuição percentual da receita total projetada para 2030."
        actions={
          <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Exportar gráfico
          </button>
        }
      >
        <div className="grid gap-6 md:grid-cols-[260px,1fr]">
          <div
            className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-full shadow-inner"
            style={{
              background: `conic-gradient(#1f4bff 0% 42%, #22c55e 42% 73%, #f97316 73% 91%, #a855f7 91% 100%)`
            }}
          >
            <div className="absolute h-36 w-36 rounded-full bg-white shadow-inner" />
            <span className="relative text-center text-sm font-semibold text-slate-600">
              Receita 2030
              <span className="block text-lg text-slate-900">R$ 71,4M</span>
            </span>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            {sampleContribution.map((item, index) => (
              <li
                key={item.label}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: [
                        "#1f4bff",
                        "#22c55e",
                        "#f97316",
                        "#a855f7"
                      ][index]
                    }}
                  />
                  <span className="font-semibold text-slate-800">
                    {item.label}
                  </span>
                </div>
                <span className="text-slate-700">{item.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      <SectionCard
        title="Exportações"
        description="Gere relatórios em diferentes formatos para compartilhar com as áreas parceiras."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">
            Exportar Excel
          </button>
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            Exportar PDF
          </button>
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            Compartilhar link
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
