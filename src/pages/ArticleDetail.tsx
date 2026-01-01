import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Lock, Calendar, User, Pencil, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
  const { user, isWriter, isLoading: authLoading } = useAuthContext();

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

  // Calculate reading time
  const calculateReadingTime = (text: string) => {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  };

  // Format content into paragraphs with proper spacing
  const formatContent = (content: string) => {
    // Split by double newlines for major paragraph breaks
    const sections = content.split(/\n\n+/);
    
    return sections.map((section, idx) => {
      // Check if it looks like a heading (short, no period at end, possibly all caps or title case)
      const isHeading = section.length < 100 && !section.endsWith('.') && section.split('\n').length === 1;
      
      if (isHeading && section.length > 0) {
        return (
          <h2 key={idx} className="text-xl md:text-2xl font-semibold font-display text-foreground mt-8 mb-4 first:mt-0">
            {section}
          </h2>
        );
      }
      
      // Handle single newlines within a section as soft breaks
      const lines = section.split('\n');
      
      return (
        <p key={idx} className="text-base md:text-lg leading-relaxed md:leading-8 text-foreground/90 mb-6">
          {lines.map((line, lineIdx) => (
            <span key={lineIdx}>
              {line}
              {lineIdx < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      );
    });
  };

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
              <Button asChild size="lg">
                <Link to="/pricing">Subscribe Now</Link>
              </Button>
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header with cover image */}
      {article.cover_image_url && (
        <div className="container-tight pt-6 md:pt-8">
          <div className="aspect-video max-h-[400px] bg-muted rounded-xl overflow-hidden mx-auto">
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="container-tight">
        {/* Back button and edit button */}
        <div className="flex items-center justify-between py-6 md:py-8">
          <Button variant="ghost" asChild>
            <Link to="/articles">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Articles
            </Link>
          </Button>
          
          {canEdit && (
            <Button variant="outline" asChild>
              <Link to={`/writer/articles/${article.id}/edit`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Article
              </Link>
            </Button>
          )}
        </div>

        {/* Article content container */}
        <article className="max-w-3xl mx-auto pb-16 md:pb-24">
          {/* Meta info bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-muted-foreground">
            {article.is_premium && (
              <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                Premium
              </Badge>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(article.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {readingTime} min read
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display leading-tight mb-6">
            {article.title}
          </h1>

          {/* Author info */}
          {authorName && (
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{authorName}</p>
                <p className="text-sm text-muted-foreground">Author</p>
              </div>
            </div>
          )}

          {/* Excerpt/Lead paragraph */}
          {article.excerpt && (
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-8 font-light">
              {article.excerpt}
            </p>
          )}

          <Separator className="mb-8" />

          {/* Article body with proper typography */}
          <div className="article-content">
            {formatContent(article.content)}
          </div>

          {/* End of article */}
          <Separator className="my-12" />
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-xl bg-muted/50 border border-border/50">
            <div className="text-center sm:text-left">
              <p className="font-medium text-foreground">Enjoyed this article?</p>
              <p className="text-sm text-muted-foreground">Check out more content for job seekers</p>
            </div>
            <Button asChild>
              <Link to="/articles">Browse More Articles</Link>
            </Button>
          </div>
        </article>
      </div>
    </div>
  );
}
