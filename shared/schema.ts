import { pgTable, text, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  youtubeId: varchar("youtube_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  channelName: varchar("channel_name", { length: 255 }),
  duration: integer("duration"), // in seconds
  thumbnailUrl: text("thumbnail_url"),
  level: varchar("level", { length: 50 }), // "beginner", "intermediate", "advanced"
  topic: text("topic"),
  relevanceScore: integer("relevance_score"), // 0-100 for display (0.0-1.0 * 100)
  difficultyScore: integer("difficulty_score"), // 1-3 (beginner, intermediate, advanced)
  publishedAt: text("published_at"), // ISO 8601 date string
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;

// YouTube API response types
export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelName: string;
  duration: string; // ISO 8601 duration format
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds?: number;
  relevanceScore?: number;
  relevanceReasoning?: string;
  viewCount?: number;
  recencyScore?: number;
}

// Analytics tables
export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  query: text("query").notNull(),
  resultsCount: integer("results_count").notNull(),
  processingTimeMs: integer("processing_time_ms"),
  apiKeyUsed: integer("api_key_used").notNull(),
  quotaConsumed: integer("quota_consumed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videoRetrievals = pgTable("video_retrievals", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").references(() => searches.id),
  youtubeId: varchar("youtube_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  channelName: varchar("channel_name", { length: 255 }),
  duration: integer("duration"),
  level: varchar("level", { length: 50 }).notNull(), // "level 1", "level 2", "level 3"
  relevanceScore: integer("relevance_score"),
  difficultyScore: integer("difficulty_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format in Pacific time
  apiKeyIndex: integer("api_key_index").notNull(),
  searchCalls: integer("search_calls").default(0).notNull(),
  detailCalls: integer("detail_calls").default(0).notNull(),
  totalUnits: integer("total_units").default(0).notNull(),
  successfulCalls: integer("successful_calls").default(0).notNull(),
  failedCalls: integer("failed_calls").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for analytics tables
export const insertSearchSchema = createInsertSchema(searches).omit({
  id: true,
  createdAt: true,
});

export const insertVideoRetrievalSchema = createInsertSchema(videoRetrievals).omit({
  id: true,
  createdAt: true,
});

export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({
  id: true,
  updatedAt: true,
});

// Types for analytics
export type InsertSearch = z.infer<typeof insertSearchSchema>;
export type Search = typeof searches.$inferSelect;
export type InsertVideoRetrieval = z.infer<typeof insertVideoRetrievalSchema>;
export type VideoRetrieval = typeof videoRetrievals.$inferSelect;
export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;
export type ApiUsage = typeof apiUsage.$inferSelect;

export interface VideoSearchResult {
  videos: Video[];
  query: string;
}
