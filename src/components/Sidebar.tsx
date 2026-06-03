import { endpoints } from "../data/endpoints";
import type { Event } from "../types/Event";
import EndpointCard from "./EndpointCard";
import "./Sidebar.css";
import type { GeoFence } from "../types/GeoFence";

interface SidebarProps {
  setEvents: (events: Event[]) => void;
  setGeoFences: (fences: GeoFence[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  flyTo: (lat: number, lng: number) => void;
}

function Sidebar({
  setEvents,
  setGeoFences,
  isOpen,
  onToggle,
  flyTo,
}: SidebarProps) {
  return (
    <>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="api-sidebar"
        className="sidebar-toggle"
      >
        {isOpen ? "Close API Explorer" : "Open API Explorer"}
      </button>

      {isOpen && (
        <div id="api-sidebar" className="api-sidebar">
          <h2 style={{ marginTop: 48, marginBottom: 16 }}>API Explorer</h2>
          {Object.entries(endpoints).map(([group, items]) => (
            <div key={group} style={{ marginBottom: 20 }}>
              <h3
                style={{
                  borderBottom: "1px solid #444",
                  paddingBottom: 4,
                  marginBottom: 8,
                }}
              >
                {group}
              </h3>
              {items.map((endpoint) => (
                <EndpointCard
                  key={endpoint.path + endpoint.method}
                  endpoint={endpoint}
                  setEvents={setEvents}
                  setGeoFences={setGeoFences}
                  flyTo={flyTo}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default Sidebar;
