from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json
import base64
import requests
from PIL import Image
import io
from openai import AsyncOpenAI


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# OpenWeather API
OPENWEATHER_API_KEY = "your_openweather_key_here"  # You'll need to get this
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: Optional[str] = None
    location: Dict[str, Any] = {}
    crops: List[str] = []
    farm_size: Optional[str] = None
    irrigation_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    location: Dict[str, Any] = {}

class Crop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    image_url: Optional[str] = None
    planting_date: Optional[datetime] = None
    current_stage: str = "planted"
    health_status: str = "good"  # good, warning, critical
    last_activity: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CropCreate(BaseModel):
    name: str
    image_url: Optional[str] = None
    planting_date: Optional[datetime] = None

class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    crop_id: str
    type: str  # watering, fertilizer, pesticide, harvesting, planting, observation
    description: str
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    quantity: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityCreate(BaseModel):
    crop_id: str
    type: str
    description: str
    quantity: Optional[str] = None
    notes: Optional[str] = None

class AIAdvice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    crop_id: str
    advice_text: str
    weather_data: Optional[Dict[str, Any]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatMessage(BaseModel):
    message: str
    crop_id: Optional[str] = None
    image_base64: Optional[str] = None

# Helper Functions
def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, dict):
                data[key] = prepare_for_mongo(value)
    return data

def parse_from_mongo(item):
    """Parse datetime strings back from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if key.endswith('_at') or key.endswith('_date') and isinstance(value, str):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
    return item

async def get_weather_data(lat: float, lon: float):
    """Get weather data from OpenWeatherMap"""
    try:
        # For MVP demo, return mock weather data for Kerala
        mock_weather = {
            "weather": [{"description": "partly cloudy", "main": "Clouds"}],
            "main": {"temp": 28, "humidity": 75},
            "wind": {"speed": 2.5},
            "name": "Kerala"
        }
        return mock_weather
    except Exception as e:
        logging.error(f"Weather API error: {e}")
        return None

async def get_ai_advice(crop_name: str, location: dict, weather_data: dict = None):
    """Get AI-powered agricultural advice"""
    try:
        weather_context = ""
        if weather_data:
            weather_context = f"Current weather: {weather_data.get('weather', [{}])[0].get('description', 'N/A')}, Temperature: {weather_data.get('main', {}).get('temp', 'N/A')}°C, Humidity: {weather_data.get('main', {}).get('humidity', 'N/A')}%"

        location_context = f"Location: {location.get('district', 'Kerala')}, {location.get('taluk', '')}"
        
        prompt = f"""As an agricultural expert for Kerala, India, provide specific advice for {crop_name} cultivation.

{location_context}
{weather_context}

Please provide:
1. Current care recommendations for {crop_name}
2. Seasonal considerations for Kerala climate
3. Common issues to watch for
4. Best practices for this region

