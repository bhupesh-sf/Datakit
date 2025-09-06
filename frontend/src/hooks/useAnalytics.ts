import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";
import { useConsentManager } from "@/components/common/ConsentPopup";

interface AnalyticsEvent {
  name: string;
  props?: Record<string, string | number | boolean>;
}

export const useAnalytics = () => {
  const { analyticsEnabled, trackEvent } = useConsentManager();
  const posthog = usePostHog();

  const track = useCallback(
    (event: AnalyticsEvent) => {
      // Use the consent manager's trackEvent which handles two-tiered tracking
      trackEvent(event.name, event.props);
    },
    [trackEvent]
  );

  // Convenience methods for common events
  const trackFileUpload = useCallback(
    (result: any) => {
      const eventData = {
        source_file_type: result.sourceType,
        is_streaming_import: result.isStreamingImport,
        row_count: String(result.rowCount),
        file_size: result.fileSize,
      };

      // Basic performance tracking (no consent needed)
      track({
        name: "performance_metric",
        props: {
          metric_type: "file_upload",
          ...eventData,
        },
      });

      // Enhanced tracking with consent
      if (analyticsEnabled) {
        track({
          name: "file_upload",
          props: eventData,
        });
      }
    },
    [track, analyticsEnabled]
  );

  const trackQuery = useCallback(
    (queryType: string, executionTime?: number) => {
      // Basic performance metric (no consent needed)
      track({
        name: "performance_metric",
        props: {
          metric_type: "query_execution",
          query_type: queryType,
          execution_time_ms: executionTime,
        },
      });

      // Enhanced tracking with consent
      if (analyticsEnabled) {
        track({
          name: "query_executed",
          props: {
            query_type: queryType,
            execution_time_ms: executionTime,
          },
        });
      }
    },
    [track, analyticsEnabled]
  );

  const trackVisualization = useCallback(
    (chartType: string, dataPoints: number) => {
      // Basic feature usage (no consent needed)
      track({
        name: "feature_accessed",
        props: {
          feature: "visualization",
          chart_type: chartType,
        },
      });

      // Enhanced tracking with consent
      if (analyticsEnabled) {
        track({
          name: "visualization_created",
          props: {
            chart_type: chartType,
            data_points: dataPoints,
          },
        });
      }
    },
    [track, analyticsEnabled]
  );

  const trackTabChange = useCallback(
    (fromTab: string, toTab: string) => {
      // Basic navigation tracking (no consent needed)
      track({
        name: "page_view",
        props: {
          page: toTab,
          previous_page: fromTab,
        },
      });

      // Enhanced tracking with consent
      if (analyticsEnabled) {
        track({
          name: "tab_changed",
          props: {
            from_tab: fromTab,
            to_tab: toTab,
          },
        });
      }
    },
    [track, analyticsEnabled]
  );

  const trackFeatureUsage = useCallback(
    (feature: string, context?: string) => {
      // Basic feature access (no consent needed)
      track({
        name: "feature_accessed",
        props: {
          feature: feature,
          context: context || "unknown",
        },
      });

      // Enhanced tracking with consent
      if (analyticsEnabled) {
        track({
          name: "feature_used",
          props: {
            feature_name: feature,
            context: context || "unknown",
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
    [track, analyticsEnabled]
  );

  // Error tracking (always active - basic event)
  const trackError = useCallback(
    (error: Error | string, context?: string) => {
      const errorData = typeof error === 'string' 
        ? { message: error, name: 'Error' }
        : { message: error.message, name: error.name, stack: error.stack?.substring(0, 500) };

      track({
        name: "error_occurred",
        props: {
          error_name: errorData.name,
          error_message: errorData.message,
          context: context || "unknown",
        },
      });
    },
    [track]
  );

  // Performance tracking (always active - basic event)
  const trackPerformance = useCallback(
    (metric: string, value: number, unit?: string) => {
      track({
        name: "performance_metric",
        props: {
          metric_name: metric,
          metric_value: value,
          metric_unit: unit || "ms",
        },
      });
    },
    [track]
  );

  // User identification (only with consent)
  const identifyUser = useCallback(
    (userId: string, properties?: Record<string, any>) => {
      if (analyticsEnabled && posthog) {
        posthog.identify(userId, properties);
      }
    },
    [analyticsEnabled, posthog]
  );

  // Reset user identification (on logout)
  const resetUser = useCallback(() => {
    if (posthog) {
      posthog.reset();
    }
  }, [posthog]);

  // Feature flags (can be used without consent but returns defaults)
  const isFeatureEnabled = useCallback(
    (flag: string, defaultValue = false): boolean => {
      if (!posthog) return defaultValue;
      return posthog.isFeatureEnabled(flag) || defaultValue;
    },
    [posthog]
  );

  return {
    track,
    trackFileUpload,
    trackQuery,
    trackVisualization,
    trackTabChange,
    trackFeatureUsage,
    trackError,
    trackPerformance,
    identifyUser,
    resetUser,
    isFeatureEnabled,
  };
};
