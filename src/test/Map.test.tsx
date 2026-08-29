import { render, screen } from "@testing-library/react";
import Map from "../components/Map";
import type { Event } from "../types/Event";
import type { Hotspot } from "../types/Hotspot";

// MapLibre renders to a WebGL canvas, which jsdom has no implementation for, so the
// real library cannot run here. These tests assert on what the component asks
// MapLibre to do (which sources and layers it registers, what data it pushes into
// them) rather than on rendered DOM, because there is no DOM to inspect.
const mocks = vi.hoisted(() => ({
  sources: new global.Map<string, { setData: ReturnType<typeof vi.fn> }>(),
  layers: [] as string[],
  markerElements: [] as HTMLElement[],
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  removed: vi.fn(),
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    flyTo = mocks.flyTo;
    fitBounds = mocks.fitBounds;
    remove = mocks.removed;

    on(event: string, ...rest: unknown[]) {
      const handler = rest[rest.length - 1] as () => void;
      // Fire "load" straight away so the component's source registration runs.
      if (event === "load") handler();
      return this;
    }
    off() {
      return this;
    }
    addControl() {
      return this;
    }
    addSource(id: string) {
      mocks.sources.set(id, { setData: vi.fn() });
    }
    addLayer(spec: { id: string }) {
      mocks.layers.push(spec.id);
    }
    getSource(id: string) {
      return mocks.sources.get(id);
    }
    getCanvas() {
      return { style: {} };
    }
    getZoom() {
      return 3;
    }
  }

  class FakeMarker {
    private element?: HTMLElement;
    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element;
    }
    setLngLat() {
      return this;
    }
    addTo() {
      if (this.element) mocks.markerElements.push(this.element);
      return this;
    }
    remove() {
      return this;
    }
    getElement() {
      return this.element ?? document.createElement("div");
    }
  }

  class FakePopup {
    setLngLat() {
      return this;
    }
    setHTML() {
      return this;
    }
    addTo() {
      return this;
    }
  }

  class FakeBounds {
    extend() {
      return this;
    }
  }

  return {
    MapLibreMap: FakeMap,
    Marker: FakeMarker,
    Popup: FakePopup,
    NavigationControl: class {},
    LngLatBounds: FakeBounds,
  };
});

const mockOnMapReady = vi.fn();

const sampleEvents: Event[] = [
  {
    id: 1,
    timestamp: "2015-04-23T11:10:39",
    locationLat: 18.4,
    locationLong: -64.6,
    individualId: "19186173",
    tagId: "19186183",
  },
  {
    id: 2,
    timestamp: "2015-01-16T14:00:35",
    locationLat: 18.3,
    locationLong: -64.5,
    individualId: "19186173",
    tagId: "19186183",
  },
];

const sampleHotspots: Hotspot[] = [
  { lat: 37.41, lon: -6.43, total: 2538111 },
  { lat: 33.19, lon: -117.52, total: 38050 },
  { lat: 19.0, lon: -63.82, total: 2737 },
];

function renderMap(props: Partial<Parameters<typeof Map>[0]> = {}) {
  return render(
    <Map
      events={[]}
      geoFences={[]}
      hotspots={[]}
      loading={false}
      error={null}
      onMapReady={mockOnMapReady}
      {...props}
    />,
  );
}

beforeEach(() => {
  mocks.sources.clear();
  mocks.layers.length = 0;
  mocks.markerElements.length = 0;
  vi.clearAllMocks();
});

describe("Map", () => {
  it("shows loading state", () => {
    renderMap({ loading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading map data...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    renderMap({ error: "Failed to fetch events" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Error: Failed to fetch events"),
    ).toBeInTheDocument();
  });

  it("registers the telemetry tile source and its layer", () => {
    renderMap();
    expect(mocks.sources.has("telemetry")).toBe(true);
    expect(mocks.layers).toContain("telemetry-points");
  });

  // Overlay sources are registered before the tile source precisely so a failure
  // there cannot prevent them existing.
  it("registers the geo-fence and highlight overlays", () => {
    renderMap();
    expect(mocks.sources.has("geofences")).toBe(true);
    expect(mocks.sources.has("highlights")).toBe(true);
    expect(mocks.layers).toEqual(
      expect.arrayContaining([
        "geofence-fill",
        "geofence-outline",
        "highlight-points",
      ]),
    );
  });

  it("pushes query results into the highlight source", () => {
    renderMap({ events: sampleEvents });

    const highlights = mocks.sources.get("highlights");
    expect(highlights?.setData).toHaveBeenCalled();

    const collection = highlights?.setData.mock.lastCall?.[0];
    expect(collection.features).toHaveLength(sampleEvents.length);
  });

  it("filters out events with null coordinates", () => {
    renderMap({
      events: [
        ...sampleEvents,
        {
          id: 3,
          timestamp: "2015-01-01T00:00:00",
          locationLat: null as unknown as number,
          locationLong: null as unknown as number,
          individualId: "bad",
          tagId: "bad",
        },
      ],
    });

    const collection =
      mocks.sources.get("highlights")?.setData.mock.lastCall?.[0];
    expect(collection.features).toHaveLength(2);
  });

  it("flies to the query results so they are not rendered off-screen", () => {
    renderMap({ events: sampleEvents });
    expect(mocks.fitBounds).toHaveBeenCalled();
  });

  it("renders one hotspot pin per region, labelled with a compact count", () => {
    renderMap({ hotspots: sampleHotspots });

    expect(mocks.markerElements).toHaveLength(sampleHotspots.length);
    expect(mocks.markerElements.map((el) => el.textContent)).toEqual([
      "2.5M",
      "38k",
      "3k",
    ]);
  });

  it("zooms to a hotspot when its pin is clicked", () => {
    renderMap({ hotspots: sampleHotspots });

    mocks.markerElements[0].click();

    expect(mocks.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-6.43, 37.41] }),
    );
  });
});
