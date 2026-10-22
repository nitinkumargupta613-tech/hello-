import { useState } from "react";

import { api } from "../api";
import { categoryLabel } from "../format";
import type { LinkSuggestion } from "../types";

interface Props {
  links: LinkSuggestion[];
  onChanged: () => void;
}

export default function DuplicateInbox({ links, onChanged }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(link: LinkSuggestion, decision: "accepted" | "rejected") {
    setBusyId(link.id);
    setError(null);
    try {
      await api.decideLink(link.id, decision, "reviewed in the duplicate inbox");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <h2 className="eyebrow">Duplicate Inbox</h2>
        <p className="mt-1 text-xs text-slate-500">
          Reports the matcher thinks repeat an earlier one. Merging them puts both under
          the same incident.
        </p>
      </div>

      {links.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">
          No duplicate suggestions are waiting.
        </p>
      ) : (
        <ul className="max-h-[24rem] divide-y divide-slate-100 overflow-auto">
          {links.slice(0, 10).map((link) => {
            const busy = busyId === link.id;
            const newer =
              link.second.created_at && link.first.created_at
                ? new Date(link.second.created_at) > new Date(link.first.created_at)
                : false;
            const original = newer ? link.first : link.second;
            const repeat = newer ? link.second : link.first;
            return (
              <li key={link.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                      link.relation === "duplicate"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {link.relation}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    score {link.score.toFixed(2)} · text{" "}
                    {link.text_similarity.toFixed(2)} · {link.distance_m.toFixed(0)} m
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-700">
                  {original.description}
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500" translate="no">
                  {original.ticket_id} ({categoryLabel(original.category_key)}) → repeats{" "}
                  {repeat.ticket_id}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(link, "accepted")}
                    className="btn btn-primary !min-h-9 !px-3 !py-2 !text-xs"
                  >
                    Merge Into One Incident
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(link, "rejected")}
                    className="btn btn-secondary !min-h-9 !px-3 !py-2 !text-xs"
                  >
                    Different Issues
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-rose-600" aria-live="polite">
          {error}
        </p>
      ) : null}
    </section>
  );
}
