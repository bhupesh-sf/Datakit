// Set longer timeout for integration tests (server startup + HTTP requests)
jest.setTimeout(60000);

// Suppress console logs during tests unless debugging
if (process.env.TEST_DEBUG !== 'true') {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };
  
  console.log = jest.fn();
  console.error = jest.fn(); 
  console.warn = jest.fn();
  
  // But allow our test setup messages to show
  if (process.env.NODE_ENV === 'test') {
    // Restore console for important messages during setup
  }
}