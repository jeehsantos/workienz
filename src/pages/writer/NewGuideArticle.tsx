import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ContentBlockEditor, type ContentBlock } from "@/components/content/ContentBlockEditor";
import { ArticlePreview } from "@/components/content/ArticlePreview";
import {
  Loader2,
  ArrowLeft,
  Save,
  Eye,
  CheckCircle2,
  Monitor,
  Smartphone,
} from "lucide-react";

type Journey = {
  id: string;
  title: string;
};

type TopicHub = {
  id: string;
  journey_id: string;
  title: string;
};

const ARTICLE_TYPES = [
  { value: "qa", label: "Q&A" },
  { value: "guide", label: "Guide" },
  { value: "checklist", label: "Checklist" },
];

const VISA_TYPES = [
  { value: "all", label: "All Visas" },
  { value: "student", label: "Student" },
  { value: "worker", label: "Worker" },
  { value: "whv", label: "WHV" },
  { value: "tourist", label: "Tourist" },
  { value: "resident", label: "Resident" },
];

const USER_STAGES = [
  { value: "before_arrival", label: "Before arrival" },
  { value: "arrival", label: "Arrival" },
  { value: "first_30_days", label: "First 30 days" },
  { value: "living_here", label: "Living here" },
];

export default function NewGuideArticle() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isWriter, isAdmin } = useAuthContext();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [topics, setTopics] = useState<TopicHub[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<TopicHub[]>([]);

  const [formData, setFormData] = useState({
    journey_id: "",
    topic_id: "",
    article_type: "guide",
    title: "",
    slug: "",
    summary: "",
    content_blocks: [] as ContentBlock[],
    visa_type: "all",
    user_stage: "before_arrival",
    is_published: false,
    is_premium: true,
  });

  useEffect(() => {
    if (!authLoading && (!user || (!isWriter() && !isAdmin()))) {
      navigate("/auth");
    }
  }, [user, authLoading, isWriter, isAdmin, navigate]);

  useEffect(() => {
    async function fetchStructure() {
      const { data: journeyData } = await supabase
        .from("journeys")
        .select("id, title")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (journeyData) {
        setJourneys(journeyData);
      }

      const { data: topicData } = await supabase
        .from("topic_hubs")
        .select("id, journey_id, title")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (topicData) {
        setTopics(topicData);
      }
    }

    fetchStructure();
  }, []);

  useEffect(() => {
    if (formData.journey_id) {
      setFilteredTopics(topics.filter((t) => t.journey_id === formData.journey_id));
      setFormData((prev) => ({ ...prev, topic_id: "" }));
    } else {
      setFilteredTopics([]);
    }
  }, [formData.journey_id, topics]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  };

  const validateStep = (stepNum: number): boolean => {
    if (stepNum === 1) {
      if (!formData.journey_id || !formData.topic_id) {
        toast({
          title: "Missing Fields",
          description: "Please select a journey and topic.",
          variant: "destructive",
        });
        return false;
      }
    }
    if (stepNum === 2) {
      if (!formData.title.trim()) {
        toast({
          title: "Missing Title",
          description: "Please enter a question/title.",
          variant: "destructive",
        });
        return false;
      }
      if (!formData.summary.trim()) {
        toast({
          title: "Missing Summary",
          description: "Please enter a TL;DR summary.",
          variant: "destructive",
        });
        return false;
      }
      if (formData.content_blocks.length === 0) {
        toast({
          title: "Missing Content",
          description: "Please add at least one content block.",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleSubmit = async (publish: boolean) => {
    if (!user) return;

    if (!validateStep(2)) {
      setStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert content blocks to legacy content for backward compatibility
      const legacyContent = formData.content_blocks
        .map((block) => {
          if (block.type === "heading") return `## ${block.value}`;
          if (block.type === "warning") return `> ⚠️ ${block.value}`;
          if (block.type === "tip") return `> 💡 ${block.value}`;
          return block.value;
        })
        .join("\n\n");

      const { error } = await supabase.from("articles").insert({
        author_id: user.id,
        title: formData.title,
        slug: formData.slug || generateSlug(formData.title),
        summary: formData.summary,
        content: legacyContent,
        content_blocks: formData.content_blocks,
        journey_id: formData.journey_id || null,
        topic_id: formData.topic_id || null,
        article_type: formData.article_type,
        visa_type: formData.visa_type,
        user_stage: formData.user_stage,
        is_published: publish,
        is_premium: formData.is_premium,
      });

      if (error) throw error;

      // Fire-and-forget: trigger embedding ingestion for published articles
      if (publish) {
        // Need the newly created article ID — fetch by slug
        const slug = formData.slug || generateSlug(formData.title);
        supabase
          .from("articles")
          .select("id")
          .eq("slug", slug)
          .single()
          .then(({ data: newArticle }) => {
            if (newArticle?.id) {
              supabase.functions.invoke("ingest-article-embeddings", {
                body: { article_id: newArticle.id },
              }).catch((err) => console.warn("[RAG] Embedding ingestion failed (non-blocking):", err));
            }
          });
      }

      toast({
        title: publish ? "Article Published!" : "Draft Saved",
        description: publish
          ? "Your article is now live in the guide."
          : "Your article has been saved as a draft.",
      });

      navigate("/writer/articles");
    } catch (error: unknown) {
      console.error("Error saving article:", error);
      
      // Parse Supabase error for better messaging
      let errorTitle = "Error";
      let errorMessage = "Failed to save article.";
      
      if (error && typeof error === 'object') {
        const supabaseError = error as { code?: string; message?: string; details?: string };
        
        if (supabaseError.code === "42501") {
          // RLS policy violation
          errorTitle = "Permission Denied";
          errorMessage = "You don't have permission to create articles. Please ensure you have the Writer or Admin role assigned to your account.";
        } else if (supabaseError.code === "23505") {
          // Unique constraint violation
          errorTitle = "Duplicate Article";
          errorMessage = "An article with this title or slug already exists. Please choose a different title.";
        } else if (supabaseError.code === "23503") {
          // Foreign key violation
          errorTitle = "Invalid Reference";
          errorMessage = "The selected journey or topic no longer exists. Please refresh and try again.";
        } else if (supabaseError.code === "22P02") {
          // Invalid UUID syntax
          errorTitle = "Invalid Selection";
          errorMessage = "Please ensure you have selected a valid journey and topic before publishing.";
        } else if (supabaseError.message) {
          errorMessage = supabaseError.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const cannotProceedFromStep1 = !formData.journey_id || !formData.topic_id;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden border-b border-border bg-card p-4">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Create Guide Article</h1>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)] lg:min-h-screen">
        {/* Editor Side */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 lg:max-w-2xl bg-background">
          {/* Desktop Header */}
          <div className="hidden lg:block mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Create Guide Article</h1>
            <p className="text-muted-foreground">
              One article = one question answered
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => s < step && setStep(s)}
                  disabled={s > step}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : step > s
                      ? "bg-emerald-500 text-white cursor-pointer"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                </button>
                <span
                  className={`text-xs font-bold uppercase tracking-wider hidden sm:inline ${
                    step === s ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s === 1 ? "Classification" : s === 2 ? "Content" : "Metadata"}
                </span>
                {s < 3 && <div className="w-4 lg:w-8 h-px bg-border mx-1 hidden sm:block" />}
              </div>
            ))}
          </div>

          {/* Step 1: Classification */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
              <h2 className="text-xl font-bold">1. Classification</h2>

              {journeys.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground mb-4">
                      No journeys available. An admin needs to create journeys and topics first.
                    </p>
                    {isAdmin() && (
                      <Button asChild>
                        <Link to="/admin/content-structure">Manage Content Structure</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Primary Journey *</Label>
                    <Select
                      value={formData.journey_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, journey_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Journey..." />
                      </SelectTrigger>
                      <SelectContent>
                        {journeys.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Topic Hub *</Label>
                    <Select
                      value={formData.topic_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, topic_id: value })
                      }
                      disabled={!formData.journey_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Topic..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTopics.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.journey_id && filteredTopics.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No topics in this journey yet.{" "}
                        {isAdmin() && (
                          <Link to="/admin/content-structure" className="text-primary hover:underline">
                            Add topics
                          </Link>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Article Type</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {ARTICLE_TYPES.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, article_type: type.value })
                          }
                          className={`py-3 rounded-xl border font-bold text-sm transition-all ${
                            formData.article_type === type.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Content */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
              <h2 className="text-xl font-bold">2. Core Content</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Question Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. How do I get an IRD number?"
                    className="text-lg font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="summary">Short Answer (TL;DR) *</Label>
                    <span
                      className={`text-xs font-bold ${
                        formData.summary.length > 250
                          ? "text-amber-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formData.summary.length} / 300
                    </span>
                  </div>
                  <Textarea
                    id="summary"
                    value={formData.summary}
                    onChange={(e) =>
                      setFormData({ ...formData, summary: e.target.value.slice(0, 300) })
                    }
                    placeholder="A concise answer that will appear at the top..."
                    rows={3}
                    className="italic"
                  />
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Content Blocks *</Label>
                  <ContentBlockEditor
                    blocks={formData.content_blocks}
                    onChange={(blocks) =>
                      setFormData({ ...formData, content_blocks: blocks })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Metadata */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
              <h2 className="text-xl font-bold">3. Metadata & Discovery</h2>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Visa Type</Label>
                    <Select
                      value={formData.visa_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, visa_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISA_TYPES.map((v) => (
                          <SelectItem key={v.value} value={v.value}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>User Stage</Label>
                    <Select
                      value={formData.user_stage}
                      onValueChange={(value) =>
                        setFormData({ ...formData, user_stage: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_STAGES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="article-url-slug"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-generated from title
                  </p>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Content Access</Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_premium: false })}
                      className={`flex-1 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                        !formData.is_premium
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      🆓 Free Content
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_premium: true })}
                      className={`flex-1 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                        formData.is_premium
                          ? "border-amber-500 bg-amber-500/10 text-amber-600"
                          : "border-border text-muted-foreground hover:border-amber-500/50"
                      }`}
                    >
                      👑 Premium Content
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Premium content requires a subscription or referral credits to access.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Footer */}
          <div className="sticky bottom-0 bg-background pt-6 pb-4 border-t mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/writer/articles")}
              className="text-muted-foreground w-full sm:w-auto"
            >
              Cancel
            </Button>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 sm:flex-none"
                >
                  Previous
                </Button>
              )}
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={step === 1 && cannotProceedFromStep1}
                  className="flex-1 sm:flex-none"
                >
                  Next Step
                </Button>
              ) : (
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Publish
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Side - Hidden on mobile */}
        <div className="hidden lg:flex flex-1 bg-muted/50 p-6 flex-col items-center border-l">
          <div className="flex gap-4 mb-4 bg-card p-1 rounded-lg border shadow-sm">
            <button
              onClick={() => setPreviewMode("desktop")}
              className={`p-2 rounded ${
                previewMode === "desktop"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewMode("mobile")}
              className={`p-2 rounded ${
                previewMode === "mobile"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          <ArticlePreview
            title={formData.title}
            summary={formData.summary}
            blocks={formData.content_blocks}
            articleType={formData.article_type}
            previewMode={previewMode}
          />
        </div>
      </div>
    </div>
  );
}
