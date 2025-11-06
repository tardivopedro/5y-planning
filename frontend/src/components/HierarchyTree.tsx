import clsx from "clsx";
import { HierarchyNode } from "../types/forecast";

interface HierarchyTreeProps {
  nodes: HierarchyNode[];
  selectedId?: string;
  onSelect: (node: HierarchyNode) => void;
}

export function HierarchyTree({
  nodes,
  selectedId,
  onSelect
}: HierarchyTreeProps) {
  return (
    <ul className="space-y-2">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node)}
            className={clsx(
              "flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition",
              selectedId === node.id
                ? "border-brand-400 bg-brand-50 shadow-sm shadow-brand-200/30"
                : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/60"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">
                {node.name}
              </p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-500">
                {node.level}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span>
                Volume:{" "}
                <strong className="text-slate-800">
                  {node.volume.toLocaleString("pt-BR")}
                </strong>
              </span>
              <span>
                Receita:{" "}
                <strong className="text-slate-800">
                  {node.revenue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                  })}
                </strong>
              </span>
              <span>
                Tendência:{" "}
                <strong
                  className={
                    node.trend >= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {node.trend >= 0
                    ? `+${node.trend.toFixed(1)}%`
                    : `${node.trend.toFixed(1)}%`}
                </strong>
              </span>
            </div>
          </button>
          {node.children?.length ? (
            <div className="ml-4 border-l border-dashed border-slate-200 pl-4">
              <HierarchyTree
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
