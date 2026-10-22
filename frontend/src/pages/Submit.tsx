import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import LocationPicker from "../components/LocationPicker";
import PriorityBreakdown from "../components/PriorityBreakdown";
import { formatPercent } from "../format";
import type { LatLng } from "../components/MapPicker";
import type { CreateComplaintResponse } from "../types";

const DEFAULT_POINT: LatLng = { lat: 19.076, lng: 72.8777 };
export default function Submit() {
  const [description, setDescription] = useState("");
  const [point, setPoint] = useState<LatLng>(DEFAULT_POINT);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateComplaintResponse | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("description", description.trim());
      form.append("lat", String(point.lat));
      form.append("lng", String(point.lng));
      if (locationLabel) form.append("location_label", locationLabel);
      if (reporterName) form.append("reporter_name", reporterName);
      if (reporterContact) form.append("reporter_contact", reporterContact);
      files.forEach((file) => form.append("photos", file));
      const response = await api.createComplaint(form);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-5" aria-live="polite">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-xl font-semibold text-emerald-900">Report Submitted</h1>
          <p className="mt-1.5 text-sm text-emerald-800">
            Your ticket id is{" "}
            <span className="font-mono font-semibold" translate="no">
              {result.ticket_id}
            </span>
            . Keep it to track progress.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="eyebrow mb-3">Classification</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100">
              {result.classification?.category_name ?? result.complaint.category_key}
            </span>
            {result.classification ? (
              <span className="text-xs text-slate-500">
                {formatPercent(result.classification.confidence)} confidence
              </span>
            ) : null}
            {result.classification?.needs_review ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                A human will check this
              </span>
            ) : null}
          </div>
          {result.classification?.explanation.summary ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {result.classification.explanation.summary}
            </p>
          ) : null}
        </div>

        {result.duplicates.length > 0 ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-sky-800">
              We May Already Know About This
            </h2>
            <p className="mt-1.5 text-sm text-sky-700">
              {result.duplicates.length} similar report
              {result.duplicates.length === 1 ? "" : "s"} were filed nearby recently. The
              team will treat them as one issue, so nothing gets lost.
            </p>
            <ul className="mt-3 space-y-1.5">
              {result.duplicates.slice(0, 3).map((match) => (
                <li key={match.ticket_id} className="text-xs text-sky-900">
                  <span className="font-mono" translate="no">
                    {match.ticket_id}
                  </span>{" "}
                  · {match.relation} · match {formatPercent(match.score)} ·{" "}
                  {Math.round(match.distance_m)} m away
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="card p-6">
          <h2 className="eyebrow mb-4">Priority Breakdown</h2>
          <PriorityBreakdown
            explanation={result.priority}
            score={result.complaint.priority_score}
            band={result.complaint.priority_band}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to={`/ticket?id=${result.ticket_id}`} className="btn btn-primary">
            Track This Ticket
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setDescription("");
              setFiles([]);
            }}
            className="btn btn-secondary"
          >
            Report Another Issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
      <section className="card p-6 sm:p-7">
        <h1 className="text-xl font-semibold text-slate-900">Report a Civic Issue</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Describe the problem, drop the pin on the map and we will classify it, score its
          priority and route it to the right department.
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              What is the problem?{" "}
              <span className="text-rose-600" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(required)</span>
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              required
              minLength={5}
              name="description"
              placeholder="e.g. big pit on main road near gate 2, bikes skidding…"
              className="field resize-y"
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              The more concrete the description, the sharper the classification.
            </span>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Where is it? Search a place, share your location or drop the pin
            </span>
            <LocationPicker
              value={point}
              onChange={setPoint}
              onLabelChange={setLocationLabel}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Photos (optional)
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []).slice(0, 4))
              }
              className="w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3.5 py-3 text-sm text-slate-600 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:shadow-sm"
            />
            {files.length > 0 ? (
              <span className="mt-1.5 block text-xs text-slate-500">
                {files.length} photo{files.length === 1 ? "" : "s"} attached.
              </span>
            ) : (
              <span className="mt-1.5 block text-xs text-slate-500">
                Up to 4 photos. A picture helps the classifier.
              </span>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Your name (optional)
              </span>
              <input
                value={reporterName}
                onChange={(event) => setReporterName(event.target.value)}
                name="reporter_name"
                autoComplete="name"
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Contact (optional)
              </span>
              <input
                value={reporterContact}
                onChange={(event) => setReporterContact(event.target.value)}
                name="reporter_contact"
                autoComplete="email"
                placeholder="email or phone…"
                className="field"
              />
            </label>
          </div>

          <p aria-live="polite" className="min-h-0">
            {error ? (
              <span className="block rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </span>
            ) : null}
          </p>

          <button
            type="submit"
            disabled={submitting || description.trim().length < 5}
            className="btn btn-primary w-full"
          >
            {submitting ? "Classifying & submitting…" : "Submit Report"}
          </button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="card p-6">
          <h2 className="eyebrow">What Happens Next</h2>
          <ol className="mt-4 space-y-4 text-sm">
            {[
              {
                title: "Automatic classification",
                body: "The report is matched against past issues to pick a category and a confidence.",
              },
              {
                title: "Duplicate check",
                body: "Nearby recent reports are compared, so the same problem is not fixed twice.",
              },
              {
                title: "Priority scoring",
                body: "Safety, severity, impact, waiting time and repeat reports set the priority.",
              },
              {
                title: "Routing",
                body: "The report is assigned to the right department with a response target.",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-100"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-800">{step.title}</p>
                  <p className="mt-0.5 leading-relaxed text-slate-500">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-6">
          <h2 className="text-sm font-semibold text-brand-900">
            Nothing gets lost
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-800/80">
            Every report keeps its own ticket id, its full history and the reasoning
            behind each decision.
          </p>
        </div>
      </aside>
    </div>
  );
}
