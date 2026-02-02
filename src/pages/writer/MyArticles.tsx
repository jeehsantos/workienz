import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, FileText, Eye, EyeOff, Crown, Pencil, ExternalLink, Tag, Trash2 } from "lucide-react";

type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  is_published: boolean;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
  journey_id: string | null;
  topic_id: string | null;
  journeys?: {
    title: string;
  } | null;
  topic_hubs?: {
    title: string;
  } | null;
};

export default function MyArticles() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isWriter, isAdmin } = useAuthContext();
  const { toast } = useToast();

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || (!isWriter() && !isAdmin()))) {
      navigate("/auth");
    }
  }, [user, authLoading, isWriter, isAdmin, navigate]);

  useEffect(() => {
    async function fetchArticles() {
      if (!user) return;

      const query = supabase
        .from("articles")
        .select(
          "id, title, slug, summary, is_published, is_premium, created_at, updated_at, journey_id, topic_id, journeys(title), topic_hubs(title)"
        )
        .eq("article_type", "guide")
        .order("created_at", { ascending: false });

      const { data, error } = isAdmin()
        ? await query
        : await query.eq("author_id", user.id);

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

    if (user && (isWriter() || isAdmin())) {
      fetchArticles();
    }
  }, [user, isWriter, isAdmin, toast]);

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

  const handleDelete = async (articleId: string) => {
    if (!confirm("Delete this guide topic? This action cannot be undone.")) return;

    const { error } = await supabase
      .from("articles")
      .delete()
      .eq("id", articleId);

    if (error) {
      console.error("Error deleting article:", error);
      toast({
        title: "Error",
        description: "Failed to delete this guide topic.",
        variant: "destructive",
      });
      return;
    }

    setArticles(articles.filter((article) => article.id !== articleId));
    toast({
      title: "Guide topic deleted",
      description: "The guide topic was removed successfully.",
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedArticles = articles.reduce(
    (acc, article) => {
      const journeyTitle = article.journeys?.title || "Unassigned Journey";
      const topicTitle = article.topic_hubs?.title || "Unassigned Topic";

      if (!acc[journeyTitle]) {
        acc[journeyTitle] = {};
      }
      if (!acc[journeyTitle][topicTitle]) {
        acc[journeyTitle][topicTitle] = [];
      }
      acc[journeyTitle][topicTitle].push(article);
      return acc;
    },
    {} as Record<string, Record<string, Article[]>>
  );

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
            <h1 className="text-3xl font-bold mb-2 font-display">
              {isAdmin() ? "All Guide Topics" : "My Guide Topics"}
            </h1>
            <p className="text-muted-foreground">
              View guide topics by classification and update them anytime.
            </p>
          </div>
          <Button asChild>
            <Link to="/writer/new-guide">
              <Plus className="w-4 h-4 mr-2" />
              New Topic
            </Link>
          </Button>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Guide Topics Yet</h2>
            <p className="text-muted-foreground mb-6">
              Start writing your first guide topic to help employees.
            </p>
            <Button asChild>
              <Link to="/writer/new-guide">Write Your First Topic</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedArticles).map(([journeyTitle, topicGroups]) => (
              <div key={journeyTitle} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">{journeyTitle}</h2>
                </div>

                <div className="space-y-6">
                  {Object.entries(topicGroups).map(([topicTitle, topicArticles]) => (
                    <div key={`${journeyTitle}-${topicTitle}`} className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <span>{topicTitle}</span>
                        <Badge variant="secondary">{topicArticles.length} topic{topicArticles.length !== 1 ? "s" : ""}</Badge>
                      </div>

                      <div className="space-y-4">
                        {topicArticles.map((article) => (
                          <div
                            key={article.id}
                            className="bg-card rounded-xl p-6 border border-border/50 shadow-soft"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
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
                                {article.summary && (
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                    {article.summary}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Created: {new Date(article.created_at).toLocaleDateString()} •
                                  Updated: {new Date(article.updated_at).toLocaleDateString()}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/guide?article=${article.id}`}>
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Read
                                  </Link>
                                </Button>
                                <Button variant="outline" size="sm" asChild>
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
                                {isAdmin() && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => handleDelete(article.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
