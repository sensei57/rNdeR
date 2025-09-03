import requests
import sys
from datetime import datetime
import json

class MedicalStaffAPITester:
    def __init__(self, base_url="https://staffcare-mgmt.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test users provided
        self.test_users = {
            "directeur": {"email": "directeur@hopital.fr", "password": "directeur123"},
            "medecin": {"email": "medecin1@hopital.fr", "password": "medecin123"},
            "assistant": {"email": "assistant1@hopital.fr", "password": "assistant123"},
            "secretaire": {"email": "secretaire1@hopital.fr", "password": "secretaire123"}
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Response text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self, role, email, password):
        """Test login for a specific role"""
        success, response = self.run_test(
            f"Login {role}",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.tokens[role] = response['access_token']
            self.users[role] = response['user']
            print(f"   Token obtained for {role}: {response['user']['role']}")
            return True
        return False

    def test_protected_route_access(self):
        """Test access to protected routes with and without token"""
        print("\n📋 Testing Protected Route Access...")
        
        # Test without token (should fail)
        success, _ = self.run_test(
            "Access /users without token",
            "GET",
            "users",
            401
        )
        
        # Test with directeur token (should succeed)
        if 'directeur' in self.tokens:
            success, _ = self.run_test(
                "Access /users with directeur token",
                "GET",
                "users",
                200,
                token=self.tokens['directeur']
            )
        
        # Test with non-directeur token (should fail - 403)
        if 'medecin' in self.tokens:
            success, _ = self.run_test(
                "Access /users with medecin token (should fail)",
                "GET",
                "users",
                403,
                token=self.tokens['medecin']
            )

    def test_user_management(self):
        """Test user management endpoints"""
        print("\n👥 Testing User Management...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping user management tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        
        # Get all users (directeur only)
        success, users_data = self.run_test(
            "Get all users",
            "GET",
            "users",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(users_data)} users")
            for user in users_data:
                print(f"   - {user['prenom']} {user['nom']} ({user['role']})")
        
        # Get users by role
        for role in ["Médecin", "Assistant", "Secrétaire"]:
            success, role_users = self.run_test(
                f"Get users by role: {role}",
                "GET",
                f"users/by-role/{role}",
                200,
                token=directeur_token
            )
            if success:
                print(f"   Found {len(role_users)} {role}s")
        
        # Get current user info
        success, user_info = self.run_test(
            "Get current user info",
            "GET",
            "users/me",
            200,
            token=directeur_token
        )
        if success:
            print(f"   Current user: {user_info['prenom']} {user_info['nom']} ({user_info['role']})")

    def test_assignations(self):
        """Test assistant assignments"""
        print("\n🔗 Testing Assignations...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping assignation tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        
        # Get existing assignations
        success, assignations = self.run_test(
            "Get assignations",
            "GET",
            "assignations",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(assignations)} assignations")
            for assignation in assignations:
                if assignation.get('medecin') and assignation.get('assistant'):
                    print(f"   - Dr. {assignation['medecin']['prenom']} {assignation['medecin']['nom']} -> {assignation['assistant']['prenom']} {assignation['assistant']['nom']}")

    def test_leave_management(self):
        """Test leave management system"""
        print("\n🏖️ Testing Leave Management...")
        
        # Test getting leave requests with different roles
        for role in ['directeur', 'medecin', 'assistant']:
            if role in self.tokens:
                success, demandes = self.run_test(
                    f"Get leave requests as {role}",
                    "GET",
                    "conges",
                    200,
                    token=self.tokens[role]
                )
                if success:
                    print(f"   {role} can see {len(demandes)} leave requests")

    def test_room_reservations(self):
        """Test room reservation system"""
        print("\n🏥 Testing Room Reservations...")
        
        if 'medecin' in self.tokens:
            success, reservations = self.run_test(
                "Get room reservations",
                "GET",
                "salles/reservations",
                200,
                token=self.tokens['medecin']
            )
            if success:
                print(f"   Found {len(reservations)} room reservations")

    def test_general_notes(self):
        """Test general notes system"""
        print("\n📝 Testing General Notes...")
        
        if 'directeur' in self.tokens:
            success, notes = self.run_test(
                "Get general notes",
                "GET",
                "notes",
                200,
                token=self.tokens['directeur']
            )
            if success:
                print(f"   Found {len(notes)} general notes")

def main():
    print("🏥 Testing Medical Staff Management API")
    print("=" * 50)
    
    tester = MedicalStaffAPITester()
    
    # Test authentication for all roles
    print("\n🔐 Testing Authentication...")
    login_success = True
    for role, credentials in tester.test_users.items():
        if not tester.test_login(role, credentials['email'], credentials['password']):
            print(f"❌ Login failed for {role}")
            login_success = False
    
    if not login_success:
        print("\n❌ Authentication tests failed. Cannot proceed with other tests.")
        return 1
    
    # Test protected routes and role-based access
    tester.test_protected_route_access()
    
    # Test user management
    tester.test_user_management()
    
    # Test assignations
    tester.test_assignations()
    
    # Test leave management
    tester.test_leave_management()
    
    # Test room reservations
    tester.test_room_reservations()
    
    # Test general notes
    tester.test_general_notes()
    
    # Print final results
    print(f"\n📊 Test Results:")
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())