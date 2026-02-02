import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Lock, Calendar, User, Pencil, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReportProblemDialog } from "@/components/articles/ReportProblemDialog";
import { ShareArticle } from "@/components/articles/ShareArticle";
import { SkeletonArticle } from "@/components/ui/skeleton-components";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeButton } from "@/components/ui/upgrade-button";
import { formatMarkdownText } from "@/lib/formatMarkdownText";

type Article = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  is_premium: boolean;
  created_at: string;
  author_id: string;
};

export default function ArticleDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isWriter, isEmployee, isLoading: authLoading } = useAuthContext();
  const writerAccess = isWriter();

  const [article, setArticle] = useState<Article | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Check if current user is the author
  const isAuthor = user && article && user.id === article.author_id;
  const canEdit = isAuthor && isWriter();

  useEffect(() => {
    async function fetchArticle() {
      if (!slug) return;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, content, excerpt, cover_image_url, category, is_premium, created_at, author_id")
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

      // Check subscription only for premium articles and non-writers
      if (user && data?.is_premium && !writerAccess) {
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

    fetchArticle();
  }, [slug, user, writerAccess]);

  // Calculate reading time
  const calculateReadingTime = (text: string) => {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-6 md:py-8">
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid lg:grid-cols-[1fr_300px] gap-8 pb-16">
            <div className="min-w-0">
              <SkeletonArticle showImage={true} showMeta={true} />
            </div>
            <aside className="hidden lg:block">
              <div className="sticky top-8 space-y-6">
                <div className="bg-card rounded-lg border border-border/50 p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="bg-card rounded-lg border border-border/50 p-4">
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </aside>
          </div>
        </div>
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

  const isLocked = article.is_premium && !hasSubscription && !writerAccess;
  const readingTime = calculateReadingTime(article.content);

  // If locked, show premium gate
  if (isLocked) {
    return (
      <div className="min-h-screen bg-background">
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
              <UpgradeButton size="lg">Subscribe Now</UpgradeButton>
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <div className="py-6 md:py-8">
          <Button variant="ghost" asChild>
            <Link to="/articles">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Articles
            </Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-8 pb-16">
          {/* Main Content */}
          <article className="min-w-0">
            {/* Author info and metadata */}
            <div className="flex items-center gap-3 mb-6">
              {authorName && (
                <>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{authorName}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(article.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/writer/articles/${article.id}/edit`}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
              {article.title}
            </h1>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 pb-8 border-b">
                {article.excerpt}
              </p>
            )}

            {/* Cover Image */}
            {article.cover_image_url && (
              <div className="mb-8">
                <img
                  src={article.cover_image_url}
                  alt={article.title}
                  className="w-full rounded-lg"
                />
              </div>
            )}

            {/* Article body */}
            <div
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: formatMarkdownText(article.content) }}
            />

            {/* Category and Share Section */}
            <div className="mt-12 pt-8 border-t space-y-6">
              {/* Category */}
              {article.category && (
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <Badge variant="secondary" className="capitalize">
                    {article.category.replace(/-/g, ' ')}
                  </Badge>
                </div>
              )}

              {/* Share Section */}
              <ShareArticle 
                title={article.title} 
                url={`/articles/${article.slug}`} 
              />
            </div>

            {/* End section */}
            <div className="mt-12 pt-8 border-t">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Enjoyed this article?</p>
                  <p className="text-sm text-muted-foreground">
                    Check out more content{" "}
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="text-primary underline underline-offset-4"
                    >
                      Go back to the previous page
                    </button>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user && isEmployee() && (
                    <ReportProblemDialog 
                      articleId={article.id} 
                      userId={user.id} 
                      articleTitle={article.title} 
                    />
                  )}
                </div>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-6">
              {/* Table of Contents placeholder */}
              <div className="bg-card rounded-lg border border-border/50 p-4">
                <h3 className="font-semibold mb-3">Table of contents</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="text-xs">Article sections will appear here</p>
                </div>
              </div>

              {/* Reading time */}
              <div className="bg-card rounded-lg border border-border/50 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{readingTime} min read</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
