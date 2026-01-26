/**
 * Slow Query Identification Script
 * 
 * Analyzes the codebase to identify:
 * - Queries that may be slow (> 100ms)
 * - N+1 query patterns
 * - Full table scans
 * - Inefficient joins
 * - Missing indexes
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fs from 'fs';
import * as path from 'path';

interface QueryIssue {
  file: string;
  line: number;
  type: 'slow_query' | 'n_plus_1' | 'full_scan' | 'inefficient_join' | 'missing_index';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  code: string;
  recommendation: string;
}

interface AnalysisReport {
  totalFiles: number;
  totalIssues: number;
  issuesByType: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issues: QueryIssue[];
}

class SlowQueryAnalyzer {
  private issues: QueryIssue[] = [];
  private filesAnalyzed = 0;

  /**
   * Analyze all TypeScript/TSX files in a directory
   */
  analyzeDirectory(dir: string): void {
    const files = this.getFiles(dir, ['.ts', '.tsx']);
    
    for (const file of files) {
      this.analyzeFile(file);
    }
  }

  /**
   * Get all files with specific extensions recursively
   */
  private getFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules and other directories
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            files.push(...this.getFiles(fullPath, extensions));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
    
    return files;
  }

  /**
   * Analyze a single file for query issues
   */
  private analyzeFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      this.filesAnalyzed++;
      
      // Check for N+1 patterns
      this.detectNPlusOnePatterns(filePath, lines);
      
      // Check for full table scans
      this.detectFullTableScans(filePath, lines);
      
      // Check for inefficient queries
      this.detectInefficientQueries(filePath, lines);
      
      // Check for missing pagination
      this.detectMissingPagination(filePath, lines);
      
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }
  }

  /**
   * Detect N+1 query patterns
   */
  private detectNPlusOnePatterns(filePath: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Pattern 1: Loop with query inside
      if (line.includes('.map(') || line.includes('.forEach(')) {
        // Check next 10 lines for Supabase query
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('supabase.from(') || lines[j].includes('.select(')) {
            this.issues.push({
              file: filePath,
              line: i + 1,
              type: 'n_plus_1',
              severity: 'high',
              description: 'Potential N+1 query pattern: Query inside loop/map',
              code: lines.slice(i, Math.min(i + 5, lines.length)).join('\n'),
              recommendation: 'Use joins or fetch related data in a single query with .in() clause',
            });
            break;
          }
        }
      }
      
      // Pattern 2: Sequential queries for related data
      if (line.includes('supabase.from(') && i < lines.length - 5) {
        let queryCount = 1;
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          if (lines[j].includes('supabase.from(')) {
            queryCount++;
          }
        }
        
        if (queryCount >= 3) {
          this.issues.push({
            file: filePath,
            line: i + 1,
            type: 'n_plus_1',
            severity: 'high',
            description: `Multiple sequential queries detected (${queryCount} queries)`,
            code: lines.slice(i, Math.min(i + 10, lines.length)).join('\n'),
            recommendation: 'Combine queries using joins or batch fetching',
          });
        }
      }
    }
  }

  /**
   * Detect full table scans
   */
  private detectFullTableScans(filePath: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for queries without WHERE or LIMIT
      if (line.includes('supabase.from(')) {
        let hasWhere = false;
        let hasLimit = false;
        let hasFilter = false;
        
        // Check next 10 lines
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          const checkLine = lines[j];
          if (checkLine.includes('.eq(') || checkLine.includes('.filter(') || 
              checkLine.includes('.match(') || checkLine.includes('.in(')) {
            hasFilter = true;
          }
          if (checkLine.includes('.limit(') || checkLine.includes('.range(')) {
            hasLimit = true;
          }
        }
        
        if (!hasFilter && !hasLimit) {
          this.issues.push({
            file: filePath,
            line: i + 1,
            type: 'full_scan',
            severity: 'critical',
            description: 'Query without WHERE clause or LIMIT - will scan entire table',
            code: lines.slice(i, Math.min(i + 5, lines.length)).join('\n'),
            recommendation: 'Add .eq(), .filter(), or .limit() to constrain query results',
          });
        }
      }
    }
  }

  /**
   * Detect inefficient queries
   */
  private detectInefficientQueries(filePath: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for SELECT *
      if (line.includes('.select("*")') || line.includes(".select('*')")) {
        this.issues.push({
          file: filePath,
          line: i + 1,
          type: 'slow_query',
          severity: 'medium',
          description: 'Using SELECT * - fetches all columns',
          code: line.trim(),
          recommendation: 'Specify only needed columns in .select() to reduce data transfer',
        });
      }
      
      // Check for missing indexes on filtered columns
      if (line.includes('.ilike(') || line.includes('.like(')) {
        this.issues.push({
          file: filePath,
          line: i + 1,
          type: 'missing_index',
          severity: 'medium',
          description: 'Using LIKE/ILIKE query - may be slow without proper index',
          code: line.trim(),
          recommendation: 'Consider using full-text search with GIN index for text searches',
        });
      }
      
      // Check for sorting without index
      if (line.includes('.order(')) {
        this.issues.push({
          file: filePath,
          line: i + 1,
          type: 'slow_query',
          severity: 'low',
          description: 'Sorting query - ensure column has index',
          code: line.trim(),
          recommendation: 'Verify that sorted column has an index for optimal performance',
        });
      }
    }
  }

  /**
   * Detect missing pagination
   */
  private detectMissingPagination(filePath: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for list queries without pagination
      if ((line.includes('supabase.from(') && 
           (line.includes('jobs') || line.includes('articles') || 
            line.includes('applications') || line.includes('messages')))) {
        
        let hasLimit = false;
        let hasRange = false;
        
        // Check next 10 lines
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('.limit(') || lines[j].includes('.range(')) {
            hasLimit = true;
            break;
          }
        }
        
        if (!hasLimit) {
          this.issues.push({
            file: filePath,
            line: i + 1,
            type: 'slow_query',
            severity: 'high',
            description: 'List query without pagination - may return too many rows',
            code: lines.slice(i, Math.min(i + 5, lines.length)).join('\n'),
            recommendation: 'Add .limit() or .range() to paginate results',
          });
        }
      }
    }
  }

  /**
   * Generate analysis report
   */
  generateReport(): AnalysisReport {
    const issuesByType: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};
    
    for (const issue of this.issues) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
    }
    
    return {
      totalFiles: this.filesAnalyzed,
      totalIssues: this.issues.length,
      issuesByType,
      issuesBySeverity,
      issues: this.issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
    };
  }

  /**
   * Print report to console
   */
  printReport(): void {
    const report = this.generateReport();
    
    console.log('\n=== Slow Query Analysis Report ===\n');
    console.log(`Files Analyzed: ${report.totalFiles}`);
    console.log(`Total Issues Found: ${report.totalIssues}\n`);
    
    console.log('Issues by Type:');
    for (const [type, count] of Object.entries(report.issuesByType)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log('');
    
    console.log('Issues by Severity:');
    for (const [severity, count] of Object.entries(report.issuesBySeverity)) {
      console.log(`  ${severity}: ${count}`);
    }
    console.log('\n');
    
    if (report.issues.length > 0) {
      console.log('=== Top Issues ===\n');
      
      // Group by severity
      const critical = report.issues.filter(i => i.severity === 'critical');
      const high = report.issues.filter(i => i.severity === 'high');
      const medium = report.issues.filter(i => i.severity === 'medium');
      
      if (critical.length > 0) {
        console.log('CRITICAL Issues:');
        critical.forEach((issue, index) => {
          this.printIssue(issue, index + 1);
        });
      }
      
      if (high.length > 0) {
        console.log('\nHIGH Priority Issues:');
        high.slice(0, 10).forEach((issue, index) => {
          this.printIssue(issue, index + 1);
        });
      }
      
      if (medium.length > 0) {
        console.log('\nMEDIUM Priority Issues (showing first 5):');
        medium.slice(0, 5).forEach((issue, index) => {
          this.printIssue(issue, index + 1);
        });
      }
    }
    
    console.log('\n=== Recommendations ===\n');
    console.log('1. Fix CRITICAL issues immediately - these cause severe performance problems');
    console.log('2. Address HIGH priority issues - these significantly impact performance');
    console.log('3. Review MEDIUM priority issues - optimize when possible');
    console.log('4. Use the query analyzer in development to monitor query performance');
    console.log('5. Add database indexes for frequently filtered/sorted columns');
    console.log('6. Use joins instead of sequential queries to avoid N+1 patterns');
    console.log('7. Always paginate list queries with .limit() or .range()');
    console.log('');
  }

  /**
   * Print a single issue
   */
  private printIssue(issue: QueryIssue, index: number): void {
    console.log(`\n${index}. [${issue.severity.toUpperCase()}] ${issue.description}`);
    console.log(`   File: ${issue.file}:${issue.line}`);
    console.log(`   Type: ${issue.type}`);
    console.log(`   Recommendation: ${issue.recommendation}`);
  }

  /**
   * Save report to file
   */
  saveReport(outputPath: string): void {
    const report = this.generateReport();
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${outputPath}`);
  }
}

// Run analysis
const analyzer = new SlowQueryAnalyzer();

console.log('Analyzing codebase for slow queries and performance issues...\n');

// Analyze src directory
analyzer.analyzeDirectory('./src');

// Print report
analyzer.printReport();

// Save detailed report
analyzer.saveReport('./docs/SLOW_QUERY_ANALYSIS.json');

console.log('\nAnalysis complete!');
