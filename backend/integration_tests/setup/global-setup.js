const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const http = require('http');

const execAsync = promisify(exec);
let serverProcess = null;

// Function to wait for server to be ready
function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkServer = () => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Server did not start within ${timeout}ms`));
          } else {
            setTimeout(checkServer, 1000);
          }
        }
      });
      
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server did not start within ${timeout}ms`));
        } else {
          setTimeout(checkServer, 1000);
        }
      });
    };
    
    checkServer();
  });
}

module.exports = async function globalSetup() {
  console.log('🚀 Starting global setup for integration tests...');

  try {
    // 1. Setup test database (using ts-node to run TypeScript file)
    console.log('🔧 Setting up test database...');
    await execAsync('npx ts-node setup/database-setup.ts');
    console.log('✅ Test database initialized');

    // 2. Build the API
    console.log('🏗️ Building API...');
    const buildCommand = 'cd ../api && npm run build';
    await execAsync(buildCommand);
    console.log('✅ API built successfully');

    // 3. Start the server with test database config
    console.log('🚀 Starting test server...');
    
    const serverEnv = {
      ...process.env,
      DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
      DATABASE_PORT: process.env.DATABASE_PORT || '5432',
      DATABASE_USERNAME: process.env.DATABASE_USERNAME || 'postgres',
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'postgres',
      DATABASE_NAME: process.env.DATABASE_NAME || 'datakit_e2e',
      NODE_ENV: 'test',
      PORT: '3001', // Use different port for tests
      NODE_OPTIONS: '--experimental-global-webcrypto', // Enable crypto API
    };

    serverProcess = spawn('node', ['dist/src/main.js'], {
      cwd: '../api',
      env: serverEnv,
      stdio: 'pipe'
    });

    // Store server process globally so teardown can access it
    global.__SERVER_PROCESS__ = serverProcess;

    // Log server output for debugging
    serverProcess.stdout?.on('data', (data) => {
      if (process.env.TEST_DEBUG) {
        console.log(`Server: ${data}`);
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...');
    await waitForServer(3001);
    console.log('✅ Test server is ready');

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    
    // Cleanup on failure
    if (serverProcess) {
      serverProcess.kill();
    }
    
    throw error;
  }
};