import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ConnectionStatus } from "./motherduck/ConnectionStatus";
import { TokenInput } from "./motherduck/TokenInput";
import { useAppStore } from "@/store/appStore";
import useMotherDuck from "@/hooks/remote/motherduck/useMotherDuck";

interface MotherDuckPanelProps {
  onImport: (params: { databaseName: string; tableName: string }) => void;
}

const MotherDuckPanel: React.FC<MotherDuckPanelProps> = () => {
  const {
    isConnected,
    isConnecting,
    error: connectionError,
    databases,
    connectionInfo,
    connect,
    disconnect,
    getStoredToken,
    clearError,
    refreshDatabases,
  } = useMotherDuck();

  const { setActiveTab } = useAppStore();
  const [hasShownConfirmation, setHasShownConfirmation] = useState(false);

  const handleDisconnect = async () => {
    await disconnect();
    setHasShownConfirmation(false);
  };

  useEffect(() => {
    if (isConnected && !hasShownConfirmation) {
      setHasShownConfirmation(true);
    }
  }, [isConnected, hasShownConfirmation]);

  const handleConnect = async (token: string) => {
    await connect(token);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10">
        <ConnectionStatus
          isConnected={isConnected}
          isConnecting={isConnecting}
          error={connectionError}
          databaseCount={databases.length}
          connectionInfo={connectionInfo}
          onDisconnect={handleDisconnect}
          onRefresh={refreshDatabases}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!isConnected ? (
          <div className="h-full flex items-center justify-center px-6">
            <TokenInput
              onConnect={handleConnect}
              isConnecting={isConnecting}
              error={connectionError}
              storedToken={getStoredToken() || ""}
              onClearError={clearError}
            />
          </div>
        ) : hasShownConfirmation ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <h2 className="text-xl text-white font-medium">
                You're all set!
              </h2>
              <p className="text-white/70">
                Connection successful. Your MotherDuck tables are now available
                in the Schema Browser.
              </p>

              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setActiveTab("query");
                }}
              >
                Go to Query Panel
              </Button>
            </motion.div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MotherDuckPanel;
