#!/usr/bin/env python3
"""
Specific test for work requests (demandes de travail) as requested
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import MedicalStaffAPITester

def test_work_requests_only():
    """Run only the work requests test as requested"""
    print("🏥 Testing Work Requests (Demandes de Travail) - SPECIFIC REQUEST")
    print("=" * 70)
    print("CONTEXTE: L'utilisateur ne voit pas les demandes en attente dans le planning.")
    print("OBJECTIF: Confirmer que les demandes en attente sont bien enregistrées et récupérables par l'API.")
    print()
    
    tester = MedicalStaffAPITester()
    
    # Test authentication for required roles
    print("🔐 Testing Authentication...")
    
    # Login as Directeur
    directeur_success = tester.test_login('directeur', 'directeur@cabinet.fr', 'admin123')
    if not directeur_success:
        print("❌ Failed to login as Directeur - cannot proceed")
        return False
    
    # Login as Médecin (Dr. Dupont)
    medecin_success = tester.test_login('medecin', 'dr.dupont@cabinet.fr', 'medecin123')
    if not medecin_success:
        print("❌ Failed to login as Dr. Dupont - cannot proceed")
        return False
    
    print("✅ Authentication successful for both roles")
    
    # Run the specific work requests test
    print("\n" + "="*60)
    print("💼 TESTING WORK REQUESTS SYSTEM")
    print("="*60)
    
    created_requests = tester.test_work_requests_specific()
    
    # Print final results
    print(f"\n" + "="*50)
    print(f"📊 WORK REQUESTS TEST RESULTS")
    print(f"="*50)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if created_requests and tester.tests_passed == tester.tests_run:
        print("🎉 WORK REQUESTS TEST SUCCESSFUL!")
        print("✅ Demandes de travail system is working correctly")
        print("✅ API can create, store and retrieve work requests")
        print("✅ Weekly planning endpoint is functional")
        return True
    else:
        print("❌ WORK REQUESTS TEST FAILED!")
        print("⚠️  Some issues detected with the work requests system")
        return False

if __name__ == "__main__":
    success = test_work_requests_only()
    sys.exit(0 if success else 1)