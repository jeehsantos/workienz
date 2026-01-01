import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  Edit,
  Users,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type JobShift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  break_paid: boolean;
};

type Job = {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  job_type: string;
  duration: string | null;
  location_city: string | null;
  location_suburb: string | null;
  location_country: string | null;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  skills_required: string[] | null;
  positions_available: number;
  positions_filled: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  industry: string | null;
  schedule_type: string | null;
  experience_required: boolean;
  is_sse: boolean;
  status: string;
  shifts: JobShift[];
};

export default function ContractorJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isContractor, isLoading: authLoading } = useAuthContext();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  useEffect(() => {
    async function fetchJob() {
      if (!id || !user) return;

      // Get contractor profile first
      const { data: contractorProfile } = await supabase
        .from("contractor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!contractorProfile) {
        navigate("/contractor/jobs");
        return;
      }

      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id,
          title,
          description,
          requirements,
          job_type,
          duration,
          location_city,
          location_suburb,
          location_country,
          hourly_rate_min,
          hourly_rate_max,
          skills_required,
          positions_available,
          positions_filled,
          starts_at,
          ends_at,
          created_at,
          contractor_id,
          industry,
          schedule_type,
          experience_required,
          is_sse,
          status
        `)
        .eq("id", id)
        .eq("contractor_id", contractorProfile.id)
        .single();

      if (error || !data) {
        console.error("Error fetching job:", error);
        navigate("/contractor/jobs");
        return;
      }

      // Fetch shifts if schedule_type is shifts
      let shifts: JobShift[] = [];
      if (data.schedule_type === "shifts") {
        const { data: shiftsData } = await supabase
          .from("job_shifts")
          .select("*")
          .eq("job_id", id)
          .order("shift_date", { ascending: true });
        shifts = shiftsData || [];
      }

      setJob({
        ...data,
        shifts,
        experience_required: data.experience_required ?? false,
        is_sse: data.is_sse ?? false,
      });
      setIsLoading(false);
    }

    if (user) {
      fetchJob();
    }
  }, [id, user, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Job Not Found</h1>
            <Button asChild>
              <Link to="/contractor/jobs">Back to My Jobs</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "closed":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link to="/contractor/jobs">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to My Jobs
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/contractor/jobs/${job.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Job
            </Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border/50">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={getStatusColor(job.status)} variant="outline">
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {job.job_type}
                </Badge>
                {job.industry && (
                  <Badge variant="secondary">{job.industry}</Badge>
                )}
                {job.experience_required && (
                  <Badge variant="destructive">Experience Required</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-4 font-display">{job.title}</h1>

              <div className="flex flex-col gap-2 text-sm text-muted-foreground mb-6">
                <div className="flex flex-wrap gap-4">
                  {job.location_city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {job.location_suburb && `${job.location_suburb}, `}
                      {job.location_city}
                      {job.location_country && `, ${job.location_country}`}
                    </span>
                  )}
                  {job.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {job.duration}
                    </span>
                  )}
                  {(job.hourly_rate_min || job.hourly_rate_max) && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {job.hourly_rate_min && job.hourly_rate_max
                        ? `$${job.hourly_rate_min} – $${job.hourly_rate_max}/hr`
                        : job.hourly_rate_min
                        ? `From $${job.hourly_rate_min}/hr`
                        : job.hourly_rate_max
                        ? `Up to $${job.hourly_rate_max}/hr`
                        : null}
                    </span>
                  )}
                </div>

                {job.is_sse && (
                  <div className="flex items-center gap-2 text-foreground">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-medium">SSE employer</span>
                    <span className="text-muted-foreground">(specialized farm work)</span>
                  </div>
                )}
              </div>

              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h3>Description</h3>
                <div className="relative">
                  <div
                    className={`whitespace-pre-wrap ${
                      isDescriptionExpanded ? "" : "max-h-40 overflow-hidden"
                    }`}
                  >
                    {job.description}
                  </div>

                  {!isDescriptionExpanded && job.description.length > 600 && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
                  )}

                  {job.description.length > 600 && (
                    <Button
                      type="button"
                      variant="link"
                      className="px-0"
                      onClick={() => setIsDescriptionExpanded((v) => !v)}
                    >
                      {isDescriptionExpanded ? "Show less" : "Read more"}
                    </Button>
                  )}
                </div>

                {job.requirements && (
                  <>
                    <h3>Requirements</h3>
                    <p className="whitespace-pre-wrap">{job.requirements}</p>
                  </>
                )}
              </div>

              {job.skills_required && job.skills_required.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.skills_required.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Section */}
            {(job.shifts.length > 0 || job.starts_at) && (
              <div className="bg-card rounded-xl p-6 border border-border/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {job.schedule_type === "shifts" ? "Shift Schedule" : "Contract Period"}
                </h3>

                {job.schedule_type === "shifts" && job.shifts.length > 0 && (
                  <div className="space-y-3">
                    {job.shifts.map((shift) => (
                      <div key={shift.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {format(new Date(shift.shift_date), "EEEE, MMM d, yyyy")}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {shift.start_time} - {shift.end_time}
                          </span>
                        </div>
                        {shift.break_minutes > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {shift.break_minutes} min break ({shift.break_paid ? "paid" : "unpaid"})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {job.schedule_type === "fixed_term" && job.starts_at && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Start Date:</span>
                      <span className="font-medium">
                        {format(new Date(job.starts_at), "EEEE, MMM d, yyyy")}
                      </span>
                    </div>
                    {job.ends_at && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">End Date:</span>
                        <span className="font-medium">
                          {format(new Date(job.ends_at), "EEEE, MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Position Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available:</span>
                  <span className="font-medium">{job.positions_available}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filled:</span>
                  <span className="font-medium">{job.positions_filled}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-medium text-primary">
                    {job.positions_available - job.positions_filled}
                  </span>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline" asChild>
                <Link to={`/contractor/jobs/${job.id}/applicants`}>
                  View Applicants
                </Link>
              </Button>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border/50">
              <h3 className="font-semibold mb-3">Posted</h3>
              <p className="text-muted-foreground text-sm">
                {format(new Date(job.created_at), "MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
