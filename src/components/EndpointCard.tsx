import { useState } from "react";
import type { ApiEndpoint } from "../types/ApiEndpoint";
import type { Event } from "../types/Event";
import type { GeoFence } from "../types/GeoFence";
import { apiUrl } from "../api";

function EndpointCard({
  endpoint,
  setEvents,
  setGeoFences,
  flyTo,
}: {
  endpoint: ApiEndpoint;
  setEvents: (events: Event[]) => void;
  setGeoFences: (fences: GeoFence[]) => void;
  flyTo: (lat: number, lng: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    Object.fromEntries(
      (endpoint.fields ?? []).map((f) => [f.key, f.defaultValue]),
    ),
  );
  const [response, setResponse] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [coords, setCoords] = useState([
    { lat: "19.5", lon: "-66.0" },
    { lat: "17.5", lon: "-66.0" },
    { lat: "17.5", lon: "-63.0" },
    { lat: "19.5", lon: "-63.0" },
  ]);
  function updateCoord(index: number, field: "lat" | "lon", value: string) {
    setCoords((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  function addCoord() {
    setCoords((prev) => [...prev, { lat: "", lon: "" }]);
  }

  function removeCoord(index: number) {
    if (coords.length <= 3) return;
    setCoords((prev) => prev.filter((_, i) => i !== index));
  }
  function updateField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  async function runEndpoint() {
    setRunning(true);
    setResponse(null);
    try {
      let path = endpoint.path;
      const queryParams: Record<string, string> = {};

      for (const field of endpoint.fields ?? []) {
        if (field.isPathParam) {
          path = path.replace(`:${field.key}`, fieldValues[field.key]);
        } else {
          queryParams[field.key] = fieldValues[field.key];
        }
      }

      let url = path;
      if (Object.keys(queryParams).length > 0) {
        url += "?" + new URLSearchParams(queryParams).toString();
      }

      const options: RequestInit = { method: endpoint.method };
      if (endpoint.body) {
        const mergedBody: Record<string, unknown> = { ...endpoint.body };
        for (const field of endpoint.fields ?? []) {
          if (!field.isPathParam) {
            mergedBody[field.key] = fieldValues[field.key];
          }
        }
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify(mergedBody);
        if (endpoint.hasCoordinates) {
          const coordList = coords.map((c) => ({
            lat: parseFloat(c.lat),
            lon: parseFloat(c.lon),
          }));
          coordList.push(coordList[0]);
          mergedBody.coordinates = coordList;
          options.body = JSON.stringify(mergedBody);
        }
      }

      const res = await fetch(apiUrl(url), options);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();

      if (endpoint.returnsEvents && Array.isArray(data)) {
        setEvents(data);
        setResponse(`${data.length} events loaded onto map`);
      } else if (endpoint.returnsEvents && Array.isArray(data.content)) {
        setEvents(data.content);
        setResponse(`${data.content.length} events loaded onto map`);
      } else if (
        endpoint.returnsEvents &&
        data.locationLat != null &&
        data.locationLong != null
      ) {
        setEvents([data]);
        flyTo(data.locationLat, data.locationLong);
        setResponse(JSON.stringify(data, null, 2));
      } else if (endpoint.returnsEvents) {
        setResponse("No events returned");
      } else if (endpoint.returnsGeoFences && Array.isArray(data.content)) {
        setGeoFences(data.content);
        setResponse(
          `${data.content.length} geo-fences loaded onto map\n\n${JSON.stringify(data.content, null, 2)}`,
        );
      } else if (endpoint.returnsGeoFences && data.id != null) {
        setGeoFences([data]);
        setResponse(
          `Showing geo-fence ${data.id}\n\n${JSON.stringify(data, null, 2)}`,
        );
      } else {
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setResponse("Error: " + (err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: 10,
        background: "#2a2a2a",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${endpoint.method} ${endpoint.path}`}
        className="endpoint-card"
      >
        <span
          className="endpoint-toggle"
          style={{
            color: methodColor(endpoint.method),
          }}
        >
          {endpoint.method}
        </span>
        <code style={{ fontSize: 11, color: "#ddd", flex: 1 }}>
          {endpoint.path}
        </code>
        <span style={{ fontSize: 12, color: "#aaa" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 10px 10px" }}>
          <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 10px" }}>
            {endpoint.description}
          </p>

          {(endpoint.fields ?? []).map((field) => (
            <div key={field.key} style={{ marginBottom: 8 }}>
              <label
                htmlFor={`field-${field.key}`}
                style={{ fontSize: 11, color: "#888", display: "block" }}
              >
                {field.label} —{" "}
                <span style={{ fontStyle: "italic" }}>{field.description}</span>
              </label>
              <input
                id={`field-${field.key}`}
                value={fieldValues[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="endpoint-input"
              />
            </div>
          ))}
          {endpoint.hasCoordinates && (
            <div style={{ marginBottom: 8 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "#888",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Coordinates (first point auto-repeated as last to close the
                polygon)
              </label>
              {coords.map((coord, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 4,
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <input
                    placeholder="lat"
                    value={coord.lat}
                    onChange={(e) => updateCoord(i, "lat", e.target.value)}
                    className="endpoint-input"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <input
                    placeholder="lon"
                    value={coord.lon}
                    onChange={(e) => updateCoord(i, "lon", e.target.value)}
                    className="endpoint-input"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    onClick={() => removeCoord(i)}
                    disabled={coords.length <= 3}
                    style={{
                      cursor: coords.length <= 3 ? "not-allowed" : "pointer",
                      background: "#f93e3e",
                      border: "none",
                      color: "#fff",
                      borderRadius: 4,
                      padding: "2px 6px",
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addCoord}
                style={{
                  marginTop: 4,
                  padding: "3px 10px",
                  background: "#444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                + Add Point
              </button>
            </div>
          )}

          <button
            onClick={runEndpoint}
            disabled={running}
            className="endpoint-run"
            style={{
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "Running..." : "Run"}
          </button>

          {response && <div className="endpoint-response">{response}</div>}
        </div>
      )}
    </div>
  );
}

function methodColor(method: string) {
  switch (method) {
    case "GET":
      return "#61affe";
    case "POST":
      return "#49cc90";
    case "PUT":
      return "#fca130";
    case "DELETE":
      return "#f93e3e";
    default:
      return "#fff";
  }
}

export default EndpointCard;
