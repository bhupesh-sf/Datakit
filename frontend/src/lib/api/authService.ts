import apiClient from "./apiClient";
import {
  LoginCredentials,
  SignupCredentials,
  AuthResponse,
  User,
} from "@/types/auth";

class AuthService {
  async checkAuthStatus(): Promise<boolean> {
    try {
      // Check auth status without triggering auth flow
      const response = await apiClient.get<{ authenticated: boolean }>(
        "/auth/status",
        {
          skipAuth: true,
        }
      );
      return response?.authenticated;
    } catch (error) {
      return false;
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>("/auth/login", credentials, {
      skipAuth: true,
    });
  }

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>("/auth/signup", credentials, {
      skipAuth: true,
    });
  }

  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>("/auth/me");
  }

  async logout(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      "/auth/logout",
      {},
      { skipAuth: true }
    );
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      "/auth/password-reset",
      { email },
      { skipAuth: true }
    );
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      "/auth/password-reset/confirm",
      { token, newPassword },
      { skipAuth: true }
    );
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      "/auth/verify-email",
      { token },
      { skipAuth: true }
    );
  }

  async resendVerificationEmail(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/auth/resend-verification");
  }
}

export const authService = new AuthService();
export default authService;
