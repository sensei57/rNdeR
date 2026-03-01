#!/usr/bin/env python3
"""
VÉRIFICATION RAPIDE - Test de santé du système après redémarrage
URL Backend: https://medic-admin-suite.preview.emergentagent.com/api
IDENTIFIANTS: Email: directeur@cabinet.fr, Mot de passe: admin123
"""

import requests
import json
import sys
from datetime import datetime

class QuickHealthChecker:
    def __init__(self):
        self.base_url = "https://medic-admin-suite.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.token = None
        self.tests_passed = 0
        self.tests_total = 0
        
        # Credentials from review request
        self.credentials = {
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        }

    def log(self, message, level="INFO"):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_total += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - Status: {response.status_code}", "SUCCESS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}", "ERROR")
                try:
                    error_detail = response.json()
                    self.log(f"   Error details: {error_detail}", "ERROR")
                except:
                    self.log(f"   Response text: {response.text[:200]}", "ERROR")
                return False, {}

        except requests.exceptions.Timeout:
            self.log(f"❌ FAILED - Request timeout", "ERROR")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log(f"❌ FAILED - Connection error", "ERROR")
            return False, {}
        except Exception as e:
            self.log(f"❌ FAILED - Error: {str(e)}", "ERROR")
            return False, {}

    def test_1_connexion(self):
        """✅ TEST CONNEXION: POST /api/auth/login avec directeur@cabinet.fr / admin123"""
        self.log("=" * 60)
        self.log("1. ✅ TEST CONNEXION")
        self.log("=" * 60)
        
        success, response = self.run_test(
            "POST /api/auth/login (directeur@cabinet.fr / admin123)",
            "POST",
            "auth/login",
            200,
            data=self.credentials
        )
        
        if success and 'access_token' in response and 'user' in response:
            self.token = response['access_token']
            user = response['user']
            
            self.log(f"✅ Status 200 - SUCCESS")
            self.log(f"✅ Token JWT retourné: {self.token[:30]}...")
            self.log(f"✅ User data:")
            self.log(f"   - Nom: {user.get('nom', '')}")
            self.log(f"   - Prénom: {user.get('prenom', '')}")
            self.log(f"   - Rôle: {user.get('role', '')}")
            self.log(f"   - Email: {user.get('email', '')}")
            
            # Verify expected data (Francis LEBLOND, Directeur)
            if (user.get('nom') == 'LEBLOND' and 
                user.get('prenom') == 'Francis' and 
                user.get('role') == 'Directeur'):
                self.log(f"✅ VERIFIED: User data matches expected (Francis LEBLOND, Directeur)")
            else:
                self.log(f"⚠️  User data differs from expected Francis LEBLOND")
            
            return True
        else:
            self.log(f"❌ CRITICAL: Login failed or missing token/user data")
            return False

    def test_2_authentification(self):
        """✅ TEST AUTHENTIFICATION: GET /api/users/me avec token"""
        self.log("=" * 60)
        self.log("2. ✅ TEST AUTHENTIFICATION")
        self.log("=" * 60)
        
        if not self.token:
            self.log("❌ SKIPPED: No token available")
            return False
        
        success, response = self.run_test(
            "GET /api/users/me (avec token Directeur)",
            "GET",
            "users/me",
            200,
            token=self.token
        )
        
        if success:
            self.log(f"✅ Authentification fonctionne - Status 200")
            self.log(f"✅ Données utilisateur (Francis LEBLOND, Directeur):")
            self.log(f"   - Nom: {response.get('nom', '')}")
            self.log(f"   - Prénom: {response.get('prenom', '')}")
            self.log(f"   - Rôle: {response.get('role', '')}")
            self.log(f"   - Email: {response.get('email', '')}")
            self.log(f"   - Actif: {response.get('actif', '')}")
            return True
        else:
            self.log(f"❌ FAILED: Cannot verify token authentication")
            return False

    def test_3_endpoints_principaux(self):
        """✅ TEST ENDPOINTS PRINCIPAUX"""
        self.log("=" * 60)
        self.log("3. ✅ TEST ENDPOINTS PRINCIPAUX")
        self.log("=" * 60)
        
        if not self.token:
            self.log("❌ SKIPPED: No token available")
            return False
        
        endpoints_results = []
        
        # GET /api/users - Liste des utilisateurs
        self.log("📋 GET /api/users - Liste des utilisateurs")
        success, users_response = self.run_test(
            "GET /api/users",
            "GET",
            "users",
            200,
            token=self.token
        )
        
        if success:
            self.log(f"   ✅ SUCCESS - {len(users_response)} utilisateurs trouvés")
            for user in users_response:
                self.log(f"      - {user.get('prenom', '')} {user.get('nom', '')} ({user.get('role', '')})")
            endpoints_results.append(True)
        else:
            self.log(f"   ❌ FAILED - Cannot get users list")
            endpoints_results.append(False)
        
        # GET /api/salles - Liste des salles
        self.log("🏥 GET /api/salles - Liste des salles")
        success, salles_response = self.run_test(
            "GET /api/salles",
            "GET",
            "salles",
            200,
            token=self.token
        )
        
        if success:
            self.log(f"   ✅ SUCCESS - {len(salles_response)} salles trouvées")
            for salle in salles_response:
                self.log(f"      - {salle.get('nom', '')} ({salle.get('type_salle', '')})")
            endpoints_results.append(True)
        else:
            self.log(f"   ❌ FAILED - Cannot get salles list")
            endpoints_results.append(False)
        
        # GET /api/configuration - Configuration système
        self.log("⚙️ GET /api/configuration - Configuration système")
        success, config_response = self.run_test(
            "GET /api/configuration",
            "GET",
            "configuration",
            200,
            token=self.token
        )
        
        if success:
            self.log(f"   ✅ SUCCESS - Configuration récupérée")
            if isinstance(config_response, dict):
                self.log(f"      - Max médecins: {config_response.get('max_medecins_par_jour', 'N/A')}")
                self.log(f"      - Max assistants: {config_response.get('max_assistants_par_jour', 'N/A')}")
                self.log(f"      - Horaires matin: {config_response.get('heures_ouverture_matin_debut', 'N/A')}-{config_response.get('heures_ouverture_matin_fin', 'N/A')}")
                self.log(f"      - Horaires après-midi: {config_response.get('heures_ouverture_apres_midi_debut', 'N/A')}-{config_response.get('heures_ouverture_apres_midi_fin', 'N/A')}")
            elif isinstance(config_response, list) and len(config_response) > 0:
                config = config_response[0]
                self.log(f"      - Configuration trouvée (format liste)")
                self.log(f"      - ID: {config.get('id', 'N/A')}")
            endpoints_results.append(True)
        else:
            self.log(f"   ❌ FAILED - Cannot get configuration")
            endpoints_results.append(False)
        
        return all(endpoints_results)

    def run_quick_health_check(self):
        """Run the complete quick health check"""
        self.log("🚀 VÉRIFICATION RAPIDE - Test de santé du système après redémarrage")
        self.log("=" * 80)
        self.log(f"URL Backend: {self.api_url}")
        self.log(f"IDENTIFIANTS: Email: {self.credentials['email']}, Mot de passe: {self.credentials['password']}")
        self.log("OBJECTIF: Confirmer que tous les services sont opérationnels après le redémarrage")
        self.log("=" * 80)
        
        # Run all tests
        test_results = []
        
        # Test 1: Connexion
        test_results.append(self.test_1_connexion())
        
        # Test 2: Authentification
        test_results.append(self.test_2_authentification())
        
        # Test 3: Endpoints principaux
        test_results.append(self.test_3_endpoints_principaux())
        
        # Final summary
        self.log("=" * 80)
        self.log("🎯 RÉSUMÉ - VÉRIFICATION RAPIDE")
        self.log("=" * 80)
        
        passed_tests = sum(test_results)
        total_tests = len(test_results)
        
        self.log(f"Tests réussis: {self.tests_passed}/{self.tests_total}")
        self.log(f"Phases réussies: {passed_tests}/{total_tests}")
        
        if all(test_results):
            self.log("✅ OBJECTIF ATTEINT: Tous les services sont opérationnels après le redémarrage")
            self.log("✅ L'utilisateur peut se connecter avec directeur@cabinet.fr / admin123")
            self.log("✅ Tous les endpoints principaux fonctionnent correctement")
            self.log("✅ Le système est prêt à l'utilisation!")
            self.log("🎉 VALIDATION RAPIDE COMPLÈTEMENT RÉUSSIE!")
            return True
        else:
            self.log("❌ ÉCHEC: Problèmes détectés dans le système")
            self.log("❌ Certains services ne fonctionnent pas correctement")
            self.log("❌ Vérifier la configuration et les services")
            return False

def main():
    """Main function"""
    checker = QuickHealthChecker()
    success = checker.run_quick_health_check()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())