import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import L from "leaflet";
import type { Event } from "../types/Event";
import { memo, useEffect } from "react";
import { Polygon } from "react-leaflet";
import type { GeoFence } from "../types/GeoFence";

delete (
  L.Icon.Default.prototype as typeof L.Icon.Default.prototype & {
    _getIconUrl?: unknown;
  }
)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function MapController({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

interface MapProps {
  events: Event[];
  geoFences: GeoFence[];
  loading: boolean;
  error: string | null;
  onMapReady: (map: L.Map) => void;
}

function Map({ events, loading, error, onMapReady, geoFences }: MapProps) {
  const position: [number, number] = [18.4, -64.6];
  const zoomLevel = 10;

  if (error) return <div role="alert">Error: {error}</div>;

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      {loading && (
        <div
          role="status"
          style={{ position: "absolute", color: "white", zIndex: 10 }}
        >
          Loading map data...
        </div>
      )}
      <MapContainer
        center={position}
        zoom={zoomLevel}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController onMapReady={onMapReady} />
        {loading === false && (
          <MarkerClusterGroup>
            {geoFences.map((fence) => (
              <Polygon
                key={fence.id}
                positions={fence.coordinates.map(
                  (c) => [c.lat, c.lon] as [number, number],
                )}
                pathOptions={{
                  color: "red",
                  fillColor: "red",
                  fillOpacity: 0.1,
                }}
              >
                <Popup>
                  <dl aria-label="Geo-fence details">
                    <dt>Name</dt>
                    <dd>{fence.name}</dd>
                    <dt>Animals in zone</dt>
                    <dd>{fence.lastAnimalCount}</dd>
                  </dl>
                </Popup>
              </Polygon>
            ))}
            {events
              .filter((event) => event.locationLat != null && event.locationLong != null)
              .map((event) => (
              <Marker
                key={event.id}
                position={[event.locationLat, event.locationLong]}
              >
                <Popup>
                  <dl aria-label="Sighting details">
                    <dt>Individual</dt>
                    <dd>{event.individualId}</dd>
                    <dt>Time</dt>
                    <dd>{event.timestamp}</dd>
                  </dl>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
      </MapContainer>
    </div>
  );
}

// Use memoized export to prevent heavy re-renders when toggling sidebar
export default memo(Map);
