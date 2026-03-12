import { memo, useCallback } from "react";
import { User, Star, ArrowUpDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { AIApplicant } from "./types";

interface ApplicantListProps {
  applicants: AIApplicant[];
  selectedId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onCheckbox: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  showRank?: boolean;
}

const MatchBadge = memo(({ score }: { score: number | null }) => {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const rounded = Math.round(score);
  const color =
    rounded >= 90
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : rounded >= 70
      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-md inline-block ${color}`}>
      {rounded}%
    </span>
  );
});
MatchBadge.displayName = "MatchBadge";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  shortlisted: "Shortlisted",
  hired: "Hired",
  approved_to_pool: "In Talent Pool",
  rejected: "Rejected",
};

const StatusBadge = memo(({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    shortlisted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    hired: "bg-green-500/10 text-green-600 border-green-500/20",
    approved_to_pool: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  return (
    <Badge className={styles[status] || styles.pending} variant="outline">
      {STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
});
StatusBadge.displayName = "StatusBadge";

function ApplicantList({
  applicants,
  selectedId,
  selectedIds,
  onSelect,
  onCheckbox,
  onSelectAll,
  isLoading,
  hasMore,
  onLoadMore,
  showRank,
}: ApplicantListProps) {
  const allChecked = applicants.length > 0 && applicants.every((a) => selectedIds.includes(a.id));

  return (
    <div className="flex flex-col h-full">
      {/* List Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        <div className="col-span-1 flex items-center justify-center">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(c) => onSelectAll(!!c)}
            aria-label="Select all"
          />
        </div>
        {showRank && <div className="col-span-1 text-center">#</div>}
        <div className={`${showRank ? "col-span-4" : "col-span-5"} flex items-center gap-1`}>
          Candidate <ArrowUpDown size={10} />
        </div>
        <div className="col-span-2 flex items-center gap-1">
          Match <ArrowUpDown size={10} />
        </div>
        <div className="col-span-3 text-center">Status</div>
        <div className="col-span-1" />
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto">
        {applicants.map((emp) => (
          <div
            key={emp.id}
            onClick={() => onSelect(emp.id)}
            className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/50 items-center cursor-pointer transition-colors group ${
              selectedId === emp.id
                ? "bg-primary/5 border-primary/20"
                : "hover:bg-muted/30"
            }`}
          >
            <div
              className="col-span-1 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selectedIds.includes(emp.id)}
                onCheckedChange={() => onCheckbox(emp.id)}
              />
            </div>
            {showRank && (
              <div className="col-span-1 text-center text-xs font-bold text-muted-foreground">
                {emp.top_rank ?? "—"}
              </div>
            )}
            <div className={`${showRank ? "col-span-4" : "col-span-5"}`}>
              <div className="font-semibold text-sm truncate">
                {emp.profile?.full_name || "The Workie"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {emp.employee.city || "Location N/A"} •{" "}
                {new Date(emp.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="col-span-2">
              <MatchBadge score={emp.top_rank !== null ? emp.ai_score : emp.ai_score} />
            </div>
            <div className="col-span-3 flex justify-center">
              <StatusBadge status={emp.status} />
            </div>
            <div className="col-span-1 flex justify-end">
              {emp.ai_scoring_status === "processing" && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && hasMore && (
          <button
            onClick={onLoadMore}
            className="w-full py-3 text-sm font-medium text-primary hover:bg-muted/50 transition-colors"
          >
            Load more
          </button>
        )}

        {!isLoading && applicants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <User className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">No applicants in this view</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ApplicantList);
