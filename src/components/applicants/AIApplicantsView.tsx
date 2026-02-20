import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Users,
  Search,
  Loader2 } from
"lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApplicantList from "./ApplicantList";
import ApplicantDetail from "./ApplicantDetail";
import type { AIApplicant, ApplicantTab, Questionnaire } from "./types";

interface AIApplicantsViewProps {
  jobId: string;
  job: {
    id: string;
    title: string;
    positions_available: number;
    positions_filled: number;
    location_city: string | null;
    hiring_config: Record<string, unknown>;
  };
}

const PAGE_SIZE = 25;

export default function AIApplicantsView({ jobId, job }: AIApplicantsViewProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ApplicantTab>("top10");
  const [applicants, setApplicants] = useState<AIApplicant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);

  // Fetch questionnaire once
  useEffect(() => {
    async function fetchQuestionnaire() {
      const { data } = await supabase.
      from("job_ai_questionnaires").
      select("questionnaire").
      eq("job_id", jobId).
      maybeSingle();
      if (data?.questionnaire) {
        setQuestionnaire(data.questionnaire as unknown as Questionnaire);
      }
    }
    fetchQuestionnaire();
  }, [jobId]);

  const fetchApplicants = useCallback(
    async (tab: ApplicantTab, pageNum: number, append = false) => {
      if (!user) return;
      setIsLoading(true);

      try {
        if (tab === "top10") {
          // Fetch from job_top_candidates joined with applications
          const { data: topCandidates, error: tcError } = await supabase.
          from("job_top_candidates").
          select("job_application_id, rank, score").
          eq("job_id", jobId).
          order("rank", { ascending: true });

          if (tcError) throw tcError;
          if (!topCandidates || topCandidates.length === 0) {
            setApplicants([]);
            setHasMore(false);
            setTotalCount(0);
            setIsLoading(false);
            return;
          }

          const appIds = topCandidates.map((tc) => tc.job_application_id);
          const rankMap = new Map(
            topCandidates.map((tc) => [tc.job_application_id, { rank: tc.rank, score: tc.score }])
          );

          const { data: apps, error: appError } = await supabase.
          from("job_applications").
          select("id, status, cover_letter, created_at, ai_score, ai_scoring_status, ai_reason_summary, application_answers, employee_id").
          in("id", appIds);

          if (appError) throw appError;

          const enriched = await enrichApplicants(apps || [], rankMap);
          setApplicants(enriched);
          setHasMore(false);
          setTotalCount(enriched.length);
        } else {
          // Build query for other tabs
          let query = supabase.
          from("job_applications").
          select("id, status, cover_letter, created_at, ai_score, ai_scoring_status, ai_reason_summary, application_answers, employee_id", { count: "exact" }).
          eq("job_id", jobId);

          if (tab === "shortlisted") query = query.eq("status", "shortlisted");else
          if (tab === "hired") query = query.eq("status", "hired");else
          if (tab === "rejected") query = query.eq("status", "rejected");

          query = query.
          order("ai_score", { ascending: false, nullsFirst: false }).
          order("created_at", { ascending: false }).
          range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

          const { data: apps, error, count } = await query;
          if (error) throw error;

          const enriched = await enrichApplicants(apps || []);
          setApplicants((prev) => append ? [...prev, ...enriched] : enriched);
          setHasMore((apps?.length || 0) === PAGE_SIZE);
          setTotalCount(count || 0);
        }
      } catch (err) {
        console.error("Error fetching applicants:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [jobId, user]
  );

  async function enrichApplicants(
  apps: any[],
  rankMap?: Map<string, {rank: number;score: number;}>)
  : Promise<AIApplicant[]> {
    const results: AIApplicant[] = [];

    // Batch fetch employee profiles
    const employeeIds = apps.map((a) => a.employee_id).filter(Boolean);
    if (employeeIds.length === 0) return [];

    const { data: employees } = await supabase.
    from("employee_profiles").
    select("id, user_id, headline, city, experience_years, skills, availability, bio, industry, languages, visa_status").
    in("id", employeeIds);

    const empMap = new Map((employees || []).map((e) => [e.id, e]));

    // Batch fetch profiles
    const userIds = (employees || []).map((e) => e.user_id);
    const { data: profiles } = await supabase.
    from("profiles").
    select("user_id, full_name, email, avatar_url").
    in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    // Batch fetch conversations
    const appIds = apps.map((a) => a.id);
    const { data: convos } = await supabase.
    from("conversations").
    select("id, job_application_id").
    in("job_application_id", appIds);

    const convoMap = new Map((convos || []).map((c) => [c.job_application_id, c.id]));

    for (const app of apps) {
      const emp = empMap.get(app.employee_id);
      if (!emp) continue;
      const prof = profileMap.get(emp.user_id);
      const tc = rankMap?.get(app.id);

      results.push({
        id: app.id,
        status: app.status,
        cover_letter: app.cover_letter,
        created_at: app.created_at,
        ai_score: app.ai_score ? Number(app.ai_score) : null,
        ai_scoring_status: app.ai_scoring_status,
        ai_reason_summary: app.ai_reason_summary,
        application_answers: app.application_answers as Record<string, string> | null,
        employee: emp,
        profile: prof ? { full_name: prof.full_name, email: prof.email, avatar_url: prof.avatar_url } : null,
        conversation_id: convoMap.get(app.id) || null,
        top_rank: tc?.rank ?? null
      });
    }

    // Sort by rank if applicable
    if (rankMap) {
      results.sort((a, b) => (a.top_rank ?? 999) - (b.top_rank ?? 999));
    }

    return results;
  }

  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
    fetchApplicants(activeTab, 0);
  }, [activeTab, fetchApplicants]);

  const handleLoadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchApplicants(activeTab, next, true);
  }, [page, activeTab, fetchApplicants]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
    },
    []
  );

  const handleCheckbox = useCallback((id: string) => {
    setSelectedIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? applicants.map((a) => a.id) : []);
    },
    [applicants]
  );

  const handleStatusChange = useCallback(
    async (applicationId: string, newStatus: string) => {
      setUpdatingId(applicationId);
      const { error } = await supabase.
      from("job_applications").
      update({ status: newStatus }).
      eq("id", applicationId);

      setUpdatingId(null);
      if (error) {
        toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        return;
      }

      setApplicants((prev) =>
      prev.map((a) => a.id === applicationId ? { ...a, status: newStatus } : a)
      );
      toast({ title: "Status Updated", description: `Application marked as ${newStatus}.` });
    },
    [toast]
  );

  const handleBulkAction = useCallback(
    async (newStatus: string) => {
      for (const id of selectedIds) {
        await supabase.from("job_applications").update({ status: newStatus }).eq("id", id);
      }
      setApplicants((prev) =>
      prev.map((a) => selectedIds.includes(a.id) ? { ...a, status: newStatus } : a)
      );
      setSelectedIds([]);
      toast({ title: "Bulk Update", description: `${selectedIds.length} applicants updated.` });
    },
    [selectedIds, toast]
  );

  const handleStartConversation = useCallback(
    async (applicant: AIApplicant) => {
      if (!user) return;
      if (applicant.conversation_id) {
        navigate(`/messages/${applicant.conversation_id}`);
        return;
      }
      const { data: newConv, error } = await supabase.
      from("conversations").
      insert({
        job_application_id: applicant.id,
        contractor_user_id: user.id,
        employee_user_id: applicant.employee.user_id
      }).
      select().
      single();
      if (error) {
        toast({ title: "Error", description: "Failed to start conversation.", variant: "destructive" });
        return;
      }
      navigate(`/messages/${newConv.id}`);
    },
    [user, navigate, toast]
  );

  const selectedApplicant = applicants.find((a) => a.id === selectedId) || null;

  // Filter by search
  const filteredApplicants = searchQuery ?
  applicants.filter(
    (a) =>
    a.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.employee.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.employee.headline?.toLowerCase().includes(searchQuery.toLowerCase())
  ) :
  applicants;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card shadow-sm z-20">
        <Button variant="ghost" asChild className="mb-3 -ml-2">
          <Link to="/contractor/jobs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Link>
        </Button>

        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              {job.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {job.location_city || "NZ"} • {totalCount} Applicant{totalCount !== 1 ? "s" : ""} •{" "}
              {job.positions_available - job.positions_filled} of {job.positions_available} positions
              available
            </p>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ApplicantTab)}>

            <TabsList>
              <TabsTrigger value="top10">Top 10</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="shortlisted">Shortlisted</TabsTrigger>
              <TabsTrigger value="hired">Hired</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64" />

          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 &&
      <div className="bg-primary/5 px-6 py-2 flex items-center justify-between border-b border-primary/10">
          <span className="text-sm font-bold text-primary">
            {selectedIds.length} Selected
          </span>
          <div className="flex gap-2">
            <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction("shortlisted")}>

              Shortlist
            </Button>
            <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => handleBulkAction("rejected")}>

              Reject
            </Button>
          </div>
        </div>
      }

      {/* Main Content: Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Candidate List */}
        <div
          className={`${
          selectedId ? "w-5/12 hidden md:flex" : "w-full"} flex-col border-r bg-card`
          }
          style={{ display: selectedId ? undefined : "flex" }}>

          <ApplicantList
            applicants={filteredApplicants}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onCheckbox={handleCheckbox}
            onSelectAll={handleSelectAll}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            showRank={activeTab === "top10"} />

        </div>

        {/* RIGHT: Detail Panel */}
        {selectedApplicant ?
        <div className="flex-1 min-w-0">
            <ApplicantDetail
            applicant={selectedApplicant}
            questionnaire={questionnaire}
            onStatusChange={handleStatusChange}
            onStartConversation={handleStartConversation}
            isUpdating={updatingId === selectedApplicant.id} />

          </div> :

        <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground p-14 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4 border">
              <Users size={36} className="text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              Select a candidate to view details
            </h3>
            <p className="max-w-xs text-sm">
              Use the checkboxes on the left for bulk actions, or click a row to see the full
              application.
            </p>
          </div>
        }
      </div>
    </div>);

}