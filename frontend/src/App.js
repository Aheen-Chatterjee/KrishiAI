import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

// Import UI components
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { toast, Toaster } from "sonner";

// Icons
import { 
  Leaf, 
  Sun, 
  Droplets, 
  Camera, 
  MessageCircle, 
  Mic,
  Plus, 
  Settings, 
  MapPin, 
  Calendar,
  Activity,
  Sprout,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Smartphone,
  Globe,
  ArrowRight,
  User,
  Home,
  Bot,
  Upload,
  ArrowLeft
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API = `${BACKEND_URL}/api`;

// Context for app state
const AppContext = createContext();

// Direct OpenAI API call for chat responses
const getAIResponse = async (message, cropName, imageBase64 = null) => {
  try {
    const API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
    if (!API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const messages = [
      {
        role: 'system',
        content: 'You are FarmWise AI, an expert agricultural assistant for Kerala farmers. Provide helpful, practical advice in a friendly, conversational manner.'
      }
    ];

    const cropContext = cropName ? `The farmer is asking about their ${cropName} crop.` : '';
    const messageText = `${cropContext}\n\nFarmer's question: ${message}`;

    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: messageText
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: messageText
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    } else {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(`Chat service unavailable: ${error.message}`);
  }
};

// Direct OpenAI API call for agricultural advice
const getAIAdvice = async (cropName, location, weatherData, activities = []) => {
  try {
    const API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
    if (!API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const weatherContext = weatherData && !weatherData.error
      ? `Current weather: ${weatherData.weather[0].description}, Temperature: ${weatherData.main.temp}°C, Humidity: ${weatherData.main.humidity}%`
      : 'Weather data unavailable';

    const activityContext = activities.length > 0
      ? `Recent activities: ${activities.map(a => `${a.type} (${a.description})`).join(', ')}`
      : 'No recent activities logged';

    const prompt = `As an agricultural expert for Kerala, India, provide specific advice for ${cropName} cultivation.

Location: ${location.district || 'Kerala'}, ${location.taluk || ''}
${weatherContext}
${activityContext}

Please provide:
1. Current care recommendations for ${cropName}
2. Weather-based advice for Kerala climate
3. Common issues to watch for
4. Best practices for this region

Keep advice practical and focused on Kerala farming conditions.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert agricultural advisor specializing in Kerala, India farming practices. Provide practical, actionable advice for farmers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    } else {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(`AI advice service unavailable: ${error.message}`);
  }
};

// Weather data with direct WeatherAPI call using district name
const getWeatherData = async (location = 'Thiruvananthapuram, Kerala') => {
  try {
    const API_KEY = process.env.REACT_APP_WEATHERAPI_KEY;
    if (!API_KEY) {
      throw new Error('WeatherAPI key not configured');
    }

    // If location is an object, extract district
    const query = typeof location === 'object'
      ? `${location.district || 'Thiruvananthapuram'}, Kerala, India`
      : `${location}, Kerala, India`;

    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${encodeURIComponent(query)}&aqi=no`
    );

    if (response.ok) {
      const data = await response.json();
      return {
        main: {
          temp: Math.round(data.current.temp_c),
          humidity: data.current.humidity
        },
        weather: [{
          description: data.current.condition.text.toLowerCase(),
          main: data.current.condition.text
        }],
        wind: { speed: data.current.wind_kph }
      };
    } else {
      throw new Error(`WeatherAPI error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    return {
      error: true,
      message: `Weather service unavailable: ${error.message}`
    };
  }
};

// Landing Page Component
function LandingPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState("english");

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <div className="container mx-auto px-4 py-8 max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Leaf className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-green-800 mb-2">KrishiAI</h1>
          <p className="text-green-600 text-lg">Kerala's Intelligent Farming Assistant</p>
        </div>

        {/* Language Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-full p-1 shadow-md">
            <Button
              variant={language === "malayalam" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLanguage("malayalam")}
              className="rounded-full"
            >
              മലയാളം
            </Button>
            <Button
              variant={language === "english" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLanguage("english")}
              className="rounded-full"
            >
              English
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <Card className="border-green-200 shadow-sm">
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800">AI-Powered Advice</h3>
                <p className="text-sm text-green-600">Get personalized farming recommendations</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-sm">
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800">Crop Identification</h3>
                <p className="text-sm text-green-600">Identify crops and diseases with AI</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-sm">
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Sun className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800">Weather Integration</h3>
                <p className="text-sm text-green-600">Real-time weather for better planning</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl"
            onClick={() => navigate('/onboarding')}
          >
            <User className="w-5 h-5 mr-2" />
            Continue as Guest
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full h-12 border-green-600 text-green-600 hover:bg-green-50 font-semibold rounded-xl"
            onClick={() => navigate('/onboarding')}
          >
            <Smartphone className="w-5 h-5 mr-2" />
            Sign up with Phone
          </Button>
        </div>

        <p className="text-center text-sm text-green-500 mt-6">
          🌾 Empowering Kerala farmers with AI • 50,000+ farmers helped
        </p>
      </div>
    </div>
  );
}

// Onboarding Component
function OnboardingFlow() {
  const navigate = useNavigate();
  const { setUser, setCrops } = useContext(AppContext);
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({
    name: "",
    location: { district: "", taluk: "", coordinates: [] },
    selectedCrops: [],
    farm_size: "",
    irrigation_type: ""
  });

  const handleLocationPermission = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              coordinates: [position.coords.longitude, position.coords.latitude]
            }
          }));
          toast.success("Location detected successfully!");
        },
        (error) => {
          toast.error("Please enable location access for better experience");
        }
      );
    }
  };

  const addCrop = (cropName) => {
    if (cropName && !userData.selectedCrops.includes(cropName)) {
      setUserData(prev => ({
        ...prev,
        selectedCrops: [...prev.selectedCrops, cropName]
      }));
    }
  };

  const removeCrop = (cropName) => {
    setUserData(prev => ({
      ...prev,
      selectedCrops: prev.selectedCrops.filter(crop => crop !== cropName)
    }));
  };

  const popularCrops = ["Rice", "Coconut", "Banana", "Pepper", "Cardamom", "Ginger", "Turmeric", "Rubber"];

  const handleComplete = () => {
    // Create user crops from selection
    const userCrops = userData.selectedCrops.map((cropName, index) => ({
      id: `crop-${index + 1}`,
      name: cropName,
      image_url: getCropImage(cropName),
      current_stage: getRandomStage(),
      health_status: getRandomHealth(),
      last_activity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      planting_date: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString()
    }));

    setUser(userData);
    setCrops(userCrops);
    toast.success("Welcome to FarmAssist!");
    navigate('/dashboard');
  };

  // Helper functions for generating crop data
  const getCropImage = (cropName) => {
    const imageMap = {
      "Rice": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop",
      "Coconut": "https://images.unsplash.com/photo-1601899775653-84124f2e93b7?w=300&h=200&fit=crop",
      "Banana": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=200&fit=crop",
      "Pepper": "https://images.unsplash.com/photo-1524247108137-732e0f642303?w=300&h=200&fit=crop",
      "Cardamom": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=300&h=200&fit=crop",
      "Ginger": "https://images.unsplash.com/photo-1615485020617-f7f9a21b4f55?w=300&h=200&fit=crop",
      "Turmeric": "https://images.unsplash.com/photo-1615485020542-11c0b37cece8?w=300&h=200&fit=crop",
      "Rubber": "https://images.unsplash.com/photo-1582718471137-c3967ffb1dc8?w=300&h=200&fit=crop"
    };
    return imageMap[cropName] || "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=200&fit=crop";
  };

  const getRandomStage = () => {
    const stages = ["planted", "growing", "flowering", "fruiting", "mature"];
    return stages[Math.floor(Math.random() * stages.length)];
  };

  const getRandomHealth = () => {
    const statuses = ["good", "good", "good", "warning", "good"]; // Weighted towards good
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-md">
        {/* Progress */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full ${
                  s <= step ? 'bg-green-600' : 'bg-green-200'
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <Card className="shadow-lg border-green-200">
            <CardHeader className="text-center">
              <CardTitle className="text-green-800">Welcome to FarmAssist!</CardTitle>
              <CardDescription>Let's set up your profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={userData.name}
                  onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Location</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Select onValueChange={(value) => setUserData(prev => ({ ...prev, location: { ...prev.location, district: value } }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="District" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thiruvananthapuram">Thiruvananthapuram</SelectItem>
                      <SelectItem value="kochi">Kochi</SelectItem>
                      <SelectItem value="thrissur">Thrissur</SelectItem>
                      <SelectItem value="kozhikode">Kozhikode</SelectItem>
                      <SelectItem value="kannur">Kannur</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Taluk"
                    value={userData.location.taluk}
                    onChange={(e) => setUserData(prev => ({ 
                      ...prev, 
                      location: { ...prev.location, taluk: e.target.value } 
                    }))}
                  />
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleLocationPermission}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Use My Location
              </Button>

              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => setStep(2)}
                disabled={!userData.name}
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="shadow-lg border-green-200">
            <CardHeader className="text-center">
              <CardTitle className="text-green-800">Your Crops</CardTitle>
              <CardDescription>Select crops you're growing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {popularCrops.map((crop) => (
                  <Button
                    key={crop}
                    variant={userData.selectedCrops.includes(crop) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (userData.selectedCrops.includes(crop)) {
                        removeCrop(crop);
                      } else {
                        addCrop(crop);
                      }
                    }}
                    className="h-12"
                  >
                    <Sprout className="w-4 h-4 mr-2" />
                    {crop}
                  </Button>
                ))}
              </div>

              {userData.selectedCrops.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Crops:</Label>
                  <div className="flex flex-wrap gap-2">
                    {userData.selectedCrops.map((crop) => (
                      <Badge 
                        key={crop} 
                        variant="secondary" 
                        className="bg-green-100 text-green-800 cursor-pointer"
                        onClick={() => removeCrop(crop)}
                      >
                        {crop} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => setStep(3)}
                  disabled={userData.selectedCrops.length === 0}
                >
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="shadow-lg border-green-200">
            <CardHeader className="text-center">
              <CardTitle className="text-green-800">Farm Details</CardTitle>
              <CardDescription>Optional - helps us provide better advice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Farm Size</Label>
                <Select onValueChange={(value) => setUserData(prev => ({ ...prev, farm_size: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select farm size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<1 acre">Less than 1 acre</SelectItem>
                    <SelectItem value="1-2 acres">1-2 acres</SelectItem>
                    <SelectItem value="2-5 acres">2-5 acres</SelectItem>
                    <SelectItem value="5+ acres">More than 5 acres</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Irrigation Type</Label>
                <Select onValueChange={(value) => setUserData(prev => ({ ...prev, irrigation_type: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select irrigation type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drip">Drip Irrigation</SelectItem>
                    <SelectItem value="sprinkler">Sprinkler</SelectItem>
                    <SelectItem value="flood">Flood Irrigation</SelectItem>
                    <SelectItem value="rain">Rain-fed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleComplete}
                >
                  Complete Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Home Dashboard Component
function HomePage() {
  const navigate = useNavigate();
  const { user, crops } = useContext(AppContext);
  const [weather, setWeather] = useState(null);

  const getHealthColor = (status) => {
    switch (status) {
      case 'good': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatLastActivity = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  useEffect(() => {
    const fetchWeather = async () => {
      const weatherData = await getWeatherData(user?.location);
      setWeather(weatherData);
    };
    fetchWeather();
  }, [user]);

  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 max-w-md">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-green-800">
                Welcome, {user.name}!
              </h1>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-1" />
                {user.location.district}, {user.location.taluk}
              </div>
            </div>
            <div className="text-right">
              {weather?.error ? (
                <div className="text-sm text-red-600">
                  Error: {weather.message}
                </div>
              ) : weather ? (
                <>
                  <div className="text-2xl font-bold text-green-600">
                    {weather.main?.temp}°C
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {weather.weather?.[0]?.description}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">Loading weather...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Weather Card */}
      <div className="container mx-auto px-4 py-4 max-w-md">
        <Card className={`${weather?.error ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'} text-white border-0 shadow-lg`}>
          <CardContent className="p-4">
            {weather?.error ? (
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <div className="text-sm font-semibold">Weather Service Error</div>
                <div className="text-xs opacity-90">{weather.message}</div>
              </div>
            ) : weather ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Sun className="w-8 h-8" />
                  <div>
                    <div className="text-sm opacity-90">Today's Weather</div>
                    <div className="font-semibold">
                      {weather.main?.temp}°C • {weather.main?.humidity}% humidity
                    </div>
                  </div>
                </div>
                <Droplets className="w-6 h-6 opacity-75" />
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm">Loading weather data...</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Crops Grid */}
      <div className="container mx-auto px-4 max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Your Crops ({crops.length})</h2>
          <Button 
            size="sm" 
            className="bg-green-600 hover:bg-green-700"
            onClick={() => navigate('/add-crop')}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Crop
          </Button>
        </div>

        {crops.length === 0 ? (
          <Card className="border-green-200 text-center p-8">
            <Sprout className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No crops yet</h3>
            <p className="text-gray-600 mb-4">Add your first crop to get started with AI-powered farming advice</p>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => navigate('/add-crop')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Crop
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-20">
            {crops.map((crop) => (
              <Card 
                key={crop.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-green-200"
                onClick={() => navigate(`/crop/${crop.id}`)}
              >
                <CardContent className="p-0">
                  <div className="relative">
                    <img
                      src={crop.image_url}
                      alt={crop.name}
                      className="w-full h-32 object-cover rounded-t-lg"
                    />
                    <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getHealthColor(crop.health_status)}`} />
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-green-800 mb-1">{crop.name}</h3>
                    <div className="text-xs text-gray-500 mb-2">
                      Stage: {crop.current_stage}
                    </div>
                    <div className="text-xs text-gray-400">
                      Last activity: {formatLastActivity(crop.last_activity)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 max-w-md">
          <div className="flex justify-around py-3">
            <Button variant="ghost" size="sm" className="flex-col h-auto py-2">
              <Home className="w-5 h-5 mb-1 text-green-600" />
              <span className="text-xs text-green-600">Home</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex-col h-auto py-2">
              <MessageCircle className="w-5 h-5 mb-1 text-gray-400" />
              <span className="text-xs text-gray-400">Community</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex-col h-auto py-2">
              <User className="w-5 h-5 mb-1 text-gray-400" />
              <span className="text-xs text-gray-400">Profile</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Crop Detail Component
function CropDetailPage() {
  const navigate = useNavigate();
  const { cropId } = useParams();
  const { crops, user } = useContext(AppContext);
  const [activities, setActivities] = useState([
    {
      id: "1",
      type: "watering",
      description: "Watered the field",
      date: "2025-01-15T10:30:00Z",
      quantity: "500L",
      notes: "Morning irrigation"
    },
    {
      id: "2", 
      type: "fertilizer",
      description: "Applied organic fertilizer",
      date: "2025-01-10T08:00:00Z",
      quantity: "2kg",
      notes: "Used cow dung compost"
    }
  ]);

  const [aiAdvice, setAiAdvice] = useState("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const crop = crops.find(c => c.id === cropId);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'watering': return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'fertilizer': return <Sprout className="w-4 h-4 text-green-500" />;
      case 'pesticide': return <Activity className="w-4 h-4 text-orange-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAdvice = async () => {
    setLoadingAdvice(true);
    try {
      // Use crop name instead of crop ID
      const response = await fetch(`${API}/ai/advice/${encodeURIComponent(crop.name)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAiAdvice(data.advice);
      } else {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setAiAdvice(`Error getting AI advice: ${error.message}`);
    } finally {
      setLoadingAdvice(false);
    }
  };

  useEffect(() => {
    if (crop) {
      getAdvice();
    }
  }, [crop]);

  if (!crop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Crop not found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 max-w-md">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-green-800">{crop.name}</h1>
            <div className="ml-auto">
              <Button variant="ghost" size="sm">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 max-w-md space-y-4 pb-24">
        {/* Crop Image */}
        <Card className="border-green-200">
          <CardContent className="p-0">
            <div className="relative">
              <img
                src={crop.image_url}
                alt={crop.name}
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button 
                size="sm" 
                className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70"
                onClick={() => navigate(`/crop/${crop.id}/camera`)}
              >
                <Camera className="w-4 h-4 mr-1" />
                Update Photo
              </Button>
              <Badge 
                className={`absolute top-2 left-2 ${
                  crop.health_status === 'good' ? 'bg-green-500' : 
                  crop.health_status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              >
                {crop.health_status === 'good' ? 'Healthy' : 
                 crop.health_status === 'warning' ? 'Needs Attention' : 'Critical'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* AI Advice */}
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-green-800">AI Advisory</CardTitle>
              <Bot className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingAdvice ? (
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                <span>Generating personalized advice...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-700 whitespace-pre-line">
                  {aiAdvice}
                </div>
                <Badge variant="secondary" className="text-xs">
                  Powered by AI • Updated just now
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-green-800">Recent Activities</CardTitle>
              <Button size="sm" variant="outline">View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.slice(0, 3).map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-2 rounded-lg bg-gray-50">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">
                      {activity.description}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center space-x-3">
                      <span>{new Date(activity.date).toLocaleDateString()}</span>
                      {activity.quantity && <span>• {activity.quantity}</span>}
                    </div>
                    {activity.notes && (
                      <div className="text-xs text-gray-600 mt-1">
                        {activity.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        <Button 
          className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl"
          onClick={() => navigate(`/crop/${crop.id}/add-activity`)}
        >
          <Plus className="w-5 h-5 mr-2" />
          Log New Activity
        </Button>
      </div>

      {/* Fixed Bottom Chat Button */}
      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
        <Button 
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg"
          onClick={() => navigate(`/crop/${crop.id}/chat`)}
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Get AI Help
        </Button>
      </div>
    </div>
  );
}

// Chat Interface Component
function ChatInterface() {
  const navigate = useNavigate();
  const { cropId } = useParams();
  const { crops } = useContext(AppContext);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const crop = crops.find(c => c.id === cropId);

  useEffect(() => {
    // Initialize chat with welcome message
    setMessages([{
      id: "1",
      text: `Hello! I'm your AI farming assistant. I can help you with questions about your ${crop?.name || 'crops'}. What would you like to know?`,
      isBot: true,
      timestamp: new Date()
    }]);
  }, [crop]);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        toast.error("Error: Recording not supported in this browser");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          const res = await fetch(`${API}/ai/transcribe`, { method: 'POST', body: formData });
          if (!res.ok) throw new Error(`Transcription API error: ${res.status} ${res.statusText}`);
          const { text } = await res.json();
          if (text) {
            setInputMessage(text);
            toast.success('Transcribed voice to text');
          } else {
            toast.error('Error: No text returned from transcription service');
          }
        } catch (err) {
          console.error(err);
          toast.error(`Error: ${err.message}`);
        } finally {
          stream.getTracks().forEach(t => t.stop());
        }
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() && !selectedImage) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date(),
      image: selectedImage ? previewUrl : null
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      let imageBase64 = null;
      if (selectedImage) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(selectedImage);
        });
      }

      // Use backend for chat to avoid CORS issues
      const response = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          crop_id: cropId,
          image_base64: imageBase64
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          isBot: true,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botResponse]);
      } else {
        throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const botResponse = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${error.message}`,
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    } finally {
      setIsLoading(false);
      setSelectedImage(null);
      setPreviewUrl(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 max-w-md">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/crop/${cropId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">AI Assistant</h1>
                <div className="text-sm text-green-600">
                  {crop ? `Helping with ${crop.name}` : 'General Farming Help'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 container mx-auto px-4 py-4 max-w-md">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.isBot
                    ? 'bg-white border border-gray-200'
                    : 'bg-green-600 text-white'
                }`}
              >
                {message.image && (
                  <div className="mb-2">
                    <img
                      src={message.image}
                      alt="Uploaded"
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
                <div className="text-sm">{message.text}</div>
                <div
                  className={`text-xs mt-1 ${
                    message.isBot ? 'text-gray-500' : 'text-green-100'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Image Preview */}
      {previewUrl && (
        <div className="bg-white border-t p-4">
          <div className="container mx-auto max-w-md">
            <div className="flex items-center space-x-2">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Image ready to send</p>
                <p className="text-xs text-gray-500">Tap send to include with your message</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={removeImage}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t p-4">
        <div className="container mx-auto max-w-md">
          <div className="flex space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              id="chat-image-upload"
            />
            <Button variant="outline" size="sm" className="flex-shrink-0" asChild>
              <label htmlFor="chat-image-upload" className="cursor-pointer">
                <Camera className="w-4 h-4" />
              </label>
            </Button>
            <Input
              placeholder="Ask about your crops..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1"
            />
            <Button
              type="button"
              variant={isRecording ? 'destructive' : 'outline'}
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              onClick={sendMessage}
              disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Camera Page Component
function CameraPage() {
  const navigate = useNavigate();
  const { cropId } = useParams();
  const { crops, setCrops } = useContext(AppContext);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cropIdentification, setCropIdentification] = useState(null);

  const crop = crops.find(c => c.id === cropId);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedImage);

      const response = await fetch(`${API}/upload-and-identify-crop`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setCropIdentification(result.crop_identification);

        // Update crop with new image
        if (crop) {
          const updatedCrops = crops.map(c =>
            c.id === cropId ? { ...c, image_url: result.image_url } : c
          );
          setCrops(updatedCrops);
        }

        toast.success("Image uploaded successfully!");
      } else {
        throw new Error(`Upload API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setCropIdentification(`Error: ${error.message}`);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setCropIdentification(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 max-w-md">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/crop/${cropId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-green-800">Update Photo</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 max-w-md space-y-4">
        {/* Current Crop Info */}
        {crop && (
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <img
                  src={crop.image_url}
                  alt={crop.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div>
                  <h3 className="font-semibold text-green-800">{crop.name}</h3>
                  <p className="text-sm text-gray-600">Current photo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image Upload Area */}
        <Card className="border-green-200">
          <CardContent className="p-4">
            {!selectedImage ? (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-green-800 mb-2">Take a New Photo</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload a clear photo of your crop for better identification
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <Button asChild>
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Camera className="w-4 h-4 mr-2" />
                    Choose Photo
                  </label>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Image Preview */}
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                    onClick={handleRetake}
                  >
                    <Camera className="w-4 h-4 mr-1" />
                    Retake
                  </Button>
                </div>

                {/* Upload Button */}
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isUploading ? (
                    <>
                      <div className="loading-spinner w-4 h-4 mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photo
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crop Identification Result */}
        {cropIdentification && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-800 mb-2">AI Crop Identification</h3>
                  <p className="text-sm text-blue-700">{cropIdentification}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {selectedImage && (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleRetake}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => navigate(`/crop/${cropId}`)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App Component with Router
function App() {
  const [user, setUser] = useState(null);
  const [crops, setCrops] = useState([]);

  const contextValue = {
    user,
    setUser,
    crops,
    setCrops
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="App font-inter">
        <Toaster position="top-center" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/onboarding" element={<OnboardingFlow />} />
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/crop/:cropId" element={<CropDetailPage />} />
            <Route path="/crop/:cropId/chat" element={<ChatInterface />} />
            <Route path="/crop/:cropId/camera" element={<CameraPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AppContext.Provider>
  );
}

export default App;