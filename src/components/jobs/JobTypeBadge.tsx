import { Badge } from "@/components/ui/badge";
import { JOB_TYPE_CONFIG, JobType } from "@/data/jobTypes";
import { memo } from "react";

interface JobTypeBadgeProps {
  jobType: JobType;
  className?: string;
}

/**
 * Reusable badge component for displaying job types with consistent color coding
 * Supports all job types: temporary, short-term, contract, volunteering
 * Includes dark mode compatibility
 */
export const JobTypeBadge = memo(({ jobType, className = "" }: JobTypeBadgeProps) => {
  const config = JOB_TYPE_CONFIG[jobType];
  
  if (!config) {
    return null;
  }

  return (
    <Badge className={`${config.color} ${className}`}>
      {config.label}
    </Badge>
  );
});

JobTypeBadge.displayName = 'JobTypeBadge';
