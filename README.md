# FarmWise - Kerala Farmers PWA

A mobile-first Progressive Web App designed for Kerala farmers to manage crops and get AI-powered agricultural advice.

## Features

- 🌱 **Crop Management**: Track your crops with health indicators and activity logging
- 🤖 **AI-Powered Advice**: Get personalized farming recommendations using OpenAI GPT-4o
- 📱 **Mobile-First Design**: Optimized for mobile devices with Kerala-themed UI
- 🌤️ **Weather Integration**: Real-time weather data for better farming decisions
- 📸 **Crop Identification**: Upload images to identify crop types and health issues
- 💬 **AI Chat Assistant**: Interactive chat for farming guidance
- 🗣️ **Malayalam Support**: Language toggle for accessibility

## Tech Stack

### Frontend
- **React 19** with modern hooks and context
- **shadcn/ui** components for consistent design
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls

### Backend
- **FastAPI** (Python) with async/await patterns
- **MongoDB** with Motor (async driver)
- **OpenAI GPT-4o** integration using emergentintegrations library
- **Pydantic** for data validation

## Setup Instructions

### Prerequisites
- Node.js 16+ and yarn
- Python 3.11+
- MongoDB running locally
- OpenAI API key

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create environment file:
```bash
cp .env.example .env
```

5. Edit `.env` file and add your OpenAI API key:
```
OPENAI_API_KEY="your_actual_openai_api_key_here"
```

6. Start the backend server:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
yarn install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` file if needed (default should work for local development):
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

5. Start the frontend server:
```bash
yarn start
```

The app will be available at `http://localhost:3000`

## Project Structure

```
/app
├── backend/          # FastAPI backend
│   ├── server.py     # Main application file
│   ├── .env.example  # Environment template
│   └── requirements.txt
├── frontend/         # React frontend
│   ├── src/
│   │   ├── App.js    # Main React component
│   │   ├── App.css   # Styles
│   │   └── components/ui/  # shadcn/ui components
│   ├── public/
│   └── package.json
└── README.md
```

## API Endpoints

### User Management
- `POST /api/users` - Create user
- `GET /api/users/{user_id}` - Get user
- `PUT /api/users/{user_id}` - Update user

### Crop Management
- `POST /api/crops` - Create crop
- `GET /api/crops/{user_id}` - Get user crops
- `GET /api/crop/{crop_id}` - Get specific crop
- `PUT /api/crop/{crop_id}` - Update crop
- `DELETE /api/crop/{crop_id}` - Delete crop

### Activity Tracking
- `POST /api/activities` - Log activity
- `GET /api/activities/{crop_id}` - Get crop activities

### AI Features
- `POST /api/ai/advice/{crop_id}` - Get AI advice
- `POST /api/ai/chat` - Chat with AI
- `POST /api/ai/identify-crop` - Identify crop from image

### Weather
- `GET /api/weather/{lat}/{lon}` - Get weather data

## Environment Variables

### Backend (.env)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="farmwise_db"
CORS_ORIGINS="*"
OPENAI_API_KEY="your_openai_api_key_here"
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit your changes: `git commit -am 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## Security

- Never commit `.env` files to version control
- Keep your OpenAI API key secure
- Use environment variables for all sensitive configuration

## License

This project is licensed under the MIT License.

## Kerala-Specific Features

- **Popular Crops**: Pre-configured with Kerala crops (Rice, Coconut, Banana, Pepper, Cardamom, Ginger, Turmeric, Rubber)
- **Districts**: Includes major Kerala districts (Thiruvananthapuram, Kochi, Thrissur, Kozhikode, Kannur)
- **Cultural Design**: Green color scheme representing Kerala's agricultural heritage
- **Language Support**: Malayalam/English toggle for local farmers
- **Climate-Aware Advice**: AI recommendations specific to Kerala's tropical climate

## Support

For questions or issues, please open a GitHub issue or contact the development team.
