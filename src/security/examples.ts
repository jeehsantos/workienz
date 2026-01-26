/**
 * Security Infrastructure Usage Examples
 * Feature: app-security-performance-optimization
 * 
 * This file demonstrates how to use the security infrastructure
 */

import { SecurityScanner, VulnerabilityTracker, validateEnv, checkEnvSecurity } from './index';

/**
 * Example 1: Running a basic security scan
 */
export async function example1_BasicScan() {
  console.log('Example 1: Basic Security Scan\n');
  
  const scanner = new SecurityScanner();
  const report = await scanner.runFullScan();
  
  console.log(`Total vulnerabilities found: ${report.summary.total}`);
  console.log(`Critical: ${report.summary.critical}`);
  console.log(`High: ${report.summary.high}`);
  console.log(`Medium: ${report.summary.medium}`);
  console.log(`Low: ${report.summary.low}`);
  
  return report;
}

/**
 * Example 2: Tracking vulnerabilities
 */
export async function example2_TrackingVulnerabilities() {
  console.log('Example 2: Tracking Vulnerabilities\n');
  
  const scanner = new SecurityScanner();
  const report = await scanner.runFullScan();
  
  const tracker = new VulnerabilityTracker();
  tracker.addVulnerabilities(report.vulnerabilities);
  
  // Get statistics
  const stats = tracker.getStats();
  console.log('Vulnerability Statistics:');
  console.log(`  Open: ${stats.open}`);
  console.log(`  In Progress: ${stats.inProgress}`);
  console.log(`  Resolved: ${stats.resolved}`);
  
  // Get critical vulnerabilities
  const critical = tracker.getCriticalVulnerabilities();
  if (critical.length > 0) {
    console.log('\nCritical Vulnerabilities:');
    critical.forEach(v => {
      console.log(`  - ${v.description}`);
      console.log(`    Location: ${v.location.file}:${v.location.line}`);
    });
  }
  
  return tracker;
}

/**
 * Example 3: Validating environment variables
 */
export function example3_ValidateEnvironment() {
  console.log('Example 3: Environment Validation\n');
  
  const result = validateEnv();
  
  if (result.isValid) {
    console.log('✅ Environment validation passed');
    console.log('Configuration:', result.config);
  } else {
    console.log('❌ Environment validation failed');
    console.log('Errors:', result.errors);
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:', result.warnings);
  }
  
  return result;
}

/**
 * Example 4: Checking environment security
 */
export function example4_CheckEnvSecurity() {
  console.log('Example 4: Environment Security Check\n');
  
  const security = checkEnvSecurity();
  
  if (security.isSecure) {
    console.log('✅ Environment is secure');
  } else {
    console.log('⚠️  Security issues found:');
    security.issues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
    
    console.log('\nRecommendations:');
    security.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
  }
  
  return security;
}

/**
 * Example 5: Filtering vulnerabilities by severity
 */
export async function example5_FilterBySeverity() {
  console.log('Example 5: Filter by Severity\n');
  
  const scanner = new SecurityScanner();
  const report = await scanner.runFullScan();
  
  // Get only high and critical vulnerabilities
  const highPriority = scanner.filterBySeverity('high');
  
  console.log(`High priority vulnerabilities: ${highPriority.length}`);
  highPriority.forEach(v => {
    console.log(`  [${v.severity.toUpperCase()}] ${v.type}: ${v.description}`);
  });
  
  return highPriority;
}

/**
 * Example 6: Custom scan configuration
 */
export async function example6_CustomScanConfig() {
  console.log('Example 6: Custom Scan Configuration\n');
  
  const scanner = new SecurityScanner({
    severityThreshold: 'high',
    enabledChecks: ['exposed_secret', 'weak_authentication', 'insecure_payment'],
    excludePatterns: ['node_modules/**', 'dist/**', '**/*.test.ts'],
  });
  
  const report = await scanner.runFullScan();
  
  console.log('Custom scan results:');
  console.log(`  Vulnerabilities found: ${report.summary.total}`);
  console.log(`  Checks performed: ${scanner['config'].enabledChecks?.join(', ')}`);
  
  return report;
}

/**
 * Example 7: Exporting and importing vulnerability data
 */
export async function example7_ExportImport() {
  console.log('Example 7: Export/Import Vulnerability Data\n');
  
  const scanner = new SecurityScanner();
  const report = await scanner.runFullScan();
  
  const tracker = new VulnerabilityTracker();
  tracker.addVulnerabilities(report.vulnerabilities);
  
  // Export to JSON
  const json = tracker.exportToJSON();
  console.log('Exported vulnerability data (first 200 chars):');
  console.log(json.substring(0, 200) + '...');
  
  // Import back
  const newTracker = new VulnerabilityTracker();
  newTracker.importFromJSON(json);
  
  console.log(`\nImported ${newTracker.getAllVulnerabilities().length} vulnerabilities`);
  
  return { exported: json, tracker: newTracker };
}

/**
 * Example 8: Complete security audit workflow
 */
export async function example8_CompleteAudit() {
  console.log('Example 8: Complete Security Audit\n');
  
  // Step 1: Validate environment
  console.log('Step 1: Validating environment...');
  const envResult = validateEnv();
  if (!envResult.isValid) {
    console.error('Environment validation failed. Aborting audit.');
    return;
  }
  console.log('✅ Environment valid\n');
  
  // Step 2: Check environment security
  console.log('Step 2: Checking environment security...');
  const envSecurity = checkEnvSecurity();
  if (!envSecurity.isSecure) {
    console.warn('⚠️  Environment security issues found');
    envSecurity.issues.forEach(issue => console.warn(`  - ${issue}`));
  } else {
    console.log('✅ Environment secure\n');
  }
  
  // Step 3: Run security scan
  console.log('Step 3: Running security scan...');
  const scanner = new SecurityScanner();
  const report = await scanner.runFullScan();
  console.log(`✅ Scan complete: ${report.summary.total} vulnerabilities found\n`);
  
  // Step 4: Track vulnerabilities
  console.log('Step 4: Tracking vulnerabilities...');
  const tracker = new VulnerabilityTracker();
  tracker.addVulnerabilities(report.vulnerabilities);
  const stats = tracker.getStats();
  console.log(`✅ Tracking ${stats.total} vulnerabilities\n`);
  
  // Step 5: Prioritize critical issues
  console.log('Step 5: Identifying critical issues...');
  const critical = tracker.getCriticalVulnerabilities();
  if (critical.length > 0) {
    console.log(`🚨 ${critical.length} critical vulnerabilities require immediate attention:`);
    critical.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.description}`);
      console.log(`     Location: ${v.location.file}:${v.location.line}`);
      console.log(`     Recommendation: ${v.recommendation}`);
    });
  } else {
    console.log('✅ No critical vulnerabilities found\n');
  }
  
  // Step 6: Generate recommendations
  console.log('\nStep 6: Recommendations:');
  report.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
  
  return {
    envResult,
    envSecurity,
    report,
    tracker,
    stats,
  };
}

// Run all examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await example1_BasicScan();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example2_TrackingVulnerabilities();
    console.log('\n' + '='.repeat(60) + '\n');
    
    example3_ValidateEnvironment();
    console.log('\n' + '='.repeat(60) + '\n');
    
    example4_CheckEnvSecurity();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example5_FilterBySeverity();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example6_CustomScanConfig();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example7_ExportImport();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example8_CompleteAudit();
  })();
}
