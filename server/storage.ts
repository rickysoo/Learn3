import { videos, type Video, type InsertVideo } from "@shared/schema";

export interface IStorage {
  getVideosByTopic(topic: string): Promise<Video[]>;
  saveVideos(videos: InsertVideo[]): Promise<Video[]>;
  clearVideosByTopic(topic: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private videos: Map<number, Video>;
  private currentId: number;

  constructor() {
    this.videos = new Map();
    this.currentId = 1;
  }

  async getVideosByTopic(topic: string): Promise<Video[]> {
    return Array.from(this.videos.values()).filter(
      (video) => video.topic?.toLowerCase() === topic.toLowerCase()
    );
  }

  async saveVideos(insertVideos: InsertVideo[]): Promise<Video[]> {
    const savedVideos: Video[] = [];
    
    for (const insertVideo of insertVideos) {
      const id = this.currentId++;
      const video: Video = { ...insertVideo, id };
      this.videos.set(id, video);
      savedVideos.push(video);
    }
    
    return savedVideos;
  }

  async clearVideosByTopic(topic: string): Promise<void> {
    const videosToDelete = Array.from(this.videos.entries()).filter(
      ([_, video]) => video.topic?.toLowerCase() === topic.toLowerCase()
    );
    
    for (const [id] of videosToDelete) {
      this.videos.delete(id);
    }
  }
}

export const storage = new MemStorage();
