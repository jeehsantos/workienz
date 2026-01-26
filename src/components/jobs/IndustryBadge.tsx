import { Badge } from "@/components/ui/badge";
import { INDUSTRY_CONFIG, Industry } from "@/data/industries";
import { memo } from "react";

interface IndustryBadgeProps {
  industry: Industry;
  className?: string;
  variant?: "default" | "outline";
}

/**
 * Reusable badge component for displaying industries with consistent color coding
 * Supports all industries defined in INDUSTRY_CONFIG
 * Includes dark mode compatibility
 */
export const IndustryBadge = memo(({ 
  industry, 
  className = "", 
  variant = "outline" 
}: IndustryBadgeProps) => {
  const config = INDUSTRY_CONFIG[industry];
  
  if (!config) {
    return null;
  }

  return (
    <Badge variant={variant} className={`${config.color} ${className}`}>
      {industry}
    </Badge>
  );
});

IndustryBadge.displayName = 'IndustryBadge';
