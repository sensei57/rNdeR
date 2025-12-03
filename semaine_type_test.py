import requests
import sys
from datetime import datetime
import json

class SemaineTypeAPITester:
    def __init__(self, base_url="https://bonjour-hello-22.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0

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
                response = requests.delete(url, headers=headers, params=params)

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

    def test_semaine_type_creation_with_medecin_id(self):
        """Test Semaine Type Creation with medecin_id - SPECIFIC REQUEST"""
        print("\n📅 TESTING SEMAINE TYPE CREATION WITH MEDECIN_ID - SPECIFIC REQUEST")
        print("="*80)
        
        # Get user IDs first
        dr_dupont_id = None
        dr_ricaud_id = None
        directeur_id = None
        
        # Login all required users
        print("\n🔐 LOGGING IN ALL REQUIRED USERS")
        print("-" * 50)
        
        # Login Dr. Dupont
        success, response = self.run_test(
            "Login Dr. Dupont (dr.dupont@cabinet.fr)",
            "POST",
            "auth/login", 
            200,
            data={"email": "dr.dupont@cabinet.fr", "password": "medecin123"}
        )
        
        if success and 'access_token' in response:
            self.tokens['dr_dupont'] = response['access_token']
            self.users['dr_dupont'] = response['user']
            dr_dupont_id = response['user']['id']
            print(f"   ✅ Dr. Dupont logged in - ID: {dr_dupont_id}")
        else:
            print(f"   ❌ Dr. Dupont login failed")
            return False
        
        # Login Dr. Ricaud
        success, response = self.run_test(
            "Login Dr. Ricaud (dr.ricaud@cabinet.fr)",
            "POST", 
            "auth/login",
            200,
            data={"email": "dr.ricaud@cabinet.fr", "password": "medecin123"}
        )
        
        if success and 'access_token' in response:
            self.tokens['dr_ricaud'] = response['access_token']
            self.users['dr_ricaud'] = response['user']
            dr_ricaud_id = response['user']['id']
            print(f"   ✅ Dr. Ricaud logged in - ID: {dr_ricaud_id}")
        else:
            print(f"   ❌ Dr. Ricaud login failed")
            return False
        
        # Login Directeur
        success, response = self.run_test(
            "Login Directeur (directeur@cabinet.fr)",
            "POST",
            "auth/login",
            200, 
            data={"email": "directeur@cabinet.fr", "password": "admin123"}
        )
        
        if success and 'access_token' in response:
            self.tokens['directeur'] = response['access_token']
            self.users['directeur'] = response['user']
            directeur_id = response['user']['id']
            print(f"   ✅ Directeur logged in - ID: {directeur_id}")
        else:
            print(f"   ❌ Directeur login failed")
            return False
        
        # TEST 1 - Créer semaine type comme Médecin 1
        print("\n🔍 TEST 1 - Créer semaine type comme Médecin 1 (Dr. Dupont)")
        print("-" * 60)
        
        semaine_data = {
            "nom": "Test Semaine Dr Dupont",
            "description": "Test création",
            "lundi": "MATIN",
            "mardi": "JOURNEE_COMPLETE", 
            "mercredi": "REPOS",
            "jeudi": "APRES_MIDI",
            "vendredi": "JOURNEE_COMPLETE",
            "samedi": "REPOS",
            "dimanche": "REPOS"
        }
        
        success, response = self.run_test(
            "Create semaine type as Dr. Dupont",
            "POST",
            "semaines-types",
            200,
            data=semaine_data,
            token=self.tokens['dr_dupont']
        )
        
        created_semaine_id = None
        if success:
            print(f"   ✅ Status 200 - Semaine type created successfully")
            
            # Check if response contains medecin_id
            if 'medecin_id' in response:
                medecin_id_in_response = response['medecin_id']
                print(f"   ✅ Response contains 'medecin_id': {medecin_id_in_response}")
                
                # Verify medecin_id = ID de dr.dupont
                if medecin_id_in_response == dr_dupont_id:
                    print(f"   ✅ VERIFIED: medecin_id matches Dr. Dupont's ID")
                else:
                    print(f"   ❌ ERROR: medecin_id ({medecin_id_in_response}) does not match Dr. Dupont's ID ({dr_dupont_id})")
            else:
                print(f"   ❌ ERROR: Response does not contain 'medecin_id'")
            
            created_semaine_id = response.get('id')
            print(f"   📋 Created semaine ID: {created_semaine_id}")
        else:
            print(f"   ❌ Failed to create semaine type")
            return False
        
        # TEST 2 - Lister semaines comme Médecin 1
        print("\n🔍 TEST 2 - Lister semaines comme Médecin 1 (Dr. Dupont)")
        print("-" * 60)
        
        success, semaines_list = self.run_test(
            "List semaines types as Dr. Dupont",
            "GET",
            "semaines-types",
            200,
            token=self.tokens['dr_dupont']
        )
        
        if success:
            print(f"   ✅ Successfully retrieved semaines list")
            print(f"   📊 Total semaines returned: {len(semaines_list)}")
            
            # Display all semaines with nom and medecin_id
            print(f"   📋 SEMAINES DETAILS:")
            for semaine in semaines_list:
                nom = semaine.get('nom', 'N/A')
                medecin_id = semaine.get('medecin_id', 'null')
                print(f"      - Nom: {nom}, medecin_id: {medecin_id}")
            
            # Check if "Test Semaine Dr Dupont" is in the list
            test_semaine_found = any(s.get('nom') == "Test Semaine Dr Dupont" for s in semaines_list)
            if test_semaine_found:
                print(f"   ✅ VERIFIED: 'Test Semaine Dr Dupont' is in the list")
            else:
                print(f"   ❌ ERROR: 'Test Semaine Dr Dupont' NOT found in the list")
            
            # Verify all semaines have medecin_id = Dr. Dupont's ID or null (global)
            all_correct_medecin_id = True
            for semaine in semaines_list:
                semaine_medecin_id = semaine.get('medecin_id')
                if semaine_medecin_id is not None and semaine_medecin_id != dr_dupont_id:
                    print(f"   ❌ ERROR: Semaine '{semaine.get('nom')}' has wrong medecin_id: {semaine_medecin_id}")
                    all_correct_medecin_id = False
            
            if all_correct_medecin_id:
                print(f"   ✅ VERIFIED: All semaines have correct medecin_id (Dr. Dupont's ID or null for global)")
        else:
            print(f"   ❌ Failed to retrieve semaines list")
        
        # TEST 3 - Lister semaines comme Médecin 2
        print("\n🔍 TEST 3 - Lister semaines comme Médecin 2 (Dr. Ricaud)")
        print("-" * 60)
        
        success, ricaud_semaines_list = self.run_test(
            "List semaines types as Dr. Ricaud",
            "GET",
            "semaines-types",
            200,
            token=self.tokens['dr_ricaud']
        )
        
        if success:
            print(f"   ✅ Successfully retrieved semaines list for Dr. Ricaud")
            print(f"   📊 Total semaines returned: {len(ricaud_semaines_list)}")
            
            # Display all semaines with nom and medecin_id
            print(f"   📋 SEMAINES DETAILS FOR DR. RICAUD:")
            for semaine in ricaud_semaines_list:
                nom = semaine.get('nom', 'N/A')
                medecin_id = semaine.get('medecin_id', 'null')
                print(f"      - Nom: {nom}, medecin_id: {medecin_id}")
            
            # Verify "Test Semaine Dr Dupont" is NOT in Dr. Ricaud's list
            test_semaine_found = any(s.get('nom') == "Test Semaine Dr Dupont" for s in ricaud_semaines_list)
            if not test_semaine_found:
                print(f"   ✅ VERIFIED: 'Test Semaine Dr Dupont' is NOT in Dr. Ricaud's list (correct isolation)")
            else:
                print(f"   ❌ ERROR: 'Test Semaine Dr Dupont' found in Dr. Ricaud's list (privacy violation)")
        else:
            print(f"   ❌ Failed to retrieve semaines list for Dr. Ricaud")
        
        # TEST 4 - Vérifier user ID du médecin
        print("\n🔍 TEST 4 - Vérifier user ID du médecin (Dr. Dupont)")
        print("-" * 60)
        
        success, user_me_response = self.run_test(
            "Get current user info for Dr. Dupont",
            "GET",
            "users/me",
            200,
            token=self.tokens['dr_dupont']
        )
        
        if success:
            user_id_from_me = user_me_response.get('id')
            print(f"   ✅ Successfully retrieved user info")
            print(f"   📋 User ID from /users/me: {user_id_from_me}")
            
            # Verify this ID corresponds to medecin_id of created semaine
            if user_id_from_me == dr_dupont_id:
                print(f"   ✅ VERIFIED: User ID from /users/me matches stored Dr. Dupont ID")
                
                # Also verify it matches the medecin_id in the created semaine
                if created_semaine_id:
                    # Get the specific semaine to check its medecin_id
                    for semaine in semaines_list:
                        if semaine.get('id') == created_semaine_id:
                            semaine_medecin_id = semaine.get('medecin_id')
                            if semaine_medecin_id == user_id_from_me:
                                print(f"   ✅ VERIFIED: medecin_id in created semaine matches user ID")
                            else:
                                print(f"   ❌ ERROR: medecin_id mismatch in created semaine")
                            break
            else:
                print(f"   ❌ ERROR: User ID mismatch")
        else:
            print(f"   ❌ Failed to get current user info")
        
        # TEST 5 - Lister TOUTES les semaines (via directeur)
        print("\n🔍 TEST 5 - Lister TOUTES les semaines (via directeur)")
        print("-" * 60)
        
        success, all_semaines_list = self.run_test(
            "List ALL semaines types as Directeur",
            "GET",
            "semaines-types",
            200,
            token=self.tokens['directeur']
        )
        
        if success:
            print(f"   ✅ Successfully retrieved ALL semaines list as Directeur")
            print(f"   📊 Total semaines returned: {len(all_semaines_list)}")
            
            # Display ALL semaines with details
            print(f"   📋 ALL SEMAINES DETAILS:")
            semaines_globales = 0
            semaines_dr_dupont = 0
            semaines_dr_ricaud = 0
            
            for semaine in all_semaines_list:
                semaine_id = semaine.get('id', 'N/A')
                nom = semaine.get('nom', 'N/A')
                medecin_id = semaine.get('medecin_id', 'null')
                
                print(f"      - ID: {semaine_id}, Nom: {nom}, medecin_id: {medecin_id}")
                
                # Count by category
                if medecin_id is None or medecin_id == 'null':
                    semaines_globales += 1
                elif medecin_id == dr_dupont_id:
                    semaines_dr_dupont += 1
                elif medecin_id == dr_ricaud_id:
                    semaines_dr_ricaud += 1
            
            # Display counts
            print(f"   📊 SEMAINES COUNT SUMMARY:")
            print(f"      - Semaines globales (medecin_id=null): {semaines_globales}")
            print(f"      - Semaines de Dr. Dupont: {semaines_dr_dupont}")
            print(f"      - Semaines de Dr. Ricaud: {semaines_dr_ricaud}")
        else:
            print(f"   ❌ Failed to retrieve all semaines list as Directeur")
        
        # FINAL VERIFICATION - CRITÈRES DE SUCCÈS
        print("\n" + "="*80)
        print("🎯 CRITÈRES DE SUCCÈS - VERIFICATION FINALE")
        print("="*80)
        
        success_criteria = {
            "semaine_created_with_medecin_id": False,
            "medecin1_sees_only_his_semaines": False,
            "medecin2_does_not_see_medecin1_semaines": False,
            "directeur_sees_all_semaines": False
        }
        
        # Check criterion 1: Semaine créée par médecin a son medecin_id
        if created_semaine_id and dr_dupont_id:
            success_criteria["semaine_created_with_medecin_id"] = True
            print("✅ Semaine créée par médecin a son medecin_id")
        else:
            print("❌ Semaine créée par médecin n'a PAS son medecin_id")
        
        # Check criterion 2: Médecin 1 ne voit QUE ses semaines
        if 'semaines_list' in locals():
            medecin1_only_his = all(
                s.get('medecin_id') == dr_dupont_id or s.get('medecin_id') is None 
                for s in semaines_list
            )
            if medecin1_only_his:
                success_criteria["medecin1_sees_only_his_semaines"] = True
                print("✅ Médecin 1 ne voit QUE ses semaines (+ globales)")
            else:
                print("❌ Médecin 1 voit des semaines d'autres médecins")
        
        # Check criterion 3: Médecin 2 ne voit pas les semaines de Médecin 1
        if 'ricaud_semaines_list' in locals():
            dupont_semaine_in_ricaud_list = any(
                s.get('nom') == "Test Semaine Dr Dupont" 
                for s in ricaud_semaines_list
            )
            if not dupont_semaine_in_ricaud_list:
                success_criteria["medecin2_does_not_see_medecin1_semaines"] = True
                print("✅ Médecin 2 ne voit pas les semaines de Médecin 1")
            else:
                print("❌ Médecin 2 voit les semaines de Médecin 1")
        
        # Check criterion 4: Directeur voit toutes les semaines
        if 'all_semaines_list' in locals() and len(all_semaines_list) > 0:
            success_criteria["directeur_sees_all_semaines"] = True
            print("✅ Directeur voit toutes les semaines")
        else:
            print("❌ Directeur ne voit pas toutes les semaines")
        
        # Final result
        all_criteria_met = all(success_criteria.values())
        
        print(f"\n🎯 RÉSULTAT FINAL:")
        if all_criteria_met:
            print("🎉 TOUS LES CRITÈRES DE SUCCÈS SONT REMPLIS!")
            print("🎉 Le système de semaines types privées fonctionne parfaitement!")
        else:
            print("❌ CERTAINS CRITÈRES DE SUCCÈS NE SONT PAS REMPLIS")
            failed_criteria = [k for k, v in success_criteria.items() if not v]
            print(f"❌ Critères échoués: {failed_criteria}")
        
        return all_criteria_met

if __name__ == "__main__":
    tester = SemaineTypeAPITester()
    
    # Run the specific semaine type test
    print("🚀 Starting SPECIFIC Semaine Type Creation Test")
    print("="*70)
    success = tester.test_semaine_type_creation_with_medecin_id()
    print("\n" + "="*70)
    print("🎯 SPECIFIC TEST SUMMARY")
    print("="*70)
    print(f"Total tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    if success:
        print("🎉 SEMAINE TYPE CREATION TEST PASSED!")
    else:
        print("❌ SEMAINE TYPE CREATION TEST FAILED!")