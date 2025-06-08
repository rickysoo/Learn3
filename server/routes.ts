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

// Enhanced YouTube search with better targeting for all difficulty levels
async function searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  console.log(`Searching YouTube for: "${query}"`);

  // Single optimized search query to save API costs
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
    `key=${YOUTUBE_API_KEY}&` +
    `q=${encodeURIComponent(query)}&` +
    `part=snippet&` +
    `type=video&` +
    `maxResults=20&` +
    `order=relevance&` +
    `safeSearch=strict&` +
    `relevanceLanguage=en`;

  const searchResponse = await fetch(searchUrl);
  const responseText = await searchResponse.text();
  
  if (!searchResponse.ok) {
    const errorText = responseText;
    let errorMessage = "YouTube API is unavailable";
    let errorType = "API_ERROR";
    
    if (searchResponse.status === 403) {
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
          errorMessage = "We've reached our daily search limit! Please try again tomorrow when the quota resets (midnight Pacific Time).";
          errorType = "DAILY_LIMIT_REACHED";
        } else {
          errorMessage = "YouTube API access denied. Please check your API key permissions.";
          errorType = "ACCESS_DENIED";
        }
      } catch {
        errorMessage = "YouTube API access forbidden. Please verify your API key.";
        errorType = "ACCESS_DENIED";
      }
    } else if (searchResponse.status === 400) {
      errorMessage = "YouTube API key is invalid or expired. Please provide a valid API key.";
      errorType = "INVALID_KEY";
    }
    
    throw new Error(`${errorType}: ${errorMessage}`);
  }
  
  const searchData = JSON.parse(responseText);
  const allVideos = searchData.items || [];

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
      
      const videoDescriptions = videosToProcess.map((video: any, i: number) => 
        `${i + 1}. Title: "${video.title}"\nDescription: "${video.description?.substring(0, 200) || 'No description'}"\n`
      ).join('\n');

      console.log(`AI scoring videos for topic: "${query}"`);
      console.log("Video titles being scored:", videosToProcess.map((v: any) => v.title));

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

  // Final fallback - return the best available videos regardless of score
  if (filteredVideos.length < 3) {
    filteredVideos = scoredVideos
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, Math.max(3, Math.min(8, scoredVideos.length)));
    console.log(`Using best available videos: ${filteredVideos.length}`);
  }

  return filteredVideos.slice(0, 8);
}

