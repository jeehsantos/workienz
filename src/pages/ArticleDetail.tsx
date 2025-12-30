import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Lock, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/landing/Navbar";
type Article = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  is_premium: boolean;
  created_at: string;
  author_id: string;
};

export default function ArticleDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isEmployee, isLoading: authLoading } = useAuthContext();

  const [article, setArticle] = useState<Article | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    async function fetchArticle() {
      if (!slug) return;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, content, excerpt, cover_image_url, is_premium, created_at, author_id")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching article:", error);
        setIsLoading(false);
        return;
      }

      if (data) {
        setArticle(data);

        // Fetch author name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", data.author_id)
          .maybeSingle();

        setAuthorName(profile?.full_name || "Anonymous");
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

    fetchArticle();
  }, [slug, user]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The article you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link to="/articles">Back to Articles</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLocked = article.is_premium && !hasSubscription;

  // If locked, show premium gate
  if (isLocked) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background pt-16">
        <div className="container-tight py-8">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/articles">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Articles
            </Link>
          </Button>

          <article className="max-w-3xl mx-auto">
            {article.cover_image_url && (
              <div className="aspect-video bg-muted rounded-xl overflow-hidden mb-8 relative">
                <img
                  src={article.cover_image_url}
                  alt={article.title}
                  className="w-full h-full object-cover blur-sm"
                />
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <Lock className="w-16 h-16 text-muted-foreground" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">Premium</Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(article.created_at).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-3xl font-bold mb-4 font-display">{article.title}</h1>

            {article.excerpt && (
              <p className="text-lg text-muted-foreground mb-6">{article.excerpt}</p>
            )}

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
              <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Premium Content</h2>
              <p className="text-muted-foreground mb-6">
                This article is available to premium subscribers. Unlock access to all
                premium content and accelerate your career growth.
              </p>
              <Button asChild size="lg">
                <Link to="/pricing">Subscribe Now</Link>
              </Button>
            </div>
          </article>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-16">
      <div className="container-tight py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/articles">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Articles
          </Link>
        </Button>

        <article className="max-w-3xl mx-auto">
          {article.cover_image_url && (
            <div className="aspect-video bg-muted rounded-xl overflow-hidden mb-8">
              <img
                src={article.cover_image_url}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
            {article.is_premium && <Badge variant="secondary">Premium</Badge>}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(article.created_at).toLocaleDateString()}
            </span>
            {authorName && (
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {authorName}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-6 font-display">{article.title}</h1>

          <div className="prose prose-lg max-w-none dark:prose-invert">
            {article.content.split('\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </article>
      </div>
      </div>
    </>
  );
}
