import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { YouTubeVideo, VideoSearchResult } from "@shared/schema";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || "";

// YouTube API duration converter
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Search YouTube for videos
async function searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  // Search for videos
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
    `key=${YOUTUBE_API_KEY}&` +
    `q=${encodeURIComponent(query + " beginner tutorial explanation")}&` +
    `part=snippet&` +
    `type=video&` +
    `maxResults=50&` +
    `order=relevance&` +
    `videoDuration=medium&` +
    `safeSearch=strict`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error(`YouTube API search failed: ${searchResponse.statusText}`);
  }
  
  const searchData = await searchResponse.json();
  const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",");

  // Get video details including duration
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
    `key=${YOUTUBE_API_KEY}&` +
    `id=${videoIds}&` +
    `part=snippet,contentDetails`;

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) {
    throw new Error(`YouTube API details failed: ${detailsResponse.statusText}`);
  }

  const detailsData = await detailsResponse.json();
  
  return detailsData.items
    .map((item: any) => {
      const duration = parseDuration(item.contentDetails.duration);
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        channelName: item.snippet.channelTitle,
        duration: item.contentDetails.duration,
        thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
        publishedAt: item.snippet.publishedAt,
        durationSeconds: duration,
      };
    })
    .filter((video: any) => video.durationSeconds >= 300 && video.durationSeconds <= 1200); // 5-20 minutes
}

// Generate learning path with 3 sequential videos
function generateLearningPath(videos: YouTubeVideo[], query: string) {
  if (videos.length < 3) {
    throw new Error("Not enough suitable videos found for this topic");
  }

  // Sort by relevance and duration
  const sortedVideos = videos.sort((a, b) => {
    // Prefer shorter videos for beginners, longer for advanced
    const aDuration = a.durationSeconds || 0;
    const bDuration = b.durationSeconds || 0;
    return aDuration - bDuration;
  });

  // Select 3 videos with different characteristics
  const beginner = sortedVideos[0];
  const intermediate = sortedVideos[Math.floor(sortedVideos.length / 2)];
  const advanced = sortedVideos[sortedVideos.length - 1];

  return [
    {
      youtubeId: beginner.id,
      title: beginner.title,
      description: `Perfect introduction to ${query} fundamentals. ${beginner.description.substring(0, 200)}...`,
      channelName: beginner.channelName,
      duration: beginner.durationSeconds || 0,
      thumbnailUrl: beginner.thumbnailUrl,
      level: "beginner",
      topic: query,
    },
    {
      youtubeId: intermediate.id,
      title: intermediate.title,
      description: `Building on ${query} basics with practical applications. ${intermediate.description.substring(0, 200)}...`,
      channelName: intermediate.channelName,
      duration: intermediate.durationSeconds || 0,
      thumbnailUrl: intermediate.thumbnailUrl,
      level: "intermediate",
      topic: query,
    },
    {
      youtubeId: advanced.id,
      title: advanced.title,
      description: `Deep dive into advanced ${query} concepts and mastery. ${advanced.description.substring(0, 200)}...`,
      channelName: advanced.channelName,
      duration: advanced.durationSeconds || 0,
      thumbnailUrl: advanced.thumbnailUrl,
      level: "advanced",
      topic: query,
    },
  ];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Search for videos
  app.post("/api/search", async (req, res) => {
    try {
      const searchSchema = z.object({
        query: z.string().min(1, "Search query is required"),
      });

      const { query } = searchSchema.parse(req.body);

      // Search YouTube for videos
      const youtubeVideos = await searchYouTubeVideos(query);
      
      // Generate learning path
      const learningPath = generateLearningPath(youtubeVideos, query);
      
      // Clear previous videos for this topic and save new ones
      await storage.clearVideosByTopic(query);
      const savedVideos = await storage.saveVideos(learningPath);

      const result: VideoSearchResult = {
        videos: savedVideos,
        query,
      };

      res.json(result);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to search videos" 
      });
    }
  });

  // Get cached videos for a topic
  app.get("/api/videos/:topic", async (req, res) => {
    try {
      const { topic } = req.params;
      const videos = await storage.getVideosByTopic(topic);
      
      res.json({ videos, query: topic });
    } catch (error) {
      console.error("Get videos error:", error);
      res.status(500).json({ 
        message: "Failed to fetch videos" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
