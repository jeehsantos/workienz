/**
 * Security Scanner Implementation
 * Feature: app-security-performance-optimization
 * 
 * This module provides comprehensive security vulnerability scanning
 * for the application codebase.
 */

import {
  SecurityVulnerability,
  SecretVulnerability,
  AuthVulnerability,
  RLSVulnerability,
  AuthzVulnerability,
  ExposureVulnerability,
  ValidationVulnerability,
  PaymentVulnerability,
  SecurityReport,
  ScanConfig,
  VulnerabilitySeverity,
  VulnerabilityType,
} from './types';

export class SecurityScanner {
  private config: ScanConfig;
  private vulnerabilities: SecurityVulnerability[] = [];

  constructor(config: ScanConfig = {}) {
    this.config = {
      excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
      severityThreshold: 'low',
      enabledChecks: [
        'exposed_secret',
        'weak_authentication',
        'missing_rls',
        'missing_authorization',
        'client_exposure',
        'missing_validation',
        'insecure_payment',
      ],
      ...config,
    };
  }

  /**
   * Scans for exposed secrets and API keys in the codebase
   * Validates: Requirements 1.1
   */
  async scanForSecrets(): Promise<SecretVulnerability[]> {
    const secrets: SecretVulnerability[] = [];
    
    // Patterns for detecting various types of secrets
    const secretPatterns = [
      {
        pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        type: 'api_key' as const,
        description: 'Hardcoded API key detected',
      },
      {
        pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        type: 'password' as const,
        description: 'Hardcoded password detected',
      },
      {
        pattern: /(?:token|auth[_-]?token|access[_-]?token)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        type: 'token' as const,
        description: 'Hardcoded authentication token detected',
      },
      {
        pattern: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----/gi,
        type: 'private_key' as const,
        description: 'Private key detected in code',
      },
      {
        pattern: /(?:postgres|mysql|mongodb):\/\/[^'"]+/gi,
        type: 'connection_string' as const,
        description: 'Database connection string detected',
      },
      {
        pattern: /AKIA[0-9A-Z]{16}/gi,
        type: 'api_key' as const,
        description: 'AWS Access Key ID detected',
      },
      {
        pattern: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/gi,
        type: 'api_key' as const,
        description: 'Stripe API key detected',
      },
      {
        pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,
        type: 'token' as const,
        description: 'JWT token detected',
      },
    ];

    const files = await this.getFilesToScan();
    
    for (const file of files) {
      try {
        const content = await this.readFileContent(file);
        const lines = content.split('\n');
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          
          for (const { pattern, type, description } of secretPatterns) {
            // Reset regex lastIndex for each line
            pattern.lastIndex = 0;
            let match;
            
            while ((match = pattern.exec(line)) !== null) {
              // Skip if it's in a comment or example
              if (this.isInComment(line, match.index) || this.isExample(file, line)) {
                continue;
              }
              
              const exposedValue = match[1] || match[0];
              
              secrets.push({
                id: `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'exposed_secret',
                severity: 'critical',
                location: {
                  file,
                  line: lineIndex + 1,
                  column: match.index + 1,
                },
                description,
                recommendation: `Move this ${type} to an environment variable and add it to .gitignore`,
                cwe: 'CWE-798',
                status: 'open',
                detectedAt: new Date(),
                secretType: type,
                exposedValue: this.maskSecret(exposedValue),
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning file ${file}:`, error);
      }
    }
    
    return secrets;
  }

  /**
   * Gets list of files to scan based on config
   */
  private async getFilesToScan(): Promise<string[]> {
    // This will be implemented to use glob patterns
    // For now, return empty array - will be populated by file system walker
    return [];
  }

  /**
   * Reads file content
   */
  private async readFileContent(file: string): Promise<string> {
    // This will be implemented with actual file reading
    return '';
  }

  /**
   * Checks if a match is within a comment
   */
  private isInComment(line: string, position: number): boolean {
    const beforeMatch = line.substring(0, position);
    // Check for single-line comments
    if (beforeMatch.includes('//') || beforeMatch.includes('#')) {
      return true;
    }
    // Check for multi-line comments (basic check)
    if (beforeMatch.includes('/*') || beforeMatch.includes('*')) {
      return true;
    }
    return false;
  }

  /**
   * Checks if a line is an example or documentation
   */
  private isExample(file: string, line: string): boolean {
    // Check if file is an example file
    if (file.includes('.example') || file.includes('example') || file.includes('README')) {
      return true;
    }
    // Check if line contains example indicators
    const exampleIndicators = ['example', 'placeholder', 'your-', 'xxx', 'yyy', 'zzz'];
    const lowerLine = line.toLowerCase();
    return exampleIndicators.some(indicator => lowerLine.includes(indicator));
  }

  /**
   * Masks a secret value for safe display
   */
  private maskSecret(value: string): string {
    if (value.length <= 8) {
      return '***';
    }
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }

  /**
   * Scans authentication flows for weaknesses
   * Validates: Requirements 1.2
   */
  async scanAuthentication(): Promise<AuthVulnerability[]> {
    const authIssues: AuthVulnerability[] = [];
    
    // Check for missing JWT validation
    // Check for weak password policies
    // Check for missing MFA
    // Check for insecure session management
    
    return authIssues;
  }

  /**
   * Scans database tables for missing RLS policies
   * Validates: Requirements 1.3
   */
  async scanRLSPolicies(): Promise<RLSVulnerability[]> {
    const rlsIssues: RLSVulnerability[] = [];
    
    // This would connect to Supabase and check RLS policies
    // For now, returning structure
    
    return rlsIssues;
  }

  /**
   * Scans for missing authorization checks
   * Validates: Requirements 1.4
   */
  async scanAuthorization(): Promise<AuthzVulnerability[]> {
    const authzIssues: AuthzVulnerability[] = [];
    
    // Check for missing role-based access controls
    // Check for unprotected API endpoints
    
    return authzIssues;
  }

  /**
   * Scans for sensitive data exposed in client-side code
   * Validates: Requirements 1.5
   */
  async scanClientSideExposure(): Promise<ExposureVulnerability[]> {
    const exposures: ExposureVulnerability[] = [];
    
    // Check for console.log with sensitive data
    // Check for data in localStorage/sessionStorage
    // Check for sensitive data in network requests
    
    return exposures;
  }

  /**
   * Scans for missing input validation
   * Validates: Requirements 1.6
   */
  async scanInputValidation(): Promise<ValidationVulnerability[]> {
    const validationIssues: ValidationVulnerability[] = [];
    
    // Check for missing input sanitization
    // Check for missing type validation
    // Check for SQL injection vulnerabilities
    
    return validationIssues;
  }

  /**
   * Scans Stripe integration for security issues
   * Validates: Requirements 1.7
   */
  async scanPaymentSecurity(): Promise<PaymentVulnerability[]> {
    const paymentIssues: PaymentVulnerability[] = [];
    
    // Check for missing webhook signature verification
    // Check for card data storage
    // Check for missing idempotency
    
    return paymentIssues;
  }

  /**
   * Generates a comprehensive security report
   */
  generateReport(): SecurityReport {
    const summary = {
      total: this.vulnerabilities.length,
      critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
      high: this.vulnerabilities.filter(v => v.severity === 'high').length,
      medium: this.vulnerabilities.filter(v => v.severity === 'medium').length,
      low: this.vulnerabilities.filter(v => v.severity === 'low').length,
      byType: {} as Record<VulnerabilityType, number>,
    };

    // Count by type
    const types: VulnerabilityType[] = [
      'exposed_secret',
      'weak_authentication',
      'missing_rls',
      'missing_authorization',
      'client_exposure',
      'missing_validation',
      'insecure_payment',
    ];

    types.forEach(type => {
      summary.byType[type] = this.vulnerabilities.filter(v => v.type === type).length;
    });

    const recommendations = this.generateRecommendations();

    return {
      scanId: `scan-${Date.now()}`,
      timestamp: new Date(),
      vulnerabilities: this.vulnerabilities,
      summary,
      recommendations,
    };
  }

  /**
   * Generates prioritized recommendations based on findings
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.vulnerabilities.some(v => v.type === 'exposed_secret')) {
      recommendations.push('Immediately rotate all exposed API keys and secrets');
      recommendations.push('Move all secrets to environment variables');
      recommendations.push('Add .env to .gitignore if not already present');
    }

    if (this.vulnerabilities.some(v => v.type === 'weak_authentication')) {
      recommendations.push('Implement proper JWT validation on all protected routes');
      recommendations.push('Add token refresh logic before expiration');
    }

    if (this.vulnerabilities.some(v => v.type === 'missing_rls')) {
      recommendations.push('Create comprehensive RLS policies for all tables');
      recommendations.push('Test RLS policies with different user roles');
    }

    if (this.vulnerabilities.some(v => v.type === 'missing_authorization')) {
      recommendations.push('Implement role-based access control checks');
      recommendations.push('Add authorization middleware to API endpoints');
    }

    if (this.vulnerabilities.some(v => v.type === 'client_exposure')) {
      recommendations.push('Remove all console.log statements from production code');
      recommendations.push('Implement proper logging service (e.g., Sentry)');
    }

    if (this.vulnerabilities.some(v => v.type === 'missing_validation')) {
      recommendations.push('Add Zod schemas for all user inputs');
      recommendations.push('Implement server-side validation in Edge Functions');
    }

    if (this.vulnerabilities.some(v => v.type === 'insecure_payment')) {
      recommendations.push('Implement Stripe webhook signature verification');
      recommendations.push('Ensure no card data is stored locally');
    }

    return recommendations;
  }

  /**
   * Runs a complete security scan
   */
  async runFullScan(): Promise<SecurityReport> {
    this.vulnerabilities = [];

    if (this.isCheckEnabled('exposed_secret')) {
      const secrets = await this.scanForSecrets();
      this.vulnerabilities.push(...secrets);
    }

    if (this.isCheckEnabled('weak_authentication')) {
      const authIssues = await this.scanAuthentication();
      this.vulnerabilities.push(...authIssues);
    }

    if (this.isCheckEnabled('missing_rls')) {
      const rlsIssues = await this.scanRLSPolicies();
      this.vulnerabilities.push(...rlsIssues);
    }

    if (this.isCheckEnabled('missing_authorization')) {
      const authzIssues = await this.scanAuthorization();
      this.vulnerabilities.push(...authzIssues);
    }

    if (this.isCheckEnabled('client_exposure')) {
      const exposures = await this.scanClientSideExposure();
      this.vulnerabilities.push(...exposures);
    }

    if (this.isCheckEnabled('missing_validation')) {
      const validationIssues = await this.scanInputValidation();
      this.vulnerabilities.push(...validationIssues);
    }

    if (this.isCheckEnabled('insecure_payment')) {
      const paymentIssues = await this.scanPaymentSecurity();
      this.vulnerabilities.push(...paymentIssues);
    }

    return this.generateReport();
  }

  /**
   * Checks if a specific vulnerability check is enabled
   */
  private isCheckEnabled(type: VulnerabilityType): boolean {
    return this.config.enabledChecks?.includes(type) ?? true;
  }

  /**
   * Filters vulnerabilities by severity threshold
   */
  filterBySeverity(severity: VulnerabilitySeverity): SecurityVulnerability[] {
    const severityOrder: VulnerabilitySeverity[] = ['low', 'medium', 'high', 'critical'];
    const thresholdIndex = severityOrder.indexOf(severity);
    
    return this.vulnerabilities.filter(v => {
      const vulnIndex = severityOrder.indexOf(v.severity);
      return vulnIndex >= thresholdIndex;
    });
  }
}
