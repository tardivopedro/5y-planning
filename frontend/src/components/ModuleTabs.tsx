import clsx from "clsx";

const tabs = [
  { id: "upload", label: "Upload de Dados" },
  { id: "preprocess", label: "Pré-processamento" },
  { id: "forecast", label: "Forecast Automático" },
  { id: "edition", label: "Edição Multinível" },
  { id: "pricing", label: "Aplicação de Preço" },
  { id: "reporting", label: "Visões & Exportações" }
];

interface ModuleTabsProps {
  activeTab: string;
  onChange: (id: string) => void;
}

export function ModuleTabs({ activeTab, onChange }: ModuleTabsProps) {
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            "rounded-full px-4 py-2 text-sm font-medium transition",
            activeTab === tab.id
              ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
