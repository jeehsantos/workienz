/**
 * Security Scanner Types and Interfaces
 * Feature: app-security-performance-optimization
 */

export type VulnerabilityType =
  | 'exposed_secret'
  | 'weak_authentication'
  | 'missing_rls'
  | 'missing_authorization'
  | 'client_exposure'
  | 'missing_validation'
  | 'insecure_payment';

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';

export type VulnerabilityStatus = 'open' | 'in_progress' | 'resolved' | 'false_positive';

export interface VulnerabilityLocation {
  file: string;
  line: number;
  column: number;
}

export interface SecurityVulnerability {
  id: string;
  type: VulnerabilityType;
  severity: VulnerabilitySeverity;
  location: VulnerabilityLocation;
  description: string;
  recommendation: string;
  cwe?: string;
  cvss?: number;
  status: VulnerabilityStatus;
  detectedAt: Date;
  resolvedAt?: Date;
}

export interface SecretVulnerability extends SecurityVulnerability {
  type: 'exposed_secret';
  secretType: 'api_key' | 'password' | 'token' | 'private_key' | 'connection_string';
  exposedValue?: string;
}

export interface AuthVulnerability extends SecurityVulnerability {
  type: 'weak_authentication';
  authIssue: 'missing_jwt_validation' | 'weak_password_policy' | 'missing_mfa' | 'insecure_session';
}

export interface RLSVulnerability extends SecurityVulnerability {
  type: 'missing_rls';
  tableName: string;
  missingPolicies: string[];
}

export interface AuthzVulnerability extends SecurityVulnerability {
  type: 'missing_authorization';
  endpoint: string;
  missingRoleChecks: string[];
}

export interface ExposureVulnerability extends SecurityVulnerability {
  type: 'client_exposure';
  exposureType: 'console_log' | 'local_storage' | 'session_storage' | 'network_request';
  sensitiveData: string;
}

export interface ValidationVulnerability extends SecurityVulnerability {
  type: 'missing_validation';
  inputField: string;
  validationType: 'sanitization' | 'type_check' | 'range_check' | 'format_check';
}

export interface PaymentVulnerability extends SecurityVulnerability {
  type: 'insecure_payment';
  paymentIssue: 'missing_webhook_verification' | 'card_data_storage' | 'missing_idempotency';
}

export interface SecurityReport {
  scanId: string;
  timestamp: Date;
  vulnerabilities: SecurityVulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byType: Record<VulnerabilityType, number>;
  };
  recommendations: string[];
}

export interface ScanConfig {
  includePatterns?: string[];
  excludePatterns?: string[];
  severityThreshold?: VulnerabilitySeverity;
  enabledChecks?: VulnerabilityType[];
}
