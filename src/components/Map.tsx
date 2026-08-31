import { memo, useEffect, useRef } from "react";
// maplibre-gl 6 is pure ESM with named exports only, so there is no default export.
// `Map` is aliased to MapLibreMap upstream, which also avoids colliding with this
// component's own name and with the global Map.
import {
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapOptions,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiUrl } from "../api";
import type { Event } from "../types/Event";
import type { GeoFence } from "../types/GeoFence";
import type { Hotspot } from "../types/Hotspot";

// Above this zoom the hotspot pins are noise. You are already inside the data and
// the tile layer is showing it directly.
const HOTSPOT_MAX_ZOOM = 6;

// The telemetry points are never sent to the browser in bulk. MapLibre requests only
// the vector tiles covering the current viewport, and PostGIS builds each one.
const TILE_URL = apiUrl("/api/v1/events/tiles/{z}/{x}/{y}.mvt");

// Must match the layer name passed to ST_AsMVT on the server.
const TILE_SOURCE_LAYER = "events";

const BASEMAP_STYLE: NonNullable<MapOptions["style"]> = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

interface MapProps {
  events: Event[];
  geoFences: GeoFence[];
  hotspots: Hotspot[];
  loading: boolean;
  error: string | null;
  onMapReady: (map: MapLibreMap) => void;
}

