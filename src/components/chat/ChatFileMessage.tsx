import { useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Loader2 } from "lucide-react";

interface ChatFileMessageProps {
  fileUrl: string;
  fileName: string;
  isOwn: boolean;
  timestamp: string;
  bucket?: string;
}

/**
 * Renders a file attachment message in the chat.
 * Used for both pre-employment packs and user-uploaded files.
 */
export const ChatFileMessage = memo(({ fileUrl, fileName, isOwn, timestamp, bucket = "pre-employment-docs" }: ChatFileMessageProps) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const extension = fileName.split(".").pop()?.toUpperCase() || "FILE";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileUrl, 60 * 5);

      if (error || !data?.signedUrl) {
        toast({ title: "Error", description: "Failed to generate download link.", variant: "destructive" });
        return;
      }

      window.open(data.signedUrl, "_blank");
    } catch {
      toast({ title: "Error", description: "Download failed.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-3 sm:px-4 sm:py-3 ${
          isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
        }`}
      >
        <div
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:opacity-90 transition-opacity ${
            isOwn ? "bg-primary-foreground/10" : "bg-background/60"
          }`}
          onClick={handleDownload}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isOwn ? "bg-primary-foreground/20" : "bg-primary/10"
          }`}>
            <FileText className={`w-4 h-4 ${isOwn ? "text-primary-foreground" : "text-primary"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${isOwn ? "text-primary-foreground" : "text-foreground"}`}>
              {fileName}
            </p>
            <p className={`text-[10px] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
              {extension} document
            </p>
          </div>
          {downloading ? (
            <Loader2 className={`w-4 h-4 animate-spin flex-shrink-0 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
          ) : (
            <Download className={`w-4 h-4 flex-shrink-0 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
          )}
        </div>

        <p className={`text-[10px] sm:text-xs mt-1.5 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
});

ChatFileMessage.displayName = "ChatFileMessage";

/** Message content prefix for file attachments uploaded by users */
export const CHAT_FILE_PREFIX = "[CHAT_FILE]";

/** Message content prefix for pre-employment packs shared by contractors */
export const PRE_EMPLOYMENT_PACK_PREFIX = "[PRE_EMPLOYMENT_PACK]";

export interface ChatFileData {
  file_url: string;
  file_name: string;
  bucket?: string;
}

/**
 * Parse a message to check if it's a file attachment.
 * Returns parsed file data or null.
 */
export function parseChatFileMessage(content: string): ChatFileData | null {
  if (content.startsWith(CHAT_FILE_PREFIX)) {
    try {
      const json = content.slice(CHAT_FILE_PREFIX.length);
      const data = JSON.parse(json);
      if (data.file_url && data.file_name) return data;
    } catch { /* invalid json */ }
    return null;
  }
  if (content.startsWith(PRE_EMPLOYMENT_PACK_PREFIX)) {
    try {
      const json = content.slice(PRE_EMPLOYMENT_PACK_PREFIX.length);
      const data = JSON.parse(json);
      if (data.file_url && data.file_name) return { ...data, bucket: "pre-employment-docs" };
    } catch { /* invalid json */ }
    return null;
  }
  return null;
}
