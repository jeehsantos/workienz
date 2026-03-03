import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowLeft,
  Users,
  UserMinus,
  User,
  MapPin,
  Clock,
  RefreshCw,
} from "lucide-react";

interface PoolMember {
  id: string;
  employee_id: string;
  category: string;
  status: string;
  source_job_id: string | null;
  created_at: string;
  profile: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  employee_profile: {
    id: string;
    headline: string | null;
    city: string | null;
    experience_years: number | null;
    skills: string[] | null;
  } | null;
}

export default function TalentPool() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();
  const { toast } = useToast();

  const [members, setMembers] = useState<PoolMember[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  const fetchMembers = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    let query = supabase
      .from("contractor_talent_pool_members")
      .select("id, employee_id, category, status, source_job_id, created_at")
      .eq("contractor_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (selectedCategory !== "all") {
      query = query.eq("category", selectedCategory);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching pool members:", error);
      setIsLoading(false);
      return;
    }

    const poolMembers = data || [];

    if (poolMembers.length === 0) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    // Batch fetch employee profiles by user_id
    const employeeUserIds = poolMembers.map((m) => m.employee_id);
    const { data: empProfiles } = await supabase
      .from("employee_profiles")
      .select("id, user_id, headline, city, experience_years, skills")
      .in("user_id", employeeUserIds);

    const empMap = new Map((empProfiles || []).map((e) => [e.user_id, e]));

    // Batch fetch user profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url")
      .in("user_id", employeeUserIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    const enriched: PoolMember[] = poolMembers.map((m) => ({
      ...m,
      profile: profileMap.get(m.employee_id) || null,
      employee_profile: empMap.get(m.employee_id) || null,
    }));

    setMembers(enriched);
    setIsLoading(false);
  }, [user, selectedCategory]);

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      if (!user) return;
      const { data } = await supabase
        .from("contractor_talent_pool_members")
        .select("category")
        .eq("contractor_id", user.id)
        .eq("status", "active");

      const uniqueCats = [...new Set((data || []).map((d) => d.category))].sort();
      setCategories(uniqueCats);
    }
    if (user && isContractor()) fetchCategories();
  }, [user, isContractor]);

  useEffect(() => {
    if (user && isContractor()) fetchMembers();
  }, [user, isContractor, fetchMembers]);

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    const { error } = await supabase
      .from("contractor_talent_pool_members")
      .update({ status: "removed_by_contractor" })
      .eq("id", memberId);

    setRemovingId(null);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove member from pool.",
        variant: "destructive",
      });
      return;
    }

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast({ title: "Removed", description: "Worker removed from talent pool." });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/contractor/jobs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Jobs
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display">Talent Pool</h1>
            <p className="text-muted-foreground mt-1">
              {members.length} active member{members.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchMembers}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Pool Members Yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              When you approve applicants from shift-based job postings, they'll appear here in your Talent Pool.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-card rounded-xl p-6 border border-border/50"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold">
                        {member.profile?.full_name || "Worker"}
                      </h3>
                      <Badge variant="secondary">{member.category}</Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {member.employee_profile?.headline || "Available for shifts"}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                      {member.employee_profile?.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {member.employee_profile.city}
                        </span>
                      )}
                      {member.employee_profile?.experience_years != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {member.employee_profile.experience_years} years exp
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Added {new Date(member.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {member.employee_profile?.skills && member.employee_profile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {member.employee_profile.skills.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-[140px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link to={`/workers/${member.employee_profile?.id}`}>
                        View Profile
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(member.id)}
                      disabled={removingId === member.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {removingId === member.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <UserMinus className="w-4 h-4 mr-2" />
                      )}
                      Remove
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
