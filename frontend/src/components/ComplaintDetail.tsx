import { useEffect, useState } from "react";

import { api } from "../api";
import PriorityBreakdown from "./PriorityBreakdown";
import {
  CATEGORY_KEYS,
  bandClass,
  categoryLabel,
  formatDateTime,
  formatPercent,
  statusLabel,
} from "../format";
import type { Complaint, ComplaintLink, PriorityExplanation } from "../types";

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  submitted: [
    { status: "triaged", label: "Mark Triaged" },
    { status: "assigned", label: "Assign to Department" },
    { status: "resolved", label: "Resolve" },
  ],
  triaged: [
    { status: "assigned", label: "Assign to Department" },
    { status: "in_progress", label: "Start Work" },
    { status: "resolved", label: "Resolve" },
  ],
  assigned: [
    { status: "in_progress", label: "Start Work" },
    { status: "resolved", label: "Resolve" },
  ],
  in_progress: [
    { status: "resolved", label: "Resolve" },
    { status: "assigned", label: "Send Back" },
  ],
  resolved: [{ status: "in_progress", label: "Reopen" }],
};

interface Props {
  complaint: Complaint;
  onChanged: () => void;
  onClose: () => void;
}

export default function ComplaintDetail({ complaint, onChanged, onClose }: Props) {
  const [links, setLinks] = useState<ComplaintLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setMessage(null);
    setError(null);
    api
      .getComplaintLinks(complaint.id)
      .then((rows) => {
        if (active) setLinks(rows);
      })
      .catch(() => {
        if (active) setLinks([]);
      });
    return () => {
      active = false;
    };
  }, [complaint.id]);

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(okMessage);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const explanation = complaint.category_explanation;
  const alternatives = complaint.category_alternatives ?? [];
  const priority = (complaint.priority_factors
    ? {
        factors: complaint.priority_factors,
        contributions: complaint.priority_contributions ?? {},
        labels: {
          safety_risk: "Safety",
          severity: "Severity",
          community_impact: "Impact",
          wait_time: "Wait",
          related_reports: "Reports",
        },
        weights: {
          safety_risk: 0.3,
          severity: 0.25,
          community_impact: 0.2,
          wait_time: 0.15,
          related_reports: 0.1,
        },
        base_score: complaint.priority_score,
        sla_boost: 0,
        sla_hours: 0,
        sla_due_at: complaint.sla_due_at ?? "",
        sla_breached: false,
        age_hours: 0,
        evidence: {},
        summary: "",
      }
    : null) as PriorityExplanation | null;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 bg-slate-50/60 px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-900" translate="no">
            {complaint.ticket_id}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{complaint.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close complaint details"
          className="btn btn-ghost shrink-0 !px-2 !py-1 text-xs"
        >
          Close
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold tabular-nums ring-1 ${bandClass(
              complaint.priority_band,
            )}`}
          >
            Priority {complaint.priority_score.toFixed(0)} · {complaint.priority_band}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
            {statusLabel(complaint.status)}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
            {categoryLabel(complaint.category_key)}
          </span>
          {complaint.department_key ? (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700">
              {complaint.department_key}
            </span>
          ) : null}
          {complaint.needs_review ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-800">
              Needs review
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          {complaint.location_label ? (
            <div className="col-span-2 rounded-xl bg-brand-50/70 p-2.5">
              <dt className="text-brand-700/80">Location</dt>
              <dd className="mt-0.5 font-medium text-brand-900">
                {complaint.location_label}
              </dd>
            </div>
          ) : null}
          <div className="rounded-xl bg-slate-50 p-2.5">
            <dt className="text-slate-500">Reported</dt>
            <dd className="mt-0.5 text-slate-800">{formatDateTime(complaint.created_at)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5">
            <dt className="text-slate-500">SLA target</dt>
            <dd className="mt-0.5 text-slate-800">{formatDateTime(complaint.sla_due_at)}</dd>
          </div>
        </dl>

        {explanation ? (
          <div className="rounded-xl border border-slate-200/80 p-4">
            <p className="eyebrow">Why This Category</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {explanation.summary}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500">
              <div>
                Confidence{" "}
                <span className="font-medium tabular-nums text-slate-700">
                  {complaint.category_confidence !== null
                    ? formatPercent(complaint.category_confidence)
                    : "—"}
                </span>
              </div>
              <div>
                Method <span className="font-medium text-slate-700">{explanation.method}</span>
              </div>
              <div className="col-span-2">
                Nearest prototype{" "}
                <span className="font-medium text-slate-700">
                  {explanation.nearest_prototype}
                </span>{" "}
                (cosine {explanation.prototype_similarity?.toFixed(2)})
              </div>
              {explanation.matched_keywords?.length ? (
                <div className="col-span-2">
                  Keyword rules{" "}
                  <span className="font-medium text-slate-700">
                    {explanation.matched_keywords.join(", ")}
                  </span>
                </div>
              ) : null}
              {explanation.review_reason ? (
                <div className="col-span-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">
                  {explanation.review_reason}
                </div>
              ) : null}
            </dl>
            {alternatives.length > 1 ? (
              <div className="mt-4 space-y-1.5">
                {alternatives.slice(0, 3).map((alt) => (
                  <div key={alt.key} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 text-slate-600">{alt.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-400"
                        style={{ width: `${formatPercent(alt.confidence)}` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums text-slate-500">
                      {formatPercent(alt.confidence)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className="eyebrow mb-2">Priority Breakdown</p>
          <PriorityBreakdown
            explanation={priority}
            score={complaint.priority_score}
            band={complaint.priority_band}
          />
        </div>

        {links.length > 0 ? (
          <div>
            <p className="eyebrow mb-2">Duplicate Matches</p>
            <ul className="space-y-2">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="rounded-xl border border-slate-200/80 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">
                      {link.relation} · score{" "}
                      <span className="tabular-nums">{link.score.toFixed(2)}</span>
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        link.status === "accepted"
                          ? "bg-emerald-100 text-emerald-700"
                          : link.status === "rejected"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {link.status}
                    </span>
                  </div>
                  <p className="mt-1 tabular-nums text-slate-500">
                    text {link.text_similarity.toFixed(2)} · geo{" "}
                    {link.geo_proximity.toFixed(2)} · time {link.time_decay.toFixed(2)} ·{" "}
                    {link.distance_m.toFixed(0)} m
                  </p>
                  {link.status === "pending" ? (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => api.decideLink(link.id, "accepted", "merged from dashboard"),
                            "Link accepted, complaints merged into one incident.",
                          )
                        }
                        className="btn !bg-brand-600 !min-h-9 !px-3 !py-2 !text-xs !text-white hover:!bg-brand-700"
                      >
                        Merge
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => api.decideLink(link.id, "rejected", "not the same issue"),
                            "Link rejected.",
                          )
                        }
                        className="btn btn-secondary !min-h-9 !px-3 !py-2 !text-xs"
                      >
                        Not a Duplicate
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {complaint.needs_review ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-800">
              Human Review Needed
            </p>
            <p className="mt-1.5 text-xs text-amber-700">
              Confirm the suggested category or override it with the right one.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !complaint.category_key}
                onClick={() =>
                  run(
                    () =>
                      api.reviewComplaint(
                        complaint.id,
                        complaint.category_key as string,
                        true,
                        "confirmed from dashboard",
                      ),
                    "Category confirmed.",
                  )
                }
                className="btn !bg-amber-600 !min-h-9 !px-3 !py-2 !text-xs !text-white hover:!bg-amber-700"
              >
                Confirm {categoryLabel(complaint.category_key)}
              </button>
              <select
                defaultValue=""
                disabled={busy}
                aria-label="Override the category"
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  event.target.value = "";
                  void run(
                    () =>
                      api.reviewComplaint(
                        complaint.id,
                        value,
                        false,
                        "overridden from dashboard",
                      ),
                    `Category overridden with ${categoryLabel(value)}.`,
                  );
                }}
                className="field !min-h-9 !w-auto !py-2 !text-xs"
              >
                <option value="">Override with…</option>
                {CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {categoryLabel(key)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div>
          <p className="eyebrow mb-2">Move This Ticket On</p>
          <div className="flex flex-wrap gap-2">
            {(NEXT_STATUS[complaint.status] ?? []).map((option) => (
              <button
                key={option.status}
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.changeStatus(complaint.id, option.status, "dashboard action"),
                    `Status set to ${statusLabel(option.status)}.`,
                  )
                }
                className="btn btn-primary !min-h-9 !px-3 !py-2 !text-xs"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p aria-live="polite" className="min-h-0">
          {message ? (
            <span className="block rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">
              {message}
            </span>
          ) : null}
          {error ? (
            <span className="block rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
              {error}
            </span>
          ) : null}
        </p>
      </div>
    </section>
  );
}
