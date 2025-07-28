import React from "react";

import ScriptsWorkspace from "./scripts/ScriptsWorkspace";

/**
 * Main Scripts tab component that wraps the Python scripts workspace
 */
const ScriptsTab: React.FC = () => {
  return (
    <div className="h-full w-full">
      <ScriptsWorkspace />
    </div>
  );
};

export default ScriptsTab;