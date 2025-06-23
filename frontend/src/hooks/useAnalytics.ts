import { useCallback } from "react";
import { useConsentManager } from "@/components/common/ConsentPopup";

interface AnalyticsEvent {
  name: string;
  props?: Record<string, string | number | boolean>;
}

export const useAnalytics = () => {
  const { analyticsEnabled, trackEvent } = useConsentManager();

  const track = useCallback(
    (event: AnalyticsEvent) => {
      // Only track if user has consented to analytics
      if (analyticsEnabled) {
        trackEvent(event.name, event.props);
      }
    },
    [analyticsEnabled, trackEvent]
  );

  // Convenience methods for common events
  const trackFileUpload = useCallback(
    (result: any) => {
      track({
        name: "file_upload",
        props: {
          source_file_type: result.sourceType,
          is_streaming_import: result.isStreamingImport,
          row_count: String(result.rowCount),
        },
      });
    },
    [track]
  );

  const trackQuery = useCallback(
    (queryType: string, executionTime?: number) => {
      track({
        name: "query_executed",
        props: {
          query_type: queryType,
          execution_time_ms: executionTime,
        },
      });
    },
    [track]
  );

  const trackVisualization = useCallback(
    (chartType: string, dataPoints: number) => {
      track({
        name: "visualization_created",
        props: {
          chart_type: chartType,
          data_points: dataPoints,
        },
      });
    },
    [track]
  );

  const trackTabChange = useCallback(
    (fromTab: string, toTab: string) => {
      track({
        name: "tab_changed",
        props: {
          from_tab: fromTab,
          to_tab: toTab,
        },
      });
    },
    [track]
  );

  const trackFeatureUsage = useCallback(
    (feature: string, context?: string) => {
      track({
        name: "feature_used",
        props: {
          feature_name: feature,
          context: context || "unknown",
        },
      });
    },
    [track]
  );

  return {
    track,
    trackFileUpload,
    trackQuery,
    trackVisualization,
    trackTabChange,
    trackFeatureUsage,
  };
};
