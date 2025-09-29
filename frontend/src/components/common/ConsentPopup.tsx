import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';

interface ConsentPopupProps {
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

const ConsentPopup: React.FC<ConsentPopupProps> = ({ onAccept, onDecline, onClose }) => {
  const { t } = useTranslation();
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
      exit={{ opacity: 0, y: 50, x: 20 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 25,
        opacity: { duration: 0.3 }
      }}
      className="fixed bottom-4 right-4 z-50 max-w-xs will-change-transform"
      style={{ transform: 'translate3d(0, 0, 0)' }}
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
                <span className="text-white font-medium text-sm">{t('consent.thanks.title', { defaultValue: 'Thank you!' })}</span>
              </div>
              <p className="text-white/70 text-xs">
                {t('consent.thanks.message', { defaultValue: 'You help us make DataKit better for everyone.' })}
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
                  {t('consent.header.title', { defaultValue: 'Help us improve DataKit' })}
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
                  {t('consent.description', { defaultValue: 'We collect basic anonymous metrics to improve app stability. With your consent, we can enable enhanced analytics for better features. Your data files never leave the browser.' })}
                </p>
                
                {/* Dropdown */}
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-between w-full text-xs text-white/60 hover:text-white/80 transition-colors mb-2"
                >
                  <span>{t('consent.dropdown.title', { defaultValue: 'What do we collect?' })}</span>
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
                            <p className="text-white/80 text-xs font-medium mb-1">{t('consent.collection.basic.title', { defaultValue: 'Basic (No Consent Needed):' })}</p>
                            <ul className="text-white/60 text-xs space-y-0.5 pl-2">
                              <li>• {t('consent.collection.basic.pageViews', { defaultValue: 'Page views & navigation' })}</li>
                              <li>• {t('consent.collection.basic.performance', { defaultValue: 'Performance metrics' })}</li>
                              <li>• {t('consent.collection.basic.errors', { defaultValue: 'Error reports (to fix bugs)' })}</li>
                              <li>• {t('consent.collection.basic.recordings', { defaultValue: 'Session recordings (heavily masked)' })}</li>
                            </ul>
                          </div>
                          
                          <div>
                            <p className="text-white/80 text-xs font-medium mb-1">{t('consent.collection.advanced.title', { defaultValue: 'Advanced (With Consent):' })}</p>
                            <ul className="text-white/60 text-xs space-y-0.5 pl-2">
                              <li>• {t('consent.collection.advanced.featureUsage', { defaultValue: 'Detailed feature usage' })}</li>
                              <li>• {t('consent.collection.advanced.recordings', { defaultValue: 'Session recordings' })}</li>
                              <li>• {t('consent.collection.advanced.fileTypes', { defaultValue: 'File types & sizes (not content)' })}</li>
                              <li>• {t('consent.collection.advanced.journeyTracking', { defaultValue: 'User journey tracking' })}</li>
                            </ul>
                          </div>
                          
                          <div>
                            <p className="text-white/80 text-xs font-medium mb-1">{t('consent.collection.never.title', { defaultValue: 'Never collected:' })}</p>
                            <ul className="text-white/60 text-xs space-y-0.5 pl-2">
                              <li>• {t('consent.collection.never.dataFiles', { defaultValue: 'Your data files or content' })}</li>
                              <li>• {t('consent.collection.never.sqlQueries', { defaultValue: 'SQL queries you write' })}</li>
                              <li>• {t('consent.collection.never.personalInfo', { defaultValue: 'Personal information' })}</li>
                            </ul>
                          </div>
                        </div>
                        
                        <a
                          href="/privacy"
                          className="text-xs text-white/50 hover:text-white/70 transition-colors underline mt-2 block"
                        >
                          {t('consent.privacyPolicy', { defaultValue: 'View full privacy policy' })}
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
                  {t('consent.buttons.decline', { defaultValue: 'Decline' })}
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 px-3 py-1.5 text-xs bg-white text-black hover:bg-white/90 rounded transition-colors font-medium"
                >
                  {t('consent.buttons.accept', { defaultValue: 'Accept' })}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};


export const useConsentManager = () => {
  const { t } = useTranslation();
  const [showPopup, setShowPopup] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const posthog = usePostHog();

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('datakit-analytics-consent');
    
    if (consent !== null) {
      setHasInteracted(true);
      if (consent === 'true') {
        setAnalyticsEnabled(true);
        // Enable enhanced tracking if consent was previously given
        if (posthog) {
          posthog.set_config({
            autocapture: true,
            capture_pageview: true,
            // Less masking for consented users
            session_recording: {
              maskAllInputs: false,
              maskAllText: false,
              maskAllImages: false,
              blockAllMedia: false,
              maskTextSelector: '',
              maskInputOptions: {
                password: true, // Still mask passwords
                email: true, // Still mask emails for privacy
              },
            },
          });
          // Track enhanced pageview
          posthog.capture('$pageview', { tracking_level: 'enhanced' });
        }
      } else {
        // User declined - keep heavy masking
        if (posthog) {
          posthog.set_config({
            autocapture: false,
            capture_pageview: false,
            // Keep heavy masking for non-consented users
            session_recording: {
              maskAllInputs: true,
              maskAllText: true,
              maskAllImages: true,
              blockAllMedia: true,
              maskTextSelector: '*',
            },
          });
        }
      }
      return;
    }

    // For new users, track basic pageview immediately (no consent needed)
    if (posthog && !hasInteracted) {
      posthog.capture('$pageview', {
        tracking_level: 'basic',
      });
    }

    // Show popup after 3 seconds if no previous interaction
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        setShowPopup(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasInteracted, posthog]);

