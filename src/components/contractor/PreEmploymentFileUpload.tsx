import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, Trash2, Download } from "lucide-react";

interface PreEmploymentFileUploadProps {
  userId: string;
  currentFileUrl: string | null;
  currentFileName: string | null;
  onUploadComplete: (url: string, name: string) => void;
  onRemove: () => void;
}

export function PreEmploymentFileUpload({
  userId,
  currentFileUrl,
  currentFileName,
  onUploadComplete,
  onRemove,
}: PreEmploymentFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or Word document (.pdf, .doc, .docx).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/pre-employment-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("pre-employment-docs")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
        return;
      }

      // Generate a signed URL (private bucket)
      const { data: signedData } = await supabase.storage
        .from("pre-employment-docs")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      const url = signedData?.signedUrl || fileName;

      // Save file path (not signed URL) so we can generate new signed URLs later
      onUploadComplete(fileName, file.name);
      toast({ title: "File uploaded", description: `${file.name} uploaded successfully.` });
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!currentFileUrl) return;
    setIsRemoving(true);
    try {
      await supabase.storage.from("pre-employment-docs").remove([currentFileUrl]);
      onRemove();
      toast({ title: "File removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove file.", variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {currentFileName && currentFileUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <FileText className="w-8 h-8 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{currentFileName}</p>
            <p className="text-xs text-muted-foreground">
              This file will be shared with candidates after hiring.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isRemoving}
              className="text-destructive hover:text-destructive"
            >
              {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium">
              {isUploading ? "Uploading..." : "Upload Pre-Employment Pack"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF or Word document • Max 10MB
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
