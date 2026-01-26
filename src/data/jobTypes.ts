// Job type options for job filtering
export const JOB_TYPES = [
  "temporary",
  "short-term",
  "contract",
  "volunteering"
] as const;

export type JobType = typeof JOB_TYPES[number];

// Color configuration for job type badges with light/dark mode support
export const JOB_TYPE_CONFIG: Record<JobType, {
  label: string; // Display text for the job type
  color: string; // Tailwind color classes for badge styling
  icon?: string; // Optional icon name for future use
}> = {
  "temporary": { 
    label: "Temporary",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
  },
  "short-term": { 
    label: "Short-term",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
  },
  "contract": { 
    label: "Contract",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" 
  },
  "volunteering": { 
    label: "Volunteering",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" 
  }
};
