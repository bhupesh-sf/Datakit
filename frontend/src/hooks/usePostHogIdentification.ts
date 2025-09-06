import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAnalytics } from './useAnalytics';
import { useConsentManager } from '@/components/common/ConsentPopup';

/**
 * Hook that automatically identifies users in PostHog when they log in
 * and resets identification when they log out.
 * Only identifies users if analytics consent has been given.
 */
export const usePostHogIdentification = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { identifyUser, resetUser, track } = useAnalytics();
  const { analyticsEnabled } = useConsentManager();

  useEffect(() => {
    if (isAuthenticated && user && analyticsEnabled) {
      // Identify the user in PostHog
      identifyUser(user.id, {
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        subscription_tier: user.subscription_tier || 'free',
        workspace_count: user.workspace_count || 0,
      });

      // Track login event
      track({
        name: 'user_logged_in',
        props: {
          method: 'email',
          subscription_tier: user.subscription_tier || 'free',
        },
      });
    } else if (!isAuthenticated && !user) {
      // User logged out - reset PostHog identification
      resetUser();
      
      track({
        name: 'user_logged_out',
        props: {},
      });
    }
  }, [isAuthenticated, user, analyticsEnabled, identifyUser, resetUser, track]);
};