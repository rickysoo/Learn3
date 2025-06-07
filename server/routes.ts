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



  // Create targeted search queries based on topic type
  let searchQueries: string[];
  
  if (query.toLowerCase().includes('history')) {
    searchQueries = [
      `${query} documentary explained`,
      `${query} timeline events`,
      `${query} educational overview`,
      `${query} historical facts`
    ];
  } else if (query.toLowerCase().includes('marketing')) {
    searchQueries = [
      `${query} tutorial beginner`,
      `${query} strategy guide`,
      `${query} course introduction`,
      `${query} basics explained`
    ];
  } else {
    searchQueries = [
      `${query} tutorial beginner explained`,
      `${query} guide introduction basics`,
      `learn ${query} step by step`,
      `${query} fundamentals course`
    ];
  }
  
  console.log(`Searching YouTube for: "${query}" with targeted queries:`, searchQueries);

  let allVideos: any[] = [];

  // Search with multiple specific queries
  for (const searchQuery of searchQueries) {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
      `key=${YOUTUBE_API_KEY}&` +
      `q=${encodeURIComponent(searchQuery)}&` +
      `part=snippet&` +
      `type=video&` +
      `maxResults=15&` +
      `order=relevance&` +
      `safeSearch=strict&` +
      `relevanceLanguage=en`;

    try {
      const searchResponse = await fetch(searchUrl);
      const responseText = await searchResponse.text();
      
      if (searchResponse.ok) {
        const searchData = JSON.parse(responseText);
        if (searchData.items && searchData.items.length > 0) {
          allVideos.push(...searchData.items);
        }
      } else {
        console.error(`YouTube API error for query "${searchQuery}":`, searchResponse.status, responseText);
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
  const detailsResponseText = await detailsResponse.text();
  
  if (!detailsResponse.ok) {
    console.error(`YouTube API details error:`, detailsResponse.status, detailsResponseText);
    throw new Error(`YouTube API details failed: ${detailsResponse.statusText}`);
  }

  const detailsData = JSON.parse(detailsResponseText);
  
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

      console.log(`AI scoring videos for topic: "${query}"`);
      console.log("Video titles being scored:", videosToProcess.map(v => v.title));

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert educational content curator. Rate each video's relevance to the specific learning topic on a scale of 0.0 to 1.0. Be EXTREMELY strict - only rate 0.8+ if the video is specifically about the exact topic and suitable for learning. Rate 0.0-0.3 for completely unrelated content. Respond with JSON: { \"scores\": [0.9, 0.0, 0.8, ...], \"reasoning\": [\"reason1\", \"reason2\", ...] }"
          },
          {
            role: "user",
            content: `Topic: "${query}"\n\nVideos:\n${videoDescriptions}\n\nRate each video's relevance for learning about "${query}". Be extremely strict - credit scores are NOT related to Malaysia history, algebra is NOT related to history. Only high scores for videos actually about the topic.`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content || '{"scores": [], "reasoning": []}');
      const scores = result.scores || [];
      const reasonings = result.reasoning || [];
      
      console.log(`AI scores for "${query}":`, scores);
      console.log(`AI reasoning:`, reasonings);
      
      for (let i = 0; i < videosToProcess.length; i++) {
        const score = Math.max(0, Math.min(1, scores[i] || 0.1));
        scoredVideos.push({
          ...videosToProcess[i],
          relevanceScore: score,
          relevanceReasoning: reasonings[i] || "AI batch analysis"
        });
        console.log(`Video "${videosToProcess[i].title}" scored: ${score}`);
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

  console.log(`Total scored videos: ${scoredVideos.length}`);
  scoredVideos.forEach(video => {
    console.log(`"${video.title}": ${video.relevanceScore}`);
  });

  // Use strict threshold - only highly relevant videos
  let filteredVideos = scoredVideos
    .filter(video => video.relevanceScore >= 0.8)
    .sort((a, b) => {
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.viewCount - a.viewCount;
    });

  console.log(`High relevance videos (>=0.8): ${filteredVideos.length}`);

  // If not enough high-quality videos, use medium threshold
  if (filteredVideos.length < 3) {
    filteredVideos = scoredVideos
      .filter(video => video.relevanceScore >= 0.6)
      .sort((a, b) => {
        if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1) {
          return b.relevanceScore - a.relevanceScore;
        }
        return b.viewCount - a.viewCount;
      });
    console.log(`Medium relevance videos (>=0.6): ${filteredVideos.length}`);
  }

  // Final fallback - only accept moderately relevant content
  if (filteredVideos.length < 3) {
    filteredVideos = scoredVideos
      .filter(video => video.relevanceScore >= 0.4)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    console.log(`Low relevance videos (>=0.4): ${filteredVideos.length}`);
  }

  // If still no relevant videos, throw error
  if (filteredVideos.length === 0) {
    throw new Error(`No relevant videos found for "${query}". Please try a more specific search term.`);
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

      // Test YouTube API availability first
      try {
        const testUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=test&part=snippet&type=video&maxResults=1`;
        const testResponse = await fetch(testUrl);
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          let errorMessage = "YouTube API is unavailable";
          let errorType = "API_ERROR";
          
          if (testResponse.status === 403) {
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
                errorMessage = "YouTube API quota exceeded. Please provide a fresh API key with available quota.";
                errorType = "QUOTA_EXCEEDED";
              } else {
                errorMessage = "YouTube API access denied. Please check your API key permissions.";
                errorType = "ACCESS_DENIED";
              }
            } catch {
              errorMessage = "YouTube API access forbidden. Please verify your API key.";
              errorType = "ACCESS_DENIED";
            }
          } else if (testResponse.status === 400) {
            errorMessage = "YouTube API key is invalid or expired. Please provide a valid API key.";
            errorType = "INVALID_KEY";
          }
          
          return res.status(503).json({ 
            error: errorType,
            message: errorMessage,
            needsApiKey: true
          });
        }
      } catch (apiError) {
        console.error("YouTube API test failed:", apiError);
        return res.status(503).json({ 
          error: "API_UNAVAILABLE",
          message: "Unable to connect to YouTube API. Please check your internet connection and API key.",
          needsApiKey: true
        });
      }

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
