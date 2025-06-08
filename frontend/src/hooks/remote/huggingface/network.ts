/**
 * @fileoverview Network utilities for handling CORS, proxies, and file downloads
 * @module NetworkUtils
 */

import { FetchResult } from "./types";
import { monitorMemoryUsage, waitForMemoryStabilization } from "./utils";

/**
 * CORS proxy services for accessing restricted resources
 */
export const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
] as const;

/**
 * Network timeout configurations
 */
export const TIMEOUTS = {
  /** CORS test timeout */
  CORS_TEST: 5000,
  /** Standard download timeout */
  DOWNLOAD: 30000,
  /** Large file download timeout */
  LARGE_FILE: 300000,
} as const;

/**
 * Tests if a URL is accessible via direct CORS request
 * 
 * @param url - URL to test for CORS accessibility
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise resolving to true if accessible, false otherwise
 * 
 * @example
 * ```typescript
 * const isAccessible = await testCORSAccess("https://example.com/data.csv");
 * if (isAccessible) {
 *   console.log("Direct access available");
 * } else {
 *   console.log("Need to use CORS proxy");
 * }
 * ```
 */
export async function testCORSAccess(
  url: string, 
  timeoutMs: number = TIMEOUTS.CORS_TEST
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      mode: "cors",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Downloads a file directly with progress tracking and memory monitoring
 * 
 * @param url - URL to download
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to download result
 * @throws {Error} When download fails or memory limits are exceeded
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await fetchDirectly(
 *     "https://example.com/data.parquet",
 *     (loaded, total) => console.log(`${(loaded/total*100).toFixed(1)}%`)
 *   );
 *   console.log(`Downloaded ${result.fileSize} bytes`);
 * } catch (error) {
 *   console.error("Download failed:", error.message);
 * }
 * ```
 */
export async function fetchDirectly(
  url: string,
  onProgress?: (loaded: number, total?: number) => void
): Promise<{ blob: Blob; fileSize: number }> {
  // Get file size if possible
  const headResponse = await fetch(url, {
    method: "HEAD",
    mode: "cors",
  }).catch(() => null);

  const contentLength = headResponse?.headers.get("content-length");
  const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

  // Check memory safety before starting download
  if (fileSize > 0) {
    const memInfo = monitorMemoryUsage();
    if (memInfo && fileSize > (memInfo.usedMB * 1024 * 1024 * 2)) {
      console.warn(`Large download detected: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  // Fetch the actual file
  const response = await fetch(url, { mode: "cors" });

  if (!response.ok) {
    switch (response.status) {
      case 403:
        throw new Error(
          "Access denied. This dataset may require authentication or may be private."
        );
      case 404:
        throw new Error("File not found.");
      default:
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // Process response with progress tracking and memory monitoring
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    return { blob, fileSize: blob.size };
  }

  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (onProgress) {
      onProgress(receivedLength, fileSize || undefined);
    }

    // Memory monitoring during download
    const memInfo = monitorMemoryUsage();
    if (memInfo && memInfo.ratio > 0.9) {
      console.warn(`High memory usage during download: ${memInfo.usedMB}MB`);
      // Add a small delay to allow GC
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  const blob = new Blob([allChunks]);
  return { blob, fileSize: receivedLength };
}

/**
 * Attempts to download a file with CORS proxy fallbacks
 * 
 * @param originalUrl - Original file URL
 * @param fileName - File name for progress reporting
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to fetch result with method used
 * @throws {Error} When all download methods fail
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await fetchWithCORSFallback(
 *     "https://restricted.com/data.csv",
 *     "dataset.csv",
 *     (loaded, total) => console.log(`Progress: ${loaded}/${total}`)
 *   );
 *   console.log(`Downloaded via ${result.method}`);
 * } catch (error) {
 *   console.error("All download methods failed:", error.message);
 * }
 * ```
 */
export async function fetchWithCORSFallback(
  originalUrl: string,
  fileName: string,
  onProgress?: (loaded: number, total?: number) => void
): Promise<FetchResult> {
  // First, try direct access
  console.log(`[Network] Testing direct access to ${fileName}...`);
  const hasDirectCORS = await testCORSAccess(originalUrl);

  if (hasDirectCORS) {
    console.log(`[Network] Direct access available for ${fileName}`);
    const result = await fetchDirectly(originalUrl, onProgress);
    return { ...result, method: "direct" };
  }

  // Try CORS proxies
  console.log(
    `[Network] Direct access blocked, trying CORS proxies for ${fileName}...`
  );

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i] + encodeURIComponent(originalUrl);

    try {
      console.log(
        `[Network] Trying CORS proxy ${i + 1}/${CORS_PROXIES.length} for ${fileName}...`
      );

      const response = await fetch(proxyUrl, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        const fileSize = blob.size;

        console.log(`[Network] Successfully downloaded ${fileName} via proxy`);
        return { blob, method: "proxy", fileSize };
      }
    } catch (err) {
      console.warn(`[Network] CORS proxy ${i + 1} failed:`, err);
    }
  }

  throw new Error(
    `Cannot access file due to CORS restrictions. File may require authentication or may not be publicly accessible.`
  );
}

