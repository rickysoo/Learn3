import { useState, useEffect } from "react";
import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { VideoModal } from "@/components/VideoModal";
import { LoadingState } from "@/components/LoadingState";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { BookmarkButton } from "@/components/BookmarkButton";
import { ShareButton } from "@/components/ShareButton";
import { Header } from "@/components/Header";
import { useYouTubeSearch } from "@/hooks/useYouTubeSearch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowDown, GraduationCap } from "lucide-react";
import type { Video, Bookmark } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { trackSearch, trackVideoPlay } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [currentQuery, setCurrentQuery] = useState("");
  const { toast } = useToast();

  const searchMutation = useYouTubeSearch();

  // Handle URL parameters for search or bookmark restoration
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    const bookmarkParam = urlParams.get('bookmark');
    
    if (bookmarkParam) {
      handleBookmarkRestore(parseInt(bookmarkParam));
    } else if (queryParam && queryParam.trim()) {
      handleSearch(queryParam);
    }
    
    // Clean up URL
    if (queryParam || bookmarkParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleBookmarkRestore = async (bookmarkId: number) => {
    try {
      const response = await fetch(`/api/bookmark/${bookmarkId}`);
      if (!response.ok) {
        throw new Error('Bookmark not found');
      }
      
      const bookmark: Bookmark = await response.json();
      
      // Fetch the videos by their YouTube IDs
      const videoPromises = bookmark.videoIds.map(async (youtubeId) => {
        const videoResponse = await fetch(`/api/videos/youtube/${youtubeId}`);
        if (videoResponse.ok) {
          return videoResponse.json();
        }
        return null;
      });
      
      const videos = (await Promise.all(videoPromises)).filter(Boolean);
      
      setSearchResults(videos);
      setCurrentQuery(bookmark.searchQuery);
      
      toast({
        title: "Bookmark Restored",
        description: `Showing saved videos for "${bookmark.searchQuery}"`,
      });
      
      // Scroll to results
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ 
          behavior: 'smooth' 
        });
      }, 100);
    } catch (error) {
      toast({
        title: "Bookmark Error",
        description: "Could not restore bookmarked videos",
        variant: "destructive",
      });
    }
  };

  const handleSearch = async (query: string) => {
    // Track search in GA
    trackSearch(query);
    
    try {
      const result = await searchMutation.mutateAsync(query);
      setSearchResults(result.videos);
      setCurrentQuery(result.query);
      
      // Scroll to results
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ 
          behavior: 'smooth' 
        });
      }, 100);
    } catch (error) {
      let title = "Search Failed";
      let description = "Failed to search videos. Please try again.";
      
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        if (errorMessage.startsWith("DAILY_LIMIT_REACHED:")) {
          title = "Daily Search Limit Reached";
          description = errorMessage.replace("DAILY_LIMIT_REACHED: ", "");
        } else if (errorMessage.startsWith("API_ERROR:")) {
          title = "Search Unavailable";
          description = errorMessage.replace("API_ERROR: ", "");
        } else {
          description = errorMessage;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  };

  const handlePlayVideo = (video: Video) => {
    // Track video play in GA
    trackVideoPlay(video.title, String(video.level));
    setSelectedVideo(video);
  };

  const handleCloseModal = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hero Section with Search */}
      <SearchBar onSearch={handleSearch} isLoading={searchMutation.isPending} />

      {/* Learning Path Visualization */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 sm:mb-4">How It Works</h3>
            <p className="text-sm sm:text-base text-slate-600">We pick 3 perfect videos to take you from zero to hero</p>
          </div>
          
          <div className="flex flex-col lg:flex-row justify-center items-center lg:items-start space-y-6 lg:space-y-0 lg:space-x-8 mb-8 sm:mb-16">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center max-w-xs">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">🎯 The Basics</h4>
              <p className="text-slate-600 text-sm">Get started</p>
            </div>
            
            <div className="hidden lg:block mt-8">
              <ArrowRight className="text-slate-400 text-2xl" />
            </div>
            <div className="lg:hidden">
              <ArrowDown className="text-slate-400 text-2xl" />
            </div>
            
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center max-w-xs">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">⚡ Get Practical</h4>
              <p className="text-slate-600 text-sm">Level up</p>
            </div>
            
            <div className="hidden lg:block mt-8">
              <ArrowRight className="text-slate-400 text-2xl" />
            </div>
            <div className="lg:hidden">
              <ArrowDown className="text-slate-400 text-2xl" />
            </div>
            
            {/* Step 3 */}
            <div className="flex flex-col items-center text-center max-w-xs">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">🧠 Go Pro</h4>
              <p className="text-slate-600 text-sm">Master it</p>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-16 bg-slate-50" id="results-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {searchMutation.isPending && <LoadingState />}
          
          {searchResults.length > 0 && !searchMutation.isPending && (
            <>
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-slate-900 mb-4">
                  Learning Path: <span className="text-primary">{currentQuery}</span>
                </h3>
                <p className="text-slate-600 mb-6">Here's your personalized 3-level learning journey</p>
                <div className="flex items-center justify-center gap-3">
                  <BookmarkButton searchQuery={currentQuery} videos={searchResults} />
                  <ShareButton searchQuery={currentQuery} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {searchResults.map((video, index) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    levelNumber={index + 1}
                    onPlay={handlePlayVideo}
                  />
                ))}
              </div>


            </>
          )}
        </div>
      </section>

      {/* Video Modal */}
      <VideoModal
        video={selectedVideo}
        isOpen={!!selectedVideo}
        onClose={handleCloseModal}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Learn3Logo />
            <h1 className="text-xl font-bold text-white">Learn3</h1>
          </div>
          <p className="text-slate-400 mb-4">
            Your personal video curator for learning anything, fast ⚡
          </p>
          <p className="text-slate-400 text-sm">
            💡 Want to dive deeper into AI? <a href="https://AICoach.my" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Learn AI</a>
          </p>
        </div>
      </footer>

    </div>
  );
}
