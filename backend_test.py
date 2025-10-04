import requests
import sys
from datetime import datetime
import json

class MedicalStaffAPITester:
    def __init__(self, base_url="https://staffcare-mgmt.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test users provided
        self.test_users = {
            "directeur": {"email": "directeur@hopital.fr", "password": "directeur123"},
            "medecin": {"email": "medecin1@hopital.fr", "password": "medecin123"},
            "assistant": {"email": "assistant1@hopital.fr", "password": "assistant123"},
            "secretaire": {"email": "secretaire1@hopital.fr", "password": "secretaire123"}
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

    def test_protected_route_access(self):
        """Test access to protected routes with and without token"""
        print("\n📋 Testing Protected Route Access...")
        
        # Test without token (should fail)
        success, _ = self.run_test(
            "Access /users without token",
            "GET",
            "users",
            401
        )
        
        # Test with directeur token (should succeed)
        if 'directeur' in self.tokens:
            success, _ = self.run_test(
                "Access /users with directeur token",
                "GET",
                "users",
                200,
                token=self.tokens['directeur']
            )
        
        # Test with non-directeur token (should fail - 403)
        if 'medecin' in self.tokens:
            success, _ = self.run_test(
                "Access /users with medecin token (should fail)",
                "GET",
                "users",
                403,
                token=self.tokens['medecin']
            )

    def test_user_management(self):
        """Test user management endpoints"""
        print("\n👥 Testing User Management...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping user management tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        
        # Get all users (directeur only)
        success, users_data = self.run_test(
            "Get all users",
            "GET",
            "users",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(users_data)} users")
            for user in users_data:
                print(f"   - {user['prenom']} {user['nom']} ({user['role']})")
        
        # Get users by role
        for role in ["Médecin", "Assistant", "Secrétaire"]:
            success, role_users = self.run_test(
                f"Get users by role: {role}",
                "GET",
                f"users/by-role/{role}",
                200,
                token=directeur_token
            )
            if success:
                print(f"   Found {len(role_users)} {role}s")
        
        # Get current user info
        success, user_info = self.run_test(
            "Get current user info",
            "GET",
            "users/me",
            200,
            token=directeur_token
        )
        if success:
            print(f"   Current user: {user_info['prenom']} {user_info['nom']} ({user_info['role']})")

    def test_assignations(self):
        """Test assistant assignments"""
        print("\n🔗 Testing Assignations...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping assignation tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        
        # Get existing assignations
        success, assignations = self.run_test(
            "Get assignations",
            "GET",
            "assignations",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(assignations)} assignations")
            for assignation in assignations:
                if assignation.get('medecin') and assignation.get('assistant'):
                    print(f"   - Dr. {assignation['medecin']['prenom']} {assignation['medecin']['nom']} -> {assignation['assistant']['prenom']} {assignation['assistant']['nom']}")

    def test_leave_management(self):
        """Test comprehensive leave management system"""
        print("\n🏖️ Testing Leave Management...")
        
        created_requests = []
        
        # Test creating leave requests for different roles
        leave_types = ["CONGE_PAYE", "RTT", "MALADIE", "FORMATION"]
        
        for i, role in enumerate(['medecin', 'assistant', 'secretaire']):
            if role in self.tokens:
                from datetime import timedelta
                start_date = (datetime.now() + timedelta(days=7 + i*3)).strftime('%Y-%m-%d')
                end_date = (datetime.now() + timedelta(days=9 + i*3)).strftime('%Y-%m-%d')
                
                leave_data = {
                    "date_debut": start_date,
                    "date_fin": end_date,
                    "type_conge": leave_types[i % len(leave_types)],
                    "motif": f"Test leave request by {role}"
                }
                
                success, response = self.run_test(
                    f"Create leave request as {role}",
                    "POST",
                    "conges",
                    200,
                    data=leave_data,
                    token=self.tokens[role]
                )
                
                if success and 'id' in response:
                    created_requests.append({
                        'id': response['id'],
                        'role': role,
                        'type': leave_types[i % len(leave_types)]
                    })
                    print(f"   ✓ Created {leave_types[i % len(leave_types)]} request for {role}")
        
        # Test getting leave requests with different roles
        for role in ['directeur', 'medecin', 'assistant', 'secretaire']:
            if role in self.tokens:
                success, demandes = self.run_test(
                    f"Get leave requests as {role}",
                    "GET",
                    "conges",
                    200,
                    token=self.tokens[role]
                )
                if success:
                    print(f"   {role} can see {len(demandes)} leave requests")
                    
                    # Verify role-based access
                    if role == 'directeur':
                        print(f"   ✓ Director sees all requests from all users")
                    else:
                        # Check if user only sees their own requests
                        user_id = self.users[role]['id']
                        own_requests = [req for req in demandes if req.get('utilisateur_id') == user_id]
                        if len(own_requests) == len(demandes):
                            print(f"   ✓ {role} only sees their own requests")
                        else:
                            print(f"   ⚠️  {role} might be seeing other users' requests")
        
        # Test approval functionality (Director only)
        if 'directeur' in self.tokens and created_requests:
            print(f"\n   Testing approval functionality...")
            
            # Test approving a request
            if len(created_requests) > 0:
                request_id = created_requests[0]['id']
                approval_data = {
                    "approuve": True,
                    "commentaire": "Approved for testing purposes"
                }
                
                success, response = self.run_test(
                    "Approve leave request (Director)",
                    "PUT",
                    f"conges/{request_id}/approuver",
                    200,
                    data=approval_data,
                    token=self.tokens['directeur']
                )
                
                if success:
                    print(f"   ✓ Successfully approved leave request")
            
            # Test rejecting a request
            if len(created_requests) > 1:
                request_id = created_requests[1]['id']
                rejection_data = {
                    "approuve": False,
                    "commentaire": "Rejected for testing purposes"
                }
                
                success, response = self.run_test(
                    "Reject leave request (Director)",
                    "PUT",
                    f"conges/{request_id}/approuver",
                    200,
                    data=rejection_data,
                    token=self.tokens['directeur']
                )
                
                if success:
                    print(f"   ✓ Successfully rejected leave request")
        
        # Test unauthorized approval attempts
        if created_requests and len(created_requests) > 2:
            print(f"\n   Testing unauthorized approval attempts...")
            request_id = created_requests[2]['id']
            
            for role in ['medecin', 'assistant', 'secretaire']:
                if role in self.tokens:
                    approval_data = {
                        "approuve": True,
                        "commentaire": "Unauthorized approval attempt"
                    }
                    
                    success, response = self.run_test(
                        f"Unauthorized approval attempt ({role})",
                        "PUT",
                        f"conges/{request_id}/approuver",
                        403,  # Should be forbidden
                        data=approval_data,
                        token=self.tokens[role]
                    )
                    
                    if success:
                        print(f"   ✓ {role} correctly denied approval permissions")
        
        # Test invalid leave request creation
        if 'medecin' in self.tokens:
            invalid_data = {
                "date_debut": "invalid-date",
                "date_fin": "2024-12-31",
                "type_conge": "INVALID_TYPE",
                "motif": "Test invalid request"
            }
            
            success, response = self.run_test(
                "Create invalid leave request",
                "POST",
                "conges",
                422,  # Should return validation error
                data=invalid_data,
                token=self.tokens['medecin']
            )
        
        # Test approval of non-existent request
        if 'directeur' in self.tokens:
            success, response = self.run_test(
                "Approve non-existent request",
                "PUT",
                "conges/non-existent-id/approuver",
                404,
                data={"approuve": True, "commentaire": "Test"},
                token=self.tokens['directeur']
            )

    def test_room_reservations(self):
        """Test room reservation system"""
        print("\n🏥 Testing Room Reservations...")
        
        if 'medecin' in self.tokens:
            success, reservations = self.run_test(
                "Get room reservations",
                "GET",
                "salles/reservations",
                200,
                token=self.tokens['medecin']
            )
            if success:
                print(f"   Found {len(reservations)} room reservations")

    def test_general_notes(self):
        """Test general notes system"""
        print("\n📝 Testing General Notes...")
        
        if 'directeur' in self.tokens:
            success, notes = self.run_test(
                "Get general notes",
                "GET",
                "notes",
                200,
                token=self.tokens['directeur']
            )
            if success:
                print(f"   Found {len(notes)} general notes")

    def test_planning_system(self):
        """Test comprehensive planning system"""
        print("\n📅 Testing Planning System...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping planning tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        today = datetime.now().strftime('%Y-%m-%d')
        created_creneaux = []
        
        # Get users for planning
        success, users_data = self.run_test(
            "Get users for planning",
            "GET",
            "users",
            200,
            token=directeur_token
        )
        
        if not success or not users_data:
            print("❌ Cannot get users for planning tests")
            return
        
        # Find users by role
        medecins = [u for u in users_data if u['role'] == 'Médecin']
        assistants = [u for u in users_data if u['role'] == 'Assistant']
        secretaires = [u for u in users_data if u['role'] == 'Secrétaire']
        
        print(f"   Found {len(medecins)} médecins, {len(assistants)} assistants, {len(secretaires)} secrétaires")
        
        # Test creating planning slots
        if medecins:
            medecin = medecins[0]
            creneau_data = {
                "date": today,
                "creneau": "MATIN",
                "employe_id": medecin['id'],
                "salle_attribuee": "1",
                "salle_attente": "Attente 1",
                "notes": "Consultation générale"
            }
            
            success, response = self.run_test(
                "Create planning slot for médecin",
                "POST",
                "planning",
                200,
                data=creneau_data,
                token=directeur_token
            )
            
            if success and 'id' in response:
                created_creneaux.append(response['id'])
                print(f"   ✓ Created planning slot for Dr. {medecin['prenom']} {medecin['nom']}")
        
        # Test creating assistant slot with médecin assignment
        if assistants and medecins:
            assistant = assistants[0]
            medecin = medecins[0]
            creneau_data = {
                "date": today,
                "creneau": "MATIN",
                "employe_id": assistant['id'],
                "medecin_attribue_id": medecin['id'],
                "salle_attribuee": "A",
                "notes": "Assistance consultations"
            }
            
            success, response = self.run_test(
                "Create planning slot for assistant with médecin",
                "POST",
                "planning",
                200,
                data=creneau_data,
                token=directeur_token
            )
            
            if success and 'id' in response:
                created_creneaux.append(response['id'])
                print(f"   ✓ Created assistant slot with médecin assignment")
        
        # Test creating secrétaire slot with custom hours
        if secretaires:
            secretaire = secretaires[0]
            creneau_data = {
                "date": today,
                "creneau": "MATIN",
                "employe_id": secretaire['id'],
                "horaire_debut": "08:00",
                "horaire_fin": "12:00",
                "notes": "Accueil patients"
            }
            
            success, response = self.run_test(
                "Create planning slot for secrétaire with hours",
                "POST",
                "planning",
                200,
                data=creneau_data,
                token=directeur_token
            )
            
            if success and 'id' in response:
                created_creneaux.append(response['id'])
                print(f"   ✓ Created secrétaire slot with custom hours")
        
        # Test conflict detection - try to create duplicate slot
        if medecins:
            medecin = medecins[0]
            duplicate_data = {
                "date": today,
                "creneau": "MATIN",
                "employe_id": medecin['id'],
                "salle_attribuee": "2",
                "notes": "Should conflict"
            }
            
            success, response = self.run_test(
                "Test employee conflict detection",
                "POST",
                "planning",
                400,  # Should fail with conflict
                data=duplicate_data,
                token=directeur_token
            )
            
            if success:
                print(f"   ✓ Employee conflict correctly detected")
        
        # Test room conflict detection
        if len(medecins) > 1:
            medecin2 = medecins[1]
            room_conflict_data = {
                "date": today,
                "creneau": "MATIN",
                "employe_id": medecin2['id'],
                "salle_attribuee": "1",  # Same room as first médecin
                "notes": "Should conflict on room"
            }
            
            success, response = self.run_test(
                "Test room conflict detection",
                "POST",
                "planning",
                400,  # Should fail with room conflict
                data=room_conflict_data,
                token=directeur_token
            )
            
            if success:
                print(f"   ✓ Room conflict correctly detected")
        
        # Test getting planning by date
        success, planning_data = self.run_test(
            f"Get planning for {today}",
            "GET",
            f"planning/{today}",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(planning_data)} planning slots for today")
            for slot in planning_data:
                employe = slot.get('employe', {})
                print(f"   - {employe.get('prenom', '')} {employe.get('nom', '')} ({slot.get('creneau', '')}) - Salle: {slot.get('salle_attribuee', 'N/A')}")
        
        # Test unauthorized planning creation (non-directeur)
        if 'medecin' in self.tokens and medecins:
            unauthorized_data = {
                "date": today,
                "creneau": "APRES_MIDI",
                "employe_id": medecins[0]['id'],
                "salle_attribuee": "3"
            }
            
            success, response = self.run_test(
                "Unauthorized planning creation (médecin)",
                "POST",
                "planning",
                403,  # Should be forbidden
                data=unauthorized_data,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Non-directeur correctly denied planning creation")
        
        # Test deleting planning slots
        if created_creneaux:
            creneau_id = created_creneaux[0]
            success, response = self.run_test(
                "Delete planning slot",
                "DELETE",
                f"planning/{creneau_id}",
                200,
                token=directeur_token
            )
            
            if success:
                print(f"   ✓ Successfully deleted planning slot")
        
        return created_creneaux

    def test_chat_system(self):
        """Test comprehensive chat system"""
        print("\n💬 Testing Chat System...")
        
        sent_messages = []
        
        # Test sending general message
        if 'directeur' in self.tokens:
            general_message_data = {
                "contenu": "Message général de test du directeur",
                "type_message": "GENERAL"
            }
            
            success, response = self.run_test(
                "Send general message (directeur)",
                "POST",
                "messages",
                200,
                data=general_message_data,
                token=self.tokens['directeur']
            )
            
            if success and 'id' in response:
                sent_messages.append(response['id'])
                print(f"   ✓ General message sent successfully")
        
        # Test sending private message
        if 'medecin' in self.tokens and 'assistant' in self.tokens:
            medecin_id = self.users['medecin']['id']
            assistant_id = self.users['assistant']['id']
            
            private_message_data = {
                "contenu": "Message privé de test du médecin à l'assistant",
                "type_message": "PRIVE",
                "destinataire_id": assistant_id
            }
            
            success, response = self.run_test(
                "Send private message (médecin to assistant)",
                "POST",
                "messages",
                200,
                data=private_message_data,
                token=self.tokens['medecin']
            )
            
            if success and 'id' in response:
                sent_messages.append(response['id'])
                print(f"   ✓ Private message sent successfully")
        
        # Test getting general messages
        for role in ['directeur', 'medecin', 'assistant', 'secretaire']:
            if role in self.tokens:
                success, messages = self.run_test(
                    f"Get general messages ({role})",
                    "GET",
                    "messages",
                    200,
                    params={"type_message": "GENERAL", "limit": 50},
                    token=self.tokens[role]
                )
                
                if success:
                    print(f"   {role} can see {len(messages)} general messages")
        
        # Test getting private messages
        for role in ['medecin', 'assistant']:
            if role in self.tokens:
                success, messages = self.run_test(
                    f"Get private messages ({role})",
                    "GET",
                    "messages",
                    200,
                    params={"type_message": "PRIVE", "limit": 50},
                    token=self.tokens[role]
                )
                
                if success:
                    print(f"   {role} can see {len(messages)} private messages")
        
        # Test conversation between two users
        if 'medecin' in self.tokens and 'assistant' in self.tokens:
            assistant_id = self.users['assistant']['id']
            
            success, conversation = self.run_test(
                "Get conversation (médecin with assistant)",
                "GET",
                f"messages/conversation/{assistant_id}",
                200,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   Found {len(conversation)} messages in conversation")
        
        # Test sending message without content (should fail)
        if 'medecin' in self.tokens:
            invalid_message_data = {
                "contenu": "",
                "type_message": "GENERAL"
            }
            
            success, response = self.run_test(
                "Send empty message (should fail)",
                "POST",
                "messages",
                422,  # Should fail validation
                data=invalid_message_data,
                token=self.tokens['medecin']
            )
        
        return sent_messages

    def test_notification_system(self):
        """Test comprehensive notification system"""
        print("\n🔔 Testing Notification System...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping notification tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        today = datetime.now().strftime('%Y-%m-%d')
        
        # First, ensure we have some planning data for notifications
        planning_slots = self.test_planning_system()
        
        # Test generating notifications (Director only)
        success, response = self.run_test(
            f"Generate daily notifications for {today}",
            "POST",
            f"notifications/generate/{today}",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Notifications generated successfully")
            if 'message' in response:
                print(f"   {response['message']}")
        
        # Test getting all notifications for date (Director)
        success, all_notifications = self.run_test(
            f"Get all notifications for {today} (Director)",
            "GET",
            f"notifications/{today}",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Director can see {len(all_notifications)} notifications for {today}")
            for notif in all_notifications:
                employe = notif.get('employe', {})
                print(f"   - Notification for {employe.get('prenom', '')} {employe.get('nom', '')}")
        
        # Test getting personal notification for today
        for role in ['medecin', 'assistant', 'secretaire']:
            if role in self.tokens:
                success, my_notification = self.run_test(
                    f"Get personal notification for today ({role})",
                    "GET",
                    "notifications/me/today",
                    200,
                    token=self.tokens[role]
                )
                
                if success and my_notification:
                    print(f"   ✓ {role} has personal notification for today")
                    # Print first few lines of notification content
                    content_lines = my_notification.get('contenu', '').split('\n')
                    if content_lines:
                        print(f"   Content preview: {content_lines[0]}")
                elif success:
                    print(f"   {role} has no notification for today")
        
        # Test unauthorized notification generation
        if 'medecin' in self.tokens:
            success, response = self.run_test(
                "Unauthorized notification generation (médecin)",
                "POST",
                f"notifications/generate/{today}",
                403,  # Should be forbidden
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Non-directeur correctly denied notification generation")
        
        # Test getting notifications for non-existent date
        future_date = "2025-12-31"
        success, empty_notifications = self.run_test(
            f"Get notifications for future date {future_date}",
            "GET",
            f"notifications/{future_date}",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(empty_notifications)} notifications for future date (expected: 0)")

    def test_salles_management(self):
        """Test comprehensive room/salle management system - NEW FEATURE"""
        print("\n🏢 Testing Salles Management (NEW FEATURE)...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping salles tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        created_salles = []
        
        # Test getting existing salles
        success, existing_salles = self.run_test(
            "Get existing salles",
            "GET",
            "salles",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(existing_salles)} existing salles")
            for salle in existing_salles:
                print(f"   - {salle['nom']} ({salle['type_salle']}) at ({salle['position_x']}, {salle['position_y']})")
        
        # Test cabinet initialization if no salles exist
        if not existing_salles or len(existing_salles) == 0:
            success, response = self.run_test(
                "Initialize cabinet with default salles",
                "POST",
                "cabinet/initialiser",
                200,
                token=directeur_token
            )
            
            if success:
                print(f"   ✓ Cabinet initialized successfully")
                if 'salles_creees' in response:
                    print(f"   Created {response['salles_creees']} salles")
                
                # Get salles again after initialization
                success, initialized_salles = self.run_test(
                    "Get salles after initialization",
                    "GET",
                    "salles",
                    200,
                    token=directeur_token
                )
                
                if success:
                    print(f"   Now have {len(initialized_salles)} salles after initialization")
                    existing_salles = initialized_salles
        
        # Test creating a new salle
        new_salle_data = {
            "nom": "Test Salle",
            "type_salle": "MEDECIN",
            "position_x": 7,
            "position_y": 7,
            "couleur": "#FF5733"
        }
        
        success, response = self.run_test(
            "Create new salle",
            "POST",
            "salles",
            200,
            data=new_salle_data,
            token=directeur_token
        )
        
        if success and 'id' in response:
            created_salles.append(response['id'])
            print(f"   ✓ Created new salle: {response['nom']}")
        
        # Test creating duplicate salle (should fail)
        success, response = self.run_test(
            "Create duplicate salle (should fail)",
            "POST",
            "salles",
            400,
            data=new_salle_data,
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Duplicate salle creation correctly rejected")
        
        # Test updating a salle
        if created_salles:
            salle_id = created_salles[0]
            update_data = {
                "nom": "Updated Test Salle",
                "couleur": "#33FF57",
                "position_x": 8,
                "position_y": 8
            }
            
            success, response = self.run_test(
                "Update salle",
                "PUT",
                f"salles/{salle_id}",
                200,
                data=update_data,
                token=directeur_token
            )
            
            if success:
                print(f"   ✓ Salle updated successfully: {response['nom']}")
        
        # Test unauthorized salle creation (non-directeur)
        if 'medecin' in self.tokens:
            unauthorized_data = {
                "nom": "Unauthorized Salle",
                "type_salle": "MEDECIN",
                "position_x": 9,
                "position_y": 9
            }
            
            success, response = self.run_test(
                "Unauthorized salle creation (médecin)",
                "POST",
                "salles",
                403,
                data=unauthorized_data,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Non-directeur correctly denied salle creation")
        
        # Test deleting a salle
        if created_salles:
            salle_id = created_salles[0]
            success, response = self.run_test(
                "Delete salle (soft delete)",
                "DELETE",
                f"salles/{salle_id}",
                200,
                token=directeur_token
            )
            
            if success:
                print(f"   ✓ Salle deleted successfully")
        
        return existing_salles

    def test_configuration_management(self):
        """Test cabinet configuration management - NEW FEATURE"""
        print("\n⚙️ Testing Configuration Management (NEW FEATURE)...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping configuration tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        
        # Test getting current configuration
        success, config = self.run_test(
            "Get current configuration",
            "GET",
            "configuration",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Current configuration:")
            print(f"   - Max médecins/jour: {config.get('max_medecins_par_jour', 'N/A')}")
            print(f"   - Max assistants/jour: {config.get('max_assistants_par_jour', 'N/A')}")
            print(f"   - Horaires matin: {config.get('heures_ouverture_matin_debut', 'N/A')}-{config.get('heures_ouverture_matin_fin', 'N/A')}")
            print(f"   - Horaires après-midi: {config.get('heures_ouverture_apres_midi_debut', 'N/A')}-{config.get('heures_ouverture_apres_midi_fin', 'N/A')}")
        
        # Test updating configuration
        update_config_data = {
            "max_medecins_par_jour": 8,
            "max_assistants_par_jour": 4,
            "heures_ouverture_matin_debut": "07:30",
            "heures_ouverture_matin_fin": "12:30",
            "heures_ouverture_apres_midi_debut": "13:30",
            "heures_ouverture_apres_midi_fin": "18:30"
        }
        
        success, response = self.run_test(
            "Update configuration",
            "PUT",
            "configuration",
            200,
            data=update_config_data,
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Configuration updated successfully")
            print(f"   - New max médecins/jour: {response.get('max_medecins_par_jour', 'N/A')}")
        
        # Test unauthorized configuration access
        if 'medecin' in self.tokens:
            success, response = self.run_test(
                "Unauthorized configuration update (médecin)",
                "PUT",
                "configuration",
                403,
                data={"max_medecins_par_jour": 10},
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Non-directeur correctly denied configuration update")
        
        # Test configuration access by non-directeur (should be allowed for reading)
        if 'medecin' in self.tokens:
            success, response = self.run_test(
                "Configuration read access (médecin)",
                "GET",
                "configuration",
                200,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Non-directeur can read configuration")
        
        return config

    def test_semaines_types(self):
        """Test week templates system - NEW FEATURE"""
        print("\n📅 Testing Semaines Types (NEW FEATURE)...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping semaines types tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        
        # Test getting existing semaines types
        success, existing_semaines = self.run_test(
            "Get existing semaines types",
            "GET",
            "semaines-types",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   Found {len(existing_semaines)} existing semaines types")
            for semaine in existing_semaines:
                print(f"   - {semaine['nom']}: {semaine.get('description', 'No description')}")
        
        # Test initialization if no semaines exist
        if not existing_semaines or len(existing_semaines) == 0:
            success, response = self.run_test(
                "Initialize default semaines types",
                "POST",
                "semaines-types/init",
                200,
                token=directeur_token
            )
            
            if success:
                print(f"   ✓ Semaines types initialized successfully")
                if 'message' in response:
                    print(f"   {response['message']}")
                
                # Get semaines again after initialization
                success, initialized_semaines = self.run_test(
                    "Get semaines after initialization",
                    "GET",
                    "semaines-types",
                    200,
                    token=directeur_token
                )
                
                if success:
                    print(f"   Now have {len(initialized_semaines)} semaines types")
                    existing_semaines = initialized_semaines
        
        # Test creating custom semaine type
        custom_semaine_data = {
            "nom": "Test Semaine Personnalisée",
            "description": "Semaine de test pour les API",
            "lundi": "MATIN",
            "mardi": "APRES_MIDI", 
            "mercredi": "JOURNEE_COMPLETE",
            "jeudi": "REPOS",
            "vendredi": "MATIN",
            "samedi": "REPOS",
            "dimanche": "REPOS"
        }
        
        success, response = self.run_test(
            "Create custom semaine type",
            "POST",
            "semaines-types",
            200,
            data=custom_semaine_data,
            token=directeur_token
        )
        
        if success and 'id' in response:
            print(f"   ✓ Custom semaine type created: {response['nom']}")
        
        # Test unauthorized access
        if 'medecin' in self.tokens:
            success, response = self.run_test(
                "Unauthorized semaine type creation (médecin)",
                "POST",
                "semaines-types",
                403,
                data=custom_semaine_data,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Non-directeur correctly denied semaine type creation")
        
        # Test reading access for non-directeur
        if 'medecin' in self.tokens:
            success, response = self.run_test(
                "Read semaines types (médecin)",
                "GET",
                "semaines-types",
                200,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Médecin can read semaines types")
        
        return existing_semaines

    def test_groupes_chat(self):
        """Test chat groups system - NEW FEATURE"""
        print("\n👥 Testing Groupes Chat (NEW FEATURE)...")
        
        created_groups = []
        
        # Test creating chat group as directeur
        if 'directeur' in self.tokens and 'medecin' in self.tokens and 'assistant' in self.tokens:
            medecin_id = self.users['medecin']['id']
            assistant_id = self.users['assistant']['id']
            
            group_data = {
                "nom": "Équipe Consultation",
                "description": "Groupe pour coordination des consultations",
                "membres": [medecin_id, assistant_id]
            }
            
            success, response = self.run_test(
                "Create chat group (directeur)",
                "POST",
                "groupes-chat",
                200,
                data=group_data,
                token=self.tokens['directeur']
            )
            
            if success and 'id' in response:
                created_groups.append(response['id'])
                print(f"   ✓ Chat group created: {response['nom']}")
                print(f"   Members: {len(response.get('membres', []))} users")
        
        # Test getting user's groups
        for role in ['directeur', 'medecin', 'assistant']:
            if role in self.tokens:
                success, groups = self.run_test(
                    f"Get chat groups ({role})",
                    "GET",
                    "groupes-chat",
                    200,
                    token=self.tokens[role]
                )
                
                if success:
                    print(f"   {role} is member of {len(groups)} groups")
                    for group in groups:
                        membres_details = group.get('membres_details', [])
                        print(f"   - {group['nom']}: {len(membres_details)} members")
        
        # Test sending group message
        if created_groups and 'medecin' in self.tokens:
            group_id = created_groups[0]
            group_message_data = {
                "contenu": "Message de test dans le groupe",
                "type_message": "GROUPE",
                "groupe_id": group_id
            }
            
            success, response = self.run_test(
                "Send group message (médecin)",
                "POST",
                "messages",
                200,
                data=group_message_data,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Group message sent successfully")
        
        # Test getting group messages
        if created_groups and 'assistant' in self.tokens:
            group_id = created_groups[0]
            success, messages = self.run_test(
                "Get group messages (assistant)",
                "GET",
                "messages",
                200,
                params={"type_message": "GROUPE", "groupe_id": group_id, "limit": 50},
                token=self.tokens['assistant']
            )
            
            if success:
                print(f"   Assistant can see {len(messages)} group messages")
        
        # Test unauthorized group message (non-member)
        if created_groups and 'secretaire' in self.tokens:
            group_id = created_groups[0]
            unauthorized_message = {
                "contenu": "Message non autorisé",
                "type_message": "GROUPE",
                "groupe_id": group_id
            }
            
            success, response = self.run_test(
                "Unauthorized group message (secrétaire)",
                "POST",
                "messages",
                403,
                data=unauthorized_message,
                token=self.tokens['secretaire']
            )
            
            if success:
                print(f"   ✓ Non-member correctly denied group message")
        
        return created_groups

    def test_demandes_travail(self):
        """Test work day requests system - NEW FEATURE"""
        print("\n📋 Testing Demandes de Travail (NEW FEATURE)...")
        
        created_demandes = []
        today = datetime.now()
        
        # First test semaines types (needed for week template requests)
        semaines_types = self.test_semaines_types()
        
        # Test creating work requests as médecin
        if 'medecin' in self.tokens:
            from datetime import timedelta
            
            # Create request for tomorrow morning
            tomorrow = (today + timedelta(days=1)).strftime('%Y-%m-%d')
            demande_data = {
                "date_demandee": tomorrow,
                "creneau": "MATIN",
                "motif": "Consultation spécialisée"
            }
            
            success, response = self.run_test(
                "Create work request - morning (médecin)",
                "POST",
                "demandes-travail",
                200,
                data=demande_data,
                token=self.tokens['medecin']
            )
            
            if success and isinstance(response, list) and len(response) > 0:
                created_demandes.append(response[0]['id'])
                print(f"   ✓ Morning work request created")
            
            # Test creating week template request
            if semaines_types and len(semaines_types) > 0:
                next_monday = today + timedelta(days=(7 - today.weekday()))
                next_monday_str = next_monday.strftime('%Y-%m-%d')
                
                week_template_data = {
                    "semaine_type_id": semaines_types[0]['id'],
                    "date_debut_semaine": next_monday_str
                }
                
                success, response = self.run_test(
                    "Create week template request (médecin)",
                    "POST",
                    "demandes-travail",
                    200,
                    data=week_template_data,
                    token=self.tokens['medecin']
                )
                
                if success and isinstance(response, list):
                    print(f"   ✓ Week template request created {len(response)} demandes")
                    for demande in response:
                        created_demandes.append(demande['id'])
            
            # Create request for day after tomorrow - full day
            day_after = (today + timedelta(days=2)).strftime('%Y-%m-%d')
            demande_data_full = {
                "date_demandee": day_after,
                "creneau": "JOURNEE_COMPLETE",
                "motif": "Journée complète de consultations"
            }
            
            success, response = self.run_test(
                "Create work request - full day (médecin)",
                "POST",
                "demandes-travail",
                200,
                data=demande_data_full,
                token=self.tokens['medecin']
            )
            
            if success and isinstance(response, list) and len(response) > 0:
                created_demandes.append(response[0]['id'])
                print(f"   ✓ Full day work request created")
        
        # Test creating duplicate request (should fail)
        if 'medecin' in self.tokens:
            duplicate_data = {
                "date_demandee": tomorrow,
                "creneau": "MATIN",
                "motif": "Duplicate request"
            }
            
            success, response = self.run_test(
                "Create duplicate work request (should fail)",
                "POST",
                "demandes-travail",
                400,
                data=duplicate_data,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Duplicate request correctly rejected")
        
        # Test unauthorized request creation (assistant)
        if 'assistant' in self.tokens:
            unauthorized_data = {
                "date_demandee": tomorrow,
                "creneau": "APRES_MIDI",
                "motif": "Unauthorized request"
            }
            
            success, response = self.run_test(
                "Unauthorized work request (assistant)",
                "POST",
                "demandes-travail",
                403,
                data=unauthorized_data,
                token=self.tokens['assistant']
            )
            
            if success:
                print(f"   ✓ Assistant correctly denied work request creation")
        
        # Test getting work requests as médecin (own requests only)
        if 'medecin' in self.tokens:
            success, demandes = self.run_test(
                "Get work requests (médecin)",
                "GET",
                "demandes-travail",
                200,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   Médecin can see {len(demandes)} work requests")
                for demande in demandes:
                    medecin = demande.get('medecin', {})
                    print(f"   - {demande['date_demandee']} {demande['creneau']} ({demande['statut']}) - Dr. {medecin.get('prenom', '')} {medecin.get('nom', '')}")
        
        # Test getting work requests as directeur (all requests)
        if 'directeur' in self.tokens:
            success, all_demandes = self.run_test(
                "Get all work requests (directeur)",
                "GET",
                "demandes-travail",
                200,
                token=self.tokens['directeur']
            )
            
            if success:
                print(f"   Directeur can see {len(all_demandes)} work requests from all médecins")
        
        # Test approval functionality (directeur only)
        if 'directeur' in self.tokens and created_demandes:
            # Approve first request
            if len(created_demandes) > 0:
                demande_id = created_demandes[0]
                approval_data = {
                    "approuve": True,
                    "commentaire": "Approuvé pour test"
                }
                
                success, response = self.run_test(
                    "Approve work request (directeur)",
                    "PUT",
                    f"demandes-travail/{demande_id}/approuver",
                    200,
                    data=approval_data,
                    token=self.tokens['directeur']
                )
                
                if success:
                    print(f"   ✓ Work request approved successfully")
            
            # Reject second request
            if len(created_demandes) > 1:
                demande_id = created_demandes[1]
                rejection_data = {
                    "approuve": False,
                    "commentaire": "Rejeté pour test - cabinet complet"
                }
                
                success, response = self.run_test(
                    "Reject work request (directeur)",
                    "PUT",
                    f"demandes-travail/{demande_id}/approuver",
                    200,
                    data=rejection_data,
                    token=self.tokens['directeur']
                )
                
                if success:
                    print(f"   ✓ Work request rejected successfully")
        
        # Test unauthorized approval (médecin)
        if 'medecin' in self.tokens and created_demandes:
            demande_id = created_demandes[0]
            unauthorized_approval = {
                "approuve": True,
                "commentaire": "Unauthorized approval"
            }
            
            success, response = self.run_test(
                "Unauthorized approval (médecin)",
                "PUT",
                f"demandes-travail/{demande_id}/approuver",
                403,
                data=unauthorized_approval,
                token=self.tokens['medecin']
            )
            
            if success:
                print(f"   ✓ Non-directeur correctly denied approval permissions")
        
        return created_demandes

    def test_planning_semaine(self):
        """Test weekly planning view - NEW FEATURE"""
        print("\n📅 Testing Planning Semaine (NEW FEATURE)...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping weekly planning tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        today = datetime.now()
        
        # Calculate Monday of current week
        from datetime import timedelta
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)
        monday_str = monday.strftime('%Y-%m-%d')
        
        # Test getting weekly planning
        success, planning_semaine = self.run_test(
            f"Get weekly planning starting {monday_str}",
            "GET",
            f"planning/semaine/{monday_str}",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Weekly planning retrieved successfully")
            dates = planning_semaine.get('dates', [])
            planning_data = planning_semaine.get('planning', {})
            
            print(f"   Week covers {len(dates)} days: {dates[0]} to {dates[-1]}")
            
            total_slots = 0
            for date in dates:
                day_planning = planning_data.get(date, {})
                matin_slots = len(day_planning.get('MATIN', []))
                apres_midi_slots = len(day_planning.get('APRES_MIDI', []))
                total_slots += matin_slots + apres_midi_slots
                
                if matin_slots > 0 or apres_midi_slots > 0:
                    print(f"   - {date}: {matin_slots} matin, {apres_midi_slots} après-midi")
            
            print(f"   Total planning slots for the week: {total_slots}")
        
        # Test with different week (next week)
        next_monday = monday + timedelta(days=7)
        next_monday_str = next_monday.strftime('%Y-%m-%d')
        
        success, next_week_planning = self.run_test(
            f"Get next week planning starting {next_monday_str}",
            "GET",
            f"planning/semaine/{next_monday_str}",
            200,
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Next week planning retrieved successfully")
            next_dates = next_week_planning.get('dates', [])
            print(f"   Next week covers: {next_dates[0]} to {next_dates[-1]}")
        
        # Test unauthorized access
        if 'assistant' in self.tokens:
            success, response = self.run_test(
                "Weekly planning access (assistant)",
                "GET",
                f"planning/semaine/{monday_str}",
                200,  # Should be allowed for viewing
                token=self.tokens['assistant']
            )
            
            if success:
                print(f"   ✓ Assistant can view weekly planning")
        
        return planning_semaine

    def test_plan_cabinet(self):
        """Test cabinet visual plan - NEW FEATURE"""
        print("\n🏗️ Testing Plan Cabinet (NEW FEATURE)...")
        
        if 'directeur' not in self.tokens:
            print("❌ Skipping cabinet plan tests - no directeur token")
            return
        
        directeur_token = self.tokens['directeur']
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Test getting cabinet plan for morning
        success, plan_matin = self.run_test(
            f"Get cabinet plan for {today} morning",
            "GET",
            f"cabinet/plan/{today}",
            200,
            params={"creneau": "MATIN"},
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Cabinet plan retrieved for morning")
            salles = plan_matin.get('salles', [])
            print(f"   Found {len(salles)} salles in cabinet plan")
            
            occupied_count = 0
            for salle in salles:
                if salle.get('occupation'):
                    occupied_count += 1
                    occupation = salle['occupation']
                    employe = occupation.get('employe', {})
                    print(f"   - {salle['nom']} ({salle['type_salle']}) occupied by {employe.get('prenom', '')} {employe.get('nom', '')}")
            
            print(f"   {occupied_count}/{len(salles)} salles occupied in the morning")
        
        # Test getting cabinet plan for afternoon
        success, plan_apres_midi = self.run_test(
            f"Get cabinet plan for {today} afternoon",
            "GET",
            f"cabinet/plan/{today}",
            200,
            params={"creneau": "APRES_MIDI"},
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Cabinet plan retrieved for afternoon")
            salles_pm = plan_apres_midi.get('salles', [])
            
            occupied_count_pm = 0
            for salle in salles_pm:
                if salle.get('occupation'):
                    occupied_count_pm += 1
            
            print(f"   {occupied_count_pm}/{len(salles_pm)} salles occupied in the afternoon")
        
        # Test with future date (should show empty plan)
        from datetime import timedelta
        future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        
        success, future_plan = self.run_test(
            f"Get cabinet plan for future date {future_date}",
            "GET",
            f"cabinet/plan/{future_date}",
            200,
            params={"creneau": "MATIN"},
            token=directeur_token
        )
        
        if success:
            print(f"   ✓ Future cabinet plan retrieved (should be empty)")
            future_salles = future_plan.get('salles', [])
            future_occupied = sum(1 for s in future_salles if s.get('occupation'))
            print(f"   {future_occupied}/{len(future_salles)} salles occupied in future (expected: 0)")
        
        # Test unauthorized access
        if 'assistant' in self.tokens:
            success, response = self.run_test(
                "Cabinet plan access (assistant)",
                "GET",
                f"cabinet/plan/{today}",
                200,  # Should be allowed for viewing
                params={"creneau": "MATIN"},
                token=self.tokens['assistant']
            )
            
            if success:
                print(f"   ✓ Assistant can view cabinet plan")
        
        return plan_matin

    def run_delete_test(self, name, endpoint, expected_status, token=None):
        """Helper method for DELETE requests"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            response = requests.delete(url, headers=headers)
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

def main():
    print("🏥 Testing Medical Staff Management API - COMPREHENSIVE NEW FEATURES TEST")
    print("=" * 70)
    
    tester = MedicalStaffAPITester()
    
    # Test authentication for all roles
    print("\n🔐 Testing Authentication...")
    login_success = True
    for role, credentials in tester.test_users.items():
        if not tester.test_login(role, credentials['email'], credentials['password']):
            print(f"❌ Login failed for {role}")
            login_success = False
    
    if not login_success:
        print("\n❌ Authentication tests failed. Cannot proceed with other tests.")
        return 1
    
    print(f"\n✅ Successfully authenticated all roles!")
    
    # Test protected routes and role-based access
    tester.test_protected_route_access()
    
    # Test user management
    tester.test_user_management()
    
    # Test assignations
    tester.test_assignations()
    
    # Test leave management
    tester.test_leave_management()
    
    # Test room reservations
    tester.test_room_reservations()
    
    # Test general notes
    tester.test_general_notes()
    
    # ===== NEW ADVANCED FEATURES TESTING =====
    print("\n" + "="*50)
    print("🚀 TESTING NEW ADVANCED FEATURES")
    print("="*50)
    
    # Test NEW FEATURE: Salles Management
    tester.test_salles_management()
    
    # Test NEW FEATURE: Configuration Management
    tester.test_configuration_management()
    
    # Test NEW FEATURE: Semaines Types (Week Templates)
    tester.test_semaines_types()
    
    # Test NEW FEATURE: Groupes Chat (Chat Groups)
    tester.test_groupes_chat()
    
    # Test NEW FEATURE: Demandes de Travail (with week templates)
    tester.test_demandes_travail()
    
    # Test NEW FEATURE: Planning Semaine
    tester.test_planning_semaine()
    
    # Test NEW FEATURE: Plan Cabinet
    tester.test_plan_cabinet()
    
    # Test existing planning system (enhanced)
    tester.test_planning_system()
    
    # Test chat system
    tester.test_chat_system()
    
    # Test notification system
    tester.test_notification_system()
    
    # Print final results
    print(f"\n" + "="*50)
    print(f"📊 COMPREHENSIVE TEST RESULTS")
    print(f"="*50)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED! New features are working perfectly!")
        return 0
    else:
        failed_tests = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed_tests} tests failed")
        print(f"💡 Check the failed tests above for issues that need to be addressed")
        return 1

if __name__ == "__main__":
    sys.exit(main())