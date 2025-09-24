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
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection - will be initialized on startup
client = None
db = None
mongo_url = None

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Weather API keys
OPENWEATHER_API_KEY = "your_openweather_key_here"  # Legacy; optional
WEATHERAPI_KEY = os.environ.get('WEATHERAPI_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# Initialize OpenAI client
if OPENAI_API_KEY:
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
else:
    openai_client = None
    logging.warning("OpenAI API key not configured - AI features will be disabled")

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
    image_url: Optional[str] = None

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
    word_limit: Optional[int] = 50

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

def check_database_availability():
    """Check if database is available and return error response if not"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    return True

async def get_weather_data(lat: float, lon: float):
    """Get weather data from WeatherAPI.com using latitude and longitude.

    Requires environment variable WEATHERAPI_KEY.
    """
    try:
        if not WEATHERAPI_KEY:
            raise ValueError("WEATHERAPI_KEY not configured")

        url = (
            f"https://api.weatherapi.com/v1/current.json?key={WEATHERAPI_KEY}"
            f"&q={lat},{lon}&aqi=no"
        )
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        current = data.get('current', {})
        location = data.get('location', {})
        condition = (current.get('condition') or {})

        return {
            'weather': condition.get('text'),
            'temperature': current.get('temp_c'),
            'humidity': current.get('humidity'),
            'wind': current.get('wind_kph'),
            'datetime': location.get('localtime') or datetime.now(timezone.utc).isoformat(),
            'name': location.get('name')
        }
    except Exception as e:
        logging.error(f"Weather API error: {e}")
        return None

async def get_ai_advice(crop_name: str, location: dict, weather_data: dict = None):
    """Get AI-powered agricultural advice"""
    if not openai_client:
        return "AI features are currently unavailable. Please configure the OpenAI API key."

    try:
        weather_context = ""
        if weather_data:
            weather_context = f"Current weather: {weather_data.get('weather', [{}])}, Temperature: {weather_data.get('temperature', {})}, Humidity: {weather_data.get('humidity', {})}, Wind: {weather_data.get('wind', {})}, Datetime: {weather_data.get('datetime', {})}, Name: {weather_data.get('name', {})}"

        location_context = f"Location: {location.get('district', 'Kerala')}, {location.get('taluk', '')}"
        
        prompt = f"""As an agricultural expert for Kerala, India, provide specific advice for {crop_name} cultivation.

{location_context}
{weather_context}

Please provide:
1. Current care recommendations for {crop_name}
2. Seasonal considerations for Kerala climate
3. Common issues to watch for
4. Best practices for this region

Keep advice practical and focused on Kerala farming conditions.
Dont use #### in the response instead use some basic icons."""

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
    if not openai_client:
        return "AI features are currently unavailable. Please configure the OpenAI API key."

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
# Serve uploaded images as static files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@api_router.post("/upload-image")
async def upload_image(file: UploadFile = File()):
    """
    Upload an image and return its URL.
    """
    # Ensure the file is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    # Generate a unique filename
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / filename

    # Save the file
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Return the URL to access the image
    image_url = f"/uploads/{filename}"
    return {"image_url": image_url}

@api_router.post("/upload-and-identify-crop")
async def upload_and_identify_crop(file: UploadFile = File()):
    """
    Upload an image and identify the crop using AI.
    Returns both the image URL and crop identification result.
    """
    # Ensure the file is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    # Check file size (limit to 10MB)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File size too large. Maximum size is 10MB.")

    # Generate a unique filename
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / filename

    # Save the file
    with open(file_path, "wb") as f:
        f.write(content)

    # Get the image URL
    image_url = f"/uploads/{filename}"

    try:
        # Convert image to base64 for AI processing
        image_base64 = base64.b64encode(content).decode('utf-8')
        
        # Identify crop using the existing function
        crop_identification = await identify_crop_from_image(image_base64)
        
        return {
            "image_url": image_url,
            "crop_identification": crop_identification,
            "filename": filename,
            "file_size": file_size
        }
    except Exception as e:
        logging.error(f"Error processing image for crop identification: {e}")
        # Still return the uploaded image URL even if AI processing fails
        return {
            "image_url": image_url,
            "crop_identification": "Unable to identify crop from image due to processing error.",
            "filename": filename,
            "file_size": file_size,
            "error": str(e)
        }

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    check_database_availability()
    user_dict = user_data.dict()
    user_obj = User(**user_dict)
    user_dict = prepare_for_mongo(user_obj.dict())
    await db.users.insert_one(user_dict)
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    check_database_availability()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**parse_from_mongo(user))

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: dict):
    check_database_availability()
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
    check_database_availability()
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
    check_database_availability()
    crops = await db.crops.find({"user_id": user_id}).to_list(length=None)
    return [Crop(**parse_from_mongo(crop)) for crop in crops]

@api_router.get("/crop/{crop_id}", response_model=Crop)
async def get_crop(crop_id: str):
    check_database_availability()
    crop = await db.crops.find_one({"id": crop_id})
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    return Crop(**parse_from_mongo(crop))

