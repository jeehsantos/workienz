import { Button } from "@/components/ui/button";
import { Share2, Twitter, Linkedin, Facebook, Link as LinkIcon } from "lucide-react";
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

  const shareOnTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const shareOnLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
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
          onClick={shareOnTwitter}
          className="flex items-center gap-2"
        >
          <Twitter className="w-4 h-4" />
          Twitter
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={shareOnLinkedIn}
          className="flex items-center gap-2"
        >
          <Linkedin className="w-4 h-4" />
          LinkedIn
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
