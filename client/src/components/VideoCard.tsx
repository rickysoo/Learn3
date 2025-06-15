import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Play } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Video } from "@shared/schema";

interface VideoCardProps {
  video: Video;
  levelNumber: number;
  onPlay: (video: Video) => void;
}

const LEVEL_COLORS = {
  "level 1": "from-green-400 to-green-500",
  "level 2": "from-blue-400 to-blue-500",
  "level 3": "from-purple-400 to-purple-500",
};

const LEVEL_LABELS = {
  "level 1": "Level 1",
  "level 2": "Level 2", 
  "level 3": "Level 3",
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function VideoCard({ video, levelNumber, onPlay }: VideoCardProps) {
  const level = video.level as keyof typeof LEVEL_COLORS;
  const colorClass = LEVEL_COLORS[level] || LEVEL_COLORS["level 1"];
  const levelLabel = LEVEL_LABELS[level] || `Level ${levelNumber}`;
  const isMobile = useIsMobile();

  const handlePlayClick = () => {
    if (isMobile) {
      // On mobile, open in YouTube app
      window.open(`https://www.youtube.com/watch?v=${video.youtubeId}`, '_blank');
    } else {
      // On desktop/tablet, use modal with autoplay
      onPlay(video);
    }
  };

  const handleYouTubeClick = () => {
    window.open(`https://www.youtube.com/watch?v=${video.youtubeId}`, '_blank');
  };

  return (
    <Card className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <div className="relative">
        <div className="aspect-video bg-slate-200 relative overflow-hidden">
          <img
            src={video.thumbnailUrl || ''}
            alt={video.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <Button
              onClick={handlePlayClick}
              size="lg"
              className="bg-white/90 hover:bg-white text-slate-900 rounded-full p-4 shadow-lg"
            >
              <Play className="h-6 w-6 ml-1" />
            </Button>
          </div>
        </div>
        <div className="absolute top-4 left-4">
          <span className={`bg-gradient-to-r ${colorClass} text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg`}>
            {levelLabel}
          </span>
        </div>
        {video.duration && (
          <div className="absolute top-4 right-4">
            <span className="bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
              {formatDuration(video.duration)}
            </span>
          </div>
        )}
      </div>

      <CardContent className="p-4 sm:p-6">
        <h4 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2 sm:mb-3 line-clamp-2">
          {video.title}
        </h4>
        <p className="text-slate-600 text-sm mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3">
          {video.description}
        </p>

        {/* Scores Display - Mobile Optimized */}
        <div className="flex items-center gap-1 sm:gap-2 mb-3 sm:mb-4 text-xs flex-wrap">
          {video.relevanceScore && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Topic Match:</span>
              <span className={`px-2 py-1 rounded-full font-medium ${
                video.relevanceScore >= 90 ? 'bg-green-100 text-green-700' :
                video.relevanceScore >= 80 ? 'bg-blue-100 text-blue-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {video.relevanceScore}%
              </span>
            </div>
          )}
          {video.difficultyScore && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Difficulty:</span>
              <span className={`px-2 py-1 rounded-full font-medium ${
                video.difficultyScore === 1 ? 'bg-green-100 text-green-700' :
                video.difficultyScore === 2 ? 'bg-blue-100 text-blue-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {((video.difficultyScore - 1) / 2).toFixed(2)}
              </span>
            </div>
          )}

        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 text-sm text-slate-500 gap-1 sm:gap-0">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="truncate">{video.channelName}</span>
            </div>
            {video.publishedAt && (
              <span className="text-xs text-slate-400 sm:ml-2">
                {formatDate(video.publishedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handlePlayClick}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white flex-1 sm:flex-none"
            >
              <Play className="h-4 w-4 mr-1" />
              Play
            </Button>
            <Button
              onClick={handleYouTubeClick}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
