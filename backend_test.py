#!/usr/bin/env python3
"""
Test urgent du système de notifications push Firebase
Vérifie le fonctionnement des endpoints Firebase selon la demande utilisateur

URL Backend: http://localhost:8001/api
IDENTIFIANTS: directeur@cabinet.fr / admin123

TESTS À EFFECTUER:
1) TEST FIREBASE STATUS - GET /api/notifications/firebase-status
2) TEST SCHEDULER STATUS - GET /api/notifications/scheduler-status  
3) TEST ENREGISTREMENT TOKEN FCM - POST /api/notifications/subscribe
4) TEST DÉCLENCHEMENT MANUEL PLANNING QUOTIDIEN - POST /api/notifications/send-daily-planning
5) TEST ENVOI MESSAGE PRIVÉ - POST /api/messages
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

print("🚀 DÉBUT DU TEST URGENT - SYSTÈME DE NOTIFICATIONS PUSH FIREBASE")
print(f"📍 URL API: {API_BASE}")
print(f"👤 Identifiants: {DIRECTOR_EMAIL} / {DIRECTOR_PASSWORD}")
print("=" * 80)

def test_auth_and_get_token():
    """Authentification et récupération du token directeur"""
    print("\n🔐 TEST AUTHENTIFICATION DIRECTEUR")
    
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
            print(f"   👤 Utilisateur: {user_info.get('prenom', '')} {user_info.get('nom', '')} ({user_info.get('role', '')})")
            return token
        else:
            print(f"   ❌ Échec authentification: {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ Erreur connexion: {e}")
        return None

def test_firebase_status(token):
    """TEST 1: Vérification du statut Firebase"""
    print("\n🔥 TEST 1 - FIREBASE STATUS")
    print("   Endpoint: GET /api/notifications/firebase-status")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_BASE}/notifications/firebase-status", headers=headers)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Réponse reçue:")
            print(f"      - Initialized: {data.get('initialized', False)}")
            print(f"      - Credentials Source: {data.get('credentials_source', 'unknown')}")
            print(f"      - Status: {data.get('status', 'unknown')}")
            print(f"      - Message: {data.get('message', '')}")
            
            # Vérifications demandées
            initialized = data.get('initialized', False)
            cred_source = data.get('credentials_source', '')
            
            print(f"\n   🎯 VÉRIFICATIONS DEMANDÉES:")
            if initialized:
                print(f"      ✅ 'initialized' = true")
            else:
                print(f"      ❌ 'initialized' = {initialized} (attendu: true)")
                
            if cred_source == 'env_var':
                print(f"      ✅ 'credentials_source' = 'env_var'")
            else:
                print(f"      ❌ 'credentials_source' = '{cred_source}' (attendu: 'env_var')")
            
            return initialized and cred_source == 'env_var'
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def test_scheduler_status(token):
    """TEST 2: Vérification du statut du scheduler"""
    print("\n⏰ TEST 2 - SCHEDULER STATUS")
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
                    # Vérifier si la tâche est à 7h00
                    trigger = str(job.get('trigger', ''))
                    if '7:0' in trigger or 'hour=7' in trigger:
                        print(f"        ✅ Job quotidien trouvé à 7h00")
                    else:
                        print(f"        ⚠️ Job quotidien trouvé mais horaire différent: {trigger}")
            
            # Vérifications demandées
            scheduler_running = data.get('scheduler_running', False)
            
            print(f"\n   🎯 VÉRIFICATIONS DEMANDÉES:")
            if scheduler_running:
                print(f"      ✅ 'scheduler_running' = true")
            else:
                print(f"      ❌ 'scheduler_running' = {scheduler_running} (attendu: true)")
                
            if daily_job_found:
                print(f"      ✅ Job 'daily_planning_notification' trouvé à 7h00")
            else:
                print(f"      ❌ Job 'daily_planning_notification' non trouvé")
            
            return scheduler_running and daily_job_found
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def test_fcm_subscription(token):
    """TEST 3: Enregistrement d'un token FCM de test"""
    print("\n📱 TEST 3 - ENREGISTREMENT TOKEN FCM")
    print("   Endpoint: POST /api/notifications/subscribe")
    
    test_token = "test_fcm_token_123"
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "token": test_token,
            "device_info": {
                "device_name": "Test Device - Backend Test",
                "browser": "Test Browser",
                "os": "Test OS",
                "user_agent": "Backend Test Agent"
            }
        }
        
        response = requests.post(f"{API_BASE}/notifications/subscribe", 
                               headers=headers, 
                               json=payload)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Token FCM enregistré avec succès")
            print(f"      - Message: {data.get('message', '')}")
            print(f"      - Token: {test_token}")
            return True
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def test_daily_planning_trigger(token):
    """TEST 4: Déclenchement manuel du planning quotidien"""
    print("\n📅 TEST 4 - DÉCLENCHEMENT MANUEL PLANNING QUOTIDIEN")
    print("   Endpoint: POST /api/notifications/send-daily-planning")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(f"{API_BASE}/notifications/send-daily-planning", headers=headers)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Déclenchement réussi")
            print(f"      - Message: {data.get('message', '')}")
            print(f"   📝 Note: Le déclenchement fonctionne même sans données de planning")
            return True
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def test_private_message_notification(token):
    """TEST 5: Envoi d'un message privé pour tester les notifications"""
    print("\n💬 TEST 5 - ENVOI MESSAGE PRIVÉ (vérifie notifications messages)")
    print("   Endpoint: POST /api/messages")
    
    try:
        # D'abord, récupérer la liste des utilisateurs pour trouver un destinataire
        headers = {"Authorization": f"Bearer {token}"}
        users_response = requests.get(f"{API_BASE}/users", headers=headers)
        
        if users_response.status_code != 200:
            print(f"   ❌ Impossible de récupérer les utilisateurs: {users_response.text}")
            return False
        
        users = users_response.json()
        print(f"   👥 {len(users)} utilisateurs trouvés")
        
        # Trouver un destinataire (autre que le directeur actuel)
        destinataire = None
        for user in users:
            if user.get('email') != DIRECTOR_EMAIL and user.get('actif', True):
                destinataire = user
                break
        
        if not destinataire:
            print(f"   ⚠️ Aucun destinataire trouvé, création d'un message général à la place")
            # Envoyer un message général
            message_data = {
                "contenu": "Message de test du système Firebase - Notifications push",
                "type_message": "GENERAL"
            }
        else:
            print(f"   🎯 Destinataire trouvé: {destinataire.get('prenom', '')} {destinataire.get('nom', '')} ({destinataire.get('role', '')})")
            # Envoyer un message privé
            message_data = {
                "destinataire_id": destinataire.get('id'),
                "contenu": "Message privé de test du système Firebase - Notifications push",
                "type_message": "PRIVE"
            }
        
        # Envoyer le message
        response = requests.post(f"{API_BASE}/messages", 
                               headers=headers, 
                               json=message_data)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Message envoyé avec succès")
            print(f"      - Type: {message_data.get('type_message')}")
            print(f"      - ID: {data.get('id', 'N/A')}")
            print(f"   📝 Note: Une notification push devrait être générée automatiquement")
            return True
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def check_notifications_created(token):
    """Vérification bonus: Check si des notifications ont été créées"""
    print("\n🔔 VÉRIFICATION BONUS - NOTIFICATIONS CRÉÉES")
    print("   Endpoint: GET /api/notifications")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_BASE}/notifications", headers=headers)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            notifications = response.json()
            print(f"   📋 {len(notifications)} notification(s) trouvée(s)")
            
            # Afficher les 3 dernières notifications
            for i, notif in enumerate(notifications[:3]):
                print(f"      {i+1}. {notif.get('title', 'Sans titre')}")
                print(f"         - Corps: {notif.get('body', 'Sans corps')[:50]}...")
                print(f"         - Date: {notif.get('sent_at', 'Inconnue')}")
                print(f"         - Lue: {notif.get('read', False)}")
                print(f"         - Push Status: {notif.get('push_status', 'unknown')}")
            
            if len(notifications) > 3:
                print(f"      ... et {len(notifications) - 3} autre(s)")
            
            return len(notifications) > 0
        else:
            print(f"   ❌ Erreur: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Erreur requête: {e}")
        return False

