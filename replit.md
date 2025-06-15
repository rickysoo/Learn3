# Learn3 - AI-Powered Learning Platform

## Overview

Learn3 is an AI-powered educational platform that transforms any topic into a structured 3-video learning path. The application uses OpenAI's GPT-4 model to analyze and curate YouTube videos, creating progressive learning experiences from beginner to advanced levels.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack React Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds
- **PWA Support**: Service worker implementation for offline capabilities

### Backend Architecture
- **Runtime**: Node.js 20 with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Cloud Database**: Neon serverless PostgreSQL
- **Authentication**: Firebase OAuth with Google sign-in
- **External APIs**: 
  - YouTube Data API v3 (with key rotation system)
  - OpenAI GPT-4 for content analysis and topic generation
  - Firebase Authentication for user management

### Deployment Strategy
- **Platform**: Replit with autoscale deployment
- **Build Process**: Vite frontend build + esbuild backend bundling
- **Environment**: Development and production configurations
- **Port Configuration**: Internal port 5000, external port 80

## Key Components

### Video Search Engine
- Multi-API key rotation system for YouTube Data API
- Intelligent caching mechanism (30-minute TTL)
- Content relevance scoring using OpenAI analysis
- Progressive difficulty assessment (Level 1-3)
- Quota tracking and management system

### AI Content Curation
- OpenAI GPT-4 integration for video analysis
- Topic relevance scoring and reasoning
- Automatic difficulty level classification
- Random educational topic generation
- Content quality assessment

### Database Schema
- **Videos Table**: Stores curated video metadata with difficulty levels and publication dates
- **Searches Table**: Analytics for user search patterns
- **Video Retrievals Table**: Tracks which videos are served for searches
- **API Usage Table**: Monitors external API consumption
- **Bookmarks Table**: User-saved search queries and video collections

### Analytics System
- Real-time search tracking and performance metrics
- Session-based user analytics
- API quota monitoring and optimization
- Popular topic identification
- Processing time analysis

## Data Flow

1. **User Search Request**: User enters learning topic
2. **Cache Check**: System checks for cached results
3. **YouTube API Call**: Multiple API calls with key rotation
4. **AI Analysis**: OpenAI analyzes video content for relevance and difficulty
5. **Video Curation**: System selects optimal 3-video progression
6. **Response Delivery**: Structured learning path returned to user
7. **Analytics Recording**: Search metrics and video selections logged

## External Dependencies

### Required APIs
- **YouTube Data API v3**: Video search and metadata retrieval
- **OpenAI API**: Content analysis and topic generation (GPT-4)

### Database
- **Neon PostgreSQL**: Serverless database with connection pooling
- **Drizzle ORM**: Type-safe database operations

### Analytics & Monitoring
- **Google Analytics**: User behavior tracking (optional)
- **Custom Analytics**: Built-in search and usage analytics

### UI Components
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library

## Deployment Strategy

The application uses Replit's deployment infrastructure with the following configuration:

- **Development**: Hot-reload with Vite dev server
- **Production**: Static frontend served by Express with API routes
- **Database**: Automatic Neon PostgreSQL provisioning
- **Environment Variables**: Secure API key management
- **Scaling**: Autoscale deployment target for traffic handling

## Changelog

```
Changelog:
- June 14, 2025: Initial setup with YouTube video search and OpenAI analysis
- June 14, 2025: Added Firebase OAuth authentication with Google sign-in
- June 14, 2025: Implemented bookmark functionality for registered users
- June 14, 2025: Added video publication dates and auto-play features
- June 14, 2025: Fixed Safari logo visibility with SVG implementation
- June 14, 2025: Enhanced bookmark system to restore exact saved videos instead of fresh searches
- June 14, 2025: Added "View Bookmarks" link in success message for improved user flow
- June 14, 2025: Implemented device-specific video behavior - mobile opens YouTube app, desktop/tablet uses embedded player with autoplay
- June 14, 2025: Updated all OpenAI models to GPT-4o-mini for cost efficiency and expanded topic generation to include 8 diverse subjects across all fields of human knowledge
```

## Firebase Configuration Required

To enable authentication, add your Replit domain to Firebase authorized domains:

1. Go to Firebase Console > Authentication > Settings > Authorized domains
2. Add your current Replit preview domain (e.g., `abc123-xyz.replit.dev`)
3. Add your deployment domain when deployed (e.g., `your-app.replit.app`)

## Authentication Features

- **Google OAuth**: Sign in with Google account via Firebase
- **Bookmark System**: Registered users can save video searches
- **Unauthorized Access**: Non-registered users can still use search but cannot save
- **Navigation**: Bookmarks page accessible for signed-in users

## User Preferences

```
Preferred communication style: Simple, everyday language.
```