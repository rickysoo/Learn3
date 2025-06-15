import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TopicResponse {
  topics: string[];
}

export async function generateRandomTopics(count: number = 8): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an educational topic generator. Generate diverse learning topics from an extremely wide range of fields that would be suitable for YouTube video searches. Cast a very wide net across all possible areas of human knowledge and skills.

Include topics from these expanded categories:
- Sciences: Biology, Chemistry, Physics, Astronomy, Geology, Environmental Science, Marine Biology
- Technology: Programming, AI, Cybersecurity, Web Development, Mobile Apps, Data Science, Robotics
- Creative Arts: Photography, Music Production, Digital Art, Animation, Film Making, Creative Writing, Graphic Design
- Physical Skills: Martial Arts, Dance, Sports, Fitness, Yoga, Rock Climbing, Swimming
- Crafts & Hobbies: Woodworking, Pottery, Knitting, Gardening, Cooking, Baking, Home Brewing
- Business & Finance: Entrepreneurship, Investment, Marketing, Sales, Real Estate, Cryptocurrency
- Personal Development: Public Speaking, Time Management, Meditation, Memory Techniques, Speed Reading
- Languages: Spanish, French, Mandarin, Sign Language, Ancient Languages
- History & Culture: World History, Art History, Philosophy, Anthropology, Archaeology
- Practical Life Skills: Car Maintenance, Home Repair, Budgeting, Cooking, First Aid
- Academic Subjects: Mathematics, Literature, Psychology, Sociology, Economics, Political Science
- Emerging Fields: Sustainable Living, Urban Farming, Renewable Energy, Space Technology

The topics should be:
- Educational and learnable through videos
- Extremely diverse across all possible fields of human knowledge
- Suitable for a 3-level learning progression (beginner to advanced)
- Specific enough to find quality educational content
- Include both mainstream and niche subjects
- IMPORTANT: Each topic must be 1 to 5 words only

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
    
    // Fallback to diverse topics if OpenAI fails
    const fallbackTopics = [
      "Machine Learning", "Public Speaking", "Photography", 
      "Data Science", "Leadership", "Woodworking", "Urban Gardening", 
      "Marine Biology", "Digital Art", "Rock Climbing", 
      "Home Brewing", "Cryptocurrency", "Meditation"
    ];
    
    return fallbackTopics.slice(0, count);
  }
}