import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Search, Briefcase, MapPin, Clock, DollarSign, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Job = {
  id: string;
  title: string;
  description: string;
  job_type: string;
  duration: string | null;
  location_city: string | null;
  location_suburb: string | null;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  skills_required: string[] | null;
  positions_available: number;
  positions_filled: number;
  created_at: string;
  contractor: {
    company_name: string;
  } | null;
};

export default function JobSearch() {
  const { user } = useAuthContext();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchJobs() {
      setIsLoading(true);

      let query = supabase
        .from("jobs")
        .select(`
          id,
          title,
          description,
          job_type,
          duration,
          location_city,
          location_suburb,
          hourly_rate_min,
          hourly_rate_max,
          skills_required,
          positions_available,
          positions_filled,
          created_at,
          contractor_id
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (cityFilter) {
        query = query.ilike("location_city", `%${cityFilter}%`);
      }

      if (jobTypeFilter !== "all") {
        query = query.eq("job_type", jobTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching jobs:", error);
        setIsLoading(false);
        return;
      }

      // Fetch contractor info
      const contractorIds = [...new Set(data?.map((j) => j.contractor_id) || [])];
      const { data: contractors } = await supabase
        .from("contractor_profiles")
        .select("id, company_name")
        .in("id", contractorIds);

      const jobsWithContractor = data?.map((job) => ({
        ...job,
        contractor: contractors?.find((c) => c.id === job.contractor_id) || null,
      })) || [];

      // Filter out jobs where all positions are filled
      let filtered = jobsWithContractor.filter(
        (j) => j.positions_available > j.positions_filled
      );

      // Client-side search filtering
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (j) =>
            j.title.toLowerCase().includes(term) ||
            j.description.toLowerCase().includes(term) ||
            j.contractor?.company_name.toLowerCase().includes(term) ||
            j.skills_required?.some((s) => s.toLowerCase().includes(term))
        );
      }

      setJobs(filtered);
      setIsLoading(false);
    }

    fetchJobs();
  }, [cityFilter, jobTypeFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        {user && (
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        )}

        <h1 className="text-3xl font-bold mb-2 font-display">Find Jobs</h1>
        <p className="text-muted-foreground mb-8">
          Browse temporary and short-term job opportunities.
        </p>

        {/* Filters */}
        <div className="bg-card rounded-xl p-6 border border-border/50 mb-8">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Job title, company, skills..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Filter by city..."
              />
            </div>

            <div className="space-y-2">
              <Label>Job Type</Label>
              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                  <SelectItem value="short-term">Short-term</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Jobs Found</h2>
            <p className="text-muted-foreground">
              Try adjusting your filters or check back later.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-card rounded-xl p-6 border border-border/50 shadow-soft hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{job.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {job.contractor?.company_name || "Company"}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                      <Badge variant="outline" className="capitalize">
                        {job.job_type}
                      </Badge>
                      {job.location_city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location_suburb && `${job.location_suburb}, `}
                          {job.location_city}
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
                          <DollarSign className="w-4 h-4" />$
                          {job.hourly_rate_min || "?"} - ${job.hourly_rate_max || "?"}/hr
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {job.positions_available - job.positions_filled} position{job.positions_available - job.positions_filled > 1 ? "s" : ""} left
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {job.description}
                    </p>

                    {job.skills_required && job.skills_required.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {job.skills_required.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {job.skills_required.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{job.skills_required.length - 5}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    <Button asChild>
                      <Link to={`/jobs/${job.id}`}>View Details</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
