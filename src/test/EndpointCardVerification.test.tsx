import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EndpointCard from "../components/EndpointCard";
import { endpoints } from "../data/endpoints";

const mockSetEvents = vi.fn();
const mockSetGeoFences = vi.fn();
const mockFlyTo = vi.fn();

const createGeoFence = endpoints["Geo-fence"].find(
  (e) => e.path === "/api/v1/geoFence" && e.method === "POST",
)!;

const ACCEPTED_MESSAGE =
  "A 6 digit code has been sent to researcher@wildtrack.com. Add the code to POST /api/v1/verify/geoFence to finish creating the geo-fence.";

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    text: async () => JSON.stringify(body),
  } as Response;
}

/** What the backend returns while the request is parked waiting on a code. */
function acceptedResponse() {
  return jsonResponse({ message: ACCEPTED_MESSAGE }, { status: 202, statusText: "Accepted" });
}

/** A ProblemDetail, which is what the API returns for a rejected code. */
function problemDetail(detail: string) {
  return jsonResponse(
    { type: "about:blank", title: "Bad Request", status: 400, detail },
    { ok: false, status: 400, statusText: "Bad Request" },
  );
}

function renderCard() {
  render(
    <EndpointCard
      endpoint={createGeoFence}
      setEvents={mockSetEvents}
      setGeoFences={mockSetGeoFences}
      flyTo={mockFlyTo}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /POST \/api\/v1\/geoFence/i }),
  );
}

async function runAndReachCodeEntry() {
  renderCard();
  fireEvent.click(screen.getByText("Send verification code"));
  return waitFor(() => screen.getByLabelText("Verification code"));
}

async function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText("Verification code"), {
    target: { value: code },
  });
  fireEvent.click(screen.getByText("Run"));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("geo-fence creation with email verification", () => {
  it("asks for a code when the API parks the request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(acceptedResponse());

    await runAndReachCodeEntry();

    expect(screen.getByText("Run")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ACCEPTED_MESSAGE.slice(0, 30)))).toBeInTheDocument();
  });

  it("posts the code and the email to the endpoint's verify path", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(acceptedResponse())
      .mockResolvedValueOnce(
        jsonResponse({ message: "Email confirmed. Geo-fence 12 has been created." }),
      );

    await runAndReachCodeEntry();
    await enterCode("123456");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [url, options] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/api/v1/verify/geoFence");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({
      email: "researcher@wildtrack.com",
      code: "123456",
    });
  });

  it("reports the created fence once the code is accepted", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(acceptedResponse())
      .mockResolvedValueOnce(
        jsonResponse({ message: "Email confirmed. Geo-fence 12 has been created." }),
      );

    await runAndReachCodeEntry();
    await enterCode("123456");

    await waitFor(() =>
      expect(screen.getByText(/Geo-fence 12 has been created/)).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });

  /**
   * The attempts remaining live in the ProblemDetail's `detail` field. If that ever stopped
   * being surfaced, a mistyped digit would look identical to a cancelled request.
   */
  it("tells the user how many attempts are left after a wrong code", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(acceptedResponse())
      .mockResolvedValueOnce(
        problemDetail("Incorrect code. 4 attempt(s) remaining."),
      );

    await runAndReachCodeEntry();
    await enterCode("000000");

    await waitFor(() =>
      expect(screen.getByText(/4 attempt\(s\) remaining/)).toBeInTheDocument(),
    );
  });

  it("keeps the code field open after a wrong code so the details are not lost", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(acceptedResponse())
      .mockResolvedValueOnce(problemDetail("Incorrect code. 4 attempt(s) remaining."));

    await runAndReachCodeEntry();
    await enterCode("000000");

    await waitFor(() => screen.getByText(/4 attempt\(s\) remaining/));

    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    // The coordinates and email the user typed are still on screen, not reset.
    expect(screen.getByDisplayValue("researcher@wildtrack.com")).toBeInTheDocument();
  });

  it("surfaces an expired code rather than a bare status", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(acceptedResponse())
      .mockResolvedValueOnce(
        problemDetail("That code has expired. Submit the request again to get a new one."),
      );

    await runAndReachCodeEntry();
    await enterCode("123456");

    await waitFor(() =>
      expect(screen.getByText(/That code has expired/)).toBeInTheDocument(),
    );
  });

  it("does not send the code until the user asks", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(acceptedResponse());

    await runAndReachCodeEntry();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("submits the code on Enter", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(acceptedResponse())
      .mockResolvedValueOnce(jsonResponse({ message: "Email confirmed." }));

    await runAndReachCodeEntry();
    const input = screen.getByLabelText("Verification code");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe("labelling", () => {
  /**
   * The first press only mails a code, so calling it Run would promise work the request does
   * not do until the code comes back. Run belongs on the button that actually creates the fence.
   */
  it("labels the first press as sending a code, not running the endpoint", () => {
    renderCard();

    expect(screen.getByText("Send verification code")).toBeInTheDocument();
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
  });

  it("names the action the code will complete", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(acceptedResponse());

    await runAndReachCodeEntry();

    expect(
      screen.getByText(/complete email verification and create the geo-fence/),
    ).toBeInTheDocument();
  });

  it("names the demo action on the demo card", async () => {
    const demo = endpoints["Demo"][0];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(acceptedResponse());

    render(
      <EndpointCard
        endpoint={demo}
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        flyTo={mockFlyTo}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /POST \/api\/v1\/demo/i }));
    fireEvent.click(screen.getByText("Send verification code"));

    await waitFor(() => screen.getByLabelText("Verification code"));
    expect(
      screen.getByText(/complete email verification and trigger the demo/),
    ).toBeInTheDocument();
  });
});

describe("cards without a verify path", () => {
  it("does not ask for a code", async () => {
    const hotspots = endpoints["Movebank Events"].find(
      (e) => e.path === "/api/v1/events/hotspots",
    )!;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse([]));

    render(
      <EndpointCard
        endpoint={hotspots}
        setEvents={mockSetEvents}
        setGeoFences={mockSetGeoFences}
        flyTo={mockFlyTo}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /GET \/api\/v1\/events\/hotspots/i }));
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });
});
