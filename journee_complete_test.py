#!/usr/bin/env python3
"""
TEST URGENT - TRACER EXACTEMENT CE QUI SE PASSE AVEC JOURNEE_COMPLETE
"""

import requests
import json
import sys
from datetime import datetime, timedelta

class JourneeCompleteDebugger:
    def __init__(self):
        # Use the correct backend URL from frontend/.env
        self.api_url = "https://timesheet-monitor-3.preview.emergentagent.com/api"
        
    def run_test(self, description, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        print(f"🔍 Testing {description}...")
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            else:
                print(f"❌ Unsupported method: {method}")
                return False, {}
            
            if response.status_code == expected_status:
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Error text: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"❌ Exception: {e}")
            return False, {}

    def test_journee_complete_bug(self):
        """TEST URGENT - TRACER EXACTEMENT CE QUI SE PASSE AVEC JOURNEE_COMPLETE"""
        print("\n🐛 TEST URGENT - BUG JOURNEE_COMPLETE ASSISTANT/SECRÉTAIRE")
        print("="*80)
        print("CONTEXTE: Malgré toutes les corrections, les demandes JOURNEE_COMPLETE pour")
        print("assistants/secrétaires ne créent toujours pas les 2 créneaux (MATIN + APRES_MIDI)")
        print("dans le planning.")
        print("="*80)
        
        # Identifiants from review request
        directeur_credentials = {"email": "directeur@cabinet.fr", "password": "admin123"}
        directeur_token = None
        assistant_id = None
        demande_id = None
        
        # Use a unique date to avoid conflicts
        test_date = (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d")
        
        # ÉTAPE 1 : Se connecter comme directeur
        print("\n🔍 ÉTAPE 1 : Connexion Directeur")
        print("-" * 50)
        
        success, response = self.run_test(
            "Connexion Directeur (directeur@cabinet.fr / admin123)",
            "POST",
            "auth/login",
            200,
            data=directeur_credentials
        )
        
        if success and 'access_token' in response:
            directeur_token = response['access_token']
            user = response['user']
            print(f"   ✅ SUCCESS: Directeur connecté")
            print(f"   ✅ User: {user.get('prenom', '')} {user.get('nom', '')} ({user.get('role', '')})")
        else:
            print(f"   ❌ CRITICAL FAILURE: Cannot login as director")
            return False
        
        # ÉTAPE 2 : Récupérer l'ID d'un assistant
        print("\n🔍 ÉTAPE 2 : Récupérer ID Assistant")
        print("-" * 50)
        
        success, assistants = self.run_test(
            "GET /api/users/by-role/Assistant",
            "GET",
            "users/by-role/Assistant",
            200,
            token=directeur_token
        )
        
        if success and len(assistants) > 0:
            assistant = assistants[0]
            assistant_id = assistant['id']
            print(f"   ✅ SUCCESS: Assistant trouvé")
            print(f"   ✅ Assistant: {assistant.get('prenom', '')} {assistant.get('nom', '')} (ID: {assistant_id})")
        else:
            print(f"   ❌ CRITICAL FAILURE: No assistant found")
            return False
        
        # ÉTAPE 3 : Créer une demande JOURNEE_COMPLETE pour l'assistant
        print("\n🔍 ÉTAPE 3 : Créer demande JOURNEE_COMPLETE")
        print("-" * 50)
        
        demande_data = {
            "date_demandee": test_date,
            "creneau": "JOURNEE_COMPLETE",
            "motif": "Test debug journée",
            "medecin_id": assistant_id
        }
        
        print(f"   📤 Envoi demande pour date: {test_date}")
        print(f"   📤 Data: {demande_data}")
        
        success, response = self.run_test(
            "POST /api/demandes-travail (JOURNEE_COMPLETE pour assistant)",
            "POST",
            "demandes-travail",
            200,
            data=demande_data,
            token=directeur_token
        )
        
        if success and response:
            # Handle both dict and list responses
            if isinstance(response, list) and len(response) > 0:
                demande_response = response[0]
            elif isinstance(response, dict):
                demande_response = response
            else:
                demande_response = None
            
            if demande_response and 'id' in demande_response:
                demande_id = demande_response['id']
                print(f"   ✅ SUCCESS: Demande créée")
                print(f"   ✅ Demande ID: {demande_id}")
                print(f"   ✅ Date: {demande_response.get('date_demandee', 'N/A')}")
                print(f"   ✅ Créneau: {demande_response.get('creneau', 'N/A')}")
                print(f"   ✅ Statut: {demande_response.get('statut', 'N/A')}")
                print(f"   ✅ Médecin ID: {demande_response.get('medecin_id', 'N/A')}")
            else:
                print(f"   ❌ CRITICAL FAILURE: Invalid response format")
                print(f"   ❌ Response: {response}")
                return False
        else:
            print(f"   ❌ CRITICAL FAILURE: Cannot create JOURNEE_COMPLETE demand")
            return False
        
        # ÉTAPE 4 : Approuver la demande sans creneau_partiel
        print("\n🔍 ÉTAPE 4 : Approuver demande (CRITIQUE)")
        print("-" * 50)
        
        approval_data = {
            "approuve": True
        }
        
        print(f"   📤 Envoi approbation pour demande ID: {demande_id}")
        print(f"   📤 Data: {approval_data}")
        
        success, response = self.run_test(
            f"PUT /api/demandes-travail/{demande_id}/approuver",
            "PUT",
            f"demandes-travail/{demande_id}/approuver",
            200,
            data=approval_data,
            token=directeur_token
        )
        
        if success:
            print(f"   ✅ SUCCESS: Approbation réussie")
            print(f"   ✅ Status: 200 OK")
            print(f"   ✅ Response: {response}")
            
            # CAPTURER la réponse complète
            if isinstance(response, dict):
                message = response.get('message', 'No message')
                print(f"   📋 MESSAGE EXACT RETOURNÉ: '{message}'")
            else:
                print(f"   📋 RESPONSE TYPE: {type(response)}")
                print(f"   📋 RESPONSE CONTENT: {response}")
        else:
            print(f"   ❌ CRITICAL FAILURE: Cannot approve demand")
            return False
        
        # ÉTAPE 5 : Vérifier ce qui a été créé dans le planning
        print("\n🔍 ÉTAPE 5 : Vérifier créneaux créés (CRITIQUE)")
        print("-" * 50)
        
        success, planning_data = self.run_test(
            f"GET /api/planning/{test_date}",
            "GET",
            f"planning/{test_date}",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   ✅ SUCCESS: Planning récupéré")
            print(f"   ✅ Total créneaux dans planning: {len(planning_data)}")
            
            # Filtrer les créneaux de l'assistant
            assistant_creneaux = [c for c in planning_data if c.get('employe_id') == assistant_id]
            print(f"   📊 CRÉNEAUX DE L'ASSISTANT: {len(assistant_creneaux)}")
            
            if len(assistant_creneaux) == 0:
                print(f"   ❌ PROBLÈME CRITIQUE: AUCUN créneau créé pour l'assistant!")
            elif len(assistant_creneaux) == 1:
                creneau = assistant_creneaux[0]
                print(f"   ⚠️  PROBLÈME: Seulement 1 créneau créé (devrait être 2)")
                print(f"      - Créneau: {creneau.get('creneau', 'N/A')}")
                print(f"      - ID: {creneau.get('id', 'N/A')}")
            elif len(assistant_creneaux) == 2:
                print(f"   ✅ EXCELLENT: 2 créneaux créés comme attendu!")
                for i, creneau in enumerate(assistant_creneaux):
                    print(f"      - Créneau {i+1}: {creneau.get('creneau', 'N/A')} (ID: {creneau.get('id', 'N/A')})")
            else:
                print(f"   ⚠️  INATTENDU: {len(assistant_creneaux)} créneaux créés")
            
            # LISTER les valeurs de `creneau` pour chaque créneau créé
            print(f"\n   📋 DÉTAIL DES CRÉNEAUX CRÉÉS:")
            for i, creneau in enumerate(assistant_creneaux):
                print(f"      Créneau {i+1}:")
                print(f"        - ID: {creneau.get('id', 'N/A')}")
                print(f"        - Créneau: '{creneau.get('creneau', 'N/A')}'")
                print(f"        - Employé ID: {creneau.get('employe_id', 'N/A')}")
                print(f"        - Employé Role: {creneau.get('employe_role', 'N/A')}")
                print(f"        - Date: {creneau.get('date', 'N/A')}")
                print(f"        - Salle: {creneau.get('salle_attribuee', 'N/A')}")
        else:
            print(f"   ❌ CRITICAL FAILURE: Cannot get planning data")
            return False
        
        # ÉTAPE 6 : Vérifier le statut de la demande
        print("\n🔍 ÉTAPE 6 : Vérifier statut demande")
        print("-" * 50)
        
        success, demandes = self.run_test(
            "GET /api/demandes-travail",
            "GET",
            "demandes-travail",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   ✅ SUCCESS: Demandes récupérées")
            
            # Trouver notre demande
            notre_demande = None
            for demande in demandes:
                if demande.get('id') == demande_id:
                    notre_demande = demande
                    break
            
            if notre_demande:
                print(f"   ✅ Demande trouvée:")
                print(f"      - ID: {notre_demande.get('id', 'N/A')}")
                print(f"      - Statut: {notre_demande.get('statut', 'N/A')}")
                print(f"      - Créneau: {notre_demande.get('creneau', 'N/A')}")
                print(f"      - Date: {notre_demande.get('date_demandee', 'N/A')}")
                print(f"      - Médecin ID: {notre_demande.get('medecin_id', 'N/A')}")
            else:
                print(f"   ❌ PROBLÈME: Demande non trouvée dans la liste")
        else:
            print(f"   ❌ CRITICAL FAILURE: Cannot get demands")
        
        # ÉTAPE 7 : Vérifier les logs backend
        print("\n🔍 ÉTAPE 7 : Vérifier logs backend")
        print("-" * 50)
        
        try:
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                logs = result.stdout.strip()
                if logs:
                    print(f"   📋 LOGS BACKEND (50 dernières lignes):")
                    for line in logs.split('\n')[-20:]:  # Show last 20 lines
                        if line.strip():
                            print(f"      {line}")
                else:
                    print(f"   ✅ Aucun log d'erreur récent")
            else:
                print(f"   ⚠️  Cannot read backend logs")
        except Exception as e:
            print(f"   ⚠️  Error reading logs: {e}")
        
        # RÉSUMÉ FINAL
        print("\n" + "="*80)
        print("🎯 RÉSUMÉ CRITIQUE - BUG JOURNEE_COMPLETE")
        print("="*80)
        
        if 'assistant_creneaux' in locals():
            creneaux_count = len(assistant_creneaux)
            creneaux_types = [c.get('creneau', 'N/A') for c in assistant_creneaux]
            
            print(f"📊 RÉSULTAT:")
            print(f"   - Nombre de créneaux créés: {creneaux_count}")
            print(f"   - Types de créneaux: {creneaux_types}")
            
            if creneaux_count == 2 and 'MATIN' in creneaux_types and 'APRES_MIDI' in creneaux_types:
                print(f"   ✅ SUCCESS: JOURNEE_COMPLETE fonctionne correctement!")
                print(f"   ✅ Les 2 créneaux (MATIN + APRES_MIDI) ont été créés")
                return True
            elif creneaux_count == 1:
                print(f"   ❌ BUG CONFIRMÉ: Seulement 1 créneau créé au lieu de 2")
                print(f"   ❌ Le système ne divise pas JOURNEE_COMPLETE en MATIN + APRES_MIDI")
                return False
            elif creneaux_count == 0:
                print(f"   ❌ BUG CRITIQUE: Aucun créneau créé!")
                print(f"   ❌ L'approbation n'a pas créé de créneaux dans le planning")
                return False
            else:
                print(f"   ⚠️  COMPORTEMENT INATTENDU: {creneaux_count} créneaux créés")
                return False
        else:
            print(f"   ❌ BUG CRITIQUE: Aucun créneau trouvé pour l'assistant")
            return False

if __name__ == "__main__":
    debugger = JourneeCompleteDebugger()
    success = debugger.test_journee_complete_bug()
    sys.exit(0 if success else 1)