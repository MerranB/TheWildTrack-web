import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import type { Hotspot } from "../types/Hotspot";

// App used to walk every page of /api/v1/events/all on mount and hand the result to
// the map. That is gone. The map now renders the whole dataset from server-generated
// vector tiles, so the only thing App fetches at startup is the hotspot summary that
// tells a visitor where to look.
//
// The original test here guarded a production crash: /events/all became a Spring
// Page, App passed the whole object to Map, and `events.filter(...)` threw at mount.
// The shape is different now but the guarantee is the same: a bad or missing
// response from the initial load must never take the app down with it.

// Map is stubbed because MapLibre needs a WebGL context that jsdom does not provide.
// The stub still renders the error branch and reports what it was handed, so these
// tests can check App wires the fetch result through. Map's own behaviour is covered
// in Map.test.tsx.
const mapProps = vi.hoisted(() => ({ current: null as { error: string | null; hotspots: Hotspot[] } | null }));

vi.mock("../components/Map", () => ({
  default: (props: { error: string | null; hotspots: Hotspot[] }) => {
    mapProps.current = props;
    return props.error ? (
      <div role="alert">Error: {props.error}</div>
    ) : (
      <div data-testid="map" />
    );
  },
}));

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    ...init,
  } as Response;
}

const hotspots: Hotspot[] = [
  { lat: 37.41, lon: -6.43, total: 2538111 },
  { lat: 33.19, lon: -117.52, total: 38050 },
];

beforeEach(() => {
  mapProps.current = null;
  vi.restoreAllMocks();
});

describe("App initial load", () => {
  it("fetches the hotspot summary once on mount and passes it to the map", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(hotspots));

    render(<App />);

    await waitFor(() => expect(mapProps.current?.hotspots).toEqual(hotspots));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/events/hotspots",
    );
  });

  it("does not fetch the bulk events endpoint on mount", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(hotspots));

    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Loading the whole dataset into the browser is what the tile layer exists to avoid.
    const requested = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requested.some((url) => url.includes("/events/all"))).toBe(false);
  });

  it("still renders when the hotspot request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("map")).toBeInTheDocument());
    expect(mapProps.current?.hotspots).toEqual([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("still renders when the hotspot endpoint returns a non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(null, { ok: false, status: 500, statusText: "Server Error" }),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("map")).toBeInTheDocument());
    expect(mapProps.current?.hotspots).toEqual([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
