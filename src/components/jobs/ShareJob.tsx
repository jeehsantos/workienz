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

// Public Workie domain — Cloudflare Worker intercepts crawlers and proxies
// to the Edge Function for OG tags, so ALL share URLs use the canonical domain.
const WORKIE_DOMAIN = import.meta.env.VITE_PUBLIC_APP_URL || "https://www.workie.co.nz";

export function ShareJob({
  jobId,
  jobTitle,
  locationSuburb,
  locationCity,
}: ShareJobProps) {
  const { toast } = useToast();

  // Single canonical URL — Cloudflare Worker handles crawler detection
  const jobUrl = `${WORKIE_DOMAIN}/jobs/${jobId}`;
  
  const shareTitle = formatJobShareTitle(jobTitle, locationSuburb, locationCity);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jobUrl);
    toast({
      title: "Link Copied!",
      description: "Job link has been copied to clipboard.",
    });
  };

  // WhatsApp share — uses canonical URL (Cloudflare Worker serves OG tags to crawlers)
  const shareOnWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareTitle}\n${jobUrl}`)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  // Facebook share — uses canonical URL (Cloudflare Worker serves OG tags to crawlers)
  const shareOnFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer");
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
