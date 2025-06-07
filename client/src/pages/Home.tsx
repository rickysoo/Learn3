import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { VideoModal } from "@/components/VideoModal";
import { LoadingState } from "@/components/LoadingState";
import { useYouTubeSearch } from "@/hooks/useYouTubeSearch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowDown, GraduationCap } from "lucide-react";
import type { Video } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [currentQuery, setCurrentQuery] = useState("");
  const { toast } = useToast();

  const searchMutation = useYouTubeSearch();

  const handleSearch = async (query: string) => {
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
        
        if (errorMessage.startsWith("API_ERROR:")) {
          title = "YouTube API Unavailable";
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
    setSelectedVideo(video);
  };

  const handleCloseModal = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.3)"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">LevelUp</h1>
            </div>

          </div>
        </div>
      </header>

      {/* Hero Section with Search */}
      <SearchBar onSearch={handleSearch} isLoading={searchMutation.isPending} />

      {/* Learning Path Visualization */}
      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Your Learning Journey</h3>
            <p className="text-slate-600">Follow our structured 3-step approach to build foundational understanding</p>
          </div>
          
          <div className="flex flex-col lg:flex-row justify-center items-center lg:items-start space-y-8 lg:space-y-0 lg:space-x-8 mb-16">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center max-w-xs">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Beginner</h4>
              <p className="text-slate-600 text-sm">Start with fundamentals and core concepts</p>
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
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Intermediate</h4>
              <p className="text-slate-600 text-sm">Build upon basics with practical applications</p>
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
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Advanced</h4>
              <p className="text-slate-600 text-sm">Deep dive into complex topics and mastery</p>
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
                <p className="text-slate-600">Here's your personalized 3-step learning journey</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {searchResults.map((video, index) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    stepNumber={index + 1}
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

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.3)"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">LevelUp</h1>
          </div>
          <p className="text-slate-400">
            Transform your learning journey with curated video paths
          </p>
        </div>
      </footer>
    </div>
  );
}
