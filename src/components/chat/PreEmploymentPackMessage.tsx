import { useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Loader2 } from "lucide-react";

interface PreEmploymentPackMessageProps {
  fileUrl: string;
  fileName: string;
  isOwn: boolean;
  timestamp: string;
}

export const PreEmploymentPackMessage = memo(({ fileUrl, fileName, isOwn, timestamp }: PreEmploymentPackMessageProps) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("pre-employment-docs")
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
        <div className="flex items-center gap-2 mb-2">
          <FileText className={`w-4 h-4 flex-shrink-0 ${isOwn ? "text-primary-foreground/80" : "text-primary"}`} />
          <span className="text-sm font-medium">Pre-Employment Pack</span>
        </div>

        <div className={`rounded-lg px-3 py-2 mb-2 ${isOwn ? "bg-primary-foreground/10" : "bg-background/60"}`}>
          <p className={`text-xs truncate ${isOwn ? "text-primary-foreground/90" : "text-foreground"}`}>
            📄 {fileName}
          </p>
        </div>

        {isOwn ? (
          <p className={`text-xs ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            Document shared successfully
          </p>
        ) : (
          <Button
            size="sm"
            variant={isOwn ? "secondary" : "default"}
            onClick={handleDownload}
            disabled={downloading}
            className="h-7 text-xs w-full"
          >
            {downloading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Download className="w-3 h-3 mr-1" />
            )}
            Download Document
          </Button>
        )}

        <p className={`text-[10px] sm:text-xs mt-1.5 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
});

PreEmploymentPackMessage.displayName = "PreEmploymentPackMessage";

/**
 * Checks if a message content is a pre-employment pack message.
 * Returns parsed data or null.
 */
export function parsePreEmploymentPackMessage(content: string): { file_url: string; file_name: string } | null {
  if (!content.startsWith("[PRE_EMPLOYMENT_PACK]")) return null;
  try {
    const json = content.slice("[PRE_EMPLOYMENT_PACK]".length);
    const data = JSON.parse(json);
    if (data.file_url && data.file_name) return data;
    return null;
  } catch {
    return null;
  }
}
