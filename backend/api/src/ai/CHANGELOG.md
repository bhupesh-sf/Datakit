# AI Service Changelog

## [2024-01-04] - DataKit AI Implementation with Claude Backend

### Added
- **DataKit AI Models**: Two new proprietary models powered by Claude
  - `datakit-smart`: Uses Claude 3.5 Sonnet (claude-3-5-sonnet-20241022) backend
  - `datakit-fast`: Uses Claude 3.5 Haiku (claude-3-5-haiku-20241022) backend
- **Rate Limiting System**: Intelligent queue management for API rate limits
  - 50 requests/minute for Sonnet model
  - 100 requests/minute for Haiku model
  - Automatic queue processing and retry logic
- **Enhanced Response Format**: OpenAI-compatible responses with DataKit metadata
- **Credit Integration**: Real-time credit checking and deduction
- **Service Authentication**: Support for service-level API keys

### Changed
- **Model Architecture**: DataKit models now use Claude as backend instead of mixed providers
- **Authentication**: Dual authentication support (JWT for users, service keys for external)
- **Error Handling**: Enhanced error messages with detailed API responses
- **Token Tracking**: More accurate token usage reporting from Claude API

### Technical Features
- **Rate Limiter Service**: 
  - Automatic queue management
  - Rate limit detection and recovery
  - Per-model rate limiting
  - Request queuing with timeout handling
- **API Integration**:
  - Anthropic API v2023-06-01 compatibility
  - Automatic format conversion (Anthropic ↔ OpenAI)
  - Header-based provider selection
- **Response Enhancement**:
  - DataKit metadata in responses
  - Credit usage tracking
  - Token consumption details
  - Model identification

### Configuration
Required environment variables:
- `ANTHROPIC_API_KEY`: Primary API key for Claude models
- `DATAKIT_SERVICE_API_KEY`: Service authentication key
Optional:
- `OPENAI_API_KEY`: For legacy OpenAI model support
- `GROQ_API_KEY`: For free Groq model support

### Rate Limiting
- **Smart Queuing**: Requests queued when rate limits are reached
- **Fallback Strategy**: Can implement model fallback if needed
- **Monitoring**: Queue status endpoint for operational visibility
- **Cleanup**: Automatic cleanup of old queued requests

### Usage Tracking
- **Full Audit Trail**: All requests logged with prompts and responses
- **Credit Calculation**: Real-time credit deduction based on actual token usage
- **Workspace Integration**: Credits tracked per workspace
- **Metadata Storage**: Request metadata stored for analytics