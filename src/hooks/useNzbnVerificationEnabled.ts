import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the platform-wide NZBN verification gate is enabled.
 * Controlled by the `nzbn_verification_enabled` row in `platform_settings`.
 */
export function useNzbnVerificationEnabled() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-settings", "nzbn_verification_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "nzbn_verification_enabled")
        .maybeSingle();
      return data?.setting_value === "true";
    },
    staleTime: 60_000,
  });

  return { enabled: !!data, isLoading };
}
