import requests
import sys
import json
import uuid
from datetime import datetime

class FarmWiseAPITester:
    def __init__(self, base_url="https://farmwise-8.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_id = None
        self.test_crop_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=10)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        # Test root endpoint
        self.run_test("Root Health Check", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_user_management(self):
        """Test user management endpoints"""
        print("\n" + "="*50)
        print("TESTING USER MANAGEMENT")
        print("="*50)
        
        # Create user
        user_data = {
            "name": f"Test User {datetime.now().strftime('%H%M%S')}",
            "phone": "+919876543210",
            "location": {
                "district": "thiruvananthapuram",
                "taluk": "neyyattinkara",
                "coordinates": [76.9366, 8.5241]
            }
        }
        
        success, response = self.run_test("Create User", "POST", "users", 200, user_data)
        if success and 'id' in response:
            self.test_user_id = response['id']
            print(f"   Created user with ID: {self.test_user_id}")
            
            # Get user
            self.run_test("Get User", "GET", f"users/{self.test_user_id}", 200)
            
            # Update user
            update_data = {
                "crops": ["Rice", "Coconut"],
                "farm_size": "2-5 acres",
                "irrigation_type": "drip"
            }
            self.run_test("Update User", "PUT", f"users/{self.test_user_id}", 200, update_data)
        else:
            print("❌ Failed to create user, skipping user tests")

    def test_crop_management(self):
        """Test crop management endpoints"""
        print("\n" + "="*50)
        print("TESTING CROP MANAGEMENT")
        print("="*50)
        
        if not self.test_user_id:
            print("❌ No test user available, skipping crop tests")
            return
        
        # Create crop - API expects JSON body + form field for user_id
        # Let's try a different approach using multipart form data
        crop_json = {
            "name": "Rice",
            "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop",
            "planting_date": datetime.now().isoformat()
        }
        
        try:
            url = f"{self.api_url}/crops"
            
            # Try with multipart form data
            files = {
                'crop_data': (None, json.dumps(crop_json), 'application/json'),
                'user_id': (None, self.test_user_id)
            }
            
            response = requests.post(url, files=files, timeout=10)
            
            self.tests_run += 1
            print(f"\n🔍 Testing Create Crop...")
            print(f"   URL: {url}")
            
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                response_data = response.json()
                self.test_crop_id = response_data.get('id')
                print(f"   Created crop with ID: {self.test_crop_id}")
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Error: {response.text}")
                
                # Try alternative approach with JSON body and form data
                print("   Trying alternative approach...")
                data = {'user_id': self.test_user_id}
                headers = {'Content-Type': 'application/json'}
                response2 = requests.post(url, json=crop_json, data=data, timeout=10)
                
                if response2.status_code == 200:
                    print(f"✅ Alternative approach worked - Status: {response2.status_code}")
                    response_data = response2.json()
                    self.test_crop_id = response_data.get('id')
                    print(f"   Created crop with ID: {self.test_crop_id}")
                else:
                    print(f"❌ Alternative approach also failed - Status: {response2.status_code}")
                    print(f"   Error: {response2.text}")
                    
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
        
        if self.test_crop_id:
            # Get user crops
            self.run_test("Get User Crops", "GET", f"crops/{self.test_user_id}", 200)
            
            # Get specific crop
            self.run_test("Get Crop", "GET", f"crop/{self.test_crop_id}", 200)
            
            # Update crop
            update_data = {
                "current_stage": "flowering",
                "health_status": "good"
            }
            self.run_test("Update Crop", "PUT", f"crop/{self.test_crop_id}", 200, update_data)

    def test_activity_management(self):
        """Test activity management endpoints"""
        print("\n" + "="*50)
        print("TESTING ACTIVITY MANAGEMENT")
        print("="*50)
        
        if not self.test_crop_id:
            print("❌ No test crop available, skipping activity tests")
            return
        
        # Create activity
        activity_data = {
            "crop_id": self.test_crop_id,
            "type": "watering",
            "description": "Watered the rice field",
            "quantity": "500L",
            "notes": "Morning irrigation"
        }
        
        success, response = self.run_test("Create Activity", "POST", "activities", 200, activity_data)
        
        if success:
            # Get crop activities
            self.run_test("Get Crop Activities", "GET", f"activities/{self.test_crop_id}", 200)

    def test_ai_features(self):
        """Test AI-powered features"""
        print("\n" + "="*50)
        print("TESTING AI FEATURES")
        print("="*50)
        
        if not self.test_crop_id:
            print("❌ No test crop available, skipping AI tests")
            return
        
        # Test AI advice
        print("⏳ Testing AI advice (this may take a few seconds)...")
        success, response = self.run_test("Get AI Advice", "POST", f"ai/advice/{self.test_crop_id}", 200)
        
        # Test AI chat
        chat_data = {
            "message": "How should I care for my rice crop?",
            "crop_id": self.test_crop_id
        }
        print("⏳ Testing AI chat (this may take a few seconds)...")
        self.run_test("AI Chat", "POST", "ai/chat", 200, chat_data)
        
        # Test crop identification (with a dummy image file)
        print("⏳ Testing crop identification...")
        # Create a small dummy image file for testing
        dummy_image_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        files = {'image': ('test.png', dummy_image_content, 'image/png')}
        self.run_test("Crop Identification", "POST", "ai/identify-crop", 200, files=files)

    def test_weather_endpoint(self):
        """Test weather endpoint"""
        print("\n" + "="*50)
        print("TESTING WEATHER ENDPOINT")
        print("="*50)
        
        # Test weather endpoint with Kerala coordinates
        lat, lon = 8.5241, 76.9366  # Thiruvananthapuram coordinates
        self.run_test("Get Weather Data", "GET", f"weather/{lat}/{lon}", 404)  # Expecting 404 as OpenWeather key is placeholder

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n" + "="*50)
        print("CLEANING UP TEST DATA")
        print("="*50)
        
        if self.test_crop_id:
            self.run_test("Delete Test Crop", "DELETE", f"crop/{self.test_crop_id}", 200)

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting FarmWise API Tests")
        print(f"🌐 Base URL: {self.base_url}")
        
        try:
            self.test_health_endpoints()
            self.test_user_management()
            self.test_crop_management()
            self.test_activity_management()
            self.test_ai_features()
            self.test_weather_endpoint()
            self.cleanup_test_data()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error: {str(e)}")
        
        # Print final results
        print("\n" + "="*50)
        print("FINAL TEST RESULTS")
        print("="*50)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            failed_tests = self.tests_run - self.tests_passed
            print(f"❌ {failed_tests} test(s) failed")
            return 1

def main():
    tester = FarmWiseAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())