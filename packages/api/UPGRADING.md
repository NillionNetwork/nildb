# nilDB Upgrade Guide

This document explains how to upgrade nilDB between major versions.

## Version Compatibility

| From Version  | To Version | Upgrade Path                  |
| ------------- | ---------- | ----------------------------- |
| Fresh install | 1.2.0+     | Direct install                |
| 1.1.2         | 1.2.0+     | Direct upgrade                |
| < 1.1.2       | 1.2.0+     | **Two-step upgrade required** |

## Upgrading from v1.1.2 to v1.2.0+

### Overview

Version 1.2.0 consolidates the database migration system:

- **Migration library**: Changed from `mongo-migrate-ts` to `migrate-mongo`
- **Changelog collection**: Renamed from `migrations_changelog` to `_migrations`
- **Migration count**: Reduced from 5 migrations to 1 consolidated migration

### Prerequisites

**IMPORTANT**: You must be running exactly **v1.1.2** before upgrading to v1.2.0 or later.

To verify your current version:

```bash
# Check nilDB version
docker exec <container-name> cat /app/package.json | grep version

# Or check the database migration state
mongosh <connection-string> --eval "db.migrations_changelog.count()"
# Should return: 5
```

### Upgrade Steps

1. **Backup your database**

   ```bash
   mongodump --uri="<your-mongodb-uri>" --out=/path/to/backup
   ```

2. **Stop the current nilDB instance**

   ```bash
   docker stop <nildb-container>
   ```

3. **Pull the new version**

   ```bash
   docker pull <nildb-image>:1.2.0
   ```

4. **Start the new version**

   ```bash
   docker start <nildb-container>
   ```

5. **Monitor the migration**

   ```bash
   docker logs -f <nildb-container>
   ```

   You should see:

   ```
   ! Running consolidated init migration
   ! Detected upgrade from v1.1.2
     - Found 5 migrations in old migrations_changelog
     - Validated all v1.1.2 migrations present
     - Dropping old migrations_changelog collection
   ! Successfully migrated from v1.1.2
   ```

6. **Verify the upgrade**

   ```bash
   # Check new changelog format
   mongosh <connection-string> --eval "db._migrations.findOne()"
   # Should show: 20251106_1000_consolidated_init.mjs

   # Check schema version
   mongosh <connection-string> --eval "db.config.findOne({key: 'schema_version'})"
   # Should show: { value: '1.2.0' }
   ```

### What Happens During Upgrade

The migration automatically:

1. Detects the old `migrations_changelog` collection from v1.1.2
2. Validates it contains exactly 5 expected migrations
3. Drops the old `migrations_changelog` collection
4. Creates a new `_migrations` collection with the consolidated migration entry
5. Preserves all existing collections, indexes, and data

**No data loss occurs** - all your existing data remains intact.

## Upgrading from Versions Older Than v1.1.2

If you're running a version older than v1.1.2, you **must** perform a two-step upgrade:

### Step 1: Upgrade to v1.1.2

1. Backup your database
2. Upgrade to v1.1.2
3. Verify all migrations completed successfully
4. Test your application

### Step 2: Upgrade to v1.2.0+

Follow the [v1.1.2 → v1.2.0 upgrade steps](#upgrading-from-v112-to-v120) above.

## Fresh Installation

For new installations, simply start the latest version. The migration will:

1. Create all 7 collections (`builders`, `users`, `collections`, `queries`, `query_runs`, `config`, `data`)
2. Create required indexes:
   - `builders.did` (unique)
   - `users.did` (unique)
   - `query_runs._created` (TTL: 5400s)
3. Insert schema version document
4. Create single changelog entry

## Migration Failure Scenarios

### Error: "Expected 5 migrations from v1.1.2, found X"

**Cause**: Your database is not from v1.1.2.

**Solution**:

- If you're on an older version, first upgrade to v1.1.2
- If migrations are incomplete, manually run v1.1.2 migrations to completion
- If uncertain, restore from backup and contact support

### Error: "Migration mismatch at position X"

**Cause**: The migration files in your v1.1.2 installation don't match expected names.

**Solution**:

- Verify you're running official v1.1.2 release
- Check for custom or modified migrations
- Restore from backup if migrations were tampered with

### Error: "migrations_changelog collection not found" (on upgrade)

**Cause**: The old migration system didn't create a `migrations_changelog` collection.

**Solution**:

- This is expected for fresh installations (not an error)
- For upgrades, verify you actually had v1.1.2 running previously
- If uncertain, treat as fresh install (will recreate collections)

## Rollback Procedure

If you need to rollback after upgrading:

1. **Stop the new version**

   ```bash
   docker stop <nildb-container>
   ```

2. **Restore from backup**

   ```bash
   mongorestore --uri="<your-mongodb-uri>" --drop /path/to/backup
   ```

3. **Start the old version**
   ```bash
   docker run <nildb-image>:1.1.2
   ```

**Note**: The consolidation migration does not modify any application data, only the migration changelog structure. Your data remains compatible with v1.1.2.

## Support

If you encounter issues during upgrade:

1. Check the [troubleshooting section](#migration-failure-scenarios)
2. Review migration logs for specific error messages
3. Ensure you're upgrading from exactly v1.1.2
4. Contact support with:
   - Current nilDB version
   - Migration count in old changelog
   - Full error message and logs
   - Whether this is a fresh install or upgrade
