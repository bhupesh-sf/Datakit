import { useRef, useEffect } from "react";

/**
 * Custom hook for monitoring performance metrics of large dataset rendering
 */
export const usePerformanceMonitor = (enabled = true) => {
  const perfMetrics = useRef({
    renderStart: 0,
    renderEnd: 0,
    paintStart: 0,
    paintEnd: 0,
    memoryBefore: 0,
    memoryAfter: 0,
  });

  const startMonitoring = () => {
    if (!enabled) return;

    // Record render start time
    perfMetrics.current.renderStart = performance.now();

    // Record memory usage if available
    if (window.performance && (performance as any).memory) {
      perfMetrics.current.memoryBefore = (
        performance as any
      ).memory.usedJSHeapSize;
    }

    // Record paint metrics
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-paint") {
          perfMetrics.current.paintStart = entry.startTime;
        }
        if (entry.name === "first-contentful-paint") {
          perfMetrics.current.paintEnd = entry.startTime;
        }
      }
    });

    observer.observe({ entryTypes: ["paint"] });

    return () => {
      observer.disconnect();
    };
  };

  const endMonitoring = () => {
    if (!enabled) return null;

    // Record render end time
    perfMetrics.current.renderEnd = performance.now();

    // Record memory usage if available
    if (window.performance && (performance as any).memory) {
      perfMetrics.current.memoryAfter = (
        performance as any
      ).memory.usedJSHeapSize;
    }

    const renderTime =
      perfMetrics.current.renderEnd - perfMetrics.current.renderStart;
    const memoryUsage =
      (perfMetrics.current.memoryAfter - perfMetrics.current.memoryBefore) /
      (1024 * 1024);

    console.log(`[PerformanceMonitor] Render time: ${renderTime.toFixed(2)}ms`);

    if (perfMetrics.current.memoryAfter) {
      console.log(
        `[PerformanceMonitor] Memory usage: ${memoryUsage.toFixed(2)}MB`
      );
    }

    if (perfMetrics.current.paintEnd) {
      const paintTime =
        perfMetrics.current.paintEnd - perfMetrics.current.paintStart;
      console.log(`[PerformanceMonitor] Paint time: ${paintTime.toFixed(2)}ms`);
    }

    return {
      renderTime,
      memoryUsage,
      paintTime: perfMetrics.current.paintEnd
        ? perfMetrics.current.paintEnd - perfMetrics.current.paintStart
        : undefined,
    };
  };

  return {
    startMonitoring,
    endMonitoring,
  };
};

/**
 * Higher order component to add performance monitoring to any component
 */
export const withPerformanceMonitoring = (
  Component: React.ComponentType<any>
) => {
  return (props: any) => {
    const { startMonitoring, endMonitoring } = usePerformanceMonitor();

    useEffect(() => {
      const cleanup = startMonitoring();

      return () => {
        cleanup && cleanup();
        endMonitoring();
      };
    }, []);

    return <Component {...props} />;
  };
};