@api_router.put("/crop/{crop_id}", response_model=Crop)
async def update_crop(crop_id: str, crop_data: dict):
    check_database_availability()
    crop_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    crop_data = prepare_for_mongo(crop_data)
    result = await db.crops.update_one({"id": crop_id}, {"$set": crop_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Crop not found")

    updated_crop = await db.crops.find_one({"id": crop_id})
    return Crop(**parse_from_mongo(updated_crop))

@api_router.delete("/crop/{crop_id}")
async def delete_crop(crop_id: str):
    check_database_availability()
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
    check_database_availability()
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
    check_database_availability()
    activities = await db.activities.find({"crop_id": crop_id}).sort("date", -1).to_list(length=None)
    return [Activity(**parse_from_mongo(activity)) for activity in activities]

# AI Features
@api_router.post("/ai/advice/{crop_name}")
async def get_crop_advice(crop_name: str):
    # Get AI advice using crop name directly
    try:
        # Get weather data if available
        weather_data = None
        if WEATHERAPI_KEY:
            weather_data = await get_weather_data(8.5241, 76.9366)  # Default Kerala coordinates

        # Generate advice with crop name
        advice_text = await get_ai_advice(crop_name, {"district": "Kerala"}, weather_data)
        return {"advice": advice_text, "weather": weather_data, "note": f"AI advice for {crop_name}"}
    except Exception as e:
        return {"advice": f"Error generating advice: {str(e)}", "weather": None, "note": "Error occurred"}

@api_router.post("/ai/identify-crop")
async def identify_crop(image: UploadFile = File(...)):
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI features are currently unavailable. Please configure the OpenAI API key.")

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
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI features are currently unavailable. Please configure the OpenAI API key.")

    try:
        # Get crop context if provided and database is available
        crop_context = ""
        if chat_data.crop_id and db:
            crop = await db.crops.find_one({"id": chat_data.crop_id})
            if crop:
                crop_context = f"The farmer is asking about their {crop['name']} crop, planted on {crop.get('planting_date', 'unknown date')}, current stage: {crop.get('current_stage', 'unknown')}."

        # Prepare message with word limit instruction
        word_limit = chat_data.word_limit if chat_data.word_limit else 50
        message_text = f"{crop_context}\n\nFarmer's question: {chat_data.message}\n\nIMPORTANT: Respond in exactly {word_limit} words or less. Speak directly to the farmer using 'you'. NO asterisks, bullet points, or special formatting."

        messages = [
            {
                "role": "system",
                "content": f"You are FarmWise AI, an expert agricultural assistant for Kerala farmers. Always respond in {word_limit} words or less. Speak directly to farmers using 'you'. Provide concise, practical advice without asterisks, bullet points, or special formatting."
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
            max_tokens=100,  # Reduced for concise responses
            temperature=0.7
        )

        # Clean up response - remove any asterisks or special formatting
        response_text = response.choices[0].message.content
        response_text = response_text.replace("*", "").replace("**", "").replace("#", "").strip()

        return {"response": response_text}

    except Exception as e:
        logging.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail="Error processing chat message")

@api_router.post("/ai/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI features are currently unavailable. Please configure the OpenAI API key.")

    try:
        # Be permissive with content-type as some browsers omit it on Blob uploads
        if file.content_type and not (file.content_type.startswith("audio/") or file.content_type.startswith("video/") or file.content_type == "application/octet-stream"):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

        # Read file bytes
        content = await file.read()
        if not content or len(content) == 0:
            raise HTTPException(status_code=400, detail="Received empty audio file")
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio file too large (max 20MB)")

        # Use Whisper (or gpt-4o-mini-transcribe) for multilingual transcription
        # The client expects a file-like object with a filename
        audio_file = io.BytesIO(content)
        audio_file.name = file.filename or "audio.webm"

        # Prefer whisper-1 for broad availability; fallback to gpt-4o-mini-transcribe
        try:
            logging.info(f"Transcribing with whisper-1, size={len(content)} bytes, type={file.content_type}")
            result = await openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        except Exception:
            logging.info("Falling back to gpt-4o-mini-transcribe")
            result = await openai_client.audio.transcriptions.create(
                model="gpt-4o-mini-transcribe",
                file=audio_file
            )

        # Result may have .text depending on SDK; normalize to { text }
        text = getattr(result, 'text', None)
        if not text and isinstance(result, dict):
            text = result.get('text')

        return {"text": text or ""}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Audio transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Error transcribing audio: {e}")

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
    return {"message": "FarmWise API is running", "mongodb": "connected" if db else "not configured"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mongodb": "connected" if db else "not configured",
        "openai": "available" if openai_client else "not configured"
    }

@api_router.get("/demo")
async def demo_data():
    """Provide demo/sample data when database is not available"""
    if db:
        return {"message": "Database is available - use regular endpoints"}

    demo_response = {
        "demo_mode": True,
        "message": "Database not available - running in demo mode",
        "sample_user": {
            "id": "demo-user-123",
            "name": "Demo Farmer",
            "location": {"district": "Kerala", "taluk": "Demo Taluk"},
            "crops": ["Rice", "Coconut", "Banana"]
        },
        "sample_crop": {
            "id": "demo-crop-456",
            "name": "Rice",
            "current_stage": "vegetative",
            "health_status": "good"
        },
        "available_endpoints": [
            "/weather/{lat}/{lon}",
            "/ai/identify-crop (with image)",
            "/ai/chat",
            "/ai/advice/{crop_id} (with generic advice)"
        ]
    }
    return demo_response

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

@app.on_event("startup")
async def startup_db_client():
    """Initialize MongoDB connection on application startup"""
    global client, db, mongo_url

    mongo_url = os.environ.get('MONGO_URL')
    if mongo_url:
        try:
            client = AsyncIOMotorClient(mongo_url)
            # Test the connection by pinging the server
            await client.admin.command('ping')
            db = client[os.environ.get('DB_NAME', 'farmwise_db')]
            logging.info("Successfully connected to MongoDB")
        except Exception as e:
            logging.error(f"Failed to connect to MongoDB: {e}")
            client = None
            db = None
            logging.warning("MongoDB not available - some features will be disabled")
    else:
        logging.warning("MONGO_URL not configured - MongoDB features will be disabled")

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)