/**
 * Downloads file with automatic retry and exponential backoff
 * 
 * @param url - URL to download
 * @param options - Download options
 * @returns Promise resolving to downloaded blob
 * 
 * @example
 * ```typescript
 * const blob = await downloadWithRetry("https://example.com/data.csv", {
 *   maxRetries: 3,
 *   retryDelay: 1000
 * });
 * ```
 */
export async function downloadWithRetry(
  url: string,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onProgress?: (loaded: number, total?: number) => void;
  } = {}
): Promise<Blob> {
  const { maxRetries = 3, retryDelay = 1000, onProgress } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetchDirectly(url, onProgress);
      return result.blob;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
        console.warn(`[Network] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Download failed after all retries");
}

/**
 * Estimates download time based on file size and connection speed
 * 
 * @param fileSizeBytes - File size in bytes
 * @param connectionSpeedBps - Connection speed in bytes per second (optional)
 * @returns Estimated download time information
 * 
 * @example
 * ```typescript
 * const estimate = estimateDownloadTime(100 * 1024 * 1024); // 100MB file
 * console.log(`Estimated download time: ${estimate.estimatedSeconds}s`);
 * ```
 */
export function estimateDownloadTime(
  fileSizeBytes: number,
  connectionSpeedBps?: number
): {
  estimatedSeconds: number;
  formattedTime: string;
  recommendation: string;
} {
  // Default to average broadband speed if not provided
  const defaultSpeedBps = connectionSpeedBps || (25 * 1024 * 1024 / 8); // 25 Mbps
  
  const estimatedSeconds = fileSizeBytes / defaultSpeedBps;
  
  let formattedTime: string;
  if (estimatedSeconds < 60) {
    formattedTime = `${Math.ceil(estimatedSeconds)}s`;
  } else if (estimatedSeconds < 3600) {
    formattedTime = `${Math.ceil(estimatedSeconds / 60)}m`;
  } else {
    formattedTime = `${Math.ceil(estimatedSeconds / 3600)}h`;
  }
  
  let recommendation: string;
  if (estimatedSeconds < 30) {
    recommendation = "Quick download";
  } else if (estimatedSeconds < 300) {
    recommendation = "Moderate download time";
  } else {
    recommendation = "Long download - consider streaming if available";
  }
  
  return {
    estimatedSeconds,
    formattedTime,
    recommendation,
  };
}

/**
 * Validates URL format and accessibility
 * 
 * @param url - URL to validate
 * @returns Promise resolving to validation result
 * 
 * @example
 * ```typescript
 * const result = await validateURL("https://example.com/data.csv");
 * if (result.isValid) {
 *   console.log("URL is accessible");
 * } else {
 *   console.error("URL validation failed:", result.error);
 * }
 * ```
 */
export async function validateURL(url: string): Promise<{
  isValid: boolean;
  error?: string;
  corsSupported?: boolean;
}> {
  try {
    // Basic URL format validation
    new URL(url);
  } catch (err) {
    return {
      isValid: false,
      error: "Invalid URL format",
    };
  }
  
  try {
    // Test CORS support
    const corsSupported = await testCORSAccess(url);
    
    return {
      isValid: true,
      corsSupported,
    };
  } catch (err) {
    return {
      isValid: false,
      error: `URL not accessible: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}