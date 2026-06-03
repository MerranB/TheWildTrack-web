import { render, screen } from "@testing-library/react";
import Map from "../components/Map";
import type { Event } from "../types/Event";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  Polygon: () => <div data-testid="polygon" />,
  useMap: () => ({ flyTo: vi.fn() }),
}));

vi.mock("react-leaflet-cluster", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cluster-group">{children}</div>
  ),
}));

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

describe("Map", () => {
  it("shows loading state", () => {
    render(
      <Map
        events={[]}
        geoFences={[]}
        loading={true}
        error={null}
        onMapReady={mockOnMapReady}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading map data...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(
      <Map
        events={[]}
        geoFences={[]}
        loading={false}
        error="Failed to fetch events"
        onMapReady={mockOnMapReady}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error: Failed to fetch events")).toBeInTheDocument();
  });

  it("renders map container when loaded", () => {
    render(
      <Map
        events={sampleEvents}
        geoFences={[]}
        loading={false}
        error={null}
        onMapReady={mockOnMapReady}
      />,
    );
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("renders a marker for each event", () => {
    render(
      <Map
        events={sampleEvents}
        geoFences={[]}
        loading={false}
        error={null}
        onMapReady={mockOnMapReady}
      />,
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(sampleEvents.length);
  });

  it("filters out events with null coordinates", () => {
    const eventsWithNull: Event[] = [
      ...sampleEvents,
      {
        id: 3,
        timestamp: "2015-01-01T00:00:00",
        locationLat: null as unknown as number,
        locationLong: null as unknown as number,
        individualId: "bad",
        tagId: "bad",
      },
    ];
    render(
      <Map
        events={eventsWithNull}
        geoFences={[]}
        loading={false}
        error={null}
        onMapReady={mockOnMapReady}
      />,
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });
});
