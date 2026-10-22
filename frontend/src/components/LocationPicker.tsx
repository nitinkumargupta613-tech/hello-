import { useEffect, useRef, useState } from "react";

import { api } from "../api";
import MapPicker, { type LatLng } from "./MapPicker";

interface Props {
  value: LatLng;
  onChange: (value: LatLng) => void;
  onLabelChange?: (label: string | null) => void;
}

interface Candidate {
  label: string;
  lat: number;
  lng: number;
  source: string;
}

const GEOLOCATION_MESSAGES: Record<number, string> = {
  1: "Location permission was denied. Pick a point on the map instead.",
  2: "Your position is not available right now. Pick a point on the map instead.",
  3: "Finding your position took too long. Try again or pick a point on the map.",
};

/** "Near Library Crossing" reads better as a chip than in the search box. */
function forBox(label: string | null): string | null {
  if (!label) return null;
  return label.replace(/^Near\s+/i, "");
}

export default function LocationPicker({ value, onChange, onLabelChange }: Props) {
  // Held in a ref so the lookup effect does not re-run when the parent
  // passes a new callback on every render.
  const labelCallback = useRef(onLabelChange);
  labelCallback.current = onLabelChange;

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [place, setPlace] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  // The point the map should move to, set whenever the place changes outside
  // a map click.
  const [focus, setFocus] = useState<LatLng | null>(null);

  // Name the current point, and keep the search box in step with it.
  useEffect(() => {
    let active = true;
    api
      .reversePlace(value.lat, value.lng)
      .then((result) => {
        if (!active) return;
        setPlace(result.label);
        labelCallback.current?.(result.label);
        setQuery(forBox(result.label) ?? "");
      })
      .catch(() => {
        if (!active) return;
        setPlace(null);
        labelCallback.current?.(null);
      });
    return () => {
      active = false;
    };
  }, [value.lat, value.lng]);

  function selectPlace(label: string, point: LatLng, message: string) {
    onChange(point);
    setFocus(point);
    setPlace(label);
    setQuery(forBox(label) ?? label);
    labelCallback.current?.(label);
    setCandidates([]);
    setStatus(message);
  }

  async function findPlace() {
    const text = query.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await api.searchPlace(text);
      if (!result.found || result.candidates.length === 0) {
        setCandidates([]);
        setError(
          result.hint ??
            "That place was not found. Try a campus name or pick a point on the map.",
        );
        return;
      }
      setCandidates(result.candidates);
      const best = result.candidates[0];
      selectPlace(
        best.label,
        { lat: best.lat, lng: best.lng },
        result.candidates.length > 1
          ? `${result.candidates.length} matches found, pick one below.`
          : "Location set from the place name.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up that place");
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share a location. Pick a point on the map instead.");
      return;
    }
    setLocating(true);
    setError(null);
    setStatus("Asking your browser for your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        onChange(next);
        setFocus(next);
        setCandidates([]);
        setStatus("Location taken from your device.");
      },
      (geoError) => {
        setLocating(false);
        setStatus(null);
        setError(
          GEOLOCATION_MESSAGES[geoError.code] ??
            "Your location could not be read. Pick a point on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // A plain div, not a form: this component is used inside the report form
  // and a nested form would break the document structure.
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="place-search">
          Search for a place
        </label>
        <input
          id="place-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void findPlace();
            }
          }}
          placeholder="Search a place, e.g. Main Gate 2…"
          autoComplete="off"
          spellCheck={false}
          className="field flex-1"
        />
        <button
          type="button"
          onClick={() => void findPlace()}
          disabled={busy || !query.trim()}
          className="btn btn-primary"
        >
          {busy ? "Finding…" : "Find Place"}
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="btn btn-secondary"
        >
          {locating ? "Locating…" : "Use My Location"}
        </button>
      </div>

      {candidates.length > 1 ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Matching places">
          {candidates.map((candidate) => (
            <li key={`${candidate.label}-${candidate.lat}`}>
              <button
                type="button"
                onClick={() =>
                  selectPlace(
                    candidate.label,
                    { lat: candidate.lat, lng: candidate.lng },
                    "Location set from the place name.",
                  )
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                {candidate.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p aria-live="polite" className="mt-2 min-h-0 text-xs">
        {error ? (
          <span className="block rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-700">
            {error}
          </span>
        ) : status ? (
          <span className="block text-slate-500">{status}</span>
        ) : null}
      </p>

      <div className="mt-3">
        <MapPicker value={value} onChange={onChange} focus={focus} />
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        {place ? (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">
            {place}
          </span>
        ) : null}
        <span className="tabular-nums">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </span>
      </p>
    </div>
  );
}
