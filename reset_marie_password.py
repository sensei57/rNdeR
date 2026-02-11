#!/usr/bin/env python3
"""
Reset Marie Dupont's password for testing
"""

import requests
import json

def reset_marie_password():
    base_url = "https://french-greeting-56.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # Login as directeur first
    print("🔐 Logging in as Directeur...")
    login_response = requests.post(f"{api_url}/auth/login", json={
        "email": "directeur@cabinet.fr",
        "password": "admin123"
    })
    
    if login_response.status_code != 200:
        print(f"❌ Failed to login as directeur: {login_response.status_code}")
        return False
    
    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Get Marie Dupont's ID
    users_response = requests.get(f"{api_url}/users", headers=headers)
    if users_response.status_code != 200:
        print(f"❌ Failed to get users: {users_response.status_code}")
        return False
    
    users = users_response.json()
    marie_dupont = None
    for user in users:
        if user.get('email') == 'dr.dupont@cabinet.fr':
            marie_dupont = user
            break
    
    if not marie_dupont:
        print("❌ Marie Dupont not found")
        return False
    
    marie_id = marie_dupont['id']
    print(f"Found Marie Dupont (ID: {marie_id})")
    
    # Reset Marie Dupont's password
    print("🔑 Resetting Marie Dupont's password...")
    password_data = {"password": "medecin123"}
    reset_response = requests.put(f"{api_url}/admin/users/{marie_id}/password", 
                                  json=password_data, headers=headers)
    
    if reset_response.status_code != 200:
        print(f"❌ Failed to reset password: {reset_response.status_code}")
        try:
            error_detail = reset_response.json()
            print(f"   Error: {error_detail}")
        except:
            print(f"   Response: {reset_response.text}")
        return False
    
    print("✅ Password reset successfully")
    
    # Test login with new password
    print("🔐 Testing login with reset password...")
    test_login = requests.post(f"{api_url}/auth/login", json={
        "email": "dr.dupont@cabinet.fr",
        "password": "medecin123"
    })
    
    if test_login.status_code == 200:
        print("✅ Login test successful with reset password")
        return True
    else:
        print(f"❌ Login test failed: {test_login.status_code}")
        try:
            error_detail = test_login.json()
            print(f"   Error: {error_detail}")
        except:
            print(f"   Response: {test_login.text}")
        return False

if __name__ == "__main__":
    success = reset_marie_password()
    exit(0 if success else 1)