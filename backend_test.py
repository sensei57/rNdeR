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
        """Test comprehensive leave management system"""
        print("\n🏖️ Testing Leave Management...")
        
        created_requests = []
        
        # Test creating leave requests for different roles
        leave_types = ["CONGE_PAYE", "RTT", "MALADIE", "FORMATION"]
        
        for i, role in enumerate(['medecin', 'assistant', 'secretaire']):
            if role in self.tokens:
                from datetime import timedelta
                start_date = (datetime.now() + timedelta(days=7 + i*3)).strftime('%Y-%m-%d')
                end_date = (datetime.now() + timedelta(days=9 + i*3)).strftime('%Y-%m-%d')
                
                leave_data = {
                    "date_debut": start_date,
                    "date_fin": end_date,
                    "type_conge": leave_types[i % len(leave_types)],
                    "motif": f"Test leave request by {role}"
                }
                
                success, response = self.run_test(
                    f"Create leave request as {role}",
                    "POST",
                    "conges",
                    200,
                    data=leave_data,
                    token=self.tokens[role]
                )
                
                if success and 'id' in response:
                    created_requests.append({
                        'id': response['id'],
                        'role': role,
                        'type': leave_types[i % len(leave_types)]
                    })
                    print(f"   ✓ Created {leave_types[i % len(leave_types)]} request for {role}")
        
        # Test getting leave requests with different roles
        for role in ['directeur', 'medecin', 'assistant', 'secretaire']:
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
                    
                    # Verify role-based access
                    if role == 'directeur':
                        print(f"   ✓ Director sees all requests from all users")
                    else:
                        # Check if user only sees their own requests
                        user_id = self.users[role]['id']
                        own_requests = [req for req in demandes if req.get('utilisateur_id') == user_id]
                        if len(own_requests) == len(demandes):
                            print(f"   ✓ {role} only sees their own requests")
                        else:
                            print(f"   ⚠️  {role} might be seeing other users' requests")
        
        # Test approval functionality (Director only)
        if 'directeur' in self.tokens and created_requests:
            print(f"\n   Testing approval functionality...")
            
            # Test approving a request
            if len(created_requests) > 0:
                request_id = created_requests[0]['id']
                approval_data = {
                    "approuve": True,
                    "commentaire": "Approved for testing purposes"
                }
                
                success, response = self.run_test(
                    "Approve leave request (Director)",
                    "PUT",
                    f"conges/{request_id}/approuver",
                    200,
                    data=approval_data,
                    token=self.tokens['directeur']
                )
                
                if success:
                    print(f"   ✓ Successfully approved leave request")
            
            # Test rejecting a request
            if len(created_requests) > 1:
                request_id = created_requests[1]['id']
                rejection_data = {
                    "approuve": False,
                    "commentaire": "Rejected for testing purposes"
                }
                
                success, response = self.run_test(
                    "Reject leave request (Director)",
                    "PUT",
                    f"conges/{request_id}/approuver",
                    200,
                    data=rejection_data,
                    token=self.tokens['directeur']
                )
                
                if success:
                    print(f"   ✓ Successfully rejected leave request")
        
        # Test unauthorized approval attempts
        if created_requests and len(created_requests) > 2:
            print(f"\n   Testing unauthorized approval attempts...")
            request_id = created_requests[2]['id']
            
            for role in ['medecin', 'assistant', 'secretaire']:
                if role in self.tokens:
                    approval_data = {
                        "approuve": True,
                        "commentaire": "Unauthorized approval attempt"
                    }
                    
                    success, response = self.run_test(
                        f"Unauthorized approval attempt ({role})",
                        "PUT",
                        f"conges/{request_id}/approuver",
                        403,  # Should be forbidden
                        data=approval_data,
                        token=self.tokens[role]
                    )
                    
                    if success:
                        print(f"   ✓ {role} correctly denied approval permissions")
        
        # Test invalid leave request creation
        if 'medecin' in self.tokens:
            invalid_data = {
                "date_debut": "invalid-date",
                "date_fin": "2024-12-31",
                "type_conge": "INVALID_TYPE",
                "motif": "Test invalid request"
            }
            
            success, response = self.run_test(
                "Create invalid leave request",
                "POST",
                "conges",
                422,  # Should return validation error
                data=invalid_data,
                token=self.tokens['medecin']
            )
        
        # Test approval of non-existent request
        if 'directeur' in self.tokens:
            success, response = self.run_test(
                "Approve non-existent request",
                "PUT",
                "conges/non-existent-id/approuver",
                404,
                data={"approuve": True, "commentaire": "Test"},
                token=self.tokens['directeur']
            )

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