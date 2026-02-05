import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportProblemDialog } from "@/components/articles/ReportProblemDialog";
import { ShareArticle } from "@/components/articles/ShareArticle";
import { formatMarkdownText } from "@/lib/formatMarkdownText";
import {
  Search,
  ChevronRight,
  ArrowLeft,
  Filter,
  Info,
  Plane,
  MapPin,
  Home,
  Briefcase,
  Wallet,
  Users,
  Settings,
  FileText,
  Clock,
  Lock,
  GraduationCap,
} from "lucide-react";
type Journey = {
  id: string;
  title: string;
  description: string | null;
  icon_name: string;
  topic_count?: number;
};
type TopicHub = {
  id: string;
  journey_id: string;
  title: string;
  description: string | null;
};
type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  visa_type: string | null;
  user_stage: string | null;
  article_type: string | null;
  is_premium: boolean;
  created_at: string;
  journey_id?: string | null;
  topic_id?: string | null;
  content?: string | null;
  content_blocks?: any;
};
const ICON_MAP: Record<string, React.ElementType> = {
  Plane,
  MapPin,
  Home,
  Briefcase,
  Wallet,
  Users,
  Settings,
  FileText,
};
const VISA_FILTERS = [
  {
    value: "all",
    label: "All Visas",
  },
  {
    value: "student",
    label: "Student",
  },
  {
    value: "worker",
    label: "Worker",
  },
  {
    value: "whv",
    label: "WHV",
  },
  {
    value: "tourist",
    label: "Tourist",
  },
];
export default function GuideHub() {
  const { user, isEmployee, isLoading: authLoading, isAdmin, isWriter } = useAuthContext();
  const [view, setView] = useState<"hub" | "topic" | "article">("hub");
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [fullArticle, setFullArticle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [topics, setTopics] = useState<TopicHub[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visaFilter, setVisaFilter] = useState("all");
  const location = useLocation();
  useEffect(() => {
    fetchJourneys();
    checkSubscription();
  }, [user]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const articleId = params.get("article");
    if (!articleId) return;
    const loadArticleFromLink = async () => {
      setIsLoading(true);
      let articleQuery = supabase
        .from("articles")
        .select(
          "id, title, slug, summary, visa_type, user_stage, article_type, is_premium, created_at, journey_id, topic_id, content, content_blocks, is_published",
        )
        .eq("id", articleId);
      if (!isAdmin() && !isWriter()) {
        articleQuery = articleQuery.eq("is_published", true);
      }
      const { data: articleData } = await articleQuery.maybeSingle();
      if (!articleData) {
        setIsLoading(false);
        return;
      }
      if (articleData.journey_id) {
        const { data: journeyData } = await supabase
          .from("journeys")
          .select("id, title, description, icon_name")
          .eq("id", articleData.journey_id)
          .maybeSingle();
        if (journeyData) {
          setSelectedJourney(journeyData);
        }
        const { data: topicData } = await supabase
          .from("topic_hubs")
          .select("id, journey_id, title, description")
          .eq("journey_id", articleData.journey_id)
          .eq("is_active", true)
          .order("display_order", {
            ascending: true,
          });
        setTopics(topicData || []);
        const { data: articleListData } = await supabase
          .from("articles")
          .select("id, title, slug, summary, visa_type, user_stage, article_type, is_premium, created_at")
          .eq("journey_id", articleData.journey_id)
          .eq("is_published", true)
          .order("created_at", {
            ascending: false,
          });
        setArticles(articleListData || []);
      }
      setSelectedArticle(articleData);
      setFullArticle(articleData);
      setView("article");
      setIsLoading(false);
      window.scrollTo(0, 0);
    };
    loadArticleFromLink();
  }, [location.search]);
  const fetchJourneys = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("journeys")
      .select("id, title, description, icon_name")
      .eq("is_active", true)
      .order("display_order", {
        ascending: true,
      });
    if (error) {
      console.error("Error fetching journeys:", error);
    } else {
      // Get topic counts
      const journeysWithCounts = await Promise.all(
        (data || []).map(async (journey) => {
          const { count } = await supabase
            .from("topic_hubs")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("journey_id", journey.id)
            .eq("is_active", true);
          return {
            ...journey,
            topic_count: count || 0,
          };
        }),
      );
      setJourneys(journeysWithCounts);
    }
    setIsLoading(false);
  };
  const checkSubscription = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    setHasSubscription(!!data);
  };
  const handleSelectJourney = async (journey: Journey) => {
    setSelectedJourney(journey);
    setIsLoading(true);

    // Fetch topics for this journey
    const { data: topicData } = await supabase
      .from("topic_hubs")
      .select("id, journey_id, title, description")
      .eq("journey_id", journey.id)
      .eq("is_active", true)
      .order("display_order", {
        ascending: true,
      });
    setTopics(topicData || []);

    // Fetch articles for this journey
    const { data: articleData } = await supabase
      .from("articles")
      .select("id, title, slug, summary, visa_type, user_stage, article_type, is_premium, created_at")
      .eq("journey_id", journey.id)
      .eq("is_published", true)
      .order("created_at", {
        ascending: false,
      });
    setArticles(articleData || []);
    setView("topic");
    setIsLoading(false);
    window.scrollTo(0, 0);
  };
  const handleSelectArticle = async (article: Article) => {
    setSelectedArticle(article);
    setIsLoading(true);

    // Fetch full article
    const { data } = await supabase.from("articles").select("*").eq("id", article.id).single();
    setFullArticle(data);
    setView("article");
    setIsLoading(false);
    window.scrollTo(0, 0);
  };
  const handleBackToHub = () => {
    setView("hub");
    setSelectedJourney(null);
    setSearchQuery("");
    setVisaFilter("all");
    window.scrollTo(0, 0);
  };
  const handleBackToTopic = () => {
    setView("topic");
    setSelectedArticle(null);
    setFullArticle(null);
    window.scrollTo(0, 0);
  };
  const getIcon = (iconName: string) => {
    const IconComp = ICON_MAP[iconName] || FileText;
    return <IconComp className="w-6 h-6" />;
  };
  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVisa = visaFilter === "all" || article.visa_type === visaFilter;
    return matchesSearch && matchesVisa;
  });
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Render Journey Hub
  if (view === "hub") {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero */}
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

            <div className="gap-3 mb-4 flex items-center justify-center">
              <div>
                <h1 className="text-3xl font-bold font-display text-center "> How can we help? </h1>
                <p className="text-muted-foreground">Your complete guide to living and working in New Zealand</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container-tight py-8">
          {/* Search */}
          <div className="relative max-w-2xl mx-auto mb-12">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              type="text"
              placeholder="Search for a question (e.g. 'How do I get an IRD number?')"
              className="w-full pl-12 pr-4 py-6 text-lg rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Journey Cards */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          ) : journeys.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border/50">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Guides Yet</h2>
              <p className="text-muted-foreground">Check back soon for guides on living in New Zealand.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {journeys.map((journey) => (
                <div
                  key={journey.id}
                  onClick={() => handleSelectJourney(journey)}
                  className="group border border-border p-6 rounded-2xl hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer bg-card"
                >
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground">
                    {getIcon(journey.icon_name)}
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{journey.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2 whitespace-break-spaces pb-[16px]">
                    {journey.description || "Explore this topic"}
                  </p>
                  <div className="flex items-center text-sm font-bold text-primary group-hover:translate-x-1 transition-transform">
                    Explore <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Topic Hub
  if (view === "topic" && selectedJourney) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8">
          <button
            onClick={handleBackToHub}
            className="flex items-center text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Guide
          </button>

          <div className="mb-8 border-b pb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{selectedJourney.title}</h1>
            <p className="text-muted-foreground max-w-2xl">{selectedJourney.description}</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Filters */}
            <div className="w-full lg:w-64 flex-shrink-0">
              <div className="lg:sticky lg:top-24 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center">
                    <Filter className="w-3 h-3 mr-2" /> Filter By Visa
                  </h4>
                  <div className="space-y-2">
                    {VISA_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setVisaFilter(f.value)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${visaFilter === f.value ? "bg-primary text-primary-foreground font-bold shadow-md" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {topics.length > 0 && (
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="flex items-center gap-2 text-primary font-bold mb-2">
                      <Info className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-tight">Did you know?</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {topics.map((topic) => (
                        <li key={topic.id}>• {topic.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Article List */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 bg-card p-3 rounded-xl border border-border">
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                  {filteredArticles.length} Article{filteredArticles.length !== 1 ? "s" : ""}
                </span>
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

              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                  ))}
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl bg-muted/50">
                  <p className="text-muted-foreground font-medium">No articles found matching your criteria.</p>
                </div>
              ) : (
                filteredArticles.map((article) => {
                  const isLocked = article.is_premium && !hasSubscription && !user;
                  return (
                    <div
                      key={article.id}
                      onClick={() => !isLocked && handleSelectArticle(article)}
                      className={`p-6 border border-border rounded-2xl bg-card hover:border-primary/50 hover:shadow-xl cursor-pointer transition-all group ${isLocked ? "opacity-75" : ""}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-foreground text-lg leading-tight group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {article.visa_type && article.visa_type !== "all" && (
                            <Badge variant="secondary" className="text-[10px]">
                              {article.visa_type.toUpperCase()}
                            </Badge>
                          )}
                          {isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {article.summary || "Read the full article for details..."}
                      </p>
                      <div className="flex items-center text-primary text-sm font-bold">
                        {isLocked ? "Unlock with subscription" : "Read Detailed Answer"}
                        <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Article Page
  if (view === "article" && fullArticle) {
    const contentBlocks = fullArticle.content_blocks || [];
    return (
      <div className="min-h-screen bg-background">
        <div className="container-tight py-8 max-w-3xl mx-auto">
          <button
            onClick={handleBackToTopic}
            className="flex items-center text-muted-foreground text-sm mb-8 hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Topics
          </button>

          {/* Article Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] px-3 py-1 bg-primary/10 rounded-full">
                {fullArticle.article_type === "guide"
                  ? "Step-by-Step Guide"
                  : fullArticle.article_type === "checklist"
                    ? "Checklist"
                    : "Atomic Answer"}
              </span>
              <div className="w-1 h-1 bg-border rounded-full" />
              <div className="flex items-center text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                <Clock className="w-3 h-3 mr-1" /> 2 min read
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight mb-8">
              {fullArticle.title}
            </h1>

            {/* TL;DR Box */}
            {fullArticle.summary && (
              <div className="bg-foreground text-background p-6 md:p-8 rounded-2xl mb-10 shadow-xl">
                <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-3">The short answer</h4>
                <p className="text-base md:text-lg leading-relaxed font-medium">{fullArticle.summary}</p>
              </div>
            )}

            {/* Content Blocks */}
            <div className="space-y-6">
              {contentBlocks.length > 0 ? (
                contentBlocks.map((block: any, idx: number) => {
                  const formattedContent = formatMarkdownText(block.value || "");
                  if (block.type === "heading") {
                    return (
                      <h2
                        key={idx}
                        className="text-xl md:text-2xl font-bold text-foreground pt-6 border-t border-border"
                      >
                        {block.value}
                      </h2>
                    );
                  }
                  if (block.type === "warning") {
                    return (
                      <div
                        key={idx}
                        className="flex gap-4 p-4 md:p-6 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-100"
                      >
                        <div className="flex-shrink-0">⚠️</div>
                        <div>
                          <strong className="block text-sm font-bold uppercase tracking-tight mb-1">
                            Legal Requirement
                          </strong>
                          <div
                            className="text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formattedContent,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                  if (block.type === "tip") {
                    return (
                      <div
                        key={idx}
                        className="flex gap-4 p-4 md:p-6 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100"
                      >
                        <div className="flex-shrink-0">💡</div>
                        <div>
                          <strong className="block text-sm font-bold uppercase tracking-tight mb-1">Pro Tip</strong>
                          <div
                            className="text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formattedContent,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className="text-base md:text-lg text-muted-foreground leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: formattedContent,
                      }}
                    />
                  );
                })
              ) : fullArticle.content ? (
                <div
                  className="prose prose-slate dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: fullArticle.content.replace(/\n/g, "<br />"),
                  }}
                />
              ) : (
                <p className="text-muted-foreground">No content available.</p>
              )}
            </div>
          </div>

          {/* Related Section Placeholder */}
          <div className="border-t pt-12 mt-16">
            <h3 className="text-xl font-bold text-foreground mb-6">Related Questions</h3>
            <p className="text-muted-foreground text-sm">More related articles coming soon...</p>
          </div>

          <div className="mt-12 space-y-6">
            <ShareArticle title={fullArticle.title} url={`/articles/${fullArticle.slug ?? fullArticle.id}`} />

            <div className="border-t pt-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Enjoyed this guide?</p>
                  <p className="text-sm text-muted-foreground">
                    Check out more content{" "}
                    <button
                      type="button"
                      onClick={handleBackToTopic}
                      className="text-primary underline underline-offset-4"
                    >
                      Go back to the previous step
                    </button>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user && isEmployee() && (
                    <ReportProblemDialog articleId={fullArticle.id} userId={user.id} articleTitle={fullArticle.title} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
