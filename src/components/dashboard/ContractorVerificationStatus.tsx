import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, XCircle } from "lucide-react";
import { useNzbnVerificationEnabled } from "@/hooks/useNzbnVerificationEnabled";

interface Props {
  userId: string | undefined;
}

export function ContractorVerificationStatus({ userId }: Props) {
  const { enabled: nzbnEnabled, isLoading: toggleLoading } = useNzbnVerificationEnabled();

  const { data } = useQuery({
    queryKey: ["contractor-verification-status", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("contractor_profiles")
        .select("verification_status, nzbn, nzbn_data, company_name")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const status = data?.verification_status || "unverified";
  const entityName =
    (data?.nzbn_data as { entityName?: string } | null)?.entityName ||
    data?.company_name ||
    "";

  // When the admin toggle is OFF, only render the card if the contractor is already verified
  // (so they keep seeing their verified badge). Otherwise hide it entirely.
  if (toggleLoading) return null;
  if (!nzbnEnabled && status !== "verified") return null;

  const config = {
    verified: {
      Icon: ShieldCheck,
      label: "Company Verified",
      desc: entityName ? `Verified as ${entityName}.` : "Your company is verified with the NZBN.",
      btn: "View Details",
      accent: "bg-green-500/10 text-green-600",
      variant: "outline" as const,
    },
    rejected: {
      Icon: XCircle,
      label: "Verification Rejected",
      desc: "Your company verification was unsuccessful. Please try again.",
      btn: "Try Again",
      accent: "bg-destructive/10 text-destructive",
      variant: "default" as const,
    },
    unverified: {
      Icon: ShieldAlert,
      label: "Verify Your Company",
      desc: "Verify your NZBN to post jobs on Workie.",
      btn: "Verify Now",
      accent: "bg-orange-500/10 text-orange-600",
      variant: "default" as const,
    },
  } as const;

  const c = config[status as keyof typeof config] ?? config.unverified;
  const Icon = c.Icon;

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
      <div className={`w-12 h-12 rounded-lg ${c.accent} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold mb-2 font-display">{c.label}</h3>
      <p className="text-muted-foreground text-sm mb-4">{c.desc}</p>
      <Button variant={c.variant} size="sm" asChild>
        <Link to="/contractor/verify">{c.btn}</Link>
      </Button>
    </div>
  );
}
