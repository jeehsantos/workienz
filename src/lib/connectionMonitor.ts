/**
 * Connection Pool Monitoring
 * 
 * Provides comprehensive monitoring and alerting for database connection pool health.
 * Tracks connection acquisition times, pool exhaustion events, and connection metrics.
 * 
 * Requirements: 10.5 - Log connection pool metrics for analysis
 */

import { getConnectionMetrics } from '@/integrations/supabase/client';

export interface ConnectionPoolAlert {
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  metrics: ConnectionPoolMetrics;
}

export interface ConnectionPoolMetrics {
  totalRequests: number;
  activeConnections: number;
  failedConnections: number;
  retryAttempts: number;
  lastConnectionTime: number;
  failureRate: number;
  averageAcquisitionTime: number;
  poolExhaustionEvents: number;
}

export interface ConnectionAcquisitionRecord {
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
}

class ConnectionPoolMonitor {
  private acquisitionTimes: number[] = [];
  private poolExhaustionCount = 0;
  private alerts: ConnectionPoolAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Thresholds for alerts
  private readonly THRESHOLDS = {
    HIGH_FAILURE_RATE: 5, // 5% failure rate
    HIGH_ACTIVE_CONNECTIONS: 80, // 80% of max connections
    SLOW_ACQUISITION_TIME: 5000, // 5 seconds
    MAX_ALERTS: 100, // Keep last 100 alerts
  };

  /**
   * Start monitoring connection pool health
   * @param intervalMs - Monitoring interval in milliseconds (default: 60000 = 1 minute)
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      console.warn('[ConnectionMonitor] Monitoring already started');
      return;
    }

    console.info('[ConnectionMonitor] Starting connection pool monitoring');
    
    this.monitoringInterval = setInterval(() => {
      this.checkPoolHealth();
    }, intervalMs);

    // Initial health check
    this.checkPoolHealth();
  }

  /**
   * Stop monitoring connection pool
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.info('[ConnectionMonitor] Stopped connection pool monitoring');
    }
  }

  /**
   * Record a connection acquisition attempt
   * @param duration - Time taken to acquire connection in milliseconds
   * @param success - Whether the acquisition was successful
   */
  recordAcquisition(duration: number, success: boolean): void {
    this.acquisitionTimes.push(duration);
    
    // Keep only last 100 acquisition times
    if (this.acquisitionTimes.length > 100) {
      this.acquisitionTimes.shift();
    }

    // Check for slow acquisition
    if (duration > this.THRESHOLDS.SLOW_ACQUISITION_TIME) {
      this.addAlert({
        severity: 'warning',
        message: `Slow connection acquisition: ${duration}ms`,
        timestamp: new Date(),
        metrics: this.getMetrics(),
      });
    }
  }

  /**
   * Record a pool exhaustion event
   */
  recordPoolExhaustion(): void {
    this.poolExhaustionCount++;
    
    this.addAlert({
      severity: 'critical',
      message: 'Connection pool exhausted',
      timestamp: new Date(),
      metrics: this.getMetrics(),
    });
  }

  /**
   * Get current connection pool metrics
   */
  getMetrics(): ConnectionPoolMetrics {
    const baseMetrics = getConnectionMetrics();
    
    const failureRate = baseMetrics.totalRequests > 0
      ? (baseMetrics.failedConnections / baseMetrics.totalRequests) * 100
      : 0;

    const averageAcquisitionTime = this.acquisitionTimes.length > 0
      ? this.acquisitionTimes.reduce((sum, time) => sum + time, 0) / this.acquisitionTimes.length
      : 0;

    return {
      ...baseMetrics,
      failureRate,
      averageAcquisitionTime,
      poolExhaustionEvents: this.poolExhaustionCount,
    };
  }

