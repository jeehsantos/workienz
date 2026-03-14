import { memo, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Users,
  MessageCircle,
  MapPin,
  Clock,
  Briefcase,
  CheckCircle,
  XCircle,
  Globe,
  Star,
  Save,
  CheckCheck,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AIApplicant, Questionnaire } from "./types";

interface ApplicantDetailProps {
  applicant: AIApplicant;
  questionnaire: Questionnaire | null;
  onStatusChange: (applicationId: string, newStatus: string) => void;
  onStartConversation: (applicant: AIApplicant) => void;
  isUpdating: boolean;
  isShiftJob: boolean;
}

function ApplicantDetail({
  applicant,
  questionnaire,
  onStatusChange,
  onStartConversation,
  isUpdating,
  isShiftJob,
}: ApplicantDetailProps) {
  const { user } = useAuthContext();
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing note for this applicant
  useEffect(() => {
    if (!user || !applicant.id) return;
    supabase
      .from("contractor_application_notes")
      .select("note, updated_at")
      .eq("contractor_user_id", user.id)
      .eq("application_id", applicant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNote(data.note);
          setSavedAt(new Date(data.updated_at));
        } else {
          setNote("");
          setSavedAt(null);
        }
        setIsDirty(false);
      });
  }, [applicant.id, user]);

  const saveNote = useCallback(async (value: string) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("contractor_application_notes")
      .upsert(
        {
          contractor_user_id: user.id,
          application_id: applicant.id,
          note: value,
        },
        { onConflict: "contractor_user_id,application_id" }
      );
    setIsSaving(false);
    if (!error) {
      setSavedAt(new Date());
      setIsDirty(false);
    }
  }, [user, applicant.id]);

  const handleNoteChange = (value: string) => {
    setNote(value);
    setIsDirty(true);
    // Debounce autosave — 2 seconds after last keystroke
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveNote(value);
    }, 2000);
  };

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const renderAnswer = (questionId: string, answer: string) => {
    const question = questionnaire?.questions.find((q) => q.id === questionId);
    if (!question) return null;

    let displayAnswer = answer;
    if (question.type === "yes_no") {
      displayAnswer = answer === "yes" ? "Yes" : "No";
    } else if (question.type === "single_select" && question.options) {
      const opt = question.options.find((o) => o.value === answer);
      displayAnswer = opt?.label || answer;
    }

    const isPositive = answer === "yes" || answer === "true";
    const isNegative = answer === "no" || answer === "false";

    return (
      <div key={questionId} className="bg-muted/30 p-4 rounded-xl border border-border/50">
        <p className="text-xs font-bold text-muted-foreground mb-2">{question.prompt}</p>
        <p className="font-medium text-foreground flex items-center gap-2">
          {question.type === "yes_no" && (
            isPositive ? (
              <CheckCircle size={16} className="text-green-600" />
            ) : (
              <XCircle size={16} className="text-red-500" />
            )
          )}
          {displayAnswer}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card animate-in slide-in-from-right-4 duration-300">
      {/* Detail Header */}
      <div className="p-6 border-b flex justify-between items-start">
        <div className="flex gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
            <Users size={28} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {applicant.profile?.full_name || "The Workie"}
            </h2>
            <p className="text-sm text-muted-foreground font-medium mb-2">
              {applicant.employee.headline || "Looking for opportunities"} •{" "}
              {applicant.employee.city || "NZ"}
            </p>
            <div className="flex gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={
                  applicant.status === "hired"
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : applicant.status === "shortlisted"
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : applicant.status === "rejected"
                    ? "bg-red-500/10 text-red-600 border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                }
              >
                {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
              </Badge>
              {applicant.ai_score !== null && (
                <Badge variant="secondary" className="font-bold">
                  AI Score: {Math.round(applicant.ai_score)}%
                </Badge>
              )}
              {applicant.ai_score_updated_at && (
                <span className="text-[10px] text-muted-foreground">
                  Scored {new Date(applicant.ai_score_updated_at).toLocaleDateString()} • {applicant.ai_model || 'AI'} {applicant.ai_prompt_version ? `(${applicant.ai_prompt_version})` : ''}
                </span>
              )}
              {applicant.top_rank !== null && (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20" variant="outline">
                  <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                  Top #{applicant.top_rank}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="px-6 py-3 border-b bg-muted/30 flex gap-3 items-center">
        <Select
          value={applicant.status}
          onValueChange={(v) => onStatusChange(applicant.id, v)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="shortlisted">Shortlist</SelectItem>
            {isShiftJob ? (
              <SelectItem value="approved_to_pool">Add to Talent Pool</SelectItem>
            ) : (
              <SelectItem value="hired">Hire</SelectItem>
            )}
            <SelectItem value="rejected">Reject</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onStartConversation(applicant)}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          {applicant.conversation_id ? "Open Chat" : "Start Chat"}
        </Button>

        <Button variant="ghost" size="sm" asChild>
          <Link to={`/workers/${applicant.employee.id}`}>View Profile</Link>
        </Button>
      </div>

      {/* Detail Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* AI Reason Summary */}
        {applicant.ai_reason_summary && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wide mb-2">
              AI Assessment
            </h4>
            <p className="text-sm text-foreground">{applicant.ai_reason_summary}</p>
          </div>
        )}

        {/* Profile Summary */}
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
            Profile Summary
          </h4>
          <div className="bg-card rounded-xl border p-4 space-y-3">
            {applicant.employee.city && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <MapPin size={16} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Location</div>
                  <div className="text-sm font-medium">{applicant.employee.city}</div>
                </div>
              </div>
            )}
            {applicant.employee.experience_years !== null && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Briefcase size={16} className="text-purple-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Experience</div>
                  <div className="text-sm font-medium">
                    {applicant.employee.experience_years} years
                  </div>
                </div>
              </div>
            )}
            {applicant.employee.availability && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Clock size={16} className="text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Availability</div>
                  <div className="text-sm font-medium capitalize">
                    {applicant.employee.availability}
                  </div>
                </div>
              </div>
            )}
            {applicant.employee.visa_status && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <Globe size={16} className="text-amber-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Visa Status</div>
                  <div className="text-sm font-medium capitalize">
                    {applicant.employee.visa_status}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Skills */}
        {applicant.employee.skills && applicant.employee.skills.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
              Skills
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {applicant.employee.skills.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Questionnaire Q&A */}
        {applicant.application_answers &&
          questionnaire &&
          Object.keys(applicant.application_answers).length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                Application Questions
              </h4>
              <div className="space-y-3">
                {Object.entries(applicant.application_answers).map(([qId, answer]) =>
                  renderAnswer(qId, answer as string)
                )}
              </div>
            </div>
          )}

        {/* Cover Letter */}
        {applicant.cover_letter && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
              Cover Letter
            </h4>
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
              <p className="text-sm whitespace-pre-wrap">{applicant.cover_letter}</p>
            </div>
          </div>
        )}

        {/* Internal Notes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Internal Notes
            </h4>
            <div className="flex items-center gap-2">
              {savedAt && !isDirty && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCheck className="w-3 h-3 text-green-600" />
                  Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {isDirty && !isSaving && (
                <span className="text-xs text-muted-foreground">Unsaved changes</span>
              )}
              {isSaving && (
                <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
                  saveNote(note);
                }}
                disabled={isSaving || !isDirty}
                className="h-7 px-2 text-xs gap-1"
              >
                <Save className="w-3 h-3" />
                Save
              </Button>
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Add private notes about this candidate. Autosaved as you type…"
            className="min-h-[120px] bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30 focus-visible:ring-amber-400/50 resize-none"
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground text-right mt-1">{note.length}/2000</p>
        </div>
      </div>
    </div>
  );
}

export default memo(ApplicantDetail);

