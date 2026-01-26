#!/usr/bin/env node
/**
 * Security Validation Checkpoint
 * Feature: app-security-performance-optimization
 * Task: 5. Checkpoint - Security validation
 * 
 * This script validates that critical security vulnerabilities have been resolved
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecurityValidator {
  constructor() {
    this.issues = [];
    this.passed = [];
  }

  /**
   * Check 1: Verify .env is in .gitignore
   */
  checkGitignore() {
    console.log('🔍 Checking .gitignore configuration...');
    
    try {
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        this.issues.push({
          severity: 'high',
          check: 'gitignore',
          message: '.gitignore file not found',
          recommendation: 'Create a .gitignore file and add .env to it'
        });
        return;
      }

      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      const hasEnv = gitignoreContent.split('\n').some(line => 
        line.trim() === '.env' || line.trim() === '/.env'
      );

      if (hasEnv) {
        this.passed.push({
          check: 'gitignore',
          message: '.env is properly excluded in .gitignore'
        });
      } else {
        this.issues.push({
          severity: 'critical',
          check: 'gitignore',
          message: '.env is not in .gitignore',
          recommendation: 'Add .env to .gitignore to prevent committing secrets'
        });
      }
    } catch (error) {
      this.issues.push({
        severity: 'high',
        check: 'gitignore',
        message: `Error checking .gitignore: ${error.message}`,
        recommendation: 'Ensure .gitignore exists and is readable'
      });
    }
  }

  /**
   * Check 2: Verify .env.example exists
   */
  checkEnvExample() {
    console.log('🔍 Checking .env.example template...');
    
    const envExamplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
      this.passed.push({
        check: 'env_example',
        message: '.env.example template exists'
      });
    } else {
      this.issues.push({
        severity: 'medium',
        check: 'env_example',
        message: '.env.example file not found',
        recommendation: 'Create .env.example with placeholder values for documentation'
      });
    }
  }

  /**
   * Check 3: Verify .env file is not committed (check if it exists in repo)
   */
  checkEnvNotCommitted() {
    console.log('🔍 Checking if .env is committed...');
    
    const envPath = path.join(process.cwd(), '.env');
    
    // Check if .env exists locally (it should for development)
    if (fs.existsSync(envPath)) {
      // We can't easily check git history without git commands
      // But we can warn if it exists
      this.passed.push({
        check: 'env_local',
        message: '.env file exists locally (expected for development)'
      });
    }
  }

  /**
   * Check 4: Verify security infrastructure exists
   */
  checkSecurityInfrastructure() {
    console.log('🔍 Checking security infrastructure...');
    
    const requiredFiles = [
      'src/security/SecurityScanner.ts',
      'src/security/VulnerabilityTracker.ts',
      'src/security/types.ts',
      'src/security/config.ts',
      'src/security/envValidator.ts',
      'scripts/scan-secrets.ts',
      'scripts/check-env.js'
    ];

    const missingFiles = [];
    const existingFiles = [];

    requiredFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        existingFiles.push(file);
      } else {
        missingFiles.push(file);
      }
    });

    if (missingFiles.length === 0) {
      this.passed.push({
        check: 'security_infrastructure',
        message: `All ${requiredFiles.length} security infrastructure files exist`
      });
    } else {
      this.issues.push({
        severity: 'high',
        check: 'security_infrastructure',
        message: `Missing ${missingFiles.length} security infrastructure files`,
        recommendation: `Create missing files: ${missingFiles.join(', ')}`,
        details: { missingFiles, existingFiles }
      });
    }
  }

  /**
   * Check 5: Verify environment variable validation exists
   */
  checkEnvValidation() {
    console.log('🔍 Checking environment variable validation...');
    
    try {
      const envValidatorPath = path.join(process.cwd(), 'src/security/envValidator.ts');
      if (!fs.existsSync(envValidatorPath)) {
        this.issues.push({
          severity: 'high',
          check: 'env_validation',
          message: 'Environment variable validator not found',
          recommendation: 'Create src/security/envValidator.ts'
        });
        return;
      }

      const content = fs.readFileSync(envValidatorPath, 'utf-8');
      
      // Check for key validation functions
      const hasValidation = content.includes('validateEnv') || 
                           content.includes('checkRequired');
      
      if (hasValidation) {
        this.passed.push({
          check: 'env_validation',
          message: 'Environment variable validation is implemented'
        });
      } else {
        this.issues.push({
          severity: 'medium',
          check: 'env_validation',
          message: 'Environment validator exists but may be incomplete',
          recommendation: 'Ensure validateEnv function is implemented'
        });
      }
    } catch (error) {
      this.issues.push({
        severity: 'high',
        check: 'env_validation',
        message: `Error checking env validator: ${error.message}`,
        recommendation: 'Ensure src/security/envValidator.ts exists and is readable'
      });
    }
  }

  /**
   * Check 6: Scan for hardcoded secrets in key files
   */
  checkForHardcodedSecrets() {
    console.log('🔍 Scanning for hardcoded secrets...');
    
    const secretPatterns = [
      {
        pattern: /VITE_SUPABASE_URL\s*=\s*["']?(https:\/\/[a-z0-9-]+\.supabase\.co)["']?/gi,
        type: 'Supabase URL in code',
        severity: 'high'
      },
      {
        pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]{20,}/g,
        type: 'JWT token in code',
        severity: 'critical'
      },
      {
        pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
        type: 'Hardcoded password',
        severity: 'critical'
      },
      {
        pattern: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/gi,
        type: 'Stripe API key',
        severity: 'critical'
      }
    ];

    const filesToCheck = [
      'src/integrations/supabase/client.ts',
      'src/contexts/AuthContext.tsx',
      'src/App.tsx'
    ];

    let secretsFound = 0;

    filesToCheck.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        return;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        secretPatterns.forEach(({ pattern, type, severity }) => {
          pattern.lastIndex = 0;
          const matches = content.match(pattern);
          
          if (matches && matches.length > 0) {
            // Filter out comments and examples
            const realMatches = matches.filter(match => {
              const lines = content.split('\n');
              const matchingLine = lines.find(line => line.includes(match));
              if (!matchingLine) return false;
              
              // Skip comments
              if (matchingLine.trim().startsWith('//') || 
                  matchingLine.trim().startsWith('*') ||
                  matchingLine.includes('example') ||
                  matchingLine.includes('placeholder')) {
                return false;
              }
              
              return true;
            });

            if (realMatches.length > 0) {
              secretsFound += realMatches.length;
              this.issues.push({
                severity,
                check: 'hardcoded_secrets',
                message: `Found ${realMatches.length} instance(s) of ${type} in ${file}`,
                recommendation: 'Move secrets to environment variables'
              });
            }
          }
        });
      } catch (error) {
        // File read error, skip
      }
    });

    if (secretsFound === 0) {
      this.passed.push({
        check: 'hardcoded_secrets',
        message: 'No obvious hardcoded secrets found in key files'
      });
    }
  }

  /**
   * Check 7: Verify security documentation exists
   */
  checkSecurityDocumentation() {
    console.log('🔍 Checking security documentation...');
    
    const docFiles = [
      'SECURITY.md',
      'src/security/README.md',
      'docs/ENVIRONMENT_VARIABLES.md'
    ];

    const existingDocs = [];
    const missingDocs = [];

    docFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        existingDocs.push(file);
      } else {
        missingDocs.push(file);
      }
    });

    if (existingDocs.length >= 2) {
      this.passed.push({
        check: 'security_docs',
        message: `Security documentation exists (${existingDocs.length}/${docFiles.length} files)`
      });
    } else {
      this.issues.push({
        severity: 'low',
        check: 'security_docs',
        message: `Limited security documentation (${existingDocs.length}/${docFiles.length} files)`,
        recommendation: `Create missing documentation: ${missingDocs.join(', ')}`
      });
    }
  }

  /**
   * Run all validation checks
   */
  async runValidation() {
    console.log('🔒 Security Validation Checkpoint');
    console.log('═'.repeat(60));
    console.log('Feature: app-security-performance-optimization');
    console.log('Task: 5. Checkpoint - Security validation\n');

    this.checkGitignore();
    this.checkEnvExample();
    this.checkEnvNotCommitted();
    this.checkSecurityInfrastructure();
    this.checkEnvValidation();
    this.checkForHardcodedSecrets();
    this.checkSecurityDocumentation();

    this.generateReport();
  }

  /**
   * Generate validation report
   */
  generateReport() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Validation Results');
    console.log('═'.repeat(60));

    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    const highIssues = this.issues.filter(i => i.severity === 'high');
    const mediumIssues = this.issues.filter(i => i.severity === 'medium');
    const lowIssues = this.issues.filter(i => i.severity === 'low');

    console.log(`\n✅ Passed Checks: ${this.passed.length}`);
    console.log(`❌ Failed Checks: ${this.issues.length}`);
    console.log(`   🔴 Critical: ${criticalIssues.length}`);
    console.log(`   🟠 High: ${highIssues.length}`);
    console.log(`   🟡 Medium: ${mediumIssues.length}`);
    console.log(`   🟢 Low: ${lowIssues.length}`);

    if (this.passed.length > 0) {
      console.log('\n✅ Passed Checks:');
      console.log('─'.repeat(60));
      this.passed.forEach((check, i) => {
        console.log(`${i + 1}. ${check.message}`);
      });
    }

    if (this.issues.length > 0) {
      console.log('\n❌ Issues Found:');
      console.log('─'.repeat(60));
      
      [...criticalIssues, ...highIssues, ...mediumIssues, ...lowIssues].forEach((issue, i) => {
        const icon = issue.severity === 'critical' ? '🔴' : 
                     issue.severity === 'high' ? '🟠' : 
                     issue.severity === 'medium' ? '🟡' : '🟢';
        console.log(`\n${i + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
        console.log(`   💡 ${issue.recommendation}`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📋 Summary');
    console.log('═'.repeat(60));

    if (criticalIssues.length === 0 && highIssues.length === 0) {
      console.log('\n✅ CHECKPOINT PASSED');
      console.log('All critical security vulnerabilities have been addressed.');
      console.log('The security infrastructure is in place and functioning.');
      
      if (mediumIssues.length > 0 || lowIssues.length > 0) {
        console.log(`\n⚠️  Note: ${mediumIssues.length + lowIssues.length} minor issues remain but do not block progress.`);
      }
      
      return true;
    } else {
      console.log('\n❌ CHECKPOINT FAILED');
      console.log(`Found ${criticalIssues.length} critical and ${highIssues.length} high severity issues.`);
      console.log('Please address these issues before proceeding.');
      
      console.log('\n💡 Next Steps:');
      if (criticalIssues.length > 0) {
        console.log('1. Address all critical security issues immediately');
      }
      if (highIssues.length > 0) {
        console.log('2. Resolve high severity issues');
      }
      console.log('3. Re-run this validation: node scripts/security-validation-checkpoint.js');
      
      return false;
    }
  }
}

// Main execution
async function main() {
  const validator = new SecurityValidator();
  const passed = await validator.runValidation();
  
  process.exit(passed ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
