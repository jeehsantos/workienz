/**
 * Environment Variable Validation
 * Feature: app-security-performance-optimization
 * 
 * Validates required environment variables and ensures secure configuration
 */

import { z } from 'zod';

/**
 * Schema for required environment variables
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY is required'),
  VITE_SUPABASE_PROJECT_ID: z.string().min(1, 'VITE_SUPABASE_PROJECT_ID is required'),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_STRIPE_PUBLISHABLE_KEY is required'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: EnvConfig;
}

/**
 * Validates environment variables against the schema
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if running in browser environment
  if (typeof window === 'undefined') {
    return {
      isValid: false,
      errors: ['Environment validation can only run in browser context'],
      warnings,
    };
  }

  // Collect environment variables
  const env = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  };

  // Check for missing variables before schema validation
  if (!env.VITE_SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL is not set. Please check your .env file.');
  }
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is not set. Please check your .env file.');
  }
  if (!env.VITE_SUPABASE_PROJECT_ID) {
    errors.push('VITE_SUPABASE_PROJECT_ID is not set. Please check your .env file.');
  }
  if (!env.VITE_STRIPE_PUBLISHABLE_KEY) {
    errors.push('VITE_STRIPE_PUBLISHABLE_KEY is not set. Please check your .env file.');
  }

  // If any required variables are missing, return early with helpful message
  if (errors.length > 0) {
    errors.push('');
    errors.push('To fix this:');
    errors.push('1. Copy .env.example to .env');
    errors.push('2. Fill in your Supabase credentials from the Supabase Dashboard');
    errors.push('3. Restart the development server');
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Validate against schema
  const result = envSchema.safeParse(env);

  if (!result.success) {
    result.error.errors.forEach(err => {
      errors.push(`${err.path.join('.')}: ${err.message}`);
    });
  }

  // Additional security checks
  if (env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_URL.startsWith('https://')) {
    warnings.push('VITE_SUPABASE_URL should use HTTPS for security');
  }

  // Check for development/test keys in production
  if (import.meta.env.PROD) {
    if (env.VITE_SUPABASE_URL?.includes('localhost') || env.VITE_SUPABASE_URL?.includes('127.0.0.1')) {
      errors.push('Production build should not use localhost URLs');
    }
    
    // Check for placeholder values in production
    if (env.VITE_SUPABASE_URL?.includes('your-project')) {
      errors.push('Production build is using placeholder Supabase URL. Please configure actual credentials.');
    }
    if (env.VITE_SUPABASE_PUBLISHABLE_KEY?.includes('your-anon-key')) {
      errors.push('Production build is using placeholder Supabase key. Please configure actual credentials.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: result.success ? result.data : undefined,
  };
}

/**
 * Validates environment variables and throws if invalid
 * This should be called at application startup
 */
export function validateEnvOrThrow(): EnvConfig {
  const result = validateEnv();

  if (!result.isValid) {
    const errorMessage = [
      '❌ Environment variable validation failed:',
      '',
      ...result.errors.map(err => `  • ${err}`),
      ...(result.warnings.length > 0 ? ['', '⚠️  Warnings:', ...result.warnings.map(warn => `  • ${warn}`)] : []),
    ].join('\n');

    throw new Error(errorMessage);
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:');
    result.warnings.forEach(warn => console.warn(`  • ${warn}`));
  }

  return result.config!;
}

/**
 * Checks if environment variables are properly configured
 */
export function checkEnvSecurity(): {
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check if .env file might be committed (this is a client-side check)
  // In a real implementation, this would be part of the build process

  // Check for common security issues
  const env = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  };

  // Check URL security
  if (env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_URL.startsWith('https://')) {
    issues.push('Supabase URL is not using HTTPS');
    recommendations.push('Update VITE_SUPABASE_URL to use HTTPS');
  }

  // Check for placeholder values
  if (env.VITE_SUPABASE_URL?.includes('your-project')) {
    issues.push('Supabase URL appears to be a placeholder');
    recommendations.push('Replace placeholder values with actual Supabase credentials');
  }

  if (env.VITE_SUPABASE_PUBLISHABLE_KEY?.includes('your-anon-key')) {
    issues.push('Supabase key appears to be a placeholder');
    recommendations.push('Replace placeholder values with actual Supabase credentials');
  }

  // Check key format (basic validation)
  if (env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
    issues.push('Supabase publishable key format appears invalid');
    recommendations.push('Verify the Supabase publishable key is correct');
  }

  // Check Stripe key format
  if (env.VITE_STRIPE_PUBLISHABLE_KEY) {
    if (!env.VITE_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_') && 
        !env.VITE_STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')) {
      issues.push('Stripe publishable key format appears invalid');
      recommendations.push('Verify the Stripe publishable key starts with "pk_test_" or "pk_live_"');
    }
    
    if (env.VITE_STRIPE_PUBLISHABLE_KEY.includes('your-stripe')) {
      issues.push('Stripe publishable key appears to be a placeholder');
      recommendations.push('Replace placeholder Stripe key with actual credentials');
    }
  }

  return {
    isSecure: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Gets a safe representation of environment config (without sensitive values)
 */
export function getSafeEnvInfo(): Record<string, string> {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'NOT_SET',
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY 
      ? `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY.substring(0, 10)}...` 
      : 'NOT_SET',
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID || 'NOT_SET',
    VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      ? `${import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY.substring(0, 10)}...`
      : 'NOT_SET',
    NODE_ENV: import.meta.env.MODE,
    IS_PRODUCTION: String(import.meta.env.PROD),
  };
}

