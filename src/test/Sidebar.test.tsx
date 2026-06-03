import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "../components/Sidebar";

const mockSetEvents = vi.fn();
const mockSetGeoFences = vi.fn();
const mockFlyTo = vi.fn();
const mockOnToggle = vi.fn();

describe("Sidebar", () => {
  it("shows open button when closed", () => {
    render(
      <Sidebar
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        isOpen={false}
        onToggle={mockOnToggle}
        flyTo={mockFlyTo}
      />,
    );
    expect(screen.getByText("Open API Explorer")).toBeInTheDocument();
    expect(screen.queryByText("Close API Explorer")).not.toBeInTheDocument();
  });

  it("shows close button when open", () => {
    render(
      <Sidebar
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        isOpen={true}
        onToggle={mockOnToggle}
        flyTo={mockFlyTo}
      />,
    );
    expect(screen.getByText("Close API Explorer")).toBeInTheDocument();
    expect(screen.queryByText("Open API Explorer")).not.toBeInTheDocument();
  });

  it("calls onToggle when button is clicked", () => {
    render(
      <Sidebar
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        isOpen={false}
        onToggle={mockOnToggle}
        flyTo={mockFlyTo}
      />,
    );
    fireEvent.click(screen.getByText("Open API Explorer"));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it("shows endpoint groups when open", () => {
    render(
      <Sidebar
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        isOpen={true}
        onToggle={mockOnToggle}
        flyTo={mockFlyTo}
      />,
    );
    expect(screen.getByText("Movebank Events")).toBeInTheDocument();
    expect(screen.getByText("Natural Language Query")).toBeInTheDocument();
    expect(screen.getByText("Geo-fence")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  it("hides endpoint groups when closed", () => {
    render(
      <Sidebar
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        isOpen={false}
        onToggle={mockOnToggle}
        flyTo={mockFlyTo}
      />,
    );
    expect(screen.queryByText("Movebank Events")).not.toBeInTheDocument();
  });

  it("has correct aria-expanded on toggle button", () => {
    render(
      <Sidebar
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        isOpen={false}
        onToggle={mockOnToggle}
        flyTo={mockFlyTo}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });
});
