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

// Public Workie domain used for canonical share links
const WORKIE_DOMAIN = import.meta.env.VITE_PUBLIC_APP_URL || "https://www.workie.co.nz";

export function ShareJob({
  jobId,
  jobTitle,
  locationSuburb,
  locationCity,
}: ShareJobProps) {
  const { toast } = useToast();

  // Canonical public URL users should see and share
  const publicJobUrl = `${WORKIE_DOMAIN}/s/jobs/${jobId}`;
  const shareTitle = formatJobShareTitle(jobTitle, locationSuburb, locationCity);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicJobUrl);
    toast({
      title: "Link Copied!",
      description: "Job link has been copied to clipboard.",
    });
  };

  const shareOnWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareTitle}
${publicJobUrl}`)}`;
    window.open(whatsappUrl, "_blank", "width=550,height=420");
  };

  const shareOnFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicJobUrl)}`;
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
