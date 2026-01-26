#!/usr/bin/env node
/**
 * Security Scan CLI Tool
 * Feature: app-security-performance-optimization
 * 
 * Command-line tool for running security scans
 */

import { SecurityScanner, VulnerabilityTracker } from '../src/security';
import * as fs from 'fs';
import * as path from 'path';

interface ScanOptions {
  output?: string;
  format?: 'json' | 'text';
  severityThreshold?: 'low' | 'medium' | 'high' | 'critical';
  failOnCritical?: boolean;
}

async function runScan(options: ScanOptions = {}) {
  console.log('🔍 Starting security scan...\n');

  const scanner = new SecurityScanner({
    severityThreshold: options.severityThreshold || 'low',
  });

  const report = await scanner.runFullScan();
  const tracker = new VulnerabilityTracker();
  tracker.addVulnerabilities(report.vulnerabilities);

  // Display results
  console.log('📊 Scan Results:');
  console.log('─'.repeat(50));
  console.log(`Total Vulnerabilities: ${report.summary.total}`);
  console.log(`  🔴 Critical: ${report.summary.critical}`);
  console.log(`  🟠 High: ${report.summary.high}`);
  console.log(`  🟡 Medium: ${report.summary.medium}`);
  console.log(`  🟢 Low: ${report.summary.low}`);
  console.log('─'.repeat(50));

  // Display by type
  console.log('\n📋 By Type:');
  Object.entries(report.summary.byType).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  });

  // Display critical vulnerabilities
  const critical = tracker.getCriticalVulnerabilities();
  if (critical.length > 0) {
    console.log('\n🚨 Critical Vulnerabilities:');
    critical.forEach((v, i) => {
      console.log(`\n  ${i + 1}. ${v.description}`);
      console.log(`     Location: ${v.location.file}:${v.location.line}`);
      console.log(`     Recommendation: ${v.recommendation}`);
    });
  }

  // Display recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  // Save output if requested
  if (options.output) {
    const outputPath = path.resolve(options.output);
    const outputData = options.format === 'json' 
      ? JSON.stringify(report, null, 2)
      : formatTextReport(report);
    
    fs.writeFileSync(outputPath, outputData);
    console.log(`\n💾 Report saved to: ${outputPath}`);
  }

  // Exit with error if critical vulnerabilities found and failOnCritical is true
  if (options.failOnCritical && report.summary.critical > 0) {
    console.error('\n❌ Scan failed: Critical vulnerabilities found');
    process.exit(1);
  }

  console.log('\n✅ Security scan complete');
}

function formatTextReport(report: any): string {
  const lines: string[] = [];
  
  lines.push('Security Scan Report');
  lines.push('='.repeat(50));
  lines.push(`Scan ID: ${report.scanId}`);
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push('');
  
  lines.push('Summary:');
  lines.push(`  Total: ${report.summary.total}`);
  lines.push(`  Critical: ${report.summary.critical}`);
  lines.push(`  High: ${report.summary.high}`);
  lines.push(`  Medium: ${report.summary.medium}`);
  lines.push(`  Low: ${report.summary.low}`);
  lines.push('');
  
  if (report.vulnerabilities.length > 0) {
    lines.push('Vulnerabilities:');
    report.vulnerabilities.forEach((v: any, i: number) => {
      lines.push(`\n${i + 1}. [${v.severity.toUpperCase()}] ${v.type}`);
      lines.push(`   Description: ${v.description}`);
      lines.push(`   Location: ${v.location.file}:${v.location.line}`);
      lines.push(`   Recommendation: ${v.recommendation}`);
    });
  }
  
  if (report.recommendations.length > 0) {
    lines.push('\nRecommendations:');
    report.recommendations.forEach((rec: string, i: number) => {
      lines.push(`${i + 1}. ${rec}`);
    });
  }
  
  return lines.join('\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ScanOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--output' || arg === '-o') {
    options.output = args[++i];
  } else if (arg === '--format' || arg === '-f') {
    options.format = args[++i] as 'json' | 'text';
  } else if (arg === '--severity' || arg === '-s') {
    options.severityThreshold = args[++i] as any;
  } else if (arg === '--fail-on-critical') {
    options.failOnCritical = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Security Scan CLI

Usage: npm run security:scan [options]

Options:
  -o, --output <file>        Save report to file
  -f, --format <format>      Output format (json|text) [default: text]
  -s, --severity <level>     Minimum severity level (low|medium|high|critical) [default: low]
  --fail-on-critical         Exit with error if critical vulnerabilities found
  -h, --help                 Show this help message

Examples:
  npm run security:scan
  npm run security:scan --output report.json --format json
  npm run security:scan --severity high --fail-on-critical
    `);
    process.exit(0);
  }
}

// Run the scan
runScan(options).catch(error => {
  console.error('❌ Scan failed:', error.message);
  process.exit(1);
});
