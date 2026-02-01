import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UploadPermission {
  canUpload: boolean;
  isPartner: boolean;
  isSubscriber: boolean;
  isLoading: boolean;
}

export function useContractorUploadPermission(userId: string | undefined): UploadPermission {
  const [permission, setPermission] = useState<UploadPermission>({
    canUpload: false,
    isPartner: false,
    isSubscriber: false,
    isLoading: true,
  });

  useEffect(() => {
    async function checkPermissions() {
      if (!userId) {
        setPermission({
          canUpload: false,
          isPartner: false,
          isSubscriber: false,
          isLoading: false,
        });
        return;
      }

      try {
        // Check if user is a partner
        const { data: partnerData } = await supabase
          .from("partners")
          .select("id, is_active")
          .eq("contractor_user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        const isPartner = !!partnerData;

        // Check if user has a paid subscription (not free tier)
        const { data: entitlements } = await supabase
          .from("contractor_entitlements")
          .select("plan_type, status, is_recurring")
          .eq("user_id", userId)
          .eq("status", "active");

        // Check for paid plans (recurring subscriptions, not free tier)
        const hasPaidPlan = entitlements?.some(
          (e) => 
            e.is_recurring && 
            !["free_tier", "free_contractor"].includes(e.plan_type)
        ) || false;

        const canUpload = isPartner || hasPaidPlan;

        setPermission({
          canUpload,
          isPartner,
          isSubscriber: hasPaidPlan,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error checking upload permissions:", error);
        setPermission({
          canUpload: false,
          isPartner: false,
          isSubscriber: false,
          isLoading: false,
        });
      }
    }

    checkPermissions();
  }, [userId]);

  return permission;
}
