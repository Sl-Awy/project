import { apiRequest } from "./client";

export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  role?: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface SignupResponse {
  message: string;
}

interface MeResponse {
  user: AuthUser;
}

// Authentication: issue session token after verifying password
export function login(email: string, password: string) {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Registration: create account (user signs up with email + password)
export function signup(email: string, password: string, confirmPassword: string) {
  return apiRequest<SignupResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, confirm_password: confirmPassword }),
  });
}

export function logout() {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

// Restore session from stored bearer token
export function checkAuth() {
  return apiRequest<MeResponse>("/api/auth/me");
}
