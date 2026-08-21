import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EndpointCard from "../components/EndpointCard";
import { endpoints } from "../data/endpoints";

const mockSetEvents = vi.fn();
const mockSetGeoFences = vi.fn();
const mockFlyTo = vi.fn();

const updateDatabase = endpoints["Movebank Events"].find(
  (e) => e.path === "/api/v1/events/updateDatabase",
)!;

function textResponse(
  body: string,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    text: async () => body,
  } as Response;
}

function renderCard() {
  render(
    <EndpointCard
      endpoint={updateDatabase}
      setEvents={mockSetEvents}
      setGeoFences={mockSetGeoFences}
      flyTo={mockFlyTo}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: /POST \/api\/v1\/events\/updateDatabase/i,
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("updateDatabase status responses", () => {
  it("takes no paging input", () => {
    expect(updateDatabase.paged).toBeUndefined();
    expect(updateDatabase.fields).toHaveLength(0);
  });

  it("makes exactly one request with no query string", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(textResponse('{"message":"FULL_SUCCESS for 2911040"}'));

    renderCard();
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/FULL_SUCCESS/)).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("?");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("shows the message from an ApiResponse body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse('{"message":"FULL_SUCCESS for 2911040"}'),
    );

    renderCard();
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(
        screen.getByText("FULL_SUCCESS for 2911040"),
      ).toBeInTheDocument(),
    );
  });

  it("shows a bare string body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse("FULL_SUCCESS"),
    );

    renderCard();
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText("FULL_SUCCESS")).toBeInTheDocument(),
    );
  });

  it("shows the status line for a 207 partial success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse('{"message":"PARTIAL_SUCCESS for 2911040"}', {
        status: 207,
        statusText: "Multi-Status",
      }),
    );

    renderCard();
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/207 Multi-Status/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/PARTIAL_SUCCESS/)).toBeInTheDocument();
  });

  it("keeps the error body on a 500 instead of only the status line", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse('{"message":"Study 2911040 FAILED - read timed out"}', {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    renderCard();
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/500 Internal Server Error/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/read timed out/)).toBeInTheDocument();
  });

  it("shows the ProblemDetail detail on a 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse(
        '{"title":"Rate Limit Exceeded","detail":"You have exceeded the request limit for this endpoint. Please try again in 24 hours."}',
        { ok: false, status: 429, statusText: "Too Many Requests" },
      ),
    );

    renderCard();
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/429 Too Many Requests/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/try again in 24 hours/)).toBeInTheDocument();
  });

  it("reports a 422 NO_VALID_DATA without throwing away the reason", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse('{"message":"NO_VALID_DATA for 2911040"}', {
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
      }),
    );

    renderCard();
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() =>
      expect(screen.getByText(/NO_VALID_DATA/)).toBeInTheDocument(),
    );
  });
});