  /**
   * Get recent alerts
   * @param count - Number of recent alerts to retrieve (default: 10)
   */
  getAlerts(count: number = 10): ConnectionPoolAlert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Check connection pool health and generate alerts if needed
   */
  private checkPoolHealth(): void {
    const metrics = this.getMetrics();

    // Check failure rate
    if (metrics.failureRate > this.THRESHOLDS.HIGH_FAILURE_RATE) {
      this.addAlert({
        severity: 'error',
        message: `High connection failure rate: ${metrics.failureRate.toFixed(2)}%`,
        timestamp: new Date(),
        metrics,
      });
    }

    // Check active connections
    if (metrics.activeConnections > this.THRESHOLDS.HIGH_ACTIVE_CONNECTIONS) {
      this.addAlert({
        severity: 'warning',
        message: `High number of active connections: ${metrics.activeConnections}`,
        timestamp: new Date(),
        metrics,
      });
    }

    // Check average acquisition time
    if (metrics.averageAcquisitionTime > this.THRESHOLDS.SLOW_ACQUISITION_TIME) {
      this.addAlert({
        severity: 'warning',
        message: `Slow average connection acquisition: ${metrics.averageAcquisitionTime.toFixed(0)}ms`,
        timestamp: new Date(),
        metrics,
      });
    }

    // Log metrics
    this.logMetrics(metrics);
  }

  /**
   * Add an alert to the alert history
   */
  private addAlert(alert: ConnectionPoolAlert): void {
    this.alerts.push(alert);

    // Keep only last N alerts
    if (this.alerts.length > this.THRESHOLDS.MAX_ALERTS) {
      this.alerts.shift();
    }

    // Log alert
    const logFn = alert.severity === 'critical' || alert.severity === 'error'
      ? console.error
      : alert.severity === 'warning'
      ? console.warn
      : console.info;

    logFn(`[ConnectionMonitor] ${alert.severity.toUpperCase()}: ${alert.message}`, {
      timestamp: alert.timestamp.toISOString(),
      metrics: alert.metrics,
    });
  }

  /**
   * Log connection pool metrics
   */
  private logMetrics(metrics: ConnectionPoolMetrics): void {
    console.info('[ConnectionMonitor] Connection Pool Health', {
      totalRequests: metrics.totalRequests,
      activeConnections: metrics.activeConnections,
      failedConnections: metrics.failedConnections,
      retryAttempts: metrics.retryAttempts,
      failureRate: `${metrics.failureRate.toFixed(2)}%`,
      averageAcquisitionTime: `${metrics.averageAcquisitionTime.toFixed(0)}ms`,
      poolExhaustionEvents: metrics.poolExhaustionEvents,
      timeSinceLastConnection: `${Date.now() - metrics.lastConnectionTime}ms`,
    });
  }

  /**
   * Get a health status summary
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: ConnectionPoolMetrics;
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for critical issues
    if (metrics.poolExhaustionEvents > 0) {
      issues.push('Pool exhaustion detected');
      status = 'unhealthy';
    }

    if (metrics.failureRate > this.THRESHOLDS.HIGH_FAILURE_RATE * 2) {
      issues.push(`Very high failure rate: ${metrics.failureRate.toFixed(2)}%`);
      status = 'unhealthy';
    }

    // Check for degraded performance
    if (status === 'healthy') {
      if (metrics.failureRate > this.THRESHOLDS.HIGH_FAILURE_RATE) {
        issues.push(`Elevated failure rate: ${metrics.failureRate.toFixed(2)}%`);
        status = 'degraded';
      }

      if (metrics.averageAcquisitionTime > this.THRESHOLDS.SLOW_ACQUISITION_TIME) {
        issues.push(`Slow connection acquisition: ${metrics.averageAcquisitionTime.toFixed(0)}ms`);
        status = 'degraded';
      }

      if (metrics.activeConnections > this.THRESHOLDS.HIGH_ACTIVE_CONNECTIONS) {
        issues.push(`High active connections: ${metrics.activeConnections}`);
        status = 'degraded';
      }
    }

    return {
      status,
      issues,
      metrics,
    };
  }
}

// Singleton instance
export const connectionMonitor = new ConnectionPoolMonitor();

// Auto-start monitoring in development mode
if (import.meta.env.DEV) {
  connectionMonitor.startMonitoring(60000); // Check every minute
}

// Export for use in production monitoring
export { ConnectionPoolMonitor };
