import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EndpointCard from "../components/EndpointCard";
import { endpoints } from "../data/endpoints";
import type { ApiEndpoint } from "../types/ApiEndpoint";

const mockSetEvents = vi.fn();
const mockSetGeoFences = vi.fn();
const mockFlyTo = vi.fn();

const movebank = endpoints["Movebank Events"];
const pagedEvents = movebank.find(
  (e) => e.path === "/api/v1/events/allDataPointsByRange",
)!;
const byBox = movebank.find(
  (e) => e.path === "/api/v1/events/allDataPointsByBox",
)!;
const geoFences = endpoints["Geo-fence"].find(
  (e) => e.path === "/api/v1/geoFence" && e.method === "GET",
)!;

function page(number: number, totalPages: number, size = 2000) {
  const rows = number < totalPages - 1 ? size : 137;
  return {
    content: new Array(rows).fill(null).map((_, i) => ({
      id: number * size + i,
      locationLat: 18.4,
      locationLong: -64.6,
    })),
    number,
    size,
    numberOfElements: rows,
    totalElements: (totalPages - 1) * size + 137,
    totalPages,
    last: number === totalPages - 1,
  };
}

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    ...init,
  } as Response;
}

function renderCard(endpoint: ApiEndpoint) {
  render(
    <EndpointCard
      endpoint={endpoint}
      setEvents={mockSetEvents}
      setGeoFences={mockSetGeoFences}
      flyTo={mockFlyTo}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`${endpoint.method} ${endpoint.path}`, "i"),
    }),
  );
}

function paramsOf(call: unknown[]) {
  return new URL(String(call[0]), "http://localhost").searchParams;
}

function servePages(totalPages: number) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      jsonResponse(
        page(Number(paramsOf([input]).get("page")), totalPages),
      ),
    );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("paged endpoints", () => {
  it("every endpoint returning a Page is marked paged with a size of 2000", () => {
    const paged = Object.values(endpoints)
      .flat()
      .filter((e) => e.paged);

    // updateDatabase is deliberately absent because it returns a status message,
    // not a Page.
    expect(paged.map((e) => e.path).sort()).toEqual([
      "/api/v1/analysis/query",
      "/api/v1/events/allDataPointsByBox",
      "/api/v1/events/allDataPointsByRange",
      "/api/v1/geoFence",
    ]);

    for (const e of paged) {
      expect(e.fields.find((f) => f.key === "size")?.defaultValue).toBe("2000");
      expect(e.fields.find((f) => f.key === "page")?.defaultValue).toBe("0");
    }
  });

  it("requests successive pages until the API reports the last one", async () => {
    const fetchMock = servePages(3);

    renderCard(pagedEvents);
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/events loaded onto map/)).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((c) => paramsOf(c).get("page"))).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(fetchMock.mock.calls.map((c) => paramsOf(c).get("size"))).toEqual([
      "2000",
      "2000",
      "2000",
    ]);
  });

  it("concatenates every page onto the map for event endpoints", async () => {
    servePages(3);

    renderCard(pagedEvents);
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/events loaded onto map/)).toBeInTheDocument(),
    );

    // 2 full pages of 2000 plus a final partial page of 137
    expect(mockSetEvents).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 0 })]),
    );
    expect(mockSetEvents.mock.lastCall![0]).toHaveLength(4137);
    expect(
      screen.getByText(/4,137 events loaded onto map from 3 page\(s\) of 2000/),
    ).toBeInTheDocument();
  });

  it("keeps the endpoint's own query params while paging", async () => {
    const fetchMock = servePages(2);

    renderCard(byBox);
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/events loaded onto map/)).toBeInTheDocument(),
    );

    const params = paramsOf(fetchMock.mock.calls[1]);
    expect(params.get("minLat")).toBe("18.3");
    expect(params.get("maxLon")).toBe("-64.4");
    expect(params.get("page")).toBe("1");
  });

  it("resumes from the Start Page field", async () => {
    const fetchMock = servePages(3);

    renderCard(pagedEvents);
    fireEvent.change(screen.getByDisplayValue("0"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/events loaded onto map/)).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("pages geo-fences onto the map too", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        content: [{ id: 1, name: "Tortola Zone", coordinates: [] }],
        number: 0,
        totalPages: 1,
        totalElements: 1,
        last: true,
      }),
    );

    renderCard(geoFences);
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/geo-fences loaded onto map/)).toBeInTheDocument(),
    );
    expect(mockSetGeoFences.mock.lastCall![0]).toHaveLength(1);
  });

  it("keeps what it fetched and reports where to resume when rate limited", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const n = Number(paramsOf([input]).get("page"));
      if (n === 2) {
        return jsonResponse(null, {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        });
      }
      return jsonResponse(page(n, 10));
    });

    renderCard(pagedEvents);
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/429 rate limited/)).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Re-run with Start Page 2 to resume/),
    ).toBeInTheDocument();
    expect(mockSetEvents.mock.lastCall![0]).toHaveLength(4000);
  });

  it("stops on an empty page when the response omits `last`", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const n = Number(paramsOf([input]).get("page"));
        return jsonResponse({ content: n < 2 ? new Array(2000).fill({}) : [] });
      });

    renderCard(pagedEvents);
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/events loaded onto map/)).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
