import { apiRequest } from "./client";

interface LoginResponse {
  token: string;
  user: { id: number; email: string; role?: string };
}

interface SignupResponse {
  message: string;
}

interface MeResponse {
  user: { id: number; email: string; role?: string };
}

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signup(email: string, password: string, confirmPassword: string) {
  return apiRequest<SignupResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, confirm_password: confirmPassword }),
  });
}

export function logout() {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

export function checkAuth() {
  return apiRequest<MeResponse>("/api/auth/me");
}
