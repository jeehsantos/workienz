#!/usr/bin/env node
/**
 * Secret Scanner Script
 * Feature: app-security-performance-optimization
 * Task: 2.1 Scan codebase for exposed secrets and API keys
 * 
 * This script scans the codebase for exposed secrets, API keys, and credentials
 * using regex patterns and generates a detailed report.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface SecretMatch {
  file: string;
  line: number;
  column: number;
  type: string;
  description: string;
  snippet: string;
  maskedValue: string;
  severity: 'critical' | 'high' | 'medium';
}

interface ScanReport {
  timestamp: Date;
  totalFiles: number;
  filesScanned: number;
  secretsFound: number;
  matches: SecretMatch[];
  summary: {
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

class SecretScanner {
  private patterns = [
    {
      name: 'Supabase URL',
      pattern: /VITE_SUPABASE_URL\s*=\s*["']?(https:\/\/[a-z0-9-]+\.supabase\.co)["']?/gi,
      type: 'api_endpoint',
      description: 'Supabase project URL detected',
      severity: 'high' as const,
    },
    {
      name: 'Supabase Anon Key',
      pattern: /VITE_SUPABASE_(?:PUBLISHABLE_KEY|ANON_KEY)\s*=\s*["']?(eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)["']?/gi,
      type: 'api_key',
      description: 'Supabase publishable/anon key detected',
      severity: 'high' as const,
    },
    {
      name: 'Generic API Key',
      pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']([^"'\s]{20,})["']/gi,
      type: 'api_key',
      description: 'Hardcoded API key detected',
      severity: 'critical' as const,
    },
    {
      name: 'Password',
      pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
      type: 'password',
      description: 'Hardcoded password detected',
      severity: 'critical' as const,
    },
    {
      name: 'Auth Token',
      pattern: /(?:token|auth[_-]?token|access[_-]?token|bearer)\s*[:=]\s*["']([^"'\s]{20,})["']/gi,
      type: 'token',
      description: 'Hardcoded authentication token detected',
      severity: 'critical' as const,
    },
    {
      name: 'JWT Token',
      pattern: /["'](eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)["']/gi,
      type: 'token',
      description: 'JWT token detected in code',
      severity: 'high' as const,
    },
    {
      name: 'Private Key',
      pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
      type: 'private_key',
      description: 'Private key detected in code',
      severity: 'critical' as const,
    },
    {
      name: 'Database Connection String',
      pattern: /(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s"']+/gi,
      type: 'connection_string',
      description: 'Database connection string detected',
      severity: 'critical' as const,
    },
    {
      name: 'AWS Access Key',
      pattern: /AKIA[0-9A-Z]{16}/gi,
      type: 'api_key',
      description: 'AWS Access Key ID detected',
      severity: 'critical' as const,
    },
    {
      name: 'Stripe API Key',
      pattern: /(?:sk|pk|rk)_(?:test|live)_[0-9a-zA-Z]{24,}/gi,
      type: 'api_key',
      description: 'Stripe API key detected',
      severity: 'critical' as const,
    },
    {
      name: 'Generic Secret',
      pattern: /(?:secret|secret[_-]?key)\s*[:=]\s*["']([^"'\s]{16,})["']/gi,
      type: 'secret',
      description: 'Hardcoded secret detected',
      severity: 'high' as const,
    },
  ];

  private includePatterns = [
    'src/**/*.{ts,tsx,js,jsx}',
    'supabase/**/*.{ts,js}',
    'scripts/**/*.{ts,js}',
    '*.{ts,js,tsx,jsx}',
    '.env',
  ];

  private excludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
    '**/.env.example',
    '**/examples/**',
  ];

  async scan(): Promise<ScanReport> {
    console.log('🔍 Starting secret scan...\n');

    const files = await this.getFilesToScan();
    const matches: SecretMatch[] = [];

    console.log(`📁 Found ${files.length} files to scan\n`);

    for (const file of files) {
      const fileMatches = await this.scanFile(file);
      matches.push(...fileMatches);
    }

    const report = this.generateReport(files.length, matches);
    return report;
  }

  private async getFilesToScan(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.includePatterns) {
      const files = await glob(pattern, {
        ignore: this.excludePatterns,
        nodir: true,
      });
      allFiles.push(...files);
    }

    // Remove duplicates
    return [...new Set(allFiles)];
  }

  private async scanFile(filePath: string): Promise<SecretMatch[]> {
    const matches: SecretMatch[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        for (const patternDef of this.patterns) {
          // Reset regex lastIndex
          patternDef.pattern.lastIndex = 0;
          let match;

          while ((match = patternDef.pattern.exec(line)) !== null) {
            // Skip if it's in a comment or example
            if (this.isInComment(line, match.index) || this.isExample(filePath, line)) {
              continue;
            }

            const matchedValue = match[1] || match[0];
            
            matches.push({
              file: filePath,
              line: lineIndex + 1,
              column: match.index + 1,
              type: patternDef.type,
              description: patternDef.description,
              snippet: line.trim(),
              maskedValue: this.maskSecret(matchedValue),
              severity: patternDef.severity,
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${filePath}:`, error);
    }

    return matches;
  }

  private isInComment(line: string, position: number): boolean {
    const beforeMatch = line.substring(0, position).trim();
    
    // Check for single-line comments
    if (beforeMatch.startsWith('//') || beforeMatch.startsWith('#')) {
      return true;
    }
    
    // Check if inside comment
    if (beforeMatch.includes('//') || beforeMatch.includes('#')) {
      const commentStart = Math.max(
        beforeMatch.lastIndexOf('//'),
        beforeMatch.lastIndexOf('#')
      );
      if (commentStart >= 0 && commentStart < position) {
        return true;
      }
    }
    
    // Check for multi-line comments
    if (beforeMatch.includes('/*') || line.trim().startsWith('*')) {
      return true;
    }
    
    return false;
  }

  private isExample(filePath: string, line: string): boolean {
    // Check if file is an example file
    const fileName = path.basename(filePath).toLowerCase();
    if (
      fileName.includes('.example') ||
      fileName.includes('example') ||
      fileName.includes('readme') ||
      fileName.includes('template')
    ) {
      return true;
    }

    // Check if line contains example indicators
    const exampleIndicators = [
      'example',
      'placeholder',
      'your-',
      'your_',
      'xxx',
      'yyy',
      'zzz',
      'replace-me',
      'change-me',
      'todo',
      'fixme',
    ];
    
    const lowerLine = line.toLowerCase();
    return exampleIndicators.some(indicator => lowerLine.includes(indicator));
  }

  private maskSecret(value: string): string {
    if (!value || value.length <= 8) {
      return '***';
    }
    
    const visibleChars = Math.min(4, Math.floor(value.length * 0.2));
    return (
      value.substring(0, visibleChars) +
      '***' +
      value.substring(value.length - visibleChars)
    );
  }

  private generateReport(totalFiles: number, matches: SecretMatch[]): ScanReport {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    matches.forEach(match => {
      byType[match.type] = (byType[match.type] || 0) + 1;
      bySeverity[match.severity] = (bySeverity[match.severity] || 0) + 1;
    });

    return {
      timestamp: new Date(),
      totalFiles,
      filesScanned: totalFiles,
      secretsFound: matches.length,
      matches,
      summary: {
        byType,
        bySeverity,
      },
    };
  }
}

function displayReport(report: ScanReport): void {
  console.log('📊 Scan Results');
  console.log('═'.repeat(60));
  console.log(`Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`Files Scanned: ${report.filesScanned}`);
  console.log(`Secrets Found: ${report.secretsFound}`);
  console.log('═'.repeat(60));

  if (report.secretsFound === 0) {
    console.log('\n✅ No secrets detected in the codebase!');
    return;
  }

  console.log('\n📈 Summary by Severity:');
  Object.entries(report.summary.bySeverity).forEach(([severity, count]) => {
    const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : '🟡';
    console.log(`  ${icon} ${severity.toUpperCase()}: ${count}`);
  });

  console.log('\n📋 Summary by Type:');
  Object.entries(report.summary.byType).forEach(([type, count]) => {
    console.log(`  • ${type}: ${count}`);
  });

  console.log('\n🔍 Detailed Findings:');
  console.log('─'.repeat(60));

  report.matches.forEach((match, index) => {
    const severityIcon = match.severity === 'critical' ? '🔴' : match.severity === 'high' ? '🟠' : '🟡';
    console.log(`\n${index + 1}. ${severityIcon} ${match.description}`);
    console.log(`   File: ${match.file}:${match.line}:${match.column}`);
    console.log(`   Type: ${match.type}`);
    console.log(`   Severity: ${match.severity.toUpperCase()}`);
    console.log(`   Masked Value: ${match.maskedValue}`);
    console.log(`   Snippet: ${match.snippet.substring(0, 80)}${match.snippet.length > 80 ? '...' : ''}`);
  });

  console.log('\n' + '═'.repeat(60));
  console.log('💡 Recommendations:');
  console.log('─'.repeat(60));
  console.log('1. Move all secrets to environment variables (.env file)');
  console.log('2. Ensure .env is in .gitignore');
  console.log('3. Rotate any exposed credentials immediately');
  console.log('4. Use .env.example for documentation with placeholder values');
  console.log('5. Never commit actual secrets to version control');
  console.log('6. Consider using a secrets management service for production');
}

function saveReport(report: ScanReport, outputPath: string): void {
  const reportData = {
    ...report,
    timestamp: report.timestamp.toISOString(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
  console.log(`\n💾 Report saved to: ${outputPath}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const outputPath = args.includes('--output') || args.includes('-o')
    ? args[args.indexOf('--output') + 1] || args[args.indexOf('-o') + 1]
    : null;

  const scanner = new SecretScanner();
  const report = await scanner.scan();

  displayReport(report);

  if (outputPath) {
    saveReport(report, outputPath);
  }

  // Exit with error code if secrets found
  if (report.secretsFound > 0) {
    console.log('\n❌ Secret scan failed: Secrets detected in codebase');
    process.exit(1);
  } else {
    console.log('\n✅ Secret scan passed: No secrets detected');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
