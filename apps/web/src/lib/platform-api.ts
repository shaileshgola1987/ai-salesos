import { API_URL, ApiError } from "./api";

// Deliberately a separate localStorage key from the org-user session (see lib/api.ts) — a
// platform admin's token and an Organization user's token are unrelated credentials and
// must never be confused or overwrite one another in the same browser.
const PLATFORM_TOKEN_KEY = "ai-salesos-platform-token";

export function getPlatformToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformToken(token: string) {
  window.localStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function clearPlatformToken() {
  window.localStorage.removeItem(PLATFORM_TOKEN_KEY);
}

export async function platformApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getPlatformToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? "Request failed");
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
