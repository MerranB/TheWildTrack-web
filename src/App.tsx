import { useState, useEffect, useRef, useCallback } from "react";
import type { Event } from "./types/Event";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import "./App.css";
import type L from "leaflet";
import type { GeoFence } from "./types/GeoFence";
import { apiUrl } from "./api";

function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [geoFences, setGeoFences] = useState<GeoFence[]>([]);

  const mapRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const flyTo = useCallback((lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 13);
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/v1/events/all"))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch events");
        return res.json();
      })
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Map
        geoFences={geoFences}
        events={events}
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
