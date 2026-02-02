import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Map,
  FolderTree,
  Plane,
  MapPin,
  Home,
  Briefcase,
  Wallet,
  Users,
  Settings,
  FileText,
  ExternalLink,
  Crown,
} from "lucide-react";

type Journey = {
  id: string;
  title: string;
  description: string | null;
  icon_name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  topic_count?: number;
};

type TopicHub = {
  id: string;
  journey_id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  journey_title?: string;
  article_count?: number;
};

type GuideArticle = {
  id: string;
  title: string;
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

const ICON_OPTIONS = [
  { value: "Plane", label: "Plane", icon: Plane },
  { value: "MapPin", label: "Location", icon: MapPin },
  { value: "Home", label: "Home", icon: Home },
  { value: "Briefcase", label: "Work", icon: Briefcase },
  { value: "Wallet", label: "Money", icon: Wallet },
  { value: "Users", label: "People", icon: Users },
  { value: "Settings", label: "Settings", icon: Settings },
  { value: "FileText", label: "Document", icon: FileText },
];

export default function AdminContentStructure() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("journeys");
  const [isLoading, setIsLoading] = useState(true);

  // Journeys state
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isJourneyDialogOpen, setIsJourneyDialogOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [journeyForm, setJourneyForm] = useState({
    title: "",
    description: "",
    icon_name: "FileText",
    display_order: 0,
    is_active: true,
  });

  // Topics state
  const [topics, setTopics] = useState<TopicHub[]>([]);
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicHub | null>(null);
  const [topicForm, setTopicForm] = useState({
    journey_id: "",
    title: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [guideArticles, setGuideArticles] = useState<GuideArticle[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin())) {
      navigate("/");
    }
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin()) {
      fetchData();
    }
  }, [user, isAdmin, activeTab]);

  const fetchData = async () => {
    setIsLoading(true);

    if (activeTab === "journeys") {
      await fetchJourneys();
    } else if (activeTab === "topics") {
      await fetchTopics();
    } else if (activeTab === "guide-topics") {
      await fetchGuideArticles();
    }

    setIsLoading(false);
  };

  const fetchJourneys = async () => {
    const { data, error } = await supabase.from("journeys").select("*").order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching journeys:", error);
      toast({ title: "Error", description: "Failed to load journeys.", variant: "destructive" });
      return;
    }

    // Get topic counts
    const journeysWithCounts = await Promise.all(
      (data || []).map(async (journey) => {
        const { count } = await supabase
          .from("topic_hubs")
          .select("*", { count: "exact", head: true })
          .eq("journey_id", journey.id);

        return { ...journey, topic_count: count || 0 };
      }),
    );

    setJourneys(journeysWithCounts);
  };

  const fetchTopics = async () => {
    // First fetch journeys for the dropdown
    const { data: journeyData } = await supabase
      .from("journeys")
      .select("id, title")
      .order("display_order", { ascending: true });

    if (journeyData && journeys.length === 0) {
      setJourneys(journeyData as Journey[]);
    }

    const { data, error } = await supabase.from("topic_hubs").select("*").order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching topics:", error);
      toast({ title: "Error", description: "Failed to load topics.", variant: "destructive" });
      return;
    }

    // Enrich with journey titles and article counts
    const topicsWithData = await Promise.all(
      (data || []).map(async (topic) => {
        const journey = journeyData?.find((j) => j.id === topic.journey_id);

        const { count } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true })
          .eq("topic_id", topic.id);

        return {
          ...topic,
          journey_title: journey?.title || "Unknown",
          article_count: count || 0,
        };
      }),
    );

    setTopics(topicsWithData);
  };

  const fetchGuideArticles = async () => {
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id, title, summary, is_published, is_premium, created_at, updated_at, journey_id, topic_id, journeys(title), topic_hubs(title)"
      )
      .eq("article_type", "guide")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching guide articles:", error);
      toast({ title: "Error", description: "Failed to load guide topics.", variant: "destructive" });
      return;
    }

    setGuideArticles(data || []);
  };

  // Journey CRUD
  const openJourneyDialog = (journey?: Journey) => {
    if (journey) {
      setEditingJourney(journey);
      setJourneyForm({
        title: journey.title,
        description: journey.description || "",
        icon_name: journey.icon_name,
        display_order: journey.display_order,
        is_active: journey.is_active,
      });
    } else {
      setEditingJourney(null);
      setJourneyForm({
        title: "",
        description: "",
        icon_name: "FileText",
        display_order: journeys.length,
        is_active: true,
      });
    }
    setIsJourneyDialogOpen(true);
  };

  const handleSaveJourney = async () => {
    if (!journeyForm.title.trim()) {
      toast({ title: "Error", description: "Journey title is required.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      if (editingJourney) {
        const { error } = await supabase
          .from("journeys")
          .update({
            title: journeyForm.title,
            description: journeyForm.description || null,
            icon_name: journeyForm.icon_name,
            display_order: journeyForm.display_order,
            is_active: journeyForm.is_active,
          })
          .eq("id", editingJourney.id);

        if (error) throw error;
        toast({ title: "Success", description: "Journey updated successfully." });
      } else {
        const { error } = await supabase.from("journeys").insert({
          title: journeyForm.title,
          description: journeyForm.description || null,
          icon_name: journeyForm.icon_name,
          display_order: journeyForm.display_order,
          is_active: journeyForm.is_active,
          created_by: user?.id,
        });

        if (error) throw error;
        toast({ title: "Success", description: "Journey created successfully." });
      }

      setIsJourneyDialogOpen(false);
      fetchJourneys();
    } catch (error: unknown) {
      console.error("Error saving journey:", error);
      const message = error instanceof Error ? error.message : "Failed to save journey.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJourney = async (id: string) => {
    if (!confirm("Are you sure? This will also delete all associated topics.")) return;

    try {
      const { error } = await supabase.from("journeys").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Journey deleted successfully." });
      fetchJourneys();
    } catch (error: unknown) {
      console.error("Error deleting journey:", error);
      const message = error instanceof Error ? error.message : "Failed to delete journey.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Topic CRUD
  const openTopicDialog = (topic?: TopicHub) => {
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({
        journey_id: topic.journey_id,
        title: topic.title,
        description: topic.description || "",
        display_order: topic.display_order,
        is_active: topic.is_active,
      });
    } else {
      setEditingTopic(null);
      setTopicForm({
        journey_id: journeys[0]?.id || "",
        title: "",
        description: "",
        display_order: topics.length,
        is_active: true,
      });
    }
    setIsTopicDialogOpen(true);
  };

  const handleSaveTopic = async () => {
    if (!topicForm.title.trim() || !topicForm.journey_id) {
      toast({ title: "Error", description: "Topic title and journey are required.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      if (editingTopic) {
        const { error } = await supabase
          .from("topic_hubs")
          .update({
            journey_id: topicForm.journey_id,
            title: topicForm.title,
            description: topicForm.description || null,
            display_order: topicForm.display_order,
            is_active: topicForm.is_active,
          })
          .eq("id", editingTopic.id);

        if (error) throw error;
        toast({ title: "Success", description: "Topic updated successfully." });
      } else {
        const { error } = await supabase.from("topic_hubs").insert({
          journey_id: topicForm.journey_id,
          title: topicForm.title,
          description: topicForm.description || null,
          display_order: topicForm.display_order,
          is_active: topicForm.is_active,
          created_by: user?.id,
        });

        if (error) throw error;
        toast({ title: "Success", description: "Topic created successfully." });
      }

      setIsTopicDialogOpen(false);
      fetchTopics();
    } catch (error: unknown) {
      console.error("Error saving topic:", error);
      const message = error instanceof Error ? error.message : "Failed to save topic.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm("Are you sure you want to delete this topic?")) return;

    try {
      const { error } = await supabase.from("topic_hubs").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Topic deleted successfully." });
      fetchTopics();
    } catch (error: unknown) {
      console.error("Error deleting topic:", error);
      const message = error instanceof Error ? error.message : "Failed to delete topic.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconOption = ICON_OPTIONS.find((opt) => opt.value === iconName);
    if (iconOption) {
      const IconComp = iconOption.icon;
      return <IconComp className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedGuideArticles = guideArticles.reduce(
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
    {} as Record<string, Record<string, GuideArticle[]>>
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display">Content Structure</h1>
          <p className="text-muted-foreground">Manage Journeys and Topic Hubs for organizing articles</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="journeys" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              Journeys
            </TabsTrigger>
            <TabsTrigger value="topics" className="flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              Topic Hubs
            </TabsTrigger>
            <TabsTrigger value="guide-topics" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Guide Topics
            </TabsTrigger>
          </TabsList>

          {/* Journeys Tab */}
          <TabsContent value="journeys" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Journeys are the main stages of a user's NZ experience</p>
              <Button onClick={() => openJourneyDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Journey
              </Button>
            </div>

            {journeys.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Map className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Journeys Yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create your first journey to start organizing content.
                  </p>
                  <Button onClick={() => openJourneyDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Journey
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {journeys.map((journey) => (
                  <Card key={journey.id} className={!journey.is_active ? "opacity-60" : ""}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          {getIconComponent(journey.icon_name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{journey.title}</h3>
                            {!journey.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {journey.description || "No description"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {journey.topic_count} topic{journey.topic_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openJourneyDialog(journey)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteJourney(journey.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Topics Tab */}
          <TabsContent value="topics" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Topic Hubs group articles within a journey</p>
              <Button onClick={() => openTopicDialog()} disabled={journeys.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                Add Topic
              </Button>
            </div>

            {journeys.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Map className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Create Journeys First</h3>
                  <p className="text-muted-foreground text-sm">
                    You need to create at least one journey before adding topics.
                  </p>
                </CardContent>
              </Card>
            ) : topics.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderTree className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Topics Yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create topic hubs to organize articles within journeys.
                  </p>
                  <Button onClick={() => openTopicDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Topic
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {topics.map((topic) => (
                  <Card key={topic.id} className={!topic.is_active ? "opacity-60" : ""}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <FolderTree className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{topic.title}</h3>
                            {!topic.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{topic.journey_title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {topic.article_count} article{topic.article_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openTopicDialog(topic)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTopic(topic.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Guide Topics Tab */}
          <TabsContent value="guide-topics" className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">Published Guide Topics</h2>
                <p className="text-sm text-muted-foreground">
                  All published guide articles across writers, grouped for quick management.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/writer/new-guide">New Guide Topic</Link>
                </Button>
                <Button asChild>
                  <Link to="/writer/articles">Open Guide Topics Manager</Link>
                </Button>
              </div>
            </div>

            {guideArticles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Published Guide Topics</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Published guide articles will appear here for easy review.
                  </p>
                  <Button asChild>
                    <Link to="/writer/new-guide">Create First Topic</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedGuideArticles).map(([journeyTitle, topicGroups]) => (
                  <Card key={journeyTitle} className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Map className="w-4 h-4" />
                        <span>Journey</span>
                      </div>
                      <CardTitle className="text-lg">{journeyTitle}</CardTitle>
                      <CardDescription>
                        {Object.values(topicGroups).reduce((count, items) => count + items.length, 0)} published
                        topic{Object.values(topicGroups).reduce((count, items) => count + items.length, 0) !== 1 ? "s" : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {Object.entries(topicGroups).map(([topicTitle, topicArticles]) => (
                        <div key={`${journeyTitle}-${topicTitle}`} className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <FolderTree className="w-4 h-4" />
                            <span>{topicTitle}</span>
                            <Badge variant="secondary">
                              {topicArticles.length} topic{topicArticles.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>

                          <div className="grid gap-4">
                            {topicArticles.map((article) => (
                              <Card key={article.id} className="border-border/60">
                                <CardContent className="py-4">
                                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-semibold">{article.title}</h3>
                                        {article.is_premium && (
                                          <Badge variant="secondary" className="flex items-center gap-1">
                                            <Crown className="w-3 h-3" />
                                            Premium
                                          </Badge>
                                        )}
                                        <Badge>Published</Badge>
                                      </div>
                                      {article.summary && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        Updated {new Date(article.updated_at).toLocaleDateString()} • Created{" "}
                                        {new Date(article.created_at).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button variant="ghost" size="sm" asChild>
                                        <Link to={`/guide?article=${article.id}`}>
                                          <ExternalLink className="w-4 h-4 mr-1" />
                                          View
                                        </Link>
                                      </Button>
                                      <Button variant="outline" size="sm" asChild>
                                        <Link to={`/writer/articles/${article.id}/edit`}>
                                          <Pencil className="w-4 h-4 mr-1" />
                                          Edit
                                        </Link>
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Journey Dialog */}
        <Dialog open={isJourneyDialogOpen} onOpenChange={setIsJourneyDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingJourney ? "Edit Journey" : "Create Journey"}</DialogTitle>
              <DialogDescription>
                {editingJourney ? "Update the journey details." : "Add a new journey stage."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="journey-title">Title *</Label>
                <Input
                  id="journey-title"
                  value={journeyForm.title}
                  onChange={(e) => setJourneyForm({ ...journeyForm, title: e.target.value })}
                  placeholder="e.g., Before coming to NZ"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="journey-description">Description</Label>
                <Textarea
                  id="journey-description"
                  value={journeyForm.description}
                  onChange={(e) => setJourneyForm({ ...journeyForm, description: e.target.value })}
                  placeholder="Brief description of this journey stage"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="journey-icon">Icon</Label>
                <Select
                  value={journeyForm.icon_name}
                  onValueChange={(value) => setJourneyForm({ ...journeyForm, icon_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => {
                      const IconComp = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <IconComp className="w-4 h-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="journey-order">Display Order</Label>
                <Input
                  id="journey-order"
                  type="number"
                  min="0"
                  value={journeyForm.display_order}
                  onChange={(e) => setJourneyForm({ ...journeyForm, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="journey-active">Active</Label>
                <Switch
                  id="journey-active"
                  checked={journeyForm.is_active}
                  onCheckedChange={(checked) => setJourneyForm({ ...journeyForm, is_active: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsJourneyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveJourney} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingJourney ? "Save Changes" : "Create Journey"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Topic Dialog */}
        <Dialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTopic ? "Edit Topic" : "Create Topic"}</DialogTitle>
              <DialogDescription>
                {editingTopic ? "Update the topic details." : "Add a new topic hub."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="topic-journey">Journey *</Label>
                <Select
                  value={topicForm.journey_id}
                  onValueChange={(value) => setTopicForm({ ...topicForm, journey_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a journey" />
                  </SelectTrigger>
                  <SelectContent>
                    {journeys.map((journey) => (
                      <SelectItem key={journey.id} value={journey.id}>
                        {journey.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic-title">Title *</Label>
                <Input
                  id="topic-title"
                  value={topicForm.title}
                  onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                  placeholder="e.g., Most Working Holiday Visas allow you to study for up to 6 months."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic-description">Description</Label>
                <Textarea
                  id="topic-description"
                  value={topicForm.description}
                  onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                  placeholder="Brief description of this topic"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic-order">Display Order</Label>
                <Input
                  id="topic-order"
                  type="number"
                  min="0"
                  value={topicForm.display_order}
                  onChange={(e) => setTopicForm({ ...topicForm, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="topic-active">Active</Label>
                <Switch
                  id="topic-active"
                  checked={topicForm.is_active}
                  onCheckedChange={(checked) => setTopicForm({ ...topicForm, is_active: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTopicDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTopic} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingTopic ? "Save Changes" : "Create Topic"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