  const handleAccept = () => {
    localStorage.setItem('datakit-analytics-consent', 'true');
    setAnalyticsEnabled(true);
    
    if (posthog) {
      // Enable enhanced tracking with less masking
      posthog.set_config({
        autocapture: true,
        capture_pageview: true,
        // Less masking for consented users
        session_recording: {
          maskAllInputs: false,
          maskAllText: false,
          maskAllImages: false,
          blockAllMedia: false,
          maskTextSelector: '',
          maskInputOptions: {
            password: true, // Still mask passwords
            email: true, // Still mask emails
          },
        },
      });
      
      // Track consent granted
      posthog.capture('consent_granted', {
        timestamp: new Date().toISOString(),
      });
      
      // Session recording already started, just less masked now
      
      // Track enhanced pageview
      posthog.capture('$pageview', { tracking_level: 'enhanced' });
    }
    
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleDecline = () => {
    localStorage.setItem('datakit-analytics-consent', 'false');
    setAnalyticsEnabled(false);
    
    if (posthog) {
      // Keep heavy masking for non-consented users
      posthog.set_config({
        autocapture: false,
        capture_pageview: false,
        // Keep heavy masking
        session_recording: {
          maskAllInputs: true,
          maskAllText: true,
          maskAllImages: true,
          blockAllMedia: true,
          maskTextSelector: '*',
        },
      });
      
      // Track consent declined (basic event)
      posthog.capture('consent_declined', {
        timestamp: new Date().toISOString(),
        tracking_level: 'basic',
      });
      
      // Session recording continues but heavily masked
    }
    
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleClose = () => {
    setShowPopup(false);
  };

  // Basic events that don't require consent
  const BASIC_EVENTS = [
    'app_loaded',
    'page_view', 
    'feature_accessed',
    'error_occurred',
    'performance_metric',
  ];

  // Utility function to track custom events (two-tiered)
  const trackEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    if (!posthog) return;
    
    const isBasicEvent = BASIC_EVENTS.some(event => eventName.includes(event));
    
    if (isBasicEvent) {
      // Track basic events without consent
      posthog.capture(eventName, {
        ...data,
        tracking_level: 'basic',
        timestamp: new Date().toISOString(),
      });
    } else if (analyticsEnabled) {
      // Track enhanced events only with consent
      posthog.capture(eventName, {
        ...data,
        tracking_level: 'enhanced',
        timestamp: new Date().toISOString(),
      });
    }
  }, [posthog, analyticsEnabled]);

  // Utility function to track page views manually
  const trackPageview = useCallback((path?: string) => {
    if (!posthog) return;
    
    // Page views are basic events - always track
    posthog.capture('$pageview', {
      $current_url: path || window.location.href,
      tracking_level: analyticsEnabled ? 'enhanced' : 'basic',
    });
  }, [posthog, analyticsEnabled]);

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