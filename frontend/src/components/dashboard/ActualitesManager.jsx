import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, Plus, Edit, Trash2, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('/api')) {
    return `${BACKEND_URL}${photoUrl}`;
  }
  return photoUrl;
};

const ActualitesManager = ({ user, centreActif, CabinetPlanWithPopup }) => {
  const [actualites, setActualites] = useState([]);
  const [anniversaires, setAnniversaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingActualite, setEditingActualite] = useState(null);
  const [newActualite, setNewActualite] = useState({
    titre: '',
    contenu: '',
    type_contenu: 'texte',
    fichier_url: '',
    fichier_nom: '',
    groupe_cible: 'tous',
    priorite: 0
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const fetchWithTimeout = async (url, timeout = 8000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await axios.get(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return response;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      const [actusRes, annivRes] = await Promise.all([
        fetchWithTimeout(`${API}/actualites`).catch((err) => { console.log('Erreur actualites:', err); return { data: [] }; }),
        fetchWithTimeout(`${API}/anniversaires`).catch((err) => { console.log('Erreur anniversaires:', err); return { data: [] }; })
      ]);
      
      setActualites(Array.isArray(actusRes.data) ? actusRes.data : []);
      setAnniversaires(Array.isArray(annivRes.data) ? annivRes.data : []);
    } catch (error) {
      console.error('Erreur chargement actualités:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Polling intelligent (60s, pause si onglet caché)
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchData();
        }
      }, 60000);
      
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          fetchData();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [user, fetchData]);

  const getAnniversairesAffiches = () => {
    if (!anniversaires || anniversaires.length === 0) return [];
    const dansLaSemaine = anniversaires.filter(a => a.jours_restants <= 7);
    return dansLaSemaine.length > 0 ? dansLaSemaine : [anniversaires[0]];
  };

  const actualitesGenerales = (actualites || []).filter(a => a.groupe_cible === 'tous' || !a.groupe_cible);
  const actualitesPourMonGroupe = (actualites || []).filter(a => a.groupe_cible === user?.role);

  const handleCreateActualite = async (e) => {
    e.preventDefault();
    
    if (!newActualite.titre || !newActualite.contenu) {
      toast.error('Veuillez remplir le titre et le contenu');
      return;
    }

    try {
      if (editingActualite) {
        await axios.put(`${API}/actualites/${editingActualite.id}`, newActualite);
        toast.success('Actualité modifiée');
      } else {
        await axios.post(`${API}/actualites`, newActualite);
        toast.success('Actualité créée');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteActualite = async (id) => {
    if (!window.confirm('Supprimer cette actualité ?')) return;
    try {
      await axios.delete(`${API}/actualites/${id}`);
      toast.success('Actualité supprimée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setNewActualite({
      titre: '',
      contenu: '',
      type_contenu: 'texte',
      fichier_url: '',
      fichier_nom: '',
      groupe_cible: 'tous',
      priorite: 0
    });
    setEditingActualite(null);
  };

  const openEditModal = (actu) => {
    setEditingActualite(actu);
    setNewActualite({
      titre: actu.titre,
      contenu: actu.contenu,
      type_contenu: actu.type_contenu,
      fichier_url: actu.fichier_url || '',
      fichier_nom: actu.fichier_nom || '',
      groupe_cible: actu.groupe_cible || 'tous',
      priorite: actu.priorite || 0
    });
    setShowModal(true);
  };

  const ActualiteCard = ({ actu }) => (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center space-x-2">
              {actu.priorite > 0 && <span className="text-red-500">📌</span>}
              <span>{actu.titre}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Par {actu.auteur?.prenom} {actu.auteur?.nom} • {new Date(actu.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </CardDescription>
          </div>
          {(user?.role === 'Directeur' || user?.role === 'Super-Admin') && (
            <div className="flex space-x-1">
              <Button size="sm" variant="ghost" onClick={() => openEditModal(actu)} className="h-7 w-7 p-0">
                <Edit className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600 h-7 w-7 p-0" onClick={() => handleDeleteActualite(actu.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {actu.type_contenu === 'image' && actu.fichier_url && (
          <img src={actu.fichier_url} alt={actu.titre} className="w-full max-h-40 object-cover rounded-lg mb-2" />
        )}
        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{actu.contenu}</p>
        {actu.type_contenu === 'fichier' && actu.fichier_url && (
          <a href={actu.fichier_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-xs text-blue-600 hover:underline">
            <FileText className="h-3 w-3 mr-1" />
            {actu.fichier_nom || 'Fichier'}
          </a>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-[#0091B9] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const anniversairesAffiches = getAnniversairesAffiches();
  const isAdmin = user?.role === 'Directeur' || user?.role === 'Super-Admin';

  return (
    <div className="dashboard-container" data-testid="actualites-manager">
      {/* En-tête moderne */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-icon">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="page-header-title">Actualités</h1>
            <p className="page-header-subtitle">Restez informé des dernières nouvelles du cabinet</p>
          </div>
        </div>
        {isAdmin && (
          <button className="btn-modern btn-modern-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="h-5 w-5" />
            Nouvelle Actualité
          </button>
        )}
      </div>

      {/* Bannière Anniversaires */}
      {anniversairesAffiches.length > 0 && (
        <div className="birthday-banner">
          <span className="birthday-banner-icon">🎂</span>
          <div className="flex items-center gap-4 flex-wrap flex-1">
            {anniversairesAffiches.map((anniv) => (
              <div key={anniv.id} className="flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-md border border-pink-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <Avatar className="h-12 w-12 ring-2 ring-pink-200 ring-offset-2">
                  {anniv.photo_url && <AvatarImage src={getPhotoUrl(anniv.photo_url)} />}
                  <AvatarFallback className={`font-bold ${
                    anniv.role === 'Médecin' ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' :
                    anniv.role === 'Assistant' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' :
                    anniv.role === 'Secrétaire' ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' :
                    'bg-gradient-to-br from-gray-400 to-gray-600 text-white'
                  }`}>
                    {anniv.prenom?.[0]}{anniv.nom?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    {anniv.prenom} {anniv.nom}
                    {anniv.jours_restants === 0 && <span className="ml-2 animate-bounce inline-block">🎉</span>}
                  </p>
                  <p className="text-xs font-medium">
                    {anniv.jours_restants === 0 ? (
                      <span className="text-pink-600 font-bold">🎈 Aujourd'hui ! ({anniv.age} ans)</span>
                    ) : anniv.jours_restants === 1 ? (
                      <span className="text-orange-600">Demain ({anniv.age} ans)</span>
                    ) : (
                      <span className="text-gray-500">Dans {anniv.jours_restants} jours</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2 Colonnes : Actualités */}
      <div className="news-section">
        <div className="news-card">
          <div className="news-card-header">
            <div className="news-card-icon general">📢</div>
            <h2 className="news-card-title">Actualités Générales</h2>
          </div>
          
          {actualitesGenerales.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p className="empty-state-text">Aucune actualité générale</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actualitesGenerales.map((actu) => (
                <ActualiteCard key={actu.id} actu={actu} />
              ))}
            </div>
          )}
        </div>

        <div className="news-card">
          <div className="news-card-header">
            <div className={`news-card-icon ${user?.role === 'Médecin' ? 'general' : 'targeted'}`}>
              {user?.role === 'Médecin' ? '👨‍⚕️' : user?.role === 'Assistant' ? '👥' : '🎯'}
            </div>
            <h2 className="news-card-title">
              Actualités {isAdmin ? 'Ciblées' : `pour les ${user?.role}s`}
            </h2>
          </div>
          
          {isAdmin ? (
            <div className="space-y-4">
              {['Médecin', 'Assistant', 'Secrétaire'].map(role => {
                const actusRole = (actualites || []).filter(a => a.groupe_cible === role);
                if (actusRole.length === 0) return null;
                return (
                  <div key={role}>
                    <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2 pb-2 border-b border-gray-100">
                      <span className={`w-3 h-3 rounded-full ${
                        role === 'Médecin' ? 'bg-blue-500' : role === 'Assistant' ? 'bg-emerald-500' : 'bg-purple-500'
                      }`}></span>
                      Pour les {role}s
                    </h3>
                    <div className="space-y-2">
                      {actusRole.map(actu => <ActualiteCard key={actu.id} actu={actu} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            actualitesPourMonGroupe.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <p className="empty-state-text">Aucune actualité pour les {user?.role}s</p>
              </div>
            ) : (
              <div className="space-y-3">
                {actualitesPourMonGroupe.map((actu) => (
                  <ActualiteCard key={actu.id} actu={actu} />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Plan du Cabinet */}
      {CabinetPlanWithPopup && (
        <CabinetPlanWithPopup 
          user={user}
          centreActif={centreActif}
        />
      )}

      {/* Modal création/édition */}
      {showModal && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingActualite ? 'Modifier l\'actualité' : 'Nouvelle Actualité'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateActualite} className="space-y-4">
              <div className="space-y-2">
                <Label>Titre *</Label>
                <Input
                  value={newActualite.titre}
                  onChange={(e) => setNewActualite({...newActualite, titre: e.target.value})}
                  placeholder="Titre de l'actualité"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de contenu</Label>
                  <Select value={newActualite.type_contenu} onValueChange={(v) => setNewActualite({...newActualite, type_contenu: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texte">📝 Texte</SelectItem>
                      <SelectItem value="image">🖼️ Image</SelectItem>
                      <SelectItem value="fichier">📎 Fichier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Diffuser à</Label>
                  <Select value={newActualite.groupe_cible} onValueChange={(v) => setNewActualite({...newActualite, groupe_cible: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">📢 Tout le monde</SelectItem>
                      <SelectItem value="Médecin">👨‍⚕️ Médecins</SelectItem>
                      <SelectItem value="Assistant">👥 Assistants</SelectItem>
                      <SelectItem value="Secrétaire">📋 Secrétaires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contenu *</Label>
                <textarea
                  value={newActualite.contenu}
                  onChange={(e) => setNewActualite({...newActualite, contenu: e.target.value})}
                  placeholder="Contenu de l'actualité..."
                  className="w-full min-h-[100px] p-3 border rounded-md text-sm"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
                <Button type="submit">{editingActualite ? 'Modifier' : 'Publier'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ActualitesManager;
