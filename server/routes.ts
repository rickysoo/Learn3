import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { quotaTracker } from "./quotaTracker";
import { analyticsService, generateSessionId } from "./analytics";
import { generateRandomTopics } from "./topicGenerator";
import { db } from "./db";
import { searches as searchesTable, videoRetrievals as videoRetrievalsTable } from "@shared/schema";
import { eq, desc, sql, count, max, sum, avg } from "drizzle-orm";
import { z } from "zod";
import type { YouTubeVideo, VideoSearchResult } from "@shared/schema";
import OpenAI from "openai";

// YouTube API key rotation system
const YOUTUBE_API_KEYS = [
  process.env.YOUTUBE_API_KEY_1,
  process.env.YOUTUBE_API_KEY_2,
  process.env.YOUTUBE_API_KEY_3,
  process.env.YOUTUBE_API_KEY_4,
  process.env.YOUTUBE_API_KEY,
  process.env.VITE_YOUTUBE_API_KEY
].filter((key): key is string => Boolean(key));

let currentKeyIndex = 0;

// Simple in-memory cache to reduce API calls
const searchCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

function getNextYouTubeAPIKey(): { key: string; index: number } {
  if (YOUTUBE_API_KEYS.length === 0) {
    throw new Error("No YouTube API keys configured");
  }
  
  const key = YOUTUBE_API_KEYS[currentKeyIndex];
  if (!key) {
    throw new Error("Invalid YouTube API key at index " + currentKeyIndex);
  }
  
  currentKeyIndex = (currentKeyIndex + 1) % YOUTUBE_API_KEYS.length;
  
  console.log(`Using YouTube API key ${currentKeyIndex + 1}/${YOUTUBE_API_KEYS.length}`);
  return { key, index: currentKeyIndex };
}

