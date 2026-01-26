/**
 * Security Configuration
 * Feature: app-security-performance-optimization
 * 
 * Central configuration for security scanning and monitoring
 */

import { ScanConfig } from './types';

/**
 * Default security scanner configuration
 */
export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  includePatterns: [
    'src/**/*.ts',
    'src/**/*.tsx',
    'supabase/**/*.ts',
    '*.config.ts',
    '*.config.js',
  ],
  excludePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],
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
};

/**
 * Security patterns to detect in code
 */
export const SECURITY_PATTERNS = {
  // Exposed secrets patterns
  secrets: {
    apiKey: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]([^'"]+)['"]/gi,
    password: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi,
    token: /(?:token|auth[_-]?token|access[_-]?token)\s*[:=]\s*['"]([^'"]+)['"]/gi,
    privateKey: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----/gi,
    connectionString: /(?:postgres|mysql|mongodb):\/\/[^'"]+/gi,
    awsKey: /AKIA[0-9A-Z]{16}/gi,
    stripeKey: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/gi,
  },

  // Console logging patterns
  consoleLogs: {
    consoleLog: /console\.log\(/gi,
    consoleDebug: /console\.debug\(/gi,
    consoleInfo: /console\.info\(/gi,
    consoleTrace: /console\.trace\(/gi,
  },

  // Dangerous functions
  dangerousFunctions: {
    eval: /\beval\s*\(/gi,
    innerHTML: /\.innerHTML\s*=/gi,
    dangerouslySetInnerHTML: /dangerouslySetInnerHTML/gi,
  },

  // SQL injection patterns
  sqlInjection: {
    directQuery: /\.query\s*\(\s*['"`].*\$\{/gi,
    stringConcat: /SELECT.*\+.*FROM/gi,
  },
};

/**
 * Severity levels for different vulnerability types
 */
export const VULNERABILITY_SEVERITY_MAP = {
  exposed_secret: 'critical',
  weak_authentication: 'high',
  missing_rls: 'high',
  missing_authorization: 'high',
  client_exposure: 'medium',
  missing_validation: 'high',
  insecure_payment: 'critical',
} as const;

/**
 * CWE (Common Weakness Enumeration) mappings
 */
export const CWE_MAPPINGS = {
  exposed_secret: 'CWE-798',
  weak_authentication: 'CWE-287',
  missing_rls: 'CWE-284',
  missing_authorization: 'CWE-862',
  client_exposure: 'CWE-200',
  missing_validation: 'CWE-20',
  insecure_payment: 'CWE-311',
} as const;

/**
 * Required environment variables
 */
export const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PROJECT_ID',
] as const;

/**
 * Security headers that should be present
 */
export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
} as const;

/**
 * Supabase tables that require RLS policies
 */
export const TABLES_REQUIRING_RLS = [
  'profiles',
  'contractor_profiles',
  'employee_profiles',
  'jobs',
  'job_applications',
  'conversations',
  'messages',
  'notifications',
  'articles',
  'subscriptions',
  'entitlements',
] as const;

/**
 * API endpoints that require authentication
 */
export const PROTECTED_ENDPOINTS = [
  '/api/jobs',
  '/api/applications',
  '/api/messages',
  '/api/profile',
  '/api/subscription',
  '/api/payment',
] as const;

/**
 * Role-based access control configuration
 */
export const RBAC_CONFIG = {
  admin: ['*'],
  contractor: [
    'jobs:create',
    'jobs:read',
    'jobs:update',
    'jobs:delete',
    'applications:read',
    'messages:read',
    'messages:write',
  ],
  employee: [
    'jobs:read',
    'applications:create',
    'applications:read',
    'messages:read',
    'messages:write',
  ],
  writer: [
    'articles:create',
    'articles:read',
    'articles:update',
    'articles:delete',
  ],
} as const;
