import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, Plus, Edit, Trash2, FileText, Upload, CheckCircle, Users, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';

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
  const [showSignaturesModal, setShowSignaturesModal] = useState(false);
  const [selectedActualiteSignatures, setSelectedActualiteSignatures] = useState(null);
  const [editingActualite, setEditingActualite] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newActualite, setNewActualite] = useState({
    titre: '',
    contenu: '',
    type_contenu: 'texte',
    fichier_url: '',
    fichier_nom: '',
    groupe_cible: 'tous',
    priorite: 0,
    signature_requise: false
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
  }, [user, fetchData, centreActif?.id]); // Recharger quand le centre change

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
      priorite: 0,
      signature_requise: false
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
      priorite: actu.priorite || 0,
      signature_requise: actu.signature_requise || false
    });
    setShowModal(true);
  };

  // Upload de fichier
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10MB)');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload/actualite`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setNewActualite({
        ...newActualite,
        fichier_url: response.data.url,
        fichier_nom: response.data.filename,
        type_contenu: response.data.type
      });
      toast.success('Fichier uploadé avec succès');
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  // Signer une actualité
  const handleSignerActualite = async (actualiteId) => {
    try {
      await axios.post(`${API}/actualites/${actualiteId}/signer`);
      toast.success('Actualité signée avec succès');
      fetchData(); // Recharger pour mettre à jour les signatures
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la signature');
    }
  };

  // Voir les signatures (pour les admins)
  const handleVoirSignatures = async (actualiteId) => {
    try {
      const response = await axios.get(`${API}/actualites/${actualiteId}/signatures`);
      setSelectedActualiteSignatures(response.data);
      setShowSignaturesModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement des signatures');
    }
  };

  const ActualiteCard = ({ actu }) => {
    const userHasSigned = actu.signatures?.some(s => s.user_id === user?.id);
    const isAdmin = user?.role === 'Directeur' || user?.role === 'Super-Admin';
    
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center space-x-2">
                {actu.priorite > 0 && <span className="text-red-500">📌</span>}
                {actu.signature_requise && <span className="text-orange-500" title="Signature requise">✍️</span>}
                <span>{actu.titre}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Par {actu.auteur?.prenom} {actu.auteur?.nom} • {new Date(actu.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex space-x-1">
                {actu.signature_requise && (
                  <Button size="sm" variant="ghost" onClick={() => handleVoirSignatures(actu.id)} className="h-7 w-7 p-0" title="Voir les signatures">
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
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
            <img src={`${BACKEND_URL}${actu.fichier_url}`} alt={actu.titre} className="w-full max-h-40 object-cover rounded-lg mb-2" />
          )}
          <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{actu.contenu}</p>
          {actu.type_contenu === 'fichier' && actu.fichier_url && (
            <a href={`${BACKEND_URL}${actu.fichier_url}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-xs text-blue-600 hover:underline">
              <FileText className="h-3 w-3 mr-1" />
              {actu.fichier_nom || 'Fichier'}
            </a>
          )}
          
          {/* Section signature */}
          {actu.signature_requise && (
            <div className="mt-3 pt-3 border-t">
              {userHasSigned ? (
                <div className="flex items-center text-green-600 text-xs">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Vous avez signé cette actualité
                </div>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => handleSignerActualite(actu.id)}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Signer pour confirmer la lecture
                </Button>
              )}
              {isAdmin && actu.signatures?.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {actu.signatures.length} signature(s) sur {actu.groupe_cible === 'tous' ? 'tous les employés' : `les ${actu.groupe_cible}s`}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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

      {/* Bannière Anniversaires - Toujours visible */}
      <div className="birthday-banner" style={{ minHeight: '60px' }}>
        <span className="birthday-banner-icon">🎂</span>
        <div className="flex items-center gap-4 flex-wrap flex-1">
          {anniversairesAffiches.length > 0 ? (
            anniversairesAffiches.map((anniv) => (
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
            ))
          ) : (
            <div className="text-gray-500 text-sm italic">
              Aucun anniversaire à venir (vérifiez que les dates de naissance sont renseignées dans les profils)
            </div>
          )}
        </div>
      </div>

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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <Select value={newActualite.type_contenu} onValueChange={(v) => setNewActualite({...newActualite, type_contenu: v, fichier_url: '', fichier_nom: ''})}>
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

              {/* Upload de fichier/image */}
              {(newActualite.type_contenu === 'image' || newActualite.type_contenu === 'fichier') && (
                <div className="space-y-2">
                  <Label>{newActualite.type_contenu === 'image' ? 'Image' : 'Fichier'}</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    {newActualite.fichier_url ? (
                      <div className="space-y-2">
                        {newActualite.type_contenu === 'image' ? (
                          <img 
                            src={newActualite.fichier_url.startsWith('/') ? `${BACKEND_URL}${newActualite.fichier_url}` : newActualite.fichier_url} 
                            alt="Aperçu" 
                            className="max-h-32 mx-auto rounded" 
                          />
                        ) : (
                          <div className="flex items-center justify-center text-gray-600">
                            <FileText className="h-8 w-8 mr-2" />
                            <span>{newActualite.fichier_nom}</span>
                          </div>
                        )}
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => setNewActualite({...newActualite, fichier_url: '', fichier_nom: ''})}
                        >
                          Supprimer
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept={newActualite.type_contenu === 'image' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.txt'}
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={uploading}
                        />
                        <div className="flex flex-col items-center">
                          <Upload className={`h-8 w-8 ${uploading ? 'animate-pulse text-blue-500' : 'text-gray-400'}`} />
                          <span className="mt-2 text-sm text-gray-600">
                            {uploading ? 'Upload en cours...' : `Cliquez pour ajouter ${newActualite.type_contenu === 'image' ? 'une image' : 'un fichier'}`}
                          </span>
                          <span className="text-xs text-gray-400 mt-1">Max 10MB</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              )}

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

              {/* Option signature requise */}
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                  <Label className="text-orange-800 font-medium">Signature requise</Label>
                  <p className="text-xs text-orange-600">Les employés devront confirmer avoir lu cette actualité</p>
                </div>
                <Switch 
                  checked={newActualite.signature_requise} 
                  onCheckedChange={(checked) => setNewActualite({...newActualite, signature_requise: checked})}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
                <Button type="submit" disabled={uploading}>{editingActualite ? 'Modifier' : 'Publier'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal des signatures */}
      {showSignaturesModal && selectedActualiteSignatures && (
        <Dialog open={showSignaturesModal} onOpenChange={setShowSignaturesModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Signatures - {selectedActualiteSignatures.titre}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Résumé */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">Progression</span>
                <span className="text-sm">
                  <span className="text-green-600 font-bold">{selectedActualiteSignatures.total_signes}</span>
                  <span className="text-gray-500"> / {selectedActualiteSignatures.total_cibles}</span>
                </span>
              </div>

              {/* Employés ayant signé */}
              <div>
                <h4 className="font-medium text-green-700 flex items-center mb-2">
                  <CheckCircle className="h-4 w-4 mr-1" /> Ont signé ({selectedActualiteSignatures.employes_signes?.length || 0})
                </h4>
                {selectedActualiteSignatures.employes_signes?.length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedActualiteSignatures.signatures.map((sig, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded text-sm">
                        <span>{sig.user_name} ({sig.user_role})</span>
                        <span className="text-xs text-gray-500">
                          {new Date(sig.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Aucune signature pour le moment</p>
                )}
              </div>

              {/* Employés n'ayant pas signé */}
              <div>
                <h4 className="font-medium text-red-700 flex items-center mb-2">
                  <Users className="h-4 w-4 mr-1" /> En attente ({selectedActualiteSignatures.employes_non_signes?.length || 0})
                </h4>
                {selectedActualiteSignatures.employes_non_signes?.length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedActualiteSignatures.employes_non_signes.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between p-2 bg-red-50 rounded text-sm">
                        <span>{emp.prenom} {emp.nom}</span>
                        <span className="text-xs text-gray-500">{emp.role}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-green-600 font-medium">Tous les employés ont signé !</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ActualitesManager;
