import { formatPercent } from "../format";
import type { WorkloadRow } from "../types";

export default function WorkloadPanel({ rows }: { rows: WorkloadRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="eyebrow">Department Load</h2>
        <p className="mt-2 text-sm text-slate-500">No open work.</p>
      </section>
    );
  }

  const peak = Math.max(...rows.map((row) => row.capacity || row.open), 1);

  return (
    <section className="card p-5">
      <h2 className="eyebrow">Department Load</h2>
      <p className="mt-1 text-xs text-slate-500">
        Open tickets against the capacity configured for each team.
      </p>
      <ul className="mt-5 max-h-[22rem] space-y-4 overflow-auto pr-1">
        {rows.map((row) => {
          const over = row.capacity ? row.open > row.capacity : false;
          const width = `${Math.min(100, (row.open / peak) * 100)}%`;
          return (
            <li key={row.department_key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                <span className="font-medium text-slate-700">{row.name}</span>
                <span className="tabular-nums text-slate-500">
                  {row.open} open
                  {row.capacity ? ` / ${row.capacity}` : ""}
                </span>
                {row.overdue > 0 ? (
                  <span className="w-full rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700 sm:w-auto">
                    {row.overdue} overdue
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    over ? "bg-rose-400" : "bg-brand-400"
                  }`}
                  style={{ width }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  {Object.entries(row.by_status)
                    .map(([status, count]) => `${status} ${count}`)
                    .join(" · ")}
                </span>
                <span className="tabular-nums">avg priority {row.avg_priority}</span>
              </div>
              {row.utilisation !== null ? (
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                  {formatPercent(row.utilisation)} of capacity used
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
