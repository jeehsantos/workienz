import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Loader2, Send, CheckCircle2 } from "lucide-react";

interface PreEmploymentPackBannerProps {
  jobApplicationId: string | null;
  isEmployee: boolean;
  conversationStatus?: string;
  contractorUserId?: string;
  applicationStatus?: string;
}

export function PreEmploymentPackBanner({
  jobApplicationId,
  isEmployee,
  conversationStatus,
  contractorUserId,
  applicationStatus,
}: PreEmploymentPackBannerProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sent, setSent] = useState(false);

  // Check if a pack already exists (file was already shared)
  const [packExists, setPackExists] = useState(false);

  const fetchContractorFile = useCallback(async () => {
    if (!contractorUserId && !jobApplicationId) {
      setLoading(false);
      return;
    }

    try {
      // Determine the contractor user ID
      let ctorUserId = contractorUserId;
      if (!ctorUserId && jobApplicationId) {
        // Get from the application -> job -> contractor_profiles chain
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
          setPackExists(true);
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
    if (!jobApplicationId || !user || !fileUrl) return;
    setSending(true);

    try {
      // Create a pack record marking the file as shared
      const { error } = await supabase
        .from("application_pre_employment_packs")
        .insert({
          job_application_id: jobApplicationId,
          required_by_user_id: user.id,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          answers: { file_url: fileUrl, file_name: fileName },
        });

      if (error) {
        toast({ title: "Error", description: "Failed to share the file.", variant: "destructive" });
        return;
      }

      setSent(true);
      setPackExists(true);
      toast({
        title: "Pre-Employment Pack Sent",
        description: "The candidate can now download the pre-employment document.",
      });
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async () => {
    if (!fileUrl) return;
    setDownloading(true);

    try {
      // Generate a signed URL for download
      const { data, error } = await supabase.storage
        .from("pre-employment-docs")
        .createSignedUrl(fileUrl, 60 * 5); // 5 min expiry

      if (error || !data?.signedUrl) {
        toast({ title: "Error", description: "Failed to generate download link.", variant: "destructive" });
        return;
      }

      // Open in new tab for download
      window.open(data.signedUrl, "_blank");
    } catch {
      toast({ title: "Error", description: "Download failed.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return null;

  // No file uploaded by contractor
  if (!fileUrl || !fileName) return null;

  const isHiredOrPooled = applicationStatus === "hired" || applicationStatus === "approved_to_pool";

  // CONTRACTOR VIEW
  if (!isEmployee) {
    // Only show after the candidate is hired or added to pool
    if (!isHiredOrPooled && !sent) return null;

    return (
      <div className="bg-muted/40 border-b border-border px-4 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {sent
                  ? "Pre-employment pack has been shared with the candidate."
                  : "Share this document with the hired candidate."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {sent ? (
              <Badge variant="outline" className="gap-1 text-xs">
                <CheckCircle2 className="w-3 h-3" />
                Sent
              </Badge>
            ) : (
              <Button size="sm" onClick={handleShareWithEmployee} disabled={sending} className="h-8">
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                Share with Candidate
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // EMPLOYEE VIEW - only show if the pack has been sent
  if (!packExists) return null;

  return (
    <div className="bg-primary/5 border-b border-primary/20 px-4 py-3 flex-shrink-0">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Pre-Employment Pack</p>
            <p className="text-xs text-muted-foreground">
              Your employer has shared a document for you to complete. Download, fill it in, and send it back via email or attach it in the chat.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleDownload} disabled={downloading} className="h-8 flex-shrink-0">
          {downloading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          Download
        </Button>
      </div>
    </div>
  );
}
