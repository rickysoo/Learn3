import fs from 'fs';
import path from 'path';

interface QuotaUsage {
  date: string;
  keyIndex: number;
  searchCalls: number;
  detailCalls: number;
  totalUnits: number;
}

interface DailyQuotaData {
  [date: string]: {
    [keyIndex: string]: {
      searchCalls: number;
      detailCalls: number;
      totalUnits: number;
    };
  };
}

const QUOTA_FILE_PATH = path.join(process.cwd(), 'quota-usage.json');

class QuotaTracker {
  private data: DailyQuotaData = {};

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    try {
      if (fs.existsSync(QUOTA_FILE_PATH)) {
        const fileContent = fs.readFileSync(QUOTA_FILE_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Error loading quota data:', error);
      this.data = {};
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(QUOTA_FILE_PATH, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving quota data:', error);
    }
  }

  private getToday(): string {
    // Get current time in Pacific timezone
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    return pacificTime.toISOString().split('T')[0]; // YYYY-MM-DD format in Pacific time
  }

  private ensureKeyExists(date: string, keyIndex: number): void {
    if (!this.data[date]) {
      this.data[date] = {};
    }
    if (!this.data[date][keyIndex]) {
      this.data[date][keyIndex] = {
        searchCalls: 0,
        detailCalls: 0,
        totalUnits: 0
      };
    }
  }

  trackSearchCall(keyIndex: number): void {
    const today = this.getToday();
    this.ensureKeyExists(today, keyIndex);
    
    this.data[today][keyIndex].searchCalls += 1;
    this.data[today][keyIndex].totalUnits += 100; // Search API costs 100 units
    
    console.log(`[Quota] Search call tracked for key ${keyIndex + 1}: ${this.data[today][keyIndex].totalUnits} units used today`);
    this.saveData();
  }

  trackDetailCall(keyIndex: number, videoCount: number): void {
    const today = this.getToday();
    this.ensureKeyExists(today, keyIndex);
    
    this.data[today][keyIndex].detailCalls += 1;
    this.data[today][keyIndex].totalUnits += videoCount; // Video details cost 1 unit per video
    
    console.log(`[Quota] Detail call tracked for key ${keyIndex + 1}: ${this.data[today][keyIndex].totalUnits} units used today`);
    this.saveData();
  }

  getTodayUsage(): { totalUnits: number; byKey: Array<{ keyIndex: number; units: number; calls: number }>; currentDate: string; timezone: string } {
    const today = this.getToday();
    const todayData = this.data[today] || {};
    
    let totalUnits = 0;
    const byKey = [];
    
    for (let i = 0; i < 4; i++) { // Assuming 4 API keys
      const keyData = todayData[i] || { searchCalls: 0, detailCalls: 0, totalUnits: 0 };
      totalUnits += keyData.totalUnits;
      byKey.push({
        keyIndex: i,
        units: keyData.totalUnits,
        calls: keyData.searchCalls + keyData.detailCalls
      });
    }
    
    return { 
      totalUnits, 
      byKey, 
      currentDate: today,
      timezone: "Pacific Time" 
    };
  }

  getUsageForDate(date: string): any {
    return this.data[date] || {};
  }

  cleanupOldData(): void {
    // Keep only last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    Object.keys(this.data).forEach(date => {
      if (date < cutoffDate) {
        delete this.data[date];
      }
    });
    
    this.saveData();
  }
}

export const quotaTracker = new QuotaTracker();

// Clean up old data once per day
setInterval(() => {
  quotaTracker.cleanupOldData();
}, 24 * 60 * 60 * 1000); // 24 hours