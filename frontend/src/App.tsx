import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { useDuckDBStore } from "@/store/duckDBStore";
import { useAuthStore } from "@/store/authStore";
import { useConsentManager } from "@/components/common/ConsentPopup";
import { NotificationProvider } from "@/hooks/useNotifications";
import { useSignupPrompt } from "@/hooks/useSignupPrompt";
import { usePostHogIdentification } from "@/hooks/usePostHogIdentification";

import Home from "@/pages/Home";
import Privacy from "@/pages/Privacy";
import Settings from "@/pages/Settings";
import Info from "@/pages/Info";
import NotFound from "@/pages/NotFound";
import DatasetImport from "@/pages/DatasetImport";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import DemoVideoModal from "@/components/data-grid/DemoVideoModal";

import { applyThemeColor } from "@/utils/theme";

import { DISCORD_URL } from "@/components/common/ActionButtons";

import discord from "@/assets/discord.png";
import { PlayCircle } from "lucide-react";

const MobileWarning = () => {
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <>
      <SEO
        title="DataKit"
        description="Modern web-based data analysis tool - Process large files locally with complete privacy"
        keywords="data analysis, sql, duckdb, charts, visualization, inspection, webassembly"
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
          
          {/* Watch Demo Button */}
          <button
            onClick={() => setShowDemoModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-6 py-2 mb-6 rounded-md bg-purple-500/20 hover:bg-purple-400/30 text-purple-200 hover:text-white text-sm border border-purple-400/30 hover:border-purple-300/50 transition-colors duration-150 min-w-[140px]"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>watch the demo</span>
          </button>

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
  const { ConsentPopup } = useConsentManager();
  const { SignupPrompt } = useSignupPrompt();
  
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
    const savedColor = localStorage.getItem("theme-primary-color");
    if (savedColor) {
      applyThemeColor(savedColor);
    }
  }, []);

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
    window.addEventListener("resize", checkMobileDevice);
    return () => window.removeEventListener("resize", checkMobileDevice);
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
              <SignupPrompt />
            </>
          }
        />
        <Route path="/datasets/:organization/:dataset" element={<DatasetImport />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/info" element={<Info />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
