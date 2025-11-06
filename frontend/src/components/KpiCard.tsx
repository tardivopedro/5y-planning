interface KpiCardProps {
  label: string;
  value: string;
  trend?: number;
  accent?: "brand" | "success" | "warning";
  helper?: string;
}

const accentToColor: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  brand: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700"
};

export function KpiCard({
  label,
  value,
  trend,
  accent = "brand",
  helper
}: KpiCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 px-5 py-4 shadow-sm ${accentToColor[accent]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {trend !== undefined ? (
        <p className="mt-1 text-sm text-slate-600">
          Tendência CAGR:{" "}
          <span className={trend >= 0 ? "text-emerald-600" : "text-rose-600"}>
            {trend > 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`}
          </span>
        </p>
      ) : null}
      {helper ? (
        <p className="mt-2 text-xs text-slate-500 leading-5">{helper}</p>
      ) : null}
    </div>
  );
}
