import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onDismiss,
  onRetry,
  className = "",
}) => {
  if (!error) return null;

  const getErrorMessage = (error: string) => {
    // Handle common error types
    if (error.includes('model') && error.includes('not selected')) {
      return {
        title: "No Model Selected",
        message: "Please select an AI model from the dropdown to continue.",
        type: "warning" as const
      };
    }
    
    if (error.includes('file') || error.includes('table') || error.includes('data')) {
      return {
        title: "No Data Available",
        message: "Please upload a file or load data to ask questions about it.",
        type: "warning" as const
      };
    }
    
    if (error.includes('authentication') || error.includes('unauthorized')) {
      return {
        title: "Authentication Required",
        message: "Please sign in or configure your API keys to use AI models.",
        type: "error" as const
      };
    }
    
    if (error.includes('rate limit') || error.includes('quota')) {
      return {
        title: "Rate Limit Exceeded",
        message: "You've reached the rate limit. Please try again later or upgrade your plan.",
        type: "warning" as const
      };
    }
    
    if (error.includes('network') || error.includes('connection')) {
      return {
        title: "Connection Error",
        message: "Unable to connect to the AI service. Please check your internet connection.",
        type: "error" as const
      };
    }
    
    // Default error
    return {
      title: "Something went wrong",
      message: error,
      type: "error" as const
    };
  };

  const errorInfo = getErrorMessage(error);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className={`overflow-hidden ${className}`}
      >
        <div className={`p-3 rounded-lg border flex items-start gap-3 ${
          errorInfo.type === 'warning' 
            ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200' 
            : 'bg-red-500/10 border-red-500/20 text-red-200'
        }`}>
          <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            errorInfo.type === 'warning' ? 'text-yellow-400' : 'text-red-400'
          }`} />
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm mb-1">{errorInfo.title}</h4>
            <p className="text-xs opacity-90 leading-relaxed">{errorInfo.message}</p>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {onRetry && (
              <button
                onClick={onRetry}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Retry"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ErrorDisplay;