Keep advice practical and focused on Kerala farming conditions."""

        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert agricultural advisor specializing in Kerala, India farming practices. Provide practical, actionable advice for farmers."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"AI advice error: {e}")
        return "Unable to generate AI advice at this time. Please consult with local agricultural experts."

async def identify_crop_from_image(image_base64: str):
    """Identify crop from image using OpenAI Vision"""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert in crop identification, especially for Kerala, India agriculture. Identify crops accurately from images."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Please identify this crop. If it's a crop commonly grown in Kerala, India, provide the name and brief growing information. If uncertain, provide your best guess with confidence level."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"Crop identification error: {e}")
        return "Unable to identify crop from image."

# API Routes

# User Management
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    user_dict = user_data.dict()
    user_obj = User(**user_dict)
    user_dict = prepare_for_mongo(user_obj.dict())
    await db.users.insert_one(user_dict)
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**parse_from_mongo(user))

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: dict):
    user_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    user_data = prepare_for_mongo(user_data)
    result = await db.users.update_one({"id": user_id}, {"$set": user_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**parse_from_mongo(updated_user))

# Crop Management
@api_router.post("/crops", response_model=Crop)
async def create_crop(crop_data: dict):
    # Extract user_id from the request data
    user_id = crop_data.pop('user_id', None)
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    crop_dict = crop_data.copy()
    crop_dict['user_id'] = user_id
    crop_obj = Crop(**crop_dict)
    crop_dict = prepare_for_mongo(crop_obj.dict())
    await db.crops.insert_one(crop_dict)
    return crop_obj

@api_router.get("/crops/{user_id}", response_model=List[Crop])
async def get_user_crops(user_id: str):
    crops = await db.crops.find({"user_id": user_id}).to_list(length=None)
    return [Crop(**parse_from_mongo(crop)) for crop in crops]

@api_router.get("/crop/{crop_id}", response_model=Crop)
async def get_crop(crop_id: str):
    crop = await db.crops.find_one({"id": crop_id})
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    return Crop(**parse_from_mongo(crop))

@api_router.put("/crop/{crop_id}", response_model=Crop)
async def update_crop(crop_id: str, crop_data: dict):
    crop_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    crop_data = prepare_for_mongo(crop_data)
    result = await db.crops.update_one({"id": crop_id}, {"$set": crop_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    updated_crop = await db.crops.find_one({"id": crop_id})
    return Crop(**parse_from_mongo(updated_crop))

@api_router.delete("/crop/{crop_id}")
async def delete_crop(crop_id: str):
    result = await db.crops.delete_one({"id": crop_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    # Also delete related activities
    await db.activities.delete_many({"crop_id": crop_id})
    await db.ai_advice.delete_many({"crop_id": crop_id})
    
    return {"message": "Crop deleted successfully"}

# Activity Management
@api_router.post("/activities", response_model=Activity)
async def create_activity(activity_data: ActivityCreate):
    activity_dict = activity_data.dict()
    activity_obj = Activity(**activity_dict)
    activity_dict = prepare_for_mongo(activity_obj.dict())
    await db.activities.insert_one(activity_dict)
    
    # Update crop's last activity
    await db.crops.update_one(
        {"id": activity_data.crop_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    return activity_obj

@api_router.get("/activities/{crop_id}", response_model=List[Activity])
async def get_crop_activities(crop_id: str):
    activities = await db.activities.find({"crop_id": crop_id}).sort("date", -1).to_list(length=None)
    return [Activity(**parse_from_mongo(activity)) for activity in activities]

# AI Features
@api_router.post("/ai/advice/{crop_id}")
async def get_crop_advice(crop_id: str):
    crop = await db.crops.find_one({"id": crop_id})
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    user = await db.users.find_one({"id": crop["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get weather data if location available
    weather_data = None
    if user.get("location", {}).get("coordinates"):
        coords = user["location"]["coordinates"]
        weather_data = await get_weather_data(coords[1], coords[0])  # lat, lon
    
    advice_text = await get_ai_advice(crop["name"], user.get("location", {}), weather_data)
    
    # Save advice to database
    advice_obj = AIAdvice(
        crop_id=crop_id,
        advice_text=advice_text,
        weather_data=weather_data or {}
    )
    advice_dict = prepare_for_mongo(advice_obj.dict())
    await db.ai_advice.insert_one(advice_dict)
    
    return {"advice": advice_text, "weather": weather_data}

@api_router.post("/ai/identify-crop")
async def identify_crop(image: UploadFile = File(...)):
    try:
        # Read and convert image to base64
        image_data = await image.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Identify crop using OpenAI Vision
        identification = await identify_crop_from_image(image_base64)
        
        return {"identification": identification}
    except Exception as e:
        logging.error(f"Crop identification endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Error identifying crop")

@api_router.post("/ai/chat")
async def chat_with_ai(chat_data: ChatMessage):
    try:
        # Get crop context if provided
        crop_context = ""
        if chat_data.crop_id:
            crop = await db.crops.find_one({"id": chat_data.crop_id})
            if crop:
                crop_context = f"The farmer is asking about their {crop['name']} crop, planted on {crop.get('planting_date', 'unknown date')}, current stage: {crop.get('current_stage', 'unknown')}."

        # Prepare message
        message_text = f"{crop_context}\n\nFarmer's question: {chat_data.message}"
        
        messages = [
            {
                "role": "system",
                "content": "You are FarmWise AI, an expert agricultural assistant for Kerala farmers. Provide helpful, practical advice in a friendly, conversational manner."
            }
        ]
        
        if chat_data.image_base64:
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": message_text
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{chat_data.image_base64}"
                        }
                    }
                ]
            })
        else:
            messages.append({
                "role": "user",
                "content": message_text
            })
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=800,
            temperature=0.7
        )
        
        return {"response": response.choices[0].message.content}
        
    except Exception as e:
        logging.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail="Error processing chat message")

# Weather data
@api_router.get("/weather/{lat}/{lon}")
async def get_weather(lat: float, lon: float):
    weather_data = await get_weather_data(lat, lon)
    if weather_data:
        return weather_data
    raise HTTPException(status_code=404, detail="Weather data not available")

# Health check
@api_router.get("/")
async def root():
    return {"message": "FarmWise API is running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()