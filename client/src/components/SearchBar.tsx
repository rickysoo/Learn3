import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { trackTopicClick, trackTopicRefresh } from "@/lib/analytics";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

interface TopicsResponse {
  topics: string[];
}

export function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");

  // Fetch random topics from OpenAI
  const { data: topicsData, isLoading: topicsLoading, refetch: refetchTopics } = useQuery<TopicsResponse>({
    queryKey: ['/api/topics/random'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const randomTopics = (topicsData as TopicsResponse)?.topics || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleTopicClick = (topic: string) => {
    trackTopicClick(topic);
    setQuery(topic);
    onSearch(topic);
  };

  return (
    <section className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 py-8 sm:py-16 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Learn Anything in 3 Videos
          </span>
        </h2>
        <p className="text-base sm:text-xl text-slate-600 mb-6 sm:mb-10 max-w-2xl mx-auto">
          Find the perfect video trio for any topic.
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row rounded-2xl shadow-lg bg-white border border-slate-200 overflow-hidden">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="What do you want to learn?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isLoading}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 sm:hidden">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              className="px-4 sm:px-8 py-3 sm:py-4 bg-primary hover:bg-primary/90 text-white font-semibold text-base sm:text-lg rounded-none sm:rounded-none"
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? "Searching..." : "Find My Videos"}
            </Button>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-sm text-slate-500">Try these topics:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  trackTopicRefresh();
                  refetchTopics();
                }}
                disabled={topicsLoading}
                className="h-6 w-6 p-0 hover:bg-slate-100"
              >
                <RefreshCw className={`h-3 w-3 ${topicsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {topicsLoading ? (
                <div className="flex space-x-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 w-20 bg-slate-200 rounded-full animate-pulse" />
                  ))}
                </div>
              ) : (
                randomTopics.map((topic: string) => (
                  <Button
                    key={topic}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTopicClick(topic)}
                    className="px-3 py-1 text-sm rounded-full border-slate-200 hover:border-primary/30 hover:text-primary"
                    disabled={isLoading}
                  >
                    {topic}
                  </Button>
                ))
              )}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
