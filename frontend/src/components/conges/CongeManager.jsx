import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Check, X, Clock, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CongeManager = ({ user }) => {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDemandeModal, setShowNewDemandeModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [filterStatut, setFilterStatut] = useState('TOUT');
  const [filterEmploye, setFilterEmploye] = useState('TOUS');
  const [newDemande, setNewDemande] = useState({
    utilisateur_id: '',
    date_debut: '',
    date_fin: '',
    type_conge: '',
    creneau: 'JOURNEE_COMPLETE',
    motif: '',
    heures_conge: null
  });

  useEffect(() => {
    fetchDemandes();
    if (user?.role === 'Directeur' || user?.role === 'Super-Admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      const data = Array.isArray(response.data) ? response.data : [];
      setUsers(data.filter(u => u.actif));
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs');
      setUsers([]);
    }
  };

  const fetchDemandes = async () => {
    try {
      const response = await axios.get(`${API}/conges`);
      setDemandes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error('Erreur lors du chargement des demandes');
      setDemandes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemande = async (e) => {
    e.preventDefault();
    
    if (!newDemande.date_debut || !newDemande.date_fin || !newDemande.type_conge) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if ((user?.role === 'Directeur' || user?.role === 'Super-Admin') && !newDemande.utilisateur_id) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }

    try {
      const demandeData = {
        ...newDemande,
        utilisateur_id: ((user?.role === 'Directeur' || user?.role === 'Super-Admin') && newDemande.utilisateur_id) 
          ? newDemande.utilisateur_id 
          : user.id
      };
      
      await axios.post(`${API}/conges`, demandeData);
      toast.success('Demande de congé créée avec succès');
      setShowNewDemandeModal(false);
      setNewDemande({
        utilisateur_id: '',
        date_debut: '',
        date_fin: '',
        type_conge: '',
        creneau: 'JOURNEE_COMPLETE',
        motif: '',
        heures_conge: null
      });
      fetchDemandes();
    } catch (error) {
      toast.error('Erreur lors de la création de la demande');
    }
  };

  const handleApprobation = async (demandeId, approuve, commentaire = '') => {
    try {
      await axios.put(`${API}/conges/${demandeId}/approuver`, {
        approuve: approuve,
        commentaire: commentaire
      });
      toast.success(approuve ? 'Demande approuvée' : 'Demande rejetée');
      fetchDemandes();
    } catch (error) {
      toast.error('Erreur lors de l\'approbation');
    }
  };

  const handleAnnulerConge = async (demandeId) => {
    if (!window.confirm('Voulez-vous vraiment annuler ce congé ?')) return;
    
    try {
      await axios.put(`${API}/conges/${demandeId}/annuler`);
      toast.success('Congé annulé avec succès');
      fetchDemandes();
    } catch (error) {
      toast.error('Erreur lors de l\'annulation du congé');
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'APPROUVE': return 'bg-green-100 text-green-800';
      case 'REJETE': return 'bg-red-100 text-red-800';
      case 'ANNULE': return 'bg-gray-100 text-gray-800';
      case 'EN_ATTENTE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeCongeLabel = (type) => {
    const types = {
      'CONGE_PAYE': 'Congé payé',
      'CONGE_SANS_SOLDE': 'Congé sans solde',
      'MALADIE': 'Congé maladie',
      'REPOS': 'Repos (non comptabilisé)',
      'HEURES_A_RECUPERER': 'Heures à récupérer (+heures sup)',
      'HEURES_RECUPEREES': 'Heures récupérées (-heures sup)'
    };
    return types[type] || type;
  };

  const getFilteredDemandes = () => {
    let filtered = [...(demandes || [])];
    
    if (user?.role !== 'Directeur' && user?.role !== 'Super-Admin') {
      filtered = filtered.filter(d => d.utilisateur_id === user.id);
    }
    
    if (filterStatut !== 'TOUT') {
      filtered = filtered.filter(d => d.statut === filterStatut);
    }
    
    if (filterEmploye !== 'TOUS' && (user?.role === 'Directeur' || user?.role === 'Super-Admin')) {
      filtered = filtered.filter(d => d.utilisateur_id === filterEmploye);
    }
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0091B9]"></div>
      </div>
    );
  }

  const filteredDemandes = getFilteredDemandes();
  const pendingCount = demandes.filter(d => d.statut === 'EN_ATTENTE').length;
  const approvedCount = demandes.filter(d => d.statut === 'APPROUVE').length;
  const isAdmin = user?.role === 'Directeur' || user?.role === 'Super-Admin';

  return (
    <div className="space-y-6" data-testid="conge-manager">
      {/* Header moderne */}
      <div className="bg-gradient-to-r from-[#0091B9] to-[#19CD91] rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Gestion des Congés</h2>
            <p className="text-white/80 mt-1">Gérez vos demandes de congés et absences</p>
          </div>
          
          <Dialog open={showNewDemandeModal} onOpenChange={setShowNewDemandeModal}>
            <DialogTrigger asChild>
              <Button className="bg-white text-[#0091B9] hover:bg-white/90 shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Demande
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle Demande de Congé</DialogTitle>
                <DialogDescription>
                  Remplissez les informations pour votre demande de congé
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateDemande} className="space-y-4">
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="utilisateur">Employé concerné *</Label>
                    <Select
                      value={newDemande.utilisateur_id}
                      onValueChange={(value) => setNewDemande({...newDemande, utilisateur_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un employé" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.prenom} {u.nom} - {u.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_debut">Date de début *</Label>
                    <Input
                      id="date_debut"
                      type="date"
                      value={newDemande.date_debut}
                      onChange={(e) => setNewDemande({...newDemande, date_debut: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_fin">Date de fin *</Label>
                    <Input
                      id="date_fin"
                      type="date"
                      value={newDemande.date_fin}
                      onChange={(e) => setNewDemande({...newDemande, date_fin: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type_conge">Type de congé *</Label>
                  <Select
                    value={newDemande.type_conge}
                    onValueChange={(value) => setNewDemande({...newDemande, type_conge: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un type de congé" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONGE_PAYE">Congé payé</SelectItem>
                      <SelectItem value="CONGE_SANS_SOLDE">Congé sans solde</SelectItem>
                      <SelectItem value="MALADIE">Congé maladie</SelectItem>
                      {isAdmin && (
                        <>
                          <SelectItem value="HEURES_A_RECUPERER">Heures à récupérer (+heures sup)</SelectItem>
                          <SelectItem value="HEURES_RECUPEREES">Heures récupérées (-heures sup)</SelectItem>
                          <SelectItem value="REPOS">Repos (non comptabilisé)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="creneau_conge">Durée du congé *</Label>
                  <Select
                    value={newDemande.creneau || 'JOURNEE_COMPLETE'}
                    onValueChange={(value) => setNewDemande({...newDemande, creneau: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JOURNEE_COMPLETE">Journée complète</SelectItem>
                      <SelectItem value="MATIN">Demi-journée matin</SelectItem>
                      <SelectItem value="APRES_MIDI">Demi-journée après-midi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="heures_conge">Heures par demi-journée (optionnel)</Label>
                    <Input
                      id="heures_conge"
                      type="number"
                      step="0.5"
                      min="0"
                      max="12"
                      placeholder="4 (par défaut)"
                      value={newDemande.heures_conge || ''}
                      onChange={(e) => setNewDemande({...newDemande, heures_conge: e.target.value ? parseFloat(e.target.value) : null})}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="motif">Motif (optionnel)</Label>
                  <Textarea
                    id="motif"
                    placeholder="Précisez le motif de votre demande..."
                    value={newDemande.motif}
                    onChange={(e) => setNewDemande({...newDemande, motif: e.target.value})}
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowNewDemandeModal(false)}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    Créer la demande
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">En attente</p>
                <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Approuvées</p>
                <p className="text-2xl font-bold text-green-700">{approvedCount}</p>
              </div>
              <Check className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Refusées</p>
                <p className="text-2xl font-bold text-red-700">{demandes.filter(d => d.statut === 'REJETE' || d.statut === 'ANNULE').length}</p>
              </div>
              <X className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total</p>
                <p className="text-2xl font-bold text-blue-700">{demandes.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={filterStatut === 'TOUT' ? 'default' : 'outline'}
                onClick={() => setFilterStatut('TOUT')}
                className={filterStatut === 'TOUT' ? 'bg-[#0091B9]' : ''}
              >
                Toutes ({demandes.length})
              </Button>
              <Button
                size="sm"
                variant={filterStatut === 'EN_ATTENTE' ? 'default' : 'outline'}
                onClick={() => setFilterStatut('EN_ATTENTE')}
                className={filterStatut === 'EN_ATTENTE' ? 'bg-yellow-500' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'}
              >
                En attente ({pendingCount})
              </Button>
              <Button
                size="sm"
                variant={filterStatut === 'APPROUVE' ? 'default' : 'outline'}
                onClick={() => setFilterStatut('APPROUVE')}
                className={filterStatut === 'APPROUVE' ? 'bg-green-500' : 'border-green-300 text-green-700 hover:bg-green-50'}
              >
                Validées ({approvedCount})
              </Button>
            </div>

            {isAdmin && (
              <Select value={filterEmploye} onValueChange={setFilterEmploye}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les employés" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOUS">Tous les employés</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.prenom} {u.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste des demandes */}
      <div className="space-y-4">
        {filteredDemandes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Aucune demande de congé trouvée</p>
            </CardContent>
          </Card>
        ) : filteredDemandes.map(demande => (
          <Card key={demande.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className={`h-1 ${
              demande.statut === 'EN_ATTENTE' ? 'bg-yellow-400' :
              demande.statut === 'APPROUVE' ? 'bg-green-400' :
              demande.statut === 'REJETE' ? 'bg-red-400' : 'bg-gray-400'
            }`} />
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-[#0091B9] to-[#19CD91] text-white">
                      {demande.utilisateur?.prenom?.[0]}{demande.utilisateur?.nom?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {demande.utilisateur?.prenom} {demande.utilisateur?.nom}
                      </h3>
                      <Badge className={getStatutColor(demande.statut)}>
                        {demande.statut === 'EN_ATTENTE' ? 'En attente' :
                         demande.statut === 'APPROUVE' ? 'Approuvée' :
                         demande.statut === 'REJETE' ? 'Refusée' : demande.statut}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(demande.date_debut).toLocaleDateString('fr-FR')} → {new Date(demande.date_fin).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                        {getTypeCongeLabel(demande.type_conge)}
                      </span>
                    </div>
                    {demande.motif && (
                      <p className="text-sm text-gray-500 italic">"{demande.motif}"</p>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {isAdmin && demande.statut === 'EN_ATTENTE' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprobation(demande.id, true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleApprobation(demande.id, false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  {isAdmin && demande.statut === 'APPROUVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAnnulerConge(demande.id)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CongeManager;
