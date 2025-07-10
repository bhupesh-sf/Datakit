import apiClient from './apiClient';
import { User, UpdateProfileData, UserSettings } from '@/types/auth';

interface CreditUsage {
  id: string;
  userId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCredits: number;
  timestamp: string;
  metadata?: any;
}

interface CreditStats {
  totalUsed: number;
  remaining: number;
  usageByProvider: Record<string, number>;
  usageByModel: Record<string, number>;
  dailyUsage: Array<{ date: string; credits: number }>;
}

class UserService {
  async getProfile(): Promise<User> {
    return apiClient.get<User>('/users/profile');
  }

  async updateProfile(data: UpdateProfileData): Promise<User> {
    return apiClient.patch<User>('/users/profile', data);
  }

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/users/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async deleteAccount(password: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>('/users/account', {
      body: JSON.stringify({ password }),
    });
  }

  // Settings management
  async getSettings(): Promise<UserSettings> {
    return apiClient.get<UserSettings>('/users/settings');
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    return apiClient.patch<UserSettings>('/users/settings', settings);
  }

  // Credit management
  async getCreditUsage(
    startDate?: string,
    endDate?: string,
    limit?: number
  ): Promise<CreditUsage[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', limit.toString());

    const queryString = params.toString();
    return apiClient.get<CreditUsage[]>(
      `/credits/usage${queryString ? `?${queryString}` : ''}`
    );
  }

  async getCreditStats(): Promise<CreditStats> {
    return apiClient.get<CreditStats>('/credits/stats');
  }

  async checkCredits(
    model: string,
    estimatedTokens: number
  ): Promise<{
    hasEnoughCredits: boolean;
    creditsNeeded: number;
    creditsAvailable: number;
  }> {
    return apiClient.post('/credits/check', {
      model,
      estimatedTokens,
    });
  }

  // Subscription management
  async getCurrentSubscription(): Promise<any> {
    return apiClient.get('/subscriptions/current');
  }

  async createCheckoutSession(priceId: string): Promise<{ url: string }> {
    return apiClient.post('/subscriptions/create-checkout-session', {
      priceId,
    });
  }

  async createPortalSession(): Promise<{ url: string }> {
    return apiClient.post('/subscriptions/create-portal-session');
  }

  async cancelSubscription(): Promise<any> {
    return apiClient.post('/subscriptions/cancel');
  }

  async joinWaitlist(
    email: string,
    featureName: string
  ): Promise<{ message: string }> {
    return apiClient.post('/waitlist/signup', {
      email,
      featureName,
    });
  }

  async getMyWaitlistEntries(): Promise<any[]> {
    return apiClient.get('/waitlist/my-entries');
  }
}

export const userService = new UserService();
export default userService;
