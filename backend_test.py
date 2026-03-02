#!/usr/bin/env python3
"""
TEST COMPLET DE L'APPLICATION APRÈS RESTRUCTURATION
Tests des endpoints backend selon les spécifications du user
URL Backend: https://mongo-render-deploy.preview.emergentagent.com/api
IDENTIFIANTS: directeur@cabinet.fr / admin123
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration des tests
BACKEND_URL = "https://mongo-render-deploy.preview.emergentagent.com/api"
DIRECTOR_EMAIL = "directeur@cabinet.fr"
DIRECTOR_PASSWORD = "admin123"

# Variables globales pour stocker les données de test
auth_token = None
director_data = None

class TestResult:
    def __init__(self, test_name):
        self.test_name = test_name
        self.success = False
        self.status_code = None
        self.details = ""
        self.error_message = ""
    
    def set_success(self, status_code, details=""):
        self.success = True
        self.status_code = status_code
        self.details = details
    
    def set_failure(self, status_code, error_message):
        self.success = False
        self.status_code = status_code
        self.error_message = error_message
    
    def __str__(self):
        status = "✅ PASS" if self.success else "❌ FAIL"
        return f"{status} {self.test_name} - Status: {self.status_code} - {self.details if self.success else self.error_message}"

def print_test_header(section_name):
    print(f"\n{'='*60}")
    print(f"🔍 {section_name}")
    print('='*60)

def make_request(method, endpoint, data=None, headers=None):
    """Helper pour faire des requêtes HTTP avec gestion d'erreur"""
    url = f"{BACKEND_URL}{endpoint}"
    
    # Headers par défaut
    default_headers = {"Content-Type": "application/json"}
    if auth_token:
        default_headers["Authorization"] = f"Bearer {auth_token}"
    
    if headers:
        default_headers.update(headers)
    
    try:
        if method == "GET":
            response = requests.get(url, headers=default_headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, headers=default_headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=default_headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, headers=default_headers, timeout=30)
        
        return response
    except requests.exceptions.Timeout:
        print(f"⚠️ Timeout pour {method} {endpoint}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Erreur de connexion pour {method} {endpoint}: {e}")
        return None

def test_health_endpoints():
    """1) SANTÉ SYSTÈME - Vérifier /api/health et /api/status"""
    print_test_header("1) SANTÉ SYSTÈME")
    
    # Test 1: GET /api/health
    result1 = TestResult("GET /api/health - Vérifier status healthy")
    response = make_request("GET", "/health")
    
    if response and response.status_code == 200:
        data = response.json()
        if data.get("status") == "healthy":
            result1.set_success(200, f"Status: {data.get('status')}, Mongo: {data.get('mongo_connected')}")
        else:
            result1.set_failure(200, f"Status incorrect: {data.get('status')}")
    else:
        result1.set_failure(response.status_code if response else "No Response", "Échec de la requête health")
    
    print(result1)
    
    # Test 2: GET /api/status
    result2 = TestResult("GET /api/status - Vérifier tous les services")
    response = make_request("GET", "/status")
    
    if response and response.status_code == 200:
        data = response.json()
        services = data.get("services", {})
        mongodb_status = services.get("mongodb")
        scheduler_status = services.get("scheduler")
        result2.set_success(200, f"MongoDB: {mongodb_status}, Scheduler: {scheduler_status}")
    else:
        result2.set_failure(response.status_code if response else "No Response", "Échec de la requête status")
    
    print(result2)
    
    return [result1, result2]

def test_authentication():
    """2) AUTHENTIFICATION - POST /api/auth/login et GET /api/users/me"""
    print_test_header("2) AUTHENTIFICATION")
    global auth_token, director_data
    
    # Test 1: POST /api/auth/login - Connexion directeur
    result1 = TestResult("POST /api/auth/login - Connexion directeur")
    login_data = {
        "email": DIRECTOR_EMAIL,
        "password": DIRECTOR_PASSWORD
    }
    
    response = make_request("POST", "/auth/login", data=login_data)
    
    if response and response.status_code == 200:
        data = response.json()
        auth_token = data.get("access_token")
        director_data = data.get("user")
        
        if auth_token and director_data:
            result1.set_success(200, f"Token obtenu, User: {director_data.get('prenom')} {director_data.get('nom')} ({director_data.get('role')})")
        else:
            result1.set_failure(200, "Token ou données utilisateur manquants")
    else:
        result1.set_failure(response.status_code if response else "No Response", "Échec de la connexion")
    
    print(result1)
    
    # Test 2: GET /api/users/me - Vérifier token
    result2 = TestResult("GET /api/users/me - Vérifier token")
    if auth_token:
        response = make_request("GET", "/users/me")
        
        if response and response.status_code == 200:
            data = response.json()
            result2.set_success(200, f"Token validé, User: {data.get('prenom')} {data.get('nom')} ({data.get('role')})")
        else:
            result2.set_failure(response.status_code if response else "No Response", "Token invalide ou expiré")
    else:
        result2.set_failure("N/A", "Pas de token disponible pour le test")
    
    print(result2)
    
    return [result1, result2]

