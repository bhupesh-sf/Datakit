# Subscriptions Service Changelog

## [2024-01-04] - Credit System Overhaul and Workspace-Centric Billing

### Added
- **Workspace-Based Subscriptions**: Primary billing now tied to workspaces instead of individual users
- **Updated Credit Allocations**: 
  - Free tier: 315 credits/month (€3 + 5% margin)
  - Pro tier: 1,575 credits/month (€15 + 5% margin)
  - Team tier: Unlimited credits (-1)
- **Automated Credit Management**: Enhanced monthly credit reset functionality
- **Workspace Subscription Creation**: Automatic subscription creation for new workspaces

### Changed
- **Credit Economics**: Moved from 100/10,000 credit model to 315/1,575 model
- **Subscription Logic**: Workspace-first approach with user fallback for backward compatibility
- **Credit Reset**: More robust monthly reset with proper error handling

### Technical Implementation
- **Database Schema**: Supports both user-based and workspace-based subscriptions
- **Migration Path**: Backward compatibility maintained for existing user subscriptions
- **Cron Jobs**: Daily credit reset checks for all active subscriptions
- **Team Features**: Unlimited credit handling for team plans

### Business Logic
- **5% Margin**: Built into credit allocations for operational sustainability
- **Euro Pricing**: Based on €3 and €15 pricing tiers
- **Scalability**: Designed to handle multiple workspaces per user
- **Credit Tracking**: Real-time credit usage and remaining balance calculations

### Configuration
Environment considerations:
- Cron scheduling for credit resets
- Stripe integration for payment processing
- Workspace management integration