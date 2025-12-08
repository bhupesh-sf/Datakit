import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { PostHogProvider } from "posthog-js/react";
import App from "./App.tsx";

import "./lib/i18n";
import "./index.css";

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  person_profiles: "identified_only",
  capture_pageview: false, // We'll handle this manually
  capture_pageleave: true,
  persistence: "localStorage+cookie" as const,
  autocapture: false, // Start with autocapture disabled for privacy
  disable_session_recording: false, // Enable recordings but with TOTAL masking always
  opt_out_capturing_by_default: false, // Allow basic tracking by default
  
  // TOTAL PRIVACY - mask everything ALWAYS (even with consent)
  session_recording: {
    // ALWAYS mask all inputs - NEVER expose user data
    maskAllInputs: true,
    maskAllText: true,
    maskAllImages: true,
    blockAllMedia: true,
    
    // ALWAYS mask all elements - no exceptions
    maskTextSelector: "*",
    maskNumberInputs: true,
    maskCreditCards: true,
    maskEmails: true,
    
    // Comprehensive input masking - NEVER change these
    maskInputOptions: {
      color: true,
      date: true,
      email: true,
      month: true,
      number: true,
      range: true,
      search: true,
      tel: true,
      text: true,
      time: true,
      url: true,
      week: true,
      textarea: true,
      select: true,
      password: true,
      checkbox: true,
      radio: true,
      file: true,
    },
    
    // Block sensitive elements completely - ALWAYS
    blockClass: "ph-no-capture",
    blockSelector: "input, textarea, [contenteditable], select, table, .data-grid, .sql-editor",
    
    // Ignore all form interactions - ALWAYS
    ignoreClass: "ph-ignore",
    
    // Maximum privacy settings - NEVER change
    recordCanvas: false,
    recordCrossOriginIframes: false,
    recordHeaders: false,
    recordBody: false,
    
    // Mask ALL attributes that might contain data - ALWAYS
    maskAttributes: ["*"],
    
    // NEVER capture console logs
    captureConsoleLogs: false,
  },
  
  loaded: (posthog: any) => {
    // Start session recording with heavy masking for all users
    posthog.startSessionRecording();
    
    // Track basic pageview
    posthog.capture("$pageview", {
      tracking_level: "basic",
    });
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider 
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY || ""}
      options={posthogOptions}
    >
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </PostHogProvider>
  </StrictMode>
);
