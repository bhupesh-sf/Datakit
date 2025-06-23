import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, Heart } from 'lucide-react';
import Plausible from 'plausible-tracker';

interface ConsentPopupProps {
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

const ConsentPopup: React.FC<ConsentPopupProps> = ({ onAccept, onDecline, onClose }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  const handleAccept = () => {
    setShowThanks(true);
    
    // Close after showing thanks message for 2 seconds
    setTimeout(() => {
      onAccept();
    }, 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 50, x: -20 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 25,
        opacity: { duration: 0.3 }
      }}
      className="fixed bottom-4 right-4 z-50 max-w-xs"
    >
      <div className="bg-black border border-white/10 rounded-lg shadow-2xl p-4">
        <AnimatePresence mode="wait">
          {showThanks ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="text-center py-2"
            >
              <div className="flex items-center justify-center mb-2">
                <span className="text-white font-medium text-sm">Thank you!</span>
              </div>
              <p className="text-white/70 text-xs">
                You help us make DataKit better for everyone.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="consent"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-sm text-white">
                  Help us improve DataKit
                </h3>
                <button
                  onClick={onClose}
                  className="text-white/50 hover:text-white/80 transition-colors ml-2"
                >
                  <X className="w-3 h-3 cursor-pointer" />
                </button>
              </div>

              {/* Content */}
              <div className="mb-4">
                <p className="text-white/70 text-xs leading-relaxed mb-3">
                  We use privacy-friendly analytics to understand app usage. Your data files never leave the browser.
                </p>
                
                {/* Dropdown */}
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-between w-full text-xs text-white/60 hover:text-white/80 transition-colors mb-2"
                >
                  <span>What do we collect?</span>
                  {isDropdownOpen ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white/5 rounded p-3 mb-3">
                        <div className="space-y-2">
                          <div>
                            <p className="text-white/80 text-xs font-medium mb-1">We collect:</p>
                            <ul className="text-white/60 text-xs space-y-0.5 pl-2">
                              <li>• Feature usage (query, charts)</li>
                              <li>• Performance metrics</li>
                              <li>• Error reports (to fix bugs)</li>
                              <li>• File types & sizes (not content)</li>
                            </ul>
                          </div>
                          
                          <div>
                            <p className="text-white/80 text-xs font-medium mb-1">Never collected:</p>
                            <ul className="text-white/60 text-xs space-y-0.5 pl-2">
                              <li>• Your data files or content</li>
                              <li>• SQL queries you write</li>
                              <li>• Personal information</li>
                            </ul>
                          </div>
                        </div>
                        
                        <a
                          href="/privacy"
                          className="text-xs text-white/50 hover:text-white/70 transition-colors underline mt-2 block"
                        >
                          View full privacy policy
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onDecline}
                  className="flex-1 px-3 py-1.5 text-xs text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 px-3 py-1.5 text-xs bg-white text-black hover:bg-white/90 rounded transition-colors font-medium"
                >
                  Accept
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Initialize Plausible instance (but don't enable tracking yet)
const plausible = Plausible({
  domain: 'datakit.page',
  trackLocalhost: true, // Set to true if you want to track localhost
});

export const useConsentManager = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('datakit-analytics-consent');
    
    if (consent !== null) {
      setHasInteracted(true);
      if (consent === 'true') {
        setAnalyticsEnabled(true);
        // Enable tracking immediately if consent was previously given
        plausible.enableAutoPageviews();
      }
      return;
    }

    // Show popup after 3 seconds if no previous interaction
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        setShowPopup(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasInteracted]);

  const handleAccept = () => {
    localStorage.setItem('datakit-analytics-consent', 'true');
    setAnalyticsEnabled(true);
    plausible.enableAutoPageviews();
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleDecline = () => {
    localStorage.setItem('datakit-analytics-consent', 'false');
    setAnalyticsEnabled(false);
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleClose = () => {
    setShowPopup(false);
  };

  // Utility function to track custom events (only if consent given)
  const trackEvent = (eventName: string, data?: Record<string, any>) => {
    if (analyticsEnabled) {
      plausible.trackEvent(eventName, { props: {...data} })
    }
  };

  // Utility function to track page views manually (only if consent given)
  const trackPageview = (path?: string) => {
    if (analyticsEnabled) {
      plausible.trackPageview({ url: path });
    }
  };

  return {
    showPopup,
    analyticsEnabled,
    handleAccept,
    handleDecline,
    handleClose,
    trackEvent,
    trackPageview,
    ConsentPopup: () => (
      <AnimatePresence>
        {showPopup && (
          <ConsentPopup
            onAccept={handleAccept}
            onDecline={handleDecline}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    )
  };
};