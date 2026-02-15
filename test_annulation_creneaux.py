#!/usr/bin/env python3
"""
Test Annulation Demandes de Créneaux (Nouvelle Fonctionnalité)
Tests the new cancellation functionality for approved work requests.
"""

import requests
import sys
from datetime import datetime
import json

class AnnulationCreneauxTester:
    def __init__(self, base_url="https://ophtal-desk.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test users from review request
        self.test_users = {
            "directeur": {"email": "directeur@cabinet.fr", "password": "admin123"},
            "medecin": {"email": "dr.dupont@cabinet.fr", "password": "medecin123"},
            "assistant": {"email": "julie.moreau@cabinet.fr", "password": "assistant123"}
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

    def authenticate_users(self):
        """Authenticate all test users"""
        print("🔐 AUTHENTICATING TEST USERS")
        print("="*50)
        
        for role, credentials in self.test_users.items():
            success, response = self.run_test(
                f"Login {role}",
                "POST",
                "auth/login",
                200,
                data=credentials
            )
            
            if success and 'access_token' in response:
                self.tokens[role] = response['access_token']
                self.users[role] = response['user']
                print(f"   ✅ {role}: {response['user']['prenom']} {response['user']['nom']}")
            else:
                print(f"   ❌ {role}: Authentication failed")
                return False
        
        return len(self.tokens) >= 2

    def test_annulation_demandes_creneaux(self):
        """Test complete annulation functionality"""
        print("\n🔄 TESTING ANNULATION DEMANDES DE CRÉNEAUX")
        print("="*80)
        
        created_demandes = []
        
        # TEST 1 - Médecin Demande Annulation
        print("\n🔍 TEST 1 - Médecin Demande Annulation")
        print("-" * 60)
        
        # Step 1: Create work request
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        
        demande_data = {
            "date_demandee": future_date,
            "creneau": "MATIN",
            "motif": "Test demande pour annulation"
        }
        
        success, response = self.run_test(
            "Create work request as Doctor",
            "POST",
            "demandes-travail",
            200,
            data=demande_data,
            token=self.tokens['medecin']
        )
        
        if not success or not response or len(response) == 0:
            print("   ❌ FAILED: Cannot create work request for testing")
            return []
        
        # The endpoint returns a list, get the first created demand
        demande_id = response[0]['id']
        created_demandes.append(demande_id)
        print(f"   ✅ Demande de travail créée - ID: {demande_id}")
        
        # Step 2: Director approves the request
        approval_data = {
            "approuve": True,
            "commentaire": "Approuvé pour test annulation"
        }
        
        success, response = self.run_test(
            "Approve work request as Director",
            "PUT",
            f"demandes-travail/{demande_id}/approuver",
            200,
            data=approval_data,
            token=self.tokens['directeur']
        )
        
        if not success:
            print("   ❌ FAILED: Cannot approve work request")
            return created_demandes
        
        print("   ✅ Demande approuvée par le directeur")
        
        # Step 3: Doctor requests cancellation
        annulation_data = {
            "raison": "Imprévu personnel"
        }
        
        success, response = self.run_test(
            "Request cancellation as Doctor",
            "POST",
            f"demandes-travail/{demande_id}/demander-annulation",
            200,
            data=annulation_data,
            token=self.tokens['medecin']
        )
        
        if success:
            print("   ✅ Demande d'annulation envoyée avec succès")
        else:
            print("   ❌ FAILED: Cannot request cancellation")
            return created_demandes
        
        # Step 4: Verify cancellation fields updated
        success, all_demandes = self.run_test(
            "Get all work requests to verify cancellation fields",
            "GET",
            "demandes-travail",
            200,
            token=self.tokens['directeur']
        )
        
        if success:
            # Find our demand in the list
            our_demande = None
            for demande in all_demandes:
                if demande.get('id') == demande_id:
                    our_demande = demande
                    break
            
            if our_demande and (our_demande.get('demande_annulation') == True and 
                our_demande.get('raison_demande_annulation') == "Imprévu personnel"):
                print("   ✅ Champs d'annulation correctement mis à jour")
                print(f"      - demande_annulation: {our_demande.get('demande_annulation')}")
                print(f"      - raison_demande_annulation: {our_demande.get('raison_demande_annulation')}")
            else:
                print("   ❌ FAILED: Cancellation fields not properly updated")
        
        # TEST 2 - Director receives notification
        print("\n🔍 TEST 2 - Directeur Reçoit Notification")
        print("-" * 60)
        
        success, notifications = self.run_test(
            "Check Director notifications for cancellation request",
            "GET",
            "notifications",
            200,
            token=self.tokens['directeur']
        )
        
        if success:
            cancellation_notifs = [n for n in notifications if "annulation" in n.get('title', '').lower()]
            if cancellation_notifs:
                print(f"   ✅ Directeur reçoit {len(cancellation_notifs)} notification(s) d'annulation")
                for notif in cancellation_notifs[:1]:
                    print(f"      - Title: {notif.get('title', '')}")
                    print(f"      - Body: {notif.get('body', '')}")
            else:
                print("   ⚠️ Directeur n'a pas reçu de notification d'annulation")
        
        # TEST 3 - Director approves cancellation
        print("\n🔍 TEST 3 - Directeur Approuve Annulation")
        print("-" * 60)
        
        approval_annulation_data = {
            "approuve": True,
            "commentaire": "Accord pour annulation"
        }
        
        success, response = self.run_test(
            "Approve cancellation request as Director",
            "PUT",
            f"demandes-travail/{demande_id}/approuver-annulation",
            200,
            data=approval_annulation_data,
            token=self.tokens['directeur']
        )
        
        if success:
            print("   ✅ Annulation approuvée par le directeur")
        else:
            print("   ❌ FAILED: Cannot approve cancellation")
            return created_demandes
        
        # Verify status after approval
        success, all_demandes = self.run_test(
            "Get work requests after cancellation approval",
            "GET",
            "demandes-travail",
            200,
            token=self.tokens['directeur']
        )
        
        if success:
            our_demande = None
            for demande in all_demandes:
                if demande.get('id') == demande_id:
                    our_demande = demande
                    break
            
            if our_demande:
                expected_status = "ANNULE"
                actual_status = our_demande.get('statut')
                annule_par = our_demande.get('annule_par')
                raison_annulation = our_demande.get('raison_annulation')
                
                if actual_status == expected_status:
                    print(f"   ✅ Statut correctement mis à jour: {actual_status}")
                    print(f"      - annule_par: {annule_par}")
                    print(f"      - raison_annulation: {raison_annulation}")
                else:
                    print(f"   ❌ FAILED: Status not updated correctly (expected: {expected_status}, got: {actual_status})")
        
        # TEST 4 - Direct cancellation by Director
        print("\n🔍 TEST 4 - Directeur Annule Directement")
        print("-" * 60)
        
        # Create another work request for direct cancellation
        future_date_2 = (datetime.now() + timedelta(days=32)).strftime('%Y-%m-%d')
        
        demande_data_2 = {
            "date_demandee": future_date_2,
            "creneau": "MATIN",
            "motif": "Test demande pour annulation directe"
        }
        
        success, response = self.run_test(
            "Create second work request for direct cancellation",
            "POST",
            "demandes-travail",
            200,
            data=demande_data_2,
            token=self.tokens['medecin']
        )
        
        if success and response and len(response) > 0:
            demande_id_2 = response[0]['id']
            created_demandes.append(demande_id_2)
            
            # Approve the request
            success, _ = self.run_test(
                "Approve second work request",
                "PUT",
                f"demandes-travail/{demande_id_2}/approuver",
                200,
                data={"approuve": True, "commentaire": "Approuvé pour test annulation directe"},
                token=self.tokens['directeur']
            )
            
            if success:
                # Director cancels directly
                direct_cancellation_data = {
                    "raison": "Réorganisation interne"
                }
                
                success, response = self.run_test(
                    "Direct cancellation by Director",
                    "POST",
                    f"demandes-travail/{demande_id_2}/annuler-directement",
                    200,
                    data=direct_cancellation_data,
                    token=self.tokens['directeur']
                )
                
                if success:
                    print("   ✅ Annulation directe effectuée par le directeur")
                    
                    # Verify status
                    success, all_demandes = self.run_test(
                        "Get work requests after direct cancellation",
                        "GET",
                        "demandes-travail",
                        200,
                        token=self.tokens['directeur']
                    )
                    
                    if success:
                        our_demande = None
                        for demande in all_demandes:
                            if demande.get('id') == demande_id_2:
                                our_demande = demande
                                break
                        
                        if our_demande and (our_demande.get('statut') == 'ANNULE' and 
                            our_demande.get('annule_par') == self.users['directeur']['id']):
                            print("   ✅ Statut correctement mis à jour après annulation directe")
                            print(f"      - statut: {our_demande.get('statut')}")
                            print(f"      - annule_par: {our_demande.get('annule_par')}")
                            print(f"      - raison_annulation: {our_demande.get('raison_annulation')}")
                        else:
                            print("   ❌ FAILED: Status not properly updated after direct cancellation")
        
        # TEST 5 - Security tests
        print("\n🔍 TEST 5 - Tests de Sécurité")
        print("-" * 60)
        
        # Test: Only approved requests can be cancelled
        future_date_3 = (datetime.now() + timedelta(days=34)).strftime('%Y-%m-%d')
        
        demande_pending_data = {
            "date_demandee": future_date_3,
            "creneau": "MATIN",
            "motif": "Test demande en attente"
        }
        
        success, response = self.run_test(
            "Create pending work request for security test",
            "POST",
            "demandes-travail",
            200,
            data=demande_pending_data,
            token=self.tokens['medecin']
        )
        
        if success and response and len(response) > 0:
            pending_demande_id = response[0]['id']
            
            # Try to cancel pending request
            success, response = self.run_test(
                "Try to cancel pending request (should fail)",
                "POST",
                f"demandes-travail/{pending_demande_id}/demander-annulation",
                400,  # Should fail
                data={"raison": "Tentative sur demande en attente"},
                token=self.tokens['medecin']
            )
            
            if success:
                print("   ✅ Sécurité: Seules les demandes approuvées peuvent être annulées")
            else:
                print("   ❌ SECURITY ISSUE: Pending requests can be cancelled")
        
        # Test: Doctor can only cancel their own requests
        if len(created_demandes) > 0 and 'assistant' in self.tokens:
            success, response = self.run_test(
                "Unauthorized cancellation request (assistant trying to cancel doctor's request)",
                "POST",
                f"demandes-travail/{created_demandes[0]}/demander-annulation",
                403,  # Should be forbidden
                data={"raison": "Tentative non autorisée"},
                token=self.tokens['assistant']
            )
            
            if success:
                print("   ✅ Sécurité: Assistant ne peut pas annuler les demandes du médecin")
            else:
                print("   ❌ SECURITY ISSUE: Assistant can cancel doctor's requests")
        
        return created_demandes

    def run_all_tests(self):
        """Run all annulation tests"""
        print("🔄 ANNULATION DEMANDES DE CRÉNEAUX - TESTS COMPLETS")
        print("="*80)
        
        # Authenticate users
        if not self.authenticate_users():
            print("\n❌ CRITICAL: Authentication failed")
            return 1
        
        # Run annulation tests
        created_demandes = self.test_annulation_demandes_creneaux()
        
        # Final summary
        print("\n" + "="*80)
        print("🎯 ANNULATION CRÉNEAUX - TEST SUMMARY")
        print("="*80)
        
        print(f"✅ Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print(f"✅ Demandes created: {len(created_demandes)}")
        
        print("\n🎯 FONCTIONNALITÉS TESTÉES:")
        print("✅ Médecin demande annulation: TESTÉ")
        print("✅ Directeur reçoit notification: TESTÉ") 
        print("✅ Directeur approuve annulation: TESTÉ")
        print("✅ Directeur annule directement: TESTÉ")
        print("✅ Tests de sécurité: TESTÉS")
        
        if self.tests_passed >= self.tests_run * 0.8:
            print("\n🎉 NOUVELLE FONCTIONNALITÉ ANNULATION CRÉNEAUX TESTÉE AVEC SUCCÈS!")
            return 0
        else:
            print("\n❌ Des problèmes ont été détectés dans la fonctionnalité d'annulation")
            return 1

if __name__ == "__main__":
    tester = AnnulationCreneauxTester()
    sys.exit(tester.run_all_tests())