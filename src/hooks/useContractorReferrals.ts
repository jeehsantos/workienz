import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";

interface ContractorReferralStats {
  has_referral_code: boolean;
  referral_code: string | null;
  total_signups: number;
  qualified_referrals: number;
  pending_referrals: number;
  total_days_earned: number;
  premium_active: boolean;
  premium_ends_at: string | null;
  premium_days_remaining: number;
  days_per_referral: number;
  referrals: Array<{
    id: string;
    status: string;
    created_at: string;
    qualified_at: string | null;
    referred_user_name: string;
    reward_days: number | null;
    reward_date: string | null;
  }>;
}

export function useContractorReferralStats() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ["contractor-referral-stats", user?.id],
    queryFn: async (): Promise<ContractorReferralStats> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("get-contractor-referral-stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data;
    },
    staleTime: 60000,
    enabled: !!user,
  });
}

export function useGetContractorReferralCode() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("get-contractor-referral-code", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-referral-stats", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get referral code",
        variant: "destructive",
      });
    },
  });
}
