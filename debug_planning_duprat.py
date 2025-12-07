"""
Script pour diagnostiquer le problème d'affichage de Dr Duprat
"""
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client.gestion_cabinet

print("=" * 70)
print("🔍 DIAGNOSTIC PLANNING DR DUPRAT")
print("=" * 70)

# Rechercher Dr Duprat
users = list(db.users.find({"$or": [
    {"nom": {"$regex": "duprat", "$options": "i"}},
    {"prenom": {"$regex": "duprat", "$options": "i"}}
]}))

if not users:
    print("❌ Aucun utilisateur 'Duprat' trouvé")
    print("\n📋 Médecins disponibles :")
    medecins = list(db.users.find({"role": "Médecin"}))
    for m in medecins:
        print(f"  - {m.get('prenom')} {m.get('nom')} (ID: {m.get('id')})")
else:
    user = users[0]
    print(f"✅ Utilisateur trouvé : {user.get('prenom')} {user.get('nom')}")
    print(f"   ID : {user.get('id')}")
    print(f"   Rôle : {user.get('role')}")
    
    # Rechercher ses créneaux de planning
    print(f"\n📅 Créneaux de planning pour {user.get('prenom')} {user.get('nom')} :")
    creneaux = list(db.planning.find({"employe_id": user.get('id')}).sort("date", -1).limit(10))
    
    if not creneaux:
        print("   ❌ Aucun créneau trouvé")
    else:
        print(f"   ✅ {len(creneaux)} créneaux trouvés (10 plus récents) :\n")
        for c in creneaux:
            creneau_type = c.get('creneau', 'NON DÉFINI')
            date = c.get('date', 'NON DÉFINI')
            salle = c.get('salle_attribuee', 'Pas de salle')
            print(f"   📌 Date: {date}")
            print(f"      Créneau: {creneau_type}")
            print(f"      Salle: {salle}")
            print(f"      ID: {c.get('id')}")
            
            # Vérifier si c'est JOURNEE_COMPLETE
            if creneau_type == 'JOURNEE_COMPLETE':
                print(f"      ✅ Type correct : JOURNEE_COMPLETE")
            elif creneau_type in ['MATIN', 'APRES_MIDI']:
                print(f"      ℹ️  Type créneau partiel : {creneau_type}")
            else:
                print(f"      ⚠️  Type inattendu : {creneau_type}")
            print()

print("=" * 70)
