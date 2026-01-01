import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, FileText, Eye, EyeOff, Crown, Pencil, ExternalLink } from "lucide-react";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  is_published: boolean;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
};

export default function MyArticles() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isWriter } = useAuthContext();
  const { toast } = useToast();

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isWriter())) {
      navigate("/auth");
    }
  }, [user, authLoading, isWriter, navigate]);

  useEffect(() => {
    async function fetchArticles() {
      if (!user) return;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, excerpt, is_published, is_premium, created_at, updated_at")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching articles:", error);
        toast({
          title: "Error",
          description: "Failed to load articles.",
          variant: "destructive",
        });
      } else {
        setArticles(data || []);
      }

      setIsLoading(false);
    }

    if (user && isWriter()) {
      fetchArticles();
    }
  }, [user, isWriter, toast]);

  const togglePublish = async (article: Article) => {
    const { error } = await supabase
      .from("articles")
      .update({ is_published: !article.is_published })
      .eq("id", article.id);

    if (error) {
      console.error("Error updating article:", error);
      toast({
        title: "Error",
        description: "Failed to update article.",
        variant: "destructive",
      });
      return;
    }

    setArticles(
      articles.map((a) =>
        a.id === article.id ? { ...a, is_published: !a.is_published } : a
      )
    );

    toast({
      title: article.is_published ? "Article Unpublished" : "Article Published",
      description: article.is_published
        ? "The article is now hidden from readers."
        : "The article is now live.",
    });
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
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 font-display">My Articles</h1>
            <p className="text-muted-foreground">
              Manage your published and draft articles.
            </p>
          </div>
          <Button asChild>
            <Link to="/writer/new-article">
              <Plus className="w-4 h-4 mr-2" />
              New Article
            </Link>
          </Button>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Articles Yet</h2>
            <p className="text-muted-foreground mb-6">
              Start writing your first article to help job seekers.
            </p>
            <Button asChild>
              <Link to="/writer/new-article">Write Your First Article</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <div
                key={article.id}
                className="bg-card rounded-xl p-6 border border-border/50 shadow-soft"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{article.title}</h3>
                      {article.is_premium && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          Premium
                        </Badge>
                      )}
                      <Badge variant={article.is_published ? "default" : "outline"}>
                        {article.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    {article.excerpt && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {article.excerpt}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(article.created_at).toLocaleDateString()} •
                      Updated: {new Date(article.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {article.is_published && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/articles/${article.slug}`}>
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link to={`/writer/articles/${article.id}/edit`}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePublish(article)}
                    >
                      {article.is_published ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-1" />
                          Publish
                        </>
                      )}
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
