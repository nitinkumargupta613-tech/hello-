import { useState } from "react";

import { api } from "../api";
import { CATEGORY_KEYS, categoryLabel, formatPercent } from "../format";
import type { Complaint } from "../types";

interface Props {
  complaints: Complaint[];
  onChanged: () => void;
}

export default function ReviewQueue({ complaints, onChanged }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(
    complaint: Complaint,
    categoryKey: string,
    confirm: boolean,
  ) {
    setBusyId(complaint.id);
    setError(null);
    try {
      await api.reviewComplaint(complaint.id, categoryKey, confirm, "reviewed from queue");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-amber-200/70 bg-amber-50/50 px-5 py-4">
        <h2 className="eyebrow !text-amber-800">Human Review Queue</h2>
        <p className="mt-1 text-xs text-amber-800/80">
          {complaints.length === 0
            ? "Nothing is waiting for a human decision."
            : `${complaints.length} report${complaints.length === 1 ? "" : "s"} the model was not sure about.`}
        </p>
      </div>

      {complaints.length > 0 ? (
        <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-auto">
          {complaints.slice(0, 12).map((complaint) => {
            const busy = busyId === complaint.id;
            const reason = complaint.category_explanation?.review_reason;
            return (
              <li key={complaint.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-slate-500" translate="no">
                      {complaint.ticket_id}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-700">
                      {complaint.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
                    {complaint.category_confidence !== null
                      ? formatPercent(complaint.category_confidence)
                      : "n/a"}
                  </span>
                </div>

                {reason ? (
                  <p className="mt-2 line-clamp-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800">
                    {reason}
                  </p>
                ) : null}

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !complaint.category_key}
                    onClick={() => decide(complaint, complaint.category_key as string, true)}
                    className="btn btn-primary !min-h-9 !px-3 !py-2 !text-xs"
                  >
                    Confirm {categoryLabel(complaint.category_key)}
                  </button>
                  <select
                    defaultValue=""
                    disabled={busy}
                    aria-label={`Override category for ${complaint.ticket_id}`}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      event.target.value = "";
                      void decide(complaint, value, false);
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
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-rose-600" aria-live="polite">
          {error}
        </p>
      ) : null}
    </section>
  );
}
