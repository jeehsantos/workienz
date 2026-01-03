import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  Users,
  Briefcase,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Activity,
  Building,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type MetricData = {
  totalHires: number;
  activeJobSeekers: number;
  totalJobs: number;
  publishedJobs: number;
  totalApplications: number;
  conversionRate: number;
  industryHiring: { name: string; hires: number }[];
  jobSeekerLocations: { name: string; value: number }[];
  topSkills: { skill: string; count: number }[];
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin } = useAuthContext();

  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin())) {
      navigate("/dashboard");
    }
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    async function fetchMetrics() {
      if (!user || !isAdmin()) return;

      try {
        // Fetch total hires
        const { count: totalHires } = await supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "hired");

        // Fetch active job seekers
        const { count: activeJobSeekers } = await supabase
          .from("employee_profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_available", true);

        // Fetch job stats
        const { count: totalJobs } = await supabase
          .from("jobs")
          .select("id", { count: "exact", head: true });

        const { count: publishedJobs } = await supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "published");

        // Fetch total applications
        const { count: totalApplications } = await supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true });

        // Calculate conversion rate
        const conversionRate = totalApplications && totalHires
          ? Math.round((totalHires / totalApplications) * 100)
          : 0;

        // Fetch industry hiring data
        const { data: jobsWithHires } = await supabase
          .from("jobs")
          .select("industry, job_applications!inner(status)")
          .not("industry", "is", null);

        const industryMap = new Map<string, number>();
        jobsWithHires?.forEach((job: any) => {
          const hiredCount = job.job_applications?.filter((a: any) => a.status === "hired").length || 0;
          if (hiredCount > 0) {
            const current = industryMap.get(job.industry) || 0;
            industryMap.set(job.industry, current + hiredCount);
          }
        });

        const industryHiring = Array.from(industryMap.entries())
          .map(([name, hires]) => ({ name, hires }))
          .sort((a, b) => b.hires - a.hires)
          .slice(0, 8);

        // Fetch job seeker locations
        const { data: locationData } = await supabase
          .from("employee_profiles")
          .select("city")
          .eq("is_available", true)
          .not("city", "is", null);

        const locationMap = new Map<string, number>();
        locationData?.forEach((profile) => {
          if (profile.city) {
            const current = locationMap.get(profile.city) || 0;
            locationMap.set(profile.city, current + 1);
          }
        });

        const jobSeekerLocations = Array.from(locationMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);

        // Fetch top skills in demand
        const { data: jobsWithSkills } = await supabase
          .from("jobs")
          .select("skills_required")
          .eq("status", "published")
          .not("skills_required", "is", null);

        const skillsMap = new Map<string, number>();
        jobsWithSkills?.forEach((job) => {
          job.skills_required?.forEach((skill: string) => {
            const current = skillsMap.get(skill) || 0;
            skillsMap.set(skill, current + 1);
          });
        });

        const topSkills = Array.from(skillsMap.entries())
          .map(([skill, count]) => ({ skill, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        setMetrics({
          totalHires: totalHires || 0,
          activeJobSeekers: activeJobSeekers || 0,
          totalJobs: totalJobs || 0,
          publishedJobs: publishedJobs || 0,
          totalApplications: totalApplications || 0,
          conversionRate,
          industryHiring,
          jobSeekerLocations,
          topSkills,
        });
      } catch (error) {
        console.error("Error fetching metrics:", error);
      }

      setIsLoading(false);
    }

    fetchMetrics();
  }, [user, isAdmin]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Unable to Load Analytics</h1>
            <Button asChild>
              <Link to="/admin">Back to Admin Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/admin">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Dashboard
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 font-display">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track hiring trends, job seeker demographics, and platform performance
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Hires</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalHires}</div>
              <p className="text-xs text-muted-foreground">
                People hired through platform
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Job Seekers</CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeJobSeekers}</div>
              <p className="text-xs text-muted-foreground">
                Available for work
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Published Jobs</CardTitle>
              <Briefcase className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.publishedJobs}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalJobs} total jobs created
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalHires} / {metrics.totalApplications} applications
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Industry Hiring Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Industries Hiring the Most
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.industryHiring.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.industryHiring}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="hires" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No hiring data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job Seeker Locations Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Job Seeker Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.jobSeekerLocations.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.jobSeekerLocations}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {metrics.jobSeekerLocations.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No location data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Skills in Demand */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Top Skills in Demand
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topSkills.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {metrics.topSkills.map((item, index) => (
                  <div
                    key={item.skill}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium truncate">{item.skill}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No skills data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
