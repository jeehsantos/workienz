# Scripts Directory

This directory contains utility scripts for the application.

## Available Scripts

### Security Scripts

#### `security-scan.ts`
Scans the codebase for security vulnerabilities including exposed secrets, weak authentication, and missing validation.

**Usage:**
```bash
npm run security:scan
```

#### `scan-secrets.ts`
Specifically scans for exposed API keys and secrets in the codebase.

**Usage:**
```bash
npm run scan:secrets
```

#### `check-env.js`
Validates that all required environment variables are properly configured.

**Usage:**
```bash
node scripts/check-env.js
```

#### `security-validation-checkpoint.js`
Runs a comprehensive security validation checkpoint to verify all security measures are in place.

**Usage:**
```bash
node scripts/security-validation-checkpoint.js
```

### Database Scripts

#### `verify-indexes.sql`
Verifies that all database indexes are properly created and provides usage statistics.

**Usage:**
```bash
# Using psql
psql -d your_database_name -f scripts/verify-indexes.sql

# Using Supabase CLI
supabase db execute -f scripts/verify-indexes.sql

# Direct connection
psql "postgresql://user:pass@host:port/db" -f scripts/verify-indexes.sql
```

**What it checks:**
- Index existence and count
- Index list by table
- Full-text search indexes
- Composite indexes
- Index sizes
- Index usage statistics
- Unused indexes
- Table statistics
- Generated columns for full-text search

**Output:**
The script provides a comprehensive report including:
1. Count of expected indexes
2. Indexes grouped by table
3. Full-text search index details
4. Composite index definitions
5. Index sizes (top 20)
6. Index usage statistics (top 20)
7. Unused indexes (candidates for removal)
8. Table statistics (row counts, vacuum info)
9. Generated column verification

**Interpreting Results:**

- **All expected indexes found**: ✓ Good - all indexes are in place
- **Missing indexes**: ✗ Problem - run the migration again
- **Unused indexes**: Consider removing if idx_scan = 0 after significant usage
- **Large indexes**: Monitor size vs. usage to ensure they're worth the space
- **Low scan count**: May indicate the index isn't being used by queries

**Example Output:**
```
=========================================
Database Index Verification Report
=========================================

1. Checking for expected indexes...

✓ All expected indexes found | 52

2. Index list by table...

tablename          | index_count | indexes
-------------------+-------------+------------------
jobs               | 8           | idx_jobs_status, idx_jobs_created_at, ...
job_applications   | 5           | idx_job_applications_job_id, ...
articles           | 4           | idx_articles_author_id, ...
...
```

## Running Scripts

### Prerequisites

- Node.js installed (for TypeScript/JavaScript scripts)
- PostgreSQL client (psql) installed (for SQL scripts)
- Supabase CLI installed (optional, for Supabase-specific commands)
- Proper environment variables configured

### Environment Setup

Ensure your `.env` file is properly configured with:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

### Common Issues

#### "Permission denied" when running scripts
```bash
# Make script executable
chmod +x scripts/script-name.sh
```

#### "psql: command not found"
Install PostgreSQL client:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### "Connection refused" for database scripts
Check your database connection string and ensure:
1. Database is running
2. Connection credentials are correct
3. Network access is allowed
4. SSL settings are correct

## Script Development Guidelines

When adding new scripts:

1. **Add documentation** - Update this README with script description and usage
2. **Add error handling** - Scripts should handle errors gracefully
3. **Add help text** - Include `--help` flag for complex scripts
4. **Use TypeScript** - For type safety (when applicable)
5. **Add to package.json** - Create npm script for easy execution
6. **Test thoroughly** - Test in development before production use
7. **Add comments** - Explain complex logic
8. **Follow conventions** - Use existing scripts as templates

## Security Considerations

- **Never commit secrets** - Use environment variables
- **Validate inputs** - Sanitize all user inputs
- **Use secure connections** - Always use SSL for database connections
- **Limit permissions** - Scripts should use least-privilege access
- **Log securely** - Don't log sensitive information

## Maintenance

### Regular Tasks

1. **Weekly**: Run `verify-indexes.sql` to check index health
2. **Monthly**: Run security scans to check for new vulnerabilities
3. **Quarterly**: Review and update scripts for new features
4. **As needed**: Run validation scripts before deployments

### Monitoring

Monitor script execution:
- Check exit codes (0 = success, non-zero = error)
- Review output logs
- Track execution time
- Monitor resource usage

## Related Documentation

- [Database Index Optimization](../docs/DATABASE_INDEX_OPTIMIZATION.md)
- [Full-Text Search Usage](../docs/FULL_TEXT_SEARCH_USAGE.md)
- [Security Implementation](../src/security/IMPLEMENTATION.md)
- [Task 7 Summary](../docs/TASK-7-SUMMARY.md)

## Support

For issues with scripts:
1. Check script output for error messages
2. Verify prerequisites are installed
3. Check environment variables
4. Review related documentation
5. Check script permissions
6. Verify database connectivity

## Contributing

When contributing new scripts:
1. Follow the development guidelines above
2. Add comprehensive documentation
3. Include usage examples
4. Add error handling
5. Test in multiple environments
6. Update this README
