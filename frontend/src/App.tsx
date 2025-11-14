import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { useDuckDBStore } from '@/store/duckDBStore';
import { useAuthStore } from '@/store/authStore';
import { useConsentManager } from '@/components/common/ConsentPopup';
import { NotificationProvider } from '@/hooks/useNotifications';
import { usePostHogIdentification } from '@/hooks/usePostHogIdentification';

import Home from '@/pages/Home';
import Privacy from '@/pages/Privacy';
import Settings from '@/pages/Settings';
import Info from '@/pages/Info';
import NotFound from '@/pages/NotFound';
import DatasetImport from '@/pages/DatasetImport';
import { Button } from '@/components/ui/Button';
import { SEO } from '@/components/common/SEO';
import DemoVideoModal from '@/components/data-grid/DemoVideoModal';
import DemoWizard from '@/components/demo/DemoWizard';

import { applyThemeColor } from '@/utils/theme';

import { DISCORD_URL } from '@/components/common/ActionButtons';

import discord from '@/assets/discord.png';
import { PlayCircle } from 'lucide-react';

const MobileWarning = () => {
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <>
      <SEO
        title="DataKit"
        description="Your data, your choice. Process locally for complete privacy or leverage cloud when you need to collaborate. The modern data analysis platform that adapts to you."
        keywords="data analysis, privacy-first analytics, local data processing, WebAssembly, DuckDB, data visualization, SQL queries, CSV analysis, Excel processing, data science, business intelligence, secure analytics, DataKit"
        url="/"
      />

      <div className="flex flex-col bg-black items-center justify-center h-screen p-6 text-center">
        <div className="bg-black p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4 text-white">
            DataKit works best on desktop
          </h1>
          <p className="text-white/80 mb-2 leading-relaxed">
            Experience powerful data analysis and seamless file processing.
          </p>
          <p className="text-white/60 text-sm mb-6">
            Switch to desktop for the full experience, or
          </p>

          <div className="flex flex-col gap-3 items-center justify-center">
            <Button variant="link" size="lg" asChild>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center"
                title="Join our Discord community"
              >
                <img src={discord} alt="Discord" className="w-6 h-6 mr-1.5" />
                <span className="text-md text-white">Discord</span>
              </a>
            </Button>
            
            <Button variant="link" size="lg" asChild>
              <a
                href="https://www.linkedin.com/company/datakitpage"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center"
                title="Visit our LinkedIn page"
              >
                <svg className="w-6 h-6 mr-1.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span className="text-md text-white">LinkedIn</span>
              </a>
            </Button>
            
            <Button variant="link" size="lg" asChild>
              <a
                href="https://amin.contact"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center"
                title="Visit Amin's contact page"
              >
                <svg className="w-6 h-6 mr-1.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" fill="none"/>
                </svg>
                <span className="text-md text-white">Amin</span>
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Demo Video Modal */}
      <DemoVideoModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        videoUrl="/video/datakit-demo.mp4"
        title="Take a look at your DataKit"
      />
    </>
  );
};

const AppContent = () => {
  const { initialize } = useDuckDBStore();
  const { checkAuth } = useAuthStore();
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const { ConsentPopup } = useConsentManager();

  // Automatically identify users in PostHog when they log in
  usePostHogIdentification();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Global auth check on app startup
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Apply saved theme color
  useEffect(() => {
    const savedColor = localStorage.getItem('theme-primary-color');
    if (savedColor) {
      applyThemeColor(savedColor);
    }
  }, []);

  // Check if welcome modal should be shown
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('datakit-welcome-seen');
    if (!hasSeenWelcome && !isMobileDevice) {
      setShowWelcomeModal(true);
    }
  }, [isMobileDevice]);

  useEffect(() => {
    const checkMobileDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

      // Check both user agent and screen width
      const isMobile = mobileRegex.test(userAgent) || window.innerWidth < 768;
      setIsMobileDevice(isMobile);
    };

    checkMobileDevice();

    // Re-check on window resize
    window.addEventListener('resize', checkMobileDevice);
    return () => window.removeEventListener('resize', checkMobileDevice);
  }, []);

  if (isMobileDevice) {
    return <MobileWarning />;
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Home />
              <ConsentPopup />
            </>
          }
        />
        <Route
          path="/datasets/:organization/:dataset"
          element={<DatasetImport />}
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/info" element={<Info />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* Welcome Modal */}
      <DemoWizard
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onGetStarted={() => setShowWelcomeModal(false)}
      />
    </>
  );
};

const App = () => {
  return (
    <Router>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </Router>
  );
};

export default App;
