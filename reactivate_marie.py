#!/usr/bin/env python3
"""
Reactivate Marie Dupont for testing
"""

import requests
import json

def reactivate_marie():
    base_url = "https://connect-verify-1.preview.emergentagent.com"
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
    print(f"Found Marie Dupont (ID: {marie_id}), Active: {marie_dupont.get('actif', True)}")
    
    if marie_dupont.get('actif', True):
        print("✅ Marie Dupont is already active")
        return True
    
    # Reactivate Marie Dupont using the toggle-active endpoint
    print("🔄 Reactivating Marie Dupont...")
    reactivate_response = requests.put(f"{api_url}/admin/users/{marie_id}/toggle-active", headers=headers)
    
    if reactivate_response.status_code != 200:
        print(f"❌ Failed to reactivate Marie Dupont: {reactivate_response.status_code}")
        try:
            error_detail = reactivate_response.json()
            print(f"   Error: {error_detail}")
        except:
            print(f"   Response: {reactivate_response.text}")
        return False
    
    try:
        result = reactivate_response.json()
        print(f"✅ Marie Dupont reactivated successfully: Active = {result.get('actif', 'unknown')}")
    except:
        print(f"✅ Marie Dupont reactivated successfully (no JSON response)")
    
    # Verify reactivation
    users_response = requests.get(f"{api_url}/users", headers=headers)
    if users_response.status_code == 200:
        users = users_response.json()
        for user in users:
            if user.get('email') == 'dr.dupont@cabinet.fr':
                print(f"✅ Verification: Marie Dupont is now active = {user.get('actif', True)}")
                return user.get('actif', True)
    
    return True

if __name__ == "__main__":
    success = reactivate_marie()
    exit(0 if success else 1)