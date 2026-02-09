import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useContractorReferralStats, useGetContractorReferralCode } from "@/hooks/useContractorReferrals";
import {
  Gift,
  Copy,
  Share2,
  Twitter,
  Facebook,
  Users,
  Crown,
  Clock,
  CheckCircle2,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ContractorReferralDashboard() {
  const { toast } = useToast();
  const { data: stats, isLoading, error } = useContractorReferralStats();
  const getCode = useGetContractorReferralCode();
  const [shareOpen, setShareOpen] = useState(false);

  const handleCopyLink = () => {
    if (stats?.referral_code) {
      const referralLink = `${window.location.origin}/auth?mode=signup&ref=${stats.referral_code}`;
      navigator.clipboard.writeText(referralLink);
      toast({ title: "Link Copied!", description: "Your referral link has been copied to clipboard." });
    }
  };

  const handleShareTwitter = () => {
    if (stats?.referral_code) {
      const text = encodeURIComponent("Join me on Workie and start hiring! Sign up using my referral link:");
      const url = encodeURIComponent(`${window.location.origin}/auth?mode=signup&ref=${stats.referral_code}`);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=550,height=420');
    }
  };

  const handleShareFacebook = () => {
    if (stats?.referral_code) {
      const url = encodeURIComponent(`${window.location.origin}/auth?mode=signup&ref=${stats.referral_code}`);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=550,height=420');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Failed to load referral data. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-accent/10 to-primary/10 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/20 rounded-full">
            <Gift className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <CardTitle>Contractor Referral Program</CardTitle>
            <CardDescription>
              Refer fellow contractors and earn temporary Premium access
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* How it works */}
        <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How it works</p>
          <p>
            Share your link → Your friend signs up as a Contractor → They publish their first job →{" "}
            <span className="font-semibold text-foreground">
              You earn {stats?.days_per_referral || 3} Premium days!
            </span>
          </p>
        </div>

        {/* Referral Link Section */}
        {!stats?.has_referral_code ? (
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Start Referring Contractors</h3>
            <p className="text-muted-foreground mb-4">
              Get your unique referral link and start earning Premium access!
            </p>
            <Button onClick={() => getCode.mutateAsync()} disabled={getCode.isPending}>
              {getCode.isPending ? "Generating..." : "Get My Referral Link"}
            </Button>
          </div>
        ) : (
          <>
            {/* Share Section */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="mb-3">
                <span className="text-sm font-medium">Your Referral Link</span>
                <div className="mt-2 p-2 bg-background rounded border text-sm break-all text-muted-foreground">
                  {`${window.location.origin}/auth?mode=signup&ref=${stats.referral_code}`}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Popover open={shareOpen} onOpenChange={setShareOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2">
                    <div className="space-y-1">
                      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleShareTwitter}>
                        <Twitter className="h-4 w-4 mr-2" />
                        Twitter
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleShareFacebook}>
                        <Facebook className="h-4 w-4 mr-2" />
                        Facebook
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Premium Status */}
            {stats.premium_active && stats.premium_ends_at && (
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-accent/10 to-primary/10 rounded-lg border border-accent/20">
                <Crown className="h-5 w-5 text-accent-foreground" />
                <div>
                  <span className="font-medium text-accent-foreground">
                    Premium Active
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    until {new Date(stats.premium_ends_at).toLocaleDateString()} ({stats.premium_days_remaining} days remaining)
                  </span>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-primary">{stats.total_signups}</div>
                <div className="text-xs text-muted-foreground">Referred Signups</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.qualified_referrals}</div>
                <div className="text-xs text-muted-foreground">Qualified</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending_referrals}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-accent-foreground">{stats.total_days_earned}</div>
                <div className="text-xs text-muted-foreground">Days Earned</div>
              </div>
            </div>

            {/* Referral History */}
            {stats.referrals && stats.referrals.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Referral History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.referrals.map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <Briefcase className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{referral.referred_user_name}</span>
                          <div className="text-xs text-muted-foreground">
                            Signed up {new Date(referral.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {referral.status === "qualified" ? (
                          <div className="text-right">
                            <Badge variant="default" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Qualified
                            </Badge>
                            {referral.reward_days && (
                              <div className="text-xs text-muted-foreground mt-1">
                                +{referral.reward_days} days
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" /> Signed Up
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
