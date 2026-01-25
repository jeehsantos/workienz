import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Eye, ImagePlus, Upload } from "lucide-react";
import { RichTextEditor } from "@/components/articles/RichTextEditor";

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string | null;
  cover_image_url: string | null;
  is_premium: boolean;
  is_published: boolean;
  author_id: string;
}

export default function EditArticle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isWriter, isLoading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [categories, setCategories] = useState<Array<{ slug: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "",
    cover_image_url: "",
    is_premium: false,
    is_published: false,
  });
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isWriter())) {
      navigate("/auth");
    }
  }, [user, authLoading, isWriter, navigate]);

  useEffect(() => {
    // Fetch active categories
    async function fetchCategories() {
      const { data, error } = await supabase
        .from("article_categories")
        .select("slug, name")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!error && data) {
        setCategories(data as Array<{ slug: string; name: string }>);
      }
    }

    fetchCategories();
  }, []);

  useEffect(() => {
    async function fetchArticle() {
      if (!id || !user) return;

      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", id)
        .eq("author_id", user.id)
        .single();

      if (error || !data) {
        toast({
          title: "Article not found",
          description: "You don't have access to edit this article.",
          variant: "destructive",
        });
        navigate("/writer/articles");
        return;
      }

      setArticle(data);
      setFormData({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || "",
        content: data.content,
        category: data.category || "",
        cover_image_url: data.cover_image_url || "",
        is_premium: data.is_premium,
        is_published: data.is_published,
      });
      setIsLoading(false);
    }

    if (user && id) {
      fetchArticle();
    }
  }, [id, user, navigate, toast]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title: newTitle,
      slug: generateSlug(newTitle),
    }));
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingCover(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("article-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("article-images")
        .getPublicUrl(fileName);

      setFormData((prev) => ({
        ...prev,
        cover_image_url: publicUrlData.publicUrl,
      }));

      toast({
        title: "Image uploaded",
        description: "Cover image has been updated.",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (publish?: boolean) => {
    if (!article || !user) return;

    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in the title and content.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const updateData = {
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt || null,
        content: formData.content,
        category: formData.category || null,
        cover_image_url: formData.cover_image_url || null,
        is_premium: formData.is_premium,
        is_published: publish !== undefined ? publish : formData.is_published,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("articles")
        .update(updateData)
        .eq("id", article.id)
        .eq("author_id", user.id);

      if (error) throw error;

      toast({
        title: publish ? "Article published" : "Changes saved",
        description: publish
          ? "Your article is now live."
          : "Your changes have been saved.",
      });

      if (publish !== undefined) {
        setFormData((prev) => ({ ...prev, is_published: publish }));
      }
    } catch (error) {
      console.error("Error saving article:", error);
      toast({
        title: "Save failed",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!article) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/writer/articles">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold font-display">Edit Article</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {formData.is_published && (
              <Button variant="outline" asChild>
                <Link to={`/articles/${formData.slug}`} target="_blank">
                  <Eye className="w-4 h-4 mr-2" />
                  View Live
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleSave()}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(!formData.is_published)}
              disabled={isSaving}
            >
              {formData.is_published ? "Unpublish" : "Publish"}
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Article title..."
                className="text-lg"
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="article-url-slug"
              />
              <p className="text-xs text-muted-foreground">
                /articles/{formData.slug || "your-slug"}
              </p>
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt (optional)</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, excerpt: e.target.value }))
                }
                placeholder="A brief summary of your article..."
                rows={3}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
                placeholder="Write your article content here... Use the formatting toolbar for rich text."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cover Image */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <Label>Cover Image</Label>
              {formData.cover_image_url ? (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={formData.cover_image_url}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverImageUpload}
                        className="hidden"
                        disabled={uploadingCover}
                      />
                      <Button variant="secondary" size="sm" asChild>
                        <span>
                          {uploadingCover ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Replace
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageUpload}
                    className="hidden"
                    disabled={uploadingCover}
                  />
                  <div className="aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                    {uploadingCover ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8" />
                        <span className="text-sm">Upload cover image</span>
                      </>
                    )}
                  </div>
                </label>
              )}
            </div>

            {/* Settings */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <Label>Settings</Label>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Premium Content</p>
                  <p className="text-xs text-muted-foreground">
                    Only for subscribers
                  </p>
                </div>
                <Switch
                  checked={formData.is_premium}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_premium: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Published</p>
                  <p className="text-xs text-muted-foreground">
                    Visible to readers
                  </p>
                </div>
                <Switch
                  checked={formData.is_published}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_published: checked }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
