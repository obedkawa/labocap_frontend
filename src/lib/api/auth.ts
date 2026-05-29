import apiClient from "./client";
import {
  LoginRequest,
  LoginResponse,
  TwoFactorRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  User,
} from "@/types/auth";

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>("/auth/login", data),

  twoFactor: (data: TwoFactorRequest) =>
    apiClient.post<LoginResponse>("/auth/2fa/challenge", data),

  logout: () => apiClient.post("/auth/logout"),

  refresh: () => apiClient.post("/auth/refresh"),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post("/auth/forgot-password", data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post("/auth/reset-password", data),

  me: () => apiClient.get<User>("/auth/me"),

  resendTwoFactor: (email: string) =>
    apiClient.post("/auth/resend-2fa", { email }),
};
