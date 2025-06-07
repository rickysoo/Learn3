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

  // Create multiple targeted search queries
  const searchQueries = [
    `${query} explained beginner tutorial`,
    `${query} introduction basics`,
    `${query} fundamentals guide`,
    `learn ${query} step by step`,
    `${query} educational video`
  ];

  let allVideos: any[] = [];

  // Search with multiple queries to get diverse results
  for (const searchQuery of searchQueries) {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
      `key=${YOUTUBE_API_KEY}&` +
      `q=${encodeURIComponent(searchQuery)}&` +
      `part=snippet&` +
      `type=video&` +
      `maxResults=15&` +
      `order=relevance&` +
      `videoDuration=medium&` +
      `safeSearch=strict&` +
      `relevanceLanguage=en`;

    try {
      const searchResponse = await fetch(searchUrl);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        allVideos.push(...searchData.items);
      }
    } catch (error) {
      console.error(`Search query failed: ${searchQuery}`, error);
    }
  }

  // Remove duplicates
  const uniqueVideos = allVideos.filter((video, index, self) => 
    index === self.findIndex((v) => v.id.videoId === video.id.videoId)
  );

  if (uniqueVideos.length === 0) {
    throw new Error(`No videos found for topic: ${query}`);
  }

  const videoIds = uniqueVideos.slice(0, 50).map((item: any) => item.id.videoId).join(",");

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

  // Score relevance using AI
  const scoredVideos = [];
  for (const video of processedVideos) {
    const relevance = await scoreVideoRelevance(video, query);
    scoredVideos.push({
      ...video,
      relevanceScore: relevance.score,
      relevanceReasoning: relevance.reasoning
    });
  }

  // Filter out low-relevance videos and sort by relevance + popularity
  return scoredVideos
    .filter(video => video.relevanceScore >= 0.6) // Only keep highly relevant videos
    .sort((a, b) => {
      // Primary sort: relevance score
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1) {
        return b.relevanceScore - a.relevanceScore;
      }
      // Secondary sort: view count for similar relevance
      return b.viewCount - a.viewCount;
    })
    .slice(0, 15); // Return top 15 most relevant videos
}

// AI-powered learning path optimization
async function optimizeLearningPath(videos: any[], query: string): Promise<any[]> {
  if (!OPENAI_API_KEY) {
    // Fallback to simple progression without AI
    return videos
      .sort((a, b) => a.durationSeconds - b.durationSeconds)
      .slice(0, 3);
  }

  try {
    const videoSummaries = videos.map((v, i) => 
      `${i + 1}. "${v.title}" (${Math.floor(v.durationSeconds / 60)}min) - ${v.description.substring(0, 150)}...`
    ).join('\n');

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert educator designing learning paths. Select exactly 3 videos that create the best beginner-to-advanced progression for the topic. Videos should build upon each other logically. Respond with JSON: { \"selections\": [video_index1, video_index2, video_index3], \"reasoning\": \"explanation\" }"
        },
        {
          role: "user",
          content: `Topic: "${query}"

Available videos:
${videoSummaries}

Select 3 videos (by number) that create the best learning progression from beginner to advanced level.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300
    });

    const result = JSON.parse(response.choices[0].message.content || '{"selections": [0, 1, 2]}');
    const selectedIndices = result.selections || [0, 1, 2];
    
    return selectedIndices
      .slice(0, 3)
      .map((index: number) => videos[index] || videos[0])
      .filter(Boolean);
  } catch (error) {
    console.error("AI learning path optimization failed:", error);
    // Fallback to duration-based selection
    return videos
      .sort((a, b) => a.durationSeconds - b.durationSeconds)
      .slice(0, 3);
  }
}

// Generate learning path with 3 sequential videos
async function generateLearningPath(videos: YouTubeVideo[], query: string) {
  if (videos.length < 3) {
    throw new Error("Not enough suitable videos found for this topic");
  }

  // Use AI to optimize the learning progression
  const optimizedVideos = await optimizeLearningPath(videos, query);

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
      const learningPath = await generateLearningPath(youtubeVideos, query);
      
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
