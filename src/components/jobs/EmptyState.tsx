import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

/**
 * Enhanced empty state component for job search
 * Shows helpful messaging and clear filters button when no jobs match
 */
export function EmptyState({ hasActiveFilters, onClearFilters }: EmptyStateProps) {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">No Jobs Found</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-4">
        {hasActiveFilters 
          ? "We couldn't find any jobs matching your current filters. Try adjusting your search criteria."
          : "All current positions have been filled. Don't worry - new opportunities are posted regularly! Check back soon."
        }
      </p>
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClearFilters}>
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
