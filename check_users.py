#!/usr/bin/env python3
"""
Check what users exist in the system
"""

import requests
import json

def check_users():
    base_url = "https://bracket-finder.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # Login as directeur first
    print("🔐 Logging in as Directeur...")
    login_response = requests.post(f"{api_url}/auth/login", json={
        "email": "directeur@cabinet.fr",
        "password": "admin123"
    })
    
    if login_response.status_code != 200:
        print(f"❌ Failed to login as directeur: {login_response.status_code}")
        return
    
    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Get all users
    print("\n👥 Getting all users...")
    users_response = requests.get(f"{api_url}/users", headers=headers)
    
    if users_response.status_code != 200:
        print(f"❌ Failed to get users: {users_response.status_code}")
        return
    
    users = users_response.json()
    print(f"Found {len(users)} users:")
    
    for user in users:
        status = "Actif" if user.get('actif', True) else "Inactif"
        print(f"- {user['prenom']} {user['nom']} ({user['role']}) - {user['email']} - {status}")
    
    # Check specifically for Marie Dupont
    marie_dupont = None
    for user in users:
        if user.get('email') == 'dr.dupont@cabinet.fr' or (user.get('prenom') == 'Marie' and user.get('nom') == 'Dupont'):
            marie_dupont = user
            break
    
    if marie_dupont:
        print(f"\n✅ Found Marie Dupont:")
        print(f"   - ID: {marie_dupont['id']}")
        print(f"   - Email: {marie_dupont['email']}")
        print(f"   - Role: {marie_dupont['role']}")
        print(f"   - Active: {marie_dupont.get('actif', True)}")
    else:
        print(f"\n❌ Marie Dupont not found with email dr.dupont@cabinet.fr")
        
        # Look for any médecin
        medecins = [u for u in users if u['role'] == 'Médecin']
        if medecins:
            print(f"\nFound {len(medecins)} médecins:")
            for medecin in medecins:
                status = "Actif" if medecin.get('actif', True) else "Inactif"
                print(f"   - {medecin['prenom']} {medecin['nom']} - {medecin['email']} - {status}")

if __name__ == "__main__":
    check_users()