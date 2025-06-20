import { videos, searches, videoRetrievals, apiUsage, bookmarks,
         type Video, type InsertVideo, type Search, type InsertSearch,
         type VideoRetrieval, type InsertVideoRetrieval, type ApiUsage, type InsertApiUsage,
         type Bookmark, type InsertBookmark } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getVideosByTopic(topic: string): Promise<Video[]>;
  getVideoById(videoId: number): Promise<Video | null>;
  getVideoByYouTubeId(youtubeId: string): Promise<Video | null>;
  saveVideos(videos: InsertVideo[]): Promise<Video[]>;
  clearVideosByTopic(topic: string): Promise<void>;
  
  // Analytics methods
  recordSearch(search: InsertSearch): Promise<Search>;
  recordVideoRetrievals(retrievals: InsertVideoRetrieval[]): Promise<VideoRetrieval[]>;
  updateApiUsage(usage: InsertApiUsage): Promise<void>;
  getApiUsageByDate(date: string): Promise<ApiUsage[]>;
  
  // Bookmark methods
  saveBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  getUserBookmarks(userId: string): Promise<Bookmark[]>;
  deleteBookmark(bookmarkId: number, userId: string): Promise<void>;
  getBookmarkByUserAndQuery(userId: string, query: string): Promise<Bookmark | null>;
  getBookmarkById(bookmarkId: number): Promise<Bookmark | null>;
}

export class DatabaseStorage implements IStorage {
  async getVideosByTopic(topic: string): Promise<Video[]> {
    return await db.select().from(videos).where(eq(videos.topic, topic));
  }

  async getVideoById(videoId: number): Promise<Video | null> {
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    return video || null;
  }

  async getVideoByYouTubeId(youtubeId: string): Promise<Video | null> {
    const [video] = await db.select().from(videos).where(eq(videos.youtubeId, youtubeId));
    return video || null;
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

  // Bookmark methods
  async saveBookmark(bookmark: InsertBookmark): Promise<Bookmark> {
    const [savedBookmark] = await db.insert(bookmarks).values(bookmark).returning();
    return savedBookmark;
  }

  async getUserBookmarks(userId: string): Promise<Bookmark[]> {
    return await db.select().from(bookmarks).where(eq(bookmarks.userId, userId)).orderBy(desc(bookmarks.createdAt));
  }

  async deleteBookmark(bookmarkId: number, userId: string): Promise<void> {
    await db.delete(bookmarks).where(
      and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId))
    );
  }

  async getBookmarkByUserAndQuery(userId: string, query: string): Promise<Bookmark | null> {
    const [bookmark] = await db.select().from(bookmarks).where(
      and(eq(bookmarks.userId, userId), eq(bookmarks.searchQuery, query))
    );
    return bookmark || null;
  }

  async getBookmarkById(bookmarkId: number): Promise<Bookmark | null> {
    const [bookmark] = await db.select().from(bookmarks).where(eq(bookmarks.id, bookmarkId));
    return bookmark || null;
  }
}

export const storage = new DatabaseStorage();
