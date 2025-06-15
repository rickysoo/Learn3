import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookmarkX, Calendar, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { Bookmark } from "@shared/schema";

export default function Bookmarks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookmarks, isLoading } = useQuery({
    queryKey: [`/api/bookmarks/${user?.uid}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: number) => {
      const response = await apiRequest('DELETE', `/api/bookmarks/${bookmarkId}`, { userId: user?.uid });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookmarks/${user?.uid}`] });
      toast({
        title: "Bookmark Removed",
        description: "Bookmark has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Could not delete bookmark.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteBookmark = (bookmarkId: number) => {
    deleteBookmarkMutation.mutate(bookmarkId);
  };

  const handleViewBookmark = (bookmark: Bookmark) => {
    // Navigate to home with bookmark data to restore exact videos
    const url = new URL(window.location.origin);
    url.searchParams.set('bookmark', bookmark.id.toString());
    window.location.href = url.toString();
  };

  const bookmarkList = Array.isArray(bookmarks) ? bookmarks : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      {!user ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Sign In Required</h2>
            <p className="text-slate-600">Please sign in to view your bookmarks.</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Loading Bookmarks...</h2>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-slate-900 mb-4">Your Bookmarks</h1>
            <p className="text-slate-600">Saved learning paths you can revisit anytime</p>
          </div>

          {bookmarkList.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 mb-4">No bookmarks yet.</p>
              <Button onClick={() => window.location.href = '/'}>
                Start Learning
              </Button>
            </div>
          ) : (
            <div className="grid gap-6">
              {bookmarkList.map((bookmark: Bookmark) => (
                <Card key={bookmark.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span className="text-lg">{bookmark.searchQuery}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBookmark(bookmark.id)}
                        disabled={deleteBookmarkMutation.isPending}
                      >
                        <BookmarkX className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-slate-500">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(bookmark.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewBookmark(bookmark)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          View Videos
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {bookmark.videoIds.length} videos saved
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      
      <Footer />
    </div>
  );
}