import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { signInWithGoogle } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { Video, Bookmark as BookmarkType } from "@shared/schema";

interface BookmarkButtonProps {
  searchQuery: string;
  videos: Video[];
}

export function BookmarkButton({ searchQuery, videos }: BookmarkButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Check if search is already bookmarked
  const { data: bookmarks } = useQuery({
    queryKey: [`/api/bookmarks/${user?.uid}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  // Check if current search is bookmarked
  const existingBookmark = Array.isArray(bookmarks) ? bookmarks.find((b: BookmarkType) => 
    b.searchQuery.toLowerCase() === searchQuery.toLowerCase()
  ) : null;

  const createBookmarkMutation = useMutation({
    mutationFn: async (bookmarkData: any) => {
      const response = await apiRequest('POST', '/api/bookmarks', bookmarkData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookmarks/${user?.uid}`] });
      setIsBookmarked(true);
      toast({
        title: "Videos Saved",
        description: "You can find these videos in your saved searches.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bookmark Failed",
        description: error.message || "Could not bookmark this search.",
        variant: "destructive",
      });
    },
  });

  const handleBookmark = async () => {
    if (!user) {
      // Prompt user to sign in
      toast({
        title: "Sign In Required",
        description: "Sign in with Google to save your video searches.",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => signInWithGoogle()}
          >
            Sign In
          </Button>
        ),
      });
      return;
    }

    if (existingBookmark) {
      toast({
        title: "Already Bookmarked",
        description: "This search is already in your bookmarks.",
      });
      return;
    }

    if (videos.length === 0) {
      toast({
        title: "No Videos to Bookmark",
        description: "Search for videos first, then bookmark your results.",
        variant: "destructive",
      });
      return;
    }

    const bookmarkData = {
      userId: user.uid,
      userEmail: user.email!,
      userName: user.displayName || undefined,
      searchQuery,
      videoIds: videos.map(v => v.youtubeId),
    };

    createBookmarkMutation.mutate(bookmarkData);
  };

  const isAlreadyBookmarked = !!existingBookmark || isBookmarked;

  return (
    <Button
      variant={isAlreadyBookmarked ? "default" : "outline"}
      size="sm"
      onClick={handleBookmark}
      disabled={createBookmarkMutation.isPending}
      className="gap-2"
    >
      {isAlreadyBookmarked ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
{isAlreadyBookmarked ? "Saved" : "Save Videos"}
    </Button>
  );
}