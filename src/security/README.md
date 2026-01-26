# Security Infrastructure

This directory contains the security scanning and monitoring infrastructure for the application.

## Overview

The security infrastructure provides:

1. **Security Scanner**: Automated vulnerability detection
2. **Vulnerability Tracker**: Lifecycle management for security issues
3. **Environment Validation**: Runtime validation of configuration
4. **ESLint Security Rules**: Static analysis for security issues

## Components

### SecurityScanner

The `SecurityScanner` class provides comprehensive security vulnerability scanning:

```typescript
import { SecurityScanner } from '@/security';

const scanner = new SecurityScanner();
const report = await scanner.runFullScan();

console.log(`Found ${report.summary.total} vulnerabilities`);
console.log(`Critical: ${report.summary.critical}`);
console.log(`High: ${report.summary.high}`);
```

**Scan Types:**
- `scanForSecrets()` - Detects exposed API keys and secrets
- `scanAuthentication()` - Identifies authentication weaknesses
- `scanRLSPolicies()` - Checks for missing RLS policies
- `scanAuthorization()` - Finds missing authorization checks
- `scanClientSideExposure()` - Detects sensitive data exposure
- `scanInputValidation()` - Identifies missing input validation
- `scanPaymentSecurity()` - Checks Stripe integration security

### VulnerabilityTracker

The `VulnerabilityTracker` manages the lifecycle of security vulnerabilities:

```typescript
import { VulnerabilityTracker } from '@/security';

const tracker = new VulnerabilityTracker();

// Add vulnerabilities from scan
tracker.addVulnerabilities(report.vulnerabilities);

// Update status
tracker.updateVulnerabilityStatus(
  'vuln-123',
  'in_progress',
  'Working on fix',
  'developer@example.com'
);

// Get statistics
const stats = tracker.getStats();
console.log(`Open: ${stats.open}, Resolved: ${stats.resolved}`);
```

### Environment Validation

Validates required environment variables at runtime:

```typescript
import { validateEnv, checkEnvSecurity } from '@/security';

// Validate environment variables
const result = validateEnv();
if (!result.isValid) {
  console.error('Environment validation failed:', result.errors);
}

// Check security configuration
const security = checkEnvSecurity();
if (!security.isSecure) {
  console.warn('Security issues:', security.issues);
}
```

## Usage

### Running a Security Scan

```typescript
import { SecurityScanner, VulnerabilityTracker } from '@/security';

async function runSecurityAudit() {
  const scanner = new SecurityScanner({
    severityThreshold: 'medium',
    enabledChecks: ['exposed_secret', 'weak_authentication', 'missing_rls'],
  });

  const report = await scanner.runFullScan();
  
  // Track vulnerabilities
  const tracker = new VulnerabilityTracker();
  tracker.addVulnerabilities(report.vulnerabilities);
  
  // Get critical issues
  const critical = tracker.getCriticalVulnerabilities();
  
  if (critical.length > 0) {
    console.error(`Found ${critical.length} critical vulnerabilities!`);
    critical.forEach(v => {
      console.error(`- ${v.description} at ${v.location.file}:${v.location.line}`);
    });
  }
  
  return report;
}
```

### Validating Environment on Startup

Add to your application entry point:

```typescript
import { validateEnvOrThrow } from '@/security';

// Validate environment variables on startup
try {
  const config = validateEnvOrThrow();
  console.log('Environment validation passed');
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}
```

## ESLint Security Configuration

The `.eslintrc-security.json` file contains security-focused ESLint rules:

- Detects unsafe regex patterns
- Warns about eval usage
- Identifies potential timing attacks
- Flags console.log statements (except warn/error)

To run security linting:

```bash
npm run lint
```

## Configuration

Security configuration is centralized in `config.ts`:

- **SECURITY_PATTERNS**: Regex patterns for detecting vulnerabilities
- **VULNERABILITY_SEVERITY_MAP**: Severity levels for each vulnerability type
- **CWE_MAPPINGS**: Common Weakness Enumeration mappings
- **REQUIRED_ENV_VARS**: List of required environment variables
- **TABLES_REQUIRING_RLS**: Database tables that need RLS policies
- **RBAC_CONFIG**: Role-based access control configuration

## Best Practices

1. **Run scans regularly**: Integrate security scanning into CI/CD pipeline
2. **Track all vulnerabilities**: Use VulnerabilityTracker to manage findings
3. **Prioritize critical issues**: Address critical and high severity issues first
4. **Validate environment**: Always validate environment variables on startup
5. **Review recommendations**: Follow the recommendations in scan reports
6. **Update regularly**: Keep security patterns and checks up to date

## Integration with CI/CD

Example GitHub Actions workflow:

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run security scan
        run: npm run security:scan
      - name: Run ESLint security
        run: npm run lint
```

## Vulnerability Severity Levels

- **Critical**: Immediate action required (exposed secrets, payment security)
- **High**: Address within 24-48 hours (authentication, authorization, RLS)
- **Medium**: Address within 1 week (client exposure, logging)
- **Low**: Address in next sprint (minor issues, warnings)

## Support

For questions or issues with the security infrastructure, please contact the security team or open an issue in the project repository.
