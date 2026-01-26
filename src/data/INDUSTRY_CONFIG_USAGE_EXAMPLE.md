# INDUSTRY_CONFIG Usage Example

This file demonstrates how to use the `INDUSTRY_CONFIG` object for displaying industry badges with proper color coding.

## Import

```typescript
import { INDUSTRY_CONFIG, Industry } from '@/data/industries';
```

## Usage in Components

### Example 1: Industry Badge Component

```typescript
interface IndustryBadgeProps {
  industry: Industry | null;
}

export function IndustryBadge({ industry }: IndustryBadgeProps) {
  const displayIndustry = industry || "Other";
  const config = INDUSTRY_CONFIG[displayIndustry];
  
  return (
    <Badge variant="outline" className={config.color}>
      {displayIndustry}
    </Badge>
  );
}
```

### Example 2: Job Card with Industry Badge

```typescript
import { Badge } from '@/components/ui/badge';
import { INDUSTRY_CONFIG } from '@/data/industries';

export function JobCard({ job }) {
  const industry = job.industry || "Other";
  const industryConfig = INDUSTRY_CONFIG[industry];
  
  return (
    <div className="job-card">
      <div className="flex gap-2">
        {/* Job Type Badge */}
        <Badge className={jobTypeConfig.color}>
          {job.job_type}
        </Badge>
        
        {/* Industry Badge */}
        <Badge variant="outline" className={industryConfig.color}>
          {industry}
        </Badge>
      </div>
      
      {/* Rest of job card content */}
    </div>
  );
}
```

## Color Mappings

Each industry has a unique color scheme with light and dark mode support:

- **Agriculture**: Emerald (green tones)
- **Construction**: Orange
- **Education**: Indigo (deep blue)
- **Events & Hospitality**: Pink
- **Food & Beverage**: Rose (pink-red)
- **Healthcare**: Red
- **Logistics & Warehousing**: Slate (gray-blue)
- **Manufacturing**: Zinc (neutral gray)
- **Office & Admin**: Sky (light blue)
- **Retail**: Violet (purple)
- **Transportation**: Cyan (bright blue)
- **Other**: Gray (neutral)

## Dark Mode Support

All color classes include dark mode variants:
- Light mode: `bg-{color}-100 text-{color}-800`
- Dark mode: `dark:bg-{color}-900 dark:text-{color}-200`

This ensures proper contrast and readability in both themes.

## Null Industry Handling

When a job has a null or empty industry field, treat it as "Other":

```typescript
const industry = job.industry || "Other";
const config = INDUSTRY_CONFIG[industry];
```

This ensures all jobs have a valid industry badge.
