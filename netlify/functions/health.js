// Health check function
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'KrishiAI Frontend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    functions: {
      api: '/api/*',
      health: '/health'
    },
    note: 'Frontend deployed successfully. Backend API available at configured endpoints.'
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(healthData, null, 2)
  };
};
