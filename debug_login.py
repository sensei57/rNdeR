#!/usr/bin/env python3

import requests
import json

def test_login_debug():
    base_url = "https://cabinetflow.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # First login as directeur
    directeur_login = {
        "email": "directeur@hopital.fr",
        "password": "directeur123"
    }
    
    response = requests.post(f"{api_url}/auth/login", json=directeur_login)
    print(f"Directeur login: {response.status_code}")
    
    if response.status_code == 200:
        directeur_token = response.json()['access_token']
        headers = {'Authorization': f'Bearer {directeur_token}', 'Content-Type': 'application/json'}
        
        # Get users to find a test user
        users_response = requests.get(f"{api_url}/admin/users", headers=headers)
        print(f"Get users: {users_response.status_code}")
        
        if users_response.status_code == 200:
            users = users_response.json()
            test_user = None
            for user in users:
                if user['role'] != 'Directeur' and user.get('actif', True):
                    test_user = user
                    break
            
            if test_user:
                user_id = test_user['id']
                original_email = test_user['email']
                print(f"Testing with user: {test_user['prenom']} {test_user['nom']} ({original_email})")
                
                # Change email
                new_email = f"debug.test.{user_id[:8]}@test.fr"
                email_data = {"email": new_email}
                
                email_response = requests.put(f"{api_url}/admin/users/{user_id}/email", 
                                            json=email_data, headers=headers)
                print(f"Email change: {email_response.status_code}")
                print(f"Email response: {email_response.json()}")
                
                # Reset password
                password_data = {"password": "debugtest123"}
                password_response = requests.put(f"{api_url}/admin/users/{user_id}/password", 
                                               json=password_data, headers=headers)
                print(f"Password reset: {password_response.status_code}")
                
                # Try login with new email
                login_data = {"email": new_email, "password": "debugtest123"}
                login_response = requests.post(f"{api_url}/auth/login", json=login_data)
                print(f"Login with new email: {login_response.status_code}")
                if login_response.status_code != 200:
                    print(f"Login error: {login_response.json()}")
                else:
                    print(f"Login success: {login_response.json()['user']['email']}")
                
                # Restore original email
                restore_data = {"email": original_email}
                restore_response = requests.put(f"{api_url}/admin/users/{user_id}/email", 
                                              json=restore_data, headers=headers)
                print(f"Restore email: {restore_response.status_code}")

if __name__ == "__main__":
    test_login_debug()