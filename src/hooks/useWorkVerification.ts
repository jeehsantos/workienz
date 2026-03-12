import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type VerificationStatus = "unverified" | "pending" | "verified" | "review_required" | "rejected";
export type DeclaredWorkStatus = "nz_citizen" | "resident" | "work_visa" | "student_visa";

export interface VerificationState {
  status: VerificationStatus;
  type: DeclaredWorkStatus | null;
  verificationDate: string | null;
  expiryDate: string | null;
  reviewReason: string | null;
}

export interface VerificationRequest {
  id: string;
  declared_status: DeclaredWorkStatus;
  status: string;
  ai_confidence: number | null;
  created_at: string;
  reviewed_at: string | null;
}

export function useWorkVerification(userId: string | undefined) {
  const { toast } = useToast();
  const [verificationState, setVerificationState] = useState<VerificationState>({
    status: "unverified",
    type: null,
    verificationDate: null,
    expiryDate: null,
    reviewReason: null,
  });
  const [latestRequest, setLatestRequest] = useState<VerificationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVerificationStatus = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("work_verification_status, work_verification_type, work_verification_date, work_verification_expiry_date, verification_review_reason")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile) {
        setVerificationState({
          status: (profile.work_verification_status as VerificationStatus) || "unverified",
          type: profile.work_verification_type as DeclaredWorkStatus | null,
          verificationDate: profile.work_verification_date,
          expiryDate: profile.work_verification_expiry_date,
          reviewReason: profile.verification_review_reason,
        });
      }

      // Fetch latest request
      const { data: request } = await supabase
        .from("user_work_verification_requests")
        .select("id, declared_status, status, ai_confidence, created_at, reviewed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (request) {
        setLatestRequest(request as VerificationRequest);
      }
    } catch (err) {
      console.error("Error fetching verification status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const submitVerification = useCallback(async (
    declaredStatus: DeclaredWorkStatus,
    file: File,
  ) => {
    if (!userId) return;
    setIsSubmitting(true);

    try {
      // 1. Upload file to verification-temp bucket
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-temp")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // 2. Create verification request row
      const { error: insertError } = await supabase
        .from("user_work_verification_requests")
        .insert({
          user_id: userId,
          declared_status: declaredStatus,
          document_path: filePath,
          status: "pending",
        });

      if (insertError) throw insertError;

      // 3. Update employee profile to pending
      const { error: updateError } = await supabase
        .from("employee_profiles")
        .update({
          work_verification_status: "pending",
          work_verification_type: declaredStatus,
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      // 4. Invoke edge function for AI processing
      await supabase.functions.invoke("process-work-verification", {
        body: {
          user_id: userId,
          declared_status: declaredStatus,
          document_path: filePath,
        },
      });

      toast({
        title: "Verification Submitted",
        description: "Your documents are being reviewed. We'll notify you of the result.",
      });

      // Refresh state
      await fetchVerificationStatus();
    } catch (err: any) {
      console.error("Verification submission error:", err);
      toast({
        title: "Submission Failed",
        description: err.message || "Failed to submit verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, toast, fetchVerificationStatus]);

  return {
    verificationState,
    latestRequest,
    isLoading,
    isSubmitting,
    fetchVerificationStatus,
    submitVerification,
  };
}
