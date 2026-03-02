#!/usr/bin/env python3
"""
TEST FINAL - Vérification complète après restructuration
Backend API Testing Script for Medical Office Management System
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://mongo-render-deploy.preview.emergentagent.com/api"
LOGIN_EMAIL = "directeur@cabinet.fr"
LOGIN_PASSWORD = "admin123"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.test_results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "details": []
        }

    def log_test(self, test_name, success, details):
        """Log test results"""
        self.test_results["total_tests"] += 1
        if success:
            self.test_results["passed_tests"] += 1
            status = "✅ PASS"
        else:
            self.test_results["failed_tests"] += 1
            status = "❌ FAIL"
        
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results["details"].append(result)
        print(f"{status}: {test_name}")
        print(f"    Details: {details}")
        print()

    def test_health_endpoint(self):
        """Test 1: GET /api/health"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("mongo_connected") == True:
                    self.log_test("GET /api/health", True, 
                                f"Status 200 - Backend healthy, MongoDB connected: {data}")
                else:
                    self.log_test("GET /api/health", False, 
                                f"Status 200 but unhealthy response: {data}")
            else:
                self.log_test("GET /api/health", False, 
                            f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("GET /api/health", False, f"Exception: {str(e)}")

    def test_status_endpoint(self):
        """Test 2: GET /api/status (si disponible)"""
        try:
            response = requests.get(f"{self.base_url}/status", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("GET /api/status", True, 
                            f"Status 200 - System status: {data}")
            else:
                self.log_test("GET /api/status", False, 
                            f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("GET /api/status", False, f"Exception: {str(e)}")

    def test_authentication(self):
        """Test 3: POST /api/auth/login"""
        try:
            login_data = {
                "email": LOGIN_EMAIL,
                "password": LOGIN_PASSWORD
            }
            
            response = requests.post(
                f"{self.base_url}/auth/login", 
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                user_data = data.get("user", {})
                
                if self.token and user_data.get("email") == LOGIN_EMAIL:
                    self.log_test("POST /api/auth/login", True, 
                                f"Login successful - Token obtained, User: {user_data.get('prenom')} {user_data.get('nom')} ({user_data.get('role')})")
                else:
                    self.log_test("POST /api/auth/login", False, 
                                f"Login response missing token or user data: {data}")
            else:
                self.log_test("POST /api/auth/login", False, 
                            f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("POST /api/auth/login", False, f"Exception: {str(e)}")

    def test_firebase_status(self):
        """Test 4: GET /api/notifications/firebase-status"""
        if not self.token:
            self.log_test("GET /api/notifications/firebase-status", False, 
                        "No authentication token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(
                f"{self.base_url}/notifications/firebase-status", 
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                initialized = data.get("initialized", False)
                credentials_source = data.get("credentials_source", "none")
                
                self.log_test("GET /api/notifications/firebase-status", True, 
                            f"Status 200 - Firebase initialized: {initialized}, credentials_source: {credentials_source}, data: {data}")
            else:
                self.log_test("GET /api/notifications/firebase-status", False, 
                            f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("GET /api/notifications/firebase-status", False, f"Exception: {str(e)}")

    def test_scheduler_status(self):
        """Test 5: GET /api/notifications/scheduler-status"""
        if not self.token:
            self.log_test("GET /api/notifications/scheduler-status", False, 
                        "No authentication token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(
                f"{self.base_url}/notifications/scheduler-status", 
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                scheduler_running = data.get("scheduler_running", False)
                jobs = data.get("jobs", [])
                
                # Rechercher le job daily_planning_notification
                daily_job_found = any(job.get("id") == "daily_planning_notification" for job in jobs)
                
                if scheduler_running and daily_job_found:
                    self.log_test("GET /api/notifications/scheduler-status", True, 
                                f"Status 200 - Scheduler running: {scheduler_running}, Daily planning job found: {daily_job_found}, data: {data}")
                else:
                    self.log_test("GET /api/notifications/scheduler-status", False, 
                                f"Status 200 but scheduler or daily job missing - scheduler_running: {scheduler_running}, daily_job_found: {daily_job_found}, data: {data}")
            else:
                self.log_test("GET /api/notifications/scheduler-status", False, 
                            f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("GET /api/notifications/scheduler-status", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Execute all tests in sequence"""
        print("🔍 TEST FINAL - VÉRIFICATION COMPLÈTE APRÈS RESTRUCTURATION")
        print("=" * 70)
        print(f"Backend URL: {self.base_url}")
        print(f"Login Credentials: {LOGIN_EMAIL} / {LOGIN_PASSWORD}")
        print(f"Test started at: {datetime.now().isoformat()}")
        print()

        # Execute tests
        self.test_health_endpoint()
        self.test_status_endpoint()
        self.test_authentication()
        self.test_firebase_status()
        self.test_scheduler_status()

        # Print summary
        print("=" * 70)
        print("🎯 TEST SUMMARY")
        print("=" * 70)
        
        total = self.test_results["total_tests"]
        passed = self.test_results["passed_tests"]
        failed = self.test_results["failed_tests"]
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        if failed == 0:
            print("🎉 ALL TESTS PASSED - System is operational after restructuration!")
        else:
            print("⚠️ Some tests failed - Check details above")
            
        return failed == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)