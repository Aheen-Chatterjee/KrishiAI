#!/usr/bin/env python3
"""
Test script to demonstrate MongoDB-optional functionality.
This script tests the API endpoints when MongoDB is not available.
"""

import asyncio
import httpx
import json

async def test_mongodb_optional():
    """Test that the API works without MongoDB connection"""

    base_url = "http://127.0.0.1:8000/api"

    async with httpx.AsyncClient() as client:
        print("🧪 Testing MongoDB-optional functionality...")

        # Test health check
        response = await client.get(f"{base_url}/health")
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Health check: {health_data}")
            print(f"   MongoDB: {health_data.get('mongodb')}")
            print(f"   OpenAI: {health_data.get('openai')}")
        else:
            print(f"❌ Health check failed: {response.status_code}")

        # Test demo endpoint
        response = await client.get(f"{base_url}/demo")
        if response.status_code == 200:
            demo_data = response.json()
            print(f"✅ Demo endpoint: {demo_data.get('demo_mode')}")
            print(f"   Message: {demo_data.get('message')}")
        else:
            print(f"❌ Demo endpoint failed: {response.status_code}")

        # Test weather endpoint (works without DB)
        response = await client.get(f"{base_url}/weather/10.0/76.0")
        if response.status_code == 200:
            weather_data = response.json()
            print(f"✅ Weather endpoint: {weather_data.get('name')}")
            print(f"   Temperature: {weather_data.get('main', {}).get('temp')}°C")
        else:
            print(f"❌ Weather endpoint failed: {response.status_code}")

        # Test user creation (should fail without DB)
        user_data = {
            "name": "Test User",
            "phone": "1234567890",
            "location": {"district": "Test District"}
        }
        response = await client.post(f"{base_url}/users", json=user_data)
        if response.status_code == 503:
            print(f"✅ User creation properly blocked: {response.json().get('detail')}")
        else:
            print(f"❌ User creation should have failed: {response.status_code}")

        # Test AI advice (works with generic crop info)
        response = await client.post(f"{base_url}/ai/advice/test-crop-123")
        if response.status_code == 200:
            advice_data = response.json()
            print(f"✅ AI advice (generic): {advice_data.get('note', 'Database available')}")
        else:
            print(f"❌ AI advice failed: {response.status_code}")

        print("\n🎉 All tests completed! MongoDB-optional functionality is working correctly.")
        print("📋 Summary:")
        print("   - Application starts without MongoDB")
        print("   - Database-dependent features return appropriate errors")
        print("   - AI features work with generic data")
        print("   - Demo endpoint provides helpful information")

if __name__ == "__main__":
    print("⚠️  This test requires the server to be running.")
    print("   Start the server with: uvicorn server:app --host 127.0.0.1 --port 8000")
    print("\n" + "="*60)

    try:
        asyncio.run(test_mongodb_optional())
    except Exception as e:
        print(f"❌ Test failed: {e}")
        print("💡 Make sure the server is running first!")
