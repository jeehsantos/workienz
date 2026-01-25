import { Link } from "react-router-dom";
import { Lock, FileText } from "lucide-react";

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
  const featuredArticle = articles[0];
  const sideArticles = articles.slice(1, 3);

  if (!featuredArticle) {
    return null;
  }

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Highlights</h2>
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Large Featured Article - Left Side */}
        <article className="group bg-card rounded-lg border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300">
          {featuredArticle.cover_image_url ? (
            <div className="aspect-video bg-muted relative overflow-hidden">
              <img
                src={featuredArticle.cover_image_url}
                alt={featuredArticle.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {featuredArticle.is_premium && !hasSubscription && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                    <Lock className="w-6 h-6 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <FileText className="w-16 h-16 text-muted-foreground" />
            </div>
          )}

          <div className="p-6">
            <h3 className="font-bold text-2xl mb-3 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
              {featuredArticle.title}
            </h3>

            {featuredArticle.excerpt && (
              <p className="text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                {featuredArticle.excerpt}
              </p>
            )}

            <Link 
              to={featuredArticle.is_premium && !hasSubscription ? "/pricing" : `/articles/${featuredArticle.slug}`}
              className="text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              Read more
              {featuredArticle.is_premium && !hasSubscription && <Lock className="w-4 h-4" />}
            </Link>
          </div>
        </article>

        {/* Side Articles - Right Side */}
        <div className="flex flex-col gap-6">
          {sideArticles.map((article) => {
            const isLocked = article.is_premium && !hasSubscription;
            
            return (
              <article
                key={article.id}
                className="group bg-card rounded-lg border border-border/50 p-4 hover:shadow-lg transition-all duration-300"
              >
                <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>

                {article.excerpt && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {article.excerpt}
                  </p>
                )}

                <Link 
                  to={isLocked ? "/pricing" : `/articles/${article.slug}`}
                  className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1"
                >
                  Read more
                  {isLocked && <Lock className="w-3 h-3" />}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
