import { storage } from "./storage";
import { db } from "./db";
import { nanoid } from "nanoid";
import { desc } from "drizzle-orm";
import { searches as searchesTable, type InsertSearch, type InsertVideoRetrieval, type InsertApiUsage, type Video } from "@shared/schema";

// Generate a unique session ID for tracking user sessions
export function generateSessionId(): string {
  return nanoid(12);
}

// Get Pacific timezone date string
function getPacificDate(): string {
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pacificTime.toISOString().split('T')[0];
}

export class AnalyticsService {
  async recordSearchAnalytics(
    sessionId: string,
    query: string,
    videos: any[],
    processingTime: number,
    apiKeyUsed: number,
    quotaConsumed: number
  ) {
    try {
      // Record the search
      const searchData: InsertSearch = {
        sessionId,
        query,
        resultsCount: videos.length,
        processingTimeMs: processingTime,
        apiKeyUsed,
        quotaConsumed
      };
      
      const search = await storage.recordSearch(searchData);
      
      // Record video retrievals
      if (videos.length > 0) {
        const videoRetrievals: InsertVideoRetrieval[] = videos.map(video => ({
          searchId: search.id,
          youtubeId: video.youtubeId,
          title: video.title,
          channelName: video.channelName,
          duration: video.duration,
          level: video.level,
          relevanceScore: video.relevanceScore,
          difficultyScore: video.difficultyScore
        }));
        
        await storage.recordVideoRetrievals(videoRetrievals);
      }
      
      console.log(`[Analytics] Recorded search for "${query}" with ${videos.length} results`);
      return search;
    } catch (error) {
      console.error('[Analytics] Error recording search analytics:', error);
    }
  }

  async updateApiUsageAnalytics(
    apiKeyIndex: number,
    searchCalls: number = 0,
    detailCalls: number = 0,
    successful: boolean = true
  ) {
    try {
      const date = getPacificDate();
      const totalUnits = (searchCalls * 100) + (detailCalls * 1);
      
      // Get existing usage for this key/date
      const existingUsage = await storage.getApiUsageByDate(date);
      const keyUsage = existingUsage.find(usage => usage.apiKeyIndex === apiKeyIndex);
      
      const usageData: InsertApiUsage = {
        date,
        apiKeyIndex,
        searchCalls: (keyUsage?.searchCalls || 0) + searchCalls,
        detailCalls: (keyUsage?.detailCalls || 0) + detailCalls,
        totalUnits: (keyUsage?.totalUnits || 0) + totalUnits,
        successfulCalls: (keyUsage?.successfulCalls || 0) + (successful ? 1 : 0),
        failedCalls: (keyUsage?.failedCalls || 0) + (successful ? 0 : 1)
      };
      
      await storage.updateApiUsage(usageData);
      console.log(`[Analytics] Updated API usage for key ${apiKeyIndex}: +${totalUnits} units`);
    } catch (error) {
      console.error('[Analytics] Error updating API usage analytics:', error);
    }
  }

  async getSearchAnalytics(limit: number = 100) {
    try {
      // Get recent searches with details
      const searches = await db
        .select({
          id: searchesTable.id,
          sessionId: searchesTable.sessionId,
          query: searchesTable.query,
          videoCount: searchesTable.resultsCount,
          processingTime: searchesTable.processingTimeMs,
          apiKeyUsed: searchesTable.apiKeyUsed,
          quotaConsumed: searchesTable.quotaConsumed,
          createdAt: searchesTable.createdAt,
        })
        .from(searchesTable)
        .orderBy(desc(searchesTable.createdAt))
        .limit(limit);

      // Calculate summary statistics
      const totalSearches = searches.length;
      const uniqueSessions = new Set(searches.map((s: any) => s.sessionId)).size;
      const avgProcessingTime = searches.reduce((sum: number, s: any) => sum + (s.processingTime || 0), 0) / totalSearches || 0;
      const totalQuotaUsed = searches.reduce((sum: number, s: any) => sum + s.quotaConsumed, 0);

      // Get popular topics (group by similar queries)
      const topicCounts = searches.reduce((acc: Record<string, number>, search: any) => {
        const topic = search.query.toLowerCase();
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const popularTopics = Object.entries(topicCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      return {
        searches: searches.map((search: any) => ({
          ...search,
          createdAt: search.createdAt.toISOString(),
        })),
        summary: {
          totalSearches,
          uniqueSessions,
          avgProcessingTime,
          totalQuotaUsed,
          popularTopics,
        }
      };
    } catch (error) {
      console.error('[Analytics] Error fetching search analytics:', error);
      throw new Error("Failed to fetch analytics data");
    }
  }
}

export const analyticsService = new AnalyticsService();