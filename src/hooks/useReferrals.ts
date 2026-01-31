import { useState } from "react";
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReferralStats {
  has_referral_code: boolean;
  referral_code: string | null;
  total_verified_referrals: number;
  pending_referrals: number;
  bonus_credits_balance: number;
  bonus_credits_used: number;
  remaining_credits: number;
  has_premium_article_access: boolean;
  is_shadow_banned?: boolean;
  referrals: Array<{
    id: string;
    status: string;
    created_at: string;
    verified_at: string | null;
    referred_user: {
      name: string;
      avatar_url: string | null;
    };
  }>;
}

export function useReferralStats(
  options?: Omit<UseQueryOptions<ReferralStats, Error>, "queryKey" | "queryFn">
) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ["referral-stats"],
    queryFn: async (): Promise<ReferralStats> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("get-referral-stats", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    staleTime: 60000, // 1 minute
    ...options,
  });
}

export function useGetReferralCode() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("get-referral-code", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
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

export function useProcessReferral() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (referralCode: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("process-referral", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { referral_code: referralCode },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Referral Applied",
        description: "Your referral has been recorded and will be verified once you confirm your email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Referral Error",
        description: error.message || "Failed to apply referral code",
        variant: "destructive",
      });
    },
  });
}

export function useVerifyReferral() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("verify-referral", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
      }
    },
  });
}
