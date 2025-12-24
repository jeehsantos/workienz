import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const { user, isEmployee, isLoading: authLoading } = useAuthContext();

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Redirect if not logged in as employee
  if (!authLoading && (!user || !isEmployee())) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6">
              Sign in as a job seeker to access the Learning Center.
            </p>
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
      }

      // Check subscription if user is logged in
      if (user) {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        setHasSubscription(!!subData);
      }

      setIsLoading(false);
    }

    fetchData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

        <h1 className="text-3xl font-bold mb-2 font-display">Learning Center</h1>
        <p className="text-muted-foreground mb-8">
          Articles and guides to help you succeed in your job search.
        </p>

        {!hasSubscription && user && isEmployee() && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Unlock Premium Articles</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Subscribe to access all premium content and boost your career.
                </p>
                <Button asChild size="sm">
                  <Link to="/pricing">View Plans</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {articles.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Articles Yet</h2>
            <p className="text-muted-foreground">
              Check back soon for new content.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => {
              const isLocked = article.is_premium && !hasSubscription;

              return (
                <div
                  key={article.id}
                  className={`bg-card rounded-xl border border-border/50 overflow-hidden shadow-soft hover:shadow-md transition-shadow ${
                    isLocked ? "opacity-80" : ""
                  }`}
                >
                  {article.cover_image_url ? (
                    <div className="aspect-video bg-muted relative">
                      <img
                        src={article.cover_image_url}
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                      {isLocked && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                          <Lock className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center relative">
                      <FileText className="w-12 h-12 text-muted-foreground" />
                      {isLocked && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                          <Lock className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {article.is_premium && (
                        <Badge variant="secondary" className="text-xs">
                          Premium
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(article.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-semibold mb-2 line-clamp-2">{article.title}</h3>

                    {article.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {article.excerpt}
                      </p>
                    )}

                    {isLocked ? (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link to="/pricing">
                          <Lock className="w-4 h-4 mr-2" />
                          Subscribe to Read
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link to={`/articles/${article.slug}`}>Read Article</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
