import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, FileText } from "lucide-react";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  is_premium: boolean;
  created_at: string;
};

interface HighlightsSectionProps {
  articles: Article[];
  hasSubscription: boolean;
}

export function HighlightsSection({ articles, hasSubscription }: HighlightsSectionProps) {
  const highlightedArticles = articles.slice(0, 3);

  if (highlightedArticles.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Highlights</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {highlightedArticles.map((article) => {
          const isLocked = article.is_premium && !hasSubscription;

          return (
            <article
              key={article.id}
              className="group bg-card rounded-xl border border-border/50 overflow-hidden shadow-md hover:shadow-lg hover:border-border transition-all duration-300 hover:scale-[1.02]"
            >
              {article.cover_image_url ? (
                <div className="aspect-video bg-muted relative overflow-hidden">
                  <img
                    src={article.cover_image_url}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {isLocked && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                        <Lock className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                  <FileText className="w-16 h-16 text-muted-foreground" />
                  {isLocked && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                        <Lock className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  {article.is_premium ? (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="border-0">Free</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(article.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <h3 className="font-semibold text-xl mb-3 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                  {article.title}
                </h3>

                {article.excerpt && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" 
                    asChild
                  >
                    <Link to={`/articles/${article.slug}`}>Read Article</Link>
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
