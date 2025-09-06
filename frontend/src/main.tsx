import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { PostHogProvider } from "posthog-js/react";
import App from "./App.tsx";

import "./index.css";

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  person_profiles: "identified_only",
  capture_pageview: false, // We'll handle this manually
  capture_pageleave: true,
  persistence: "localStorage+cookie",
  autocapture: false, // Start with autocapture disabled for privacy
  disable_session_recording: false, // Enable recordings but with heavy masking by default
  opt_out_capturing_by_default: false, // Allow basic tracking by default
  
  // Heavy masking for non-consented users
  session_recording: {
    maskAllInputs: true,
    maskAllText: true,
    maskAllImages: true,
    blockAllMedia: true,
    maskTextSelector: "*", // Mask all text elements
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
    },
  },
  
  loaded: (posthog) => {
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
