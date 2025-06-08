import * as duckdb from "@duckdb/duckdb-wasm";

// Version should match package.json
const DUCKDB_VERSION = '1.29.1-dev132.0';
const DUCKDB_CDN = `https://unpkg.com/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist`;

// Environment check
export const isDevelopment = import.meta.env.DEV;

// Async function to fetch and create blob URL for worker
async function createWorkerBlobURL(workerUrl: string): Promise<string> {
  try {
    const response = await fetch(workerUrl);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to create worker blob URL:', error);
    throw error;
  }
}

// CDN URLs for production
const CDN_URLS = {
  mvp: {
    mainModule: `${DUCKDB_CDN}/duckdb-mvp.wasm`,
    mainWorker: `${DUCKDB_CDN}/duckdb-browser-mvp.worker.js`,
  },
  eh: {
    mainModule: `${DUCKDB_CDN}/duckdb-eh.wasm`,
    mainWorker: `${DUCKDB_CDN}/duckdb-browser-eh.worker.js`,
  },
};

// Development bundles loader
async function getDevBundles(): Promise<duckdb.DuckDBBundles> {
  try {
    const [
      { default: duckdb_wasm },
      { default: mvp_worker },
      { default: duckdb_wasm_eh },
      { default: eh_worker },
    ] = await Promise.all([
      import("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"),
      import("@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"),
      import("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"),
      import("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"),
    ]);

    return {
      mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
      },
      eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
      },
    };
  } catch (error) {
    console.error("Failed to load development bundles:", error);
    return getProdBundles();
  }
}

// Production bundles with worker blob URLs
async function getProdBundles(): Promise<duckdb.DuckDBBundles> {
  try {
    const [mvpWorkerBlob, ehWorkerBlob] = await Promise.all([
      createWorkerBlobURL(CDN_URLS.mvp.mainWorker),
      createWorkerBlobURL(CDN_URLS.eh.mainWorker),
    ]);

    return {
      mvp: {
        mainModule: CDN_URLS.mvp.mainModule,
        mainWorker: mvpWorkerBlob,
      },
      eh: {
        mainModule: CDN_URLS.eh.mainModule,
        mainWorker: ehWorkerBlob,
      },
    };
  } catch (error) {
    console.error("Failed to create worker blob URLs:", error);
    throw error;
  }
}

// Get bundles based on environment
export async function getBundles(): Promise<duckdb.DuckDBBundles> {
  return isDevelopment ? getDevBundles() : getProdBundles();
}

// DuckDB configuration settings
export const duckDBConfig = {
  MEMORY_LIMIT: '4GB',
  TEMP_DIRECTORY: '/tmp/duckdb',
  REQUIRED_EXTENSIONS: ['json', 'parquet'],
};

// Cleanup function to revoke blob URLs
export function cleanupWorkerBlobUrls(bundles: duckdb.DuckDBBundles) {
  try {
    if (bundles.mvp?.mainWorker && typeof bundles.mvp.mainWorker === 'string') {
      URL.revokeObjectURL(bundles.mvp.mainWorker);
    }
    if (bundles.eh?.mainWorker && typeof bundles.eh.mainWorker === 'string') {
      URL.revokeObjectURL(bundles.eh.mainWorker);
    }
  } catch (error) {
    console.error('Failed to cleanup worker blob URLs:', error);
  }
}