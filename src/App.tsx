import { useState, useRef, useCallback, useEffect } from "react";
import type { Event } from "./types/Event";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import "./App.css";
import type { MapLibreMap } from "maplibre-gl";
import type { GeoFence } from "./types/GeoFence";
import type { Hotspot } from "./types/Hotspot";
import { apiUrl } from "./api";

function App() {
  // Bulk telemetry no longer lives here. The map streams it as vector tiles, so the
  // browser never holds the full dataset. `events` now carries only sidebar query
  // results, drawn as a highlight overlay on top of the tiles.
  const [events, setEvents] = useState<Event[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [geoFences, setGeoFences] = useState<GeoFence[]>([]);

  const mapRef = useRef<MapLibreMap | null>(null);

  const handleMapReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
  }, []);

  const flyTo = useCallback((lat: number, lng: number) => {
    // MapLibre takes [lng, lat], not [lat, lng].
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 13 });
  }, []);

  // Where the data actually is. The distribution is very uneven, so without these
  // the world view looks empty and there is no way to know where to pan.
  useEffect(() => {
    fetch(apiUrl("/api/v1/events/hotspots"))
      .then((res) => (res.ok ? res.json() : []))
      .then(setHotspots)
      .catch(() => setHotspots([]));
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Map
        geoFences={geoFences}
        events={events}
        hotspots={hotspots}
        loading={loading}
        error={error}
        onMapReady={handleMapReady}
      />
      <Sidebar
        setEvents={setEvents}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        flyTo={flyTo}
        setGeoFences={setGeoFences}
      />
    </div>
  );
}

export default App;
