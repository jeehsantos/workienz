import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  Clock,
  Download,
  ShieldAlert,
  Eye,
} from "lucide-react";

interface Pack {
  id: string;
  status: string;
  template_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  downloaded_at: string | null;
  expires_at: string | null;
}

interface TemplateField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "file" | "checkbox" | "textarea";
  required: boolean;
}

interface TemplateSection {
  title: string;
  fields: TemplateField[];
}

interface TemplateSchema {
  sections: TemplateSection[];
}

interface PreEmploymentPackBannerProps {
  jobApplicationId: string | null;
  isEmployee: boolean;
}

export function PreEmploymentPackBanner({ jobApplicationId, isEmployee }: PreEmploymentPackBannerProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [pack, setPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [templateSchema, setTemplateSchema] = useState<TemplateSchema | null>(null);
  const [downloadedAnswers, setDownloadedAnswers] = useState<Record<string, unknown> | null>(null);

  const fetchPack = useCallback(async () => {
    if (!jobApplicationId || !user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("application_pre_employment_packs")
      .select("id, status, template_id, submitted_at, reviewed_at, downloaded_at, expires_at")
      .eq("job_application_id", jobApplicationId)
      .maybeSingle();

    if (data) {
      setPack(data as Pack);
      // Fetch template schema if template_id exists
      if (data.template_id) {
        const { data: tplData } = await supabase
          .from("contractor_pre_employment_templates")
          .select("template_schema")
          .eq("id", data.template_id)
          .maybeSingle();
        if (tplData?.template_schema) {
          setTemplateSchema(tplData.template_schema as unknown as TemplateSchema);
        }
      }
    }
    setLoading(false);
  }, [jobApplicationId, user]);

  useEffect(() => {
    fetchPack();
  }, [fetchPack]);

  const handleOpenForm = () => {
    setModalOpen(true);
    // Mark as in_progress if still 'required'
    if (pack?.status === "required") {
      supabase
        .from("application_pre_employment_packs")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", pack.id)
        .then(() => {
          setPack((prev) => (prev ? { ...prev, status: "in_progress" } : prev));
        });
    }
  };

  const handleSubmit = async () => {
    if (!pack || !templateSchema) return;

    // Validate required fields
    const allFields = templateSchema.sections.flatMap((s) => s.fields);
    const missing = allFields.filter(
      (f) =>
        f.required &&
        (!answers[f.id] ||
          (typeof answers[f.id] === "string" && !(answers[f.id] as string).trim()))
    );
    if (missing.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please complete: ${missing.map((m) => m.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke("submit-pack-answers", {
        body: { pack_id: pack.id, answers },
      });

      if (response.error) {
        toast({
          title: "Error",
          description: response.error.message || "Failed to submit form.",
          variant: "destructive",
        });
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }

      setPack((prev) =>
        prev
          ? { ...prev, status: "submitted", submitted_at: new Date().toISOString() }
          : prev
      );
      setModalOpen(false);
      setAnswers({}); // Clear local answers after encrypted submission
      toast({
        title: "✅ Form Submitted Securely",
        description:
          "Your pre-employment details have been encrypted and sent to the employer.",
      });
    } catch {
      toast({ title: "Error", description: "Failed to submit form.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!pack) return;
    setDownloading(true);
    try {
      const response = await supabase.functions.invoke("download-pack-answers", {
        body: { pack_id: pack.id },
      });

      if (response.error) {
        toast({
          title: "Error",
          description: response.error.message || "Failed to download pack.",
          variant: "destructive",
        });
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }

      setDownloadedAnswers(result.answers);
      if (result.template?.template_schema) {
        setTemplateSchema(result.template.template_schema as unknown as TemplateSchema);
      }
      setModalOpen(true);
      setPack((prev) =>
        prev
          ? {
              ...prev,
              status: "reviewed",
              downloaded_at: new Date().toISOString(),
              reviewed_at: new Date().toISOString(),
            }
          : prev
      );

      toast({
        title: "📥 Pack Downloaded",
        description: `Data will be auto-deleted after ${result.deletion_scheduled_at ? "48 hours" : "expiry"}.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to download.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleWaive = async () => {
    if (!pack) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("application_pre_employment_packs")
      .update({ status: "waived", reviewed_at: new Date().toISOString() })
      .eq("id", pack.id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: "Failed to waive pack.", variant: "destructive" });
      return;
    }
    setPack((prev) => (prev ? { ...prev, status: "waived" } : prev));
    toast({ title: "Pack Waived", description: "Pre-employment form requirement has been waived." });
  };

  if (loading || !pack) return null;
  if (pack.status === "cancelled") return null;
  if (!templateSchema && isEmployee && (pack.status === "required" || pack.status === "in_progress")) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <p className="text-sm">Pre-employment form pending — the employer has not yet assigned a template.</p>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    required: { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: <ClipboardList className="w-4 h-4 text-amber-600" />, label: "Required" },
    in_progress: { bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", icon: <Clock className="w-4 h-4 text-blue-600" />, label: "In Progress" },
    submitted: { bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800", icon: <CheckCircle2 className="w-4 h-4 text-green-600" />, label: "Submitted" },
    reviewed: { bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, label: "Downloaded" },
    waived: { bg: "bg-muted/50 border-border", icon: <CheckCircle2 className="w-4 h-4 text-muted-foreground" />, label: "Waived" },
  };

  const config = statusConfig[pack.status] || statusConfig.required;

  // Determine which data to show in modal
  const displayAnswers = downloadedAnswers || {};
  const isViewMode = !isEmployee || pack.status === "submitted" || pack.status === "reviewed";

  return (
    <>
      <div className={`${config.bg} border-b px-4 py-2.5 flex-shrink-0`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {config.icon}
            <div className="min-w-0">
              <p className="text-sm font-medium">Pre-Employment Form</p>
              <p className="text-xs text-muted-foreground">
                {isEmployee
                  ? pack.status === "required" || pack.status === "in_progress"
                    ? "Please complete this form before you can be confirmed for the role."
                    : pack.status === "submitted"
                    ? "Your form has been encrypted and submitted. Awaiting download."
                    : pack.status === "reviewed"
                    ? "Your details have been downloaded by the employer. ✅"
                    : "This requirement has been waived."
                  : pack.status === "submitted"
                  ? "The candidate has submitted their encrypted details. Download to view."
                  : pack.status === "reviewed"
                  ? "You've downloaded this candidate's details. Data will auto-delete."
                  : pack.status === "waived"
                  ? "You've waived the pre-employment form for this candidate."
                  : "Waiting for the candidate to complete the form."
                }
              </p>
              {pack.expires_at && (pack.status === "submitted" || pack.status === "reviewed") && (
                <p className="text-[10px] text-destructive/80 mt-0.5">
                  ⏰ Data expires: {new Date(pack.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs">{config.label}</Badge>
            {isEmployee && (pack.status === "required" || pack.status === "in_progress") && templateSchema && (
              <Button size="sm" onClick={handleOpenForm} className="h-8">
                <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                {pack.status === "in_progress" ? "Continue" : "Complete Form"}
              </Button>
            )}
            {!isEmployee && pack.status === "submitted" && (
              <Button size="sm" onClick={handleDownload} disabled={downloading} className="h-8">
                {downloading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                Download & Review
              </Button>
            )}
            {!isEmployee && pack.status === "reviewed" && downloadedAnswers && (
              <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="h-8">
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                View (cached)
              </Button>
            )}
            {!isEmployee && (pack.status === "required" || pack.status === "in_progress") && (
              <Button size="sm" variant="ghost" onClick={handleWaive} disabled={submitting} className="h-8 text-xs">
                Waive
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Form / View Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pre-Employment Details</DialogTitle>
            <DialogDescription>
              {isEmployee && !isViewMode
                ? "Please fill in your details below. Fields marked with * are required. Your answers will be encrypted."
                : "Candidate's submitted pre-employment details."
              }
            </DialogDescription>
            {!isEmployee && (
              <div className="flex items-center gap-1.5 mt-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-muted-foreground">
                  Encrypted storage • Auto-deletes after download
                </span>
              </div>
            )}
          </DialogHeader>

          {templateSchema ? (
            <div className="space-y-6 py-2">
              {templateSchema.sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-3">
                  <h3 className="text-sm font-semibold border-b pb-1">{section.title}</h3>
                  {section.fields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label htmlFor={field.id} className="text-sm">
                        {field.label} {field.required && <span className="text-destructive">*</span>}
                      </Label>
                      {field.type === "checkbox" ? (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={field.id}
                            checked={!!(isViewMode ? displayAnswers[field.id] : answers[field.id])}
                            onCheckedChange={(checked) =>
                              !isViewMode && setAnswers((prev) => ({ ...prev, [field.id]: checked }))
                            }
                            disabled={isViewMode}
                          />
                          <Label htmlFor={field.id} className="text-sm font-normal cursor-pointer">
                            {field.label}
                          </Label>
                        </div>
                      ) : field.type === "textarea" ? (
                        <Textarea
                          id={field.id}
                          value={String((isViewMode ? displayAnswers[field.id] : answers[field.id]) || "")}
                          onChange={(e) =>
                            !isViewMode && setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          disabled={isViewMode}
                          className="min-h-[80px] resize-none"
                        />
                      ) : (
                        <Input
                          id={field.id}
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          value={String((isViewMode ? displayAnswers[field.id] : answers[field.id]) || "")}
                          onChange={(e) =>
                            !isViewMode && setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          disabled={isViewMode}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No template assigned to this pack.</p>
          )}

          {isEmployee && !isViewMode && templateSchema && (
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                🔒 Submit Securely
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
