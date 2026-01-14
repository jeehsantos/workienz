import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Search, User, MapPin, Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WorkerDTO {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  headline: string | null;
  city: string | null;
  country: string | null;
  experience_years: number | null;
  skills: string[] | null;
  availability: string | null;
  is_available: boolean | null;
  avatar_url: string | null;
  access_level: "full" | "limited";
  is_applicant: boolean;
  can_contact: boolean;
}

export default function SearchWorkers() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isContractor } = useAuthContext();

  const [workers, setWorkers] = useState<WorkerDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && (!user || !isContractor())) {
      navigate("/auth");
    }
  }, [user, authLoading, isContractor, navigate]);

  // Fetch workers from backend API
  useEffect(() => {
    async function fetchWorkers() {
      if (!user) return;
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke("search-workers", {
        body: {
          filters: {
            city: cityFilter || undefined,
            skill: skillFilter || undefined,
            availability: availabilityFilter !== "all" ? availabilityFilter : undefined,
            search: searchTerm || undefined,
          },
        },
      });

      if (error) {
        console.error("Error fetching workers:", error);
        setIsLoading(false);
        return;
      }

      setWorkers(data?.workers ?? []);
      setHasActiveSubscription(data?.has_active_subscription ?? false);
      setIsLoading(false);
    }

    if (user && isContractor()) {
      fetchWorkers();
    }
  }, [user, isContractor, cityFilter, searchTerm, skillFilter, availabilityFilter]);

  if (authLoading) {
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
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2 font-display">Find Workers</h1>
        <p className="text-muted-foreground mb-8">
          Search through available job seekers and find the right fit for your needs.
        </p>

        {/* Filters */}
        <div className="bg-card rounded-xl p-6 border border-border/50 mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, headline, skills..."
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
              <Label>Skill</Label>
              <Input
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder="e.g., Forklift"
              />
            </div>

            <div className="space-y-2">
              <Label>Availability</Label>
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="1-week">Within 1 Week</SelectItem>
                  <SelectItem value="2-weeks">Within 2 Weeks</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
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
        ) : workers.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Workers Found</h2>
            <p className="text-muted-foreground">
              Try adjusting your filters to find more candidates.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {workers.map((worker) => {
              const displayName = worker.full_name || `${worker.first_name ?? ''} ${worker.last_name ?? ''}`.trim() || "User";
              
              return (
                <div
                  key={worker.id}
                  className="bg-card rounded-xl p-6 border border-border/50 shadow-soft hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{displayName}</h3>
                        {worker.is_applicant && (
                          <Badge variant="secondary" className="text-xs">Applicant</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {worker.headline || "The Workie"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    {worker.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{worker.city}</span>
                      </div>
                    )}
                    {worker.experience_years !== null && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{worker.experience_years} years experience</span>
                      </div>
                    )}
                  </div>

                  {worker.skills && worker.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {worker.skills.slice(0, 4).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {worker.skills.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{worker.skills.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  {worker.access_level === "limited" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-muted/50 rounded-lg p-2">
                      <Lock className="w-3 h-3" />
                      <span>Subscribe to view full profile & contact</span>
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to={`/workers/${worker.id}`}>View Profile</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
