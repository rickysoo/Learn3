import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

const POPULAR_TOPICS = [
  "Artificial Intelligence",
  "Prompt Engineering", 
  "Custom GPT",
  "AI Chatbot",
  "AI Automation",
  "AI Agent"
];

export function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
    onSearch(topic);
  };

  return (
    <section className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 py-16 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
          Master Any Topic in{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            3 Simple Steps
          </span>
        </h2>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Enter any subject and get a curated learning path with beginner, intermediate, and advanced videos that build upon each other.
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
          <div className="flex rounded-2xl shadow-lg bg-white border border-slate-200 overflow-hidden">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Enter any topic"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-6 py-4 text-lg border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isLoading}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              className="px-8 py-4 bg-primary hover:bg-primary/90 text-white font-semibold text-lg rounded-none"
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? "Searching..." : "Start Learning"}
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="text-sm text-slate-500 mr-2"></span>
            {POPULAR_TOPICS.map((topic) => (
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
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}
