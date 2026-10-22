import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api";
import { formatDateTime, statusLabel } from "../format";
import type { TicketStatus } from "../types";

const STEPS = ["submitted", "triaged", "assigned", "in_progress", "resolved"];

export default function TicketStatus() {
  const [params, setParams] = useSearchParams();
  const [ticketId, setTicketId] = useState(params.get("id") ?? "");
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = params.get("id");
    if (id) setTicketId(id);
  }, [params]);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (!ticketId.trim()) return;
    setLoading(true);
    setError(null);
    setTicket(null);
    try {
      const result = await api.getTicket(ticketId.trim());
      setTicket(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  const currentIndex = ticket ? STEPS.indexOf(ticket.status) : -1;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Track a Ticket</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Enter the ticket id you received when you reported the issue.
        </p>
      </div>

      <form onSubmit={lookup} className="flex gap-3">
        <label className="sr-only" htmlFor="ticket-id">
          Ticket id
        </label>
        <input
          id="ticket-id"
          value={ticketId}
          onChange={(event) => setTicketId(event.target.value)}
          placeholder="CS-XXXXXXXX…"
          spellCheck={false}
          autoComplete="off"
          className="field flex-1 font-mono"
        />
        <button
          type="submit"
          disabled={loading || !ticketId.trim()}
          className="btn btn-primary"
        >
          {loading ? "Checking…" : "Track"}
        </button>
      </form>

      <p aria-live="polite" className="min-h-0">
        {error ? (
          <span className="block rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
            {error}
          </span>
        ) : null}
      </p>

      {ticket ? (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">Ticket</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900" translate="no">
                {ticket.ticket_id}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-700 ring-1 ring-brand-100">
              {statusLabel(ticket.status)}
            </span>
          </div>

          <ol className="mt-6 flex items-center gap-1.5">
            {STEPS.map((step, index) => {
              const done = currentIndex >= index && currentIndex !== -1;
              const active = currentIndex === index;
              return (
                <li key={step} className="flex flex-1 flex-col gap-1.5">
                  <span
                    className={`h-1.5 w-full rounded-full transition-colors duration-300 ${
                      done ? "bg-brand-500" : "bg-slate-200"
                    } ${active ? "ring-2 ring-brand-200" : ""}`}
                  />
                  <span
                    className={`text-[11px] ${
                      done ? "font-medium text-slate-700" : "text-slate-500"
                    }`}
                  >
                    {statusLabel(step)}
                  </span>
                </li>
              );
            })}
          </ol>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3.5">
              <dt className="text-xs text-slate-500">Category</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-800">
                {ticket.category ?? "Pending triage"}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <dt className="text-xs text-slate-500">Priority band</dt>
              <dd className="mt-0.5 text-sm font-medium capitalize text-slate-800">
                {ticket.priority_band ?? "—"}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <dt className="text-xs text-slate-500">Reported</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-800">
                {formatDateTime(ticket.created_at)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <dt className="text-xs text-slate-500">Last update</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-800">
                {formatDateTime(ticket.updated_at)}
              </dd>
            </div>
            {ticket.department ? (
              <div className="rounded-xl bg-slate-50 p-3.5">
                <dt className="text-xs text-slate-500">Handled by</dt>
                <dd className="mt-0.5 text-sm font-medium capitalize text-slate-800">
                  {ticket.department}
                </dd>
              </div>
            ) : null}
            {ticket.grouped_reports > 1 ? (
              <div className="rounded-xl bg-brand-50/70 p-3.5">
                <dt className="text-xs text-brand-700/80">Grouped reports</dt>
                <dd className="mt-0.5 text-sm font-medium text-brand-900">
                  {ticket.grouped_reports} people reported this issue
                </dd>
              </div>
            ) : null}
          </dl>

          {ticket.last_update ? (
            <p className="mt-4 text-sm text-slate-600">{ticket.last_update}</p>
          ) : null}
        </div>
      ) : null}

      {ticket ? (
        <button
          type="button"
          onClick={() => {
            setTicketId("");
            setTicket(null);
            setParams({});
          }}
          className="btn btn-ghost !px-2 !py-1 text-sm"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
