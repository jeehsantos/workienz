import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, Loader2, ExternalLink, XCircle, Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ContractorVerificationFlow() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [nzbn, setNzbn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["contractor-verification", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("contractor_profiles")
        .select("verification_status, nzbn, nzbn_data, verification_date, company_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const status = profile?.verification_status ?? "unverified";
  const entityName = useMemo(() => {
    const data = profile?.nzbn_data as { entityName?: string } | null;
    return data?.entityName || profile?.company_name || "";
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nzbn.replace(/\D/g, "");
    if (cleaned.length !== 13) {
      toast.error("NZBN must be exactly 13 digits");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-nzbn", {
        body: { nzbn: cleaned },
      });

      if (error) {
        // Try to extract structured error from the response
        let parsed: { error?: string; code?: string } = {};
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            parsed = await ctx.json();
          } catch {
            // ignore
          }
        }
        toast.error(parsed.error || error.message || "Verification failed");
        return;
      }

      if (data?.success) {
        toast.success(`Company verified: ${data.entityName}`);
        await queryClient.invalidateQueries({ queryKey: ["contractor-verification"] });
        await queryClient.invalidateQueries({ queryKey: ["contractor-verification-status"] });
      } else {
        toast.error(data?.error || "Verification failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "verified") {
    return (
      <Card className="border-green-500/30">
        <CardHeader>
          <div className="w-12 h-12 rounded-lg bg-green-500/10 text-green-600 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="font-display">Company Verified</CardTitle>
          <CardDescription>
            Your company has been verified against the NZ Business Number Register.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Registered name</p>
                <p className="font-medium">{entityName || "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">NZBN</p>
              <p className="font-mono text-sm">{profile?.nzbn}</p>
            </div>
            {profile?.verification_date && (
              <div>
                <p className="text-sm text-muted-foreground">Verified on</p>
                <p className="text-sm">
                  {new Date(profile.verification_date).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${
            status === "rejected"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          {status === "rejected" ? (
            <XCircle className="w-6 h-6" />
          ) : (
            <ShieldAlert className="w-6 h-6" />
          )}
        </div>
        <CardTitle className="font-display">
          {status === "rejected" ? "Verification Rejected" : "Verify Your Company"}
        </CardTitle>
        <CardDescription>
          We verify your business against the official{" "}
          <a
            href="https://www.nzbn.govt.nz/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline inline-flex items-center gap-1"
          >
            NZ Business Number (NZBN) Register
            <ExternalLink className="w-3 h-3" />
          </a>
          . You must verify before posting any jobs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nzbn">Your 13-digit NZBN</Label>
            <Input
              id="nzbn"
              inputMode="numeric"
              autoComplete="off"
              placeholder="9429000000000"
              value={nzbn}
              onChange={(e) => setNzbn(e.target.value.replace(/\D/g, "").slice(0, 13))}
              maxLength={13}
              disabled={submitting}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{nzbn.length}/13 digits</span>
              <a
                href="https://www.nzbn.govt.nz/search/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary hover:underline"
              >
                Find your NZBN
              </a>
            </div>
          </div>

          {status === "rejected" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Your previous verification attempt was unsuccessful. Please check the NZBN
              and try again.
            </div>
          )}

          <Button type="submit" disabled={submitting || nzbn.length !== 13} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying with NZBN…
              </>
            ) : (
              "Verify Company"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
