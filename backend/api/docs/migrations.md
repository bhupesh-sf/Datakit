## Overview
TypeORM migrations track database schema changes. We use explicit entity imports to avoid path resolution issues.

## Configuration
- **App Runtime**: `src/config/database.config.ts`
- **Migration CLI**: `src/migration-data-source.ts`

## Commands

```bash
# Generate migration from entity changes
npm run migration:generate -- src/migrations/DescriptiveName

# Run pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert last migration
npm run migration:revert

# Create empty migration
npm run migration:create -- src/migrations/ManualMigration
```

## Workflow

1. **Modify entity** (add/remove fields)
2. **Generate migration**: `npm run migration:generate -- src/migrations/AddUserPhone`
3. **Review** generated SQL in `src/migrations/`
4. **Test locally**: `npm run migration:run`
5. **Commit** migration file

## Production

Migrations run automatically on Railway deployments via `postbuild` script.

```bash
# Manual production run
npm run migration:run:prod

# Connect to production DB locally
npm run start:dev:prod
```

## Important

- Never edit existing migrations
- Always commit migration files
- Test migrations before deploying
- `synchronize: false` in production