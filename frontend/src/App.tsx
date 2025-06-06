import { useEffect, useState } from "react";

import { useDuckDBStore } from "@/store/duckDBStore";

import Home from "@/pages/Home";
import { Button } from "@/components/ui/Button";

import { applyThemeColor } from '@/utils/theme';

import { DISCORD_URL } from "@/components/common/ActionButtons";

import discord from '@/assets/discord.png';

const MobileWarning = () => {
  return (
    <div className="flex flex-col bg-black items-center justify-center h-screen p-6 text-center">
      <div className="bg-black p-8 rounded-lg shadow-lg max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-white">Desktop Experience Recommended</h1>
        <p className="text-white mb-6">
          This application is optimized for desktop browsers. For the best experience, please open this application on a desktop or laptop computer.
        </p>
        <Button variant="link" size="lg" asChild>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center"
          title="Join our Discord community"
        >
          <img src={discord} alt="Discord" className="w-6 h-6 mr-1.5" />
          <span className="text-md text-white">Discord</span>
        </a>
      </Button>
      </div>
    </div>
  );
};

const App = () => {
  const { initialize } = useDuckDBStore();
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

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
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      
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

  return <Home />;
};

export default App;