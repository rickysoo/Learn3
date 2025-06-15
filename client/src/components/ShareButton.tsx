import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ShareButtonProps {
  searchQuery: string;
}

export function ShareButton({ searchQuery }: ShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      // Get current page URL with search query as a parameter
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('q', searchQuery);
      const shareUrl = currentUrl.toString();

      // Try to copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Link Copied",
        description: "Share this link to let others see these video results.",
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('q', searchQuery);
      const shareUrl = currentUrl.toString();
      
      // Create a temporary textarea to copy the URL
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Link Copied",
        description: "Share this link to let others see these video results.",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="gap-2"
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}