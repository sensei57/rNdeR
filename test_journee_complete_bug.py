#!/usr/bin/env python3
"""
Test JOURNEE_COMPLETE bug for assistants/secretaries - CRITICAL BUG REPRODUCTION
"""

import requests
import sys
from datetime import datetime
import json

class JourneeCompleteBugTester:
    def __init__(self, base_url="https://schedule-repair-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.directeur_token = None
        self.assistant_id = None
        
    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
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

    def test_journee_complete_assistant_bug(self):
        """Test JOURNEE_COMPLETE bug for assistants/secretaries - CRITICAL BUG REPRODUCTION"""
        print("\n🐛 TEST CRITIQUE - DEMANDE JOURNEE_COMPLETE POUR ASSISTANT/SECRETAIRE")
        print("="*80)
        print("CONTEXTE: Quand on crée une demande JOURNEE_COMPLETE pour un assistant ou secrétaire")
        print("et qu'on l'approuve, les créneaux ne sont PAS créés dans le planning.")
        print("Par contre, ça fonctionne pour :")
        print("- Demandes MATIN → Créneau créé ✅")
        print("- Demandes APRES_MIDI → Créneau créé ✅") 
        print("- Demandes JOURNEE_COMPLETE pour MEDECINS → Créneaux créés ✅")
        print("- Demandes JOURNEE_COMPLETE pour ASSISTANTS/SECRETAIRES → Créneaux NON créés ❌")
        print("="*80)
        
        # Login Directeur
        success, response = self.run_test(
            "Connexion Directeur",
            "POST",
            "auth/login",
            200,
            data={"email": "directeur@cabinet.fr", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.directeur_token = response['access_token']
            print(f"   ✅ Directeur connecté: {response['user']['prenom']} {response['user']['nom']}")
        else:
            print(f"   ❌ ÉCHEC connexion Directeur - Tests annulés")
            return False
        
        # Get assistant ID
        success, users_data = self.run_test(
            "Récupération liste utilisateurs",
            "GET",
            "users",
            200,
            token=self.directeur_token
        )
        
        if success:
            assistants = [u for u in users_data if u['role'] == 'Assistant' and u.get('actif', True)]
            if assistants:
                self.assistant_id = assistants[0]['id']
                assistant_name = f"{assistants[0]['prenom']} {assistants[0]['nom']}"
                print(f"   ✅ Assistant trouvé: {assistant_name} (ID: {self.assistant_id})")
            else:
                print(f"   ❌ AUCUN ASSISTANT TROUVÉ - Tests annulés")
                return False
        else:
            print(f"   ❌ Impossible de récupérer les utilisateurs")
            return False
        
        # **PHASE 1 : CRÉER DEMANDE POUR ASSISTANT**
        print(f"\n🔍 PHASE 1 - Créer demande JOURNEE_COMPLETE pour assistant")
        print("-" * 60)
        
        demande_data = {
            "date_demandee": "2025-12-20",
            "creneau": "JOURNEE_COMPLETE", 
            "motif": "Test assistant journée complète",
            "medecin_id": self.assistant_id
        }
        
        success, response = self.run_test(
            "POST /api/demandes-travail (JOURNEE_COMPLETE pour assistant)",
            "POST",
            "demandes-travail",
            200,
            data=demande_data,
            token=self.directeur_token
        )
        
        demande_id = None
        if success and isinstance(response, list) and len(response) > 0:
            demande_id = response[0].get('id')
            print(f"   ✅ Demande créée avec succès")
            print(f"   📋 ID de la demande: {demande_id}")
            print(f"   📋 Date: {response[0].get('date_demandee')}")
            print(f"   📋 Créneau: {response[0].get('creneau')}")
            print(f"   📋 Statut: {response[0].get('statut')}")
        else:
            print(f"   ❌ ÉCHEC création demande - Tests annulés")
            print(f"   Response: {response}")
            return False
        
        # **PHASE 2 : APPROUVER LA DEMANDE**
        print(f"\n🔍 PHASE 2 - Approuver la demande")
        print("-" * 60)
        
        approval_data = {
            "approuve": True,
            "commentaire": "Test approbation journée complète"
        }
        
        success, response = self.run_test(
            f"PUT /api/demandes-travail/{demande_id}/approuver",
            "PUT",
            f"demandes-travail/{demande_id}/approuver",
            200,
            data=approval_data,
            token=self.directeur_token
        )
        
        if success:
            print(f"   ✅ Demande approuvée avec succès")
            print(f"   📋 Message: {response.get('message', 'N/A')}")
        else:
            print(f"   ❌ ÉCHEC approbation demande")
            print(f"   Response: {response}")
            return False
        
        # **PHASE 3 : VÉRIFIER LES CRÉNEAUX CRÉÉS**
        print(f"\n🔍 PHASE 3 - Vérifier les créneaux créés dans le planning")
        print("-" * 60)
        
        success, planning_data = self.run_test(
            "GET /api/planning/2025-12-20",
            "GET",
            "planning/2025-12-20",
            200,
            token=self.directeur_token
        )
        
        creneaux_assistant = []
        if success:
            # Filtrer les créneaux pour cet assistant
            creneaux_assistant = [c for c in planning_data if c.get('employe_id') == self.assistant_id]
            
            print(f"   📊 Total créneaux dans le planning: {len(planning_data)}")
            print(f"   📊 Créneaux pour l'assistant: {len(creneaux_assistant)}")
            
            if len(creneaux_assistant) == 2:
                # Vérifier MATIN et APRES_MIDI
                creneaux_types = [c.get('creneau') for c in creneaux_assistant]
                if 'MATIN' in creneaux_types and 'APRES_MIDI' in creneaux_types:
                    print(f"   ✅ SUCCÈS: Les 2 créneaux (MATIN + APRES_MIDI) ont été créés!")
                    for creneau in creneaux_assistant:
                        print(f"      - {creneau.get('creneau')}: ID={creneau.get('id')}")
                else:
                    print(f"   ❌ PROBLÈME: Créneaux créés mais pas MATIN+APRES_MIDI")
                    print(f"      Créneaux trouvés: {creneaux_types}")
            elif len(creneaux_assistant) == 1:
                print(f"   ⚠️  PARTIEL: Seulement 1 créneau créé au lieu de 2")
                print(f"      Créneau: {creneaux_assistant[0].get('creneau')}")
            elif len(creneaux_assistant) == 0:
                print(f"   ❌ BUG CONFIRMÉ: AUCUN créneau créé pour l'assistant!")
                print(f"   🐛 C'est exactement le bug signalé par l'utilisateur")
            else:
                print(f"   ⚠️  INATTENDU: {len(creneaux_assistant)} créneaux trouvés")
        else:
            print(f"   ❌ Impossible de récupérer le planning")
            return False
        
        # **PHASE 4 : TEST COMPARATIF AVEC MATIN**
        print(f"\n🔍 PHASE 4 - Test comparatif avec demande MATIN")
        print("-" * 60)
        
        demande_matin_data = {
            "date_demandee": "2025-12-21",
            "creneau": "MATIN",
            "motif": "Test assistant matin seulement", 
            "medecin_id": self.assistant_id
        }
        
        success, response = self.run_test(
            "POST /api/demandes-travail (MATIN pour assistant)",
            "POST",
            "demandes-travail",
            200,
            data=demande_matin_data,
            token=self.directeur_token
        )
        
        demande_matin_id = None
        if success and isinstance(response, list) and len(response) > 0:
            demande_matin_id = response[0].get('id')
            print(f"   ✅ Demande MATIN créée: {demande_matin_id}")
        else:
            print(f"   ❌ ÉCHEC création demande MATIN")
            return False
        
        # Approuver la demande MATIN
        success, response = self.run_test(
            f"PUT /api/demandes-travail/{demande_matin_id}/approuver (MATIN)",
            "PUT",
            f"demandes-travail/{demande_matin_id}/approuver",
            200,
            data={"approuve": True, "commentaire": "Test approbation matin"},
            token=self.directeur_token
        )
        
        if success:
            print(f"   ✅ Demande MATIN approuvée")
        else:
            print(f"   ❌ ÉCHEC approbation MATIN")
            return False
        
        # Vérifier que le créneau MATIN est créé
        success, planning_matin = self.run_test(
            "GET /api/planning/2025-12-21",
            "GET",
            "planning/2025-12-21",
            200,
            token=self.directeur_token
        )
        
        matin_works = False
        if success:
            creneaux_matin_assistant = [c for c in planning_matin if c.get('employe_id') == self.assistant_id and c.get('creneau') == 'MATIN']
            
            if len(creneaux_matin_assistant) == 1:
                print(f"   ✅ SUCCÈS: Créneau MATIN créé correctement pour l'assistant")
                print(f"      ID: {creneaux_matin_assistant[0].get('id')}")
                matin_works = True
            else:
                print(f"   ❌ PROBLÈME: Créneau MATIN non créé ({len(creneaux_matin_assistant)} trouvés)")
        
        # **PHASE 5 : ANALYSER LES LOGS**
        print(f"\n🔍 PHASE 5 - Analyser les logs backend")
        print("-" * 60)
        
        # Check backend logs for errors
        try:
            import subprocess
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            if result.stdout:
                print(f"   📋 Logs backend (dernières 50 lignes):")
                print(f"   {result.stdout}")
            else:
                print(f"   ℹ️  Aucun log d'erreur récent trouvé")
        except Exception as e:
            print(f"   ⚠️  Impossible de lire les logs: {e}")
        
        # **RÉSUMÉ FINAL**
        print(f"\n" + "="*80)
        print(f"🎯 RÉSUMÉ DU TEST - BUG JOURNEE_COMPLETE ASSISTANT")
        print("="*80)
        
        bug_confirmed = len(creneaux_assistant) == 0
        
        print(f"📊 RÉSULTATS:")
        print(f"   - Demande JOURNEE_COMPLETE créée: ✅")
        print(f"   - Demande JOURNEE_COMPLETE approuvée: ✅")
        print(f"   - Créneaux créés pour JOURNEE_COMPLETE: {'❌' if bug_confirmed else '✅'}")
        print(f"   - Demande MATIN fonctionne: {'✅' if matin_works else '❌'}")
        
        if bug_confirmed:
            print(f"\n🐛 BUG CONFIRMÉ!")
            print(f"   Le problème signalé par l'utilisateur est reproductible:")
            print(f"   - Les demandes JOURNEE_COMPLETE pour assistants/secrétaires")
            print(f"   - ne créent PAS de créneaux dans le planning après approbation")
            print(f"   - alors que les demandes MATIN/APRES_MIDI fonctionnent")
        else:
            print(f"\n✅ BUG NON REPRODUIT")
            print(f"   Les créneaux ont été créés correctement")
        
        return not bug_confirmed

def main():
    """Main function to run the test"""
    print("🚀 Running JOURNEE_COMPLETE Assistant Bug Test...")
    
    tester = JourneeCompleteBugTester()
    success = tester.test_journee_complete_assistant_bug()
    
    if success:
        print("🎉 JOURNEE_COMPLETE assistant test completed - No bug found!")
        return 0
    else:
        print("❌ JOURNEE_COMPLETE assistant bug confirmed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())