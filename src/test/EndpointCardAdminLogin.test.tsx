import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EndpointCard from "../components/EndpointCard";
import { endpoints } from "../data/endpoints";
import { clearToken, isLoggedIn } from "../auth";

const mockSetEvents = vi.fn();
const mockSetGeoFences = vi.fn();
const mockFlyTo = vi.fn();

const updateDatabase = endpoints["Movebank Events"].find(
  (e) => e.path === "/api/v1/events/updateDatabase",
)!;

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

function unauthorized() {
  return jsonResponse(
    { detail: "Unauthorized" },
    { ok: false, status: 401, statusText: "Unauthorized" },
  );
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
    screen.getByRole("button", { name: /POST \/api\/v1\/events\/updateDatabase/i }),
  );
}

async function runAndReachLogin() {
  renderCard();
  fireEvent.click(screen.getByText("Run"));
  return waitFor(() => screen.getByLabelText("Admin password"));
}

async function logIn(password: string) {
  fireEvent.change(screen.getByLabelText("Admin username"), {
    target: { value: "admin" },
  });
  fireEvent.change(screen.getByLabelText("Admin password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByText("Log in and run"));
}

beforeEach(() => {
  vi.restoreAllMocks();
  // The token is module state, so it would otherwise leak between tests.
  clearToken();
});

describe("admin endpoints", () => {
  it("asks for a login when the API returns 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(unauthorized());

    await runAndReachLogin();

    expect(screen.getByText("Log in and run")).toBeInTheDocument();
  });

  it("exchanges credentials for a token, then retries the original call", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse({ token: "a.b.c", expiresInSeconds: 900 }))
      .mockResolvedValueOnce(jsonResponse({ message: "FULL_SUCCESS for 19186107" }));

    await runAndReachLogin();
    await logIn("correct-horse");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/v1/auth/login");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      username: "admin",
      password: "correct-horse",
    });
  });

  /**
   * The browser never attaches Authorization on its own, so if the retry did not set it the
   * call would 401 again forever.
   */
  it("sends the token as a Bearer header on the retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse({ token: "a.b.c", expiresInSeconds: 900 }))
      .mockResolvedValueOnce(jsonResponse({ message: "FULL_SUCCESS" }));

    await runAndReachLogin();
    await logIn("correct-horse");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const headers = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer a.b.c");
  });

  it("reports the result and closes the form once logged in", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse({ token: "a.b.c", expiresInSeconds: 900 }))
      .mockResolvedValueOnce(jsonResponse({ message: "FULL_SUCCESS for 19186107" }));

    await runAndReachLogin();
    await logIn("correct-horse");

    await waitFor(() =>
      expect(screen.getByText(/FULL_SUCCESS for 19186107/)).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Admin password")).not.toBeInTheDocument();
  });

  it("explains a rejected password without storing a token", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(unauthorized());

    await runAndReachLogin();
    await logIn("wrong");

    await waitFor(() =>
      expect(screen.getByText("Invalid username or password.")).toBeInTheDocument(),
    );
    expect(isLoggedIn()).toBe(false);
  });

  it("explains a lockout rather than showing a bare status code", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(
        jsonResponse({ detail: "Too many" }, { ok: false, status: 429, statusText: "Too Many Requests" }),
      );

    await runAndReachLogin();
    await logIn("wrong");

    await waitFor(() =>
      expect(screen.getByText(/paused for an hour/)).toBeInTheDocument(),
    );
  });

  /**
   * A refused token is a dead token. Keeping it would mean every later call, including public
   * ones, carried a credential the API has already rejected.
   */
  it("discards the token when the API refuses it", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse({ token: "a.b.c", expiresInSeconds: 900 }))
      .mockResolvedValueOnce(jsonResponse({ message: "ok" }));

    await runAndReachLogin();
    await logIn("correct-horse");
    await waitFor(() => expect(isLoggedIn()).toBe(true));

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(unauthorized());
    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => expect(isLoggedIn()).toBe(false));
  });
});
