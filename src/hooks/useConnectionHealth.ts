/**
 * React Hook for Connection Pool Health Monitoring
 * 
 * Provides real-time connection pool health status and metrics
 * for display in admin dashboards or health check components.
 * 
 * Requirements: 10.5 - Log connection pool metrics for analysis
 */

import { useState, useEffect } from 'react';
import { connectionMonitor, type ConnectionPoolMetrics, type ConnectionPoolAlert } from '@/lib/connectionMonitor';

export interface ConnectionHealthState {
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: ConnectionPoolMetrics;
  alerts: ConnectionPoolAlert[];
  isMonitoring: boolean;
}

/**
 * Hook to monitor connection pool health
 * @param refreshInterval - How often to refresh health status (default: 30000ms = 30 seconds)
 */
export function useConnectionHealth(refreshInterval: number = 30000) {
  const [health, setHealth] = useState<ConnectionHealthState>({
    status: 'healthy',
    issues: [],
    metrics: {
      totalRequests: 0,
      activeConnections: 0,
      failedConnections: 0,
      retryAttempts: 0,
      lastConnectionTime: Date.now(),
      failureRate: 0,
      averageAcquisitionTime: 0,
      poolExhaustionEvents: 0,
    },
    alerts: [],
    isMonitoring: false,
  });

  useEffect(() => {
    // Start monitoring if not already started
    connectionMonitor.startMonitoring();

    // Update health status
    const updateHealth = () => {
      const healthStatus = connectionMonitor.getHealthStatus();
      const alerts = connectionMonitor.getAlerts(10);

      setHealth({
        ...healthStatus,
        alerts,
        isMonitoring: true,
      });
    };

    // Initial update
    updateHealth();

    // Set up interval for updates
    const interval = setInterval(updateHealth, refreshInterval);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, [refreshInterval]);

  return health;
}

/**
 * Hook to get current connection metrics
 */
export function useConnectionMetrics() {
  const [metrics, setMetrics] = useState<ConnectionPoolMetrics>(
    connectionMonitor.getMetrics()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(connectionMonitor.getMetrics());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

/**
 * Hook to get recent connection alerts
 * @param count - Number of recent alerts to retrieve
 */
export function useConnectionAlerts(count: number = 10) {
  const [alerts, setAlerts] = useState<ConnectionPoolAlert[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAlerts(connectionMonitor.getAlerts(count));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [count]);

  return alerts;
}
