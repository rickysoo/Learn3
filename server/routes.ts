import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { YouTubeVideo, VideoSearchResult } from "@shared/schema";
import OpenAI from "openai";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: OPENAI_API_KEY 
});

// YouTube API duration converter
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  
  return hours * 3600 + minutes * 60 + seconds;
}

// AI-powered relevance scoring
async function scoreVideoRelevance(video: any, topic: string): Promise<{ score: number; reasoning: string }> {
  if (!OPENAI_API_KEY) {
    // Fallback to basic keyword matching if no OpenAI key
    const title = video.title.toLowerCase();
    const description = video.description.toLowerCase();
    const topicLower = topic.toLowerCase();
    
    let score = 0;
    const topicWords = topicLower.split(' ');
    
    for (const word of topicWords) {
      if (title.includes(word)) score += 0.4;
      if (description.includes(word)) score += 0.2;
    }
    
    return { score: Math.min(score, 1), reasoning: "Basic keyword matching" };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert at evaluating educational content relevance. Rate how well a video matches a learning topic on a scale of 0.0 to 1.0, where 1.0 is perfectly relevant and 0.0 is completely unrelated. Respond with JSON in this format: { \"score\": number, \"reasoning\": \"brief explanation\" }"
        },
        {
          role: "user",
          content: `Topic: "${topic}"
          
Video Title: "${video.title}"
Video Description: "${video.description?.substring(0, 500) || 'No description'}"
Channel: "${video.channelName}"

Rate this video's relevance to learning about "${topic}".`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{"score": 0, "reasoning": "No response"}');
    return {
      score: Math.max(0, Math.min(1, result.score)),
      reasoning: result.reasoning || "AI analysis"
    };
  } catch (error) {
    console.error("OpenAI relevance scoring failed:", error);
    // Fallback to keyword matching
    const title = video.title.toLowerCase();
    const topicLower = topic.toLowerCase();
    const score = title.includes(topicLower) ? 0.8 : 0.1;
    return { score, reasoning: "Fallback keyword matching" };
  }
}

// Enhanced YouTube search with better targeting
async function searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  // Single optimized search query
  const searchQuery = `${query} tutorial beginner explained`;
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
    `key=${YOUTUBE_API_KEY}&` +
    `q=${encodeURIComponent(searchQuery)}&` +
    `part=snippet&` +
    `type=video&` +
    `maxResults=25&` +
    `order=relevance&` +
    `videoDuration=medium&` +
    `safeSearch=strict&` +
    `relevanceLanguage=en`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error(`YouTube API search failed: ${searchResponse.statusText}`);
  }
  
  const searchData = await searchResponse.json();
  const allVideos = searchData.items;

  // Remove duplicates
  if (allVideos.length === 0) {
    throw new Error(`No videos found for topic: ${query}`);
  }

  const videoIds = allVideos.slice(0, 15).map((item: any) => item.id.videoId).join(",");

  // Get video details including duration
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
    `key=${YOUTUBE_API_KEY}&` +
    `id=${videoIds}&` +
    `part=snippet,contentDetails,statistics`;

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) {
    throw new Error(`YouTube API details failed: ${detailsResponse.statusText}`);
  }

  const detailsData = await detailsResponse.json();
  
  // Process videos and filter by duration
  const processedVideos = detailsData.items
    .map((item: any) => {
      const duration = parseDuration(item.contentDetails.duration);
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description || "",
        channelName: item.snippet.channelTitle,
        duration: item.contentDetails.duration,
        thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
        publishedAt: item.snippet.publishedAt,
        durationSeconds: duration,
        viewCount: parseInt(item.statistics?.viewCount || "0"),
      };
    })
    .filter((video: any) => video.durationSeconds >= 300 && video.durationSeconds <= 1200); // 5-20 minutes

  // Use improved keyword matching for fast, relevant results
  const scoredVideos = processedVideos.map(video => {
    const title = video.title.toLowerCase();
    const description = video.description.toLowerCase();
    const channelName = video.channelName.toLowerCase();
    const topicLower = query.toLowerCase();
    
    let score = 0;
    const topicWords = topicLower.split(' ').filter(word => word.length > 2);
    
    // Higher weight for title matches
    for (const word of topicWords) {
      if (title.includes(word)) score += 0.5;
      if (description.includes(word)) score += 0.2;
      if (channelName.includes(word)) score += 0.1;
    }
    
    // Bonus for educational indicators
    const educationalKeywords = ['tutorial', 'explain', 'guide', 'intro', 'beginner', 'learn', 'course', 'lesson'];
    for (const keyword of educationalKeywords) {
      if (title.includes(keyword)) score += 0.3;
    }
    
    // Penalty for clearly unrelated content
    const unrelatedKeywords = ['song', 'music', 'funny', 'prank', 'reaction', 'vlog'];
    for (const keyword of unrelatedKeywords) {
      if (title.includes(keyword)) score -= 0.5;
    }
    
    return {
      ...video,
      relevanceScore: Math.max(0, Math.min(1, score)),
      relevanceReasoning: "Enhanced keyword matching"
    };
  });

  // Filter and sort by relevance and popularity
  return scoredVideos
    .filter(video => video.relevanceScore >= 0.4) // Lower threshold for better coverage
    .sort((a, b) => {
      // Primary sort: relevance score
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.2) {
        return b.relevanceScore - a.relevanceScore;
      }
      // Secondary sort: view count for similar relevance
      return b.viewCount - a.viewCount;
    })
    .slice(0, 12); // Return top 12 most relevant videos
}

// Simple learning path optimization without AI for speed
function optimizeLearningPath(videos: any[], query: string): any[] {
  if (videos.length < 3) {
    return videos;
  }

  // Sort by relevance score first, then by duration for progression
  const sortedVideos = videos.sort((a, b) => {
    if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1) {
      return b.relevanceScore - a.relevanceScore;
    }
    return a.durationSeconds - b.durationSeconds;
  });

  // Select videos that create good progression
  const beginner = sortedVideos[0]; // Highest relevance, likely shorter
  const intermediate = sortedVideos[Math.floor(sortedVideos.length / 2)]; // Middle option
  const advanced = sortedVideos[sortedVideos.length - 1]; // Longer, more detailed

  return [beginner, intermediate, advanced];
}

// Generate learning path with 3 sequential videos
function generateLearningPath(videos: YouTubeVideo[], query: string) {
  if (videos.length < 3) {
    throw new Error("Not enough suitable videos found for this topic");
  }

  // Use optimized learning progression
  const optimizedVideos = optimizeLearningPath(videos, query);

  // Assign appropriate levels and enhance descriptions
  const levels = ["beginner", "intermediate", "advanced"];
  const levelDescriptions = [
    `Perfect introduction to ${query} fundamentals`,
    `Building on ${query} basics with deeper concepts`,
    `Advanced ${query} topics and comprehensive understanding`
  ];

  return optimizedVideos.map((video, index) => ({
    youtubeId: video.id,
    title: video.title,
    description: `${levelDescriptions[index]}. ${video.description?.substring(0, 200) || 'Educational content'}...`,
    channelName: video.channelName,
    duration: video.durationSeconds || 0,
    thumbnailUrl: video.thumbnailUrl,
    level: levels[index],
    topic: query,
  }));
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
