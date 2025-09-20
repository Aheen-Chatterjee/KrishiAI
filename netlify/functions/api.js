// Netlify Function to handle API requests
// This serves as a proxy for the Python backend or handles basic functionality

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path.replace('/api/', '').replace('/.netlify/functions/api', '');

    // Route handling based on path
    let response;

    switch (path) {
      case 'users':
        response = {
          message: 'User management API',
          endpoints: {
            'GET /api/users': 'List all users',
            'GET /api/users/{id}': 'Get user by ID',
            'POST /api/users': 'Create new user',
            'PUT /api/users/{id}': 'Update user',
            'DELETE /api/users/{id}': 'Delete user'
          },
          note: 'Database required for full functionality'
        };
        break;

      case 'crops':
        response = {
          message: 'Crop management API',
          endpoints: {
            'GET /api/crops': 'List all crops',
            'GET /api/crops/{id}': 'Get crop by ID',
            'POST /api/crops': 'Create new crop',
            'PUT /api/crops/{id}': 'Update crop',
            'DELETE /api/crops/{id}': 'Delete crop'
          },
          note: 'Database required for full functionality'
        };
        break;

      case 'weather':
        response = {
          message: 'Weather API',
          endpoints: {
            'GET /api/weather/{lat}/{lon}': 'Get weather data for coordinates'
          },
          note: 'Mock weather data provided when database is unavailable'
        };
        break;

      case 'ai/identify-crop':
        response = {
          message: 'AI Crop Identification API',
          endpoints: {
            'POST /api/ai/identify-crop': 'Identify crop from image'
          },
          note: 'Requires OpenAI API key'
        };
        break;

      case 'ai/chat':
        response = {
          message: 'AI Chat API',
          endpoints: {
            'POST /api/ai/chat': 'Chat with AI assistant'
          },
          note: 'Requires OpenAI API key'
        };
        break;

      case 'ai/advice':
        response = {
          message: 'AI Advice API',
          endpoints: {
            'POST /api/ai/advice/{crop_id}': 'Get AI-powered crop advice'
          },
          note: 'Requires OpenAI API key'
        };
        break;

      case 'docs':
        response = {
          message: 'API Documentation',
          available_endpoints: {
            'GET /api/users': 'User management',
            'GET /api/crops': 'Crop management',
            'GET /api/weather/{lat}/{lon}': 'Weather data',
            'POST /api/ai/identify-crop': 'AI crop identification',
            'POST /api/ai/chat': 'AI chat assistant',
            'POST /api/ai/advice/{crop_id}': 'AI crop advice'
          },
          note: 'Connect to your Python backend at the configured URL for full functionality.'
        };
        break;

      case 'redoc':
        response = {
          message: 'API Reference (ReDoc)',
          available_endpoints: {
            'GET /api/users': 'User management',
            'GET /api/crops': 'Crop management',
            'GET /api/weather/{lat}/{lon}': 'Weather data',
            'POST /api/ai/identify-crop': 'AI crop identification',
            'POST /api/ai/chat': 'AI chat assistant',
            'POST /api/ai/advice/{crop_id}': 'AI crop advice'
          },
          note: 'Connect to your Python backend at the configured URL for full functionality.'
        };
        break;

      default:
        response = {
          message: 'KrishiAI API',
          path: path,
          method: event.httpMethod,
          status: 'API endpoint configured',
          available_endpoints: {
            'users': 'User management',
            'crops': 'Crop management',
            'weather': 'Weather data',
            'ai/*': 'AI-powered features'
          },
          note: 'Connect to your Python backend at the configured URL for full functionality.',
          timestamp: new Date().toISOString()
        };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response, null, 2)
    };

  } catch (error) {
    console.error('API Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }, null, 2)
    };
  }
};
