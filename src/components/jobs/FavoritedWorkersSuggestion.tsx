import { useState } from "react";
import { Star, MapPin, StickyNote, User, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { FavoriteWorker } from "@/hooks/useFavoriteWorkers";

interface FavoritedWorkersSuggestionProps {
  favorites: FavoriteWorker[];
  isLoading: boolean;
  jobId?: string | null;
  isPrivateJob?: boolean;
}

export function FavoritedWorkersSuggestion({ favorites, isLoading, jobId, isPrivateJob }: FavoritedWorkersSuggestionProps) {
  const { toast } = useToast();
  const [offeringTo, setOfferingTo] = useState<string | null>(null);

  if (isLoading || favorites.length === 0) return null;

  const handleOfferPosition = async (employeeUserId: string, employeeName: string) => {
    if (!jobId) return;
    
    setOfferingTo(employeeUserId);
    
    try {
      const { data, error } = await supabase.functions.invoke("offer-position", {
        body: { job_id: jobId, employee_user_id: employeeUserId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        toast({
          title: "Cannot Offer Position",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Position Offered! 🎉",
        description: `You've offered the position to ${employeeName}. They'll be notified and you can chat in the conversation.`,
      });
    } catch (err) {
      console.error("Error offering position:", err);
      toast({
        title: "Error",
        description: "Failed to offer position. Please try again.",
        variant: "destructive",
      });
    } finally {
      setOfferingTo(null);
    }
  };

  return (
    <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        Suggested Workers from Favorites
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        {isPrivateJob
          ? "This is a private job. Offer this position directly to your favorited workers below."
          : "These workers are in your favorites. After publishing, you can reach out to them via chat."}
      </p>
      <div className="space-y-2">
        {favorites.map((fav) => (
          <div
            key={fav.id}
            className="flex items-center gap-3 p-2.5 bg-card rounded-lg border border-border/50"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fav.employee_name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {fav.employee_headline && <span className="truncate">{fav.employee_headline}</span>}
                {fav.employee_city && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" />
                    {fav.employee_city}
                  </span>
                )}
              </div>
              {fav.note && (
                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                  <StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="truncate">{fav.note}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {fav.job_title && (
                <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                  {fav.job_title}
                </Badge>
              )}
              {isPrivateJob && jobId && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleOfferPosition(fav.employee_user_id, fav.employee_name)}
                  disabled={offeringTo === fav.employee_user_id}
                  className="gap-1.5"
                >
                  {offeringTo === fav.employee_user_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Offer</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
