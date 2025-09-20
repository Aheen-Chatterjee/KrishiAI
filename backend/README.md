# Backend Configuration

## Environment Variables

The following environment variables need to be configured for the application to run:

### Required Variables

- `MONGO_URL`: MongoDB connection string
  - For MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`
  - For local MongoDB: `mongodb://localhost:27017`

- `DB_NAME`: Database name (default: `farmwise_db`)

- `OPENAI_API_KEY`: Your OpenAI API key for AI features

### Optional Variables

- `CORS_ORIGINS`: Comma-separated list of allowed origins (default: `*`)
- `OPENWEATHER_API_KEY`: OpenWeather API key (optional - mock data is used if not provided)

### Example Configuration

```bash
export MONGO_URL="mongodb+srv://your-username:your-password@cluster.mongodb.net/?retryWrites=true&w=majority"
export DB_NAME="farmwise_db"
export OPENAI_API_KEY="your-openai-api-key-here"
export CORS_ORIGINS="https://your-frontend-domain.com,http://localhost:3000"
```

## MongoDB Setup

1. Create a MongoDB Atlas cluster or use a local MongoDB instance
2. Get your connection string from MongoDB Atlas or use `mongodb://localhost:27017` for local
3. Set the `MONGO_URL` environment variable with your connection string
4. The application will automatically create the required collections on first use

## Deployment Notes

- **MongoDB is completely optional** - the application runs in demo mode when database is not available
- Database-dependent features return appropriate error messages when MongoDB is not configured
- AI features work even without database (using generic crop information)
- OpenAI features require a valid API key

## Running Without MongoDB

When MongoDB is not available, the application provides:

- ✅ Weather data (mock Kerala weather)
- ✅ AI crop identification
- ✅ AI chat assistance
- ✅ Generic AI agricultural advice
- ❌ User management (CRUD operations)
- ❌ Crop management (CRUD operations)
- ❌ Activity tracking
- ❌ Personalized advice based on user/crop data

## Demo Mode

When database is not available, visit `/demo` endpoint to see:
- Sample data structure
- Available features
- API endpoints that work without database
