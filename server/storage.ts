import { videos, searches, videoRetrievals, apiUsage, 
         type Video, type InsertVideo, type Search, type InsertSearch,
         type VideoRetrieval, type InsertVideoRetrieval, type ApiUsage, type InsertApiUsage } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getVideosByTopic(topic: string): Promise<Video[]>;
  saveVideos(videos: InsertVideo[]): Promise<Video[]>;
  clearVideosByTopic(topic: string): Promise<void>;
  
  // Analytics methods
  recordSearch(search: InsertSearch): Promise<Search>;
  recordVideoRetrievals(retrievals: InsertVideoRetrieval[]): Promise<VideoRetrieval[]>;
  updateApiUsage(usage: InsertApiUsage): Promise<void>;
  getApiUsageByDate(date: string): Promise<ApiUsage[]>;
}

export class DatabaseStorage implements IStorage {
  async getVideosByTopic(topic: string): Promise<Video[]> {
    return await db.select().from(videos).where(eq(videos.topic, topic));
  }

  async saveVideos(insertVideos: InsertVideo[]): Promise<Video[]> {
    return await db.insert(videos).values(insertVideos).returning();
  }

  async clearVideosByTopic(topic: string): Promise<void> {
    await db.delete(videos).where(eq(videos.topic, topic));
  }

  async recordSearch(search: InsertSearch): Promise<Search> {
    const [result] = await db.insert(searches).values(search).returning();
    return result;
  }

  async recordVideoRetrievals(retrievals: InsertVideoRetrieval[]): Promise<VideoRetrieval[]> {
    if (retrievals.length === 0) return [];
    return await db.insert(videoRetrievals).values(retrievals).returning();
  }

  async updateApiUsage(usage: InsertApiUsage): Promise<void> {
    const existing = await db.select().from(apiUsage)
      .where(and(
        eq(apiUsage.date, usage.date),
        eq(apiUsage.apiKeyIndex, usage.apiKeyIndex)
      ));

    if (existing.length > 0) {
      await db.update(apiUsage)
        .set({
          searchCalls: usage.searchCalls,
          detailCalls: usage.detailCalls,
          totalUnits: usage.totalUnits,
          successfulCalls: usage.successfulCalls,
          failedCalls: usage.failedCalls,
          updatedAt: new Date()
        })
        .where(and(
          eq(apiUsage.date, usage.date),
          eq(apiUsage.apiKeyIndex, usage.apiKeyIndex)
        ));
    } else {
      await db.insert(apiUsage).values(usage);
    }
  }

  async getApiUsageByDate(date: string): Promise<ApiUsage[]> {
    return await db.select().from(apiUsage).where(eq(apiUsage.date, date));
  }
}

export const storage = new DatabaseStorage();
