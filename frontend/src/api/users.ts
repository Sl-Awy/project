import { apiRequest, type ApiResponse } from "./client";

export interface SearchUser {
  id: number;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_following: boolean;
  follows_you: boolean;
}

export function searchUsers(
  q: string,
  limit = 20
): Promise<ApiResponse<SearchUser[]>> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiRequest<SearchUser[]>(`/api/users/search?${params}`);
}

export function followUser(userId: number): Promise<ApiResponse<{ following: boolean }>> {
  return apiRequest(`/api/users/${userId}/follow`, { method: "POST" });
}

export function unfollowUser(userId: number): Promise<ApiResponse<null>> {
  return apiRequest(`/api/users/${userId}/follow`, { method: "DELETE" });
}
