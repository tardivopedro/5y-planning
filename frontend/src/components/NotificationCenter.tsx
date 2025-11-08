import { useMemo, useState } from "react";
import { useForecastStore } from "../store/useForecastStore";

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function NotificationCenter() {
  const notifications = useForecastStore((state) => state.notifications);
  const runningCount = useMemo(
    () => notifications.filter((item) => item.status === "running").length,
    [notifications]
  );
  const [open, setOpen] = useState(false);
  const latest = notifications.slice(0, 6);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-brand-50 hover:text-brand-700"
      >
        Central de Notificações
        {runningCount > 0 ? (
          <span className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white">
            {runningCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Atividades recentes</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Fechar
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {latest.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma notificação até o momento.</p>
            ) : (
              latest.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-600"
                >
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>{item.category}</span>
                    <span>{formatTimestamp(item.updated_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.message}</p>
                  {typeof item.progress === "number" ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Status</span>
                        <span>{Math.round(item.progress * 100)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full bg-brand-500"
                          style={{ width: `${Math.min(100, Math.round(item.progress * 100))}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <span
                    className={
                      "mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                      (item.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "failed"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700")
                    }
                  >
                    {item.status === "running"
                      ? "Em progresso"
                      : item.status === "completed"
                        ? "Concluído"
                        : "Falhou"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
