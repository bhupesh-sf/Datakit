import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthModal from './AuthModal';
import { Button } from '../ui/Button';
import { useAIStore } from '@/store/aiStore';

interface SignupPromptPopupProps {
  onClose: () => void;
}

const SignupPromptPopup: React.FC<SignupPromptPopupProps> = ({ onClose }) => {
  const { t } = useTranslation();
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
        <div className="bg-black border border-white/20 rounded-lg shadow-2xl p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-medium text-sm text-white">
              {t('signup.popup.title')}
            </h3>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white/80 transition-colors ml-2"
            >
              <X className="w-4 h-4 cursor-pointer" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-4">
            <p className="text-white/70 text-xs leading-relaxed mb-4">
              {t('signup.popup.description')}
            </p>

            {/* Simplified benefit showcase */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 rounded-md p-3 border border-cyan-500/20 mb-3">
              <span className="text-xs font-medium text-white/90 block mb-2">
                {t('signup.popup.freeFeatures')}
              </span>
              <ul className="text-xs text-white/70 space-y-1">
                <li>• {t('signup.popup.features.cloudConnectors')}</li>
                <li>• {t('signup.popup.features.credits')}</li>
                <li>• {t('signup.popup.features.localProjects')}</li>
                <li>• {t('signup.popup.features.exportViz')}</li>
              </ul>
            </div>

            {/* Team/Enterprise teaser */}
            <div className="px-3 py-2 bg-white/5 rounded-md border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white/80">{t('signup.popup.enterprise.title')}</span>
                <a
                  href="https://datakit.studio/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
{t('signup.popup.enterprise.contact')}
                </a>
              </div>
              <p className="text-xs text-white/60">
                {t('signup.popup.enterprise.description')}
              </p>
            </div>
          </div>

          {/* Actions - streamlined */}
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleSignupClick}
              className="w-full px-4 py-2.5 text-sm bg-gradient-to-r from-cyan-500/10 to-teal-500/10 text-white border border-cyan-500/30 hover:border-cyan-500/50 rounded transition-all font-medium hover:shadow-lg hover:shadow-cyan-500/10"
            >
{t('signup.popup.startFree')}
            </Button>
            <Button
              variant="outline"
              onClick={handleLoginClick}
              className="w-full px-3 py-2 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 rounded transition-colors"
            >
{t('signup.popup.existingAccount')}
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
