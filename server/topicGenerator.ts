import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TopicResponse {
  topics: string[];
}

export async function generateRandomTopics(count: number = 8): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an educational topic generator. Generate diverse learning topics from various fields that would be suitable for YouTube video searches. Topics should vary in scope - some broad (like "Economics"), some narrow (like "Supervised Learning"), and some skill-based (like "Conversation Skills"). 

The topics should be:
- Educational and learnable through videos
- Diverse across different fields (science, technology, business, arts, personal development, etc.)
- Suitable for a 3-level learning progression (beginner to advanced)
- Specific enough to find quality educational content
- Not too niche or obscure

Respond with JSON in this exact format: { "topics": ["Topic 1", "Topic 2", ...] }`
        },
        {
          role: "user",
          content: `Generate ${count} diverse educational topics for video-based learning.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8, // Higher temperature for more creative/diverse topics
    });

    const result = JSON.parse(response.choices[0].message.content || "{}") as TopicResponse;
    
    if (!result.topics || !Array.isArray(result.topics)) {
      throw new Error("Invalid response format from OpenAI");
    }

    return result.topics.slice(0, count);
  } catch (error) {
    console.error("Error generating topics with OpenAI:", error);
    
    // Fallback to a few basic topics if OpenAI fails
    const fallbackTopics = [
      "Machine Learning", "Public Speaking", "Financial Planning", "Photography", 
      "Data Science", "Leadership", "Digital Marketing", "Psychology"
    ];
    
    return fallbackTopics.slice(0, count);
  }
}