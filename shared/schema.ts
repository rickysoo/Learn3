import { pgTable, text, serial, integer, varchar } from "drizzle-orm/pg-core";
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
}

export interface VideoSearchResult {
  videos: Video[];
  query: string;
}
