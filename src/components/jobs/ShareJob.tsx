import { Button } from "@/components/ui/button";
import { Share2, MessageCircle, Facebook, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatJobShareTitle } from "@/lib/jobShare";

interface ShareJobProps {
  jobId: string;
  jobTitle: string;
  locationSuburb?: string | null;
  locationCity?: string | null;
}

// Public Workie domain used for canonical share links (user-facing)
const WORKIE_DOMAIN = import.meta.env.VITE_PUBLIC_APP_URL || "https://www.workie.co.nz";

// Supabase URL for Edge Function (social crawlers hit this for OG tags)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function ShareJob({
  jobId,
  jobTitle,
  locationSuburb,
  locationCity,
}: ShareJobProps) {
  const { toast } = useToast();

  // Canonical public URL users should see (clean, user-friendly)
  const publicJobUrl = `${WORKIE_DOMAIN}/jobs/${jobId}`;
  
  // Edge Function URL for social sharing (crawlers get pre-rendered OG tags)
  const socialShareUrl = SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/share-job?id=${jobId}`
    : publicJobUrl;
  
  const shareTitle = formatJobShareTitle(jobTitle, locationSuburb, locationCity);

  // Copy Link uses the share endpoint so previews work even without crawler proxying
  const copyToClipboard = () => {
    navigator.clipboard.writeText(socialShareUrl);
    toast({
      title: "Link Copied!",
      description: "Preview-ready job link has been copied to clipboard.",
    });
  };

  // WhatsApp uses Edge Function URL so crawlers receive correct OG tags
  const shareOnWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareTitle}\n${socialShareUrl}`)}`;
    window.open(whatsappUrl, "_blank", "width=550,height=420");
  };

  // Facebook uses Edge Function URL so crawlers receive correct OG tags
  const shareOnFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(socialShareUrl)}`;
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
