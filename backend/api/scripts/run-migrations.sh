#!/bin/bash

# Run migrations only in production environment
if [ "$NODE_ENV" = "production" ]; then
  echo "🚀 Running database migrations after build..."
  npm run migration:run:prod
  echo "✅ Migrations completed"
else
  echo "⏭️ Skipping migrations (not in production)"
fi