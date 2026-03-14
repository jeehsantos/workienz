import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, Clock, AlertTriangle, XCircle, Lock } from "lucide-react";

interface Props {
  userId: string | undefined;
}

export function VerificationStatusCard({ userId }: Props) {
  const { data } = useQuery({
    queryKey: ["verification-status-card", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("work_verification_status, work_verification_expiry_date")
        .eq("user_id", userId)
        .maybeSingle();
      return profile;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const status = data?.work_verification_status || "unverified";
  const expiryDate = data?.work_verification_expiry_date;
  const isExpiringSoon =
    status === "verified" &&
    expiryDate &&
    new Date(expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  const daysLeft = expiryDate
    ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const config: Record<string, { icon: typeof ShieldCheck; label: string; desc: string; btnText: string; accent: string }> = {
    unverified: {
      icon: ShieldAlert,
      label: "Verify Work Rights",
      desc: "Verify your right to work in NZ to apply for jobs.",
      btnText: "Verify Now",
      accent: "bg-primary/10 text-primary",
    },
    pending: {
      icon: Clock,
      label: "Verification Pending",
      desc: "Your documents are being processed.",
      btnText: "View Status",
      accent: "bg-yellow-500/10 text-yellow-600",
    },
    verified: {
      icon: ShieldCheck,
      label: "Work Rights Verified",
      desc: isExpiringSoon
        ? `Your verification expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Re-verify soon.`
        : "Your work rights are verified. You can apply to jobs.",
      btnText: isExpiringSoon ? "Re-verify" : "View Details",
      accent: isExpiringSoon ? "bg-orange-500/10 text-orange-600" : "bg-green-500/10 text-green-600",
    },
    review_required: {
      icon: AlertTriangle,
      label: "Under Review",
      desc: "Your documents are being reviewed by our team.",
      btnText: "View Status",
      accent: "bg-orange-500/10 text-orange-600",
    },
    rejected: {
      icon: XCircle,
      label: "Verification Rejected",
      desc: "Your verification was unsuccessful. Please try again.",
      btnText: "Try Again",
      accent: "bg-destructive/10 text-destructive",
    },
    suspended: {
      icon: Lock,
      label: "Account Suspended",
      desc: "Your account is suspended. Contact support for help.",
      btnText: "View Details",
      accent: "bg-destructive/10 text-destructive",
    },
  };

  const c = config[status] || config.unverified;
  const Icon = c.icon;

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
      <div className={`w-12 h-12 rounded-lg ${c.accent} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold mb-2 font-display">{c.label}</h3>
      <p className="text-muted-foreground text-sm mb-4">{c.desc}</p>
      <Button
        variant={isExpiringSoon ? "default" : "outline"}
        size="sm"
        asChild
      >
        <Link to="/employee/verify">{c.btnText}</Link>
      </Button>
    </div>
  );
}
