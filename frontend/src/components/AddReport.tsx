import { useState } from "react";

import { api } from "../api";
import LocationPicker from "./LocationPicker";
import type { LatLng } from "./MapPicker";

const DEFAULT_POINT: LatLng = { lat: 19.076, lng: 72.8777 };

interface Props {
  onCreated: () => void;
}

export default function AddReport({ onCreated }: Props) {
  const [description, setDescription] = useState("");
  const [point, setPoint] = useState<LatLng>(DEFAULT_POINT);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [reporterName, setReporterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("description", description.trim());
      form.append("lat", String(point.lat));
      form.append("lng", String(point.lng));
      if (locationLabel) form.append("location_label", locationLabel);
      if (reporterName.trim()) form.append("reporter_name", reporterName.trim());

      const created = await api.createComplaint(form);
      const duplicates = created.duplicates?.length ?? 0;
      setDone(
        `Created ${created.ticket_id} in ${
          created.complaint.department_key ?? "no department"
        }` + (duplicates ? ` · matched ${duplicates} existing report${duplicates === 1 ? "" : "s"}` : ""),
      );
      setDescription("");
      setReporterName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/60 px-5 py-4">
        <h2 className="eyebrow !text-brand-700">Add a Location</h2>
        <p className="text-xs text-slate-500">
          Click the map to drop the pin, or type the coordinates below.
        </p>
      </div>

      <form className="grid gap-6 p-5 lg:grid-cols-[1.1fr_1fr]" onSubmit={handleSubmit}>
        <div>
          <LocationPicker
            value={point}
            onChange={setPoint}
            onLabelChange={setLocationLabel}
          />
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              What is happening there?
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              required
              minLength={5}
              name="description"
              placeholder="e.g. water pipeline burst near the sports complex…"
              className="field resize-y"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Reported by (optional)
            </span>
            <input
              value={reporterName}
              onChange={(event) => setReporterName(event.target.value)}
              name="reporter_name"
              autoComplete="name"
              className="field"
            />
          </label>

          <p aria-live="polite" className="min-h-0">
            {error ? (
              <span className="block rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </span>
            ) : null}
            {done ? (
              <span className="block rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
                {done}
              </span>
            ) : null}
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || description.trim().length < 5}
              className="btn btn-primary"
            >
              {busy ? "Saving…" : "Save Location"}
            </button>
            <button
              type="button"
              onClick={() => setPoint(DEFAULT_POINT)}
              className="btn btn-secondary"
            >
              Reset Pin
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
