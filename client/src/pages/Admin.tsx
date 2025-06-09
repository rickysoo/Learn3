import { useState, useEffect } from "react";
import { QuotaDebugger } from "@/components/QuotaDebugger";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Activity, BarChart3 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

interface QuotaData {
  totalUnits: number;
  byKey: Array<{
    keyIndex: number;
    units: number;
    calls: number;
  }>;
  currentDate: string;
  timezone: string;
}

interface AnalyticsData {
  searches: Array<{
    id: number;
    sessionId: string;
    query: string;
    videoCount: number;
    processingTime: number;
    apiKeyUsed: number;
    quotaConsumed: number;
    createdAt: string;
  }>;
  summary: {
    totalSearches: number;
    uniqueSessions: number;
    avgProcessingTime: number;
    totalQuotaUsed: number;
    popularTopics: Array<{ topic: string; count: number }>;
  };
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState("quota");
  const [currentTime, setCurrentTime] = useState(new Date());
  const queryClient = useQueryClient();

  // Update Pacific time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: quotaData, isLoading: quotaLoading, refetch: refetchQuota } = useQuery<QuotaData>({
    queryKey: ["/api/quota-usage"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: topicsData, isLoading: topicsLoading, refetch: refetchTopics } = useQuery({
    queryKey: ["/api/admin/topics"],
    refetchInterval: 30000,
  });

  const { data: videosData, isLoading: videosLoading, refetch: refetchVideos } = useQuery({
    queryKey: ["/api/admin/videos"],
    refetchInterval: 30000,
  });

  const handleRefreshQuota = () => {
    refetchQuota();
  };

  const handleRefreshAnalytics = () => {
    refetchAnalytics();
  };

  const handleRefreshTopics = () => {
    refetchTopics();
  };

  const handleRefreshVideos = () => {
    refetchVideos();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPacificTime = () => {
    return currentTime.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">
              System monitoring and analytics for Learn3
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">
              Back to App
            </Button>
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quota" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              API Quota
            </TabsTrigger>
            <TabsTrigger value="searches" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Searches
            </TabsTrigger>
            <TabsTrigger value="topics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Topics
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Videos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quota" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>API Quota Usage</CardTitle>
                  <CardDescription>
                    Real-time monitoring of YouTube API quota consumption
                  </CardDescription>
                </div>
                <Button
                  onClick={handleRefreshQuota}
                  disabled={quotaLoading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${quotaLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {quotaLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading quota data...</p>
                  </div>
                ) : quotaData ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-900">
                          {quotaData.totalUnits.toLocaleString()}
                        </div>
                        <div className="text-sm text-blue-600">Total Units Used</div>
                        <div className="text-xs text-blue-500 mt-1">
                          of 40,000 daily limit
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-900">
                          {quotaData.byKey.length}
                        </div>
                        <div className="text-sm text-green-600">Active API Keys</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-900">
                          {((quotaData.totalUnits / 40000) * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-purple-600">Quota Used</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-gray-900">
                          {getPacificTime()}
                        </div>
                        <div className="text-sm text-gray-600">Current Time (Pacific)</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Usage by API Key</h4>
                      {quotaData.byKey.map((key) => (
                        <div key={key.keyIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">API Key {key.keyIndex + 1}</span>
                          <div className="text-right">
                            <div className="font-bold">{key.units} units</div>
                            <div className="text-sm text-gray-600">{key.calls} calls</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No quota data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="searches" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Search Analytics</CardTitle>
                  <CardDescription>
                    User behavior and system performance insights
                  </CardDescription>
                </div>
                <Button
                  onClick={handleRefreshAnalytics}
                  disabled={analyticsLoading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading analytics data...</p>
                  </div>
                ) : analyticsData ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-900">
                          {analyticsData.summary.totalSearches}
                        </div>
                        <div className="text-sm text-blue-600">Total Searches</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-900">
                          {analyticsData.summary.uniqueSessions}
                        </div>
                        <div className="text-sm text-green-600">Unique Sessions</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-900">
                          {formatDuration(analyticsData.summary.avgProcessingTime)}
                        </div>
                        <div className="text-sm text-purple-600">Avg Processing</div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-orange-900">
                          {analyticsData.summary.totalQuotaUsed}
                        </div>
                        <div className="text-sm text-orange-600">Quota Consumed</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Recent Search History</h4>
                      <div className="space-y-2">
                        {analyticsData.searches.slice(0, 10).map((search) => (
                          <div
                            key={search.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-white"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{search.query}</div>
                              <div className="text-sm text-gray-500">
                                Session: {search.sessionId.slice(0, 8)}... • {formatTime(search.createdAt)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {search.videoCount} videos
                              </span>
                              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                {formatDuration(search.processingTime)}
                              </span>
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                {search.quotaConsumed} quota
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {analyticsData.summary.popularTopics.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Popular Topics</h4>
                        <div className="grid gap-2 md:grid-cols-2">
                          {analyticsData.summary.popularTopics.slice(0, 6).map((topic, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="font-medium capitalize">{topic.topic}</span>
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                {topic.count} searches
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No analytics data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topics" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Search Topics</CardTitle>
                  <CardDescription>
                    Popular search topics and their performance metrics
                  </CardDescription>
                </div>
                <Button
                  onClick={handleRefreshTopics}
                  disabled={topicsLoading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${topicsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {topicsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading topics data...</p>
                  </div>
                ) : topicsData ? (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      {topicsData.map((topic: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-lg">{topic.topic}</div>
                            <div className="text-sm text-gray-500">
                              Last searched: {formatTime(topic.lastSearched)}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <div className="font-bold text-blue-600">{topic.count}</div>
                              <div className="text-gray-500">searches</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-green-600">{topic.totalQuota}</div>
                              <div className="text-gray-500">quota used</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-purple-600">{formatDuration(topic.avgProcessingTime)}</div>
                              <div className="text-gray-500">avg time</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No topics data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="videos" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Retrieved Videos</CardTitle>
                  <CardDescription>
                    Videos retrieved and analyzed by the system
                  </CardDescription>
                </div>
                <Button
                  onClick={handleRefreshVideos}
                  disabled={videosLoading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${videosLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {videosLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading videos data...</p>
                  </div>
                ) : videosData ? (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      {videosData.slice(0, 20).map((video: any) => (
                        <div
                          key={video.id}
                          className="flex items-start justify-between p-4 border rounded-lg bg-white hover:bg-gray-50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-base mb-1 line-clamp-2">{video.title}</div>
                            <div className="text-sm text-gray-600 mb-2">{video.channelName}</div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Query: {video.searchQuery}</span>
                              <span>Retrieved: {formatTime(video.retrievedAt)}</span>
                              {video.duration && <span>Duration: {Math.floor(video.duration / 60)}m {video.duration % 60}s</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm ml-4">
                            <div className="text-center">
                              <div className="font-bold text-blue-600">{video.level}</div>
                              <div className="text-gray-500 text-xs">level</div>
                            </div>
                            {video.relevanceScore && (
                              <div className="text-center">
                                <div className="font-bold text-green-600">{video.relevanceScore}</div>
                                <div className="text-gray-500 text-xs">relevance</div>
                              </div>
                            )}
                            {video.difficultyScore && (
                              <div className="text-center">
                                <div className="font-bold text-purple-600">{video.difficultyScore}</div>
                                <div className="text-gray-500 text-xs">difficulty</div>
                              </div>
                            )}
                            <a
                              href={`https://youtube.com/watch?v=${video.youtubeId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 text-xs underline"
                            >
                              Watch
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No videos data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}