#!/usr/bin/env python3
"""
TEST RAPIDE - Vérification après restructuration du code

URL Backend: http://localhost:8001/api
IDENTIFIANTS: directeur@cabinet.fr / admin123

TESTS À EFFECTUER (5 minutes max):

1) **TEST SANTÉ BACKEND**
   - GET /api/health
   - Vérifier status: healthy et mongo_connected: true

2) **TEST AUTHENTIFICATION**
   - POST /api/auth/login avec directeur@cabinet.fr / admin123
   - Vérifier qu'on obtient un token JWT

3) **TEST SCHEDULER NOTIFICATIONS**
   - GET /api/notifications/scheduler-status (avec token)
   - Vérifier scheduler_running: true
   - Vérifier job "daily_planning_notification" présent

4) **TEST FIREBASE STATUS**
   - GET /api/notifications/firebase-status (avec token)
   - Vérifier que l'endpoint répond (même si Firebase pas initialisé)

OBJECTIF: Confirmer que la restructuration n'a rien cassé et que le système de notifications est toujours configuré correctement.
"""

import requests
import json
import sys
import os
from datetime import datetime

# Configuration
if os.path.exists('/app/frontend/.env'):
    with open('/app/frontend/.env', 'r') as f:
        content = f.read()
        for line in content.split('\n'):
            if line.startswith('REACT_APP_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break
else:
    BACKEND_URL = "http://localhost:8001"

API_BASE = f"{BACKEND_URL}/api"

# Identifiants de test
DIRECTOR_EMAIL = "directeur@cabinet.fr"
DIRECTOR_PASSWORD = "admin123"

print("🚀 TEST RAPIDE - VÉRIFICATION APRÈS RESTRUCTURATION DU CODE")
print(f"📍 URL API: {API_BASE}")
print(f"👤 Identifiants: {DIRECTOR_EMAIL} / {DIRECTOR_PASSWORD}")
print("=" * 80)

def test_health_endpoint():
    """TEST 1: Santé du backend"""
    print("\n🏥 TEST 1 - SANTÉ BACKEND")
    print("   Endpoint: GET /api/health")
    
    try:
        response = requests.get(f"{API_BASE}/health")
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Réponse reçue:")
            print(f"      - Status: {data.get('status', 'unknown')}")
            print(f"      - Mongo Connected: {data.get('mongo_connected', False)}")
            print(f"      - Timestamp: {data.get('timestamp', 'unknown')}")
            
            # Vérifications demandées
            status_ok = data.get('status') == 'healthy'
            mongo_ok = data.get('mongo_connected', False)
            
            print(f"\n   🎯 VÉRIFICATIONS DEMANDÉES:")
            if status_ok:
                print(f"      ✅ 'status' = 'healthy'")
            else:
                print(f"      ❌ 'status' = '{data.get('status')}' (attendu: 'healthy')")
                
            if mongo_ok:
                print(f"      ✅ 'mongo_connected' = true")
            else:
                print(f"      ❌ 'mongo_connected' = {mongo_ok} (attendu: true)")
            
            return status_ok and mongo_ok
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def test_auth_and_get_token():
    """TEST 2: Authentification et récupération du token directeur"""
    print("\n🔐 TEST 2 - AUTHENTIFICATION")
    print("   Endpoint: POST /api/auth/login")
    
    try:
        response = requests.post(f"{API_BASE}/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            user_info = data.get("user", {})
            print(f"   ✅ Connexion réussie")
            print(f"      - Token JWT obtenu: {token[:20]}...")
            print(f"      - Utilisateur: {user_info.get('prenom', '')} {user_info.get('nom', '')} ({user_info.get('role', '')})")
            print(f"      - Email: {user_info.get('email', '')}")
            return token
        else:
            print(f"   ❌ Échec authentification: {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ Erreur connexion: {e}")
        return None

def test_scheduler_status(token):
    """TEST 3: Vérification du statut du scheduler"""
    print("\n⏰ TEST 3 - SCHEDULER NOTIFICATIONS")
    print("   Endpoint: GET /api/notifications/scheduler-status")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_BASE}/notifications/scheduler-status", headers=headers)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Réponse reçue:")
            print(f"      - Scheduler Running: {data.get('scheduler_running', False)}")
            print(f"      - Timezone: {data.get('timezone', 'unknown')}")
            print(f"      - Daily Notification Time: {data.get('daily_notification_time', 'unknown')}")
            
            jobs = data.get('jobs', [])
            print(f"      - Jobs: {len(jobs)} tâche(s) programmée(s)")
            
            daily_job_found = False
            for job in jobs:
                print(f"        * {job.get('name', job.get('id', 'Unknown'))}")
                print(f"          - ID: {job.get('id')}")
                print(f"          - Next Run: {job.get('next_run')}")
                print(f"          - Trigger: {job.get('trigger')}")
                
                if job.get('id') == 'daily_planning_notification':
                    daily_job_found = True
                    print(f"        ✅ Job 'daily_planning_notification' trouvé")
            
            # Vérifications demandées
            scheduler_running = data.get('scheduler_running', False)
            
            print(f"\n   🎯 VÉRIFICATIONS DEMANDÉES:")
            if scheduler_running:
                print(f"      ✅ 'scheduler_running' = true")
            else:
                print(f"      ❌ 'scheduler_running' = {scheduler_running} (attendu: true)")
                
            if daily_job_found:
                print(f"      ✅ Job 'daily_planning_notification' présent")
            else:
                print(f"      ❌ Job 'daily_planning_notification' NON trouvé")
            
            return scheduler_running and daily_job_found
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def test_firebase_status(token):
    """TEST 4: Vérification du statut Firebase"""
    print("\n🔥 TEST 4 - FIREBASE STATUS")
    print("   Endpoint: GET /api/notifications/firebase-status")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_BASE}/notifications/firebase-status", headers=headers)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Endpoint répond correctement:")
            print(f"      - Initialized: {data.get('initialized', False)}")
            print(f"      - Credentials Source: {data.get('credentials_source', 'unknown')}")
            print(f"      - Status: {data.get('status', 'unknown')}")
            print(f"      - Message: {data.get('message', '')}")
            
            print(f"\n   🎯 VÉRIFICATION DEMANDÉE:")
            print(f"      ✅ L'endpoint répond (même si Firebase pas initialisé)")
            print(f"      📝 Note: Firebase peut ne pas être initialisé en environnement de test")
            
            return True  # L'important est que l'endpoint réponde
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def main():
    """Fonction principale de test rapide (5 minutes max)"""
    print(f"⏰ Début des tests: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Variables de résultats
    results = {}
    
    # TEST 1: Santé backend
    results['health'] = test_health_endpoint()
    
    # TEST 2: Authentification
    token = test_auth_and_get_token()
    results['auth'] = token is not None
    
    if not token:
        print("\n❌ ÉCHEC CRITIQUE: Impossible de s'authentifier")
        print("⚠️ Les tests suivants nécessitent une authentification - ARRÊT")
    else:
        # TEST 3: Scheduler
        results['scheduler'] = test_scheduler_status(token)
        
        # TEST 4: Firebase Status
        results['firebase'] = test_firebase_status(token)
    
    # Rapport final
    print("\n" + "=" * 80)
    print("📊 RAPPORT FINAL - TEST RAPIDE APRÈS RESTRUCTURATION")
    print("=" * 80)
    
    total_tests = len([k for k, v in results.items() if v is not None])
    passed_tests = sum(1 for result in results.values() if result)
    
    print(f"\n🎯 RÉSULTATS GLOBAUX: {passed_tests}/{total_tests} tests réussis ({(passed_tests/total_tests)*100:.1f}%)")
    
    print("\n📋 DÉTAIL DES TESTS:")
    test_names = {
        'health': '1️⃣ Santé Backend (status=healthy, mongo_connected=true)',
        'auth': '2️⃣ Authentification (JWT token obtenu)',
        'scheduler': '3️⃣ Scheduler Notifications (scheduler_running=true)',
        'firebase': '4️⃣ Firebase Status (endpoint répond)'
    }
    
    for test_key, test_name in test_names.items():
        if results.get(test_key) is not None:
            status = "✅ RÉUSSI" if results.get(test_key, False) else "❌ ÉCHOUÉ"
            print(f"   {test_name}: {status}")
    
    # Analyse des résultats critiques
    print(f"\n🎯 OBJECTIF DE LA VÉRIFICATION:")
    if passed_tests == total_tests:
        print("   ✅ La restructuration du code N'A RIEN CASSÉ")
        print("   ✅ Le système de notifications est toujours configuré correctement")
        print("   ✅ Tous les services fonctionnent comme attendu")
    else:
        print("   ⚠️ Des problèmes ont été détectés après la restructuration:")
        if not results.get('health', False):
            print("      - Le backend ou MongoDB ne répond pas correctement")
        if not results.get('auth', False):
            print("      - L'authentification ne fonctionne pas")
        if not results.get('scheduler', False):
            print("      - Le scheduler de notifications a un problème")
        if not results.get('firebase', False):
            print("      - L'endpoint Firebase Status ne répond pas")
    
    print(f"\n⏰ Fin des tests: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Code de sortie
    if passed_tests == total_tests:
        print("\n🎉 SUCCESS: Restructuration réussie - Aucun problème détecté !")
        sys.exit(0)
    else:
        print(f"\n⚠️ WARNING: {total_tests - passed_tests} problème(s) détecté(s) après restructuration")
        sys.exit(1)

if __name__ == "__main__":
    main()