import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

export interface LatLng {
  lat: number;
  lng: number;
}

interface MapPickerProps {
  value: LatLng;
  onChange: (value: LatLng) => void;
  center?: LatLng;
  /** When set, the map moves to this point - used when a place was found. */
  focus?: LatLng | null;
}

function ClickHandler({ onChange }: { onChange: (value: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onChange({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

function FlyTo({ point }: { point: LatLng }) {
  const map = useMap();
  useEffect(() => {
    const zoom = Math.max(map.getZoom(), 17);
    map.flyTo([point.lat, point.lng], zoom, { duration: 0.8 });
  }, [map, point.lat, point.lng]);
  return null;
}

export default function MapPicker({
  value,
  onChange,
  center,
  focus,
}: MapPickerProps) {
  const initial = center ?? value;
  return (
    <MapContainer
      center={[initial.lat, initial.lng]}
      zoom={16}
      className="h-80 w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onChange={onChange} />
      {focus ? <FlyTo point={focus} /> : null}
      <CircleMarker
        center={[value.lat, value.lng]}
        radius={9}
        pathOptions={{
          color: "#2a655d",
          fillColor: "#3d9a8a",
          fillOpacity: 0.9,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}
