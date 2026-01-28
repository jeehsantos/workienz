import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Users, 
  Shield, 
  AlertTriangle, 
  Ban, 
  Undo2,
  Trash2,
  Crown,
  TrendingUp,
} from "lucide-react";

interface TopReferrer {
  user_id: string;
  referral_code: string;
  total_verified_referrals: number;
  bonus_credits_balance: number;
  bonus_credits_used: number;
  has_premium_article_access: boolean;
  is_shadow_banned: boolean;
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface FraudFlags {
  suspicious_ips: Array<{ ip: string; count: number; referrer_count: number }>;
  inactive_referrals: number;
  inactive_referral_details: Array<{
    id: string;
    referred_user_id: string;
    referrer_user_id: string;
    created_at: string;
  }>;
}

function useAdminReferralAction() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: {
      action: string;
      referral_id?: string;
      user_id?: string;
      reason?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("admin-referral-stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: action,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-referrals"] });
      toast({ title: "Success", description: "Action completed successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

function useTopReferrers() {
  return useQuery({
    queryKey: ["admin-referrals", "top-referrers"],
    queryFn: async (): Promise<TopReferrer[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("admin-referral-stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "list_top_referrers", limit: 50 },
      });

      if (error) throw error;
      return data.top_referrers || [];
    },
  });
}

function useFraudFlags() {
  return useQuery({
    queryKey: ["admin-referrals", "fraud-flags"],
    queryFn: async (): Promise<FraudFlags> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("admin-referral-stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "get_fraud_flags" },
      });

      if (error) throw error;
      return data;
    },
  });
}

export function AdminReferralManagement() {
  const { data: topReferrers, isLoading: loadingReferrers } = useTopReferrers();
  const { data: fraudFlags, isLoading: loadingFraud } = useFraudFlags();
  const adminAction = useAdminReferralAction();

  const handleShadowBan = async (userId: string) => {
    await adminAction.mutateAsync({
      action: "shadow_ban_user",
      user_id: userId,
      reason: "Suspicious referral activity",
    });
  };

  const handleUnban = async (userId: string) => {
    await adminAction.mutateAsync({
      action: "unban_user",
      user_id: userId,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Referral Management</h2>
          <p className="text-muted-foreground">
            Monitor referral activity and manage fraud prevention
          </p>
        </div>
      </div>

      <Tabs defaultValue="top-referrers">
        <TabsList>
          <TabsTrigger value="top-referrers" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Referrers
          </TabsTrigger>
          <TabsTrigger value="fraud-detection" className="gap-2">
            <Shield className="h-4 w-4" />
            Fraud Detection
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top-referrers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Referrers</CardTitle>
              <CardDescription>
                Users with the most verified referrals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReferrers ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !topReferrers?.length ? (
                <p className="text-muted-foreground text-center py-8">
                  No referrers yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-center">Verified</TableHead>
                      <TableHead className="text-center">Credits Used</TableHead>
                      <TableHead className="text-center">Premium</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topReferrers.map((referrer) => (
                      <TableRow key={referrer.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={referrer.profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {referrer.profile?.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {referrer.profile?.full_name || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {referrer.profile?.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {referrer.referral_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {referrer.total_verified_referrals}
                        </TableCell>
                        <TableCell className="text-center">
                          {referrer.bonus_credits_used}/{referrer.bonus_credits_balance}
                        </TableCell>
                        <TableCell className="text-center">
                          {referrer.has_premium_article_access ? (
                            <Crown className="h-4 w-4 text-yellow-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {referrer.is_shadow_banned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {referrer.is_shadow_banned ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnban(referrer.user_id)}
                              disabled={adminAction.isPending}
                            >
                              <Undo2 className="h-4 w-4 mr-1" />
                              Unban
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <Ban className="h-4 w-4 mr-1" />
                                  Ban
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Shadow Ban User?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will prevent the user from using their referral credits. 
                                    Their existing credits will be frozen but not deleted.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleShadowBan(referrer.user_id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Shadow Ban
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fraud-detection" className="mt-4 space-y-4">
          {loadingFraud ? (
            <Card>
              <CardContent className="py-8">
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Suspicious IPs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Suspicious IP Activity
                  </CardTitle>
                  <CardDescription>
                    IP addresses with multiple referrals or multiple referrers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!fraudFlags?.suspicious_ips?.length ? (
                    <p className="text-muted-foreground text-center py-4">
                      No suspicious activity detected
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>IP Address</TableHead>
                          <TableHead className="text-center">Total Referrals</TableHead>
                          <TableHead className="text-center">Unique Referrers</TableHead>
                          <TableHead className="text-right">Risk Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fraudFlags.suspicious_ips.map((ip) => (
                          <TableRow key={ip.ip}>
                            <TableCell className="font-mono">{ip.ip}</TableCell>
                            <TableCell className="text-center">{ip.count}</TableCell>
                            <TableCell className="text-center">{ip.referrer_count}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={ip.referrer_count > 1 ? "destructive" : "secondary"}>
                                {ip.referrer_count > 1 ? "High" : "Medium"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Inactive Referrals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-500" />
                    Inactive Referred Users
                  </CardTitle>
                  <CardDescription>
                    Verified referrals where the referred user never completed their profile or applied to jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-2xl font-bold">
                        {fraudFlags?.inactive_referrals || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Potentially fraudulent referrals
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                  {fraudFlags?.inactive_referral_details && fraudFlags.inactive_referral_details.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Review these referrals and consider voiding suspicious ones using the referrer management above.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