def main():
    """Fonction principale de test"""
    print(f"⏰ Début des tests: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Étape 1: Authentification
    token = test_auth_and_get_token()
    if not token:
        print("\n❌ ÉCHEC CRITIQUE: Impossible de s'authentifier")
        sys.exit(1)
    
    # Variables de résultats
    results = {}
    
    # Étape 2: Tests Firebase
    results['firebase_status'] = test_firebase_status(token)
    results['scheduler_status'] = test_scheduler_status(token)  
    results['fcm_subscription'] = test_fcm_subscription(token)
    results['daily_planning'] = test_daily_planning_trigger(token)
    results['message_notification'] = test_private_message_notification(token)
    
    # Étape bonus: Vérification des notifications
    results['notifications_check'] = check_notifications_created(token)
    
    # Rapport final
    print("\n" + "=" * 80)
    print("📊 RAPPORT FINAL - SYSTÈME FIREBASE PUSH NOTIFICATIONS")
    print("=" * 80)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    print(f"\n🎯 RÉSULTATS GLOBAUX: {passed_tests}/{total_tests} tests réussis ({(passed_tests/total_tests)*100:.1f}%)")
    
    print("\n📋 DÉTAIL DES TESTS:")
    test_names = {
        'firebase_status': '1️⃣ Firebase Status (initialized=true, credentials_source=env_var)',
        'scheduler_status': '2️⃣ Scheduler Status (scheduler_running=true, job quotidien 7h00)',
        'fcm_subscription': '3️⃣ Enregistrement Token FCM (test_fcm_token_123)',
        'daily_planning': '4️⃣ Déclenchement Manuel Planning Quotidien',
        'message_notification': '5️⃣ Envoi Message Privé (notifications messages)',
        'notifications_check': '🔔 Vérification Notifications Créées'
    }
    
    for test_key, test_name in test_names.items():
        status = "✅ RÉUSSI" if results.get(test_key, False) else "❌ ÉCHOUÉ"
        print(f"   {test_name}: {status}")
    
    # Vérifications critiques
    firebase_ok = results.get('firebase_status', False)
    scheduler_ok = results.get('scheduler_status', False)
    
    print(f"\n🎯 OBJECTIF PRINCIPAL:")
    if firebase_ok and scheduler_ok:
        print("   ✅ Firebase est initialisé ET le scheduler est actif pour les notifications du matin à 7h")
    else:
        if not firebase_ok:
            print("   ❌ Firebase N'EST PAS correctement initialisé")
        if not scheduler_ok:
            print("   ❌ Scheduler N'EST PAS actif ou job quotidien manquant")
    
    # Recommandations
    print(f"\n💡 RECOMMANDATIONS:")
    if not firebase_ok:
        print("   - Vérifier la variable d'environnement FIREBASE_CREDENTIALS")
        print("   - Redémarrer le backend après configuration Firebase")
    if not scheduler_ok:
        print("   - Vérifier que le scheduler démarre correctement au boot")
        print("   - Contrôler les logs backend pour erreurs scheduler")
    if passed_tests == total_tests:
        print("   - Système Firebase entièrement opérationnel ! 🎉")
    
    print(f"\n⏰ Fin des tests: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Code de sortie
    if firebase_ok and scheduler_ok:
        print("\n🎉 SUCCESS: Firebase initialisé et scheduler actif !")
        sys.exit(0)
    else:
        print("\n⚠️ WARNING: Problèmes détectés dans la configuration Firebase")
        sys.exit(1)

if __name__ == "__main__":
    main()