def test_main_endpoints():
    """3) ENDPOINTS PRINCIPAUX - GET /api/users, /api/salles, /api/configuration"""
    print_test_header("3) ENDPOINTS PRINCIPAUX")
    
    # Test 1: GET /api/users - Liste utilisateurs
    result1 = TestResult("GET /api/users - Liste utilisateurs")
    response = make_request("GET", "/users")
    
    if response and response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            result1.set_success(200, f"{len(data)} utilisateur(s) trouvé(s)")
        else:
            result1.set_failure(200, f"Format de réponse inattendu: {type(data)}")
    else:
        result1.set_failure(response.status_code if response else "No Response", "Échec récupération utilisateurs")
    
    print(result1)
    
    # Test 2: GET /api/salles - Liste salles
    result2 = TestResult("GET /api/salles - Liste salles")
    response = make_request("GET", "/salles")
    
    if response and response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            result2.set_success(200, f"{len(data)} salle(s) trouvée(s)")
        else:
            result2.set_failure(200, f"Format de réponse inattendu: {type(data)}")
    else:
        result2.set_failure(response.status_code if response else "No Response", "Échec récupération salles")
    
    print(result2)
    
    # Test 3: GET /api/configuration - Configuration cabinet
    result3 = TestResult("GET /api/configuration - Configuration cabinet")
    response = make_request("GET", "/configuration")
    
    if response and response.status_code == 200:
        data = response.json()
        max_medecins = data.get("max_medecins_par_jour")
        max_assistants = data.get("max_assistants_par_jour")
        horaires = f"{data.get('heures_ouverture_matin_debut')}-{data.get('heures_ouverture_matin_fin')}, {data.get('heures_ouverture_apres_midi_debut')}-{data.get('heures_ouverture_apres_midi_fin')}"
        result3.set_success(200, f"Max médecins: {max_medecins}, assistants: {max_assistants}, horaires: {horaires}")
    else:
        result3.set_failure(response.status_code if response else "No Response", "Échec récupération configuration")
    
    print(result3)
    
    return [result1, result2, result3]

def test_notifications():
    """4) NOTIFICATIONS - Firebase status, scheduler status, notifications list"""
    print_test_header("4) NOTIFICATIONS")
    
    # Test 1: GET /api/notifications/firebase-status
    result1 = TestResult("GET /api/notifications/firebase-status - Status Firebase")
    response = make_request("GET", "/notifications/firebase-status")
    
    if response and response.status_code == 200:
        data = response.json()
        initialized = data.get("initialized")
        has_env_var = data.get("has_env_var", data.get("credentials_source") != "none")
        result1.set_success(200, f"Firebase initialized: {initialized}, has_env_var: {has_env_var}")
    else:
        result1.set_failure(response.status_code if response else "No Response", "Échec récupération status Firebase")
    
    print(result1)
    
    # Test 2: GET /api/notifications/scheduler-status
    result2 = TestResult("GET /api/notifications/scheduler-status - Scheduler actif")
    response = make_request("GET", "/notifications/scheduler-status")
    
    if response and response.status_code == 200:
        data = response.json()
        scheduler_running = data.get("scheduler_running")
        jobs = data.get("jobs", [])
        daily_job = any(job.get("id") == "daily_planning_notification" for job in jobs)
        result2.set_success(200, f"Scheduler running: {scheduler_running}, Daily job: {daily_job}")
    else:
        result2.set_failure(response.status_code if response else "No Response", "Échec récupération status scheduler")
    
    print(result2)
    
    # Test 3: GET /api/notifications - Liste notifications utilisateur
    result3 = TestResult("GET /api/notifications - Liste notifications utilisateur")
    response = make_request("GET", "/notifications")
    
    if response and response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            result3.set_success(200, f"{len(data)} notification(s) trouvée(s)")
        else:
            result3.set_failure(200, f"Format de réponse inattendu: {type(data)}")
    else:
        result3.set_failure(response.status_code if response else "No Response", "Échec récupération notifications")
    
    print(result3)
    
    return [result1, result2, result3]

