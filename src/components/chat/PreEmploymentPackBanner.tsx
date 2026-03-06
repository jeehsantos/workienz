import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, Send, CheckCircle2 } from "lucide-react";

interface PreEmploymentPackBannerProps {
  jobApplicationId: string | null;
  isEmployee: boolean;
  conversationStatus?: string;
  contractorUserId?: string;
  applicationStatus?: string;
  conversationId?: string;
  onPackShared?: () => void;
}

export function PreEmploymentPackBanner({
  jobApplicationId,
  isEmployee,
  conversationStatus,
  contractorUserId,
  applicationStatus,
  conversationId,
  onPackShared,
}: PreEmploymentPackBannerProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const fetchContractorFile = useCallback(async () => {
    if (!contractorUserId && !jobApplicationId) {
      setLoading(false);
      return;
    }

    try {
      let ctorUserId = contractorUserId;
      if (!ctorUserId && jobApplicationId) {
        const { data: appData } = await supabase
          .from("job_applications")
          .select("job_id")
          .eq("id", jobApplicationId)
          .maybeSingle();

        if (appData) {
          const { data: jobData } = await supabase
            .from("jobs")
            .select("contractor_id")
            .eq("id", appData.job_id)
            .maybeSingle();

          if (jobData) {
            const { data: cpData } = await supabase
              .from("contractor_profiles")
              .select("user_id, pre_employment_file_url, pre_employment_file_name")
              .eq("id", jobData.contractor_id)
              .maybeSingle();

            if (cpData) {
              ctorUserId = cpData.user_id;
              setFileUrl((cpData as any).pre_employment_file_url || null);
              setFileName((cpData as any).pre_employment_file_name || null);
            }
          }
        }
      } else if (ctorUserId) {
        const { data: cpData } = await supabase
          .from("contractor_profiles")
          .select("pre_employment_file_url, pre_employment_file_name")
          .eq("user_id", ctorUserId)
          .maybeSingle();

        if (cpData) {
          setFileUrl((cpData as any).pre_employment_file_url || null);
          setFileName((cpData as any).pre_employment_file_name || null);
        }
      }

      // Check if a pack record already exists for this application
      if (jobApplicationId) {
        const { data: packData } = await supabase
          .from("application_pre_employment_packs")
          .select("id, status")
          .eq("job_application_id", jobApplicationId)
          .maybeSingle();

        if (packData && packData.status !== "cancelled") {
          setSent(true);
        }
      }
    } catch (error) {
      console.error("Error fetching pre-employment file:", error);
    } finally {
      setLoading(false);
    }
  }, [contractorUserId, jobApplicationId]);

  useEffect(() => {
    fetchContractorFile();
  }, [fetchContractorFile]);

  const handleShareWithEmployee = async () => {
    if (!jobApplicationId || !user || !fileUrl || !conversationId) return;
    setSending(true);

    try {
      // 1. Create a pack record
      const { error: packError } = await supabase
        .from("application_pre_employment_packs")
        .insert({
          job_application_id: jobApplicationId,
          required_by_user_id: user.id,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          answers: { file_url: fileUrl, file_name: fileName },
        });

      if (packError) {
        toast({ title: "Error", description: "Failed to share the file.", variant: "destructive" });
        setSending(false);
        return;
      }

      // 2. Send a special message in the chat so it appears for both parties
      const messageContent = `[PRE_EMPLOYMENT_PACK]${JSON.stringify({ file_url: fileUrl, file_name: fileName })}`;
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_user_id: user.id,
        content: messageContent,
      });

      if (msgError) {
        console.error("Error sending pack message:", msgError);
      }

      setSent(true);
      onPackShared?.();
      toast({
        title: "Pre-Employment Pack Sent",
        description: "The document has been shared in the chat.",
      });
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;
  if (!fileUrl || !fileName) return null;

  // Only show for contractors (employees see it in chat)
  if (isEmployee) return null;

  const isHiredOrPooled = applicationStatus === "hired" || applicationStatus === "approved_to_pool";

  // Only show after the candidate is hired or added to pool, and not yet sent
  if (!isHiredOrPooled || sent) return null;

  return (
    <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex-shrink-0">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground truncate">
            Share <span className="font-medium text-foreground">{fileName}</span> with the candidate
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleShareWithEmployee} disabled={sending} className="h-7 text-xs flex-shrink-0">
          {sending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Send className="w-3 h-3 mr-1" />
          )}
          Send in Chat
        </Button>
      </div>
    </div>
  );
}
