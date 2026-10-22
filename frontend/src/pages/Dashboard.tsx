import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api";
import AddReport from "../components/AddReport";
import ComplaintDetail from "../components/ComplaintDetail";
import DuplicateInbox from "../components/DuplicateInbox";
import HotspotPanel from "../components/HotspotPanel";
import ReviewQueue from "../components/ReviewQueue";
import WorkloadPanel from "../components/WorkloadPanel";
import {
  ageInDays,
  bandClass,
  categoryLabel,
  formatPercent,
  isOverdue,
  statusLabel,
} from "../format";
import type { Complaint, Hotspot, LinkSuggestion, Overview, WorkloadRow } from "../types";

const STATUS_OPTIONS = ["submitted", "triaged", "assigned", "in_progress", "resolved"];

const REFRESH_MS = 20_000;

const CATEGORY_OPTIONS = [
  { key: "pothole", label: "Pothole" },
  { key: "garbage", label: "Garbage" },
  { key: "water_leak", label: "Water leak" },
  { key: "streetlight", label: "Streetlight" },
  { key: "drainage", label: "Drainage" },
  { key: "other", label: "Other" },
];

interface Filters {
  status: string;
  category: string;
  department: string;
  q: string;
  needs_review: boolean;
}

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    status: params.get("status") ?? "",
    category: params.get("category") ?? "",
    department: params.get("department") ?? "",
    q: params.get("q") ?? "",
    needs_review: params.get("review") === "1",
  };
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [links, setLinks] = useState<LinkSuggestion[]>([]);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [showAddReport, setShowAddReport] = useState(false);
  const [searchText, setSearchText] = useState(filters.q);

  const setFilter = useCallback(
    (key: keyof Filters, value: string | boolean) => {
      const next = new URLSearchParams(searchParams);
      const param = key === "needs_review" ? "review" : key;
      if (value === "" || value === false) {
        next.delete(param);
      } else {
        next.set(param, value === true ? "1" : String(value));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    if (searchText === filters.q) return;
    const timer = window.setTimeout(() => setFilter("q", searchText), 300);
    return () => window.clearTimeout(timer);
  }, [searchText, filters.q, setFilter]);

  // Keep the box in step when the filter is cleared or the URL changes.
  useEffect(() => {
    setSearchText(filters.q);
  }, [filters.q]);

  const load = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      if (!options.quiet) {
        setLoading(true);
      }
      try {
        const [rows, stats, load2, spots, pending] = await Promise.all([
          api.listComplaints({
            status: filters.status || undefined,
            category: filters.category || undefined,
            department: filters.department || undefined,
            q: filters.q || undefined,
            needs_review: filters.needs_review ? true : undefined,
            limit: 200,
          }),
          api.overview(),
          api.workload(),
          api.hotspots(),
          api.listLinks("pending"),
        ]);
        setComplaints(rows);
        setOverview(stats);
        setWorkload(load2);
        setHotspots(spots);
        setLinks(pending);
        setSelected((current) =>
          current ? rows.find((row) => row.id === current.id) ?? null : null,
        );
        setError(null);
        setUpdatedAt(new Date());
      } catch (err) {
        if (!options.quiet) {
          setError(err instanceof Error ? err.message : "Could not load the dashboard");
        }
      } finally {
        if (!options.quiet) {
          setLoading(false);
        }
      }
    },
    [filters],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the queue in step with the database: anything added, edited or
  // removed on the server appears here without a manual reload.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void load({ quiet: true });
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const reviewQueue = useMemo(
    () => complaints.filter((row) => row.needs_review),
    [complaints],
  );

  const openCount = complaints.filter((row) => row.status !== "resolved").length;
  const activeFilters =
    (filters.status ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.department ? 1 : 0) +
    (filters.q ? 1 : 0) +
    (filters.needs_review ? 1 : 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Triage queue, human review, duplicate matching and department load for the
            campus estate.
          </p>
          <p className="mt-1.5 text-xs text-slate-500" aria-live="polite">
            Live from the database
            {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""} · refreshes
            every {REFRESH_MS / 1000}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} className="btn btn-secondary">
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAddReport((value) => !value)}
            className="btn btn-primary"
            aria-expanded={showAddReport}
          >
            {showAddReport ? "Close Form" : "+ Add Location"}
          </button>
        </div>
      </header>

      {overview ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Reports" value={overview.total} hint={`${openCount} open in view`} />
          <StatCard
            label="Needs Review"
            value={overview.needs_review}
            hint="low confidence or ambiguous"
            tone={overview.needs_review > 0 ? "warn" : "calm"}
          />
          <StatCard
            label="Duplicate Candidates"
            value={overview.pending_links}
            hint="waiting for a decision"
            tone={overview.pending_links > 0 ? "warn" : "calm"}
          />
          <StatCard
            label="Hotspot Clusters"
            value={hotspots.length}
            hint={`${hotspots[0]?.count ?? 0} reports in the worst cluster`}
          />
        </div>
      ) : null}

      {showAddReport ? (
        <AddReport
          onCreated={() => {
            void load();
          }}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-200/80 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="eyebrow">Priority Queue</h2>
                <span className="text-xs text-slate-500">
                  {loading ? "loading…" : `${complaints.length} complaints`}
                  {activeFilters > 0 ? " · filtered" : ""}
                </span>
              </div>

              <div className="mt-3.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search descriptions…"
                  aria-label="Search descriptions"
                  className="field !py-2"
                />
                <select
                  value={filters.status}
                  onChange={(event) => setFilter("status", event.target.value)}
                  aria-label="Filter by status"
                  className="field !py-2"
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {statusLabel(option)}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.category}
                  onChange={(event) => setFilter("category", event.target.value)}
                  aria-label="Filter by category"
                  className="field !py-2"
                >
                  <option value="">All categories</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.department}
                  onChange={(event) => setFilter("department", event.target.value)}
                  aria-label="Filter by department"
                  className="field !py-2"
                >
                  <option value="">All departments</option>
                  {workload.map((row) => (
                    <option key={row.department_key} value={row.department_key}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={filters.needs_review}
                    onChange={(event) => setFilter("needs_review", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Only complaints waiting for human review
                </label>
                {activeFilters > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                    className="btn btn-ghost !px-2 !py-1 text-xs"
                  >
                    Clear Filters
                  </button>
                ) : null}
              </div>
            </div>

            {error ? (
              <p className="px-5 py-4 text-sm text-rose-600" aria-live="polite">
                {error}
              </p>
            ) : null}

            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-xs uppercase tracking-[0.06em] text-slate-500 backdrop-blur">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Ticket
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Priority
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Department
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Age
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className={`dashboard-row cursor-pointer transition-colors duration-150 hover:bg-brand-50/50 ${
                        selected?.id === row.id ? "bg-brand-50/70" : ""
                      }`}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-700" translate="no">
                            {row.ticket_id}
                          </span>
                          {row.needs_review ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                              review
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 max-w-[18rem] truncate text-xs text-slate-500">
                          {row.description}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {categoryLabel(row.category_key)}
                        {row.category_confidence !== null ? (
                          <span className="ml-1 tabular-nums text-slate-500">
                            {formatPercent(row.category_confidence)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${bandClass(
                            row.priority_band,
                          )}`}
                        >
                          {row.priority_score.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {statusLabel(row.status)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {row.department_key ?? "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs">
                        <span className="tabular-nums text-slate-600">
                          {ageInDays(row.created_at)}d
                        </span>
                        {isOverdue(row.sla_due_at, row.status) ? (
                          <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                            sla
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!loading && complaints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                        No complaint matches these filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <DuplicateInbox links={links} onChanged={() => void load()} />

          <div className="grid gap-6 sm:grid-cols-2">
            <WorkloadPanel rows={workload} />
            <HotspotPanel hotspots={hotspots} />
          </div>
        </div>

        <div className="space-y-6">
          {selected ? (
            <ComplaintDetail
              complaint={selected}
              onChanged={() => void load()}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="card border-dashed p-8 text-center text-sm text-slate-500">
              Select a complaint from the queue to see the AI reasoning, priority
              breakdown and duplicate matches.
            </div>
          )}

          <ReviewQueue complaints={reviewQueue} onChanged={() => void load()} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "calm",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "calm" | "warn";
}) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums ${
          tone === "warn" && value > 0 ? "text-amber-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
