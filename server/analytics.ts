import { storage } from "./storage";
import { nanoid } from "nanoid";
import type { InsertSearch, InsertVideoRetrieval, InsertApiUsage } from "@shared/schema";

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
      // Note: This would require additional database queries to implement fully
      // For now, return a simple structure
      return {
        message: "Search analytics would be implemented with JOIN queries",
        note: "Database tables are ready for comprehensive analytics queries"
      };
    } catch (error) {
      console.error('[Analytics] Error fetching search analytics:', error);
      return null;
    }
  }
}

export const analyticsService = new AnalyticsService();