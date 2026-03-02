#!/usr/bin/env python3
"""
TEST COMPLET DE TOUS LES ENDPOINTS BACKEND - Cabinet Medical
URL Backend: https://mongo-render-deploy.preview.emergentagent.com/api  
IDENTIFIANTS: directeur@cabinet.fr / admin123

Tests à effectuer selon la demande utilisateur:
1) SYSTÈME - health, status
2) AUTHENTIFICATION - login, users/me  
3) UTILISATEURS - users list, user detail
4) CENTRES - centres list, centres public
5) PLANNING - planning semaine, planning jour
6) CONGÉS - conges list, mes-conges
7) DEMANDES DE TRAVAIL - demandes list, mes-demandes
8) SALLES - salles list, configuration
9) MESSAGES - messages, groupes
10) NOTIFICATIONS - notifications, firebase-status, scheduler-status, devices
11) STOCKS - categories, articles
12) ACTUALITÉS - actualites
13) ADMIN - inscriptions
"""

import asyncio
import json
import aiohttp
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://mongo-render-deploy.preview.emergentagent.com/api"
USERNAME = "directeur@cabinet.fr"
PASSWORD = "admin123"

class BackendTester:
    def __init__(self):
        self.session = None
        self.auth_token = None
        self.user_info = None
        self.results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "test_details": []
        }
    
    async def setup(self):
        """Initialize session et authentification"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(ssl=False)
        )
        
        # Test de connexion et authentification
        await self.test_authentication()
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()
    
    async def log_test_result(self, category: str, test_name: str, endpoint: str, success: bool, details: str = "", response_data: Any = None):
        """Log un résultat de test"""
        self.results["total_tests"] += 1
        if success:
            self.results["passed_tests"] += 1
            status = "✅ RÉUSSI"
        else:
            self.results["failed_tests"] += 1 
            status = "❌ ÉCHEC"
        
        result = {
            "category": category,
            "test_name": test_name,
            "endpoint": endpoint,
            "status": status,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        
        if response_data is not None and not success:
            result["response_preview"] = str(response_data)[:200] + "..." if len(str(response_data)) > 200 else str(response_data)
        
        self.results["test_details"].append(result)
        
        print(f"{status} [{category}] {test_name} - {endpoint}")
        if details:
            print(f"    💡 {details}")
    
    async def make_request(self, method: str, endpoint: str, headers: Dict = None, data: Any = None) -> tuple:
        """Faire une requête HTTP avec gestion d'erreur"""
        url = f"{BACKEND_URL}/{endpoint.lstrip('/')}"
        
        # Headers par défaut
        default_headers = {"Content-Type": "application/json"}
        if self.auth_token:
            default_headers["Authorization"] = f"Bearer {self.auth_token}"
        
        if headers:
            default_headers.update(headers)
        
        try:
            async with self.session.request(
                method=method,
                url=url,
                headers=default_headers,
                json=data if data else None
            ) as response:
                try:
                    response_data = await response.json()
                except:
                    response_data = await response.text()
                
                return response.status, response_data
                
        except Exception as e:
            return 0, str(e)
    
    async def test_authentication(self):
        """Test de l'authentification"""
        print(f"\n🔐 === TEST AUTHENTIFICATION ===")
        
        # Test POST /auth/login
        login_data = {"email": USERNAME, "password": PASSWORD}
        status, response = await self.make_request("POST", "auth/login", data=login_data)
        
        if status == 200 and isinstance(response, dict) and "access_token" in response:
            self.auth_token = response["access_token"]
            self.user_info = response.get("user", {})
            await self.log_test_result(
                "AUTHENTIFICATION", 
                "Connexion Directeur", 
                "POST /api/auth/login",
                True,
                f"Token obtenu - User: {self.user_info.get('prenom', '')} {self.user_info.get('nom', '')} ({self.user_info.get('role', '')})"
            )
        else:
            await self.log_test_result(
                "AUTHENTIFICATION", 
                "Connexion Directeur", 
                "POST /api/auth/login",
                False,
                f"Status: {status} - {response}",
                response
            )
            return False
        
        # Test GET /users/me
        status, response = await self.make_request("GET", "users/me")
        if status == 200 and isinstance(response, dict):
            await self.log_test_result(
                "AUTHENTIFICATION", 
                "Vérification Token", 
                "GET /api/users/me",
                True,
                f"Authentification valide - {response.get('prenom', '')} {response.get('nom', '')}"
            )
        else:
            await self.log_test_result(
                "AUTHENTIFICATION", 
                "Vérification Token", 
                "GET /api/users/me",
                False,
                f"Status: {status}",
                response
            )
        
        return True
    
    async def test_system_endpoints(self):
        """Test des endpoints système"""
        print(f"\n🔧 === TEST SYSTÈME ===")
        
        # Test GET /health
        status, response = await self.make_request("GET", "health")
        if status == 200 and isinstance(response, dict):
            mongo_status = "✓" if response.get("mongo_connected") else "✗"
            await self.log_test_result(
                "SYSTÈME", 
                "Health Check", 
                "GET /api/health",
                True,
                f"Status: {response.get('status')} - MongoDB: {mongo_status}"
            )
        else:
            await self.log_test_result(
                "SYSTÈME", 
                "Health Check", 
                "GET /api/health",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /status  
        status, response = await self.make_request("GET", "status")
        if status == 200 and isinstance(response, dict):
            services = response.get("services", {})
            mongo_status = services.get("mongodb", "unknown")
            scheduler_status = services.get("scheduler", "unknown")
            await self.log_test_result(
                "SYSTÈME", 
                "Status Détaillé", 
                "GET /api/status",
                True,
                f"MongoDB: {mongo_status}, Scheduler: {scheduler_status}"
            )
        else:
            await self.log_test_result(
                "SYSTÈME", 
                "Status Détaillé", 
                "GET /api/status",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_users_endpoints(self):
        """Test des endpoints utilisateurs"""
        print(f"\n👥 === TEST UTILISATEURS ===")
        
        # Test GET /users
        status, response = await self.make_request("GET", "users")
        if status == 200 and isinstance(response, list):
            await self.log_test_result(
                "UTILISATEURS", 
                "Liste Utilisateurs", 
                "GET /api/users",
                True,
                f"{len(response)} utilisateurs trouvés"
            )
            
            # Endpoint /users/{user_id} n'existe pas - test par rôle à la place
            status2, response2 = await self.make_request("GET", "users/by-role/Directeur")
            if status2 == 200:
                users_by_role_count = len(response2) if isinstance(response2, list) else "N/A"
                await self.log_test_result(
                    "UTILISATEURS", 
                    "Utilisateurs par Rôle", 
                    "GET /api/users/by-role/Directeur",
                    True,
                    f"{users_by_role_count} directeurs trouvés"
                )
            else:
                await self.log_test_result(
                    "UTILISATEURS", 
                    "Utilisateurs par Rôle", 
                    "GET /api/users/by-role/Directeur",
                    False,
                    f"Status: {status2}",
                    response2
                )
        else:
            await self.log_test_result(
                "UTILISATEURS", 
                "Liste Utilisateurs", 
                "GET /api/users",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_centres_endpoints(self):
        """Test des endpoints centres"""
        print(f"\n🏥 === TEST CENTRES ===")
        
        # Test GET /centres
        status, response = await self.make_request("GET", "centres")
        if status == 200:
            centres_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "CENTRES", 
                "Liste Centres", 
                "GET /api/centres",
                True,
                f"{centres_count} centres trouvés"
            )
        else:
            await self.log_test_result(
                "CENTRES", 
                "Liste Centres", 
                "GET /api/centres",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /centres/public
        status, response = await self.make_request("GET", "centres/public")
        if status == 200:
            centres_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "CENTRES", 
                "Centres Publics", 
                "GET /api/centres/public",
                True,
                f"{centres_count} centres publics trouvés"
            )
        else:
            await self.log_test_result(
                "CENTRES", 
                "Centres Publics", 
                "GET /api/centres/public",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_planning_endpoints(self):
        """Test des endpoints planning"""
        print(f"\n📅 === TEST PLANNING ===")
        
        # Date pour les tests
        test_date = "2026-03-02"  # Date fournie dans la demande
        
        # Test GET /planning/semaine/{date}
        status, response = await self.make_request("GET", f"planning/semaine/{test_date}")
        if status == 200:
            dates_count = len(response.get("dates", [])) if isinstance(response, dict) else "N/A"
            await self.log_test_result(
                "PLANNING", 
                "Planning Semaine", 
                f"GET /api/planning/semaine/{test_date}",
                True,
                f"Semaine récupérée - {dates_count} jours"
            )
        else:
            await self.log_test_result(
                "PLANNING", 
                "Planning Semaine", 
                f"GET /api/planning/semaine/{test_date}",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /planning/jour/{date}
        status, response = await self.make_request("GET", f"planning/jour/{test_date}")
        if status == 200:
            creneaux_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "PLANNING", 
                "Planning Jour", 
                f"GET /api/planning/jour/{test_date}",
                True,
                f"{creneaux_count} créneaux trouvés"
            )
        else:
            await self.log_test_result(
                "PLANNING", 
                "Planning Jour", 
                f"GET /api/planning/jour/{test_date}",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_conges_endpoints(self):
        """Test des endpoints congés"""
        print(f"\n🏖️ === TEST CONGÉS ===")
        
        # Test GET /conges
        status, response = await self.make_request("GET", "conges")
        if status == 200:
            conges_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "CONGÉS", 
                "Liste Congés", 
                "GET /api/conges",
                True,
                f"{conges_count} demandes de congés"
            )
        else:
            await self.log_test_result(
                "CONGÉS", 
                "Liste Congés", 
                "GET /api/conges",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /conges/mes-conges
        status, response = await self.make_request("GET", "conges/mes-conges")
        if status == 200:
            mes_conges_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "CONGÉS", 
                "Mes Congés", 
                "GET /api/conges/mes-conges",
                True,
                f"{mes_conges_count} mes congés"
            )
        else:
            await self.log_test_result(
                "CONGÉS", 
                "Mes Congés", 
                "GET /api/conges/mes-conges",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_demandes_travail_endpoints(self):
        """Test des endpoints demandes de travail"""
        print(f"\n💼 === TEST DEMANDES DE TRAVAIL ===")
        
        # Test GET /demandes-travail
        status, response = await self.make_request("GET", "demandes-travail")
        if status == 200:
            demandes_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "DEMANDES TRAVAIL", 
                "Liste Demandes", 
                "GET /api/demandes-travail",
                True,
                f"{demandes_count} demandes de travail"
            )
        else:
            await self.log_test_result(
                "DEMANDES TRAVAIL", 
                "Liste Demandes", 
                "GET /api/demandes-travail",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /demandes-travail/mes-demandes
        status, response = await self.make_request("GET", "demandes-travail/mes-demandes")
        if status == 200:
            mes_demandes_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "DEMANDES TRAVAIL", 
                "Mes Demandes", 
                "GET /api/demandes-travail/mes-demandes",
                True,
                f"{mes_demandes_count} mes demandes"
            )
        else:
            await self.log_test_result(
                "DEMANDES TRAVAIL", 
                "Mes Demandes", 
                "GET /api/demandes-travail/mes-demandes",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_salles_endpoints(self):
        """Test des endpoints salles"""
        print(f"\n🏠 === TEST SALLES ===")
        
        # Test GET /salles
        status, response = await self.make_request("GET", "salles")
        if status == 200:
            salles_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "SALLES", 
                "Liste Salles", 
                "GET /api/salles",
                True,
                f"{salles_count} salles trouvées"
            )
        else:
            await self.log_test_result(
                "SALLES", 
                "Liste Salles", 
                "GET /api/salles",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /configuration
        status, response = await self.make_request("GET", "configuration")
        if status == 200:
            max_medecins = response.get("max_medecins_par_jour") if isinstance(response, dict) else "N/A"
            await self.log_test_result(
                "SALLES", 
                "Configuration Cabinet", 
                "GET /api/configuration",
                True,
                f"Configuration récupérée - Max médecins: {max_medecins}"
            )
        else:
            await self.log_test_result(
                "SALLES", 
                "Configuration Cabinet", 
                "GET /api/configuration",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_messages_endpoints(self):
        """Test des endpoints messages"""
        print(f"\n💬 === TEST MESSAGES ===")
        
        # Test GET /messages
        status, response = await self.make_request("GET", "messages")
        if status == 200:
            messages_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "MESSAGES", 
                "Messages Généraux", 
                "GET /api/messages",
                True,
                f"{messages_count} messages trouvés"
            )
        else:
            await self.log_test_result(
                "MESSAGES", 
                "Messages Généraux", 
                "GET /api/messages",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /groupes
        status, response = await self.make_request("GET", "groupes")
        if status == 200:
            groupes_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "MESSAGES", 
                "Groupes Chat", 
                "GET /api/groupes",
                True,
                f"{groupes_count} groupes trouvés"
            )
        else:
            await self.log_test_result(
                "MESSAGES", 
                "Groupes Chat", 
                "GET /api/groupes",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_notifications_endpoints(self):
        """Test des endpoints notifications"""
        print(f"\n🔔 === TEST NOTIFICATIONS ===")
        
        # Test GET /notifications
        status, response = await self.make_request("GET", "notifications")
        if status == 200:
            notifications_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Mes Notifications", 
                "GET /api/notifications",
                True,
                f"{notifications_count} notifications"
            )
        else:
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Mes Notifications", 
                "GET /api/notifications",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /notifications/firebase-status
        status, response = await self.make_request("GET", "notifications/firebase-status")
        if status == 200:
            firebase_initialized = response.get("initialized", False) if isinstance(response, dict) else False
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Firebase Status", 
                "GET /api/notifications/firebase-status",
                True,
                f"Firebase initialisé: {'✓' if firebase_initialized else '✗'}"
            )
        else:
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Firebase Status", 
                "GET /api/notifications/firebase-status",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /notifications/scheduler-status
        status, response = await self.make_request("GET", "notifications/scheduler-status")
        if status == 200:
            scheduler_running = response.get("scheduler_running", False) if isinstance(response, dict) else False
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Scheduler Status", 
                "GET /api/notifications/scheduler-status",
                True,
                f"Scheduler actif: {'✓' if scheduler_running else '✗'}"
            )
        else:
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Scheduler Status", 
                "GET /api/notifications/scheduler-status",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /notifications/devices
        status, response = await self.make_request("GET", "notifications/devices")
        if status == 200:
            devices_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Mes Appareils", 
                "GET /api/notifications/devices",
                True,
                f"{devices_count} appareils enregistrés"
            )
        else:
            await self.log_test_result(
                "NOTIFICATIONS", 
                "Mes Appareils", 
                "GET /api/notifications/devices",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_stocks_endpoints(self):
        """Test des endpoints stocks"""
        print(f"\n📦 === TEST STOCKS ===")
        
        # Test GET /stocks/categories
        status, response = await self.make_request("GET", "stocks/categories")
        if status == 200:
            categories_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "STOCKS", 
                "Catégories Stock", 
                "GET /api/stocks/categories",
                True,
                f"{categories_count} catégories trouvées"
            )
        else:
            await self.log_test_result(
                "STOCKS", 
                "Catégories Stock", 
                "GET /api/stocks/categories",
                False,
                f"Status: {status}",
                response
            )
        
        # Test GET /stocks/articles
        status, response = await self.make_request("GET", "stocks/articles")
        if status == 200:
            articles_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "STOCKS", 
                "Articles Stock", 
                "GET /api/stocks/articles",
                True,
                f"{articles_count} articles trouvés"
            )
        else:
            await self.log_test_result(
                "STOCKS", 
                "Articles Stock", 
                "GET /api/stocks/articles",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_actualites_endpoints(self):
        """Test des endpoints actualités"""
        print(f"\n📰 === TEST ACTUALITÉS ===")
        
        # Test GET /actualites
        status, response = await self.make_request("GET", "actualites")
        if status == 200:
            actualites_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "ACTUALITÉS", 
                "Liste Actualités", 
                "GET /api/actualites",
                True,
                f"{actualites_count} actualités trouvées"
            )
        else:
            await self.log_test_result(
                "ACTUALITÉS", 
                "Liste Actualités", 
                "GET /api/actualites",
                False,
                f"Status: {status}",
                response
            )
    
    async def test_admin_endpoints(self):
        """Test des endpoints admin"""
        print(f"\n👨‍💼 === TEST ADMIN ===")
        
        # Test GET /inscriptions
        status, response = await self.make_request("GET", "inscriptions")
        if status == 200:
            inscriptions_count = len(response) if isinstance(response, list) else "N/A"
            await self.log_test_result(
                "ADMIN", 
                "Demandes Inscription", 
                "GET /api/inscriptions",
                True,
                f"{inscriptions_count} demandes d'inscription"
            )
        else:
            await self.log_test_result(
                "ADMIN", 
                "Demandes Inscription", 
                "GET /api/inscriptions",
                False,
                f"Status: {status}",
                response
            )
    
    async def run_all_tests(self):
        """Execute tous les tests dans l'ordre"""
        print("🚀 === DÉBUT DES TESTS COMPLETS ===")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Utilisateur: {USERNAME}")
        print("=" * 60)
        
        try:
            await self.setup()
            
            if not self.auth_token:
                print("❌ Impossible de continuer sans authentification")
                return
            
            # Tests dans l'ordre demandé par l'utilisateur
            await self.test_system_endpoints()
            await self.test_users_endpoints()
            await self.test_centres_endpoints()
            await self.test_planning_endpoints()
            await self.test_conges_endpoints()
            await self.test_demandes_travail_endpoints()
            await self.test_salles_endpoints()
            await self.test_messages_endpoints()
            await self.test_notifications_endpoints()
            await self.test_stocks_endpoints()
            await self.test_actualites_endpoints()
            await self.test_admin_endpoints()
            
        except Exception as e:
            print(f"❌ Erreur critique: {e}")
        finally:
            await self.cleanup()
        
        # Rapport final
        self.print_final_report()
    
    def print_final_report(self):
        """Affiche le rapport final des tests"""
        print("\n" + "=" * 60)
        print("📊 === RAPPORT FINAL ===")
        print(f"✅ Tests réussis: {self.results['passed_tests']}")
        print(f"❌ Tests échoués: {self.results['failed_tests']}")
        print(f"📊 Total: {self.results['total_tests']}")
        
        success_rate = (self.results['passed_tests'] / self.results['total_tests'] * 100) if self.results['total_tests'] > 0 else 0
        print(f"🎯 Taux de réussite: {success_rate:.1f}%")
        
        if self.results['failed_tests'] > 0:
            print(f"\n❌ === TESTS ÉCHOUÉS ({self.results['failed_tests']}) ===")
            for test in self.results['test_details']:
                if not test['success']:
                    print(f"❌ [{test['category']}] {test['test_name']} - {test['endpoint']}")
                    if test['details']:
                        print(f"    💡 {test['details']}")
        
        print("\n" + "=" * 60)

async def main():
    """Fonction principale"""
    tester = BackendTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())