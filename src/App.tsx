import { useState, useEffect, useRef, useCallback } from "react";
import type { Event } from "./types/Event";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import "./App.css";
import type L from "leaflet";
import type { GeoFence } from "./types/GeoFence";
import {
  DEFAULT_PAGE_SIZE,
  MAX_MAPPED_ROWS,
  PagingError,
  fetchAllPages,
} from "./paging";

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
    fetchAllPages<Event>({
      buildRequest: (page) => ({
        url: `/api/v1/events/all?page=${page}&size=${DEFAULT_PAGE_SIZE}`,
      }),
      maxRows: MAX_MAPPED_ROWS,
      // Show each page as it lands rather than waiting for the whole walk.
      onPage: (progress) => {
        setEvents([...progress.content]);
        setLoading(false);
      },
    })
      .then((result) => {
        setEvents(result.content);
        setLoading(false);
      })
      .catch((err) => {
        // Keep whatever pages did land — a partial map beats an empty one.
        if (err instanceof PagingError && err.partial.content.length > 0) {
          setEvents(err.partial.content as Event[]);
        }
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
