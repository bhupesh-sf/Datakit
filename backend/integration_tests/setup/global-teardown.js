module.exports = async function globalTeardown() {
  console.log('🧹 Starting global teardown for integration tests...');

  try {
    // Stop the test server
    const serverProcess = global.__SERVER_PROCESS__;
    if (serverProcess) {
      console.log('🛑 Stopping test server...');
      serverProcess.kill('SIGTERM');
      
      // Give the process time to cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
      
      console.log('✅ Test server stopped');
    }
    
    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here to avoid masking test failures
  }
};