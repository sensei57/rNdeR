"""
Routes API - Structure modulaire

Ce module organise les endpoints de l'API en sections logiques.
Le fichier server.py reste le point d'entrée principal car FastAPI
nécessite un routeur unique bien configuré.

Structure des endpoints dans server.py:
- HEALTH ENDPOINTS (lignes ~230-280)
- AUTH ENDPOINTS (lignes ~1988-2110)  
- CENTRES ENDPOINTS (lignes ~2111-2400)
- USERS ENDPOINTS (lignes ~2400-3000)
- PLANNING ENDPOINTS (lignes ~3000-4200)
- CONGES ENDPOINTS (lignes ~4200-5200)
- DEMANDES TRAVAIL ENDPOINTS (lignes ~5200-6000)
- MESSAGES ENDPOINTS (lignes ~6000-6500)
- NOTIFICATIONS ENDPOINTS (lignes ~1400-1800)
- STOCKS ENDPOINTS (lignes ~6500-7000)
- DOCUMENTS/ACTUALITES ENDPOINTS (lignes ~7000-7500)
- ADMIN ENDPOINTS (lignes ~7500-7900)

Pour ajouter de nouveaux endpoints, suivre la convention:
1. Ajouter le modèle dans models/
2. Ajouter la logique métier dans services/
3. Ajouter l'endpoint dans la section appropriée de server.py
"""

# Les routes sont définies directement dans server.py
# Ce fichier sert de documentation de la structure
