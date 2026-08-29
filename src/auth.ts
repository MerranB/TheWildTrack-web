import { apiUrl } from "./api";

/**
 * The admin token lives here and nowhere else: a module variable, held only for as long as
 * the tab stays open. It is deliberately not in localStorage, sessionStorage or a cookie,
 * so a refresh discards it and nothing can read it back later.
 */
let token: string | null = null;
let expiresAt = 0;

interface LoginResponse {
  token: string;
  expiresInSeconds: number;
}

export function clearToken() {
  token = null;
  expiresAt = 0;
}

export function getToken(): string | null {
  if (token && Date.now() >= expiresAt) clearToken();
  return token;
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

/**
 * Exchanges credentials for a short-lived token. The password is used for this one request
 * and never stored: only the token it returns is kept.
 */
export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (res.status === 401) {
    throw new Error("Invalid username or password.");
  }
  if (res.status === 429) {
    throw new Error(
      "Too many failed attempts. Logins from this address are paused for an hour.",
    );
  }
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as LoginResponse;
  token = body.token;
  // Retire the token slightly early so a call cannot be sent with one that expires in flight.
  expiresAt = Date.now() + (body.expiresInSeconds - 30) * 1000;
}

/**
 * Sends the admin token when one is held. The browser never attaches this header by itself,
 * which is what makes the API safe to run without CSRF tokens.
 */
export async function authorizedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const current = getToken();
  const headers = new Headers(options.headers);
  if (current) headers.set("Authorization", `Bearer ${current}`);

  const res = await fetch(url, { ...options, headers });

  // A refused token is a dead token. Drop it so the next run asks for a fresh login rather
  // than resending something the API has already rejected.
  if (res.status === 401) clearToken();

  return res;
}