// Intelligent learning path optimization with difficulty progression
async function optimizeLearningPath(videos: any[], query: string): Promise<any[]> {
  if (videos.length === 0) {
    return [];
  }
  
  if (videos.length === 1) {
    return [videos[0]];
  }
  
  if (videos.length === 2) {
    return videos;
  }

  // Remove any duplicates by video ID first
  const uniqueVideos = videos.filter((video, index, self) => 
    index === self.findIndex(v => v.id === video.id)
  );

  // AI-powered difficulty analysis for better categorization
  const categorizedVideos = [];
  
  if (OPENAI_API_KEY && uniqueVideos.length > 0) {
    try {
      const videoDescriptions = uniqueVideos.map((video, i) => 
        `${i + 1}. Title: "${video.title}"\nDescription: "${video.description?.substring(0, 300) || 'No description'}"\nDuration: ${Math.floor(video.durationSeconds / 60)} minutes\nChannel: "${video.channelName}"\n`
      ).join('\n');

      console.log(`AI analyzing difficulty levels for topic: "${query}"`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert educational content analyst. Analyze each video's difficulty level for learning about a specific topic. Rate difficulty as:
1 = Beginner (basic concepts, introductory, assumes no prior knowledge)
2 = Intermediate (builds on basics, requires some foundation, practical application)
3 = Advanced (complex concepts, assumes prior knowledge, deep dive, expert level)

Consider: content complexity, assumed knowledge, technical depth, pace of delivery.
Respond with JSON: { "difficulties": [1, 2, 3, ...], "reasoning": ["reason1", "reason2", ...] }`
          },
          {
            role: "user",
            content: `Topic: "${query}"\n\nVideos:\n${videoDescriptions}\n\nAnalyze the difficulty level of each video for learning about "${query}". Focus on educational progression from basic concepts to advanced understanding.`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      const result = JSON.parse(response.choices[0].message.content || '{"difficulties": [], "reasoning": []}');
      const difficulties = result.difficulties || [];
      const reasonings = result.reasoning || [];
      
      console.log(`AI difficulty scores for "${query}":`, difficulties);
      console.log(`AI difficulty reasoning:`, reasonings);
      
      for (let i = 0; i < uniqueVideos.length; i++) {
        const difficultyScore = Math.max(1, Math.min(3, difficulties[i] || 1));
        categorizedVideos.push({
          ...uniqueVideos[i],
          difficultyScore,
          difficultyReasoning: reasonings[i] || "AI difficulty analysis"
        });
        console.log(`Video "${uniqueVideos[i].title}" difficulty: ${difficultyScore}`);
      }
    } catch (error) {
      console.error("AI difficulty analysis failed:", error);
      // Fallback to enhanced keyword-based analysis
      for (const video of uniqueVideos) {
        const title = video.title.toLowerCase();
        const description = video.description?.toLowerCase() || '';
        
        let difficultyScore = 1;
        
        // Advanced indicators get priority
        if (title.includes('advanced') || title.includes('master') || title.includes('expert') ||
            title.includes('complete') || title.includes('comprehensive') || title.includes('deep') ||
            description.includes('advanced') || description.includes('comprehensive') ||
            video.durationSeconds > 1800) {
          difficultyScore = 3;
        }
        // Intermediate indicators
        else if (title.includes('intermediate') || title.includes('guide') || title.includes('tutorial') ||
                 title.includes('course') || title.includes('step by step') ||
                 description.includes('building on') || description.includes('next level') ||
                 video.durationSeconds > 900) {
          difficultyScore = 2;
        }
        // Default to beginner for explicit beginner content or short videos
        else {
          difficultyScore = 1;
        }
        
        categorizedVideos.push({
          ...video,
          difficultyScore,
          difficultyReasoning: "Fallback keyword analysis"
        });
      }
    }
  } else {
    // Fallback when no OpenAI key
    for (const video of uniqueVideos) {
      const title = video.title.toLowerCase();
      const description = video.description?.toLowerCase() || '';
      
      let difficultyScore = 1;
      
      if (title.includes('advanced') || title.includes('master') || title.includes('expert') ||
          video.durationSeconds > 1800) {
        difficultyScore = 3;
      } else if (title.includes('intermediate') || title.includes('tutorial') ||
                 video.durationSeconds > 900) {
        difficultyScore = 2;
      }
      
      categorizedVideos.push({
        ...video,
        difficultyScore,
        difficultyReasoning: "Basic keyword analysis"
      });
    }
  }

  // Sort by relevance first, then by difficulty for proper progression
  const sortedVideos = categorizedVideos.sort((a, b) => {
    if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.2) {
      return b.relevanceScore - a.relevanceScore;
    }
    return a.difficultyScore - b.difficultyScore;
  });

  // Log difficulty categorization
  console.log("Video difficulty analysis:");
  sortedVideos.forEach(video => {
    console.log(`"${video.title}": difficulty ${video.difficultyScore}, relevance ${video.relevanceScore}`);
  });

  // Select videos with proper difficulty progression
  const selectedVideos = [];
  
  // Find best beginner video (difficulty 1)
  const beginnerVideo = sortedVideos.find(v => v.difficultyScore === 1) || sortedVideos[0];
  selectedVideos.push(beginnerVideo);
  console.log(`Selected beginner: "${beginnerVideo.title}" (difficulty ${beginnerVideo.difficultyScore}) relevance: ${beginnerVideo.relevanceScore}`);
  
  // Find best intermediate video (difficulty 2, different from beginner)
  const intermediateVideo = sortedVideos.find(v => 
    v.difficultyScore === 2 && v.id !== beginnerVideo.id
  ) || sortedVideos.find(v => v.id !== beginnerVideo.id) || sortedVideos[1];
  if (intermediateVideo) {
    selectedVideos.push(intermediateVideo);
    console.log(`Selected intermediate: "${intermediateVideo.title}" (difficulty ${intermediateVideo.difficultyScore}) relevance: ${intermediateVideo.relevanceScore}`);
  }
  
  // Find best advanced video (difficulty 3, different from others)
  const advancedVideo = sortedVideos.find(v => 
    v.difficultyScore === 3 && 
    v.id !== beginnerVideo.id && 
    v.id !== intermediateVideo?.id
  ) || sortedVideos.find(v => 
    v.id !== beginnerVideo.id && v.id !== intermediateVideo?.id
  ) || sortedVideos[2];
  if (advancedVideo) {
    selectedVideos.push(advancedVideo);
    console.log(`Selected advanced: "${advancedVideo.title}" (difficulty ${advancedVideo.difficultyScore}) relevance: ${advancedVideo.relevanceScore}`);
  }

  // Fill remaining slots with unique videos if needed
  while (selectedVideos.length < 3 && selectedVideos.length < uniqueVideos.length) {
    for (const video of sortedVideos) {
      if (!selectedVideos.find(selected => selected.id === video.id)) {
        selectedVideos.push(video);
        break;
      }
    }
  }

  return selectedVideos.slice(0, 3);
}

// Generate learning path with 3 sequential videos
async function generateLearningPath(videos: YouTubeVideo[], query: string) {
  if (videos.length === 0) {
    throw new Error("No videos found for this topic");
  }

  // Use optimized learning progression (no duplicates)
  const optimizedVideos = await optimizeLearningPath(videos, query);

  // Assign appropriate levels and enhance descriptions
  const levels = ["beginner", "intermediate", "advanced"];
  const levelDescriptions = [
    `Perfect introduction to ${query} fundamentals`,
    `Building on ${query} basics with deeper concepts`,
    `Advanced ${query} topics and comprehensive understanding`
  ];

  const finalVideos = optimizedVideos.map((video: any, index: number) => {
    console.log(`Mapping video "${video.title}" with relevance: ${video.relevanceScore}, difficulty: ${video.difficultyScore}`);
    return {
      youtubeId: video.id,
      title: video.title,
      description: `${levelDescriptions[index]}. ${video.description?.substring(0, 200) || 'Educational content'}...`,
      channelName: video.channelName,
      duration: video.durationSeconds || 0,
      thumbnailUrl: video.thumbnailUrl,
      level: levels[index],
      topic: query,
      relevanceScore: Math.round((video.relevanceScore || 0) * 100), // Convert 0-1 to 0-100
      difficultyScore: video.difficultyScore || 1,
    };
  });
  
  console.log("Final mapped videos with scores:", finalVideos.map(v => ({ 
    title: v.title, 
    relevanceScore: v.relevanceScore, 
    difficultyScore: v.difficultyScore 
  })));
  
  return finalVideos;
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
