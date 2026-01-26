// Industry options for job filtering
export const INDUSTRIES = [
  "Agriculture",
  "Construction",
  "Education",
  "Events & Hospitality",
  "Food & Beverage",
  "Healthcare",
  "Logistics & Warehousing",
  "Manufacturing",
  "Office & Admin",
  "Retail",
  "Transportation",
  "Other"
] as const;

export type Industry = typeof INDUSTRIES[number];

// Color configuration for industry badges with light/dark mode support
export const INDUSTRY_CONFIG: Record<Industry, {
  color: string; // Tailwind color classes for badge styling
  icon?: string; // Optional icon name for future use
}> = {
  "Agriculture": { 
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" 
  },
  "Construction": { 
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" 
  },
  "Education": { 
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" 
  },
  "Events & Hospitality": { 
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" 
  },
  "Food & Beverage": { 
    color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" 
  },
  "Healthcare": { 
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" 
  },
  "Logistics & Warehousing": { 
    color: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200" 
  },
  "Manufacturing": { 
    color: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200" 
  },
  "Office & Admin": { 
    color: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200" 
  },
  "Retail": { 
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" 
  },
  "Transportation": { 
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" 
  },
  "Other": { 
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" 
  }
};
