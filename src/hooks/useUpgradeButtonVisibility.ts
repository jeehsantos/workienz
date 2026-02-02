import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

interface UseUpgradeButtonVisibilityResult {
  showUpgrade: boolean;
  upgradeText: string;
  upgradeLink: string;
  isLoading: boolean;
}

/**
 * Hook to determine upgrade button visibility and behavior based on:
 * 1. Platform setting `hide_upgrade_buttons` from platform_settings table
 * 2. User role (employee vs contractor)
 * 
 * Behavior Matrix:
 * | Setting Enabled | User Role  | Button Visible | Button Text          | Link      |
 * |-----------------|------------|----------------|----------------------|-----------|
 * | false           | Employee   | Yes            | Upgrade to Premium   | /pricing  |
 * | false           | Contractor | Yes            | Upgrade Your Plan    | /pricing  |
 * | true            | Employee   | No             | -                    | -         |
 * | true            | Contractor | Yes            | Become a Partner     | /contact  |
 */
export function useUpgradeButtonVisibility(): UseUpgradeButtonVisibilityResult {
  const { isContractor, isEmployee } = useAuthContext();

  const { data: hideUpgradeButtons, isLoading } = useQuery({
    queryKey: ["platform-setting", "hide_upgrade_buttons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "hide_upgrade_buttons")
        .maybeSingle();

      if (error) {
        console.error("Error fetching hide_upgrade_buttons setting:", error);
        return false;
      }

      return data?.setting_value === "true";
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const isContractorUser = isContractor();
  const isEmployeeUser = isEmployee();

  // Determine visibility and content based on setting and user role
  if (hideUpgradeButtons) {
    if (isEmployeeUser) {
      // Hide upgrade buttons for employees
      return {
        showUpgrade: false,
        upgradeText: "",
        upgradeLink: "",
        isLoading,
      };
    }
    
    if (isContractorUser) {
      // Show "Become a Partner" for contractors
      return {
        showUpgrade: true,
        upgradeText: "Become a Partner",
        upgradeLink: "/contact",
        isLoading,
      };
    }
  }

  // Default behavior (setting disabled or unknown role)
  if (isContractorUser) {
    return {
      showUpgrade: true,
      upgradeText: "Upgrade Your Plan",
      upgradeLink: "/pricing",
      isLoading,
    };
  }

  // Default for employees and others
  return {
    showUpgrade: true,
    upgradeText: "Upgrade to Premium",
    upgradeLink: "/pricing",
    isLoading,
  };
}
