/**
 * Query Performance Analyzer
 * 
 * Monitors and analyzes database query performance to identify slow queries,
 * N+1 patterns, and optimization opportunities.
 */

export interface QueryMetric {
  id: string;
  query: string;
  executionTime: number;
  timestamp: Date;
  context?: {
    page?: string;
    component?: string;
    user?: string;
  };
  rowsReturned?: number;
  error?: string;
}

export interface QueryAnalysis {
  query: string;
  executionTime: number;
  rowsScanned?: number;
  indexesUsed?: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceStats {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: number;
  fastestQuery: number;
  slowestQuery: number;
  p50: number;
  p95: number;
  p99: number;
}

class QueryAnalyzer {
  private metrics: QueryMetric[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 100; // ms
  private readonly MAX_METRICS = 1000; // Keep last 1000 queries
  private enabled: boolean = true;

  constructor() {
    // Only enable in development or when explicitly enabled
    this.enabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_QUERY_MONITORING === 'true';
  }

  /**
   * Record a query execution
   */
  recordQuery(metric: Omit<QueryMetric, 'id' | 'timestamp'>): void {
    if (!this.enabled) return;

    const queryMetric: QueryMetric = {
      ...metric,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    this.metrics.push(queryMetric);

    // Keep only the last MAX_METRICS queries
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Log slow queries
    if (queryMetric.executionTime > this.SLOW_QUERY_THRESHOLD) {
      console.warn('[QueryAnalyzer] Slow query detected:', {
        query: queryMetric.query,
        executionTime: `${queryMetric.executionTime}ms`,
        context: queryMetric.context,
      });
    }
  }

  /**
   * Analyze a query for performance issues
   */
  analyzeQuery(query: string, executionTime: number): QueryAnalysis {
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check execution time
    if (executionTime > 500) {
      recommendations.push('Query execution time exceeds 500ms - critical optimization needed');
      severity = 'critical';
    } else if (executionTime > 200) {
      recommendations.push('Query execution time exceeds 200ms - optimization recommended');
      severity = 'high';
    } else if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      recommendations.push('Query execution time exceeds 100ms - consider optimization');
      severity = 'medium';
    }

    // Check for SELECT *
    if (query.includes('SELECT *') || query.includes('select *')) {
      recommendations.push('Avoid SELECT * - specify only needed columns');
      if (severity === 'low') severity = 'medium';
    }

    // Check for missing WHERE clause on large tables
    const hasWhere = /WHERE|where/.test(query);
    const hasLimit = /LIMIT|limit/.test(query);
    if (!hasWhere && !hasLimit) {
      recommendations.push('Query lacks WHERE clause or LIMIT - may scan entire table');
      if (severity === 'low') severity = 'medium';
    }

    // Check for potential N+1 patterns (multiple similar queries)
    const similarQueries = this.findSimilarQueries(query);
    if (similarQueries.length > 5) {
      recommendations.push(`Potential N+1 query pattern detected (${similarQueries.length} similar queries) - consider using joins`);
      severity = 'high';
    }

    return {
      query,
      executionTime,
      recommendations,
      severity,
    };
  }

  /**
   * Find similar queries that might indicate N+1 pattern
   */
  private findSimilarQueries(query: string): QueryMetric[] {
    // Normalize query by removing specific values
    const normalizedQuery = query
      .replace(/['"][^'"]*['"]/g, '?') // Replace string literals
      .replace(/\d+/g, '?') // Replace numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    const recentWindow = Date.now() - 5000; // Last 5 seconds

    return this.metrics.filter(m => {
      const normalizedMetric = m.query
        .replace(/['"][^'"]*['"]/g, '?')
        .replace(/\d+/g, '?')
        .replace(/\s+/g, ' ')
        .trim();

      return (
        normalizedMetric === normalizedQuery &&
        m.timestamp.getTime() > recentWindow
      );
    });
  }

  /**
   * Get slow queries above threshold
   */
  getSlowQueries(threshold: number = this.SLOW_QUERY_THRESHOLD): QueryMetric[] {
    return this.metrics
      .filter(m => m.executionTime > threshold)
      .sort((a, b) => b.executionTime - a.executionTime);
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        fastestQuery: 0,
        slowestQuery: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const executionTimes = this.metrics
      .map(m => m.executionTime)
      .sort((a, b) => a - b);

    const sum = executionTimes.reduce((acc, time) => acc + time, 0);
    const slowQueries = this.metrics.filter(
      m => m.executionTime > this.SLOW_QUERY_THRESHOLD
    ).length;

    return {
      totalQueries: this.metrics.length,
      averageExecutionTime: sum / this.metrics.length,
      slowQueries,
      fastestQuery: executionTimes[0],
      slowestQuery: executionTimes[executionTimes.length - 1],
      p50: this.getPercentile(executionTimes, 0.5),
      p95: this.getPercentile(executionTimes, 0.95),
      p99: this.getPercentile(executionTimes, 0.99),
    };
  }

  /**
   * Calculate percentile value
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getStats();
    const slowQueries = this.getSlowQueries();

    let report = '=== Query Performance Report ===\n\n';
    report += `Total Queries: ${stats.totalQueries}\n`;
    report += `Average Execution Time: ${stats.averageExecutionTime.toFixed(2)}ms\n`;
    report += `Slow Queries (>${this.SLOW_QUERY_THRESHOLD}ms): ${stats.slowQueries}\n`;
    report += `Fastest Query: ${stats.fastestQuery.toFixed(2)}ms\n`;
    report += `Slowest Query: ${stats.slowestQuery.toFixed(2)}ms\n`;
    report += `P50: ${stats.p50.toFixed(2)}ms\n`;
    report += `P95: ${stats.p95.toFixed(2)}ms\n`;
    report += `P99: ${stats.p99.toFixed(2)}ms\n\n`;

    if (slowQueries.length > 0) {
      report += '=== Top 10 Slow Queries ===\n\n';
      slowQueries.slice(0, 10).forEach((metric, index) => {
        report += `${index + 1}. ${metric.executionTime.toFixed(2)}ms - ${metric.query.substring(0, 100)}...\n`;
        if (metric.context) {
          report += `   Context: ${JSON.stringify(metric.context)}\n`;
        }
        report += '\n';
      });
    }

    return report;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const queryAnalyzer = new QueryAnalyzer();

// Export helper function to wrap Supabase queries
export function monitorQuery<T>(
  queryPromise: Promise<T>,
  queryDescription: string,
  context?: QueryMetric['context']
): Promise<T> {
  const startTime = performance.now();

  return queryPromise
    .then(result => {
      const executionTime = performance.now() - startTime;
      queryAnalyzer.recordQuery({
        query: queryDescription,
        executionTime,
        context,
      });
      return result;
    })
    .catch(error => {
      const executionTime = performance.now() - startTime;
      queryAnalyzer.recordQuery({
        query: queryDescription,
        executionTime,
        context,
        error: error.message,
      });
      throw error;
    });
}
