import axios from "axios";

// The Sutra backend returns resources directly (no { statusCode, data } envelope) and errors as
// { statusCode, message, error } where message may be a string or a list of validation messages.
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004").replace(/\/$/, "");

const TOKEN_KEY = "sutra_admin_token";
export const USER_KEY = "sutra_admin_user";
// Fired whenever the stored session changes in this tab (other tabs get the native "storage" event)
export const SESSION_EVENT = "sutra-session";
const notify = () => window.dispatchEvent(new Event(SESSION_EVENT));

export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);

export const setSession = (token: string, user: unknown) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
};

export const getCachedUser = <T,>(): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheUser = (user: unknown) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
};

export const clearSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notify();
};

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Expired / revoked session (logout elsewhere, password change, suspension)
    if (error?.response?.status === 401 && typeof window !== "undefined" && !error.config?.url?.includes("/auth/login")) {
      clearSession();
      // Runs outside React (axios interceptor), so a hard redirect is the only option here; it also resets all state
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API / network error */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string; code?: string };
  if (e?.code === "ERR_NETWORK") return `Can't reach the API at ${BASE_URL}. Is the backend running?`;
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return msg || e?.message || fallback;
}

export default api;
