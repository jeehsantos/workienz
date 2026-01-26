# JOB_TYPE_CONFIG Usage Example

This file demonstrates how to use the `JOB_TYPE_CONFIG` object for displaying job type badges with proper color coding.

## Import

```typescript
import { JOB_TYPE_CONFIG, JobType } from '@/data/jobTypes';
```

## Usage in Components

### Example 1: Job Type Badge Component

```typescript
interface JobTypeBadgeProps {
  jobType: JobType;
}

export function JobTypeBadge({ jobType }: JobTypeBadgeProps) {
  const config = JOB_TYPE_CONFIG[jobType];
  
  return (
    <Badge className={config.color}>
      {config.label}
    </Badge>
  );
}
```

### Example 2: Job Card with Job Type Badge

```typescript
import { Badge } from '@/components/ui/badge';
import { JOB_TYPE_CONFIG } from '@/data/jobTypes';

export function JobCard({ job }) {
  const jobTypeConfig = JOB_TYPE_CONFIG[job.job_type];
  
  return (
    <div className="job-card">
      <div className="flex gap-2">
        {/* Job Type Badge */}
        <Badge className={jobTypeConfig.color}>
          {jobTypeConfig.label}
        </Badge>
        
        {/* Industry Badge */}
        <Badge variant="outline" className={industryConfig.color}>
          {job.industry || "Other"}
        </Badge>
      </div>
      
      {/* Rest of job card content */}
    </div>
  );
}
```

### Example 3: Conditional Display for Volunteering Jobs

```typescript
import { JOB_TYPE_CONFIG } from '@/data/jobTypes';

export function JobCard({ job }) {
  const jobTypeConfig = JOB_TYPE_CONFIG[job.job_type];
  const showHourlyRate = job.job_type !== "volunteering" || 
                         (job.hourly_rate_min !== null && job.hourly_rate_min > 0);
  
  return (
    <div className="job-card">
      {/* Job Type Badge */}
      <Badge className={jobTypeConfig.color}>
        {jobTypeConfig.label}
      </Badge>
      
      {/* Conditional Hourly Rate Display */}
      {showHourlyRate && (job.hourly_rate_min || job.hourly_rate_max) && (
        <span className="flex items-center gap-1">
          <DollarSign className="w-4 h-4" />
          ${job.hourly_rate_min || "?"} - ${job.hourly_rate_max || "?"}/hr
        </span>
      )}
      
      {/* Volunteer Position Badge (when no rate) */}
      {job.job_type === "volunteering" && !showHourlyRate && (
        <Badge variant="outline" className={jobTypeConfig.color}>
          Volunteer Position
        </Badge>
      )}
    </div>
  );
}
```

## Color Mappings

Each job type has a unique color scheme with light and dark mode support:

- **Temporary**: Blue
- **Short-term**: Green
- **Contract**: Purple
- **Volunteering**: Amber (warm orange-yellow)

## Dark Mode Support

All color classes include dark mode variants:
- Light mode: `bg-{color}-100 text-{color}-800`
- Dark mode: `dark:bg-{color}-900 dark:text-{color}-200`

This ensures proper contrast and readability in both themes.

## Job Type Filter Options

When creating a filter dropdown, use the JOB_TYPES array and JOB_TYPE_CONFIG for labels:

```typescript
import { JOB_TYPES, JOB_TYPE_CONFIG } from '@/data/jobTypes';

export function JobTypeFilter({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="All Job Types" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Job Types</SelectItem>
        {JOB_TYPES.map((jobType) => (
          <SelectItem key={jobType} value={jobType}>
            {JOB_TYPE_CONFIG[jobType].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

## Type Safety

The `JobType` type is derived from the `JOB_TYPES` array, ensuring type safety:

```typescript
type JobType = "temporary" | "short-term" | "contract" | "volunteering"
```

This prevents typos and ensures all job types are properly handled in the configuration.
