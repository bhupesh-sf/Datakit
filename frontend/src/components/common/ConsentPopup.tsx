import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsentPopupProps {
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

const ConsentPopup: React.FC<ConsentPopupProps> = ({ onAccept, onDecline, onClose }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: -20 }}
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
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-medium text-sm text-white">
            Help us improve DataKit
          </h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/80 transition-colors ml-2"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <p className="text-white/70 text-xs leading-relaxed mb-3">
            We use privacy-friendly analytics to understand app usage. Your data files never leaves the browser.
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
            onClick={onAccept}
            className="flex-1 px-3 py-1.5 text-xs bg-white text-black hover:bg-white/90 rounded transition-colors font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const useConsentManager = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('datakit-analytics-consent');
    
    if (consent !== null) {
      setHasInteracted(true);
      if (consent === 'true') {
        loadPlausible();
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

  const loadPlausible = () => {
    // Load Plausible script dynamically
    const script = document.querySelector('script[data-name="plausible"]') as HTMLScriptElement;
    if (script && script.type === 'text/plain') {
      script.type = 'text/javascript';
      // Create a new script to reload it
      const newScript = document.createElement('script');
      newScript.defer = true;
      newScript.setAttribute('data-domain', 'https://datakit.page');
      newScript.src = 'https://plausible.io/js/script.js';
      document.head.appendChild(newScript);   
    }
  };

  const handleAccept = () => {
    localStorage.setItem('datakit-analytics-consent', 'true');
    loadPlausible();
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleDecline = () => {
    localStorage.setItem('datakit-analytics-consent', 'false');
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleClose = () => {
    setShowPopup(false);
  };

  return {
    showPopup,
    handleAccept,
    handleDecline,
    handleClose,
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