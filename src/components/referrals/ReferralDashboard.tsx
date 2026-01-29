import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useReferralStats, useGetReferralCode } from "@/hooks/useReferrals";
import { 
  Gift, 
  Copy, 
  Share2, 
  Twitter, 
  Facebook, 
  Users, 
  Star, 
  CheckCircle2, 
  Clock, 
  Crown,
  Sparkles,
  Link as LinkIcon
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MILESTONES = [
  { referrals: 1, reward: "+1 Application Credit", icon: Gift },
  { referrals: 2, reward: "+2 More Credits (Total 3)", icon: Star },
  { referrals: 3, reward: "Premium Articles Access", icon: Crown },
  { referrals: 4, reward: "+1 Credit per Friend", icon: Sparkles },
];

export function ReferralDashboard() {
  const { toast } = useToast();
  const { data: stats, isLoading, error } = useReferralStats();
  const getReferralCode = useGetReferralCode();
  const [shareOpen, setShareOpen] = useState(false);

  const handleCopyCode = () => {
    if (stats?.referral_code) {
      navigator.clipboard.writeText(stats.referral_code);
      toast({
        title: "Code Copied!",
        description: "Your referral code has been copied to clipboard.",
      });
    }
  };

  const handleCopyLink = () => {
    if (stats?.referral_code) {
      const referralLink = `${window.location.origin}/auth?mode=signup&ref=${stats.referral_code}`;
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Link Copied!",
        description: "Your referral link has been copied to clipboard.",
      });
    }
  };

  const handleShareTwitter = () => {
    if (stats?.referral_code) {
      const text = encodeURIComponent("Join me on Workie and find your next job! Use my referral code for exclusive bonuses:");
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

  const handleGenerateCode = async () => {
    await getReferralCode.mutateAsync();
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

  // Calculate progress to next milestone
  const currentReferrals = stats?.total_verified_referrals || 0;
  const nextMilestone = MILESTONES.find(m => m.referrals > currentReferrals) || MILESTONES[MILESTONES.length - 1];
  const progress = currentReferrals >= 4 ? 100 : (currentReferrals / nextMilestone.referrals) * 100;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-full">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Referral Program</CardTitle>
            <CardDescription>
              Invite friends and earn bonus job application credits
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Referral Code Section */}
        {!stats?.has_referral_code ? (
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Start Referring Friends</h3>
            <p className="text-muted-foreground mb-4">
              Generate your unique referral code and start earning bonus application credits!
            </p>
            <Button onClick={handleGenerateCode} disabled={getReferralCode.isPending}>
              {getReferralCode.isPending ? "Generating..." : "Get My Referral Code"}
            </Button>
          </div>
        ) : (
          <>
            {/* Share Section */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Your Referral Code</span>
                <Badge variant="secondary" className="font-mono text-lg px-3 py-1">
                  {stats.referral_code}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <LinkIcon className="h-4 w-4 mr-2" />
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
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={handleShareTwitter}
                      >
                        <Twitter className="h-4 w-4 mr-2" />
                        Twitter
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={handleShareFacebook}
                      >
                        <Facebook className="h-4 w-4 mr-2" />
                        Facebook
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-primary">{stats.total_verified_referrals}</div>
                <div className="text-xs text-muted-foreground">Verified</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending_referrals}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.remaining_credits}</div>
                <div className="text-xs text-muted-foreground">Credits Left</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold">{stats.bonus_credits_used}</div>
                <div className="text-xs text-muted-foreground">Credits Used</div>
              </div>
            </div>

            {/* Premium Access Badge */}
            {stats.has_premium_article_access && (
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                <Crown className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-700 dark:text-yellow-400">
                  Premium Articles Access Unlocked!
                </span>
              </div>
            )}

            {/* Milestone Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progress to Next Reward</span>
                <span className="text-muted-foreground">
                  {currentReferrals >= 4 ? "All milestones complete!" : `${currentReferrals}/${nextMilestone.referrals} referrals`}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {/* Milestones */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {MILESTONES.map((milestone) => {
                  const isCompleted = currentReferrals >= milestone.referrals;
                  const MilestoneIcon = milestone.icon;
                  return (
                    <div 
                      key={milestone.referrals}
                      className={`relative p-3 rounded-lg border text-center transition-all ${
                        isCompleted 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      {isCompleted && (
                        <CheckCircle2 className="absolute -top-1 -right-1 h-4 w-4 text-green-500 bg-background rounded-full" />
                      )}
                      <MilestoneIcon className={`h-5 w-5 mx-auto mb-1 ${
                        isCompleted ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      <div className="text-xs font-medium">{milestone.referrals} Friend{milestone.referrals > 1 ? 's' : ''}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{milestone.reward}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Referral History */}
            {stats.referrals && stats.referrals.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Your Referrals</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.referrals.map((referral) => (
                    <div 
                      key={referral.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={referral.referred_user.avatar_url || undefined} />
                          <AvatarFallback>
                            {referral.referred_user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {referral.referred_user.name}
                        </span>
                      </div>
                      <Badge 
                        variant={referral.status === 'verified' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {referral.status === 'verified' ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Pending</>
                        )}
                      </Badge>
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
