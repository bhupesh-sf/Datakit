import React from "react";

import NotebooksWorkspace from "./notebooks/NotebooksWorkspace";

/**
 * Main Notebooks tab component that wraps the Python scripts workspace
 */
const NotebooksTab: React.FC = () => {
  return (
    <div className="h-full w-full">
      <NotebooksWorkspace />
    </div>
  );
};

export default NotebooksTab;