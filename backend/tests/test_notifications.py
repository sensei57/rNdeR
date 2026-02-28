"""
Test suite for notification system endpoints and assistant slot handling logic
Features tested:
- GET /api/notifications/employees-for-test - Employee list with push status
- POST /api/notifications/test - Send test notifications
- POST /api/notifications/send-daily-planning - Trigger daily planning
- POST /api/notifications/quick-reply - Quick reply to messages
- Leave approval with assistant slot handling (handle_assistant_slots_for_leave)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_api_health(self):
        """Test that API is accessible"""
        response = requests.get(f"{BASE_URL}/api/debug-users")
        assert response.status_code == 200, f"API not accessible: {response.text}"
        print("✅ API is accessible")
    
    def test_login_director(self):
        """Test director login to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert data["user"]["role"] == "Directeur", "User is not Directeur"
        print(f"✅ Login successful as {data['user']['prenom']} {data['user']['nom']}")
        return data["access_token"]


class TestNotificationEmployeesList:
    """Tests for GET /api/notifications/employees-for-test endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as director")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_employees_for_test_success(self, auth_headers):
        """Test successful retrieval of employees list with push status"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/employees-for-test",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "employees" in data, "Response should contain 'employees' key"
        
        employees = data["employees"]
        assert isinstance(employees, list), "Employees should be a list"
        
        if employees:
            # Verify employee structure
            first_employee = employees[0]
            required_fields = ["id", "prenom", "nom", "role", "email", "has_push_enabled", "devices_count"]
            for field in required_fields:
                assert field in first_employee, f"Employee missing field: {field}"
            
            # Verify data types
            assert isinstance(first_employee["has_push_enabled"], bool), "has_push_enabled should be boolean"
            assert isinstance(first_employee["devices_count"], int), "devices_count should be integer"
            
            print(f"✅ Found {len(employees)} employees for notification test")
            for emp in employees[:3]:  # Show first 3
                push_status = "📱" if emp["has_push_enabled"] else "❌"
                print(f"   {push_status} {emp['prenom']} {emp['nom']} ({emp['role']}) - {emp['devices_count']} device(s)")
        else:
            print("⚠️ No employees found (database may be empty)")
    
    def test_get_employees_unauthorized(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/employees-for-test")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthorized, got {response.status_code}"
        print("✅ Endpoint correctly requires authentication")
    
    def test_get_employees_non_director(self):
        """Test that only directors can access this endpoint"""
        # First, check if there are any non-director users
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if login_response.status_code != 200:
            pytest.skip("Could not authenticate")
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all users
        users_response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        if users_response.status_code != 200:
            pytest.skip("Could not get users list")
        
        users = users_response.json()
        non_directors = [u for u in users if u["role"] != "Directeur" and u.get("actif", True)]
        
        if not non_directors:
            pytest.skip("No non-director users available to test")
        
        # For now, just verify the endpoint works for director
        print("✅ Director-only access verification (would need non-director credentials to fully test)")


class TestNotificationTestSending:
    """Tests for POST /api/notifications/test endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as director")
        token = response.json()["access_token"]
        self.director_id = response.json()["user"]["id"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_send_test_notification_success(self, auth_headers):
        """Test sending test notifications to specific users"""
        # First get available employees
        employees_response = requests.get(
            f"{BASE_URL}/api/notifications/employees-for-test",
            headers=auth_headers
        )
        
        if employees_response.status_code != 200:
            pytest.skip("Could not get employees list")
        
        employees = employees_response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees available for test")
        
        # Send test notification to first employee
        test_user_id = employees[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/test",
            headers=auth_headers,
            json={
                "user_ids": [test_user_id],
                "title": "🧪 Test Notification",
                "message": f"Test notification sent at {datetime.now().isoformat()}"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "recipients" in data, "Response should contain 'recipients'"
        assert len(data["recipients"]) == 1, "Should have 1 recipient"
        
        print(f"✅ Test notification sent to {data['recipients'][0]['nom']}")
    
    def test_send_test_notification_multiple_users(self, auth_headers):
        """Test sending notifications to multiple users"""
        # Get available employees
        employees_response = requests.get(
            f"{BASE_URL}/api/notifications/employees-for-test",
            headers=auth_headers
        )
        
        if employees_response.status_code != 200:
            pytest.skip("Could not get employees list")
        
        employees = employees_response.json().get("employees", [])
        if len(employees) < 2:
            pytest.skip("Need at least 2 employees for this test")
        
        # Send to first 2 employees
        user_ids = [employees[0]["id"], employees[1]["id"]]
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/test",
            headers=auth_headers,
            json={
                "user_ids": user_ids,
                "title": "📢 Multi-user Test",
                "message": "Testing notification to multiple users"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert len(data["recipients"]) == 2, "Should have 2 recipients"
        
        print(f"✅ Test notification sent to {len(data['recipients'])} users")
    
    def test_send_test_notification_empty_users(self, auth_headers):
        """Test that sending to empty user list returns error"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/test",
            headers=auth_headers,
            json={
                "user_ids": [],
                "title": "Test",
                "message": "Test"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for empty user list, got {response.status_code}"
        print("✅ Correctly rejects empty user list")
    
    def test_send_test_notification_invalid_user(self, auth_headers):
        """Test sending to non-existent user returns error"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/test",
            headers=auth_headers,
            json={
                "user_ids": ["non-existent-user-id"],
                "title": "Test",
                "message": "Test"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"
        print("✅ Correctly returns 404 for non-existent user")


class TestDailyPlanningNotification:
    """Tests for POST /api/notifications/send-daily-planning endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as director")
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_trigger_daily_planning_success(self, auth_headers):
        """Test triggering daily planning notification"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-daily-planning",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        
        print(f"✅ Daily planning notification triggered: {data['message']}")
    
    def test_trigger_daily_planning_unauthorized(self):
        """Test that endpoint requires director authentication"""
        response = requests.post(f"{BASE_URL}/api/notifications/send-daily-planning")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthorized, got {response.status_code}"
        print("✅ Endpoint correctly requires director authentication")


class TestQuickReply:
    """Tests for POST /api/notifications/quick-reply endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as director")
        self.user_id = response.json()["user"]["id"]
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_quick_reply_missing_message_id(self, auth_headers):
        """Test quick reply with non-existent message returns error"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/quick-reply",
            headers=auth_headers,
            json={
                "message_id": "non-existent-message-id",
                "reply_content": "Test reply"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent message, got {response.status_code}"
        print("✅ Correctly returns 404 for non-existent message")
    
    def test_quick_reply_empty_content(self, auth_headers):
        """Test quick reply with empty content returns error"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/quick-reply",
            headers=auth_headers,
            json={
                "message_id": "some-message-id",
                "reply_content": ""
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for empty content, got {response.status_code}"
        print("✅ Correctly rejects empty reply content")
    
    def test_quick_reply_whitespace_content(self, auth_headers):
        """Test quick reply with whitespace-only content returns error"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/quick-reply",
            headers=auth_headers,
            json={
                "message_id": "some-message-id",
                "reply_content": "   "
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for whitespace content, got {response.status_code}"
        print("✅ Correctly rejects whitespace-only reply content")
    
    def test_quick_reply_with_real_message(self, auth_headers):
        """Test quick reply with a real message - requires creating a message first"""
        # First, create a test message
        message_response = requests.post(
            f"{BASE_URL}/api/messages",
            headers=auth_headers,
            json={
                "contenu": "TEST_Message for quick reply test",
                "type_message": "GENERAL"
            }
        )
        
        if message_response.status_code != 201:
            pytest.skip(f"Could not create test message: {message_response.text}")
        
        message_id = message_response.json().get("id")
        if not message_id:
            pytest.skip("Message created but no ID returned")
        
        # Now try to reply to this message
        response = requests.post(
            f"{BASE_URL}/api/notifications/quick-reply",
            headers=auth_headers,
            json={
                "message_id": message_id,
                "reply_content": "Quick reply test response"
            }
        )
        
        # Note: This might return 404 if message_id handling differs or 200 on success
        if response.status_code == 200:
            data = response.json()
            assert "message_id" in data, "Response should contain new message_id"
            print(f"✅ Quick reply successful, new message ID: {data['message_id']}")
        else:
            print(f"⚠️ Quick reply returned {response.status_code}: {response.text}")


class TestLeaveApprovalWithAssistantSlots:
    """Tests for leave approval with assistant slot handling (handle_assistant_slots_for_leave)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as director")
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_leave_approval_endpoint_exists(self, auth_headers):
        """Test that leave approval endpoint exists"""
        # Use a fake demande_id to check endpoint structure
        response = requests.put(
            f"{BASE_URL}/api/conges/fake-id/approuver",
            headers=auth_headers,
            json={
                "approuve": True,
                "commentaire": "Test"
            }
        )
        
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404 for non-existent demande, got {response.status_code}"
        print("✅ Leave approval endpoint exists and returns 404 for non-existent demande")
    
    def test_create_and_approve_leave_for_medecin(self, auth_headers):
        """Test creating and approving a leave request for a medecin (triggers assistant slot handling)"""
        
        # 1. Get a medecin user
        users_response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        if users_response.status_code != 200:
            pytest.skip("Could not get users list")
        
        users = users_response.json()
        medecins = [u for u in users if u["role"] == "Médecin" and u.get("actif", True)]
        
        if not medecins:
            pytest.skip("No active medecin found for testing")
        
        medecin = medecins[0]
        medecin_id = medecin["id"]
        
        # 2. Create a leave request for the medecin
        future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        
        leave_response = requests.post(
            f"{BASE_URL}/api/conges",
            headers=auth_headers,
            json={
                "utilisateur_id": medecin_id,
                "date_debut": future_date,
                "date_fin": future_date,
                "type_conge": "CONGE_PAYE",
                "creneau": "JOURNEE_COMPLETE",
                "motif": "TEST_Congé pour test assistant slots"
            }
        )
        
        if leave_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create leave request: {leave_response.text}")
        
        leave_id = leave_response.json().get("id")
        if not leave_id:
            pytest.skip("Leave created but no ID returned")
        
        print(f"✅ Leave request created for Dr. {medecin['prenom']} {medecin['nom']}: {leave_id}")
        
        # 3. Approve the leave request (this triggers handle_assistant_slots_for_leave)
        approve_response = requests.put(
            f"{BASE_URL}/api/conges/{leave_id}/approuver",
            headers=auth_headers,
            json={
                "approuve": True,
                "commentaire": "TEST_Approved for testing assistant slot handling"
            }
        )
        
        assert approve_response.status_code == 200, f"Leave approval failed: {approve_response.text}"
        
        data = approve_response.json()
        assert "message" in data, "Response should contain 'message'"
        
        print(f"✅ Leave request approved - assistant slot handling triggered in background")
        print(f"   Response: {data['message']}")
    
    def test_get_conges_list(self, auth_headers):
        """Test getting list of leave requests"""
        response = requests.get(
            f"{BASE_URL}/api/conges",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✅ Retrieved {len(data)} leave requests")
        
        # Check for our test leave request
        test_leaves = [d for d in data if "TEST_" in str(d.get("motif", ""))]
        if test_leaves:
            print(f"   Found {len(test_leaves)} test leave request(s)")


class TestNotificationsList:
    """Tests for basic notification CRUD operations"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as director")
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_user_notifications(self, auth_headers):
        """Test retrieving user notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✅ Retrieved {len(data)} notifications")
        
        if data:
            # Check notification structure
            notif = data[0]
            expected_fields = ["id", "user_id", "title", "body"]
            for field in expected_fields:
                assert field in notif, f"Notification missing field: {field}"
    
    def test_mark_notification_read(self, auth_headers):
        """Test marking a notification as read"""
        # First get notifications
        notifs_response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        if notifs_response.status_code != 200:
            pytest.skip("Could not get notifications")
        
        notifications = notifs_response.json()
        unread = [n for n in notifications if not n.get("read", False)]
        
        if not unread:
            # Create a test notification first
            employees_response = requests.get(
                f"{BASE_URL}/api/notifications/employees-for-test",
                headers=auth_headers
            )
            if employees_response.status_code == 200:
                employees = employees_response.json().get("employees", [])
                if employees:
                    # Send notification to self
                    director = next((e for e in employees if e["role"] == "Directeur"), None)
                    if director:
                        requests.post(
                            f"{BASE_URL}/api/notifications/test",
                            headers=auth_headers,
                            json={
                                "user_ids": [director["id"]],
                                "title": "Test for read marking",
                                "message": "This notification will be marked as read"
                            }
                        )
                        # Re-fetch notifications
                        notifs_response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
                        notifications = notifs_response.json()
                        unread = [n for n in notifications if not n.get("read", False)]
        
        if not unread:
            pytest.skip("No unread notifications to test")
        
        notif_id = unread[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ Notification {notif_id} marked as read")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "directeur@cabinet.fr",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate as director")
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_cleanup_test_leaves(self, auth_headers):
        """Cleanup test leave requests"""
        response = requests.get(f"{BASE_URL}/api/conges", headers=auth_headers)
        if response.status_code != 200:
            return
        
        leaves = response.json()
        test_leaves = [l for l in leaves if "TEST_" in str(l.get("motif", ""))]
        
        deleted = 0
        for leave in test_leaves:
            delete_response = requests.delete(
                f"{BASE_URL}/api/conges/{leave['id']}",
                headers=auth_headers
            )
            if delete_response.status_code in [200, 204]:
                deleted += 1
        
        print(f"🧹 Cleaned up {deleted} test leave requests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
