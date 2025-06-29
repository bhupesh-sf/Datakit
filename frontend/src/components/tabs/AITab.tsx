import React from "react";
import AIWorkspace from "./ai/AIWorkspace";

/**
 * Main AI tab component that wraps the AI workspace
 */
const AITab: React.FC = () => {
  return (
    <div className="h-full w-full">
      <AIWorkspace />
    </div>
  );
};

export default AITab;