def test_planning():
    """5) PLANNING - GET /api/planning/semaine/{date}"""
    print_test_header("5) PLANNING")
    
    # Test avec une date de cette semaine
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    date_str = monday.strftime('%Y-%m-%d')
    
    result = TestResult(f"GET /api/planning/semaine/{date_str} - Planning semaine")
    response = make_request("GET", f"/planning/semaine/{date_str}")
    
    if response and response.status_code == 200:
        data = response.json()
        dates = data.get("dates", [])
        planning = data.get("planning", {})
        result.set_success(200, f"Semaine récupérée: {len(dates)} jours, planning: {len(planning)} entrées")
    else:
        result.set_failure(response.status_code if response else "No Response", "Échec récupération planning semaine")
    
    print(result)
    
    return [result]

def test_messages():
    """6) MESSAGES - GET /api/messages"""
    print_test_header("6) MESSAGES")
    
    result = TestResult("GET /api/messages - Messages généraux")
    response = make_request("GET", "/messages")
    
    if response and response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            result.set_success(200, f"{len(data)} message(s) trouvé(s)")
        else:
            result.set_failure(200, f"Format de réponse inattendu: {type(data)}")
    else:
        result.set_failure(response.status_code if response else "No Response", "Échec récupération messages")
    
    print(result)
    
    return [result]

def run_complete_test():
    """Lance tous les tests et génère un rapport final"""
    print("🚀 DÉMARRAGE DU TEST COMPLET DE L'APPLICATION APRÈS RESTRUCTURATION")
    print(f"🎯 Backend URL: {BACKEND_URL}")
    print(f"👤 Identifiants: {DIRECTOR_EMAIL} / {DIRECTOR_PASSWORD}")
    print(f"⏰ Date/Heure: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    all_results = []
    
    # Exécuter tous les tests dans l'ordre
    try:
        all_results.extend(test_health_endpoints())
        all_results.extend(test_authentication())
        all_results.extend(test_main_endpoints())
        all_results.extend(test_notifications())
        all_results.extend(test_planning())
        all_results.extend(test_messages())
        
    except Exception as e:
        print(f"❌ Erreur critique during tests: {e}")
    
    # Générer le rapport final
    print_test_header("📊 RAPPORT FINAL")
    
    total_tests = len(all_results)
    successful_tests = sum(1 for result in all_results if result.success)
    failed_tests = total_tests - successful_tests
    success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
    
    print(f"📈 RÉSULTATS GLOBAUX:")
    print(f"   • Total des tests: {total_tests}")
    print(f"   • Tests réussis: {successful_tests}")
    print(f"   • Tests échoués: {failed_tests}")
    print(f"   • Taux de réussite: {success_rate:.1f}%")
    
    if failed_tests > 0:
        print(f"\n❌ TESTS ÉCHOUÉS ({failed_tests}):")
        for result in all_results:
            if not result.success:
                print(f"   • {result.test_name}: {result.error_message} (Status: {result.status_code})")
    
    print(f"\n✅ TESTS RÉUSSIS ({successful_tests}):")
    for result in all_results:
        if result.success:
            print(f"   • {result.test_name}: {result.details}")
    
    # Déterminer le statut global
    if success_rate >= 90:
        print(f"\n🎉 STATUT GLOBAL: EXCELLENT ({success_rate:.1f}%)")
        print("✅ L'application fonctionne parfaitement après la restructuration!")
    elif success_rate >= 80:
        print(f"\n✅ STATUT GLOBAL: BON ({success_rate:.1f}%)")
        print("⚠️ Quelques problèmes mineurs détectés")
    elif success_rate >= 60:
        print(f"\n⚠️ STATUT GLOBAL: MOYEN ({success_rate:.1f}%)")
        print("❗ Plusieurs problèmes à corriger")
    else:
        print(f"\n❌ STATUT GLOBAL: CRITIQUE ({success_rate:.1f}%)")
        print("🚨 Problèmes majeurs détectés - intervention requise")
    
    print(f"\n{'='*60}")
    print("🏁 TEST COMPLET TERMINÉ")
    print(f"{'='*60}")
    
    return success_rate >= 80  # Retourne True si le test global est réussi

if __name__ == "__main__":
    success = run_complete_test()
    exit(0 if success else 1)