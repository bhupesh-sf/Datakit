import { MemoryInfo } from "./types";

/**
 * Browser memory thresholds for different actions
 */
export const MEMORY_THRESHOLDS = {
  /** Trigger garbage collection hints above this ratio */
  GC_TRIGGER: 0.85,
  /** Warning threshold for memory usage */
  WARNING: 0.9,
  /** Critical threshold - stop operations */
  CRITICAL: 0.95,
} as const;

/**
 * Gets current memory usage information
 * 
 * @returns Current memory usage in MB, or 0 if performance.memory is unavailable
 * 
 * @example
 * ```typescript
 * const memoryMB = getCurrentMemoryUsage();
 * console.log(`Using ${memoryMB}MB of memory`);
 * ```
 */
export function getCurrentMemoryUsage(): number {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
  }
  return 0;
}

/**
 * Monitors memory usage and provides detailed information
 * 
 * @returns Memory information object with usage details, or null if unavailable
 * 
 * @example
 * ```typescript
 * const memInfo = monitorMemoryUsage();
 * if (memInfo && memInfo.ratio > 0.8) {
 *   console.warn(`High memory usage: ${memInfo.usedMB}MB`);
 * }
 * ```
 */
export function monitorMemoryUsage(): MemoryInfo | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
    const ratio = usedMB / limitMB;
    
    // Trigger garbage collection hint if memory usage is high
    if (ratio > MEMORY_THRESHOLDS.GC_TRIGGER) {
      triggerGarbageCollection();
    }
    
    return { usedMB, ratio };
  }
  return null;
}

/**
 * Attempts to trigger garbage collection in the browser
 * 
 * @remarks
 * This only works in specific environments (like Chrome DevTools with --enable-precise-memory-info)
 * or when manually exposed. In most production environments, this will be a no-op.
 * 
 * @example
 * ```typescript
 * // Trigger GC before a memory-intensive operation
 * triggerGarbageCollection();
 * await processLargeFile();
 * ```
 */
export function triggerGarbageCollection(): void {
  try {
    if ('gc' in window) {
      (window as any).gc();
    }
  } catch (e) {
    // GC not available, which is normal in most environments
  }
}

/**
 * Checks if current memory usage is above a warning threshold
 * 
 * @param threshold - Memory ratio threshold (0-1), defaults to WARNING threshold
 * @returns True if memory usage is above threshold
 * 
 * @example
 * ```typescript
 * if (isMemoryUsageHigh()) {
 *   console.warn("Memory usage is high, consider reducing operations");
 * }
 * ```
 */
export function isMemoryUsageHigh(threshold: number = MEMORY_THRESHOLDS.WARNING): boolean {
  const memInfo = monitorMemoryUsage();
  return memInfo ? memInfo.ratio > threshold : false;
}

/**
 * Waits for memory usage to drop below a threshold
 * 
 * @param maxWaitMs - Maximum time to wait in milliseconds
 * @param threshold - Memory ratio threshold to wait for
 * @returns Promise that resolves when memory drops below threshold or timeout occurs
 * 
 * @example
 * ```typescript
 * // Wait for memory to stabilize before continuing
 * await waitForMemoryStabilization(5000);
 * console.log("Memory has stabilized, continuing...");
 * ```
 */
export async function waitForMemoryStabilization(
  maxWaitMs: number = 5000,
  threshold: number = MEMORY_THRESHOLDS.GC_TRIGGER
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const memInfo = monitorMemoryUsage();
    if (!memInfo || memInfo.ratio <= threshold) {
      return;
    }
    
    // Wait a bit and trigger GC
    triggerGarbageCollection();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Formats memory size for human-readable display
 * 
 * @param bytes - Size in bytes
 * @returns Formatted string with appropriate unit
 * 
 * @example
 * ```typescript
 * console.log(formatMemorySize(1024 * 1024 * 1.5)); // "1.5 MB"
 * console.log(formatMemorySize(1024 * 1024 * 1024 * 2.3)); // "2.3 GB"
 * ```
 */
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Estimates if an operation can safely proceed based on file size and available memory
 * 
 * @param fileSizeBytes - Size of file to process
 * @param safetyFactor - Safety multiplier for memory estimation (default: 3x file size)
 * @returns Object with recommendation and reasoning
 * 
 * @example
 * ```typescript
 * const fileSize = 500 * 1024 * 1024; // 500MB file
 * const { canProceed, reason } = estimateMemorySafety(fileSize);
 * 
 * if (!canProceed) {
 *   console.warn(`Cannot process file: ${reason}`);
 * }
 * ```
 */
export function estimateMemorySafety(
  fileSizeBytes: number, 
  safetyFactor: number = 3
): { canProceed: boolean; reason: string; recommendation?: string } {
  const memInfo = monitorMemoryUsage();
  
  if (!memInfo) {
    return {
      canProceed: true,
      reason: "Memory monitoring unavailable, proceeding with caution"
    };
  }
  
  const fileSizeMB = fileSizeBytes / 1024 / 1024;
  const estimatedMemoryNeeded = fileSizeMB * safetyFactor;
  const availableMemoryMB = (performance as any).memory.jsHeapSizeLimit / 1024 / 1024 - memInfo.usedMB;
  
  if (estimatedMemoryNeeded > availableMemoryMB) {
    return {
      canProceed: false,
      reason: `File too large: needs ~${estimatedMemoryNeeded.toFixed(1)}MB, only ${availableMemoryMB.toFixed(1)}MB available`,
      recommendation: fileSizeMB > 100 ? "Consider using streaming mode" : "Close other tabs or restart browser"
    };
  }
  
  if (memInfo.ratio > MEMORY_THRESHOLDS.WARNING) {
    return {
      canProceed: false,
      reason: `Current memory usage too high: ${(memInfo.ratio * 100).toFixed(1)}%`,
      recommendation: "Wait for memory to stabilize or restart browser"
    };
  }
  
  return {
    canProceed: true,
    reason: `Safe to proceed: ${estimatedMemoryNeeded.toFixed(1)}MB estimated, ${availableMemoryMB.toFixed(1)}MB available`
  };
}