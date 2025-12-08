"""
Script de migration : Convertir les créneaux JOURNEE_COMPLETE en 2 créneaux séparés (MATIN + APRES_MIDI)
"""
import uuid
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client.gestion_cabinet

print("=" * 70)
print("🔄 MIGRATION - Conversion JOURNEE_COMPLETE → MATIN + APRES_MIDI")
print("=" * 70)

# Trouver tous les créneaux JOURNEE_COMPLETE
creneaux_journee_complete = list(db.planning.find({"creneau": "JOURNEE_COMPLETE"}))

if not creneaux_journee_complete:
    print("\n✅ Aucun créneau JOURNEE_COMPLETE à migrer")
    print("=" * 70)
    exit(0)

print(f"\n📊 {len(creneaux_journee_complete)} créneaux JOURNEE_COMPLETE trouvés\n")

for creneau in creneaux_journee_complete:
    print(f"🔄 Migration créneau : {creneau.get('date')} - {creneau.get('employe_id')}")
    
    # Créer 2 nouveaux créneaux
    for periode in ["MATIN", "APRES_MIDI"]:
        nouveau_creneau = {
            "id": str(uuid.uuid4()),
            "date": creneau["date"],
            "creneau": periode,
            "employe_id": creneau["employe_id"],
            "employe_role": creneau.get("employe_role"),
            "salle_attribuee": creneau.get("salle_attribuee"),
            "salle_attente": creneau.get("salle_attente"),
            "notes": creneau.get("notes")
        }
        
        # Vérifier si un créneau n'existe pas déjà
        existing = db.planning.find_one({
            "date": creneau["date"],
            "creneau": periode,
            "employe_id": creneau["employe_id"]
        })
        
        if not existing:
            db.planning.insert_one(nouveau_creneau)
            print(f"   ✅ Créneau {periode} créé (ID: {nouveau_creneau['id']})")
        else:
            print(f"   ⚠️  Créneau {periode} existe déjà, non créé")
    
    # Supprimer l'ancien créneau JOURNEE_COMPLETE
    db.planning.delete_one({"_id": creneau["_id"]})
    print(f"   🗑️  Ancien créneau JOURNEE_COMPLETE supprimé\n")

print("=" * 70)
print(f"✅ MIGRATION TERMINÉE - {len(creneaux_journee_complete)} créneaux convertis")
print("=" * 70)
