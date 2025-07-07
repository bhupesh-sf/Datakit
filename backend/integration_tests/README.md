# Datakit API Integration Tests

HTTP-based integration testing for the Datakit API backend. Tests run against the built server with a clean test database.

## Architecture

Simple approach: **Build API → Start Server → Test HTTP Endpoints → Clean Database**

```
integration_tests/
├── setup/
│   ├── global-setup.js     # Build API, start server, health check
│   ├── global-teardown.js  # Stop server
│   ├── database-setup.ts   # Database initialization
│   ├── database-utils.ts   # Database cleanup utilities
│   └── jest.setup.ts       # Jest configuration
├── tests/
│   ├── auth.spec.ts        # Authentication flow tests
│   ├── users.spec.ts       # User CRUD tests
│   ├── workspaces.spec.ts  # Workspace CRUD tests
│   ├── subscriptions.spec.ts # Subscription tests
│   ├── credits.spec.ts     # Credit usage tests
│   └── business-logic.spec.ts # Business logic tests
├── fixtures/               # Test data generation
├── utils/
│   └── test-helpers.ts     # Testing utilities
└── package.json
```

## Quick Start

### Prerequisites

1. **PostgreSQL Database**: Ensure PostgreSQL is running
2. **Test Database**: Create `datakit_e2e` database
3. **Environment Variables**:
   ```bash
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_USERNAME=postgres
   DATABASE_PASSWORD=postgres
   DATABASE_NAME=datakit_e2e
   ```

### Installation & Running

```bash
cd backend/integration_tests
npm install

# Run all tests
npm test

# Run specific test
npm test -- auth.spec.ts

# Debug mode
TEST_DEBUG=true npm test
```

## How It Works

1. **Global Setup**: 
   - Builds the API (`cd ../api && npm run build`)
   - Starts server with test database config on port 3001
   - Waits for health check at `/api/health`

2. **Test Execution**:
   - Tests make HTTP requests to `http://localhost:3001/api/*`
   - Uses supertest for HTTP testing
   - Real JWT authentication with cookies
   - Database cleaned between tests

3. **Global Teardown**:
   - Stops the test server
   - Cleans up resources

## Test Coverage

- **Authentication**: Signup, login, JWT tokens, protected routes
- **Users**: CRUD operations, validation, authorization
- **Workspaces**: CRUD, member management, permissions
- **Subscriptions**: Plan management, billing integration
- **Credits**: Usage tracking, limits, analytics
- **Business Logic**: Complete workflows, relationships

## Utilities

### TestHelpers Class

```typescript
// Create authenticated user
const { user, cookies } = await TestHelpers.createAuthenticatedUser({
  email: 'test@example.com',
  password: 'TestPassword123!',
});

// Make authenticated requests
const response = await TestHelpers.authenticatedGet('/users', cookies);
const createResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, data);
```

### Fixtures System

```typescript
// Generate test data
const userData = await UserFixtures.createUserData({
  email: 'custom@example.com',
  password: 'CustomPassword123!',
});

const workspaceData = WorkspaceFixtures.createWorkspaceData({
  name: 'Test Workspace',
  isPersonal: false,
});
```

## Environment Configuration

```bash
# Database (required)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=datakit_e2e

# Debug (optional)
TEST_DEBUG=true  # Shows server logs and HTTP requests
```

## Troubleshooting

### Database Issues
```bash
# Create test database
createdb datakit_e2e

# Grant permissions
psql -c "GRANT ALL PRIVILEGES ON DATABASE datakit_e2e TO postgres;"
```

### Server Issues
```bash
# Check if API builds successfully
cd ../api && npm run build

# Check if port 3001 is available
lsof -i :3001
```

### Debug Mode
```bash
TEST_DEBUG=true npm test
```

Shows detailed logs including:
- Server startup process
- HTTP requests/responses
- Database operations
- Authentication flows

This testing approach provides comprehensive API validation without complex NestJS module setup, testing the actual built application as it runs in production.