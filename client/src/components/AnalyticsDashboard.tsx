import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Search, Clock, Activity, Users, Video } from "lucide-react";

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

export function AnalyticsDashboard() {
  const [isVisible, setIsVisible] = useState(false);

  const { data: analytics, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    enabled: isVisible,
    refetchInterval: isVisible ? 30000 : false, // Refresh every 30 seconds when visible
  });

  // Auto-refresh data every 30 seconds when dashboard is open
  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        refetch();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isVisible, refetch]);

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 z-50 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        size="sm"
      >
        <Activity className="h-4 w-4 mr-2" />
        Analytics
      </Button>
    );
  }

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-auto">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time insights into search behavior and system performance
            </p>
          </div>
          <Button
            onClick={() => setIsVisible(false)}
            variant="outline"
          >
            Close
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading analytics data...</p>
          </div>
        ) : analytics ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="searches">Search History</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="topics">Popular Topics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.totalSearches}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unique Sessions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.uniqueSessions}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatDuration(analytics.summary.avgProcessingTime)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Quota Used</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.totalQuotaUsed}</div>
                    <p className="text-xs text-muted-foreground">API units consumed</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Search Activity Over Time</CardTitle>
                  <CardDescription>Number of searches per hour</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.searches.slice(-24)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="createdAt" 
                        tickFormatter={(value) => new Date(value).getHours() + ':00'}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => formatTime(value as string)}
                        formatter={(value) => [value, 'Videos Found']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="videoCount" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="searches" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Search History</CardTitle>
                  <CardDescription>Latest search queries and their results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.searches.slice(0, 20).map((search) => (
                      <div
                        key={search.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{search.query}</div>
                          <div className="text-sm text-muted-foreground">
                            Session: {search.sessionId.slice(0, 8)}... • {formatTime(search.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            <Video className="h-3 w-3 mr-1" />
                            {search.videoCount} videos
                          </Badge>
                          <Badge variant="outline">
                            {formatDuration(search.processingTime)}
                          </Badge>
                          <Badge variant="outline">
                            {search.quotaConsumed} quota
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Processing Time Distribution</CardTitle>
                    <CardDescription>Response times for search requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.searches.slice(-20)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="query" 
                          tick={false}
                          tickFormatter={(value) => value.slice(0, 10) + '...'}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value) => [formatDuration(value as number), 'Processing Time']}
                          labelFormatter={(label) => `Query: ${label}`}
                        />
                        <Bar dataKey="processingTime" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>API Key Usage</CardTitle>
                    <CardDescription>Distribution of API key usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            analytics.searches.reduce((acc, search) => {
                              const key = `Key ${search.apiKeyUsed + 1}`;
                              acc[key] = (acc[key] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(
                            analytics.searches.reduce((acc, search) => {
                              const key = `Key ${search.apiKeyUsed + 1}`;
                              acc[key] = (acc[key] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="topics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Popular Search Topics</CardTitle>
                  <CardDescription>Most frequently searched topics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={analytics.summary.popularTopics} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="topic" 
                        type="category" 
                        width={150}
                        tickFormatter={(value) => value.length > 20 ? value.slice(0, 20) + '...' : value}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No analytics data available yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Perform some searches to start collecting data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}