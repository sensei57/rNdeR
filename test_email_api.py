#!/usr/bin/env python3

import sys
import os
sys.path.append('/app')

from backend_test import MedicalStaffAPITester

def test_email_modification():
    print("🏥 Testing Email Modification API")
    print("=" * 50)
    
    tester = MedicalStaffAPITester()
    
    # Test authentication for directeur
    print("\n🔐 Testing Authentication...")
    directeur_creds = tester.test_users['directeur']
    if not tester.test_login('directeur', directeur_creds['email'], directeur_creds['password']):
        print("❌ Login failed for directeur")
        return 1
    
    # Also login other users for security tests
    for role, credentials in tester.test_users.items():
        if role != 'directeur':
            tester.test_login(role, credentials['email'], credentials['password'])
    
    print(f"\n✅ Authentication successful!")
    
    # Run email modification tests
    success = tester.test_email_modification_api()
    
    if success:
        print("\n🎉 EMAIL MODIFICATION API TESTS PASSED!")
        return 0
    else:
        print("\n❌ EMAIL MODIFICATION API TESTS FAILED!")
        return 1

if __name__ == "__main__":
    exit(test_email_modification())