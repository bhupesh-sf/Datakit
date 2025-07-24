import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import SignupPromptPopup from '@/components/auth/SignupPromptPopup';

const PROMPT_DELAY_MS = 50000; // 50 seconds
const PROMPT_DISMISSED_KEY = 'datakit-signup-prompt-dismissed';

export const useSignupPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { isInIframe } = useAppStore();

  useEffect(() => {
    // Don't show if user is authenticated or we're in an iframe
    if (isAuthenticated || isInIframe) {
      setShowPrompt(false);
      return;
    }

    // Check if user has previously dismissed the prompt this session
    const wasDismissed = sessionStorage.getItem(PROMPT_DISMISSED_KEY);
    if (wasDismissed === 'true') {
      return;
    }

    // Set timer to show prompt after delay
    const timer = setTimeout(() => {
      if (!isAuthenticated && !isInIframe) {
        setShowPrompt(true);
      }
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isInIframe]);

  const handleClose = useCallback(() => {
    setShowPrompt(false);
    // Mark as dismissed for this session
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
  }, []);

  const SignupPrompt = useMemo(() => {
    return () => (
      <AnimatePresence>
        {showPrompt && (
          <SignupPromptPopup onClose={handleClose} />
        )}
      </AnimatePresence>
    );
  }, [showPrompt, handleClose]);

  return useMemo(() => ({
    showPrompt,
    SignupPrompt
  }), [showPrompt, SignupPrompt]);
};