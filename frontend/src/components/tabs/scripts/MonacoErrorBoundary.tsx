import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface MonacoErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface MonacoErrorBoundaryProps {
  children: React.ReactNode;
  cellId?: string;
}

/**
 * Error boundary specifically for Monaco Editor instances
 * Handles disposal and instantiation errors gracefully
 */
class MonacoErrorBoundary extends React.Component<
  MonacoErrorBoundaryProps,
  MonacoErrorBoundaryState
> {
  constructor(props: MonacoErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MonacoErrorBoundaryState {
    // Check if it's a Monaco Editor related error
    const isMonacoError = 
      error.message.includes('InstantiationService has been disposed') ||
      error.message.includes('domNode') ||
      error.message.includes('monaco') ||
      error.stack?.includes('monaco');

    return {
      hasError: isMonacoError,
      error: isMonacoError ? error : undefined,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log Monaco Editor errors for debugging
    if (this.state.hasError) {
      console.warn('[MonacoErrorBoundary] Monaco Editor error caught:', {
        error: error.message,
        cellId: this.props.cellId,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-4 bg-red-500/10 border border-red-500/20 rounded">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 mb-3">
              Editor temporarily unavailable
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
              }}
              className="text-red-400 hover:text-red-300"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MonacoErrorBoundary;