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

  // Create multiple specific search queries to ensure topic relevance
  const searchQueries = [
    `${query} tutorial beginner explained`,
    `${query} guide introduction basics`,
    `learn ${query} step by step`,
    `${query} fundamentals course`
  ];

  let allVideos: any[] = [];

  // Search with multiple specific queries
  for (const searchQuery of searchQueries) {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
      `key=${YOUTUBE_API_KEY}&` +
      `q=${encodeURIComponent(searchQuery)}&` +
      `part=snippet&` +
      `type=video&` +
      `maxResults=10&` +
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

  const videoIds = uniqueVideos.slice(0, 15).map((item: any) => item.id.videoId).join(",");

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

  // AI-powered relevance filtering for maximum accuracy
  const scoredVideos = [];
  
  if (OPENAI_API_KEY && processedVideos.length > 0) {
    try {
      // Batch process videos with AI for faster processing
      const batchSize = 6; // Process in smaller batches for speed
      const videosToProcess = processedVideos.slice(0, batchSize);
      
      const videoDescriptions = videosToProcess.map((video, i) => 
        `${i + 1}. Title: "${video.title}"\nDescription: "${video.description?.substring(0, 200) || 'No description'}"\n`
      ).join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Rate each video's relevance to the learning topic on a scale of 0.0 to 1.0. Be very strict - only rate 0.8+ if specifically about the exact topic. Respond with JSON: { \"scores\": [0.9, 0.2, 0.8, ...], \"reasoning\": [\"reason1\", \"reason2\", ...] }"
          },
          {
            role: "user",
            content: `Topic: "${query}"\n\nVideos:\n${videoDescriptions}\n\nRate relevance for learning specifically about "${query}". Be strict - Singapore history ≠ Malaysia history, mysteries ≠ history.`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 300
      });

      const result = JSON.parse(response.choices[0].message.content || '{"scores": [], "reasoning": []}');
      const scores = result.scores || [];
      const reasonings = result.reasoning || [];
      
      for (let i = 0; i < videosToProcess.length; i++) {
        scoredVideos.push({
          ...videosToProcess[i],
          relevanceScore: Math.max(0, Math.min(1, scores[i] || 0.5)),
          relevanceReasoning: reasonings[i] || "AI batch analysis"
        });
      }
    } catch (error) {
      console.error("AI relevance scoring failed:", error);
      // Fallback to enhanced keyword matching
      for (const video of processedVideos.slice(0, 12)) {
        const title = video.title.toLowerCase();
        const description = video.description.toLowerCase();
        const topicLower = query.toLowerCase();
        
        let score = 0;
        const topicWords = topicLower.split(' ').filter(word => word.length > 2);
        
        // All words must be present
        let hasAllKeywords = true;
        for (const word of topicWords) {
          if (!title.includes(word) && !description.includes(word)) {
            hasAllKeywords = false;
            break;
          }
        }
        
        if (hasAllKeywords) {
          if (title.includes(topicLower)) score += 0.9;
          for (const word of topicWords) {
            if (title.includes(word)) score += 0.3;
          }
        }
        
        scoredVideos.push({
          ...video,
          relevanceScore: score,
          relevanceReasoning: "Enhanced keyword matching"
        });
      }
    }
  } else {
    // Fallback without AI
    for (const video of processedVideos.slice(0, 12)) {
      const title = video.title.toLowerCase();
      const description = video.description.toLowerCase();
      const topicLower = query.toLowerCase();
      
      let score = 0;
      if (title.includes(topicLower)) score = 0.9;
      else {
        const topicWords = topicLower.split(' ').filter(word => word.length > 2);
        let matchCount = 0;
        for (const word of topicWords) {
          if (title.includes(word)) matchCount++;
        }
        score = topicWords.length > 0 ? matchCount / topicWords.length * 0.7 : 0;
      }
      
      scoredVideos.push({
        ...video,
        relevanceScore: score,
        relevanceReasoning: "Basic keyword matching"
      });
    }
  }

  // Return videos with adaptive threshold
  let filteredVideos = scoredVideos
    .filter(video => video.relevanceScore >= 0.7)
    .sort((a, b) => {
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.viewCount - a.viewCount;
    });

  // If not enough high-quality videos, lower the threshold
  if (filteredVideos.length < 3) {
    filteredVideos = scoredVideos
      .filter(video => video.relevanceScore >= 0.5)
      .sort((a, b) => {
        if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1) {
          return b.relevanceScore - a.relevanceScore;
        }
        return b.viewCount - a.viewCount;
      });
  }

  // Final fallback - return any videos with some relevance
  if (filteredVideos.length < 3) {
    filteredVideos = scoredVideos
      .filter(video => video.relevanceScore >= 0.3)
      .sort((a, b) => b.viewCount - a.viewCount);
  }

  return filteredVideos.slice(0, 8);
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
  if (videos.length === 0) {
    throw new Error("No videos found for this topic");
  }
  
  // If we have fewer than 3 videos, duplicate the best ones
  if (videos.length < 3) {
    const sortedVideos = [...videos].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    while (videos.length < 3 && sortedVideos.length > 0) {
      videos.push({...sortedVideos[0]});
    }
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
