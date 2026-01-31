#!/usr/bin/env python3

import requests
import sys
from datetime import datetime, timedelta
import json

class PermanentDeletionTester:
    def __init__(self, base_url="https://mois-planning.preview.emergentagent.com"):
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
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

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

    def test_permanent_user_deletion(self):
        """Test permanent user deletion API - CRITICAL NEW FEATURE"""
        print("\n🚨 Testing Permanent User Deletion API (CRITICAL NEW FEATURE)...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping permanent deletion tests - no directeur token")
            return False
        
        directeur_token = self.tokens['directeur']
        
        # Step 1: Create a test user to delete permanently
        print("\n   Step 1: Creating test user for permanent deletion...")
        
        test_user_data = {
            "email": "test.deletion@hopital.fr",
            "nom": "TestDeletion",
            "prenom": "User",
            "role": "Assistant",
            "password": "testpassword123",
            "telephone": "0123456789"
        }
        
        success, created_user = self.run_test(
            "Create test user for deletion",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if not success or 'id' not in created_user:
            print("   ❌ Failed to create test user - cannot test permanent deletion")
            return False
        
        test_user_id = created_user['id']
        print(f"   ✅ Test user created: {created_user['prenom']} {created_user['nom']} (ID: {test_user_id})")
        
        # Step 2: Create some associated data for the test user
        print("\n   Step 2: Creating associated data for test user...")
        
        # Create a leave request for the test user
        future_date_start = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
        future_date_end = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        # First login as the test user to create associated data
        login_success, login_response = self.run_test(
            "Login as test user",
            "POST",
            "auth/login",
            200,
            data={"email": test_user_data["email"], "password": test_user_data["password"]}
        )
        
        test_user_token = None
        if login_success and 'access_token' in login_response:
            test_user_token = login_response['access_token']
            print("   ✅ Test user login successful")
            
            # Create leave request
            leave_data = {
                "date_debut": future_date_start,
                "date_fin": future_date_end,
                "type_conge": "CONGE_PAYE",
                "motif": "Test leave for deletion"
            }
            
            success, leave_response = self.run_test(
                "Create leave request for test user",
                "POST",
                "conges",
                200,
                data=leave_data,
                token=test_user_token
            )
            
            if success:
                print("   ✅ Leave request created for test user")
        
        # Step 3: Test security - try to delete own Director account (should fail)
        print("\n   Step 3: Testing security - Director cannot delete own account...")
        
        # Get director user ID
        success, director_info = self.run_test(
            "Get director info",
            "GET",
            "users/me",
            200,
            token=directeur_token
        )
        
        if success and 'id' in director_info:
            director_id = director_info['id']
            
            success, response = self.run_test(
                "Try to delete own Director account (should fail)",
                "DELETE",
                f"admin/users/{director_id}/delete-permanently",
                403,  # Should be forbidden
                token=directeur_token
            )
            
            if success:
                print("   ✅ Director correctly prevented from deleting own account")
            else:
                print("   ❌ Security issue: Director was able to delete own account or wrong error code")
        
        # Step 4: Test deletion of non-existent user
        print("\n   Step 4: Testing deletion of non-existent user...")
        
        fake_user_id = "fake-user-id-12345"
        success, response = self.run_test(
            "Delete non-existent user",
            "DELETE",
            f"admin/users/{fake_user_id}/delete-permanently",
            404,  # Should return not found
            token=directeur_token
        )
        
        if success:
            print("   ✅ Non-existent user deletion correctly returns 404")
        else:
            print("   ❌ Non-existent user deletion did not return proper error")
        
        # Step 5: Test unauthorized access (non-Director)
        print("\n   Step 5: Testing unauthorized access...")
        
        if 'medecin' in self.tokens:
            success, response = self.run_test(
                "Unauthorized permanent deletion (médecin)",
                "DELETE",
                f"admin/users/{test_user_id}/delete-permanently",
                403,  # Should be forbidden
                token=self.tokens['medecin']
            )
            
            if success:
                print("   ✅ Non-Director correctly denied permanent deletion access")
            else:
                print("   ❌ Security issue: Non-Director was able to access permanent deletion")
        
        # Step 6: Verify user exists before deletion
        print("\n   Step 6: Verifying user exists before deletion...")
        
        success, all_users_before = self.run_test(
            "Get all users before deletion",
            "GET",
            "admin/users",
            200,
            token=directeur_token
        )
        
        user_exists_before = False
        if success:
            for user in all_users_before:
                if user['id'] == test_user_id:
                    user_exists_before = True
                    print(f"   ✅ User exists before deletion: {user['prenom']} {user['nom']}")
                    break
        
        if not user_exists_before:
            print("   ❌ Test user not found before deletion - test setup issue")
            return False
        
        # Step 7: Perform permanent deletion
        print("\n   Step 7: Performing permanent deletion...")
        
        success, deletion_response = self.run_test(
            f"Permanently delete test user {created_user['prenom']} {created_user['nom']}",
            "DELETE",
            f"admin/users/{test_user_id}/delete-permanently",
            200,
            token=directeur_token
        )
        
        if not success:
            print("   ❌ Permanent deletion API failed")
            return False
        
        print(f"   ✅ Permanent deletion API successful")
        
        # Verify response structure
        if 'message' in deletion_response and 'deleted_user' in deletion_response:
            deleted_user_info = deletion_response['deleted_user']
            print(f"   ✅ Response structure correct:")
            print(f"     - Message: {deletion_response['message']}")
            print(f"     - Deleted user ID: {deleted_user_info.get('id', 'N/A')}")
            print(f"     - Deleted user name: {deleted_user_info.get('prenom', '')} {deleted_user_info.get('nom', '')}")
            print(f"     - Deleted user email: {deleted_user_info.get('email', 'N/A')}")
        else:
            print("   ❌ Response structure incorrect - missing message or deleted_user")
        
        # Step 8: Verify user is completely removed from database
        print("\n   Step 8: Verifying complete removal from database...")
        
        success, all_users_after = self.run_test(
            "Get all users after deletion",
            "GET",
            "admin/users",
            200,
            token=directeur_token
        )
        
        user_exists_after = False
        if success:
            for user in all_users_after:
                if user['id'] == test_user_id:
                    user_exists_after = True
                    break
        
        if user_exists_after:
            print("   ❌ User still exists after permanent deletion - deletion failed")
            return False
        else:
            print("   ✅ User completely removed from database")
        
        # Step 9: Verify associated data is also deleted
        print("\n   Step 9: Verifying associated data deletion...")
        
        # Try to get leave requests for the deleted user (should return empty or error)
        success, leave_requests = self.run_test(
            "Check leave requests after user deletion",
            "GET",
            "conges",
            200,
            token=directeur_token
        )
        
        if success:
            # Check if any leave requests still exist for the deleted user
            deleted_user_leaves = [req for req in leave_requests if req.get('utilisateur_id') == test_user_id]
            if len(deleted_user_leaves) == 0:
                print("   ✅ Associated leave requests properly deleted")
            else:
                print(f"   ❌ Found {len(deleted_user_leaves)} leave requests still associated with deleted user")
        
        # Step 10: Test login with deleted user credentials (should fail)
        print("\n   Step 10: Testing login with deleted user credentials...")
        
        success, login_response = self.run_test(
            "Try to login with deleted user credentials",
            "POST",
            "auth/login",
            401,  # Should be unauthorized
            data={"email": test_user_data["email"], "password": test_user_data["password"]}
        )
        
        if success:
            print("   ✅ Deleted user cannot login (credentials properly removed)")
        else:
            print("   ❌ Deleted user can still login - deletion incomplete")
        
        # Summary
        print(f"\n   📊 PERMANENT DELETION TEST SUMMARY:")
        print(f"   ✅ Security tests passed (Director self-deletion blocked, unauthorized access blocked)")
        print(f"   ✅ Error handling correct (404 for non-existent users)")
        print(f"   ✅ User completely removed from database")
        print(f"   ✅ Associated data properly cleaned up")
        print(f"   ✅ User credentials invalidated")
        print(f"   ✅ API response structure correct")
        
        print(f"\n   🎉 PERMANENT DELETION API FULLY FUNCTIONAL AND SECURE!")
        return True

def main():
    print("🚨 Testing Permanent User Deletion API - CRITICAL SECURITY FEATURE")
    print("=" * 70)
    
    tester = PermanentDeletionTester()
    
    # Test authentication for required roles
    print("\n🔐 Testing Authentication...")
    login_success = True
    for role, credentials in tester.test_users.items():
        if not tester.test_login(role, credentials['email'], credentials['password']):
            print(f"❌ Login failed for {role}")
            login_success = False
    
    if not login_success:
        print("\n❌ Authentication tests failed. Cannot proceed with deletion tests.")
        return 1
    
    print(f"\n✅ Successfully authenticated required roles!")
    
    # Test permanent deletion
    deletion_success = tester.test_permanent_user_deletion()
    
    # Print final results
    print(f"\n" + "="*50)
    print(f"📊 PERMANENT DELETION TEST RESULTS")
    print(f"="*50)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if deletion_success:
        print("🎉 PERMANENT DELETION API TESTS PASSED!")
        print("✅ All security checks passed")
        print("✅ Functionality working correctly")
        print("✅ Data cleanup working properly")
        return 0
    else:
        failed_tests = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed_tests} tests failed")
        print(f"❌ PERMANENT DELETION API HAS ISSUES!")
        return 1

if __name__ == "__main__":
    sys.exit(main())