function getCachedSearch(query: string): any | null {
  const cacheKey = query.toLowerCase().trim();
  const cached = searchCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Cache hit for "${query}" - skipping YouTube API calls`);
    return cached.data;
  }
  
  return null;
}

function setCachedSearch(query: string, data: any): void {
  const cacheKey = query.toLowerCase().trim();
  searchCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  // Keep cache size manageable
  if (searchCache.size > 100) {
    const iterator = searchCache.keys();
    const firstKey = iterator.next();
    if (!firstKey.done) {
      searchCache.delete(firstKey.value);
    }
  }
}

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
      model: "gpt-4o-mini",
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

// Calculate recency score based on video publish date
function calculateRecencyScore(publishedAt: string): number {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Videos published within 30 days get full score (1.0)
  // Videos older than 2 years get minimum score (0.1)
  if (daysDiff <= 30) return 1.0;
  if (daysDiff >= 730) return 0.1;
  
  // Linear decay between 30 days and 2 years
  return Math.max(0.1, 1.0 - (daysDiff - 30) / 700 * 0.9);
}

// Enhanced YouTube search with automatic API key failover
async function searchYouTubeVideos(query: string): Promise<{videos: YouTubeVideo[], apiKeyUsed: number, quotaConsumed: number}> {
  console.log(`Searching YouTube for: "${query}"`);

  // Check cache first to avoid API calls
  const cachedResult = getCachedSearch(query);
  if (cachedResult) {
    return { videos: cachedResult, apiKeyUsed: -1, quotaConsumed: 0 };
  }

  // Try each API key until one works or all fail
  const maxAttempts = YOUTUBE_API_KEYS.length;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const apiKeyInfo = getNextYouTubeAPIKey();
    const currentAPIKey = apiKeyInfo.key;
    const keyIndex = apiKeyInfo.index;
    
    try {
      // Single optimized search query to save API costs
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `key=${currentAPIKey}&` +
        `q=${encodeURIComponent(query)}&` +
        `part=snippet&` +
        `type=video&` +
        `maxResults=15&` +
        `order=relevance&` +
        `safeSearch=strict&` +
        `relevanceLanguage=en`;

      const searchResponse = await fetch(searchUrl);
      const responseText = await searchResponse.text();
      
      if (searchResponse.ok) {
        // Success! Parse and return results
        const searchData = JSON.parse(responseText);
        const allVideos = searchData.items || [];
        console.log(`YouTube returned ${allVideos.length} raw search results for "${query}"`);
        
        // Track quota usage for search call
        quotaTracker.trackSearchCall(keyIndex);
        
        // Continue with the rest of the function logic...
        const results = await processYouTubeResults(allVideos, currentAPIKey, keyIndex, query);
        
        // Cache the results for future queries
        setCachedSearch(query, results);
        
        // Calculate quota consumed: 1 search call (100 units) + video details (1 unit per video)
        const quotaConsumed = 100 + results.length;
        
        return { videos: results, apiKeyUsed: keyIndex, quotaConsumed };
      }
      
      // Handle quota exceeded - try next API key
      if (searchResponse.status === 403) {
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
            // Track quota usage even for failed calls due to quota exceeded
            quotaTracker.trackSearchCall(keyIndex);
            console.log(`API key ${attempt + 1}/${maxAttempts} quota exceeded, trying next key...`);
            continue; // Try next API key
          }
        } catch {
          // Error parsing response, treat as general error
        }
      }
      
      // For non-quota errors, throw immediately
      let errorMessage = "YouTube API is unavailable";
      let errorType = "API_ERROR";
      
      if (searchResponse.status === 403) {
        errorMessage = "YouTube API access denied. Please check your API key permissions.";
        errorType = "ACCESS_DENIED";
      } else if (searchResponse.status === 400) {
        errorMessage = "YouTube API key is invalid or expired. Please provide a valid API key.";
        errorType = "INVALID_KEY";
      }
      
      throw new Error(`${errorType}: ${errorMessage}`);
      
    } catch (error) {
      // If it's a non-HTTP error, try next key for quota issues
      if (attempt < maxAttempts - 1) {
        console.log(`API key ${attempt + 1} failed, trying next key...`);
        continue;
      }
      throw error; // Re-throw on last attempt
    }
  }
  
  // All API keys failed due to quota limits
  throw new Error("DAILY_LIMIT_REACHED: All API keys have reached their daily quota limit. Please try again tomorrow when quotas reset.");
}

// Process YouTube API results with the successful API key
async function processYouTubeResults(allVideos: any[], apiKey: string, keyIndex: number, query: string): Promise<YouTubeVideo[]> {
  // Remove duplicates
  const uniqueResults = allVideos.filter((video: any, index: number, self: any[]) => 
    index === self.findIndex((v: any) => v.id.videoId === video.id.videoId)
  );
  
  console.log(`After deduplication: ${uniqueResults.length} unique videos`);

  if (uniqueResults.length === 0) {
    throw new Error(`No videos found for topic: ${query}`);
  }

  const videoIds = uniqueResults.slice(0, 15).map((item: any) => item.id.videoId).join(",");
  console.log(`Fetching details for ${Math.min(15, uniqueResults.length)} videos`);

  // Get video details including duration (use same API key for consistency)
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
    `key=${apiKey}&` +
    `id=${videoIds}&` +
    `part=snippet,contentDetails,statistics`;

  const detailsResponse = await fetch(detailsUrl);
  const detailsResponseText = await detailsResponse.text();
  
  if (!detailsResponse.ok) {
    console.error(`YouTube API details error:`, detailsResponse.status, detailsResponseText);
    throw new Error(`YouTube API details failed: ${detailsResponse.statusText}`);
  }

  const detailsData = JSON.parse(detailsResponseText);
  
  // Track quota usage for video details call
  quotaTracker.trackDetailCall(keyIndex, uniqueResults.length);
  
  // Process videos and filter by duration
  const allProcessedVideos = detailsData.items
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
        recencyScore: calculateRecencyScore(item.snippet.publishedAt),
      };
    });
    
  console.log(`Processed ${allProcessedVideos.length} videos with duration data`);
  
  const processedVideos = allProcessedVideos.filter((video: any) => 
    video.durationSeconds >= 120 && video.durationSeconds <= 3600 // 2-60 minutes
  );
  
  console.log(`After duration filtering (2-60 min): ${processedVideos.length} videos remaining`);

  // AI-powered relevance filtering for maximum accuracy
  const scoredVideos = [];
  
  if (OPENAI_API_KEY && processedVideos.length > 0) {
    try {
      // Batch process videos with AI for faster processing
      const batchSize = 12; // Process more videos for better selection
      const videosToProcess = processedVideos.slice(0, batchSize);
      
      const videoDescriptions = videosToProcess.map((video: any, i: number) => 
        `${i + 1}. Title: "${video.title}"\nDescription: "${video.description?.substring(0, 200) || 'No description'}"\n`
      ).join('\n');

      console.log(`AI scoring videos for topic: "${query}"`);
      console.log("Video titles being scored:", videosToProcess.map((v: any) => v.title));

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", 
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

  // Use strict threshold - only highly relevant videos with recency consideration
  let relevantVideos = scoredVideos
    .filter(video => video.relevanceScore >= 0.8)
    .sort((a, b) => {
      // Calculate composite score: relevance (60%) + recency (25%) + views (15%)
      const scoreA = (a.relevanceScore * 0.6) + (a.recencyScore * 0.25) + (Math.min(a.viewCount / 1000000, 1) * 0.15);
      const scoreB = (b.relevanceScore * 0.6) + (b.recencyScore * 0.25) + (Math.min(b.viewCount / 1000000, 1) * 0.15);
      
      if (Math.abs(scoreA - scoreB) > 0.05) {
        return scoreB - scoreA;
      }
      return b.recencyScore - a.recencyScore; // Prefer more recent as tiebreaker
    });

  console.log(`High relevance videos (>=0.8): ${relevantVideos.length}`);

  // If not enough high-quality videos, use medium threshold with recency
  if (relevantVideos.length < 3) {
    relevantVideos = scoredVideos
      .filter(video => video.relevanceScore >= 0.6)
      .sort((a, b) => {
        // Calculate composite score: relevance (60%) + recency (25%) + views (15%)
        const scoreA = (a.relevanceScore * 0.6) + (a.recencyScore * 0.25) + (Math.min(a.viewCount / 1000000, 1) * 0.15);
        const scoreB = (b.relevanceScore * 0.6) + (b.recencyScore * 0.25) + (Math.min(b.viewCount / 1000000, 1) * 0.15);
        
        if (Math.abs(scoreA - scoreB) > 0.05) {
          return scoreB - scoreA;
        }
        return b.recencyScore - a.recencyScore; // Prefer more recent as tiebreaker
      });
    console.log(`Medium relevance videos (>=0.6): ${relevantVideos.length}`);
  }

  // Final fallback - return the best available videos regardless of score
  if (relevantVideos.length < 3) {
    relevantVideos = scoredVideos
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, Math.max(3, Math.min(8, scoredVideos.length)));
    console.log(`Using best available videos: ${relevantVideos.length}`);
  }

  return relevantVideos.slice(0, 8);
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
  const deduplicatedVideos = videos.filter((video, index, self) => 
    index === self.findIndex(v => v.id === video.id)
  );

  // AI-powered difficulty analysis for better categorization
  const categorizedVideos = [];
  
  if (OPENAI_API_KEY && deduplicatedVideos.length > 0) {
    try {
      const videoDescriptions = deduplicatedVideos.map((video, i) => 
        `${i + 1}. Title: "${video.title}"\nDescription: "${video.description?.substring(0, 300) || 'No description'}"\nDuration: ${Math.floor(video.durationSeconds / 60)} minutes\nChannel: "${video.channelName}"\n`
      ).join('\n');

      console.log(`AI analyzing difficulty levels for topic: "${query}"`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", 
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
      
      for (let i = 0; i < deduplicatedVideos.length; i++) {
        const difficultyScore = Math.max(1, Math.min(3, difficulties[i] || 1));
        categorizedVideos.push({
          ...deduplicatedVideos[i],
          difficultyScore,
          difficultyReasoning: reasonings[i] || "AI difficulty analysis"
        });
        console.log(`Video "${deduplicatedVideos[i].title}" difficulty: ${difficultyScore}`);
      }
    } catch (error) {
      console.error("AI difficulty analysis failed:", error);
      // Fallback to enhanced keyword-based analysis
      for (const video of deduplicatedVideos) {
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
    for (const video of deduplicatedVideos) {
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

  // Select videos prioritizing difficulty diversity for proper progression
  const selectedVideos = [];
  const seenIds = new Set();
  
  // First pass: try to get one video from each difficulty level
  for (let targetDifficulty = 1; targetDifficulty <= 3; targetDifficulty++) {
    const videoAtLevel = sortedVideos.find(v => 
      v.difficultyScore === targetDifficulty && !seenIds.has(v.id)
    );
    if (videoAtLevel && selectedVideos.length < 3) {
      selectedVideos.push(videoAtLevel);
      seenIds.add(videoAtLevel.id);
    }
  }
  
  // Second pass: fill remaining slots with best available videos
  for (const video of sortedVideos) {
    if (!seenIds.has(video.id) && selectedVideos.length < 3) {
      selectedVideos.push(video);
      seenIds.add(video.id);
    }
  }
  
  // Sort by difficulty for proper progression (easiest to hardest)
  selectedVideos.sort((a, b) => a.difficultyScore - b.difficultyScore);
  
  console.log("Final video progression:");
  selectedVideos.forEach((video, index) => {
    const level = index === 0 ? "easiest" : index === 1 ? "medium" : "hardest";
    console.log(`${level}: "${video.title}" (difficulty ${video.difficultyScore}) relevance: ${video.relevanceScore}`);
  });

  return selectedVideos;
}

// Generate learning path with 3 sequential videos
async function generateLearningPath(videos: YouTubeVideo[], query: string) {
  if (videos.length === 0) {
    throw new Error("No videos found for this topic");
  }

  // Use optimized learning progression (no duplicates)
  const optimizedVideos = await optimizeLearningPath(videos, query);

  // Assign appropriate levels and enhance descriptions
  const levels = ["level 1", "level 2", "level 3"];
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
      publishedAt: video.publishedAt,
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
  // Quota usage endpoint for debugging
  app.get("/api/quota-usage", async (req, res) => {
    try {
      const usage = quotaTracker.getTodayUsage();
      res.json(usage);
    } catch (error) {
      console.error("Error fetching quota usage:", error);
      res.status(500).json({ error: "Failed to fetch quota usage" });
    }
  });

  // Endpoint to manually mark all keys as exhausted (for admin/debugging)
  app.post("/api/quota-exhausted", async (req, res) => {
    try {
      quotaTracker.markAllKeysExhausted();
      const usage = quotaTracker.getTodayUsage();
      res.json({ message: "All API keys marked as exhausted", usage });
    } catch (error) {
      console.error("Error marking keys as exhausted:", error);
      res.status(500).json({ error: "Failed to mark keys as exhausted" });
    }
  });

  // Analytics endpoint
  app.get("/api/analytics", async (req, res) => {
    try {
      const analytics = await analyticsService.getSearchAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Generate random topics using OpenAI
  app.get("/api/topics/random", async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 8;
      const topics = await generateRandomTopics(count);
      res.json({ topics });
    } catch (error) {
      console.error("Error generating random topics:", error);
      res.status(500).json({ error: "Failed to generate topics" });
    }
  });

  // Topics endpoint
  app.get("/api/admin/topics", async (req, res) => {
    try {
      const topics = await db
        .select()
        .from(searchesTable)
        .orderBy(desc(searchesTable.createdAt));
      
      // Group topics manually to avoid complex aggregation issues
      const topicStats = topics.reduce((acc: any, search: any) => {
        const topic = search.query.toLowerCase();
        if (!acc[topic]) {
          acc[topic] = {
            topic: search.query,
            count: 0,
            lastSearched: search.createdAt,
            totalQuota: 0,
            totalProcessingTime: 0
          };
        }
        acc[topic].count++;
        acc[topic].totalQuota += search.quotaConsumed || 0;
        acc[topic].totalProcessingTime += search.processingTimeMs || 0;
        if (search.createdAt > acc[topic].lastSearched) {
          acc[topic].lastSearched = search.createdAt;
        }
        return acc;
      }, {});

      const result = Object.values(topicStats)
        .map((topic: any) => ({
          topic: topic.topic,
          count: topic.count,
          lastSearched: topic.lastSearched.toISOString(),
          totalQuota: topic.totalQuota,
          avgProcessingTime: Math.round(topic.totalProcessingTime / topic.count)
        }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 50);
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  // Videos endpoint
  app.get("/api/admin/videos", async (req, res) => {
    try {
      const videos = await db
        .select({
          id: videoRetrievalsTable.id,
          youtubeId: videoRetrievalsTable.youtubeId,
          title: videoRetrievalsTable.title,
          channelName: videoRetrievalsTable.channelName,
          duration: videoRetrievalsTable.duration,
          level: videoRetrievalsTable.level,
          relevanceScore: videoRetrievalsTable.relevanceScore,
          difficultyScore: videoRetrievalsTable.difficultyScore,
          searchQuery: searchesTable.query,
          retrievedAt: videoRetrievalsTable.createdAt
        })
        .from(videoRetrievalsTable)
        .leftJoin(searchesTable, eq(videoRetrievalsTable.searchId, searchesTable.id))
        .orderBy(desc(videoRetrievalsTable.createdAt))
        .limit(100);
      
      res.json(videos.map((video: any) => ({
        ...video,
        retrievedAt: video.retrievedAt ? video.retrievedAt.toISOString() : null
      })));
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });

  // Search for videos
  app.post("/api/search", async (req, res) => {
    const startTime = Date.now();
    let sessionId: string = "";
    let apiKeyUsed = -1;
    let quotaConsumed = 0;
    
    try {
      const searchSchema = z.object({
        query: z.string().min(1, "Search query is required"),
        sessionId: z.string().optional(),
      });

      const { query, sessionId: providedSessionId } = searchSchema.parse(req.body);
      sessionId = providedSessionId || generateSessionId();

      // Search YouTube for videos
      const searchResult = await searchYouTubeVideos(query);
      apiKeyUsed = searchResult.apiKeyUsed;
      quotaConsumed = searchResult.quotaConsumed;
      
      // Generate learning path
      const learningPath = await generateLearningPath(searchResult.videos, query);
      
      // Clear previous videos for this topic and save new ones
      await storage.clearVideosByTopic(query);
      const savedVideos = await storage.saveVideos(learningPath);

      const processingTime = Date.now() - startTime;
      
      // Record analytics with deduplication (only if no duplicate within last minute)
      try {
        const recentSearches = await db
          .select()
          .from(searchesTable)
          .where(eq(searchesTable.query, query))
          .orderBy(desc(searchesTable.createdAt))
          .limit(1);
        
        const lastSearch = recentSearches[0];
        const isDuplicateWithinMinute = lastSearch && 
          (Date.now() - lastSearch.createdAt.getTime()) < 60000; // 1 minute
        
        if (!isDuplicateWithinMinute) {
          await analyticsService.recordSearchAnalytics(
            sessionId,
            query,
            savedVideos,
            processingTime,
            apiKeyUsed,
            quotaConsumed
          );
        }
      } catch (analyticsError) {
        console.error("Analytics recording error:", analyticsError);
        // Continue with response even if analytics fails
      }

      const result: VideoSearchResult = {
        videos: savedVideos,
        query,
      };

      res.json(result);
    } catch (error) {
      console.error("Search error:", error);
      
      // Record failed search analytics if we have session info
      if (sessionId && sessionId !== "") {
        const processingTime = Date.now() - startTime;
        await analyticsService.recordSearchAnalytics(
          sessionId,
          req.body?.query || "unknown",
          [],
          processingTime,
          apiKeyUsed,
          quotaConsumed
        );
      }
      
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

  // Bookmark endpoints
  app.post("/api/bookmarks", async (req, res) => {
    try {
      const bookmarkSchema = z.object({
        userId: z.string().min(1),
        userEmail: z.string().email(),
        userName: z.string().optional(),
        searchQuery: z.string().min(1),
        videoIds: z.array(z.string()),
      });

      const bookmarkData = bookmarkSchema.parse(req.body);
      
      // Check if bookmark already exists
      const existingBookmark = await storage.getBookmarkByUserAndQuery(
        bookmarkData.userId, 
        bookmarkData.searchQuery
      );
      
      if (existingBookmark) {
        return res.status(409).json({ message: "Bookmark already exists for this search" });
      }

      const bookmark = await storage.saveBookmark(bookmarkData);
      res.json(bookmark);
    } catch (error) {
      console.error("Bookmark creation error:", error);
      res.status(500).json({ message: "Failed to create bookmark" });
    }
  });

  app.get("/api/bookmarks/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const bookmarks = await storage.getUserBookmarks(userId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Fetch bookmarks error:", error);
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  // Get specific bookmark by ID
  app.get("/api/bookmark/:bookmarkId", async (req, res) => {
    try {
      const bookmarkId = parseInt(req.params.bookmarkId);
      const bookmark = await storage.getBookmarkById(bookmarkId);
      
      if (!bookmark) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      
      res.json(bookmark);
    } catch (error) {
      console.error("Fetch bookmark error:", error);
      res.status(500).json({ message: "Failed to fetch bookmark" });
    }
  });

  // Get video by YouTube ID (more specific route first)
  app.get("/api/videos/youtube/:youtubeId", async (req, res) => {
    try {
      const { youtubeId } = req.params;
      const video = await storage.getVideoByYouTubeId(youtubeId);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.json(video);
    } catch (error) {
      console.error("Fetch video by YouTube ID error:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  // Get video by ID
  app.get("/api/videos/:videoId", async (req, res) => {
    try {
      const videoId = parseInt(req.params.videoId);
      const video = await storage.getVideoById(videoId);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.json(video);
    } catch (error) {
      console.error("Fetch video error:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.delete("/api/bookmarks/:bookmarkId", async (req, res) => {
    try {
      const bookmarkId = parseInt(req.params.bookmarkId);
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      await storage.deleteBookmark(bookmarkId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete bookmark error:", error);
      res.status(500).json({ message: "Failed to delete bookmark" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
