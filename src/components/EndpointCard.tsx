import { useState } from "react";
import type { ApiEndpoint } from "../types/ApiEndpoint";
import type { Event } from "../types/Event";
import type { GeoFence } from "../types/GeoFence";
import { apiUrl } from "../api";
import { authorizedFetch, login } from "../auth";
import type { PageResult } from "../paging";
import {
  DEFAULT_PAGE_SIZE,
  MAX_MAPPED_ROWS,
  PagingError,
  fetchAllPages,
} from "../paging";

function statusMessage(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean")
    return String(data);
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    for (const key of ["message", "detail", "error"]) {
      if (typeof body[key] === "string") return body[key];
    }
  }
  return null;
}

/** Parses a response body that may be JSON or plain text. */
async function readBody(res: Response): Promise<unknown> {
  const raw = await res.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

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
  const [needsLogin, setNeedsLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
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

  function buildRequest(overrides?: Record<string, string>) {
    let path = endpoint.path;
    const queryParams: Record<string, string> = {};

    for (const field of endpoint.fields ?? []) {
      const value = overrides?.[field.key] ?? fieldValues[field.key];
      if (field.isPathParam) {
        path = path.replace(`:${field.key}`, value);
      } else {
        queryParams[field.key] = value;
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
          mergedBody[field.key] =
            overrides?.[field.key] ?? fieldValues[field.key];
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

    return { url, options };
  }

  async function runEndpoint() {
    if (endpoint.paged) return runPaged();

    setRunning(true);
    setResponse(null);
    try {
      const { url, options } = buildRequest();
      const res = await authorizedFetch(apiUrl(url), options);

      if (res.status === 401) {
        setNeedsLogin(true);
        setResponse("This endpoint is admin only. Log in below to run it.");
        return;
      }

      const data = await readBody(res);
      const message = statusMessage(data);

      // 202 means the request is parked until the address confirms it.
      if (res.status === 202 && endpoint.verifyPath) {
        setNeedsCode(true);
        setCodeError(null);
        setResponse(message ?? "Check your email for a 6 digit code.");
        return;
      }

      if (!res.ok) {
        setResponse(
          `Error ${res.status} ${res.statusText}` +
            (message ? `\n\n${message}` : ""),
        );
        return;
      }

      // 2xx status-only response, e.g. updateDatabase's ingestion result.
      if (message !== null) {
        setResponse(
          res.status === 200
            ? message
            : `${res.status} ${res.statusText}\n\n${message}`,
        );
        return;
      }

      const body = (data ?? {}) as {
        content?: unknown[];
        id?: unknown;
        locationLat?: number;
        locationLong?: number;
      };

      if (endpoint.returnsEvents && Array.isArray(data)) {
        setEvents(data as Event[]);
        setResponse(`${data.length} events loaded onto map`);
      } else if (endpoint.returnsEvents && Array.isArray(body.content)) {
        setEvents(body.content as Event[]);
        setResponse(`${body.content.length} events loaded onto map`);
      } else if (
        endpoint.returnsEvents &&
        body.locationLat != null &&
        body.locationLong != null
      ) {
        setEvents([body as unknown as Event]);
        flyTo(body.locationLat, body.locationLong);
        setResponse(JSON.stringify(data, null, 2));
      } else if (endpoint.returnsEvents) {
        setResponse("No events returned");
      } else if (endpoint.returnsGeoFences && Array.isArray(body.content)) {
        setGeoFences(body.content as GeoFence[]);
        setResponse(
          `${body.content.length} geo-fences loaded onto map\n\n${JSON.stringify(body.content, null, 2)}`,
        );
      } else if (endpoint.returnsGeoFences && body.id != null) {
        setGeoFences([body as unknown as GeoFence]);
        setResponse(
          `Showing geo-fence ${body.id}\n\n${JSON.stringify(data, null, 2)}`,
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

  async function runPaged() {
    setRunning(true);
    setResponse(null);

    const size = fieldValues.size?.trim() || String(DEFAULT_PAGE_SIZE);
    const startPage = Math.max(0, parseInt(fieldValues.page, 10) || 0);
    const noun = endpoint.returnsGeoFences
      ? "geo-fences"
      : endpoint.returnsEvents
        ? "events"
        : "rows";

    const mapped = endpoint.returnsEvents || endpoint.returnsGeoFences;

    function publish(result: PageResult<unknown>) {
      if (endpoint.returnsEvents) setEvents(result.content as Event[]);
      else if (endpoint.returnsGeoFences)
        setGeoFences(result.content as GeoFence[]);
    }

    try {
      const result = await fetchAllPages<unknown>({
        buildRequest: (page) => buildRequest({ page: String(page), size }),
        startPage,
        maxRows: mapped ? MAX_MAPPED_ROWS : Infinity,
        onPage: (progress) =>
          setResponse(
            `Fetching page ${progress.nextPage} of ${progress.totalPages ?? "?"}, ${progress.content.length.toLocaleString()}${progress.totalElements != null ? ` of ${progress.totalElements.toLocaleString()}` : ""} ${noun} so far...`,
          ),
      });

      publish(result);
      setResponse(
        [
          mapped
            ? `${result.content.length.toLocaleString()} ${noun} loaded onto map from ${result.pagesDone} page(s) of ${size}.`
            : `Ingestion ${result.capped ? "stopped early" : "complete"} after ${result.pagesDone} page(s) of ${size}.`,
          result.totalElements != null
            ? `API reported ${result.totalElements.toLocaleString()} total ${noun}.`
            : null,
          result.capped
            ? `${result.capped} Re-run with Start Page ${result.nextPage} to continue.`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (err) {
      if (err instanceof PagingError && err.status === 401) {
        setNeedsLogin(true);
        setResponse("This endpoint is admin only. Log in below to run it.");
        return;
      }

      const partial =
        err instanceof PagingError
          ? (err.partial as PageResult<unknown>)
          : null;
      if (partial?.content.length) publish(partial);

      setResponse(
        `Error: ${(err as Error).message}\n\nKept ${(partial?.content.length ?? 0).toLocaleString()} ${noun} from ${partial?.pagesDone ?? 0} page(s) before stopping. Re-run with Start Page ${partial?.nextPage ?? startPage} to resume.`,
      );
    } finally {
      setRunning(false);
    }
  }

  /**
   * A deferred endpoint does not do its work on the first press, it only mails a code. Calling
   * that button "Run" would promise something the request does not deliver until confirmation.
   */
  function runLabel() {
    if (!endpoint.verifyPath) return running ? "Running..." : "Run";
    return running ? "Sending..." : "Send verification code";
  }

  async function submitCode() {
    if (!endpoint.verifyPath) return;

    setConfirming(true);
    setCodeError(null);
    try {
      const res = await authorizedFetch(apiUrl(endpoint.verifyPath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fieldValues.email, code }),
      });
      const message = statusMessage(await readBody(res));

      if (!res.ok) {
        // The API says how many attempts are left, so surface it rather than a bare status.
        setCodeError(message ?? `Error ${res.status} ${res.statusText}`);
        return;
      }

      setNeedsCode(false);
      setCode("");
      setResponse(message ?? "Confirmed.");
    } catch (err) {
      setCodeError((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  async function submitLogin() {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await login(username, password);
      // The password has done its job. Only the token it returned is kept.
      setPassword("");
      setNeedsLogin(false);
      await runEndpoint();
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setLoggingIn(false);
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
        {endpoint.adminOnly && (
          <span
            title="Requires an admin login"
            style={{
              fontSize: 9,
              color: "#fca130",
              border: "1px solid #fca130",
              borderRadius: 3,
              padding: "1px 4px",
              flexShrink: 0,
            }}
          >
            ADMIN
          </span>
        )}
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
                {field.label}:{" "}
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

          {needsCode && (
            <div
              style={{
                border: "1px solid #49cc90",
                borderRadius: 4,
                padding: 8,
                marginBottom: 8,
              }}
            >
              <p style={{ fontSize: 11, color: "#49cc90", margin: "0 0 6px" }}>
                Please enter the 6 digit code sent to {fieldValues.email} to
                complete email verification and {endpoint.verifyAction}.
              </p>
              <input
                aria-label="Verification code"
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code) submitCode();
                }}
                className="endpoint-input"
                style={{ marginBottom: 6 }}
              />
              <button
                onClick={submitCode}
                disabled={confirming || !code}
                className="endpoint-run"
                style={{ cursor: confirming ? "not-allowed" : "pointer" }}
              >
                {confirming ? "Running..." : "Run"}
              </button>
              {codeError && (
                <p style={{ fontSize: 11, color: "#f93e3e", margin: "6px 0 0" }}>
                  {codeError}
                </p>
              )}
            </div>
          )}

          {needsLogin && (
            <div
              style={{
                border: "1px solid #fca130",
                borderRadius: 4,
                padding: 8,
                marginBottom: 8,
              }}
            >
              <p style={{ fontSize: 11, color: "#fca130", margin: "0 0 6px" }}>
                Admin login required. The password is sent once to get a token
                that lasts 15 minutes, and is not stored by this page.
              </p>
              <input
                aria-label="Admin username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="endpoint-input"
                style={{ marginBottom: 4 }}
              />
              <input
                aria-label="Admin password"
                placeholder="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && username && password) submitLogin();
                }}
                className="endpoint-input"
                style={{ marginBottom: 6 }}
              />
              <button
                onClick={submitLogin}
                disabled={loggingIn || !username || !password}
                className="endpoint-run"
                style={{ cursor: loggingIn ? "not-allowed" : "pointer" }}
              >
                {loggingIn ? "Logging in..." : "Log in and run"}
              </button>
              {loginError && (
                <p style={{ fontSize: 11, color: "#f93e3e", margin: "6px 0 0" }}>
                  {loginError}
                </p>
              )}
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
            {runLabel()}
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
