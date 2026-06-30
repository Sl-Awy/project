// Empty default = same-origin: in production the PHP server serves both the SPA
// and /api; in dev the Vite proxy forwards /api (and /uploads) to the backend.
const API_URL = import.meta.env.VITE_API_URL || "";

/** JSON API helper (attaches bearer token when logged in) */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return {
      success: false,
      data: null as T,
      error: body?.error || `Request failed with status ${response.status}`,
    };
  }

  return response.json();
}
