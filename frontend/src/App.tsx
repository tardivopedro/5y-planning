import { ModuleTabs } from "./components/ModuleTabs";
import { useForecastStore } from "./store/useForecastStore";
import { DataUploadModule } from "./modules/DataUploadModule";
import { ForecastModule } from "./modules/ForecastModule";
import { EditingModule } from "./modules/EditingModule";
import { PricingModule } from "./modules/PricingModule";
import { ReportingModule } from "./modules/ReportingModule";

function renderModule(activeTab: string) {
  switch (activeTab) {
    case "upload":
      return <DataUploadModule />;
    case "forecast":
      return <ForecastModule />;
    case "edition":
      return <EditingModule />;
    case "pricing":
      return <PricingModule />;
    case "reporting":
      return <ReportingModule />;
    default:
      return <DataUploadModule />;
  }
}

export default function App() {
  const { activeTab, setActiveTab } = useForecastStore();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
                Planejamento 2026–2030
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Cockpit de Planejamento Comercial
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Configure o forecast automático, ajuste manualmente e exporte o
                plano consolidado.
              </p>
            </div>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-brand-50 hover:text-brand-700">
              IA Sugere Forecast
            </button>
          </div>
          <ModuleTabs activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8 sm:py-10">
        {renderModule(activeTab)}
      </main>
      <footer className="border-t border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>v0.1.0 • Modelo mestre: Diretor → SKU</span>
          <span>Último cálculo automático: 12/08/2024 18:34</span>
          <span>Responsável: time Planejamento Comercial</span>
        </div>
      </footer>
    </div>
  );
}
