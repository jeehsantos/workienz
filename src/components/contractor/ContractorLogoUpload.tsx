import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Building2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpgradeButtonVisibility } from "@/hooks/useUpgradeButtonVisibility";

interface ContractorLogoUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  companyName: string;
  onUploadComplete: (url: string) => void;
  canUpload: boolean;
  isPartner: boolean;
}

export function ContractorLogoUpload({
  userId,
  currentAvatarUrl,
  companyName,
  onUploadComplete,
  canUpload,
  isPartner,
}: ContractorLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { showUpgrade, upgradeText } = useUpgradeButtonVisibility();

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/logo-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("contractor-logos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: "Upload failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("contractor-logos")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Update contractor profile with new avatar_url
      const { error: updateError } = await supabase
        .from("contractor_profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Profile update error:", updateError);
        toast({
          title: "Update failed",
          description: "Failed to update profile. Please try again.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      setPreviewUrl(publicUrl);
      onUploadComplete(publicUrl);
      toast({
        title: "Logo uploaded",
        description: "Your company logo has been updated successfully.",
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="h-24 w-24 rounded-lg border-2 border-border">
        <AvatarImage
          src={previewUrl || undefined}
          alt={`${companyName} logo`}
          className="object-cover"
        />
        <AvatarFallback className="rounded-lg bg-muted text-lg font-semibold">
          {companyName ? getInitials(companyName) : <Building2 className="h-8 w-8" />}
        </AvatarFallback>
      </Avatar>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={!canUpload || isUploading}
      />

      {canUpload ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload Logo
            </>
          )}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="gap-2 opacity-60"
          >
            <Lock className="h-4 w-4" />
            Upload Logo
          </Button>
          <p className="text-xs text-muted-foreground text-center max-w-[200px]">
            {isPartner 
              ? "Logo upload is available for partners"
              : showUpgrade 
                ? upgradeText === "Become a Partner" 
                  ? "Contact us to become a partner and upload your logo"
                  : "Upgrade to a paid plan to upload your company logo"
                : "Logo upload is not available"}
          </p>
        </div>
      )}
    </div>
  );
}
