import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { CATEGORY_COLORS, categoryLabel } from "../format";
import type { Hotspot } from "../types";

interface Props {
  hotspots: Hotspot[];
}

const CENTER: [number, number] = [19.076, 72.8777];

export default function HotspotPanel({ hotspots }: Props) {
  if (hotspots.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="eyebrow">Recurring Hotspots</h2>
        <p className="mt-2 text-sm text-slate-500">No cluster has repeated yet.</p>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="eyebrow">Recurring Hotspots</h2>
        <p className="mt-1 text-xs text-slate-500">
          Places where the same kind of problem keeps coming back.
        </p>
      </div>

      <ul className="space-y-2 px-5 pb-5">
        {hotspots.slice(0, 5).map((spot) => (
          <li
            key={`${spot.category_key}-${spot.lat}-${spot.lng}`}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3 py-2 text-xs"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[spot.category_key] ?? "#7c746b" }}
                aria-hidden="true"
              />
              <span className="font-medium text-slate-700">
                {categoryLabel(spot.category_key)}
              </span>
            </span>
            <span className="tabular-nums text-slate-500">
              {spot.count} reports · {spot.months_active} months
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-200/80 p-3">
        <MapContainer center={CENTER} zoom={15} className="h-56 w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hotspots.map((spot) => (
            <CircleMarker
              key={`${spot.category_key}-${spot.lat}-${spot.lng}-map`}
              center={[spot.lat, spot.lng]}
              radius={Math.min(6 + spot.count * 2.5, 26)}
              pathOptions={{
                color: CATEGORY_COLORS[spot.category_key] ?? "#7c746b",
                fillColor: CATEGORY_COLORS[spot.category_key] ?? "#7c746b",
                fillOpacity: 0.3,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{categoryLabel(spot.category_key)}</strong>
                <br />
                {spot.count} reports over {spot.months_active} months
                <br />
                oldest {spot.oldest_days} days ago
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
