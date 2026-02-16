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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  FolderEdit,
  FileText,
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

type Article = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  is_published: boolean;
  is_premium: boolean;
  created_at: string;
  author_email: string;
};

type ArticleReport = {
  id: string;
  article_id: string;
  article_title: string;
  reporter_email: string;
  report_type: string;
  description: string;
  status: string;
  created_at: string;
};

export default function AdminArticleManagement() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("categories");
  const [isLoading, setIsLoading] = useState(true);
  
  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    is_active: true,
    display_order: 0,
  });

  // Articles state
  const [articles, setArticles] = useState<Article[]>([]);
  
  // Reports state
  const [reports, setReports] = useState<ArticleReport[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    
    if (activeTab === "categories") {
      await fetchCategories();
    } else if (activeTab === "articles") {
      await fetchArticles();
    } else if (activeTab === "reports") {
      await fetchReports();
    }
    
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("article_categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories.",
        variant: "destructive",
      });
    } else {
      setCategories((data as Category[]) || []);
    }
  };

  const fetchArticles = async () => {
    const { data: articleData, error } = await supabase
      .from("articles")
      .select("id, title, slug, category, is_published, is_premium, created_at, author_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching articles:", error);
      toast({
        title: "Error",
        description: "Failed to load articles.",
        variant: "destructive",
      });
      return;
    }

    // Enrich with author email
    const enriched = await Promise.all(
      (articleData || []).map(async (article) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", article.author_id)
          .maybeSingle();

        return {
          ...article,
          author_email: profile?.email || "Unknown",
        };
      })
    );

    setArticles(enriched);
  };

  const fetchReports = async () => {
    const { data: reportData } = await supabase
      .from("article_reports")
      .select("id, article_id, report_type, description, status, created_at, reporter_user_id")
      .order("created_at", { ascending: false });

    if (!reportData) {
      setReports([]);
      return;
    }

    const enriched = await Promise.all(
      reportData.map(async (report) => {
        const { data: article } = await supabase
          .from("articles")
          .select("title")
          .eq("id", report.article_id)
          .maybeSingle();

        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", report.reporter_user_id)
          .maybeSingle();

        return {
          ...report,
          article_title: article?.title || "Unknown Article",
          reporter_email: profile?.email || "Unknown",
        };
      })
    );

    setReports(enriched);
  };

  // Category CRUD functions
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    });
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      is_active: true,
      display_order: categories.length,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      is_active: category.is_active,
      display_order: category.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("article_categories")
          .update({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            is_active: formData.is_active,
            display_order: formData.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCategory.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Category updated successfully.",
        });
      } else {
        const { error } = await supabase.from("article_categories").insert({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          is_active: formData.is_active,
          display_order: formData.display_order,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Category created successfully.",
        });
      }

      setIsDialogOpen(false);
      fetchCategories();
    } catch (error: unknown) {
      console.error("Error saving category:", error);
      const message = error instanceof Error ? error.message : "Failed to save category.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const { error } = await supabase
        .from("article_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category deleted successfully.",
      });

      fetchCategories();
    } catch (error: unknown) {
      console.error("Error deleting category:", error);
      const message = error instanceof Error ? error.message : "Failed to delete category.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Article functions
  const toggleArticlePublish = async (articleId: string, currentStatus: boolean) => {
    setUpdatingId(articleId);

    const { error } = await supabase
      .from("articles")
      .update({ is_published: !currentStatus })
      .eq("id", articleId);

    if (error) {
      toast({ title: "Error", description: "Failed to update article status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Article ${!currentStatus ? "published" : "unpublished"}` });
      setArticles(articles.map(a => a.id === articleId ? { ...a, is_published: !currentStatus } : a));

      // Fire-and-forget: trigger embedding ingestion when publishing
      if (!currentStatus) {
        supabase.functions.invoke("ingest-article-embeddings", {
          body: { article_id: articleId },
        }).catch((err) => console.warn("[RAG] Embedding ingestion failed (non-blocking):", err));
      }
    }

    setUpdatingId(null);
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article? This action cannot be undone.")) return;

    try {
      const { error } = await supabase.from("articles").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Success", description: "Article deleted successfully." });
      setArticles(articles.filter(a => a.id !== id));
    } catch (error: unknown) {
      console.error("Error deleting article:", error);
      const message = error instanceof Error ? error.message : "Failed to delete article.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Report functions
  const updateReportStatus = async (reportId: string, newStatus: string) => {
    setUpdatingId(reportId);

    const { error } = await supabase
      .from("article_reports")
      .update({ status: newStatus })
      .eq("id", reportId);

    if (error) {
      toast({ title: "Error", description: "Failed to update report status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Report status updated" });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
    }

    setUpdatingId(null);
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display">Article Management</h1>
          <p className="text-muted-foreground">
            Manage categories, articles, and reported content
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderEdit className="w-4 h-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="articles" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Reports
              {reports.filter(r => r.status === "pending").length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {reports.filter(r => r.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? "Edit Category" : "Create New Category"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCategory
                        ? "Update the category details below."
                        : "Add a new category for organizing articles."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g., Career Advice"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug *</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="e.g., career-advice"
                      />
                      <p className="text-xs text-muted-foreground">
                        Auto-generated from name. Used in URLs.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of this category..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="display_order">Display Order</Label>
                      <Input
                        id="display_order"
                        type="number"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                        }
                        placeholder="0"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <Label htmlFor="is_active">Active</Label>
                        <p className="text-sm text-muted-foreground">
                          Only active categories are visible to writers
                        </p>
                      </div>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_active: checked })
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveCategory} disabled={isSaving}>
                      {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {editingCategory ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="bg-card rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No categories found. Create your first category to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                        <TableCell>
                          <Badge variant={category.is_active ? "default" : "secondary"}>
                            {category.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{category.display_order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(category)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCategory(category.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Articles Tab */}
          <TabsContent value="articles" className="space-y-4">
            <div className="bg-card rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No articles found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    articles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium truncate">{article.title}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {article.category?.replace(/_/g, " ") || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {article.author_email}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={article.is_published ? "default" : "secondary"}>
                              {article.is_published ? "Published" : "Draft"}
                            </Badge>
                            {article.is_premium && (
                              <Badge variant="outline">Premium</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(article.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <Link to={`/articles/${article.slug}`} target="_blank">
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleArticlePublish(article.id, article.is_published)}
                              disabled={updatingId === article.id}
                            >
                              {article.is_published ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteArticle(article.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No reports submitted yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{report.article_title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {report.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {report.reporter_email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {report.report_type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={report.status}
                            onValueChange={(value) => updateReportStatus(report.id, value)}
                            disabled={updatingId === report.id}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="reviewed">Reviewed</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="dismissed">Dismissed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}