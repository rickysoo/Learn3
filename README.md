# Learn3 🎯

**Your personal video curator for learning anything, fast ⚡**

Learn3 is an AI-powered educational platform that transforms any topic into a structured 3-video learning path. Whether you want to master quantum physics, improve your public speaking, or learn digital marketing, Learn3 curates the perfect video progression to take you from zero to hero.

## 🌟 What Makes Learn3 Special

- **AI-Curated Learning Paths**: Advanced AI analyzes thousands of YouTube videos to select the perfect 3-video progression
- **Smart Difficulty Progression**: Videos are intelligently ordered from beginner to advanced using OpenAI analysis
- **Instant Topic Suggestions**: Get fresh learning ideas powered by AI across diverse fields
- **Progressive Web App**: Install on any device for offline access and native app experience
- **Analytics Tracking**: Understand your learning patterns and preferences

## 🎯 Who Is This For?

### Students & Learners
- Quickly grasp new concepts with structured video sequences
- Get expert-curated content without spending hours searching
- Perfect for visual learners who prefer video-based education

### Professionals
- Upskill efficiently during lunch breaks or commutes
- Learn industry-specific skills with vetted, high-quality content
- Stay current with emerging technologies and methodologies

### Educators & Trainers
- Discover quality educational videos for course development
- Find supplementary materials for classroom instruction
- Create structured learning modules for students

### Curious Minds
- Explore new interests with confidence in content quality
- Learn diverse topics from economics to art to programming
- Turn random curiosity into structured knowledge acquisition

## 🚀 How to Use Learn3

### 1. **Enter Your Topic**
Type anything you want to learn in the search box. Examples:
- "Machine Learning"
- "Public Speaking"
- "Italian Cooking"
- "Personal Finance"
- "Web Design"

### 2. **Get Your Video Trio**
Learn3's AI instantly analyzes thousands of videos and selects 3 perfect ones:
- **🎯 The Basics**: Foundation concepts to get you started
- **⚡ Get Practical**: Hands-on applications to level up
- **🧠 Go Pro**: Advanced insights to master the topic

### 3. **Follow the Path**
Watch the videos in order for optimal learning progression. Each video builds on the previous one, ensuring you develop solid understanding.

### 4. **Explore More**
Use the AI-generated topic suggestions to discover new learning opportunities, or search for related topics to deepen your knowledge.

## 📱 Installation as a Mobile App

Learn3 works as a Progressive Web App (PWA), meaning you can install it on your device:

### On Mobile (iOS/Android):
1. Open Learn3 in your browser
2. Look for the "Install App" prompt or
3. Tap the share button and select "Add to Home Screen"
4. Enjoy native app experience with offline capabilities

### On Desktop:
1. Open Learn3 in Chrome, Edge, or Firefox
2. Look for the install icon in the address bar
3. Click "Install" when prompted
4. Access Learn3 from your desktop or start menu

## 🔧 Technical Overview

Learn3 is built with modern web technologies for performance, scalability, and user experience.

### Architecture
- **Frontend**: React with TypeScript, responsive design with Tailwind CSS
- **Backend**: Node.js with Express, RESTful API architecture
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **AI Integration**: OpenAI GPT-4o for content analysis and topic generation
- **Video Source**: YouTube Data API v3 with intelligent quota management

### Key Features

#### AI-Powered Video Analysis
- **Relevance Scoring**: OpenAI analyzes video content for topic relevance (0-100 scale)
- **Difficulty Assessment**: AI determines complexity level (1-3 scale) for proper progression
- **Content Quality**: Filters ensure educational value and appropriate duration (2-60 minutes)

#### Smart Search System
- **Multi-API Management**: 4 YouTube API keys with automatic failover
- **Quota Optimization**: Pacific timezone-based daily limits with intelligent tracking
- **Caching Layer**: 30-minute cache for frequently searched topics
- **Recency Weighting**: Balances content quality with publication date

#### Progressive Web App
- **Service Worker**: Offline functionality and improved performance
- **Manifest**: Native app installation and experience
- **Responsive Design**: Optimized for mobile, tablet, and desktop

#### Analytics & Monitoring
- **Google Analytics 4**: Comprehensive user behavior tracking
- **Custom Analytics**: Search patterns, video engagement, topic popularity
- **Admin Dashboard**: Real-time usage statistics and system health

### Technology Stack

#### Frontend
```
React 18 + TypeScript
Tailwind CSS + shadcn/ui components
Wouter (lightweight routing)
TanStack Query (data fetching)
Vite (build tool)
```

#### Backend
```
Node.js + Express
PostgreSQL + Drizzle ORM
OpenAI API integration
YouTube Data API v3
Session management
```

#### Infrastructure
```
Progressive Web App (PWA)
Google Analytics integration
Environment-based configuration
Automated dependency management
```

### API Endpoints

#### Core Endpoints
- `POST /api/search` - Search and curate video learning paths
- `GET /api/topics/random` - Generate AI-powered topic suggestions
- `GET /api/quota-usage` - Monitor API usage and limits

#### Admin Endpoints
- `GET /api/analytics` - Retrieve usage analytics
- `GET /api/admin/topics` - Topic performance metrics
- `GET /api/admin/videos` - Video retrieval statistics

### Database Schema

#### Videos Table
- Video metadata (title, description, duration)
- AI-generated scores (relevance, difficulty)
- YouTube integration data
- Learning path association

#### Analytics Tables
- Search queries and patterns
- Video retrieval metrics
- API usage tracking
- User session data

### Environment Configuration

```env
# YouTube API (4 keys for quota distribution)
YOUTUBE_API_KEY_1=your_key_here
YOUTUBE_API_KEY_2=your_key_here
YOUTUBE_API_KEY_3=your_key_here
YOUTUBE_API_KEY_4=your_key_here

# OpenAI Integration
OPENAI_API_KEY=your_openai_key

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## 🚦 Getting Started (Developers)

### Prerequisites
- Node.js 18+
- PostgreSQL database
- YouTube Data API v3 keys
- OpenAI API key
- Google Analytics 4 property (optional)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/learn3.git
cd learn3

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Set up database
npm run db:migrate

# Start development server
npm run dev
```

### Development Workflow
```bash
# Start the application
npm run dev

# Run database migrations
npm run db:migrate

# Generate database types
npm run db:generate

# Build for production
npm run build
```

## 🤝 Contributing

Learn3 is designed to make learning accessible and efficient for everyone. Contributions that improve the user experience, add educational value, or enhance technical performance are welcome.

### Areas for Contribution
- Educational content curation algorithms
- User interface improvements
- Mobile experience optimization
- Analytics and insights features
- Performance optimizations

## 📄 License

MIT License - feel free to use Learn3 for personal or commercial projects.

---

**Ready to start learning?** Visit [Learn3](https://your-domain.com) and discover your next video learning adventure! 🚀