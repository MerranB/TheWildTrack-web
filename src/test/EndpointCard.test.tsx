import { render, screen, fireEvent } from "@testing-library/react";
import EndpointCard from "../components/EndpointCard";
import { endpoints } from "../data/endpoints";

const mockSetEvents = vi.fn();
const mockSetGeoFences = vi.fn();
const mockFlyTo = vi.fn();

// Looked up by path rather than by index so reordering the explorer cards cannot
// silently point these tests at a different endpoint.
function endpointByPath(path: string) {
  const match = endpoints["Movebank Events"].find((e) => e.path === path);
  if (!match) throw new Error(`No endpoint registered for ${path}`);
  return match;
}

const getEventsEndpoint = endpointByPath("/api/v1/events/hotspots");

describe("EndpointCard", () => {
  it("renders method and path", () => {
    render(
      <EndpointCard
        endpoint={getEventsEndpoint}
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        flyTo={mockFlyTo}
      />,
    );
    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/events/hotspots")).toBeInTheDocument();
  });

  it("expands when clicked", () => {
    render(
      <EndpointCard
        endpoint={getEventsEndpoint}
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        flyTo={mockFlyTo}
      />,
    );
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("shows description when expanded", () => {
    render(
      <EndpointCard
        endpoint={getEventsEndpoint}
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        flyTo={mockFlyTo}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(getEventsEndpoint.description)).toBeInTheDocument();
  });

  it("updates field value when typed into", () => {
    const endpointWithField = endpointByPath("/api/v1/events/:id");
    render(
      <EndpointCard
        endpoint={endpointWithField}
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        flyTo={mockFlyTo}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByDisplayValue("1");
    fireEvent.change(input, { target: { value: "42" } });
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
  });

  it("collapses when clicked again", () => {
    render(
      <EndpointCard
        endpoint={getEventsEndpoint}
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        flyTo={mockFlyTo}
      />,
    );
    const toggleButton = screen.getByRole("button", {
      name: /GET \/api\/v1\/events\/hotspots/i,
    });
    fireEvent.click(toggleButton);
    expect(screen.getByText("Run")).toBeInTheDocument();
    fireEvent.click(toggleButton);
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
  });
});
