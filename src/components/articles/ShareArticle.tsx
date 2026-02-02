import { Button } from "@/components/ui/button";
import { Share2, MessageCircle, Instagram, Facebook, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareArticleProps {
  title: string;
  url: string;
}

export function ShareArticle({ title, url }: ShareArticleProps) {
  const { toast } = useToast();
  const fullUrl = `${window.location.origin}${url}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: "Link Copied!",
      description: "Article link has been copied to clipboard.",
    });
  };

  const shareOnWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${fullUrl}`)}`;
    window.open(whatsappUrl, "_blank", "width=550,height=420");
  };

  const shareOnInstagram = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({
        title: "Link Copied!",
        description: "Paste the link into your Instagram post or story.",
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the link manually and paste it into Instagram.",
        variant: "destructive",
      });
    }

    window.open("https://www.instagram.com/", "_blank", "width=550,height=420");
  };

  const shareOnFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
  };

  return (
    <div className="bg-card rounded-lg border border-border/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Share this article</h3>
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
          onClick={shareOnInstagram}
          className="flex items-center gap-2"
        >
          <Instagram className="w-4 h-4" />
          Instagram
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
