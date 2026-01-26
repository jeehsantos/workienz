#!/usr/bin/env node

/**
 * Environment Variable Checker
 * 
 * This script helps developers verify their environment configuration
 * Run with: npm run check-env
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const checks = [];

function addCheck(status, message) {
  checks.push({ status, message });
}

function printResults() {
  console.log('\n🔍 Environment Configuration Check\n');
  console.log('='.repeat(60));
  
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  checks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️ ' : '❌';
    console.log(`${icon} ${check.message}`);
    
    if (check.status === 'pass') passCount++;
    else if (check.status === 'warn') warnCount++;
    else failCount++;
  });

  console.log('='.repeat(60));
  console.log(`\nResults: ${passCount} passed, ${warnCount} warnings, ${failCount} failed\n`);

  if (failCount > 0) {
    console.log('❌ Configuration issues detected. Please fix the errors above.\n');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('⚠️  Configuration has warnings. Review the warnings above.\n');
  } else {
    console.log('✅ All checks passed! Your environment is properly configured.\n');
  }
}

// Check 1: .env file exists
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  addCheck('pass', '.env file exists');
} else {
  addCheck('fail', '.env file not found. Copy .env.example to .env');
}

// Check 2: .env.example exists
const envExamplePath = join(rootDir, '.env.example');
if (existsSync(envExamplePath)) {
  addCheck('pass', '.env.example file exists');
} else {
  addCheck('warn', '.env.example file not found');
}

// Check 3: .gitignore includes .env
const gitignorePath = join(rootDir, '.gitignore');
if (existsSync(gitignorePath)) {
  const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
  if (gitignoreContent.includes('.env')) {
    addCheck('pass', '.env is in .gitignore');
  } else {
    addCheck('fail', '.env is NOT in .gitignore - this is a security risk!');
  }
} else {
  addCheck('warn', '.gitignore file not found');
}

// Check 4: Parse .env file and check required variables
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  const envVars = new Map();
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars.set(key.trim(), valueParts.join('=').trim().replace(/^["']|["']$/g, ''));
      }
    }
  });

  // Check required variables
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_PROJECT_ID',
    'VITE_STRIPE_PUBLISHABLE_KEY',
  ];

  requiredVars.forEach(varName => {
    const value = envVars.get(varName);
    if (!value) {
      addCheck('fail', `${varName} is not set`);
    } else if (value.includes('your-project') || value.includes('your-anon-key')) {
      addCheck('fail', `${varName} contains placeholder value`);
    } else {
      addCheck('pass', `${varName} is set`);
    }
  });

  // Check URL format
  const supabaseUrl = envVars.get('VITE_SUPABASE_URL');
  if (supabaseUrl) {
    if (!supabaseUrl.startsWith('https://')) {
      addCheck('warn', 'VITE_SUPABASE_URL should use HTTPS');
    }
    if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
      addCheck('warn', 'VITE_SUPABASE_URL is using localhost (OK for development)');
    }
  }

  // Check key format
  const publishableKey = envVars.get('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (publishableKey && !publishableKey.startsWith('eyJ')) {
    addCheck('warn', 'VITE_SUPABASE_PUBLISHABLE_KEY format may be invalid (should start with "eyJ")');
  }

  // Check Stripe key format
  const stripeKey = envVars.get('VITE_STRIPE_PUBLISHABLE_KEY');
  if (stripeKey) {
    if (!stripeKey.startsWith('pk_test_') && !stripeKey.startsWith('pk_live_')) {
      addCheck('warn', 'VITE_STRIPE_PUBLISHABLE_KEY format may be invalid (should start with "pk_test_" or "pk_live_")');
    }
    if (stripeKey.includes('your-stripe')) {
      addCheck('fail', 'VITE_STRIPE_PUBLISHABLE_KEY contains placeholder value');
    }
  } else {
    addCheck('fail', 'VITE_STRIPE_PUBLISHABLE_KEY is not set');
  }
}

// Check 5: Verify no secrets in git history (basic check)
try {
  const gitCheck = execSync('git ls-files .env', { encoding: 'utf-8', cwd: rootDir }).trim();
  if (gitCheck) {
    addCheck('fail', '.env file is tracked by git! Remove it immediately with: git rm --cached .env');
  } else {
    addCheck('pass', '.env file is not tracked by git');
  }
} catch (error) {
  // Git not available or not a git repo
  addCheck('warn', 'Could not verify git status (git may not be available)');
}

// Print all results
printResults();
