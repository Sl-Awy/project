import { apiRequest, type ApiResponse } from "./client";
import type { AuthUser } from "./auth";

/** Persisted display name / nickname (users.name). */
export function updateNickname(name: string): Promise<ApiResponse<{ user: AuthUser }>> {
  return apiRequest<{ user: AuthUser }>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** Multipart avatar upload (field name must be "avatar"). */
export async function uploadAvatar(file: File): Promise<ApiResponse<{ user: AuthUser }>> {
  const API_URL = import.meta.env.VITE_API_URL || "";
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("avatar", file);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_URL}/api/users/me/avatar`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        success: false,
        data: null as unknown as { user: AuthUser },
        error: body?.error || `Request failed with status ${response.status}`,
      };
    }

    return response.json();
  } catch {
    return {
      success: false,
      data: null as unknown as { user: AuthUser },
      error: "Network error.",
    };
  }
}

export function removeAvatar(): Promise<ApiResponse<{ user: AuthUser }>> {
  return apiRequest<{ user: AuthUser }>("/api/users/me/avatar", { method: "DELETE" });
}
