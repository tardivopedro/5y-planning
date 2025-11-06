import clsx from "clsx";

interface StatusPillProps {
  level: "warning" | "error" | "info";
  children: string;
}

export function StatusPill({ level, children }: StatusPillProps) {
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs";

  const map = {
    warning: "bg-amber-100 text-amber-800",
    error: "bg-rose-100 text-rose-800",
    info: "bg-slate-100 text-slate-700"
  };

  const icon = {
    warning: "⚠️",
    error: "⛔️",
    info: "ℹ️"
  };

  return (
    <span className={clsx(base, map[level])}>
      <span>{icon[level]}</span>
      <span>{children}</span>
    </span>
  );
}
