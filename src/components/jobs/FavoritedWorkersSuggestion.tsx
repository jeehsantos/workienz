import { Star, MapPin, StickyNote, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FavoriteWorker } from "@/hooks/useFavoriteWorkers";

interface FavoritedWorkersSuggestionProps {
  favorites: FavoriteWorker[];
  isLoading: boolean;
}

export function FavoritedWorkersSuggestion({ favorites, isLoading }: FavoritedWorkersSuggestionProps) {
  if (isLoading || favorites.length === 0) return null;

  return (
    <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        Suggested Workers from Favorites
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        These workers are in your favorites. After publishing, you can reach out to them via chat.
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
            {fav.job_title && (
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {fav.job_title}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
