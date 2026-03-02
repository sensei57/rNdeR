# Configuration pour déploiement Render

## Health Check

**IMPORTANT**: Configurez le health check de votre service Render vers:

```
/api/health
```

Ce endpoint répond **immédiatement** (< 1 seconde) même avant que MongoDB soit connecté.

## Variables d'environnement requises sur Render

```
MONGO_URL=mongodb+srv://...
DB_NAME=cabinet_medical
SECRET_KEY=votre_cle_secrete

# Firebase (optionnel - pour les notifications push)
FIREBASE_CREDENTIALS={"type":"service_account",...}
FIREBASE_STORAGE_BUCKET=votre-bucket.firebasestorage.app

# CORS (optionnel - déjà configuré par défaut)
CORS_ORIGINS=https://votre-frontend.onrender.com
```

## Temps de démarrage attendu

- **Cold start**: < 3 secondes pour répondre sur `/api/health`
- **MongoDB**: Connexion établie en arrière-plan (~2-5 secondes supplémentaires)
- **Firebase**: Initialisé à la première requête nécessitant les notifications

## Commande de démarrage

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

## Endpoints de monitoring

- `GET /api/health` - Health check rapide (toujours disponible)
- `GET /api/status` - Status détaillé (vérifie MongoDB, Scheduler)
