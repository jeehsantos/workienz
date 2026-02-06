import { Button } from "@/components/ui/button";
import { Share2, MessageCircle, Facebook, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareJobProps {
  jobId: string;
  jobTitle: string;
}

// Project ID for the Edge Function URL
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "dkhcdzxelkkpxhmxazqi";

export function ShareJob({ jobId, jobTitle }: ShareJobProps) {
  const { toast } = useToast();
  
  // Use the Edge Function URL for sharing (provides OG meta tags)
  const shareUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/share-job?id=${jobId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied!",
      description: "Job link has been copied to clipboard.",
    });
  };

  const shareOnWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${jobTitle} - Check out this job on Workie! ${shareUrl}`)}`;
    window.open(whatsappUrl, "_blank", "width=550,height=420");
  };

  const shareOnFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, "_blank", "width=550,height=420");
  };

  return (
    <div className="bg-card rounded-lg border border-border/50 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Share this job</h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={shareOnWhatsApp}
          className="flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={shareOnFacebook}
          className="flex items-center gap-2"
        >
          <Facebook className="w-4 h-4" />
          Facebook
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          className="flex items-center gap-2"
        >
          <LinkIcon className="w-4 h-4" />
          Copy Link
        </Button>
      </div>
    </div>
  );
}
