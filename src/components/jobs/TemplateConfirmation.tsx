import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Star, User, MessageSquare, Loader2, ArrowLeft, Send, Search, CheckCircle2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { FavoriteWorker } from "@/hooks/useFavoriteWorkers";

interface TemplateConfirmationProps {
  formData: {
    title: string;
    description: string;
    location_city: string;
    hourly_rate: string;
    industry: string;
  };
  favorites: FavoriteWorker[];
  favoritesLoading: boolean;
  isSubmitting: boolean;
  canPostJob: boolean;
  onPublish: () => void;
  onEditWizard: () => void;
}

export function TemplateConfirmation({
  formData,
  favorites,
  favoritesLoading,
  isSubmitting,
  canPostJob,
  onPublish,
  onEditWizard,
}: TemplateConfirmationProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messagingTo, setMessagingTo] = useState<string | null>(null);

  const handleSendMessage = async (fav: FavoriteWorker) => {
    setMessagingTo(fav.employee_user_id);
    try {
      // Check for existing conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("employee_user_id", fav.employee_user_id)
        .in("status", ["active", "pending"])
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        navigate(`/conversation/${existingConv.id}`);
        return;
      }

      // No existing conversation — just navigate to their profile for now
      toast({
        title: "No active conversation",
        description: `Post the job first, then you can offer the position to ${fav.employee_name}.`,
      });
    } catch {
      toast({ title: "Error", description: "Could not open conversation.", variant: "destructive" });
    } finally {
      setMessagingTo(null);
    }
  };

  // Filter favorites that previously worked on similar jobs
  const relevantFavorites = favorites.filter(
    (f) =>
      f.job_title?.toLowerCase().includes(formData.title.toLowerCase().split(" ")[0]) ||
      f.employee_industry?.toLowerCase() === formData.industry?.toLowerCase()
  );
  const displayFavorites = relevantFavorites.length > 0 ? relevantFavorites : favorites;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
      {/* Left: Template Details */}
      <Card className="shadow-soft">
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </div>
            <h2 className="text-xl font-bold font-display">Confirm Template Details</h2>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Job Title</label>
            <p className="mt-1 text-base border-b border-border/50 pb-3">{formData.title || "—"}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</label>
              <p className="mt-1 text-base border-b border-border/50 pb-3">{formData.location_city || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hourly Rate</label>
              <p className="mt-1 text-base border-b border-border/50 pb-3">
                {formData.hourly_rate ? `$${formData.hourly_rate}/hr` : "—"}
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
            <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap border border-border/30 rounded-lg p-3 bg-muted/30">
              {formData.description || "—"}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onEditWizard}
              className="flex-1 sm:flex-none"
            >
              Edit Details
            </Button>
            <Button
              onClick={onPublish}
              disabled={isSubmitting || !canPostJob}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Post This Job Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right: Favorite Workers Sidebar */}
      <div className="space-y-4">
        <Card className="shadow-soft">
          <CardContent className="pt-5 pb-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              Favorite Past Hires
            </h3>


            {favoritesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : displayFavorites.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No favorite workers yet. Save workers after hiring them!
              </p>
            ) : (
              <div className="space-y-3">
                {displayFavorites.slice(0, 5).map((fav) => (
                  <div key={fav.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate uppercase">{fav.employee_name}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Available
                            </Badge>
                          </div>
                          {fav.employee_headline && (
                            <p className="text-xs text-muted-foreground truncate">{fav.employee_headline}</p>
                          )}
                          {fav.job_title && (
                            <p className="text-[10px] text-primary/70 truncate mt-0.5">
                              Hired as: {fav.job_title}
                            </p>
                          )}
                        </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-primary hover:bg-primary/90"
                      onClick={() => handleSendMessage(fav)}
                      disabled={messagingTo === fav.employee_user_id}
                    >
                      {messagingTo === fav.employee_user_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5" />
                      )}
                      Send Message
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full border-dashed text-muted-foreground"
              asChild
            >
              <Link to="/contractor/search-workers">
                <Search className="w-3.5 h-3.5 mr-2" />
                Find more favorites
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Pro Tip Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-1">
              <Lightbulb className="w-4 h-4 text-primary" />
              Pro Tip
            </h4>
            <p className="text-xs text-primary/80">
              Hiring a favorite worker reduces onboarding time by 40%. They already know your preferences!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
