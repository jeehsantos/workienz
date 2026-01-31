import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, FileText, Lock, Search, BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HighlightsSection } from "@/components/articles/HighlightsSection";
import { SkeletonCard, SkeletonGrid } from "@/components/ui/skeleton-components";
import { Skeleton } from "@/components/ui/skeleton";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  is_premium: boolean;
  created_at: string;
};

export default function Articles() {
  const { user, isEmployee, isWriter, isLoading: authLoading } = useAuthContext();
  const writerAccess = isWriter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "premium">("all");

  useEffect(() => {
    async function fetchData() {
      // Fetch articles
      const { data: articlesData, error: articlesError } = await supabase
        .from("articles")
        .select("id, title, slug, excerpt, cover_image_url, is_premium, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (articlesError) {
        console.error("Error fetching articles:", articlesError);
      } else {
        setArticles(articlesData || []);
        setFilteredArticles(articlesData || []);
      }

      // Check subscription if user is logged in (writers always have access)
      if (user && !writerAccess) {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        setHasSubscription(!!subData);
      } else if (writerAccess) {
        setHasSubscription(true);
      }

      setIsLoading(false);
    }

    fetchData();
  }, [user, writerAccess]);

  useEffect(() => {
    let filtered = articles;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (article) =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (article.excerpt && article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by type
    if (filterType === "free") {
      filtered = filtered.filter((article) => !article.is_premium);
    } else if (filterType === "premium") {
      filtered = filtered.filter((article) => article.is_premium);
    }

    setFilteredArticles(filtered);
  }, [searchQuery, filterType, articles]);

  // Auth check - after all hooks (allow both employees and writers)
  if (!authLoading && (!user || (!isEmployee() && !isWriter()))) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6">
              Sign in to access Arrival Essentials.
            </p>
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-b border-border/50">
          <div className="container-tight py-12">
            <Skeleton className="h-10 w-40 mb-6" />
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-5 w-80" />
              </div>
            </div>
            <div className="flex gap-6 mt-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-24" />
              ))}
            </div>
          </div>
        </div>
        <div className="container-tight py-8">
          <div className="mb-8">
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-24" />
          </div>
          <SkeletonGrid columns={3} count={6} cardProps={{ showImage: true, showTitle: true, showDescription: true, lines: 2 }} />
        </div>
      </div>
    );
  }

  const freeCount = articles.filter((a) => !a.is_premium).length;
  const premiumCount = articles.filter((a) => a.is_premium).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-b border-border/50">
        <div className="container-tight py-12">
          {user && (
            <Button variant="ghost" asChild className="mb-6">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display">Arrival Essentials</h1>
              <p className="text-muted-foreground">
                Articles and guides to help you succeed
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-semibold">{articles.length}</span> articles
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-semibold">{freeCount}</span> free
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm">
                <span className="font-semibold">{premiumCount}</span> premium
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container-tight py-8">
        {/* Highlights Section */}
        <HighlightsSection articles={articles} hasSubscription={hasSubscription || writerAccess} />

        {/* Latest Posts Section Header with Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold">Latest posts</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-4 mb-8">
          <Select value={filterType} onValueChange={(value: "all" | "free" | "premium") => setFilterType(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Articles</SelectItem>
              <SelectItem value="free">Free Only</SelectItem>
              <SelectItem value="premium">Premium Only</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
          </span>
        </div>

        {!hasSubscription && user && isEmployee() && (
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Unlock Premium Articles</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Get access to all {premiumCount} premium articles and boost your career with expert insights.
                </p>
                <Button asChild size="sm">
                  <Link to="/pricing">View Plans</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {filteredArticles.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {searchQuery || filterType !== "all" ? "No Articles Found" : "No Articles Yet"}
            </h2>
            <p className="text-muted-foreground">
              {searchQuery || filterType !== "all"
                ? "Try adjusting your search or filter."
                : "Check back soon for new content."}
            </p>
            {(searchQuery || filterType !== "all") && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => {
              const isLocked = article.is_premium && !hasSubscription && !writerAccess;

              return (
                <article
                  key={article.id}
                  className="group bg-card rounded-lg border border-border/50 overflow-hidden hover:shadow-md transition-all duration-200"
                >
                  {article.cover_image_url ? (
                    <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                      <img
                        src={article.cover_image_url}
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                      {isLocked && (
                        <div className="absolute top-2 right-2">
                          <div className="w-8 h-8 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                      <FileText className="w-12 h-12 text-muted-foreground" />
                      {isLocked && (
                        <div className="absolute top-2 right-2">
                          <div className="w-8 h-8 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(article.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      <Link to={isLocked ? "/pricing" : `/articles/${article.slug}`}>
                        {article.title}
                      </Link>
                    </h3>

                    {article.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {article.excerpt}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <Link 
                        to={isLocked ? "/pricing" : `/articles/${article.slug}`}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        Read more
                      </Link>
                      {article.is_premium && (
                        <Badge variant="secondary" className="text-xs">
                          Premium
                        </Badge>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
