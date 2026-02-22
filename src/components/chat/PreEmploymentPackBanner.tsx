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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react";

interface Pack {
  id: string;
  status: string;
  answers: Record<string, unknown> | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

interface PreEmploymentPackBannerProps {
  jobApplicationId: string | null;
  isEmployee: boolean;
}

const PACK_QUESTIONS = [
  { id: "full_legal_name", label: "Full Legal Name", type: "text", required: true },
  { id: "date_of_birth", label: "Date of Birth", type: "date", required: true },
  { id: "phone_number", label: "Phone Number", type: "text", required: true },
  { id: "address", label: "Current Address", type: "textarea", required: true },
  { id: "emergency_contact_name", label: "Emergency Contact Name", type: "text", required: true },
  { id: "emergency_contact_phone", label: "Emergency Contact Phone", type: "text", required: true },
  { id: "emergency_contact_relationship", label: "Emergency Contact Relationship", type: "text", required: true },
  { id: "ird_number", label: "IRD Number", type: "text", required: false },
  { id: "bank_account", label: "Bank Account Number", type: "text", required: false },
  { id: "visa_type", label: "Visa Type", type: "select", required: true, options: [
    { value: "citizen", label: "NZ Citizen" },
    { value: "resident", label: "Permanent Resident" },
    { value: "work_visa", label: "Work Visa" },
    { value: "student_visa", label: "Student Visa" },
    { value: "whv", label: "Working Holiday Visa" },
    { value: "other", label: "Other" },
  ]},
  { id: "work_rights_confirmed", label: "I confirm I have the legal right to work in New Zealand", type: "checkbox", required: true },
  { id: "health_conditions", label: "Any health conditions or allergies the employer should know about?", type: "textarea", required: false },
  { id: "additional_notes", label: "Additional Notes", type: "textarea", required: false },
];

export function PreEmploymentPackBanner({ jobApplicationId, isEmployee }: PreEmploymentPackBannerProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [pack, setPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const fetchPack = useCallback(async () => {
    if (!jobApplicationId || !user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("application_pre_employment_packs")
      .select("id, status, answers, submitted_at, reviewed_at")
      .eq("job_application_id", jobApplicationId)
      .maybeSingle();

    if (data) {
      setPack(data as Pack);
      if (data.answers) setAnswers(data.answers as Record<string, unknown>);
    }
    setLoading(false);
  }, [jobApplicationId, user]);

  useEffect(() => {
    fetchPack();
  }, [fetchPack]);

  const handleOpenForm = () => {
    if (pack?.answers) setAnswers(pack.answers);
    setModalOpen(true);
    // Mark as in_progress if still 'required'
    if (pack?.status === "required") {
      supabase
        .from("application_pre_employment_packs")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", pack.id)
        .then(() => {
          setPack((prev) => prev ? { ...prev, status: "in_progress" } : prev);
        });
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missing = PACK_QUESTIONS.filter(
      (q) => q.required && (!answers[q.id] || (typeof answers[q.id] === "string" && !(answers[q.id] as string).trim()))
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
    const { error } = await supabase
      .from("application_pre_employment_packs")
      .update({
        answers: answers as unknown as Record<string, string>,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", pack!.id);

    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: "Failed to submit form.", variant: "destructive" });
      return;
    }
    setPack((prev) => prev ? { ...prev, status: "submitted", answers, submitted_at: new Date().toISOString() } : prev);
    setModalOpen(false);
    toast({ title: "✅ Form Submitted", description: "Your pre-employment details have been sent to the employer." });
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
    setPack((prev) => prev ? { ...prev, status: "waived" } : prev);
    toast({ title: "Pack Waived", description: "Pre-employment form requirement has been waived." });
  };

  const handleMarkReviewed = async () => {
    if (!pack) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("application_pre_employment_packs")
      .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
      .eq("id", pack.id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: "Failed to mark as reviewed.", variant: "destructive" });
      return;
    }
    setPack((prev) => prev ? { ...prev, status: "reviewed" } : prev);
    toast({ title: "Pack Reviewed", description: "Pre-employment details have been marked as reviewed." });
  };

  if (loading || !pack) return null;

  // Don't show for cancelled packs
  if (pack.status === "cancelled") return null;

  const statusConfig: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    required: { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: <ClipboardList className="w-4 h-4 text-amber-600" />, label: "Required" },
    in_progress: { bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", icon: <Clock className="w-4 h-4 text-blue-600" />, label: "In Progress" },
    submitted: { bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800", icon: <CheckCircle2 className="w-4 h-4 text-green-600" />, label: "Submitted" },
    reviewed: { bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, label: "Reviewed" },
    waived: { bg: "bg-muted/50 border-border", icon: <CheckCircle2 className="w-4 h-4 text-muted-foreground" />, label: "Waived" },
  };

  const config = statusConfig[pack.status] || statusConfig.required;

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
                    ? "Your form has been submitted and is awaiting review."
                    : pack.status === "reviewed"
                    ? "Your pre-employment details have been reviewed. ✅"
                    : "This requirement has been waived."
                  : pack.status === "submitted"
                  ? "The candidate has submitted their pre-employment details."
                  : pack.status === "reviewed"
                  ? "You've reviewed this candidate's pre-employment details."
                  : pack.status === "waived"
                  ? "You've waived the pre-employment form for this candidate."
                  : "Waiting for the candidate to complete the form."
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs">{config.label}</Badge>
            {isEmployee && (pack.status === "required" || pack.status === "in_progress") && (
              <Button size="sm" onClick={handleOpenForm} className="h-8">
                <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                {pack.status === "in_progress" ? "Continue" : "Complete Form"}
              </Button>
            )}
            {!isEmployee && pack.status === "submitted" && (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="h-8">
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  View
                </Button>
                <Button size="sm" onClick={handleMarkReviewed} disabled={submitting} className="h-8">
                  Mark Reviewed
                </Button>
              </div>
            )}
            {!isEmployee && (pack.status === "required" || pack.status === "in_progress") && (
              <Button size="sm" variant="ghost" onClick={handleWaive} disabled={submitting} className="h-8 text-xs">
                Waive
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pre-Employment Details</DialogTitle>
            <DialogDescription>
              {isEmployee
                ? "Please fill in your details below. Fields marked with * are required."
                : "Candidate's submitted pre-employment details."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {PACK_QUESTIONS.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <Label htmlFor={q.id} className="text-sm">
                  {q.label} {q.required && <span className="text-destructive">*</span>}
                </Label>
                {q.type === "text" || q.type === "date" ? (
                  <Input
                    id={q.id}
                    type={q.type}
                    value={(answers[q.id] as string) || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    disabled={!isEmployee || pack.status === "submitted" || pack.status === "reviewed"}
                  />
                ) : q.type === "textarea" ? (
                  <Textarea
                    id={q.id}
                    value={(answers[q.id] as string) || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    disabled={!isEmployee || pack.status === "submitted" || pack.status === "reviewed"}
                    className="min-h-[80px] resize-none"
                  />
                ) : q.type === "select" ? (
                  <Select
                    value={(answers[q.id] as string) || ""}
                    onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    disabled={!isEmployee || pack.status === "submitted" || pack.status === "reviewed"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {q.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : q.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={q.id}
                      checked={!!answers[q.id]}
                      onCheckedChange={(checked) => setAnswers((prev) => ({ ...prev, [q.id]: checked }))}
                      disabled={!isEmployee || pack.status === "submitted" || pack.status === "reviewed"}
                    />
                    <Label htmlFor={q.id} className="text-sm font-normal cursor-pointer">{q.label}</Label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {isEmployee && (pack.status === "required" || pack.status === "in_progress") && (
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Form
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
