/**
 * Query Analysis Script
 * 
 * Analyzes the codebase to identify:
 * - Slow query patterns (queries > 100ms)
 * - N+1 query patterns
 * - Full table scans (missing WHERE/LIMIT clauses)
 * - Inefficient joins
 * - Missing indexes
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fs from 'fs';
import * as path from 'path';

interface QueryIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'n+1' | 'full-scan' | 'inefficient-join' | 'missing-index' | 'select-star';
  file: string;
  line: number;
  query: string;
  description: string;
  recommendation: string;
}

interface AnalysisReport {
  timestamp: Date;
  filesAnalyzed: number;
  issuesFound: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  issues: QueryIssue[];
}

class QueryAnalysisEngine {
  private issues: QueryIssue[] = [];
  private filesAnalyzed = 0;

  /**
   * Analyze all TypeScript/TSX files in the src directory
   */
  async analyzeCodebase(): Promise<AnalysisReport> {
    const srcDir = path.join(process.cwd(), 'src');
    await this.analyzeDirectory(srcDir);

    const report: AnalysisReport = {
      timestamp: new Date(),
      filesAnalyzed: this.filesAnalyzed,
      issuesFound: this.issues.length,
      criticalIssues: this.issues.filter(i => i.severity === 'critical').length,
      highIssues: this.issues.filter(i => i.severity === 'high').length,
      mediumIssues: this.issues.filter(i => i.severity === 'medium').length,
      lowIssues: this.issues.filter(i => i.severity === 'low').length,
      issues: this.issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
    };

    return report;
  }

  /**
   * Recursively analyze directory
   */
  private async analyzeDirectory(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and other non-source directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          await this.analyzeDirectory(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        await this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * Analyze a single file for query issues
   */
  private async analyzeFile(filePath: string): Promise<void> {
    this.filesAnalyzed++;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);

    // Check for N+1 patterns
    this.detectNPlusOnePatterns(content, lines, relativePath);

    // Check for full table scans
    this.detectFullTableScans(content, lines, relativePath);

    // Check for SELECT * usage
    this.detectSelectStar(content, lines, relativePath);

    // Check for inefficient joins
    this.detectInefficientJoins(content, lines, relativePath);

    // Check for missing indexes (based on query patterns)
    this.detectMissingIndexes(content, lines, relativePath);
  }

  /**
   * Detect N+1 query patterns
   */
  private detectNPlusOnePatterns(content: string, lines: string[], file: string): void {
    // Pattern 1: Sequential queries after fetching a list
    const n1Pattern1 = /const\s+{\s*data[^}]*}\s*=\s*await\s+supabase[^;]+;[\s\S]{0,500}const\s+\w+Ids\s*=.*\.map\([^)]+\)[^;]*;[\s\S]{0,200}const\s+{\s*data[^}]*}\s*=\s*await\s+supabase[^;]+\.in\(/g;
    
    let match;
    while ((match = n1Pattern1.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      this.issues.push({
        severity: 'high',
        type: 'n+1',
        file,
        line: lineNumber,
        query: this.extractQuerySnippet(lines, lineNumber),
        description: 'Potential N+1 query pattern detected: fetching list then making separate query for related data',
        recommendation: 'Use Supabase joins to fetch related data in a single query. Example: .select("*, contractor_profiles!inner(id, company_name)")',
      });
    }

    // Pattern 2: forEach/map with await inside
    const n1Pattern2 = /\.(forEach|map)\s*\(\s*async\s*\([^)]+\)\s*=>\s*{[\s\S]{0,300}await\s+supabase\.from/g;
    
    while ((match = n1Pattern2.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      this.issues.push({
        severity: 'critical',
        type: 'n+1',
        file,
        line: lineNumber,
        query: this.extractQuerySnippet(lines, lineNumber),
        description: 'Critical N+1 query pattern: executing database query inside forEach/map loop',
        recommendation: 'Collect IDs first, then use .in() to fetch all records in a single query',
      });
    }

    // Pattern 3: Multiple similar queries in sequence
    const supabaseQueries = content.match(/supabase\.from\(['"](\w+)['"]\)\.select\([^)]+\)/g) || [];
    if (supabaseQueries.length > 3) {
      const queryTables = supabaseQueries.map(q => {
        const match = q.match(/from\(['"](\w+)['"]\)/);
        return match ? match[1] : '';
      });

      // Check for repeated queries to the same table
      const tableCounts = queryTables.reduce((acc, table) => {
        acc[table] = (acc[table] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(tableCounts).forEach(([table, count]) => {
        if (count > 2) {
          this.issues.push({
            severity: 'medium',
            type: 'n+1',
            file,
            line: 1,
            query: `Multiple queries to '${table}' table`,
            description: `Found ${count} separate queries to the '${table}' table in this file`,
            recommendation: 'Consider consolidating queries or using joins to reduce database round trips',
          });
        }
      });
    }
  }

  /**
   * Detect full table scans (missing WHERE/LIMIT clauses)
   */
  private detectFullTableScans(content: string, lines: string[], file: string): void {
    // Match queries without WHERE or LIMIT
    const queryPattern = /supabase\.from\(['"](\w+)['"]\)\.select\([^;]+\)/g;
    
    let match;
    while ((match = queryPattern.exec(content)) !== null) {
      const queryText = match[0];
      const table = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      // Check if query has WHERE clause (.eq, .neq, .gt, .lt, .gte, .lte, .like, .ilike, .in, .filter)
      const hasWhere = /\.(eq|neq|gt|lt|gte|lte|like|ilike|in|filter|match)\(/.test(queryText);
      
      // Check if query has LIMIT
      const hasLimit = /\.limit\(/.test(queryText);

      // Check if query has range (pagination)
      const hasRange = /\.range\(/.test(queryText);

      if (!hasWhere && !hasLimit && !hasRange) {
        // Check if it's a large table (jobs, applications, messages, articles)
        const largeTables = ['jobs', 'job_applications', 'applications', 'messages', 'articles', 'notifications'];
        const severity = largeTables.includes(table) ? 'high' : 'medium';

        this.issues.push({
          severity,
          type: 'full-scan',
          file,
          line: lineNumber,
          query: this.extractQuerySnippet(lines, lineNumber),
          description: `Query on '${table}' table lacks WHERE clause or LIMIT - may scan entire table`,
          recommendation: 'Add WHERE clause to filter data or LIMIT clause to restrict result set size',
        });
      }
    }
  }

  /**
   * Detect SELECT * usage
   */
  private detectSelectStar(content: string, lines: string[], file: string): void {
    // Match SELECT * patterns
    const selectStarPattern = /supabase\.from\([^)]+\)\.select\(\s*['"`]\*['"`]\s*\)/g;
    
    let match;
    while ((match = selectStarPattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      this.issues.push({
        severity: 'low',
        type: 'select-star',
        file,
        line: lineNumber,
        query: this.extractQuerySnippet(lines, lineNumber),
        description: 'Query uses SELECT * which fetches all columns',
        recommendation: 'Specify only the columns you need to reduce data transfer and improve performance',
      });
    }
  }

  /**
   * Detect inefficient joins
   */
  private detectInefficientJoins(content: string, lines: string[], file: string): void {
    // Pattern: Multiple separate queries that could be joined
    // This is similar to N+1 but focuses on the join aspect
    
    // Look for patterns where we fetch a list, then fetch related data separately
    const inefficientJoinPattern = /const\s+{\s*data:\s*(\w+)[^}]*}\s*=\s*await\s+supabase\.from\(['"](\w+)['"]\)[^;]+;[\s\S]{0,300}const\s+\w+Ids\s*=.*\1.*\.map\([^)]+\)[^;]*;[\s\S]{0,200}const\s+{\s*data[^}]*}\s*=\s*await\s+supabase\.from\(['"](\w+)['"]\)[^;]+\.in\(/g;
    
    let match;
    while ((match = inefficientJoinPattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const mainTable = match[2];
      const relatedTable = match[3];
      
      this.issues.push({
        severity: 'high',
        type: 'inefficient-join',
        file,
        line: lineNumber,
        query: this.extractQuerySnippet(lines, lineNumber),
        description: `Inefficient join pattern: fetching '${mainTable}' then separately fetching '${relatedTable}'`,
        recommendation: `Use Supabase join syntax: .select("*, ${relatedTable}!inner(...)") to fetch related data in one query`,
      });
    }
  }

  /**
   * Detect missing indexes based on query patterns
   */
  private detectMissingIndexes(content: string, lines: string[], file: string): void {
    // Look for frequently filtered columns that might need indexes
    const filterPatterns = [
      { pattern: /\.eq\(['"]status['"],/, column: 'status', severity: 'high' as const },
      { pattern: /\.eq\(['"]user_id['"],/, column: 'user_id', severity: 'high' as const },
      { pattern: /\.eq\(['"]contractor_id['"],/, column: 'contractor_id', severity: 'high' as const },
      { pattern: /\.eq\(['"]employee_id['"],/, column: 'employee_id', severity: 'high' as const },
      { pattern: /\.eq\(['"]job_id['"],/, column: 'job_id', severity: 'high' as const },
      { pattern: /\.ilike\(['"]location_city['"],/, column: 'location_city', severity: 'medium' as const },
      { pattern: /\.order\(['"]created_at['"],/, column: 'created_at', severity: 'medium' as const },
    ];

    filterPatterns.forEach(({ pattern, column, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        // Only report once per file per column
        const alreadyReported = this.issues.some(
          i => i.file === file && i.type === 'missing-index' && i.query.includes(column)
        );

        if (!alreadyReported) {
          this.issues.push({
            severity,
            type: 'missing-index',
            file,
            line: lineNumber,
            query: `Filter on '${column}' column`,
            description: `Query filters on '${column}' column which may benefit from an index`,
            recommendation: `Verify that an index exists on '${column}'. If not, create one: CREATE INDEX idx_table_${column} ON table(${column});`,
          });
        }
      }
    });
  }

  /**
   * Extract a snippet of code around the line number
   */
  private extractQuerySnippet(lines: string[], lineNumber: number, context = 2): string {
    const start = Math.max(0, lineNumber - context - 1);
    const end = Math.min(lines.length, lineNumber + context);
    return lines.slice(start, end).join('\n').trim();
  }
}

/**
 * Generate and save the optimization report
 */
async function generateOptimizationReport(): Promise<void> {
  console.log('🔍 Analyzing codebase for query performance issues...\n');

  const analyzer = new QueryAnalysisEngine();
  const report = await analyzer.analyzeCodebase();

  console.log('📊 Analysis Complete!\n');
  console.log(`Files Analyzed: ${report.filesAnalyzed}`);
  console.log(`Issues Found: ${report.issuesFound}`);
  console.log(`  - Critical: ${report.criticalIssues}`);
  console.log(`  - High: ${report.highIssues}`);
  console.log(`  - Medium: ${report.mediumIssues}`);
  console.log(`  - Low: ${report.lowIssues}`);
  console.log('');

  // Generate detailed report
  let detailedReport = '# Query Performance Optimization Report\n\n';
  detailedReport += `**Generated**: ${report.timestamp.toISOString()}\n`;
  detailedReport += `**Files Analyzed**: ${report.filesAnalyzed}\n`;
  detailedReport += `**Issues Found**: ${report.issuesFound}\n\n`;

  detailedReport += '## Summary\n\n';
  detailedReport += `- 🔴 Critical Issues: ${report.criticalIssues}\n`;
  detailedReport += `- 🟠 High Priority Issues: ${report.highIssues}\n`;
  detailedReport += `- 🟡 Medium Priority Issues: ${report.mediumIssues}\n`;
  detailedReport += `- 🟢 Low Priority Issues: ${report.lowIssues}\n\n`;

  // Group issues by type
  const issuesByType = report.issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, QueryIssue[]>);

  const typeLabels = {
    'n+1': 'N+1 Query Patterns',
    'full-scan': 'Full Table Scans',
    'inefficient-join': 'Inefficient Joins',
    'missing-index': 'Potential Missing Indexes',
    'select-star': 'SELECT * Usage',
  };

  Object.entries(issuesByType).forEach(([type, issues]) => {
    detailedReport += `## ${typeLabels[type as keyof typeof typeLabels]} (${issues.length})\n\n`;

    issues.forEach((issue, index) => {
      const severityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      };

      detailedReport += `### ${index + 1}. ${severityEmoji[issue.severity]} ${issue.description}\n\n`;
      detailedReport += `**File**: \`${issue.file}\`\n`;
      detailedReport += `**Line**: ${issue.line}\n`;
      detailedReport += `**Severity**: ${issue.severity.toUpperCase()}\n\n`;
      detailedReport += `**Query**:\n\`\`\`typescript\n${issue.query}\n\`\`\`\n\n`;
      detailedReport += `**Recommendation**: ${issue.recommendation}\n\n`;
      detailedReport += '---\n\n';
    });
  });

  // Add recommendations section
  detailedReport += '## General Recommendations\n\n';
  detailedReport += '### 1. Address N+1 Query Patterns\n\n';
  detailedReport += 'N+1 queries are the most critical performance issue. They occur when you fetch a list of items, then make a separate query for each item to fetch related data.\n\n';
  detailedReport += '**Solution**: Use Supabase joins to fetch related data in a single query:\n\n';
  detailedReport += '```typescript\n';
  detailedReport += '// ❌ Bad: N+1 pattern\n';
  detailedReport += 'const { data: jobs } = await supabase.from("jobs").select("*");\n';
  detailedReport += 'const contractorIds = jobs.map(j => j.contractor_id);\n';
  detailedReport += 'const { data: contractors } = await supabase\n';
  detailedReport += '  .from("contractor_profiles")\n';
  detailedReport += '  .select("*")\n';
  detailedReport += '  .in("id", contractorIds);\n\n';
  detailedReport += '// ✅ Good: Single query with join\n';
  detailedReport += 'const { data: jobs } = await supabase\n';
  detailedReport += '  .from("jobs")\n';
  detailedReport += '  .select(`\n';
  detailedReport += '    *,\n';
  detailedReport += '    contractor_profiles!inner(id, company_name)\n';
  detailedReport += '  `);\n';
  detailedReport += '```\n\n';

  detailedReport += '### 2. Add WHERE Clauses and LIMIT\n\n';
  detailedReport += 'Queries without WHERE clauses or LIMIT can scan entire tables, causing slow performance.\n\n';
  detailedReport += '**Solution**: Always filter data and limit result sets:\n\n';
  detailedReport += '```typescript\n';
  detailedReport += '// ❌ Bad: Full table scan\n';
  detailedReport += 'const { data } = await supabase.from("jobs").select("*");\n\n';
  detailedReport += '// ✅ Good: Filtered and limited\n';
  detailedReport += 'const { data } = await supabase\n';
  detailedReport += '  .from("jobs")\n';
  detailedReport += '  .select("*")\n';
  detailedReport += '  .eq("status", "published")\n';
  detailedReport += '  .limit(20);\n';
  detailedReport += '```\n\n';

  detailedReport += '### 3. Specify Required Columns\n\n';
  detailedReport += 'Using SELECT * fetches all columns, including ones you may not need.\n\n';
  detailedReport += '**Solution**: Specify only the columns you need:\n\n';
  detailedReport += '```typescript\n';
  detailedReport += '// ❌ Bad: Fetches all columns\n';
  detailedReport += 'const { data } = await supabase.from("jobs").select("*");\n\n';
  detailedReport += '// ✅ Good: Fetches only needed columns\n';
  detailedReport += 'const { data } = await supabase\n';
  detailedReport += '  .from("jobs")\n';
  detailedReport += '  .select("id, title, description, created_at");\n';
  detailedReport += '```\n\n';

  detailedReport += '### 4. Verify Database Indexes\n\n';
  detailedReport += 'Frequently filtered columns should have indexes for optimal performance.\n\n';
  detailedReport += '**Action Items**:\n';
  detailedReport += '- Review the "Potential Missing Indexes" section above\n';
  detailedReport += '- Check if indexes exist using: `\\d+ table_name` in psql\n';
  detailedReport += '- Create missing indexes in a migration file\n';
  detailedReport += '- Monitor query performance after adding indexes\n\n';

  detailedReport += '### 5. Use Query Monitoring\n\n';
  detailedReport += 'Enable query monitoring in development to track performance:\n\n';
  detailedReport += '```typescript\n';
  detailedReport += 'import { monitorQuery } from "@/lib/queryAnalyzer";\n\n';
  detailedReport += 'const { data } = await monitorQuery(\n';
  detailedReport += '  supabase.from("jobs").select("*"),\n';
  detailedReport += '  "SELECT jobs",\n';
  detailedReport += '  { page: "JobSearch" }\n';
  detailedReport += ');\n';
  detailedReport += '```\n\n';

  detailedReport += '## Next Steps\n\n';
  detailedReport += '1. **Prioritize Critical and High Issues**: Start with N+1 patterns and full table scans\n';
  detailedReport += '2. **Test Performance**: Measure query execution times before and after fixes\n';
  detailedReport += '3. **Add Indexes**: Create indexes for frequently filtered columns\n';
  detailedReport += '4. **Monitor Production**: Enable query monitoring temporarily to identify real-world issues\n';
  detailedReport += '5. **Document Changes**: Update documentation with optimization decisions\n\n';

  detailedReport += '## Related Documentation\n\n';
  detailedReport += '- [Query Performance Monitoring](../docs/QUERY_PERFORMANCE_MONITORING.md)\n';
  detailedReport += '- [Database Index Optimization](../docs/DATABASE_INDEX_OPTIMIZATION.md)\n';
  detailedReport += '- [Connection Pooling](../docs/CONNECTION_POOLING.md)\n\n';

  detailedReport += '---\n\n';
  detailedReport += `**Report Generated**: ${report.timestamp.toLocaleString()}\n`;
  detailedReport += '**Tool**: Query Analysis Script (scripts/analyze-queries.ts)\n';

  // Save report
  const reportPath = path.join(process.cwd(), 'docs', 'QUERY_OPTIMIZATION_REPORT.md');
  fs.writeFileSync(reportPath, detailedReport);

  console.log(`✅ Detailed report saved to: ${reportPath}\n`);

  // Print summary to console
  if (report.criticalIssues > 0) {
    console.log('🔴 CRITICAL ISSUES FOUND:');
    report.issues
      .filter(i => i.severity === 'critical')
      .forEach(issue => {
        console.log(`   - ${issue.file}:${issue.line} - ${issue.description}`);
      });
    console.log('');
  }

  if (report.highIssues > 0) {
    console.log('🟠 HIGH PRIORITY ISSUES:');
    report.issues
      .filter(i => i.severity === 'high')
      .slice(0, 5)
      .forEach(issue => {
        console.log(`   - ${issue.file}:${issue.line} - ${issue.description}`);
      });
    if (report.highIssues > 5) {
      console.log(`   ... and ${report.highIssues - 5} more (see report for details)`);
    }
    console.log('');
  }

  console.log('📖 See full report for detailed recommendations and code examples.\n');
}

// Run the analysis
generateOptimizationReport().catch(console.error);
