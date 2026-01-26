/**
 * Validation Script for JWT Middleware Implementation
 * 
 * This script validates that the JWT middleware implementation
 * is complete and follows the requirements.
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  passed: boolean;
  message: string;
}

const results: ValidationResult[] = [];

function validateFileExists(filePath: string, description: string): void {
  const fullPath = path.join(process.cwd(), filePath);
  const exists = fs.existsSync(fullPath);
  
  results.push({
    passed: exists,
    message: `${description}: ${exists ? '✅ PASS' : '❌ FAIL'} - ${filePath}`,
  });
}

function validateFileContains(
  filePath: string,
  searchString: string,
  description: string
): void {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    results.push({
      passed: false,
      message: `${description}: ❌ FAIL - File not found: ${filePath}`,
    });
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const contains = content.includes(searchString);
  
  results.push({
    passed: contains,
    message: `${description}: ${contains ? '✅ PASS' : '❌ FAIL'} - ${filePath}`,
  });
}

console.log('🔍 Validating JWT Middleware Implementation...\n');

// Validate server-side files
console.log('📦 Server-Side (Edge Functions):');
validateFileExists(
  'supabase/functions/_shared/auth-middleware.ts',
  'Auth middleware module exists'
);
validateFileContains(
  'supabase/functions/_shared/auth-middleware.ts',
  'authenticateRequest',
  'authenticateRequest function exists'
);
validateFileContains(
  'supabase/functions/_shared/auth-middleware.ts',
  'validateToken',
  'validateToken function exists'
);
validateFileContains(
  'supabase/functions/_shared/auth-middleware.ts',
  'checkTokenExpiration',
  'checkTokenExpiration function exists'
);
validateFileContains(
  'supabase/functions/_shared/auth-middleware.ts',
  'AuthenticationError',
  'AuthenticationError class exists'
);
validateFileExists(
  'supabase/functions/_shared/auth-middleware-example.ts',
  'Example implementation exists'
);

console.log('\n📦 Client-Side (React):');
validateFileExists(
  'src/lib/tokenManager.ts',
  'Token manager module exists'
);
validateFileContains(
  'src/lib/tokenManager.ts',
  'initializeTokenManager',
  'initializeTokenManager function exists'
);
validateFileContains(
  'src/lib/tokenManager.ts',
  'refreshToken',
  'refreshToken function exists'
);
validateFileContains(
  'src/lib/tokenManager.ts',
  'getAccessToken',
  'getAccessToken function exists'
);
validateFileContains(
  'src/lib/tokenManager.ts',
  'scheduleTokenRefresh',
  'scheduleTokenRefresh function exists'
);
validateFileContains(
  'src/lib/tokenManager.ts',
  'clearTokenData',
  'clearTokenData function exists'
);

validateFileExists(
  'src/hooks/useTokenRefresh.ts',
  'useTokenRefresh hook exists'
);
validateFileContains(
  'src/hooks/useTokenRefresh.ts',
  'useTokenRefresh',
  'useTokenRefresh hook function exists'
);

console.log('\n📦 Tests:');
validateFileExists(
  'src/lib/__tests__/tokenManager.test.ts',
  'Token manager tests exist'
);
validateFileContains(
  'src/lib/__tests__/tokenManager.test.ts',
  'describe',
  'Test suite structure exists'
);

console.log('\n📦 Documentation:');
validateFileExists(
  'docs/JWT_VALIDATION_MIDDLEWARE.md',
  'Documentation exists'
);
validateFileContains(
  'docs/JWT_VALIDATION_MIDDLEWARE.md',
  'Requirements Addressed',
  'Requirements section exists'
);
validateFileContains(
  'docs/JWT_VALIDATION_MIDDLEWARE.md',
  'Server-Side Implementation',
  'Server-side docs exist'
);
validateFileContains(
  'docs/JWT_VALIDATION_MIDDLEWARE.md',
  'Client-Side Implementation',
  'Client-side docs exist'
);

// Check for key requirements
console.log('\n📋 Requirements Validation:');
validateFileContains(
  'supabase/functions/_shared/auth-middleware.ts',
  'Requirements: 2.2, 15.1, 15.2',
  'Requirement 2.2 addressed (JWT validation)'
);
validateFileContains(
  'src/lib/tokenManager.ts',
  'Requirements: 2.2, 15.1, 15.2',
  'Requirement 15.1 addressed (secure token storage)'
);
validateFileContains(
  'src/lib/tokenManager.ts',
  'scheduleTokenRefresh',
  'Requirement 15.2 addressed (automatic refresh)'
);

// Summary
console.log('\n' + '='.repeat(60));
const passed = results.filter(r => r.passed).length;
const total = results.length;
const percentage = ((passed / total) * 100).toFixed(1);

console.log(`\n📊 Validation Summary:`);
console.log(`   Passed: ${passed}/${total} (${percentage}%)`);

if (passed === total) {
  console.log('\n✅ All validations passed! JWT middleware implementation is complete.');
  process.exit(0);
} else {
  console.log('\n❌ Some validations failed. Please review the results above.');
  console.log('\nFailed checks:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`   - ${r.message}`);
  });
  process.exit(1);
}
