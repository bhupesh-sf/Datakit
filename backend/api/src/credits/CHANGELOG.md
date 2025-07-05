# Credits Service Changelog

## [2024-01-04] - DataKit AI Credit System Implementation

### Added
- **New Credit Calculation Model**: Implemented credit-based pricing system where 1 credit = $0.01 USD
- **Claude Model Integration**: Added support for Claude 3.5 Sonnet and Haiku models behind DataKit AI
- **DataKit AI Models**: 
  - `datakit-smart`: 0.3 credits per 1K input tokens, 1.5 credits per 1K output tokens (Claude 3.5 Sonnet backend)
  - `datakit-fast`: 0.08 credits per 1K input tokens, 0.4 credits per 1K output tokens (Claude 3.5 Haiku backend)
- **Credit System with Margin**: Built-in 5% margin for sustainability
- **Workspace-First Architecture**: Prioritizes workspace credits over user credits
- **Usage Tracking**: Enhanced metadata tracking for AI model usage

### Changed
- **Credit Allocation**: 
  - Free tier: 315 credits/month (€3 + 5% margin)
  - Pro tier: 1,575 credits/month (€15 + 5% margin)
  - Team tier: Unlimited credits (-1)
- **Token Calculation**: More accurate token-to-credit conversion based on Anthropic pricing
- **Model Mapping**: Alternative model IDs for backward compatibility

### Technical Details
- **Backend Models**: DataKit AI uses Claude 3.5 models as the underlying infrastructure
- **Rate Limiting**: Integrated with rate limiting system to handle API quotas
- **Error Handling**: Enhanced error messages and retry logic
- **Database**: Maintains full audit trail with prompt, response, and metadata

### Configuration
Required environment variables:
- Credit calculations automatically applied based on model usage