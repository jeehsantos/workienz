import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Loader2, ArrowLeft, Search, Briefcase, MapPin, Clock, DollarSign, Users, Lock, Filter, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JOB_TYPE_CONFIG, JobType } from "@/data/jobTypes";
import { INDUSTRIES, Industry } from "@/data/industries";
import { JobTypeBadge } from "@/components/jobs/JobTypeBadge";
import { IndustryBadge } from "@/components/jobs/IndustryBadge";
import { EmptyState } from "@/components/jobs/EmptyState";
import { useDebounce } from "@/hooks/useDebounce";
import { SkeletonJobPosting } from "@/components/ui/skeleton-components";
import { searchJobs } from "@/lib/fullTextSearch"; // Import FTS utility (Requirement 14.1)

type Job = {
  id: string;
  title: string;
  description: string;
  job_type: string;
  industry: string | null;
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

// Memoized JobCard component to prevent unnecessary re-renders
const JobCard = memo(({ job, user }: { job: Job; user: any }) => {
  // Determine if we should show hourly rate for volunteering jobs
  const showHourlyRate = job.job_type !== "volunteering" || 
                         (job.hourly_rate_min !== null && job.hourly_rate_min > 0);
  
  return (
    <div
      className="bg-card rounded-xl p-4 sm:p-6 border border-border/50 shadow-soft hover:shadow-md hover:border-primary/20 transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Industry and Job Type Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <JobTypeBadge jobType={job.job_type as JobType} />
            <IndustryBadge industry={job.industry as Industry} />
          </div>

          <h3 className="text-lg font-semibold mb-1 break-words">{job.title}</h3>
          {user ? (
            <p className="text-sm text-muted-foreground mb-3">
              {job.contractor?.company_name || "Company"}
            </p>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Sign in to see company details</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 sm:gap-4 text-sm text-muted-foreground mb-3">
            {job.location_city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="break-words">
                  {job.location_suburb && `${job.location_suburb}, `}
                  {job.location_city}
                </span>
              </span>
            )}
            {job.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 flex-shrink-0" />
                {job.duration}
              </span>
            )}
            {/* Conditional hourly rate display */}
            {showHourlyRate && (job.hourly_rate_min || job.hourly_rate_max) && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 flex-shrink-0" />$
                {job.hourly_rate_min || "?"} - ${job.hourly_rate_max || "?"}/hr
              </span>
            )}
            {/* Volunteer Position badge when no rate is shown */}
            {job.job_type === "volunteering" && !showHourlyRate && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                Volunteer Position
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4 flex-shrink-0" />
              {job.positions_available - job.positions_filled} position{job.positions_available - job.positions_filled > 1 ? "s" : ""} left
            </span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 break-words">
            {job.description}
          </p>

          {job.skills_required && job.skills_required.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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

        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(job.created_at).toLocaleDateString()}
          </span>
          <Button 
            asChild 
            className="h-11 min-h-[44px] sm:h-10 sm:min-h-0"
            aria-label={`View details for ${job.title}`}
          >
            <Link to={`/jobs/${job.id}`}>View Details</Link>
          </Button>
        </div>
      </div>
    </div>
  );
});

JobCard.displayName = 'JobCard';

export default function JobSearch() {
  const { user } = useAuthContext();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");

  // Mobile filter drawer state
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Debounce search term to prevent excessive re-renders
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Memoize active filter count calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (cityFilter) count++;
    if (jobTypeFilter !== "all") count++;
    if (industryFilter !== "all") count++;
    return count;
  }, [searchTerm, cityFilter, jobTypeFilter, industryFilter]);

  // Stabilize filter clear callback
  const handleClearAllFilters = useCallback(() => {
    setSearchTerm("");
    setCityFilter("");
    setJobTypeFilter("all");
    setIndustryFilter("all");
  }, []);

  // Stabilize retry callback
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
  }, []);

  useEffect(() => {
    async function fetchJobs() {
      setIsFilterLoading(true);
      if (!isLoading) {
        // Only show filter loading state if initial load is complete
        setIsFilterLoading(true);
      }

      try {
        // Use full-text search utility (Requirement 14.1, 14.4)
        const { data, error: queryError } = await searchJobs(
          supabase,
          debouncedSearchTerm,
          {
            status: "published",
            location_city: cityFilter || undefined,
            job_type: jobTypeFilter !== "all" ? jobTypeFilter : undefined,
            industry: industryFilter !== "all" ? industryFilter : undefined,
          },
          100 // Fetch more results for client-side filtering
        );

        if (queryError) {
          console.error("Error fetching jobs:", queryError);
          setError("Failed to load jobs. Please try again.");
          setIsLoading(false);
          setIsFilterLoading(false);
          return;
        }

        // Only fetch contractor info if user is authenticated
        let jobsWithContractor: Job[] = [];
        
        if (user) {
          // Fetch contractor info for authenticated users
          const contractorIds = [...new Set(data?.map((j: any) => j.contractor_id) || [])];
          const { data: contractors } = await supabase
            .from("contractor_profiles")
            .select("id, company_name")
            .in("id", contractorIds);

          jobsWithContractor = data?.map((job: any) => ({
            ...job,
            contractor: contractors?.find((c) => c.id === job.contractor_id) || null,
          })) || [];
        } else {
          // For unauthenticated users, hide company info
          jobsWithContractor = data?.map((job: any) => ({
            ...job,
            contractor: null,
          })) || [];
        }

        // Filter out jobs where all positions are filled
        let filtered = jobsWithContractor.filter(
          (j) => j.positions_available > j.positions_filled
        );

        // Handle null/empty industry values - treat as "Other"
        filtered = filtered.map(job => ({
          ...job,
          industry: job.industry || "Other"
        }));

        setJobs(filtered);
        setError(null);
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setIsLoading(false);
        setIsFilterLoading(false);
      }
    }

    fetchJobs();
  }, [cityFilter, jobTypeFilter, industryFilter, debouncedSearchTerm, user]);

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

        {/* Mobile Filter Trigger Button - Only visible on mobile */}
        <div className="md:hidden mb-6">
          <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full h-11 justify-between"
                aria-label="Open filters"
              >
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter Jobs</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                {/* Mobile Filter Controls */}
                <div className="space-y-2">
                  <Label htmlFor="mobile-search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="mobile-search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Job title, company, skills..."
                      className="pl-9 h-11"
                      aria-label="Search for jobs by title, company, or skills"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile-city">City</Label>
                  <Input
                    id="mobile-city"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    placeholder="Filter by city..."
                    className="h-11"
                    aria-label="Filter jobs by city"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile-job-type">Job Type</Label>
                  <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                    <SelectTrigger id="mobile-job-type" className="h-11" aria-label="Filter by job type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="temporary">{JOB_TYPE_CONFIG.temporary.label}</SelectItem>
                      <SelectItem value="short-term">{JOB_TYPE_CONFIG["short-term"].label}</SelectItem>
                      <SelectItem value="contract">{JOB_TYPE_CONFIG.contract.label}</SelectItem>
                      <SelectItem value="volunteering">{JOB_TYPE_CONFIG.volunteering.label}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile-industry">Industry</Label>
                  <Select value={industryFilter} onValueChange={setIndustryFilter}>
                    <SelectTrigger id="mobile-industry" className="h-11" aria-label="Filter by industry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Industries</SelectItem>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter className="mt-6 flex-col sm:flex-col gap-2">
                <Button 
                  onClick={() => setIsMobileFilterOpen(false)} 
                  className="w-full h-11"
                >
                  Apply Filters
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClearAllFilters}
                  className="w-full h-11"
                >
                  Clear All
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Filters - Hidden on mobile */}
        <div className="hidden md:block bg-card rounded-xl p-6 border border-border/50 mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="desktop-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="desktop-search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Job title, company, skills..."
                  className="pl-9"
                  aria-label="Search for jobs by title, company, or skills"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-city">City</Label>
              <Input
                id="desktop-city"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Filter by city..."
                aria-label="Filter jobs by city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-job-type">Job Type</Label>
              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger id="desktop-job-type" aria-label="Filter by job type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="temporary">{JOB_TYPE_CONFIG.temporary.label}</SelectItem>
                  <SelectItem value="short-term">{JOB_TYPE_CONFIG["short-term"].label}</SelectItem>
                  <SelectItem value="contract">{JOB_TYPE_CONFIG.contract.label}</SelectItem>
                  <SelectItem value="volunteering">{JOB_TYPE_CONFIG.volunteering.label}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-industry">Industry</Label>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger id="desktop-industry" aria-label="Filter by industry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Active Filters Bar */}
        {activeFilterCount > 0 && (
          <div className="bg-muted/50 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearAllFilters}
              className="h-9 min-h-[44px] md:h-8 md:min-h-0"
              aria-label="Clear all active filters"
            >
              Clear All Filters
            </Button>
          </div>
        )}

        {/* Screen reader announcements */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {isLoading ? "Loading jobs..." : isFilterLoading ? "Updating results..." : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} found`}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-2">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetry}
                className="h-9 min-h-[44px] md:h-8 md:min-h-0"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonJobPosting key={i} variant="card" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState 
            hasActiveFilters={activeFilterCount > 0}
            onClearFilters={handleClearAllFilters}
          />
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} user={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
