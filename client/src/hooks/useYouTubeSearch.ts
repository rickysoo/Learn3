import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { VideoSearchResult } from "@shared/schema";

export function useYouTubeSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (query: string): Promise<VideoSearchResult> => {
      const response = await apiRequest("POST", "/api/search", { query });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific API unavailability errors
        if (response.status === 503 && errorData.needsApiKey) {
          throw new Error(`API_ERROR: ${errorData.message}`);
        }
        
        throw new Error(errorData.message || "Search failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Cache the search results
      queryClient.setQueryData(["/api/videos", data.query], data);
    },
  });
}

export function useVideos(topic: string) {
  return useQuery({
    queryKey: ["/api/videos", topic],
    enabled: !!topic,
  });
}
