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
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Failed to search videos. Please try again.",
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
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">LevelUp</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#" className="text-slate-600 hover:text-primary transition-colors">How it Works</a>
              <a href="#" className="text-slate-600 hover:text-primary transition-colors">Popular Topics</a>
              <a href="#" className="text-slate-600 hover:text-primary transition-colors">About</a>
            </nav>
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

              <div className="mt-16 text-center">
                <Card className="max-w-2xl mx-auto">
                  <CardContent className="p-8">
                    <h4 className="text-2xl font-bold text-slate-900 mb-4">Ready for the Next Level?</h4>
                    <p className="text-slate-600 mb-6">Complete this learning path and explore related topics to deepen your understanding.</p>
                    <div className="flex flex-wrap justify-center gap-4">
                      <Button className="bg-accent hover:bg-accent/90 text-white">
                        Mark as Complete
                      </Button>
                      <Button variant="secondary">
                        Save for Later
                      </Button>
                      <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                        Explore Related Topics
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold">LevelUp</h1>
              </div>
              <p className="text-slate-400 mb-4 max-w-md">
                Transform your learning journey with curated video paths that take you from beginner to advanced in any topic.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Popular Topics</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-400">
            <p>&copy; 2024 LevelUp. All rights reserved. Made with ❤️ for learners everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
