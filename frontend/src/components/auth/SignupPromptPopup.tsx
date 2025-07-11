import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Gift } from 'lucide-react';
import AuthModal from './AuthModal';
import { Button } from '../ui/Button';
import { useAIStore } from '@/store/aiStore';

interface SignupPromptPopupProps {
  onClose: () => void;
}

const SignupPromptPopup: React.FC<SignupPromptPopupProps> = ({ onClose }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  const { setActiveProvider } = useAIStore();

  const handleSignupClick = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };

  const handleLoginClick = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setActiveProvider('datakit');
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{
          duration: 0.2,
          ease: [0.23, 1, 0.32, 1],
        }}
        className="fixed top-4 right-4 z-40 max-w-sm will-change-transform"
        style={{
          transform: 'translate3d(0, 0, 0)',
          contain: 'layout style paint',
        }}
      >
        <div className="bg-black border border-white/10 rounded-lg shadow-2xl p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm text-white">
                Try DataKit Assistant!
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white/80 transition-colors ml-2"
            >
              <X className="w-4 h-4 cursor-pointer" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-4">
            <p className="text-white/80 text-sm leading-relaxed mb-3">
              We'd love to know what you think about our Assistant tab! Give it
              a try with{' '}
              <span className="font-semibold text-primary">free credits</span>.
            </p>

            <div className="bg-white/5 rounded-md p-3 mb-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-white/90">
                  What you'll get:
                </span>
              </div>
              <ul className="text-xs text-white/70 space-y-1 pl-1">
                <li>• $3 in free credits to explore AI models</li>
                <li>• Access to powerful language models</li>
                <li>• SQL query assistance & data insights</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleLoginClick}
              className="px-3 py-2 text-sm text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded transition-colors"
            >
              Sign in
            </Button>
            <Button
              variant="outline"
              onClick={handleSignupClick}
              className="flex-1 px-4 py-2 text-sm text-white border border-white/20 hover:border-white/40 rounded transition-colors font-medium"
            >
              Sign up for free
            </Button>
          </div>
        </div>
      </motion.div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authMode}
        onLoginSuccess={handleAuthSuccess}
      />
    </>
  );
};

export default SignupPromptPopup;
