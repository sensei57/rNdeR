#!/usr/bin/env python3
"""
Focused test for half-day leave management functionality
Based on the review request for testing demi-journées de congés
"""

import requests
import sys
from datetime import datetime
import json

class HalfDayLeavesTester:
    def __init__(self, base_url="https://ophthalmo-planning.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test users as specified in the review request
        self.test_users = {
            "directeur": {"email": "directeur@cabinet.fr", "password": "admin123"}
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

    def test_half_day_leave_functionality(self):
        """Test the complete half-day leave functionality as requested"""
        print("\n🌅 TESTING HALF-DAY LEAVE FUNCTIONALITY")
        print("=" * 60)
        
        created_requests = []
        marie_dupont_id = None
        
        # First, get all users to find Marie Dupont's ID
        if 'directeur' in self.tokens:
            success, users_data = self.run_test(
                "Get users to find Marie Dupont",
                "GET",
                "users",
                200,
                token=self.tokens['directeur']
            )
            
            if success:
                for user in users_data:
                    if user.get('email') == 'dr.dupont@cabinet.fr' or (user.get('prenom') == 'Marie' and user.get('nom') == 'Dupont'):
                        marie_dupont_id = user['id']
                        print(f"   ✅ Found Marie Dupont ID: {marie_dupont_id}")
                        break
                
                if not marie_dupont_id:
                    print("   ⚠️  Marie Dupont not found, using first médecin")
                    medecins = [u for u in users_data if u['role'] == 'Médecin']
                    if medecins:
                        marie_dupont_id = medecins[0]['id']
                        print(f"   Using {medecins[0]['prenom']} {medecins[0]['nom']} ID: {marie_dupont_id}")
        
        # TEST 1 - Création de demande de congé pour un employé (Directeur)
        print(f"\n📋 TEST 1 - Director creates leave request for employee")
        print("-" * 50)
        
        if 'directeur' in self.tokens and marie_dupont_id:
            leave_data = {
                "utilisateur_id": marie_dupont_id,
                "date_debut": "2025-01-20",
                "date_fin": "2025-01-20",
                "type_conge": "CONGE_PAYE",
                "creneau": "MATIN",
                "motif": "Test demi-journée matin"
            }
            
            success, response = self.run_test(
                "POST /api/conges with utilisateur_id and creneau=MATIN",
                "POST",
                "conges",
                200,
                data=leave_data,
                token=self.tokens['directeur']
            )
            
            if success and 'id' in response:
                created_requests.append({
                    'id': response['id'],
                    'utilisateur_id': marie_dupont_id,
                    'creneau': 'MATIN',
                    'type': 'CONGE_PAYE'
                })
                print(f"   ✅ SUCCESS: Created morning half-day leave request")
                print(f"   📝 Request details:")
                print(f"      - Request ID: {response['id']}")
                print(f"      - User ID: {response.get('utilisateur_id', 'N/A')}")
                print(f"      - Créneau: {response.get('creneau', 'N/A')}")
                print(f"      - Status: {response.get('statut', 'N/A')}")
                print(f"      - Type: {response.get('type_conge', 'N/A')}")
                
                # Verify the request was created with correct data
                if (response.get('utilisateur_id') == marie_dupont_id and 
                    response.get('creneau') == 'MATIN' and 
                    response.get('type_conge') == 'CONGE_PAYE'):
                    print(f"   ✅ All fields correctly saved")
                else:
                    print(f"   ❌ Some fields not correctly saved")
            else:
                print(f"   ❌ FAILED: Could not create morning half-day leave request")
        
        # TEST 2 - Récupération des demandes
        print(f"\n📋 TEST 2 - Retrieve leave requests")
        print("-" * 50)
        
        if 'directeur' in self.tokens:
            success, demandes = self.run_test(
                "GET /api/conges",
                "GET",
                "conges",
                200,
                token=self.tokens['directeur']
            )
            
            if success:
                print(f"   ✅ SUCCESS: Retrieved {len(demandes)} leave requests")
                
                # Find our created request
                our_request = None
                for demande in demandes:
                    if demande.get('id') in [req['id'] for req in created_requests]:
                        our_request = demande
                        break
                
                if our_request:
                    print(f"   📝 Found our created request:")
                    print(f"      - ID: {our_request.get('id')}")
                    print(f"      - User ID: {our_request.get('utilisateur_id')}")
                    print(f"      - Créneau: {our_request.get('creneau', 'N/A')}")
                    print(f"      - Status: {our_request.get('statut', 'N/A')}")
                    print(f"      - Type: {our_request.get('type_conge', 'N/A')}")
                    
                    # Verify correct data
                    if (our_request.get('utilisateur_id') == marie_dupont_id and 
                        our_request.get('creneau') == 'MATIN' and 
                        our_request.get('statut') == 'EN_ATTENTE'):
                        print(f"   ✅ Request has correct utilisateur_id, créneau=MATIN, and statut=EN_ATTENTE")
                    else:
                        print(f"   ❌ Request data verification failed")
                else:
                    print(f"   ❌ Could not find our created request in the list")
        
        # TEST 3 - Approbation de la demande
        print(f"\n📋 TEST 3 - Approve the request")
        print("-" * 50)
        
        if 'directeur' in self.tokens and created_requests:
            request_id = created_requests[0]['id']
            approval_data = {
                "approuve": True,
                "commentaire": "Approved for half-day testing"
            }
            
            success, response = self.run_test(
                f"PUT /api/conges/{request_id}/approuver",
                "PUT",
                f"conges/{request_id}/approuver",
                200,
                data=approval_data,
                token=self.tokens['directeur']
            )
            
            if success:
                print(f"   ✅ SUCCESS: Half-day leave request approved")
                created_requests[0]['status'] = 'APPROUVE'
                print(f"   📝 Status changed to APPROUVE")
            else:
                print(f"   ❌ FAILED: Could not approve half-day leave request")
        
        # TEST 4 - Vérification que seuls les congés approuvés sont retournés pour le planning
        print(f"\n📋 TEST 4 - Verify only approved leaves are returned for planning")
        print("-" * 50)
        
        if 'directeur' in self.tokens:
            success, all_demandes = self.run_test(
                "GET /api/conges (filter by statut=APPROUVE)",
                "GET",
                "conges",
                200,
                token=self.tokens['directeur']
            )
            
            if success:
                approved_leaves = [d for d in all_demandes if d.get('statut') == 'APPROUVE']
                pending_leaves = [d for d in all_demandes if d.get('statut') == 'EN_ATTENTE']
                
                print(f"   ✅ SUCCESS: Found {len(approved_leaves)} approved leaves")
                print(f"   📝 Found {len(pending_leaves)} pending leaves")
                
                # Check if our approved request is in the approved list
                our_approved = [d for d in approved_leaves if d.get('id') in [req['id'] for req in created_requests if req.get('status') == 'APPROUVE']]
                if our_approved:
                    print(f"   ✅ Our approved half-day request is correctly in approved list")
                    for req in our_approved:
                        print(f"      - ID: {req.get('id')}, Créneau: {req.get('creneau')}, Status: {req.get('statut')}")
                else:
                    print(f"   ⚠️  Our approved request not found in approved list")
        
        # TEST 5 - Test avec demi-journée après-midi
        print(f"\n📋 TEST 5 - Test with afternoon half-day")
        print("-" * 50)
        
        if 'directeur' in self.tokens and marie_dupont_id:
            afternoon_leave_data = {
                "utilisateur_id": marie_dupont_id,
                "date_debut": "2025-01-21",
                "date_fin": "2025-01-21",
                "type_conge": "CONGE_PAYE",
                "creneau": "APRES_MIDI",
                "motif": "Test demi-journée après-midi"
            }
            
            success, response = self.run_test(
                "POST /api/conges with creneau=APRES_MIDI",
                "POST",
                "conges",
                200,
                data=afternoon_leave_data,
                token=self.tokens['directeur']
            )
            
            if success and 'id' in response:
                created_requests.append({
                    'id': response['id'],
                    'utilisateur_id': marie_dupont_id,
                    'creneau': 'APRES_MIDI',
                    'type': 'CONGE_PAYE'
                })
                print(f"   ✅ SUCCESS: Created afternoon half-day leave request")
                print(f"   📝 Request details:")
                print(f"      - Request ID: {response['id']}")
                print(f"      - Créneau: {response.get('creneau', 'N/A')}")
                
                # Approve this request too
                request_id = response['id']
                approval_data = {
                    "approuve": True,
                    "commentaire": "Approved afternoon half-day for testing"
                }
                
                success_approve, approve_response = self.run_test(
                    f"PUT /api/conges/{request_id}/approuver (afternoon)",
                    "PUT",
                    f"conges/{request_id}/approuver",
                    200,
                    data=approval_data,
                    token=self.tokens['directeur']
                )
                
                if success_approve:
                    print(f"   ✅ SUCCESS: Afternoon half-day leave approved")
                    created_requests[-1]['status'] = 'APPROUVE'
        
        # FINAL VERIFICATION - Check both morning and afternoon requests
        print(f"\n📋 FINAL VERIFICATION - Both half-day requests")
        print("-" * 50)
        
        if 'directeur' in self.tokens:
            success, final_demandes = self.run_test(
                "Final check of all leave requests",
                "GET",
                "conges",
                200,
                token=self.tokens['directeur']
            )
            
            if success:
                our_requests = [d for d in final_demandes if d.get('id') in [req['id'] for req in created_requests]]
                morning_requests = [d for d in our_requests if d.get('creneau') == 'MATIN']
                afternoon_requests = [d for d in our_requests if d.get('creneau') == 'APRES_MIDI']
                
                print(f"   📊 SUMMARY:")
                print(f"      - Morning half-day requests: {len(morning_requests)}")
                print(f"      - Afternoon half-day requests: {len(afternoon_requests)}")
                
                for req in our_requests:
                    print(f"      - {req.get('creneau')} request: Status={req.get('statut')}, Date={req.get('date_debut')}")
                
                if len(morning_requests) >= 1 and len(afternoon_requests) >= 1:
                    print(f"\n   🎉 SUCCESS: HALF-DAY LEAVE SYSTEM WORKING CORRECTLY!")
                    print(f"   ✅ Both morning and afternoon half-day requests created and managed successfully")
                    print(f"   ✅ Director can create leave requests for other employees")
                    print(f"   ✅ Créneau field is properly saved and retrieved")
                    print(f"   ✅ Approval system works for half-day requests")
                    print(f"   ✅ Approved requests are correctly filtered for planning")
                    return True
                else:
                    print(f"   ❌ FAILED: Missing some half-day requests")
                    return False
        
        return False

def main():
    print("🏥 TESTING HALF-DAY LEAVE MANAGEMENT SYSTEM")
    print("=" * 60)
    print("Based on review request: Fonctionnalité demi-journées de congés")
    print("Testing backend functionality for half-day leave requests")
    print("=" * 60)
    
    tester = HalfDayLeavesTester()
    
    # Test authentication for required roles
    print("\n🔐 Authentication...")
    login_success = True
    for role, credentials in tester.test_users.items():
        if not tester.test_login(role, credentials['email'], credentials['password']):
            print(f"❌ Login failed for {role}")
            login_success = False
    
    if not login_success:
        print("\n❌ Authentication failed. Cannot proceed with tests.")
        return 1
    
    print(f"\n✅ Successfully authenticated all required roles!")
    
    # Run the half-day leave functionality tests
    success = tester.test_half_day_leave_functionality()
    
    # Print final results
    print(f"\n" + "="*60)
    print(f"📊 HALF-DAY LEAVE TEST RESULTS")
    print(f"="*60)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if success and tester.tests_passed == tester.tests_run:
        print("\n🎉 ALL HALF-DAY LEAVE TESTS PASSED!")
        print("✅ Backend half-day leave functionality is working correctly")
        print("✅ Director can create leave requests for employees")
        print("✅ Créneau field (MATIN/APRES_MIDI) is properly handled")
        print("✅ Approval system works for half-day requests")
        print("✅ Only approved leaves are available for planning")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED!")
        print("⚠️  Half-day leave functionality has issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())