function Map({
  events,
  geoFences,
  hotspots,
  loading,
  error,
  onMapReady,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hotspotMarkersRef = useRef<Marker[]>([]);

  // Create the map exactly once. StrictMode runs effects twice in development,
  // so the ref guard matters.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [-64.6, 18.4], // MapLibre takes [lng, lat], not [lat, lng]
      zoom: 9,
    });

    // Assigned immediately, not inside on("load"). StrictMode runs effects twice in
    // development and the cleanup fires before load does. Without this the guard
    // above never sees the first map and it is created, destroyed, and recreated.
    mapRef.current = map;

    // Top-left, not top-right: the API Explorer toggle sits in the top-right corner
    // and the panel it opens covers that whole edge, which would put the zoom
    // controls underneath it exactly when someone is running queries against the map.
    map.addControl(new NavigationControl(), "top-left");

    map.on("load", () => {
      // Overlay sources are registered FIRST and deliberately before the tile source.
      // Anything that throws in this handler stops the rest of it, and a broken tile
      // source must not be able to take the geo-fence and query-result layers with it.

      // --- Geo-fences -------------------------------------------------------
      map.addSource("geofences", { type: "geojson", data: emptyCollection() });
      map.addLayer({
        id: "geofence-fill",
        type: "fill",
        source: "geofences",
        paint: { "fill-color": "#d7301f", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: "geofence-outline",
        type: "line",
        source: "geofences",
        paint: { "line-color": "#d7301f", "line-width": 2 },
      });

      // --- Query results from the sidebar, drawn on top ---------------------
      map.addSource("highlights", { type: "geojson", data: emptyCollection() });
      map.addLayer({
        id: "highlight-points",
        type: "circle",
        source: "highlights",
        paint: {
          "circle-radius": 6,
          "circle-color": "#fd8d3c",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      // --- Telemetry, served as vector tiles -------------------------------
      // Last, and isolated: the endpoint may not exist yet, and a failure here must
      // not prevent the overlays above from working.
      try {
        map.addSource("telemetry", {
          type: "vector",
          tiles: [TILE_URL],
          minzoom: 0,
          maxzoom: 14, // above this MapLibre reuses z14 tiles rather than requesting more
        });

        map.addLayer(
          {
            id: "telemetry-points",
            type: "circle",
            source: "telemetry",
            "source-layer": TILE_SOURCE_LAYER,
            paint: {
              // Both tile types carry point_count: 1 for an individual fix at high
              // zoom, the cell total for a grid-aggregated cluster at low zoom. Sizing
              // and colouring by it means one expression renders both correctly:
              // uniform small dots when zoomed in, weighted blobs when zoomed out.
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "point_count"],
                1,
                5,
                100,
                11,
                1000,
                17,
                10000,
                25,
              ],
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#2b8cbe", // single fixes
                100,
                "#41ab5d", // small cluster
                1000,
                "#fe9929", // medium
                10000,
                "#d7301f", // large
              ],
              "circle-opacity": 0.85,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#ffffff",
            },
          },
          // Insert beneath the highlight layer so query results stay on top.
          "highlight-points",
        );
      } catch (e) {
        console.error("[Map] telemetry tile layer unavailable:", e);
      }

      onMapReady(map);
    });

    // Click a feature for its attributes. Aggregated cells have no individual or tag,
    // since a cluster of 4,000 fixes has no single animal, so they report their count
    // and invite a zoom instead.
    map.on("click", "telemetry-points", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const count = Number(feature.properties?.point_count ?? 1);
      const html =
        count > 1
          ? `<dl aria-label="Cluster details">
               <dt>Fixes in this area</dt><dd>${count.toLocaleString()}</dd>
               <dt></dt><dd>Zoom in to see individual sightings</dd>
             </dl>`
          : `<dl aria-label="Sighting details">
               <dt>Individual</dt><dd>${feature.properties?.individual_id ?? "unknown"}</dd>
               <dt>Tag</dt><dd>${feature.properties?.tag_id ?? "unknown"}</dd>
             </dl>`;

      new Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    map.on("mouseenter", "telemetry-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "telemetry-points", () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapReady]);

  // Geo-fences arrive after load, so push them into the source when they change.
  useEffect(() => {
    const source = mapRef.current?.getSource("geofences") as
      | GeoJSONSource
      | undefined;
    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: (geoFences ?? []).map((fence) => ({
        type: "Feature" as const,
        properties: { name: fence.name, count: fence.lastAnimalCount },
        geometry: {
          type: "Polygon" as const,
          coordinates: [fence.coordinates.map((c) => [c.lon, c.lat])],
        },
      })),
    });
  }, [geoFences]);

  // Sidebar query results: a small overlay, not the bulk data.
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("highlights") as GeoJSONSource | undefined;
    if (!map || !source) return;

    const points = (events ?? []).filter(
      (event) => event.locationLat != null && event.locationLong != null,
    );

    source.setData({
      type: "FeatureCollection",
      features: points.map((event) => ({
        type: "Feature" as const,
        properties: {
          individualId: event.individualId,
          timestamp: event.timestamp,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [event.locationLong, event.locationLat],
        },
      })),
    });

    // Results are a small overlay on a world-scale map. Without this they render
    // correctly but off-screen, which is indistinguishable from nothing happening.
    // The previous clustered build hid this because markers were drawn everywhere.
    if (points.length > 0) {
      const bounds = new LngLatBounds();
      points.forEach((event) =>
        bounds.extend([event.locationLong, event.locationLat]),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 800 });
    }
  }, [events]);

  // Hotspot pins. Rendered as HTML markers rather than a symbol layer because MapLibre
  // needs a glyphs endpoint to draw text, and there are at most a few dozen of these.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    hotspotMarkersRef.current.forEach((marker) => marker.remove());
    hotspotMarkersRef.current = [];

    (hotspots ?? []).forEach((hotspot) => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = formatCount(hotspot.total);
      element.title = `${hotspot.total.toLocaleString()} fixes. Click to zoom here.`;
      element.setAttribute(
        "aria-label",
        `${hotspot.total.toLocaleString()} telemetry fixes. Zoom to this region.`,
      );
      Object.assign(element.style, {
        background: "#1b3a5c",
        color: "#ffffff",
        border: "2px solid #ffffff",
        borderRadius: "999px",
        padding: "4px 10px",
        font: "600 12px system-ui, sans-serif",
        cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
      });

      element.addEventListener("click", () => {
        // Zoom proportionally: a cell holding millions deserves a closer look than
        // one holding a few hundred.
        const zoom = hotspot.total > 100_000 ? 9 : hotspot.total > 10_000 ? 8 : 7;
        map.flyTo({ center: [hotspot.lon, hotspot.lat], zoom, duration: 1200 });
      });

      hotspotMarkersRef.current.push(
        new Marker({ element }).setLngLat([hotspot.lon, hotspot.lat]).addTo(map),
      );
    });

    // Hide them once you are inside the data. Past this zoom the tiles speak for
    // themselves and the pins just cover them up.
    const applyZoomVisibility = () => {
      const visible = map.getZoom() < HOTSPOT_MAX_ZOOM;
      hotspotMarkersRef.current.forEach((marker) => {
        marker.getElement().style.display = visible ? "" : "none";
      });
    };

    applyZoomVisibility();
    map.on("zoom", applyZoomVisibility);

    return () => {
      map.off("zoom", applyZoomVisibility);
      hotspotMarkersRef.current.forEach((marker) => marker.remove());
      hotspotMarkersRef.current = [];
    };
  }, [hotspots]);

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
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

/** Compact pin labels: "2.5M" reads at a glance where "2,538,111" does not. */
function formatCount(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${Math.round(total / 1_000)}k`;
  return String(total);
}

// Use memoized export to prevent heavy re-renders when toggling sidebar
export default memo(Map);
