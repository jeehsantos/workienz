import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, Image as ImageIcon, X } from "lucide-react";

export default function NewArticle() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isWriter } = useAuthContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    is_premium: true,
    is_published: false,
    cover_image_url: "",
  });

  const [contentImages, setContentImages] = useState<string[]>([]);

  if (!authLoading && (!user || !isWriter())) {
    navigate("/auth");
    return null;
  }

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

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-cover.${fileExt}`;
    const filePath = `covers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("article-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Error uploading cover image:", uploadError);
      toast({
        title: "Upload Failed",
        description: "Failed to upload cover image. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("article-images")
      .getPublicUrl(filePath);

    setFormData({ ...formData, cover_image_url: urlData.publicUrl });
    setIsUploading(false);
  };

  const handleContentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-content.${fileExt}`;
    const filePath = `content/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("article-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Error uploading content image:", uploadError);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("article-images")
      .getPublicUrl(filePath);

    // Add markdown image syntax to content
    const imageMarkdown = `\n![Image](${urlData.publicUrl})\n`;
    setFormData({ ...formData, content: formData.content + imageMarkdown });
    setContentImages([...contentImages, urlData.publicUrl]);
    setIsUploading(false);
    
    toast({
      title: "Image Added",
      description: "Image has been added to your article content.",
    });
  };

  const handleSubmit = async (e: React.FormEvent, publish: boolean) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in the title and content.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("articles").insert({
      author_id: user.id,
      title: formData.title,
      slug: formData.slug || generateSlug(formData.title),
      excerpt: formData.excerpt || null,
      content: formData.content,
      cover_image_url: formData.cover_image_url || null,
      is_premium: formData.is_premium,
      is_published: publish,
    });

    setIsSubmitting(false);

    if (error) {
      console.error("Error creating article:", error);
      toast({
        title: "Error",
        description: "Failed to create article. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: publish ? "Article Published!" : "Draft Saved",
      description: publish
        ? "Your article is now live."
        : "Your article has been saved as a draft.",
    });

    navigate("/writer/articles");
  };

  if (authLoading) {
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

        <h1 className="text-3xl font-bold mb-2 font-display">Write New Article</h1>
        <p className="text-muted-foreground mb-8">
          Create educational content for job seekers.
        </p>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6 max-w-3xl">
          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image</Label>
            {formData.cover_image_url ? (
              <div className="relative">
                <img
                  src={formData.cover_image_url}
                  alt="Cover"
                  className="w-full h-48 object-cover rounded-lg border border-border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setFormData({ ...formData, cover_image_url: "" })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload cover image
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverImageUpload}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter article title..."
              required
            />
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
              Auto-generated from title. You can customize it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              placeholder="Brief summary of the article..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content *</Label>
              <label className="flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
                <ImageIcon className="w-4 h-4" />
                <span>Add Image</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleContentImageUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Write your article content here... You can use markdown formatting."
              rows={15}
              required
            />
            <p className="text-xs text-muted-foreground">
              Supports markdown formatting. Use the "Add Image" button to insert images.
            </p>
          </div>

          {/* Content Images Preview */}
          {contentImages.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Images</Label>
              <div className="flex flex-wrap gap-2">
                {contentImages.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Content ${idx + 1}`}
                    className="w-20 h-20 object-cover rounded border border-border"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border/50">
            <div>
              <Label htmlFor="is_premium">Premium Content</Label>
              <p className="text-sm text-muted-foreground">
                Require subscription to access full article
              </p>
            </div>
            <Switch
              id="is_premium"
              checked={formData.is_premium}
              onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              variant="outline"
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Publish Article
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
