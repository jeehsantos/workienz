/**
 * React hook for monitoring query performance
 */

import { useEffect } from 'react';
import { queryAnalyzer, monitorQuery, type QueryMetric } from '@/lib/queryAnalyzer';

/**
 * Hook to monitor a query with automatic context tracking
 */
export function useQueryMonitor<T>(
  queryPromise: Promise<T> | null,
  queryDescription: string,
  context?: Omit<QueryMetric['context'], 'component'>
): Promise<T> | null {
  const componentName = new Error().stack?.split('\n')[2]?.trim().split(' ')[1] || 'Unknown';

  if (!queryPromise) return null;

  return monitorQuery(queryPromise, queryDescription, {
    ...context,
    component: componentName,
  });
}

/**
 * Hook to display query performance stats in development
 */
export function useQueryStats() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const interval = setInterval(() => {
      const stats = queryAnalyzer.getStats();
      if (stats.totalQueries > 0) {
        console.group('📊 Query Performance Stats');
        console.log(`Total Queries: ${stats.totalQueries}`);
        console.log(`Average: ${stats.averageExecutionTime.toFixed(2)}ms`);
        console.log(`P95: ${stats.p95.toFixed(2)}ms`);
        console.log(`Slow Queries: ${stats.slowQueries}`);
        console.groupEnd();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);
}

/**
 * Hook to log query report on component unmount (useful for debugging)
 */
export function useQueryReport(enabled: boolean = false) {
  useEffect(() => {
    if (!enabled || !import.meta.env.DEV) return;

    return () => {
      const report = queryAnalyzer.generateReport();
      console.log(report);
    };
  }, [enabled]);
}
