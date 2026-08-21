import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";

// The prod crash: /api/v1/events/all became a Spring Page, App passed the
// whole object to Map, and `events.filter(...)` threw
// "e.filter is not a function" at mount.
function pageBody(number: number, totalPages: number, size = 2000) {
  const rows = number < totalPages - 1 ? size : 3;
  return {
    content: new Array(rows).fill(null).map((_, i) => ({
      id: number * size + i,
      timestamp: "2015-06-01T00:00:00Z",
      locationLat: 18.4,
      locationLong: -64.6,
      individualId: "bird-1",
      tagId: "tag-1",
    })),
    number,
    size,
    numberOfElements: rows,
    totalElements: (totalPages - 1) * size + 3,
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("App initial load", () => {
  it("renders a paged /events/all response without crashing", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = new URL(String(input), "http://localhost");
        return jsonResponse(
          pageBody(Number(url.searchParams.get("page")), 2),
        );
      });

    render(<App />);

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      new URL(String(fetchMock.mock.calls[0][0]), "http://localhost")
        .searchParams.get("size"),
    ).toBe("2000");
  });

  it("still renders if the endpoint returns a bare array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: 1,
          timestamp: "2015-06-01T00:00:00Z",
          locationLat: 18.4,
          locationLong: -64.6,
          individualId: "bird-1",
          tagId: "tag-1",
        },
      ]),
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces an error instead of crashing when the fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(null, {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
  });
});
