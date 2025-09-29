import React, { useState } from 'react';
import { useRequireAuth } from '@/hooks/auth/useRequireAuth';
import AuthModal from './AuthModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback,
  requireAuth = true 
}) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const { isAuthenticated, isLoading } = useRequireAuth({
    onUnauthorized: () => {
      if (requireAuth) {
        setShowAuthModal(true);
      }
    },
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/70">Loading...</div>
      </div>
    );
  }

  // Show auth modal if not authenticated and auth is required
  if (!isAuthenticated && requireAuth) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">
                {t('auth.protectedRoute.authRequired', { defaultValue: 'Authentication Required' })}
              </h3>
              <p className="text-white/70 mb-4">
                {t('auth.protectedRoute.signInMessage', { defaultValue: 'Please sign in to access this feature.' })}
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-primary hover:text-primary-foreground transition-colors"
              >
                {t('auth.protectedRoute.signInButton', { defaultValue: 'Sign In' })}
              </button>
            </div>
          </div>
        )}
        
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode="login"
        />
      </>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;