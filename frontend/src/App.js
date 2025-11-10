import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Calendar, Users, Clock, FileText, MessageSquare, Settings, LogOut, Plus, Check, X, CalendarDays, Send, Trash2, Edit, ChevronLeft, ChevronRight, MapPin, Building2, AlertTriangle, Package, Eye, Link, Upload } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/users/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('Connexion réussie !');
      
      // Force redirect to dashboard after successful login
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
      
      return true;
    } catch (error) {
      toast.error('Email ou mot de passe incorrect');
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Déconnexion réussie');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const LoginPage = () => {
  const [email, setEmail] = useState('directeur@hopital.fr');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(email, password);
    } catch (error) {
      console.error('Erreur de connexion:', error);
      toast.error('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-blue-600">
            Gestion Médicale
          </CardTitle>
          <CardDescription>
            Système de gestion du personnel médical
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              disabled={loading}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700 font-medium">Comptes de test :</p>
              <p className="text-xs text-blue-600">Directeur: directeur@hopital.fr / password123</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Notification Component
const NotificationToday = () => {
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayNotification();
  }, []);

  const fetchTodayNotification = async () => {
    try {
      const response = await axios.get(`${API}/notifications/me/today`);
      setNotification(response.data);
    } catch (error) {
      console.error('Aucune notification pour aujourd\'hui');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !notification) return null;

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-blue-800 flex items-center space-x-2">
          <CalendarDays className="h-4 w-4" />
          <span>Planning du jour</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-blue-700 whitespace-pre-line">
          {notification.contenu}
        </div>
      </CardContent>
    </Card>
  );
};

// Dashboard Navigation
const Navigation = () => {
  const { user, logout } = useAuth();

  const getInitials = (nom, prenom) => {
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Directeur': return 'bg-red-500';
      case 'Médecin': return 'bg-blue-500';
      case 'Assistant': return 'bg-green-500';
      case 'Secrétaire': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">
              Gestion Personnel Médical
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarFallback className={getRoleColor(user?.role)}>
                  {getInitials(user?.nom, user?.prenom)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium text-gray-700">
                  {user?.prenom} {user?.nom}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {user?.role}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Déconnexion</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Personnel Management Component
const PersonnelManager = () => {
  const [users, setUsers] = useState([]);
  const [assignations, setAssignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: '', id: '', name: '' });
  const [newPersonnel, setNewPersonnel] = useState({
    email: '',
    nom: '',
    prenom: '',
    role: 'Médecin',
    telephone: '',
    password: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (user?.role === 'Directeur') {
        // Directeur voit tout le personnel et toutes les assignations
        const [usersRes, assignationsRes] = await Promise.all([
          axios.get(`${API}/users`),
          axios.get(`${API}/assignations`)
        ]);
        setUsers(usersRes.data);
        setAssignations(assignationsRes.data);
      } else {
        // Les autres voient seulement leurs informations et assignations pertinentes
        const currentUserData = [user];
        setUsers(currentUserData);
        
        if (user?.role === 'Assistant') {
          // Assistant voit ses assignations et les médecins avec qui il travaille
          const assignationsRes = await axios.get(`${API}/assignations`);
          const myAssignations = assignationsRes.data.filter(a => a.assistant_id === user.id);
          setAssignations(myAssignations);
          
          // Ajouter les médecins avec qui il travaille
          const medecinIds = myAssignations.map(a => a.medecin_id);
          const medecins = [];
          for (const medecinId of medecinIds) {
            try {
              const medecinRes = await axios.get(`${API}/users/by-role/Médecin`);
              const medecin = medecinRes.data.find(m => m.id === medecinId);
              if (medecin) medecins.push(medecin);
            } catch (error) {
              console.error('Erreur médecin:', error);
            }
          }
          setUsers([...currentUserData, ...medecins]);
        } else {
          // Médecins et secrétaires voient seulement eux-mêmes
          setAssignations([]);
        }
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getUsersByRole = (role) => {
    return users.filter(u => u.role === role && u.actif);
  };

  const getAssignedAssistants = (medecinId) => {
    return assignations
      .filter(a => a.medecin_id === medecinId && a.actif)
      .map(a => a.assistant);
  };

  const handleCreatePersonnel = async (e) => {
    e.preventDefault();
    
    if (editingPersonnel) {
      // Mode modification
      if (!newPersonnel.email || !newPersonnel.nom || !newPersonnel.prenom) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }

      try {
        const updateData = {
          nom: newPersonnel.nom,
          prenom: newPersonnel.prenom,
          telephone: newPersonnel.telephone,
          actif: true
        };

        await axios.put(`${API}/users/${editingPersonnel.id}`, updateData);
        toast.success('Personnel modifié avec succès');
        setShowPersonnelModal(false);
        setEditingPersonnel(null);
        resetPersonnelForm();
        fetchData();
      } catch (error) {
        toast.error('Erreur lors de la modification du personnel');
      }
    } else {
      // Mode création
      if (!newPersonnel.email || !newPersonnel.nom || !newPersonnel.prenom || !newPersonnel.password) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }

      try {
        await axios.post(`${API}/auth/register`, newPersonnel);
        toast.success('Personnel créé avec succès');
        setShowPersonnelModal(false);
        resetPersonnelForm();
        fetchData();
      } catch (error) {
        if (error.response?.status === 400) {
          toast.error('Un utilisateur avec cet email existe déjà');
        } else {
          toast.error('Erreur lors de la création du personnel');
        }
      }
    }
  };

  const handleEditPersonnel = (personnel) => {
    setEditingPersonnel(personnel);
    setNewPersonnel({
      email: personnel.email,
      nom: personnel.nom,
      prenom: personnel.prenom,
      role: personnel.role,
      telephone: personnel.telephone || '',
      password: '' // Ne pas pré-remplir le mot de passe
    });
    setShowPersonnelModal(true);
  };

  const handleDeletePersonnel = (personnelId, personnelNom) => {
    setDeleteConfirm({ 
      show: true, 
      type: 'personnel', 
      id: personnelId, 
      name: personnelNom 
    });
  };

  const confirmDelete = async () => {
    try {
      await axios.put(`${API}/users/${deleteConfirm.id}`, { actif: false });
      toast.success('Personnel supprimé avec succès');
      fetchData();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
    setDeleteConfirm({ show: false, type: '', id: '', name: '' });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, type: '', id: '', name: '' });
  };

  const resetPersonnelForm = () => {
    setNewPersonnel({
      email: '',
      nom: '',
      prenom: '',
      role: 'Médecin',
      telephone: '',
      password: ''
    });
    setEditingPersonnel(null);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Gestion du Personnel</h2>
        {user?.role === 'Directeur' && (
          <Dialog open={showPersonnelModal} onOpenChange={setShowPersonnelModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Nouveau Personnel</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPersonnel ? 'Modifier Personnel' : 'Nouveau Personnel'}
                </DialogTitle>
                <DialogDescription>
                  {editingPersonnel 
                    ? 'Modifiez les informations de l\'employé'
                    : 'Ajoutez un nouvel employé au cabinet médical'
                  }
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreatePersonnel} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      value={newPersonnel.prenom}
                      onChange={(e) => setNewPersonnel({...newPersonnel, prenom: e.target.value})}
                      required
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={newPersonnel.nom}
                      onChange={(e) => setNewPersonnel({...newPersonnel, nom: e.target.value})}
                      required
                      placeholder="Nom de famille"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newPersonnel.email}
                    onChange={(e) => setNewPersonnel({...newPersonnel, email: e.target.value})}
                    required
                    disabled={editingPersonnel} // Email non modifiable
                    placeholder="email@hopital.fr"
                  />
                </div>
                
                {!editingPersonnel && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Rôle *</Label>
                    <Select
                      value={newPersonnel.role}
                      onValueChange={(value) => setNewPersonnel({...newPersonnel, role: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Médecin">Médecin</SelectItem>
                        <SelectItem value="Assistant">Assistant</SelectItem>
                        <SelectItem value="Secrétaire">Secrétaire</SelectItem>
                        <SelectItem value="Directeur">Directeur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    value={newPersonnel.telephone}
                    onChange={(e) => setNewPersonnel({...newPersonnel, telephone: e.target.value})}
                    placeholder="01 23 45 67 89"
                  />
                </div>
                
                {!editingPersonnel && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe temporaire *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newPersonnel.password}
                      onChange={(e) => setNewPersonnel({...newPersonnel, password: e.target.value})}
                      required
                      placeholder="Mot de passe"
                    />
                  </div>
                )}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPersonnelModal(false);
                      resetPersonnelForm();
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">
                    {editingPersonnel ? 'Modifier' : 'Créer'} le Personnel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="medecins" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="medecins">
            Médecins ({getUsersByRole('Médecin').length})
          </TabsTrigger>
          <TabsTrigger value="assistants">
            Assistants ({getUsersByRole('Assistant').length})
          </TabsTrigger>
          <TabsTrigger value="secretaires">
            Secrétaires ({getUsersByRole('Secrétaire').length})
          </TabsTrigger>
          <TabsTrigger value="assignations">
            Assignations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="medecins">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {getUsersByRole('Médecin').map(medecin => (
              <Card key={medecin.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback className="bg-blue-500">
                        {medecin.prenom?.[0]}{medecin.nom?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        Dr. {medecin.prenom} {medecin.nom}
                      </CardTitle>
                      <CardDescription>{medecin.email}</CardDescription>
                    </div>
                  </div>
                  
                  {user?.role === 'Directeur' && (
                    <div className="flex space-x-1 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditPersonnel(medecin)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePersonnel(medecin.id, `${medecin.prenom} ${medecin.nom}`)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <strong>Téléphone:</strong> {medecin.telephone || 'Non renseigné'}
                    </p>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Assistants assignés:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {getAssignedAssistants(medecin.id).map(assistant => (
                          <Badge key={assistant?.id} variant="secondary" className="text-xs">
                            {assistant?.prenom} {assistant?.nom}
                          </Badge>
                        ))}
                        {getAssignedAssistants(medecin.id).length === 0 && (
                          <span className="text-xs text-gray-500">Aucun assistant assigné</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="assistants">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {getUsersByRole('Assistant').map(assistant => (
              <Card key={assistant.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback className="bg-green-500">
                        {assistant.prenom?.[0]}{assistant.nom?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {assistant.prenom} {assistant.nom}
                      </CardTitle>
                      <CardDescription>{assistant.email}</CardDescription>
                    </div>
                  </div>
                  
                  {user?.role === 'Directeur' && (
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditPersonnel(assistant)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePersonnel(assistant.id, `${assistant.prenom} ${assistant.nom}`)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    <strong>Téléphone:</strong> {assistant.telephone || 'Non renseigné'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="secretaires">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {getUsersByRole('Secrétaire').map(secretaire => (
              <Card key={secretaire.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback className="bg-purple-500">
                        {secretaire.prenom?.[0]}{secretaire.nom?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {secretaire.prenom} {secretaire.nom}
                      </CardTitle>
                      <CardDescription>{secretaire.email}</CardDescription>
                    </div>
                  </div>
                  
                  {user?.role === 'Directeur' && (
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditPersonnel(secretaire)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePersonnel(secretaire.id, `${secretaire.prenom} ${secretaire.nom}`)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    <strong>Téléphone:</strong> {secretaire.telephone || 'Non renseigné'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="assignations">
          <div className="space-y-4">
            {assignations.filter(a => a.actif).map(assignation => (
              <Card key={assignation.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">
                        Dr. {assignation.medecin?.prenom} {assignation.medecin?.nom}
                      </p>
                      <p className="text-sm text-gray-600">
                        Assistant: {assignation.assistant?.prenom} {assignation.assistant?.nom}
                      </p>
                      <p className="text-xs text-gray-500">
                        Assigné le: {new Date(assignation.date_assignation).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    {user?.role === 'Directeur' && (
                      <Button variant="outline" size="sm">
                        Modifier
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de confirmation de suppression */}
      <Dialog open={deleteConfirm.show} onOpenChange={cancelDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {deleteConfirm.name} ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={cancelDelete}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Leave Management Component
const CongeManager = () => {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDemandeModal, setShowNewDemandeModal] = useState(false);
  const [newDemande, setNewDemande] = useState({
    date_debut: '',
    date_fin: '',
    type_conge: '',
    motif: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchDemandes();
  }, []);

  const fetchDemandes = async () => {
    try {
      const response = await axios.get(`${API}/conges`);
      setDemandes(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des demandes');
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

    try {
      const demandeData = {
        ...newDemande,
        utilisateur_id: user.id
      };
      
      await axios.post(`${API}/conges`, demandeData);
      toast.success('Demande de congé créée avec succès');
      setShowNewDemandeModal(false);
      setNewDemande({
        date_debut: '',
        date_fin: '',
        type_conge: '',
        motif: ''
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

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'APPROUVE': return 'bg-green-100 text-green-800';
      case 'REJETE': return 'bg-red-100 text-red-800';
      case 'EN_ATTENTE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeCongeLabel = (type) => {
    const types = {
      'CONGE_PAYE': 'Congé payé',
      'RTT': 'RTT',
      'MALADIE': 'Congé maladie',
      'FORMATION': 'Formation',
      'MATERNITE': 'Congé maternité',
      'PATERNITE': 'Congé paternité',
      'SANS_SOLDE': 'Congé sans solde'
    };
    return types[type] || type;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des Congés</h2>
        
        <Dialog open={showNewDemandeModal} onOpenChange={setShowNewDemandeModal}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nouvelle Demande</span>
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
                    <SelectItem value="RTT">RTT</SelectItem>
                    <SelectItem value="MALADIE">Congé maladie</SelectItem>
                    <SelectItem value="FORMATION">Formation</SelectItem>
                    <SelectItem value="MATERNITE">Congé maternité</SelectItem>
                    <SelectItem value="PATERNITE">Congé paternité</SelectItem>
                    <SelectItem value="SANS_SOLDE">Congé sans solde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewDemandeModal(false)}
                >
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

      <div className="space-y-4">
        {demandes.map(demande => (
          <Card key={demande.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">
                      {demande.utilisateur?.prenom} {demande.utilisateur?.nom}
                    </h3>
                    <Badge className={getStatutColor(demande.statut)}>
                      {demande.statut.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    <strong>Période:</strong> {new Date(demande.date_debut).toLocaleDateString('fr-FR')} au {new Date(demande.date_fin).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Type:</strong> {getTypeCongeLabel(demande.type_conge)}
                  </p>
                  {demande.motif && (
                    <p className="text-sm text-gray-600">
                      <strong>Motif:</strong> {demande.motif}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Demandé le: {new Date(demande.date_demande).toLocaleDateString('fr-FR')}
                  </p>
                  {demande.commentaire_approbation && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      <strong>Commentaire:</strong> {demande.commentaire_approbation}
                    </p>
                  )}
                </div>
                {user?.role === 'Directeur' && demande.statut === 'EN_ATTENTE' && (
                  <div className="flex space-x-2">
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
              </div>
            </CardContent>
          </Card>
        ))}
        {demandes.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune demande de congé trouvée</p>
              <p className="text-sm text-gray-400 mt-2">
                Cliquez sur "Nouvelle Demande" pour créer votre première demande
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Gestion des Salles Component
const SallesManager = () => {
  const [salles, setSalles] = useState([]);
  const [showSalleModal, setShowSalleModal] = useState(false);
  const [editingSalle, setEditingSalle] = useState(null);
  const [deleteSalleConfirm, setDeleteSalleConfirm] = useState({ show: false, id: '', name: '' });
  const [newSalle, setNewSalle] = useState({
    nom: '',
    type_salle: 'MEDECIN',
    position_x: 3,
    position_y: 3,
    couleur: '#3B82F6'
  });
  const [configuration, setConfiguration] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchSalles();
    fetchConfiguration();
  }, []);

  const fetchSalles = async () => {
    try {
      const response = await axios.get(`${API}/salles`);
      setSalles(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des salles');
    }
  };

  const fetchConfiguration = async () => {
    try {
      const response = await axios.get(`${API}/configuration`);
      setConfiguration(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration');
    }
  };

  const handleCreateSalle = async (e) => {
    e.preventDefault();
    
    try {
      if (editingSalle) {
        await axios.put(`${API}/salles/${editingSalle.id}`, newSalle);
        toast.success('Salle modifiée avec succès');
      } else {
        await axios.post(`${API}/salles`, newSalle);
        toast.success('Salle créée avec succès');
      }
      
      setShowSalleModal(false);
      setEditingSalle(null);
      resetSalleForm();
      fetchSalles();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteSalle = (salleId, salleNom) => {
    setDeleteSalleConfirm({ 
      show: true, 
      id: salleId, 
      name: salleNom || `Salle ${salleId}` 
    });
  };

  const confirmDeleteSalle = async () => {
    try {
      await axios.delete(`${API}/salles/${deleteSalleConfirm.id}`);
      toast.success('Salle supprimée');
      fetchSalles();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
    setDeleteSalleConfirm({ show: false, id: '', name: '' });
  };

  const cancelDeleteSalle = () => {
    setDeleteSalleConfirm({ show: false, id: '', name: '' });
  };

  const handleEditSalle = (salle) => {
    setEditingSalle(salle);
    setNewSalle({
      nom: salle.nom,
      type_salle: salle.type_salle,
      position_x: salle.position_x,
      position_y: salle.position_y,
      couleur: salle.couleur
    });
    setShowSalleModal(true);
  };

  const resetSalleForm = () => {
    setNewSalle({
      nom: '',
      type_salle: 'MEDECIN',
      position_x: 3,
      position_y: 3,
      couleur: '#3B82F6'
    });
  };

  const initialiserCabinet = async () => {
    try {
      await axios.post(`${API}/cabinet/initialiser`);
      toast.success('Cabinet initialisé avec succès');
      fetchSalles();
    } catch (error) {
      toast.error('Erreur lors de l\'initialisation');
    }
  };

  const updateConfiguration = async (configData) => {
    try {
      await axios.put(`${API}/configuration`, configData);
      toast.success('Configuration mise à jour');
      fetchConfiguration();
      setShowConfigModal(false);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'MEDECIN': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ASSISTANT': return 'bg-green-100 text-green-800 border-green-300';
      case 'ATTENTE': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (user?.role !== 'Directeur') {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Gestion des Salles</h3>
        <p className="text-gray-500">Accès réservé au Directeur</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Salles</h2>
          <p className="text-gray-600 mt-1">Configurez les salles et boxes du cabinet</p>
        </div>
        
        <div className="flex space-x-3">
          {salles.length === 0 && (
            <Button
              onClick={initialiserCabinet}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Building2 className="h-4 w-4" />
              <span>Initialiser Cabinet</span>
            </Button>
          )}
          
          <Button
            onClick={() => setShowConfigModal(true)}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Configuration</span>
          </Button>
          
          <Dialog open={showSalleModal} onOpenChange={setShowSalleModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Nouvelle Salle</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSalle ? 'Modifier la Salle' : 'Nouvelle Salle'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleCreateSalle} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom de la salle *</Label>
                  <Input
                    value={newSalle.nom}
                    onChange={(e) => setNewSalle({...newSalle, nom: e.target.value})}
                    placeholder="Ex: Salle 1, Box A..."
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Type de salle *</Label>
                  <Select
                    value={newSalle.type_salle}
                    onValueChange={(value) => setNewSalle({...newSalle, type_salle: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEDECIN">Salle Médecin</SelectItem>
                      <SelectItem value="ASSISTANT">Salle Assistant</SelectItem>
                      <SelectItem value="ATTENTE">Salle d'Attente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Position X</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={newSalle.position_x}
                      onChange={(e) => setNewSalle({...newSalle, position_x: parseInt(e.target.value)})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Position Y</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={newSalle.position_y}
                      onChange={(e) => setNewSalle({...newSalle, position_y: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Couleur</Label>
                  <Input
                    type="color"
                    value={newSalle.couleur}
                    onChange={(e) => setNewSalle({...newSalle, couleur: e.target.value})}
                    className="h-12"
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowSalleModal(false);
                      setEditingSalle(null);
                      resetSalleForm();
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">
                    {editingSalle ? 'Modifier' : 'Créer'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Configuration Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configuration du Cabinet</DialogTitle>
          </DialogHeader>
          
          {configuration && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre maximum de médecins par jour</Label>
                <Input
                  type="number"
                  min="1"
                  value={configuration.max_medecins_par_jour}
                  onChange={(e) => setConfiguration({
                    ...configuration,
                    max_medecins_par_jour: parseInt(e.target.value)
                  })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Nombre maximum d'assistants par jour</Label>
                <Input
                  type="number"
                  min="1"
                  value={configuration.max_assistants_par_jour}
                  onChange={(e) => setConfiguration({
                    ...configuration,
                    max_assistants_par_jour: parseInt(e.target.value)
                  })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matin début</Label>
                  <Input
                    type="time"
                    value={configuration.heures_ouverture_matin_debut}
                    onChange={(e) => setConfiguration({
                      ...configuration,
                      heures_ouverture_matin_debut: e.target.value
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Matin fin</Label>
                  <Input
                    type="time"
                    value={configuration.heures_ouverture_matin_fin}
                    onChange={(e) => setConfiguration({
                      ...configuration,
                      heures_ouverture_matin_fin: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Après-midi début</Label>
                  <Input
                    type="time"
                    value={configuration.heures_ouverture_apres_midi_debut}
                    onChange={(e) => setConfiguration({
                      ...configuration,
                      heures_ouverture_apres_midi_debut: e.target.value
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Après-midi fin</Label>
                  <Input
                    type="time"
                    value={configuration.heures_ouverture_apres_midi_fin}
                    onChange={(e) => setConfiguration({
                      ...configuration,
                      heures_ouverture_apres_midi_fin: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfigModal(false)}
                >
                  Annuler
                </Button>
                <Button onClick={() => updateConfiguration(configuration)}>
                  Sauvegarder
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Liste des salles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {salles.map(salle => (
          <Card key={salle.id} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: salle.couleur }}
                    ></div>
                    <h3 className="font-medium">{salle.nom}</h3>
                  </div>
                  
                  <Badge className={getTypeColor(salle.type_salle)}>
                    {salle.type_salle}
                  </Badge>
                  
                  <div className="text-sm text-gray-600">
                    Position: X:{salle.position_x}, Y:{salle.position_y}
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditSalle(salle)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSalle(salle.id, salle.nom)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {salles.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">Aucune salle configurée</p>
              <Button onClick={initialiserCabinet} variant="outline">
                Initialiser le Cabinet avec des Salles par Défaut
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Modal de confirmation de suppression */}
      <Dialog open={deleteSalleConfirm.show} onOpenChange={cancelDeleteSalle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {deleteSalleConfirm.name} ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={cancelDeleteSalle}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSalle}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Planning Component
const PlanningManager = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [planning, setPlanning] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('jour');
  const [filterRole, setFilterRole] = useState(['Médecin', 'Assistant', 'Secrétaire']); // Tous sélectionnés par défaut
  const [users, setUsers] = useState([]);
  const [salles, setSalles] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [congesApprouves, setCongesApprouves] = useState([]);
  const [planningSemaine, setPlanningSemaine] = useState(null);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [showEditCreneauModal, setShowEditCreneauModal] = useState(false);
  const [showAttributionModal, setShowAttributionModal] = useState(false);
  const [showSemaineTypeModal, setShowSemaineTypeModal] = useState(false);
  const [semainesTypes, setSemainesTypes] = useState([]);
  const [selectedSemaineType, setSelectedSemaineType] = useState(null);
  const [dateDebutSemaine, setDateDebutSemaine] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingCreneau, setEditingCreneau] = useState(null);
  const [newCreneau, setNewCreneau] = useState({
    date: new Date().toISOString().split('T')[0],
    creneau: 'MATIN',
    employe_id: '',
    salle_attribuee: '',
    salle_attente: '',
    horaire_debut: '',
    horaire_fin: '',
    notes: '',
    medecin_ids: []
  });
  const [attribution, setAttribution] = useState({
    employe_id: '',
    salle_attribuee: '',
    medecin_ids: [],
    notes: ''
  });

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    if (viewMode === 'semaine') {
      setSelectedWeek(today);
    } else {
      setSelectedDate(today);
    }
  };

  const handleRoleToggle = (role) => {
    setFilterRole(prev => {
      if (prev.includes(role)) {
        // Si déjà sélectionné, on le retire (sauf si c'est le dernier)
        const newFilter = prev.filter(r => r !== role);
        return newFilter.length > 0 ? newFilter : prev; // Garder au moins un rôle
      } else {
        // Si pas sélectionné, on l'ajoute
        return [...prev, role];
      }
    });
  };

  const selectAllRoles = () => {
    setFilterRole(['Médecin', 'Assistant', 'Secrétaire']);
  };

  const deselectAllRoles = () => {
    setFilterRole([]);
  };

  const navigateWeek = (direction) => {
    const currentDate = new Date(viewMode === 'semaine' ? selectedWeek : selectedDate);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7));
    const newDateStr = newDate.toISOString().split('T')[0];
    
    if (viewMode === 'semaine') {
      setSelectedWeek(newDateStr);
    } else {
      setSelectedDate(newDateStr);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (viewMode === 'jour') {
      fetchPlanningByDate(selectedDate);
    } else if (viewMode === 'semaine') {
      fetchPlanningSemaine(selectedWeek);
    }
  }, [selectedDate, selectedWeek, viewMode, user?.role]);

  const getMondayOfWeek = (date) => {
    const selectedDate = new Date(date);
    const day = selectedDate.getDay();
    const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(selectedDate.setDate(diff));
  };

  const getWeekDates = (mondayDate) => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayDate);
      date.setDate(mondayDate.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const fetchPlanningSemaine = async (date) => {
    try {
      const mondayDate = getMondayOfWeek(date);
      const mondayStr = mondayDate.toISOString().split('T')[0];
      
      if (user?.role === 'Directeur') {
        // Vue globale pour le directeur
        const [usersRes, sallesRes, planningRes] = await Promise.all([
          axios.get(`${API}/users`),
          axios.get(`${API}/salles`),
          axios.get(`${API}/planning/semaine/${mondayStr}`)
        ]);
        
        setUsers(usersRes.data.filter(u => u.actif));
        setSalles(sallesRes.data);
        setPlanningSemaine(planningRes.data);
      } else {
        // Vue personnelle pour les employés
        const response = await axios.get(`${API}/planning/semaine/${mondayStr}`);
        const personalPlanning = response.data;
        personalPlanning.planning = Object.fromEntries(
          Object.entries(personalPlanning.planning).map(([date, slots]) => [
            date,
            {
              MATIN: slots.MATIN?.filter(slot => slot.employe_id === user.id) || [],
              APRES_MIDI: slots.APRES_MIDI?.filter(slot => slot.employe_id === user.id) || []
            }
          ])
        );
        setPlanningSemaine(personalPlanning);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du planning semaine:', error);
      toast.error('Erreur lors du chargement du planning');
    }
  };

  const fetchData = async () => {
    try {
      if (user?.role === 'Directeur') {
        // Directeur voit tous les utilisateurs
        const [usersRes, medecinRes, assistantRes, sallesRes, semainesTypesRes] = await Promise.all([
          axios.get(`${API}/users`),
          axios.get(`${API}/users/by-role/Médecin`),
          axios.get(`${API}/users/by-role/Assistant`),
          axios.get(`${API}/salles`),
          axios.get(`${API}/semaines-types`)
        ]);
        
        setUsers(usersRes.data);
        setMedecins(medecinRes.data);
        setAssistants(assistantRes.data);
        setSalles(sallesRes.data);
        setSemainesTypes(semainesTypesRes.data);
      } else {
        // Les autres ne voient que les données pertinentes
        setUsers([user]); // Seulement eux-mêmes dans la liste
        
        if (user?.role === 'Assistant') {
          // Assistant voit les médecins avec qui il travaille
          const assignationsRes = await axios.get(`${API}/assignations`);
          const myAssignations = assignationsRes.data.filter(a => a.assistant_id === user.id);
          const medecinIds = myAssignations.map(a => a.medecin_id);
          
          const medecinRes = await axios.get(`${API}/users/by-role/Médecin`);
          const myMedecins = medecinRes.data.filter(m => medecinIds.includes(m.id));
          setMedecins(myMedecins);
          setAssistants([user]); // Seulement lui-même
        } else {
          setMedecins(user?.role === 'Médecin' ? [user] : []);
          setAssistants([]);
        }
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanningByDate = async (date) => {
    try {
      const [planningRes, congesRes] = await Promise.all([
        axios.get(`${API}/planning/${date}`),
        axios.get(`${API}/conges`)
      ]);
      
      let planningData = planningRes.data;
      let congesData = congesRes.data;
      
      // Filtrer selon les permissions
      if (user?.role !== 'Directeur') {
        // Les non-directeurs voient seulement leur propre planning
        planningData = planningData.filter(p => p.employe_id === user.id);
        congesData = congesData.filter(c => c.utilisateur_id === user.id);
      }
      
      setPlanning(planningData);
      
      // Filtrer les congés approuvés pour la date sélectionnée
      const congesDate = congesData.filter(conge => 
        conge.statut === 'APPROUVE' &&
        new Date(conge.date_debut) <= new Date(date) &&
        new Date(conge.date_fin) >= new Date(date)
      );
      setCongesApprouves(congesDate);
      
    } catch (error) {
      console.error('Erreur lors du chargement du planning:', error);
    }
  };
  // Fonctions pour l'attribution (Directeur uniquement)
  const handleSlotClick = (date, period) => {
    if (user?.role !== 'Directeur') return;
    
    setSelectedSlot({ date, period });
    setAttribution({
      employe_id: '',
      salle_attribuee: '',
      medecin_ids: [],
      notes: ''
    });
    setShowAttributionModal(true);
  };

  const handleCreateAttribution = async (e) => {
    e.preventDefault();
    
    if (!attribution.employe_id || !selectedSlot) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }

    try {
      const creneauData = {
        date: selectedSlot.date,
        creneau: selectedSlot.period,
        employe_id: attribution.employe_id,
        salle_attribuee: attribution.salle_attribuee,
        notes: attribution.notes
      };

      await axios.post(`${API}/planning`, creneauData);
      toast.success('Attribution créée avec succès');
      setShowAttributionModal(false);
      fetchPlanningSemaine(selectedWeek);
    } catch (error) {
      toast.error('Erreur lors de la création de l\'attribution');
    }
  };

  const resetAttributionForm = () => {
    setAttribution({
      employe_id: '',
      salle_attribuee: '',
      medecin_ids: [],
      notes: ''
    });
    setSelectedSlot(null);
  };

  const handleCreateCreneau = async (e) => {
    e.preventDefault();
    
    if (!newCreneau.employe_id || !newCreneau.date || !newCreneau.creneau) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    try {
      await axios.post(`${API}/planning`, newCreneau);
      toast.success('Créneau créé avec succès');
      setShowPlanningModal(false);
      resetForm();
      fetchPlanningByDate(selectedDate);
    } catch (error) {
      toast.error('Erreur lors de la création du créneau');
    }
  };

  const handleEditCreneau = (creneau) => {
    setEditingCreneau(creneau);
    setNewCreneau({
      date: creneau.date,
      creneau: creneau.creneau,
      employe_id: creneau.employe_id,
      salle_attribuee: creneau.salle_attribuee || '',
      salle_attente: creneau.salle_attente || '',
      horaire_debut: creneau.horaire_debut || '',
      horaire_fin: creneau.horaire_fin || '',
      notes: creneau.notes || '',
      medecin_ids: creneau.medecin_ids || []
    });
    setShowEditCreneauModal(true);
  };

  const handleUpdateCreneau = async (e) => {
    e.preventDefault();
    
    if (!newCreneau.employe_id) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }

    try {
      await axios.put(`${API}/planning/${editingCreneau.id}`, newCreneau);
      toast.success('Créneau modifié avec succès');
      setShowEditCreneauModal(false);
      setEditingCreneau(null);
      resetForm();
      if (viewMode === 'semaine') {
        fetchPlanningSemaine(selectedWeek);
      } else {
        fetchPlanningByDate(selectedDate);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification du créneau');
    }
  };

  const handleDeleteCreneau = async (creneauId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) return;
    
    try {
      await axios.delete(`${API}/planning/${creneauId}`);
      toast.success('Créneau supprimé');
      if (viewMode === 'semaine') {
        fetchPlanningSemaine(selectedWeek);
      } else {
        fetchPlanningByDate(selectedDate);
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setNewCreneau({
      date: selectedDate,
      creneau: 'MATIN',
      employe_id: '',
      medecin_attribue_id: '',
      salle_attribuee: '',
      salle_attente: '',
      horaire_debut: '',
      horaire_fin: '',
      notes: '',
      medecin_ids: []
    });
  };

  const getEmployeInfo = (employe) => {
    if (!employe) return null;
    return `${employe.prenom} ${employe.nom} (${employe.role})`;
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Médecin': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Assistant': return 'bg-green-100 text-green-800 border-green-300';
      case 'Secrétaire': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const generateNotifications = async () => {
    try {
      await axios.post(`${API}/notifications/generate/${selectedDate}`);
      toast.success('Notifications générées pour tous les employés');
    } catch (error) {
      toast.error('Erreur lors de la génération des notifications');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  // Filtrer le planning selon les rôles sélectionnés (multi-sélection)
  const filteredPlanning = filterRole.length === 0
    ? []
    : planning.filter(c => filterRole.includes(c.employe_role));
  
  const planningMatin = filteredPlanning.filter(c => c.creneau === 'MATIN');
  const planningApresMidi = filteredPlanning.filter(c => c.creneau === 'APRES_MIDI');
  const planningJournee = filteredPlanning.filter(c => c.creneau === 'JOURNEE');

  // Créer des groupes par rôle pour l'affichage en colonnes
  const getRoleGroups = (planningData) => {
    const roles = filterRole === 'TOUS' 
      ? ['Médecin', 'Assistant', 'Secrétaire']
      : [filterRole];
    
    return roles.map(role => ({
      role,
      creneaux: planningData.filter(c => c.employe_role === role)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Planning Interactif</h2>
          <p className="text-gray-600 mt-1">Gérez les horaires et affectations du personnel</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Mode d'affichage - Disponible pour tous */}
          <div className="flex space-x-2">
            <Button
              variant={viewMode === 'jour' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('jour')}
            >
              Vue Jour
            </Button>
            <Button
              variant={viewMode === 'semaine' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('semaine')}
            >
              Vue Semaine
            </Button>
          </div>
          
          {/* Filtre par rôle - Sélection multiple pour le directeur */}
          {user?.role === 'Directeur' && (
            <div className="flex space-x-2">
              <Button
                variant={filterRole === 'TOUS' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterRole('TOUS')}
              >
                Tous
              </Button>
              <Button
                variant={filterRole === 'Médecin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterRole('Médecin')}
              >
                Médecins
              </Button>
              <Button
                variant={filterRole === 'Assistant' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterRole('Assistant')}
              >
                Assistants
              </Button>
              <Button
                variant={filterRole === 'Secrétaire' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterRole('Secrétaire')}
              >
                Secrétaires
              </Button>
            </div>
          )}
          
          {/* Navigation et sélecteur de date */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
              className="px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={viewMode === 'semaine' ? selectedWeek : selectedDate}
              onChange={(e) => viewMode === 'semaine' ? setSelectedWeek(e.target.value) : setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
              className="px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Aujourd'hui
            </Button>
          </div>
          
          {user?.role === 'Directeur' && (
            <div>
              <Button
                onClick={generateNotifications}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Send className="h-4 w-4" />
                <span>Générer Notifications</span>
              </Button>
              
              <Button
                onClick={() => setShowSemaineTypeModal(true)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Calendar className="h-4 w-4" />
                <span>Appliquer Semaine Type</span>
              </Button>
              
              <Dialog open={showPlanningModal} onOpenChange={setShowPlanningModal}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Nouveau Créneau</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nouveau Créneau Planning</DialogTitle>
                    <DialogDescription>
                      Définissez un nouveau créneau de travail pour un employé
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleCreateCreneau} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input
                          type="date"
                          value={newCreneau.date}
                          onChange={(e) => setNewCreneau({...newCreneau, date: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Créneau *</Label>
                        <Select
                          value={newCreneau.creneau}
                          onValueChange={(value) => setNewCreneau({...newCreneau, creneau: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MATIN">Matin</SelectItem>
                            <SelectItem value="APRES_MIDI">Après-midi</SelectItem>
                            <SelectItem value="JOURNEE">Journée complète</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Employé *</Label>
                      <Select
                        value={newCreneau.employe_id}
                        onValueChange={(value) => {
                          const employe = users.find(u => u.id === value);
                          setNewCreneau({
                            ...newCreneau, 
                            employe_id: value,
                            // Reset fields when changing employee
                            medecin_attribue_id: '',
                            medecin_ids: [],
                            salle_attribuee: '',
                            salle_attente: '',
                            horaire_debut: employe?.role === 'Secrétaire' ? '08:00' : '',
                            horaire_fin: employe?.role === 'Secrétaire' ? '17:00' : ''
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un employé" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map(employe => (
                            <SelectItem key={employe.id} value={employe.id}>
                              {employe.prenom} {employe.nom} ({employe.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Médecins attribués (pour assistants) - Sélection multiple */}
                    {users.find(u => u.id === newCreneau.employe_id)?.role === 'Assistant' && (
                      <div className="space-y-2">
                        <Label>Médecins attribués (plusieurs possibles)</Label>
                        <div className="border rounded p-3 space-y-2">
                          {medecins.map(medecin => (
                            <div key={medecin.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`medecin-${medecin.id}`}
                                checked={newCreneau.medecin_ids.includes(medecin.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewCreneau({
                                      ...newCreneau,
                                      medecin_ids: [...newCreneau.medecin_ids, medecin.id]
                                    });
                                  } else {
                                    setNewCreneau({
                                      ...newCreneau,
                                      medecin_ids: newCreneau.medecin_ids.filter(id => id !== medecin.id)
                                    });
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <label htmlFor={`medecin-${medecin.id}`} className="cursor-pointer">
                                Dr. {medecin.prenom} {medecin.nom}
                              </label>
                            </div>
                          ))}
                          {medecins.length === 0 && (
                            <p className="text-sm text-gray-500">Aucun médecin disponible</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Salle de travail</Label>
                        <Select
                          value={newCreneau.salle_attribuee}
                          onValueChange={(value) => setNewCreneau({...newCreneau, salle_attribuee: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez une salle" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Postes pour secrétaires */}
                            {users.find(u => u.id === newCreneau.employe_id)?.role === 'Secrétaire' && (
                              <>
                                {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(poste => (
                                  <SelectItem key={poste} value={poste}>
                                    Poste {poste}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            
                            {/* Salles pour assistants - depuis la gestion des salles (type ASSISTANT) */}
                            {users.find(u => u.id === newCreneau.employe_id)?.role === 'Assistant' && (
                              <>
                                {salles.filter(s => s.type_salle === 'ASSISTANT').map(salle => (
                                  <SelectItem key={salle.id} value={salle.nom}>
                                    {salle.nom}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            
                            {/* Salles pour médecins - depuis la gestion des salles (type MEDECIN) */}
                            {users.find(u => u.id === newCreneau.employe_id)?.role === 'Médecin' && (
                              <>
                                {salles.filter(s => s.type_salle === 'MEDECIN').map(salle => (
                                  <SelectItem key={salle.id} value={salle.nom}>
                                    {salle.nom}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Salle d'attente - cachée pour secrétaires et assistants */}
                      {users.find(u => u.id === newCreneau.employe_id)?.role === 'Médecin' && (
                        <div className="space-y-2">
                          <Label>Salle d'attente</Label>
                          <Select
                            value={newCreneau.salle_attente}
                            onValueChange={(value) => setNewCreneau({...newCreneau, salle_attente: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionnez une salle d'attente" />
                            </SelectTrigger>
                            <SelectContent>
                              {salles.filter(s => s.type_salle === 'ATTENTE').map(salle => (
                                <SelectItem key={salle.id} value={salle.nom}>
                                  {salle.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    
                    {/* Horaires pour secrétaires */}
                    {users.find(u => u.id === newCreneau.employe_id)?.role === 'Secrétaire' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Heure de début</Label>
                          <Input
                            type="time"
                            value={newCreneau.horaire_debut}
                            onChange={(e) => setNewCreneau({...newCreneau, horaire_debut: e.target.value})}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Heure de fin</Label>
                          <Input
                            type="time"
                            value={newCreneau.horaire_fin}
                            onChange={(e) => setNewCreneau({...newCreneau, horaire_fin: e.target.value})}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        placeholder="Notes additionnelles..."
                        value={newCreneau.notes}
                        onChange={(e) => setNewCreneau({...newCreneau, notes: e.target.value})}
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowPlanningModal(false)}
                      >
                        Annuler
                      </Button>
                      <Button type="submit">
                        Créer le créneau
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

      {/* Modal de modification de créneau */}
      {user?.role === 'Directeur' && editingCreneau && (
        <Dialog open={showEditCreneauModal} onOpenChange={setShowEditCreneauModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le Créneau</DialogTitle>
              <DialogDescription>
                Créneau de {editingCreneau.date} - {editingCreneau.creneau}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateCreneau} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={newCreneau.date} disabled className="bg-gray-100" />
              </div>

              <div className="space-y-2">
                <Label>Créneau</Label>
                <Input value={newCreneau.creneau} disabled className="bg-gray-100" />
              </div>

              <div className="space-y-2">
                <Label>Salle de travail</Label>
                <Select
                  value={newCreneau.salle_attribuee}
                  onValueChange={(value) => setNewCreneau({...newCreneau, salle_attribuee: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une salle" />
                  </SelectTrigger>
                  <SelectContent>
                    {editingCreneau.employe_role === 'Secrétaire' && (
                      <>
                        {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(poste => (
                          <SelectItem key={poste} value={poste}>
                            Poste {poste}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {editingCreneau.employe_role === 'Assistant' && salles.filter(s => s.type_salle === 'ASSISTANT').map(salle => (
                      <SelectItem key={salle.id} value={salle.nom}>
                        {salle.nom}
                      </SelectItem>
                    ))}
                    {editingCreneau.employe_role === 'Médecin' && salles.filter(s => s.type_salle === 'MEDECIN').map(salle => (
                      <SelectItem key={salle.id} value={salle.nom}>
                        {salle.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingCreneau.employe_role === 'Médecin' && (
                <div className="space-y-2">
                  <Label>Salle d'attente</Label>
                  <Select
                    value={newCreneau.salle_attente}
                    onValueChange={(value) => setNewCreneau({...newCreneau, salle_attente: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une salle d'attente" />
                    </SelectTrigger>
                    <SelectContent>
                      {salles.filter(s => s.type_salle === 'ATTENTE').map(salle => (
                        <SelectItem key={salle.id} value={salle.nom}>
                          {salle.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editingCreneau.employe_role === 'Assistant' && (
                <div className="space-y-2">
                  <Label>Médecins attribués</Label>
                  <div className="border rounded p-3 space-y-2 max-h-40 overflow-y-auto">
                    {medecins.map(medecin => (
                      <div key={medecin.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={newCreneau.medecin_ids.includes(medecin.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewCreneau({...newCreneau, medecin_ids: [...newCreneau.medecin_ids, medecin.id]});
                            } else {
                              setNewCreneau({...newCreneau, medecin_ids: newCreneau.medecin_ids.filter(id => id !== medecin.id)});
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <label>Dr. {medecin.prenom} {medecin.nom}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editingCreneau.employe_role === 'Secrétaire' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Horaire début</Label>
                    <Input
                      type="time"
                      value={newCreneau.horaire_debut}
                      onChange={(e) => setNewCreneau({...newCreneau, horaire_debut: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horaire fin</Label>
                    <Input
                      type="time"
                      value={newCreneau.horaire_fin}
                      onChange={(e) => setNewCreneau({...newCreneau, horaire_fin: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={newCreneau.notes}
                  onChange={(e) => setNewCreneau({...newCreneau, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditCreneauModal(false);
                    setEditingCreneau(null);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Modal d'attribution pour le Directeur */}
      {user?.role === 'Directeur' && (
        <Dialog open={showAttributionModal} onOpenChange={setShowAttributionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Attribuer un créneau - {selectedSlot?.date} {selectedSlot?.period === 'MATIN' ? 'Matin' : 'Après-midi'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateAttribution} className="space-y-4">
              <div className="space-y-2">
                <Label>Employé *</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={attribution.employe_id}
                  onChange={(e) => setAttribution({...attribution, employe_id: e.target.value})}
                  required
                >
                  <option value="">Sélectionner un employé</option>
                  {users.filter(u => filterRole.includes('TOUS') || filterRole.includes(u.role)).map(employe => (
                    <option key={employe.id} value={employe.id}>
                      {employe.prenom} {employe.nom} ({employe.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Salle</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={attribution.salle_attribuee}
                  onChange={(e) => setAttribution({...attribution, salle_attribuee: e.target.value})}
                >
                  <option value="">Aucune salle</option>
                  {salles.map(salle => (
                    <option key={salle.id} value={salle.nom}>
                      {salle.nom} ({salle.type_salle})
                    </option>
                  ))}
                </select>
              </div>
              {/* Liaison médecin-assistant */}
              <div className="space-y-2">
                <Label>Liaison médecin-assistant (optionnel)</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={attribution.medecin_ids[0] || ''}
                  onChange={(e) => {
                    const selectedEmploye = users.find(u => u.id === attribution.employe_id);
                    if (e.target.value && selectedEmploye) {
                      if (selectedEmploye.role === 'Médecin') {
                        // Si l'employé est un médecin, sélectionner les assistants
                        setAttribution({...attribution, medecin_ids: e.target.value ? [e.target.value] : []});
                      } else if (selectedEmploye.role === 'Assistant') {
                        // Si l'employé est un assistant, sélectionner le médecin
                        setAttribution({...attribution, medecin_ids: e.target.value ? [e.target.value] : []});
                      }
                    }
                  }}
                >
                  <option value="">Aucune liaison</option>
                  {(() => {
                    const selectedEmploye = users.find(u => u.id === attribution.employe_id);
                    if (!selectedEmploye) return null;
                    
                    if (selectedEmploye.role === 'Médecin') {
                      // Si médecin sélectionné, proposer les assistants
                      return users.filter(u => u.role === 'Assistant').map(assistant => (
                        <option key={assistant.id} value={assistant.id}>
                          {assistant.prenom} {assistant.nom} (Assistant)
                        </option>
                      ));
                    } else if (selectedEmploye.role === 'Assistant') {
                      // Si assistant sélectionné, proposer les médecins
                      return users.filter(u => u.role === 'Médecin').map(medecin => (
                        <option key={medecin.id} value={medecin.id}>
                          Dr. {medecin.prenom} {medecin.nom} (Médecin)
                        </option>
                      ));
                    }
                    return null;
                  })()}
                </select>
                {(() => {
                  const selectedEmploye = users.find(u => u.id === attribution.employe_id);
                  if (!selectedEmploye) return null;
                  
                  const helperText = selectedEmploye.role === 'Médecin' 
                    ? "Sélectionnez un assistant à associer à ce médecin"
                    : selectedEmploye.role === 'Assistant' 
                    ? "Sélectionnez un médecin à associer à cet assistant"
                    : null;
                    
                  return helperText && (
                    <div className="text-xs text-gray-500">{helperText}</div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Notes additionnelles..."
                  value={attribution.notes}
                  onChange={(e) => setAttribution({...attribution, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAttributionModal(false);
                    resetAttributionForm();
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Attribuer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Appliquer Semaine Type */}
      {user?.role === 'Directeur' && (
        <Dialog open={showSemaineTypeModal} onOpenChange={setShowSemaineTypeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Appliquer une Semaine Type</DialogTitle>
              <DialogDescription>
                Sélectionnez une semaine type et une date de début pour générer automatiquement les créneaux
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employé *</Label>
                <Select
                  value={newCreneau.employe_id}
                  onValueChange={(value) => setNewCreneau({...newCreneau, employe_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un employé" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(employe => (
                      <SelectItem key={employe.id} value={employe.id}>
                        {employe.prenom} {employe.nom} ({employe.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Semaine Type *</Label>
                <Select
                  value={selectedSemaineType}
                  onValueChange={setSelectedSemaineType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une semaine type" />
                  </SelectTrigger>
                  <SelectContent>
                    {semainesTypes.map(semaine => (
                      <SelectItem key={semaine.id} value={semaine.id}>
                        {semaine.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date de début de semaine (Lundi) *</Label>
                <Input
                  type="date"
                  value={dateDebutSemaine}
                  onChange={(e) => setDateDebutSemaine(e.target.value)}
                />
              </div>

              {selectedSemaineType && (
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm font-medium mb-2">Aperçu de la semaine :</p>
                  {(() => {
                    const semaine = semainesTypes.find(s => s.id === selectedSemaineType);
                    if (!semaine) return null;
                    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
                    return (
                      <div className="space-y-1 text-sm">
                        {jours.map(jour => {
                          const creneau = semaine[jour];
                          return creneau && creneau !== 'REPOS' ? (
                            <div key={jour} className="flex justify-between">
                              <span className="capitalize">{jour}</span>
                              <span className="font-medium">{creneau}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowSemaineTypeModal(false);
                    setSelectedSemaineType(null);
                    setDateDebutSemaine('');
                  }}
                >
                  Annuler
                </Button>
                <Button
                  onClick={async () => {
                    if (!newCreneau.employe_id || !selectedSemaineType || !dateDebutSemaine) {
                      toast.error('Veuillez remplir tous les champs');
                      return;
                    }

                    try {
                      const semaine = semainesTypes.find(s => s.id === selectedSemaineType);
                      const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
                      const dateDebut = new Date(dateDebutSemaine);

                      for (let i = 0; i < jours.length; i++) {
                        const creneau = semaine[jours[i]];
                        if (creneau && creneau !== 'REPOS') {
                          const dateJour = new Date(dateDebut);
                          dateJour.setDate(dateDebut.getDate() + i);
                          const dateStr = dateJour.toISOString().split('T')[0];

                          await axios.post(`${API}/planning`, {
                            date: dateStr,
                            creneau: creneau,
                            employe_id: newCreneau.employe_id,
                            salle_attribuee: '',
                            salle_attente: '',
                            horaire_debut: '',
                            horaire_fin: '',
                            notes: `Semaine type: ${semaine.nom}`,
                            medecin_ids: []
                          });
                        }
                      }

                      toast.success('Semaine type appliquée avec succès');
                      setShowSemaineTypeModal(false);
                      setSelectedSemaineType(null);
                      setDateDebutSemaine('');
                      fetchPlanningByDate(selectedDate);
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Erreur lors de l\'application de la semaine type');
                    }
                  }}
                >
                  Appliquer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </div>

        {/* Vue Jour - Planning Matin */}
        {viewMode !== 'semaine' && (
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
            <CardTitle className="flex items-center space-x-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <span>Matin</span>
              <Badge variant="secondary" className="ml-2">
                {planningMatin.length} créneaux
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {planningMatin.map(creneau => (
                <div
                  key={creneau.id}
                  className={`border rounded-lg p-3 ${getRoleColor(creneau.employe_role)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {creneau.employe?.prenom} {creneau.employe?.nom} ({creneau.employe?.role})
                      </div>
                      
                      {creneau.salle_attribuee && (
                        <div className="text-sm text-gray-600">
                          📍 Salle: {creneau.salle_attribuee}
                        </div>
                      )}
                      
                      {creneau.notes && (
                        <div className="text-sm text-gray-600 italic">
                          📝 {creneau.notes}
                        </div>
                      )}
                    </div>
                    
                    {user?.role === 'Directeur' && (
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditCreneau(creneau)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCreneau(creneau.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {planningMatin.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDays className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Aucun créneau programmé le matin</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Vue Jour - Planning Après-midi */}
        {viewMode !== 'semaine' && (
        <Card>
          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100">
            <CardTitle className="flex items-center space-x-2">
              <CalendarDays className="h-5 w-5 text-orange-600" />
              <span>Après-midi</span>
              <Badge variant="secondary" className="ml-2">
                {planningApresMidi.length} créneaux
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {planningApresMidi.map(creneau => (
                <div
                  key={creneau.id}
                  className={`border rounded-lg p-3 ${getRoleColor(creneau.employe_role)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {creneau.employe?.prenom} {creneau.employe?.nom} ({creneau.employe?.role})
                      </div>
                      
                      {creneau.salle_attribuee && (
                        <div className="text-sm text-gray-600">
                          📍 Salle: {creneau.salle_attribuee}
                        </div>
                      )}
                      
                      {creneau.notes && (
                        <div className="text-sm text-gray-600 italic">
                          📝 {creneau.notes}
                        </div>
                      )}
                    </div>
                    
                    {user?.role === 'Directeur' && (
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditCreneau(creneau)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCreneau(creneau.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {planningApresMidi.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDays className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Aucun créneau programmé l'après-midi</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Vue Jour - Planning Journée complète */}
        {viewMode !== 'semaine' && planningJournee.length > 0 && (
          <Card>
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100">
              <CardTitle className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5 text-green-600" />
                <span>Journée complète</span>
                <Badge variant="secondary" className="ml-2">
                  {planningJournee.length} créneaux
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {planningJournee.map(creneau => (
                  <div
                    key={creneau.id}
                    className={`border rounded-lg p-3 ${getRoleColor(creneau.employe_role)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {creneau.employe?.prenom} {creneau.employe?.nom} ({creneau.employe?.role})
                        </div>
                        
                        {creneau.salle_attribuee && (
                          <div className="text-sm text-gray-600">
                            📍 Salle: {creneau.salle_attribuee}
                          </div>
                        )}
                        
                        {creneau.notes && (
                          <div className="text-sm text-gray-600 italic">
                            📝 {creneau.notes}
                          </div>
                        )}
                      </div>
                      
                      {user?.role === 'Directeur' && (
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditCreneau(creneau)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCreneau(creneau.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {planningJournee.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDays className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>Aucun créneau programmé pour la journée complète</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vue Semaine */}
        {viewMode === 'semaine' && planningSemaine && (
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>Planning de la Semaine</span>
                <div className="flex space-x-2">
                  <Button
                    variant={filterRole === 'TOUS' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRole('TOUS')}
                  >
                    Tous
                  </Button>
                  <Button
                    variant={filterRole === 'Médecin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRole('Médecin')}
                  >
                    Médecins
                  </Button>
                  <Button
                    variant={filterRole === 'Assistant' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRole('Assistant')}
                  >
                    Assistants
                  </Button>
                  <Button
                    variant={filterRole === 'Secrétaire' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRole('Secrétaire')}
                  >
                    Secrétaires
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentDate = new Date(selectedWeek);
                    currentDate.setDate(currentDate.getDate() - 7);
                    setSelectedWeek(currentDate.toISOString().split('T')[0]);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  {new Date(planningSemaine.dates[0]).toLocaleDateString('fr-FR')} - {new Date(planningSemaine.dates[6]).toLocaleDateString('fr-FR')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentDate = new Date(selectedWeek);
                    currentDate.setDate(currentDate.getDate() + 7);
                    setSelectedWeek(currentDate.toISOString().split('T')[0]);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {/* Headers jours */}
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour, index) => (
                <div key={jour} className="p-3 bg-gray-50 rounded-lg text-center font-medium">
                  <div className="text-sm text-gray-600">{jour}</div>
                  <div className="text-lg">
                    {new Date(planningSemaine.dates[index]).getDate()}
                  </div>
                </div>
              ))}
              
              {/* Créneaux par jour avec filtrage */}
              {planningSemaine.dates.map(date => {
                // Filtrer les créneaux selon le rôle sélectionné
                const planningMatinFiltered = filterRole === 'TOUS' 
                  ? planningSemaine.planning[date]?.MATIN || []
                  : (planningSemaine.planning[date]?.MATIN || []).filter(c => c.employe_role === filterRole);
                
                const planningApresMidiFiltered = filterRole === 'TOUS'
                  ? planningSemaine.planning[date]?.APRES_MIDI || []
                  : (planningSemaine.planning[date]?.APRES_MIDI || []).filter(c => c.employe_role === filterRole);
                
                return (
                  <div key={date} className="space-y-2">
                    {/* Matin */}
                    <div className="bg-blue-50 rounded-lg p-2 min-h-[100px]">
                      <div className="text-xs font-medium text-blue-700 mb-2">
                        Matin ({planningMatinFiltered.length})
                      </div>
                      <div className="space-y-1">
                        {planningMatinFiltered.map(creneau => (
                          <div
                            key={creneau.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (user?.role === 'Directeur') {
                                handleEditCreneau(creneau);
                              }
                            }}
                            className={`text-xs p-1 rounded border ${getRoleColor(creneau.employe_role)} ${user?.role === 'Directeur' ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                          >
                            <div className="font-medium truncate">
                              {creneau.employe?.prenom?.[0]}.{creneau.employe?.nom}
                            </div>
                            {creneau.salle_attribuee && (
                              <div className="text-xs opacity-75">
                                {creneau.salle_attribuee}
                              </div>
                            )}
                            {user?.role === 'Directeur' && (
                              <div className="text-[10px] text-blue-600 mt-1">
                                ✏️ Cliquer pour modifier
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Après-midi */}
                    <div className="bg-orange-50 rounded-lg p-2 min-h-[100px]">
                      <div className="text-xs font-medium text-orange-700 mb-2">
                        Après-midi ({planningApresMidiFiltered.length})
                      </div>
                      <div className="space-y-1">
                        {planningApresMidiFiltered.map(creneau => (
                          <div
                            key={creneau.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (user?.role === 'Directeur') {
                                handleEditCreneau(creneau);
                              }
                            }}
                            className={`text-xs p-1 rounded border ${getRoleColor(creneau.employe_role)} ${user?.role === 'Directeur' ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                          >
                            <div className="font-medium truncate">
                              {creneau.employe?.prenom?.[0]}.{creneau.employe?.nom}
                            </div>
                            {creneau.salle_attribuee && (
                              <div className="text-xs opacity-75">
                                {creneau.salle_attribuee}
                              </div>
                            )}
                            {user?.role === 'Directeur' && (
                              <div className="text-[10px] text-blue-600 mt-1">
                                ✏️ Cliquer pour modifier
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Demandes de Travail Component
const DemandesTravailManager = () => {
  const [demandes, setDemandes] = useState([]);
  const [semainesTypes, setSemainesTypes] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [medecinSelectionne, setMedecinSelectionne] = useState('');
  const [showDemandeModal, setShowDemandeModal] = useState(false);
  const [showSemaineTypeModal, setShowSemaineTypeModal] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [typedemande, setTypeDemande] = useState('individuelle'); // 'individuelle' ou 'semaine'
  const [newDemande, setNewDemande] = useState({
    date_demandee: '',
    creneau: 'MATIN',
    motif: '',
    semaine_type_id: '',
    date_debut_semaine: ''
  });
  const [newSemaineType, setNewSemaineType] = useState({
    nom: '',
    description: '',
    lundi: 'REPOS',
    mardi: 'REPOS',
    mercredi: 'REPOS',
    jeudi: 'REPOS',
    vendredi: 'REPOS',
    samedi: 'REPOS',
    dimanche: 'REPOS'
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDemandes();
    fetchConfiguration();
    fetchSemainesTypes();
    if (user?.role === 'Directeur') {
      fetchMedecins();
    }
  }, []);

  const fetchMedecins = async () => {
    try {
      const response = await axios.get(`${API}/users/by-role/Médecin`);
      setMedecins(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des médecins');
    }
  };

  const fetchDemandes = async () => {
    try {
      const response = await axios.get(`${API}/demandes-travail`);
      setDemandes(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const fetchSemainesTypes = async () => {
    try {
      const response = await axios.get(`${API}/semaines-types`);
      setSemainesTypes(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des semaines types');
    }
  };

  const initSemainesTypes = async () => {
    try {
      await axios.post(`${API}/semaines-types/init`);
      toast.success('Semaines types initialisées');
      fetchSemainesTypes();
    } catch (error) {
      toast.error('Erreur lors de l\'initialisation');
    }
  };

  const fetchConfiguration = async () => {
    try {
      const response = await axios.get(`${API}/configuration`);
      setConfiguration(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration');
    }
  };

  const handleCreateDemande = async (e) => {
    e.preventDefault();
    
    // Vérifier si un médecin est sélectionné pour le directeur
    if (user?.role === 'Directeur' && !medecinSelectionne) {
      toast.error('Veuillez sélectionner un médecin');
      return;
    }
    
    if (typedemande === 'individuelle') {
      if (!newDemande.date_demandee || !newDemande.creneau) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }
    } else {
      if (!newDemande.semaine_type_id || !newDemande.date_debut_semaine) {
        toast.error('Veuillez sélectionner une semaine type et une date de début');
        return;
      }
    }

    try {
      const demandeData = {
        ...newDemande,
        medecin_id: user?.role === 'Directeur' ? medecinSelectionne : undefined
      };
      const response = await axios.post(`${API}/demandes-travail`, demandeData);
      const demandesCreees = Array.isArray(response.data) ? response.data.length : 1;
      toast.success(`${demandesCreees} demande(s) créée(s) avec succès`);
      setShowDemandeModal(false);
      resetForm();
      fetchDemandes();
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || 'Erreur lors de la création');
      } else {
        toast.error('Erreur lors de la création de la demande');
      }
    }
  };

  const handleApprobation = async (demandeId, approuve, commentaire = '') => {
    try {
      await axios.put(`${API}/demandes-travail/${demandeId}/approuver`, {
        approuve: approuve,
        commentaire: commentaire
      });
      toast.success(approuve ? 'Demande approuvée' : 'Demande rejetée');
      fetchDemandes();
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Erreur lors de l\'approbation');
      }
    }
  };

  const resetForm = () => {
    setNewDemande({
      date_demandee: '',
      creneau: 'MATIN',
      motif: '',
      semaine_type_id: '',
      date_debut_semaine: ''
    });
    setTypeDemande('individuelle');
    setMedecinSelectionne('');
  };

  const handleCreateSemaineType = async (e) => {
    e.preventDefault();
    
    if (!newSemaineType.nom) {
      toast.error('Le nom de la semaine type est requis');
      return;
    }

    try {
      await axios.post(`${API}/semaines-types`, newSemaineType);
      toast.success('Semaine type créée avec succès');
      setShowSemaineTypeModal(false);
      resetSemaineTypeForm();
      fetchSemainesTypes();
    } catch (error) {
      toast.error('Erreur lors de la création');
    }
  };

  const resetSemaineTypeForm = () => {
    setNewSemaineType({
      nom: '',
      description: '',
      lundi: 'REPOS',
      mardi: 'REPOS',
      mercredi: 'REPOS',
      jeudi: 'REPOS',
      vendredi: 'REPOS',
      samedi: 'REPOS',
      dimanche: 'REPOS'
    });
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'APPROUVE': return 'bg-green-100 text-green-800';
      case 'REJETE': return 'bg-red-100 text-red-800';
      case 'EN_ATTENTE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCreneauLabel = (creneau) => {
    const creneaux = {
      'MATIN': 'Matin',
      'APRES_MIDI': 'Après-midi',
      'JOURNEE_COMPLETE': 'Journée complète'
    };
    return creneaux[creneau] || creneau;
  };

  // Calculer les statistiques pour le directeur
  const getStatsJour = (date, creneau) => {
    if (!configuration) return { current: 0, max: 0 };
    
    const demandesApprouvees = demandes.filter(d => 
      d.date_demandee === date && 
      d.statut === 'APPROUVE' && 
      (d.creneau === creneau || d.creneau === 'JOURNEE_COMPLETE')
    );
    
    return {
      current: demandesApprouvees.length,
      max: configuration.max_medecins_par_jour
    };
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Demandes de Jours de Travail</h2>
          <p className="text-gray-600 mt-1">
            {user?.role === 'Directeur' 
              ? 'Gérez les demandes des médecins' 
              : 'Demandez vos jours de travail'
            }
          </p>
        </div>
        
        {(user?.role === 'Médecin' || user?.role === 'Directeur') && (
          <Dialog open={showDemandeModal} onOpenChange={setShowDemandeModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Nouvelle Demande</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle Demande de Jour de Travail</DialogTitle>
                <DialogDescription>
                  Demandez un créneau de travail
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateDemande} className="space-y-4">
                {/* Sélection du médecin pour le Directeur */}
                {user?.role === 'Directeur' && (
                  <div className="space-y-2">
                    <Label>Médecin *</Label>
                    <Select
                      value={medecinSelectionne}
                      onValueChange={setMedecinSelectionne}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un médecin" />
                      </SelectTrigger>
                      <SelectContent>
                        {medecins.map(medecin => (
                          <SelectItem key={medecin.id} value={medecin.id}>
                            Dr. {medecin.prenom} {medecin.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Type de demande</Label>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant={typedemande === 'individuelle' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeDemande('individuelle')}
                    >
                      Demande Individuelle
                    </Button>
                    <Button
                      type="button"
                      variant={typedemande === 'semaine' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeDemande('semaine')}
                    >
                      Semaine Type
                    </Button>
                  </div>
                </div>

                {typedemande === 'individuelle' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="date_demandee">Date souhaitée *</Label>
                      <Input
                        id="date_demandee"
                        type="date"
                        value={newDemande.date_demandee}
                        onChange={(e) => setNewDemande({...newDemande, date_demandee: e.target.value})}
                        required
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="creneau">Créneau *</Label>
                      <Select
                        value={newDemande.creneau}
                        onValueChange={(value) => setNewDemande({...newDemande, creneau: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MATIN">Matin uniquement</SelectItem>
                          <SelectItem value="APRES_MIDI">Après-midi uniquement</SelectItem>
                          <SelectItem value="JOURNEE_COMPLETE">Journée complète</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
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
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Semaine type *</Label>
                      <Select
                        value={newDemande.semaine_type_id}
                        onValueChange={(value) => setNewDemande({...newDemande, semaine_type_id: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une semaine type" />
                        </SelectTrigger>
                        <SelectContent>
                          {semainesTypes.map(semaine => (
                            <SelectItem key={semaine.id} value={semaine.id}>
                              {semaine.nom} - {semaine.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {semainesTypes.length === 0 && user?.role === 'Directeur' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={initSemainesTypes}
                          className="w-full mt-2"
                        >
                          Initialiser Semaines Types
                        </Button>
                      )}
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowSemaineTypeModal(true);
                          setShowDemandeModal(false);
                        }}
                        className="w-full mt-2"
                      >
                        + Créer Ma Semaine Type
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="date_debut_semaine">Date de début (Lundi) *</Label>
                      <Input
                        id="date_debut_semaine"
                        type="date"
                        value={newDemande.date_debut_semaine}
                        onChange={(e) => setNewDemande({...newDemande, date_debut_semaine: e.target.value})}
                        required={typedemande === 'semaine'}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </>
                )}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDemandeModal(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">
                    Créer la demande
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Alerte capacité pour le directeur */}
      {user?.role === 'Directeur' && configuration && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-blue-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Capacité Cabinet</span>
            </div>
            <p className="text-blue-700 text-sm mt-2">
              Maximum {configuration.max_medecins_par_jour} médecins par créneau
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {demandes.map(demande => (
          <Card key={demande.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">
                      Dr. {demande.medecin?.prenom} {demande.medecin?.nom}
                    </h3>
                    <Badge className={getStatutColor(demande.statut)}>
                      {demande.statut.replace('_', ' ')}
                    </Badge>
                    
                    {user?.role === 'Directeur' && demande.statut === 'EN_ATTENTE' && (
                      <Badge variant="outline" className="text-xs">
                        {(() => {
                          const stats = getStatsJour(demande.date_demandee, demande.creneau);
                          return `${stats.current}/${stats.max} médecins`;
                        })()}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <strong>Date:</strong> {new Date(demande.date_demandee).toLocaleDateString('fr-FR')}
                    </div>
                    <div>
                      <strong>Créneau:</strong> {getCreneauLabel(demande.creneau)}
                    </div>
                  </div>
                  
                  {demande.motif && (
                    <p className="text-sm text-gray-600">
                      <strong>Motif:</strong> {demande.motif}
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    Demandé le: {new Date(demande.date_demande).toLocaleDateString('fr-FR')}
                  </p>
                  
                  {demande.commentaire_approbation && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      <strong>Commentaire:</strong> {demande.commentaire_approbation}
                    </p>
                  )}
                </div>
                
                {user?.role === 'Directeur' && demande.statut === 'EN_ATTENTE' && (
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleApprobation(demande.id, true)}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={(() => {
                        const stats = getStatsJour(demande.date_demandee, demande.creneau);
                        return stats.current >= stats.max;
                      })()}
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
              </div>
            </CardContent>
          </Card>
        ))}
        
        {demandes.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune demande de jour de travail trouvée</p>
              <p className="text-sm text-gray-400 mt-2">
                {user?.role === 'Médecin' || user?.role === 'Directeur'
                  ? 'Cliquez sur "Nouvelle Demande" pour créer votre première demande'
                  : 'Les demandes apparaîtront ici une fois créées'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal Créer Semaine Type */}
      <Dialog open={showSemaineTypeModal} onOpenChange={setShowSemaineTypeModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Créer Ma Semaine Type</DialogTitle>
            <DialogDescription>
              Définissez votre modèle de semaine personnalisé
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateSemaineType} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom de la semaine type *</Label>
                <Input
                  id="nom"
                  value={newSemaineType.nom}
                  onChange={(e) => setNewSemaineType({...newSemaineType, nom: e.target.value})}
                  placeholder="Ex: Ma semaine standard"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newSemaineType.description}
                  onChange={(e) => setNewSemaineType({...newSemaineType, description: e.target.value})}
                  placeholder="Description courte"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <Label className="text-base font-medium">Planning hebdomadaire</Label>
              <div className="grid grid-cols-2 gap-3">
                {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(jour => (
                  <div key={jour} className="space-y-2">
                    <Label className="text-sm font-medium capitalize">{jour}</Label>
                    <Select
                      value={newSemaineType[jour]}
                      onValueChange={(value) => setNewSemaineType({...newSemaineType, [jour]: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REPOS">Repos</SelectItem>
                        <SelectItem value="MATIN">Matin</SelectItem>
                        <SelectItem value="APRES_MIDI">Après-midi</SelectItem>
                        <SelectItem value="JOURNEE_COMPLETE">Journée complète</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSemaineTypeModal(false);
                  resetSemaineTypeForm();
                }}
              >
                Annuler
              </Button>
              <Button type="submit">
                Créer Ma Semaine Type
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Plan Cabinet Component  
const PlanCabinetManager = () => {
  const [planData, setPlanData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCreneau, setSelectedCreneau] = useState('MATIN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlanCabinet();
  }, [selectedDate, selectedCreneau]);

  const fetchPlanCabinet = async () => {
    try {
      const response = await axios.get(`${API}/cabinet/plan/${selectedDate}?creneau=${selectedCreneau}`);
      setPlanData(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement du plan');
    } finally {
      setLoading(false);
    }
  };

  const renderSalle = (salle) => {
    const occupation = salle.occupation;
    const baseClasses = "absolute border-2 rounded-lg p-3 text-sm font-medium transition-all cursor-pointer hover:scale-105 flex flex-col justify-center items-center";
    
    let bgColor = 'bg-gray-100 border-gray-300';
    let textColor = 'text-gray-600';
    
    if (occupation) {
      switch (salle.type_salle) {
        case 'MEDECIN':
          bgColor = 'bg-blue-100 border-blue-400';
          textColor = 'text-blue-800';
          break;
        case 'ASSISTANT':
          bgColor = 'bg-green-100 border-green-400';
          textColor = 'text-green-800';
          break;
        case 'ATTENTE':
          bgColor = 'bg-yellow-100 border-yellow-400';
          textColor = 'text-yellow-800';
          break;
      }
    }
    
    // Positionner selon les coordonnées (chaque unité = 120px pour des salles plus grandes)
    const style = {
      left: `${salle.position_x * 120}px`,
      top: `${salle.position_y * 120}px`,
      width: '110px',
      height: '90px',
      backgroundColor: occupation ? salle.couleur + '20' : '#f3f4f6'
    };

    // Générer les initiales pour l'affichage principal
    const getInitiales = (employe) => {
      if (!employe) return '';
      const prenom = employe.prenom || '';
      const nom = employe.nom || '';
      return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
    };
    
    return (
      <div
        key={salle.id}
        className={`${baseClasses} ${bgColor} ${textColor}`}
        style={style}
        title={
          occupation 
            ? `${salle.nom} - ${occupation.employe?.prenom} ${occupation.employe?.nom}${occupation.medecin_attribue ? ` (avec Dr. ${occupation.medecin_attribue.prenom} ${occupation.medecin_attribue.nom})` : ''}`
            : `${salle.nom} - Libre`
        }
      >
        <div className="text-center w-full">
          <div className="font-bold text-base mb-1">{salle.nom}</div>
          {occupation ? (
            <div className="space-y-1">
              {/* Initiales principales en gros */}
              <div className="text-lg font-bold bg-white bg-opacity-70 rounded-full w-8 h-8 flex items-center justify-center mx-auto border">
                {getInitiales(occupation.employe)}
              </div>
              {/* Informations complémentaires */}
              <div className="text-xs">
                {occupation.employe?.role === 'Médecin' ? 'Dr.' : ''} 
                {occupation.employe?.prenom} {occupation.employe?.nom?.charAt(0)}.
              </div>
              {occupation.medecin_attribue && (
                <div className="text-xs opacity-75">
                  + Dr.{getInitiales(occupation.medecin_attribue)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-2">Libre</div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Plan du Cabinet</h2>
          <p className="text-gray-600 mt-1">Vision en temps réel de l'occupation des salles</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          
          <Select value={selectedCreneau} onValueChange={setSelectedCreneau}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MATIN">Matin</SelectItem>
              <SelectItem value="APRES_MIDI">Après-midi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {planData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Plan du Cabinet - {selectedCreneau === 'MATIN' ? 'Matin' : 'Après-midi'}</span>
              <span className="text-sm font-normal text-gray-500">
                ({new Date(selectedDate).toLocaleDateString('fr-FR')})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Container du plan avec position relative pour le positionnement absolu */}
            <div className="relative bg-gray-50 rounded-lg p-6" style={{ height: '700px', width: '900px' }}>
              {planData.salles.map(salle => renderSalle(salle))}
              
              {/* Légende */}
              <div className="absolute bottom-6 right-6 bg-white p-4 rounded-lg shadow-lg border">
                <h4 className="font-medium mb-2 text-sm">Légende</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-100 border border-blue-400 rounded"></div>
                    <span>Médecin</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-100 border border-green-400 rounded"></div>
                    <span>Assistant</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-100 border border-yellow-400 rounded"></div>
                    <span>Attente</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
                    <span>Libre</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const AdminManager = () => {
  const { user, setUser } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/users`);
      setAllUsers(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (userId) => {
    try {
      const response = await axios.post(`${API}/admin/impersonate/${userId}`);
      
      // Sauvegarder le token et mettre à jour l'utilisateur
      localStorage.setItem('token', response.data.access_token);
      setUser(response.data.user);
      
      toast.success(`Connexion en tant que ${response.data.user.prenom} ${response.data.user.nom}`);
    } catch (error) {
      toast.error('Erreur lors de la connexion à ce compte');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      await axios.put(`${API}/admin/users/${selectedUser.id}/password`, {
        password: newPassword
      });
      
      toast.success('Mot de passe modifié avec succès');
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      toast.error('Erreur lors de la modification du mot de passe');
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    try {
      const response = await axios.put(`${API}/admin/users/${selectedUser.id}/email`, {
        email: newEmail
      });
      
      toast.success(response.data.message);
      fetchAllUsers(); // Recharger la liste
      setShowEmailModal(false);
      setNewEmail('');
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification de l\'email');
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      const response = await axios.put(`${API}/admin/users/${userId}/toggle-active`);
      toast.success(response.data.message);
      fetchAllUsers(); // Recharger la liste
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    }
  };
  const handleDeleteUser = async () => {
    const expectedText = `SUPPRIMER ${selectedUser?.prenom} ${selectedUser?.nom}`;
    
    if (deleteConfirmText !== expectedText) {
      toast.error(`Vous devez taper exactement: ${expectedText}`);
      return;
    }

    try {
      const response = await axios.delete(`${API}/admin/users/${selectedUser.id}/delete-permanently`);
      toast.success(response.data.message);
      fetchAllUsers(); // Recharger la liste
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Directeur': return 'bg-purple-100 text-purple-800';
      case 'Médecin': return 'bg-blue-100 text-blue-800';
      case 'Assistant': return 'bg-green-100 text-green-800';
      case 'Secrétaire': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Administration des Comptes</h2>
        <div className="text-sm text-gray-500">
          Total: {allUsers.length} comptes
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les Utilisateurs</CardTitle>
          <CardDescription>
            Gérez tous les comptes utilisateurs - Connexion, mots de passe et statuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Utilisateur</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Rôle</th>
                  <th className="text-left p-3">Statut</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map(userItem => (
                  <tr 
                    key={userItem.id} 
                    className={`border-b hover:bg-gray-50 ${!userItem.actif ? 'opacity-50' : ''}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                          {userItem.prenom?.[0]}{userItem.nom?.[0]}
                        </div>
                        <div>
                          <div className="font-medium">
                            {userItem.prenom} {userItem.nom}
                          </div>
                          {userItem.id === user?.id && (
                            <span className="text-xs text-blue-600 font-medium">
                              (C'est vous)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">{userItem.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(userItem.role)}`}>
                        {userItem.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        userItem.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {userItem.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex space-x-2">
                        {userItem.id !== user?.id && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImpersonate(userItem.id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Se connecter
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(userItem);
                                setShowPasswordModal(true);
                              }}
                              className="text-orange-600 hover:text-orange-800"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Mot de passe
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(userItem);
                                setNewEmail(userItem.email);
                                setShowEmailModal(true);
                              }}
                              className="text-purple-600 hover:text-purple-800"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Email
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleActive(userItem.id)}
                              className={userItem.actif ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}
                            >
                              {userItem.actif ? (
                                <>
                                  <X className="h-3 w-3 mr-1" />
                                  Désactiver
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Activer
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedUser(userItem);
                                setShowDeleteModal(true);
                              }}
                              className="text-white"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Supprimer
                            </Button>
                          </>
                        )}
                        {userItem.id === user?.id && (
                          <span className="text-xs text-gray-500 italic">
                            Actions non disponibles sur votre propre compte
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {allUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Aucun utilisateur trouvé
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de changement de mot de passe */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier le mot de passe de {selectedUser?.prenom} {selectedUser?.nom}
            </DialogTitle>
            <DialogDescription>
              Définissez un nouveau mot de passe pour cet utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                minLength={6}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleResetPassword}>
                Modifier le mot de passe
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal de suppression définitive */}
      {/* Modal de modification d'email */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier l'email de {selectedUser?.prenom} {selectedUser?.nom}
            </DialogTitle>
            <DialogDescription>
              Définissez une nouvelle adresse email pour cet utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email actuel</Label>
              <Input
                value={selectedUser?.email || ''}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div>
              <Label>Nouvel email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="exemple@hopital.fr"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded">
              <div className="text-sm text-blue-800">
                <strong>Note :</strong> L'utilisateur devra utiliser ce nouvel email pour se connecter.
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEmailModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdateEmail}>
                Modifier l'email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">
              ⚠️ Supprimer définitivement {selectedUser?.prenom} {selectedUser?.nom}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="font-semibold text-red-600">
                ATTENTION : Cette action est IRRÉVERSIBLE !
              </div>
              <div>
                Cette action supprimera définitivement :
              </div>
              <ul className="list-disc pl-6 text-sm space-y-1">
                <li>Le compte utilisateur</li>
                <li>Tout l'historique des congés</li>
                <li>Les plannings et assignations</li>
                <li>Les messages et documents</li>
                <li>Les quotas et demandes de travail</li>
                <li>Toutes les permissions</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 p-3 rounded">
              <Label className="text-red-800 font-medium">
                Pour confirmer, tapez exactement : 
                <span className="font-bold">SUPPRIMER {selectedUser?.prenom} {selectedUser?.nom}</span>
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={`SUPPRIMER ${selectedUser?.prenom} ${selectedUser?.nom}`}
                className="mt-2 border-red-300 focus:border-red-500"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setSelectedUser(null);
                }}
              >
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteUser}
                disabled={deleteConfirmText !== `SUPPRIMER ${selectedUser?.prenom} ${selectedUser?.nom}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Section d'informations */}
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <Eye className="h-4 w-4 text-blue-600" />
            <span><strong>Se connecter :</strong> Vous connecte directement au compte de l'utilisateur sans connaître son mot de passe</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Edit className="h-4 w-4 text-orange-600" />
            <span><strong>Mot de passe :</strong> Réinitialise et définit un nouveau mot de passe pour l'utilisateur</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Edit className="h-4 w-4 text-purple-600" />
            <span><strong>Email :</strong> Modifie l'adresse email de connexion de l'utilisateur</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <X className="h-4 w-4 text-red-600" />
            <span><strong>Désactiver :</strong> Empêche l'utilisateur de se connecter sans supprimer son compte (réversible)</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Trash2 className="h-4 w-4 text-red-700" />
            <span><strong>Supprimer :</strong> Supprime définitivement l'utilisateur et toutes ses données (IRRÉVERSIBLE)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
// Coffre-Fort Component
const StocksManager = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLieu, setSelectedLieu] = useState('all');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newCategory, setNewCategory] = useState({
    nom: '',
    description: '',
    couleur: '#3B82F6'
  });

  const [newArticle, setNewArticle] = useState({
    nom: '',
    description: '',
    categorie_id: '',
    lieu: '',
    photo_url: '',
    nombre_souhaite: 0,
    nombre_en_stock: 0,
    lien_commande: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, articlesRes] = await Promise.all([
        axios.get(`${API}/stocks/categories`),
        axios.get(`${API}/stocks/articles`)
      ]);
      
      setCategories(categoriesRes.data);
      setArticles(articlesRes.data);

      if (user?.role === 'Directeur') {
        const permissionsRes = await axios.get(`${API}/stocks/permissions`);
        setPermissions(permissionsRes.data);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/stocks/categories`, newCategory);
      toast.success('Catégorie créée avec succès');
      fetchData();
      setShowCategoryModal(false);
      resetCategoryForm();
    } catch (error) {
      toast.error('Erreur lors de la création de la catégorie');
    }
  };

  const handleCreateArticle = async (e) => {
    e.preventDefault();
    try {
      if (editingArticle) {
        await axios.put(`${API}/stocks/articles/${editingArticle.id}`, newArticle);
        toast.success('Article modifié avec succès');
      } else {
        await axios.post(`${API}/stocks/articles`, newArticle);
        toast.success('Article créé avec succès');
      }
      fetchData();
      setShowArticleModal(false);
      resetArticleForm();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde de l\'article');
    }
  };

  const handleDeleteArticle = async (articleId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) return;
    
    try {
      await axios.delete(`${API}/stocks/articles/${articleId}`);
      toast.success('Article supprimé avec succès');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleEditArticle = (article) => {
    setEditingArticle(article);
    setNewArticle({
      nom: article.nom,
      description: article.description || '',
      categorie_id: article.categorie_id,
      lieu: article.lieu || '',
      photo_url: article.photo_url || '',
      nombre_souhaite: article.nombre_souhaite,
      nombre_en_stock: article.nombre_en_stock,
      lien_commande: article.lien_commande || ''
    });
    setShowArticleModal(true);
  };

  const resetCategoryForm = () => {
    setNewCategory({
      nom: '',
      description: '',
      couleur: '#3B82F6'
    });
  };

  const resetArticleForm = () => {
    setEditingArticle(null);
    setNewArticle({
      nom: '',
      description: '',
      categorie_id: '',
      lieu: '',
      photo_url: '',
      nombre_souhaite: 0,
      nombre_en_stock: 0,
      lien_commande: ''
    });
  };

  const handleImageClick = (imageUrl, articleNom) => {
    setSelectedImage({ url: imageUrl, nom: articleNom });
    setShowImageModal(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewArticle({...newArticle, photo_url: event.target.result});
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtrer par catégorie et par lieu
  const filteredArticles = articles
    .filter(article => selectedCategory === 'all' || article.categorie_id === selectedCategory)
    .filter(article => selectedLieu === 'all' || article.lieu === selectedLieu);

  // Obtenir la liste unique des lieux
  const lieux = [...new Set(articles.map(a => a.lieu).filter(Boolean))];

  const getBadgeColor = (nombreACommander) => {
    if (nombreACommander <= 0) return 'bg-green-100 text-green-800';
    if (nombreACommander <= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Stocks</h2>
        <div className="space-x-2">
          <Button onClick={() => setShowCategoryModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Catégorie
          </Button>
          <Button onClick={() => setShowArticleModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel Article
          </Button>
          {user?.role === 'Directeur' && (
            <Button variant="outline" onClick={() => setShowPermissionModal(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Permissions
            </Button>
          )}
        </div>
      </div>

      {/* Filtres par catégorie */}
      <div className="flex space-x-2 overflow-x-auto">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('all')}
          size="sm"
        >
          Toutes les catégories ({articles.length})
        </Button>
        {categories.map(category => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(category.id)}
            size="sm"
            style={{ 
              backgroundColor: selectedCategory === category.id ? category.couleur : 'transparent',
              borderColor: category.couleur,
              color: selectedCategory === category.id ? 'white' : category.couleur
            }}
          >
            {category.nom} ({articles.filter(a => a.categorie_id === category.id).length})
          </Button>
        ))}
      </div>

      {/* Filtres par lieu */}
      <div className="flex space-x-2 overflow-x-auto">
        <Button
          variant={selectedLieu === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedLieu('all')}
          size="sm"
        >
          Tous les lieux
        </Button>
        {lieux.map(lieu => (
          <Button
            key={lieu}
            variant={selectedLieu === lieu ? 'default' : 'outline'}
            onClick={() => setSelectedLieu(lieu)}
            size="sm"
          >
            {lieu} ({articles.filter(a => a.lieu === lieu).length})
          </Button>
        ))}
      </div>

      {/* Tableau des articles */}
      <Card>
        <CardHeader>
          <CardTitle>Articles de Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Photo</th>
                  <th className="text-left p-2">Article</th>
                  <th className="text-left p-2">Catégorie</th>
                  <th className="text-left p-2">Lieu</th>
                  <th className="text-left p-2">Stock Actuel</th>
                  <th className="text-left p-2">Souhaité</th>
                  <th className="text-left p-2">À Commander</th>
                  <th className="text-left p-2">Lien</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map(article => (
                  <tr key={article.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      {article.photo_url ? (
                        <img
                          src={article.photo_url}
                          alt={article.nom}
                          className="w-12 h-12 object-cover rounded cursor-pointer border"
                          onClick={() => handleImageClick(article.photo_url, article.nom)}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <div 
                        className="font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => article.photo_url && handleImageClick(article.photo_url, article.nom)}
                      >
                        {article.nom}
                      </div>
                      {article.description && (
                        <div className="text-xs text-gray-500">{article.description}</div>
                      )}
                    </td>
                    <td className="p-2">
                      {article.categorie ? (
                        <span 
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ 
                            backgroundColor: article.categorie.couleur + '20',
                            color: article.categorie.couleur
                          }}
                        >
                          {article.categorie.nom}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Sans catégorie</span>
                      )}
                    </td>
                    <td className="p-2">
                      {article.lieu ? (
                        <span className="text-sm">{article.lieu}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Non spécifié</span>
                      )}
                    </td>
                    <td className="p-2 text-center">{article.nombre_en_stock}</td>
                    <td className="p-2 text-center">{article.nombre_souhaite}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeColor(article.nombre_a_commander)}`}>
                        {article.nombre_a_commander > 0 ? article.nombre_a_commander : '✓'}
                      </span>
                    </td>
                    <td className="p-2">
                      {article.lien_commande && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(article.lien_commande, '_blank')}
                        >
                          <Link className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditArticle(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteArticle(article.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredArticles.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Aucun article trouvé dans cette catégorie
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Nouvelle Catégorie */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Catégorie</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <Label>Nom de la catégorie</Label>
              <Input
                value={newCategory.nom}
                onChange={(e) => setNewCategory({...newCategory, nom: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newCategory.description}
                onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              />
            </div>
            <div>
              <Label>Couleur</Label>
              <Input
                type="color"
                value={newCategory.couleur}
                onChange={(e) => setNewCategory({...newCategory, couleur: e.target.value})}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowCategoryModal(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Nouvel Article */}
      <Dialog open={showArticleModal} onOpenChange={setShowArticleModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Modifier' : 'Nouvel'} Article</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateArticle} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom de l'article</Label>
                <Input
                  value={newArticle.nom}
                  onChange={(e) => setNewArticle({...newArticle, nom: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Catégorie</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={newArticle.categorie_id}
                  onChange={(e) => setNewArticle({...newArticle, categorie_id: e.target.value})}
                  required
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Input
                value={newArticle.description}
                onChange={(e) => setNewArticle({...newArticle, description: e.target.value})}
              />
            </div>

            <div>
              <Label>Lieu</Label>
              <Input
                value={newArticle.lieu}
                onChange={(e) => setNewArticle({...newArticle, lieu: e.target.value})}
                placeholder="Ex: Armoire A, Salle de soins, Réfrigérateur..."
              />
            </div>

            <div>
              <Label>Photo de l'article</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              {newArticle.photo_url && (
                <img 
                  src={newArticle.photo_url} 
                  alt="Aperçu" 
                  className="mt-2 w-20 h-20 object-cover rounded border"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre en stock</Label>
                <Input
                  type="number"
                  min="0"
                  value={newArticle.nombre_en_stock}
                  onChange={(e) => setNewArticle({...newArticle, nombre_en_stock: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Nombre souhaité</Label>
                <Input
                  type="number"
                  min="0"
                  value={newArticle.nombre_souhaite}
                  onChange={(e) => setNewArticle({...newArticle, nombre_souhaite: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div>
              <Label>Lien de commande</Label>
              <Input
                type="url"
                value={newArticle.lien_commande}
                onChange={(e) => setNewArticle({...newArticle, lien_commande: e.target.value})}
                placeholder="https://..."
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowArticleModal(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editingArticle ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal d'affichage d'image */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.nom}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex justify-center">
              <img 
                src={selectedImage.url} 
                alt={selectedImage.nom}
                className="max-w-full max-h-96 object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
const CoffreFortManager = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setDocuments(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    
    if (!uploadFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    try {
      // Dans un vrai système, on uploadrait le fichier
      // Ici on simule juste l'enregistrement des métadonnées
      const documentData = {
        nom_fichier: `${Date.now()}-${uploadFile.name}`,
        nom_original: uploadFile.name,
        taille: uploadFile.size,
        type_mime: uploadFile.type,
        description: uploadDescription
      };

      await axios.post(`${API}/documents`, documentData);
      toast.success('Document uploadé avec succès');
      setShowUploadModal(false);
      resetUploadForm();
      fetchDocuments();
    } catch (error) {
      toast.error('Erreur lors de l\'upload');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await axios.delete(`${API}/documents/${documentId}`);
      toast.success('Document supprimé');
      fetchDocuments();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadDescription('');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    return '📁';
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {user?.role === 'Directeur' ? 'Documents du Personnel' : 'Mon Coffre-Fort Personnel'}
          </h2>
          <p className="text-gray-600 mt-1">
            {user?.role === 'Directeur' 
              ? 'Accès à tous les documents du personnel'
              : 'Vos documents personnels sécurisés'
            }
          </p>
        </div>
        
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Ajouter Document</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un Document</DialogTitle>
              <DialogDescription>
                Uploadez un document dans votre coffre-fort personnel
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Fichier *</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  required
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mp3"
                />
                {uploadFile && (
                  <div className="text-sm text-gray-600">
                    {getFileIcon(uploadFile.type)} {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (optionnelle)</Label>
                <Textarea
                  id="description"
                  placeholder="Description du document..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadForm();
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Uploader
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {documents.map(document => (
          <Card key={document.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="text-2xl">
                    {getFileIcon(document.type_mime)}
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <h3 className="font-medium">{document.nom_original}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{formatFileSize(document.taille)}</span>
                        <span>•</span>
                        <span>{new Date(document.date_upload).toLocaleDateString('fr-FR')}</span>
                        {user?.role === 'Directeur' && (
                          <>
                            <span>•</span>
                            <Badge variant="outline">
                              Propriétaire: {document.proprietaire_id}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {document.description && (
                      <p className="text-sm text-gray-600">
                        {document.description}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toast.info('Téléchargement simulé - fonctionnalité complète à implémenter');
                    }}
                  >
                    Télécharger
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteDocument(document.id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {documents.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun document trouvé</p>
              <p className="text-sm text-gray-400">
                Cliquez sur "Ajouter Document" pour uploader votre premier fichier
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Attribution Manager Component (Directeur seulement)
const AttributionManager = () => {
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [quotas, setQuotas] = useState([]);
  const [planning, setPlanning] = useState(null);
  const [users, setUsers] = useState([]);
  const [salles, setSalles] = useState([]);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showAttributionModal, setShowAttributionModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [newQuota, setNewQuota] = useState({
    employe_id: '',
    demi_journees_requises: 8,
    horaire_debut: '08:00',
    horaire_pause_debut: '12:00',
    horaire_pause_fin: '14:00',
    horaire_fin: '17:00'
  });
  const [attribution, setAttribution] = useState({
    employe_id: '',
    salle_attribuee: '',
    medecin_ids: [],
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'Directeur') {
      fetchData();
    }
  }, [selectedWeek]);

  const fetchData = async () => {
    try {
      const mondayDate = getMondayOfWeek(selectedWeek);
      
      const [usersRes, sallesRes, quotasRes, planningRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/salles`),
        axios.get(`${API}/quotas/${mondayDate}`),
        axios.get(`${API}/planning/semaine/${mondayDate}`)
      ]);

      setUsers(usersRes.data);
      setSalles(sallesRes.data);
      setQuotas(quotasRes.data);
      setPlanning(planningRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const getMondayOfWeek = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const handleCreateQuota = async (e) => {
    e.preventDefault();
    
    try {
      const quotaData = {
        ...newQuota,
        semaine_debut: getMondayOfWeek(selectedWeek)
      };
      
      await axios.post(`${API}/quotas`, quotaData);
      toast.success('Quota défini avec succès');
      setShowQuotaModal(false);
      resetQuotaForm();
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la création du quota');
    }
  };

  const handleCreateAttribution = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot || !attribution.employe_id || !attribution.salle_attribuee) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    try {
      // Find the salle name from the ID
      const selectedSalle = salles.find(s => s.id === attribution.salle_attribuee);
      const salleNom = selectedSalle ? selectedSalle.nom : attribution.salle_attribuee;
      
      const params = new URLSearchParams({
        employe_id: attribution.employe_id,
        date: selectedSlot.date,
        creneau: selectedSlot.creneau,
        salle_attribuee: salleNom,
        notes: attribution.notes
      });
      
      if (attribution.medecin_ids.length > 0) {
        attribution.medecin_ids.forEach(id => params.append('medecin_ids', id));
      }

      await axios.post(`${API}/attributions?${params.toString()}`);
      toast.success('Attribution créée avec succès');
      setShowAttributionModal(false);
      resetAttributionForm();
      fetchData();
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Erreur lors de l\'attribution');
      }
    }
  };

  const resetQuotaForm = () => {
    setNewQuota({
      employe_id: '',
      demi_journees_requises: 8,
      horaire_debut: '08:00',
      horaire_pause_debut: '12:00',
      horaire_pause_fin: '14:00',
      horaire_fin: '17:00'
    });
  };

  const resetAttributionForm = () => {
    setAttribution({
      employe_id: '',
      salle_attribuee: '',
      medecin_ids: [],
      notes: ''
    });
    setSelectedSlot(null);
  };

  const getQuotaForEmployee = (employeId) => {
    return quotas.find(q => q.employe_id === employeId);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Médecin': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Assistant': return 'bg-green-100 text-green-800 border-green-300';
      case 'Secrétaire': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (user?.role !== 'Directeur') {
    return (
      <div className="text-center py-12">
        <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Attribution Planning</h3>
        <p className="text-gray-500">Accès réservé au Directeur</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  const daysOfWeek = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const weekDates = planning ? planning.dates : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Attribution Planning Semaine</h2>
          <p className="text-gray-600 mt-1">Gérez les attributions et quotas des employés</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Input
            type="date"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-auto"
          />
          
          <Button
            onClick={() => setShowQuotaModal(true)}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Définir Quota</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Liste des employés avec quotas */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Employés & Quotas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map(employe => {
              const quota = getQuotaForEmployee(employe.id);
              const restant = quota ? quota.demi_journees_requises - quota.demi_journees_attribuees : 0;
              
              return (
                <div key={employe.id} className={`p-3 rounded-lg border ${getRoleColor(employe.role)}`}>
                  <div className="font-medium text-sm">
                    {employe.prenom} {employe.nom}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {employe.role}
                  </div>
                  {quota ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs">
                        <span className="font-medium">
                          {quota.demi_journees_attribuees}/{quota.demi_journees_requises}
                        </span> demi-journées
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            restant === 0 ? 'bg-green-500' : restant < 0 ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (quota.demi_journees_attribuees / quota.demi_journees_requises) * 100)}%`
                          }}
                        />
                      </div>
                      <div className={`text-xs ${restant < 0 ? 'text-red-600' : restant === 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        Reste: {restant} demi-journées
                      </div>
                      
                      {employe.role === 'Secrétaire' && quota.horaire_debut && (
                        <div className="text-xs text-gray-600 mt-1">
                          Horaires: {quota.horaire_debut}-{quota.horaire_pause_debut}, {quota.horaire_pause_fin}-{quota.horaire_fin}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewQuota({...newQuota, employe_id: employe.id});
                          setShowQuotaModal(true);
                        }}
                        className="text-xs h-6"
                      >
                        Définir quota
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Planning semaine */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Planning de la Semaine</span>
              {planning && (
                <span className="text-sm font-normal text-gray-600">
                  {new Date(weekDates[0]).toLocaleDateString('fr-FR')} - {new Date(weekDates[6]).toLocaleDateString('fr-FR')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planning && (
              <div className="grid grid-cols-7 gap-2">
                {/* Headers jours */}
                {daysOfWeek.map((jour, index) => (
                  <div key={jour} className="p-2 bg-gray-50 rounded text-center font-medium text-sm">
                    <div className="capitalize">{jour.slice(0, 3)}</div>
                    <div className="text-xs text-gray-600">
                      {new Date(weekDates[index]).getDate()}
                    </div>
                  </div>
                ))}
                
                {/* Créneaux par jour */}
                {weekDates.map((date, dayIndex) => (
                  <div key={`day-${date}-${dayIndex}`} className="space-y-1">
                    {/* Matin */}
                    <div 
                      className="bg-blue-50 rounded p-2 min-h-[80px] cursor-pointer hover:bg-blue-100 border-2 border-dashed border-blue-200"
                      onClick={() => {
                        setSelectedSlot({ date, creneau: 'MATIN' });
                        setShowAttributionModal(true);
                      }}
                    >
                      <div className="text-xs font-medium text-blue-700 mb-1">Matin</div>
                      <div className="space-y-1">
                        {planning.planning[date]?.MATIN?.map((creneau, idx) => (
                          <div key={`${date}-matin-${creneau.id || idx}`} className={`text-xs p-1 rounded ${getRoleColor(creneau.employe_role)}`}>
                            <div className="font-medium truncate">
                              {creneau.employe?.prenom?.[0]}.{creneau.employe?.nom}
                            </div>
                            {creneau.salle_attribuee && (
                              <div className="truncate">
                                📍 {creneau.salle_attribuee}
                              </div>
                            )}
                          </div>
                        )) || []}
                      </div>
                      {(!planning.planning[date]?.MATIN || planning.planning[date]?.MATIN.length === 0) && (
                        <div className="text-xs text-blue-400 text-center">+ Attribuer</div>
                      )}
                    </div>
                    
                    {/* Après-midi */}
                    <div 
                      className="bg-orange-50 rounded p-2 min-h-[80px] cursor-pointer hover:bg-orange-100 border-2 border-dashed border-orange-200"
                      onClick={() => {
                        setSelectedSlot({ date, creneau: 'APRES_MIDI' });
                        setShowAttributionModal(true);
                      }}
                    >
                      <div className="text-xs font-medium text-orange-700 mb-1">Après-midi</div>
                      <div className="space-y-1">
                        {planning.planning[date]?.APRES_MIDI?.map((creneau, idx) => (
                          <div key={`${date}-apresmidi-${creneau.id || idx}`} className={`text-xs p-1 rounded ${getRoleColor(creneau.employe_role)}`}>
                            <div className="font-medium truncate">
                              {creneau.employe?.prenom?.[0]}.{creneau.employe?.nom}
                            </div>
                            {creneau.salle_attribuee && (
                              <div className="truncate">
                                📍 {creneau.salle_attribuee}
                              </div>
                            )}
                          </div>
                        )) || []}
                      </div>
                      {(!planning.planning[date]?.APRES_MIDI || planning.planning[date]?.APRES_MIDI.length === 0) && (
                        <div className="text-xs text-orange-400 text-center">+ Attribuer</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Quota */}
      <Dialog open={showQuotaModal} onOpenChange={setShowQuotaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Définir Quota Employé</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateQuota} className="space-y-4">
            <div className="space-y-2">
              <Label>Employé *</Label>
              <Select
                value={newQuota.employe_id}
                onValueChange={(value) => setNewQuota({...newQuota, employe_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(employe => (
                    <SelectItem key={employe.id} value={employe.id}>
                      {employe.prenom} {employe.nom} ({employe.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nombre de demi-journées par semaine *</Label>
              <Input
                type="number"
                min="1"
                max="14"
                value={newQuota.demi_journees_requises}
                onChange={(e) => setNewQuota({...newQuota, demi_journees_requises: parseInt(e.target.value)})}
              />
            </div>
            
            {/* Horaires pour secrétaires */}
            {users.find(u => u.id === newQuota.employe_id)?.role === 'Secrétaire' && (
              <div className="space-y-3 border-t pt-3">
                <Label className="text-base font-medium">Horaires Secrétaire</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-sm">Début</Label>
                    <Input
                      type="time"
                      value={newQuota.horaire_debut}
                      onChange={(e) => setNewQuota({...newQuota, horaire_debut: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Pause début</Label>
                    <Input
                      type="time"
                      value={newQuota.horaire_pause_debut}
                      onChange={(e) => setNewQuota({...newQuota, horaire_pause_debut: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Pause fin</Label>
                    <Input
                      type="time"
                      value={newQuota.horaire_pause_fin}
                      onChange={(e) => setNewQuota({...newQuota, horaire_pause_fin: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Fin</Label>
                    <Input
                      type="time"
                      value={newQuota.horaire_fin}
                      onChange={(e) => setNewQuota({...newQuota, horaire_fin: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowQuotaModal(false)}>
                Annuler
              </Button>
              <Button type="submit">
                Définir Quota
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Attribution */}
      <Dialog open={showAttributionModal} onOpenChange={setShowAttributionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Attribution {selectedSlot && (
                <>- {new Date(selectedSlot.date).toLocaleDateString('fr-FR')} {selectedSlot.creneau === 'MATIN' ? 'Matin' : 'Après-midi'}</>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateAttribution} className="space-y-4">
            <div className="space-y-2">
              <Label>Employé *</Label>
              <Select
                value={attribution.employe_id}
                onValueChange={(value) => setAttribution({...attribution, employe_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(employe => {
                    const quota = getQuotaForEmployee(employe.id);
                    const canAssign = !quota || quota.demi_journees_attribuees < quota.demi_journees_requises;
                    
                    return (
                      <SelectItem 
                        key={employe.id} 
                        value={employe.id}
                        disabled={!canAssign}
                      >
                        {employe.prenom} {employe.nom} ({employe.role})
                        {quota && ` - ${quota.demi_journees_attribuees}/${quota.demi_journees_requises}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Salle *</Label>
              <Select
                value={attribution.salle_attribuee}
                onValueChange={(value) => setAttribution({...attribution, salle_attribuee: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une salle" />
                </SelectTrigger>
                <SelectContent>
                  {salles.map((salle, idx) => (
                    <SelectItem key={salle.id || `salle-fallback-${idx}`} value={salle.id || `salle-${idx}`}>
                      {salle.nom} ({salle.type_salle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Médecins pour assistants */}
            {users.find(u => u.id === attribution.employe_id)?.role === 'Assistant' && (
              <div className="space-y-2">
                <Label>Médecin(s) assigné(s)</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {users.filter(u => u.role === 'Médecin').map(medecin => (
                    <label key={medecin.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={attribution.medecin_ids.includes(medecin.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAttribution({
                              ...attribution,
                              medecin_ids: [...attribution.medecin_ids, medecin.id]
                            });
                          } else {
                            setAttribution({
                              ...attribution,
                              medecin_ids: attribution.medecin_ids.filter(id => id !== medecin.id)
                            });
                          }
                        }}
                      />
                      <span className="text-sm">
                        Dr. {medecin.prenom} {medecin.nom}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={attribution.notes}
                onChange={(e) => setAttribution({...attribution, notes: e.target.value})}
                placeholder="Notes pour cette attribution..."
                rows={2}
              />
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAttributionModal(false)}>
                Annuler
              </Button>
              <Button type="submit">
                Attribuer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Chat Component
const ChatManager = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroupe, setSelectedGroupe] = useState(null);
  const [users, setUsers] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [chatType, setChatType] = useState('GENERAL');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupe, setNewGroupe] = useState({
    nom: '',
    description: '',
    membres: []
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchUsers();
    fetchGroupes();
    fetchMessages();
  }, [chatType, selectedGroupe]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs');
    }
  };

  const fetchGroupes = async () => {
    try {
      const response = await axios.get(`${API}/groupes-chat`);
      setGroupes(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des groupes');
    }
  };

  const fetchMessages = async () => {
    try {
      let url = `${API}/messages?type_message=${chatType}&limit=100`;
      if (chatType === 'GROUPE' && selectedGroupe) {
        url += `&groupe_id=${selectedGroupe.id}`;
      }
      
      const response = await axios.get(url);
      setMessages(response.data.reverse()); // Ordre chronologique
    } catch (error) {
      console.error('Erreur lors du chargement des messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    try {
      const messageData = {
        contenu: newMessage,
        type_message: chatType,
        destinataire_id: chatType === 'PRIVE' ? selectedUser?.id : null,
        groupe_id: chatType === 'GROUPE' ? selectedGroupe?.id : null
      };
      
      await axios.post(`${API}/messages`, messageData);
      setNewMessage('');
      fetchMessages();
      toast.success('Message envoyé');
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    }
  };

  const handleCreateGroupe = async (e) => {
    e.preventDefault();
    
    if (!newGroupe.nom || newGroupe.membres.length === 0) {
      toast.error('Nom et membres requis');
      return;
    }

    try {
      await axios.post(`${API}/groupes-chat`, newGroupe);
      toast.success('Groupe créé avec succès');
      setShowGroupModal(false);
      resetGroupForm();
      fetchGroupes();
    } catch (error) {
      toast.error('Erreur lors de la création du groupe');
    }
  };

  const resetGroupForm = () => {
    setNewGroupe({
      nom: '',
      description: '',
      membres: []
    });
  };

  const formatMessageTime = (date) => {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Messagerie Interne</h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <Button
              variant={chatType === 'GENERAL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setChatType('GENERAL');
                setSelectedUser(null);
                setSelectedGroupe(null);
              }}
            >
              Chat Général
            </Button>
            <Button
              variant={chatType === 'PRIVE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setChatType('PRIVE');
                setSelectedGroupe(null);
              }}
            >
              Messages Privés
            </Button>
            <Button
              variant={chatType === 'GROUPE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setChatType('GROUPE');
                setSelectedUser(null);
              }}
            >
              Groupes
            </Button>
          </div>
          
          {chatType === 'PRIVE' && (
            <Select
              value={selectedUser?.id || ''}
              onValueChange={(value) => {
                const user = users.find(u => u.id === value);
                setSelectedUser(user);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Choisir un collègue" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.prenom} {u.nom} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {chatType === 'GROUPE' && (
            <div className="flex items-center space-x-2">
              <Select
                value={selectedGroupe?.id || ''}
                onValueChange={(value) => {
                  const groupe = groupes.find(g => g.id === value);
                  setSelectedGroupe(groupe);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Choisir un groupe" />
                </SelectTrigger>
                <SelectContent>
                  {groupes.map(groupe => (
                    <SelectItem key={groupe.id} value={groupe.id}>
                      {groupe.nom} ({groupe.membres_details?.length || 0} membres)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Créer un Groupe</DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleCreateGroupe} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom du groupe *</Label>
                      <Input
                        value={newGroupe.nom}
                        onChange={(e) => setNewGroupe({...newGroupe, nom: e.target.value})}
                        placeholder="Équipe chirurgie..."
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newGroupe.description}
                        onChange={(e) => setNewGroupe({...newGroupe, description: e.target.value})}
                        placeholder="Description du groupe..."
                        rows={2}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Membres *</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {users.map(u => (
                          <label key={u.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={newGroupe.membres.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewGroupe({
                                    ...newGroupe,
                                    membres: [...newGroupe.membres, u.id]
                                  });
                                } else {
                                  setNewGroupe({
                                    ...newGroupe,
                                    membres: newGroupe.membres.filter(id => id !== u.id)
                                  });
                                }
                              }}
                            />
                            <span className="text-sm">
                              {u.prenom} {u.nom} ({u.role})
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setShowGroupModal(false)}>
                        Annuler
                      </Button>
                      <Button type="submit">
                        Créer Groupe
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {chatType === 'GENERAL' 
              ? 'Chat Général - Tous les employés'
              : chatType === 'GROUPE'
                ? selectedGroupe 
                  ? `Groupe: ${selectedGroupe.nom} (${selectedGroupe.membres_details?.length || 0} membres)`
                  : 'Sélectionnez un groupe'
                : selectedUser 
                  ? `Conversation avec ${selectedUser.prenom} ${selectedUser.nom}`
                  : 'Sélectionnez un collègue'
            }
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-2 border rounded-lg bg-gray-50">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${
                  message.expediteur.id === user.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.expediteur.id === user.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border'
                  }`}
                >
                  {message.expediteur.id !== user.id && (
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {message.expediteur.prenom} {message.expediteur.nom}
                    </div>
                  )}
                  <div className="text-sm">
                    {message.contenu}
                  </div>
                  <div className={`text-xs mt-1 ${
                    message.expediteur.id === user.id ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatMessageTime(message.date_envoi)}
                  </div>
                </div>
              </div>
            ))}
            
            {messages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Aucun message pour le moment</p>
                <p className="text-sm">Soyez le premier à envoyer un message !</p>
              </div>
            )}
          </div>
          
          <form onSubmit={sendMessage} className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                chatType === 'GENERAL' 
                  ? "Écrivez votre message à tous..." 
                  : chatType === 'GROUPE'
                    ? selectedGroupe
                      ? `Message au groupe ${selectedGroupe.nom}...`
                      : "Sélectionnez un groupe..."
                    : selectedUser 
                      ? `Message pour ${selectedUser.prenom}...`
                      : "Sélectionnez un destinataire..."
              }
              disabled={
                (chatType === 'PRIVE' && !selectedUser) ||
                (chatType === 'GROUPE' && !selectedGroupe)
              }
              className="flex-1"
            />
            <Button 
              type="submit"
              disabled={
                !newMessage.trim() || 
                (chatType === 'PRIVE' && !selectedUser) ||
                (chatType === 'GROUPE' && !selectedGroupe)
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Mon Profil Component
const MonProfilManager = () => {
  const { user } = useAuth();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    try {
      await axios.put(`${API}/users/me/email`, { email: newEmail });
      toast.success('Email mis à jour avec succès. Veuillez vous reconnecter.');
      setShowEmailModal(false);
      setNewEmail('');
      // Rediriger vers la page de connexion après 2 secondes
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour de l\'email');
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      await axios.put(`${API}/users/me/password`, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      });
      toast.success('Mot de passe mis à jour avec succès');
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour du mot de passe');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Mon Profil</h2>
        <p className="text-gray-600 mt-1">Gérez vos informations personnelles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du compte</CardTitle>
          <CardDescription>Vos informations personnelles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-gray-500">Prénom</Label>
              <p className="text-lg font-medium">{user?.prenom}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-500">Nom</Label>
              <p className="text-lg font-medium">{user?.nom}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-500">Rôle</Label>
              <Badge variant="outline">{user?.role}</Badge>
            </div>
            <div>
              <Label className="text-sm text-gray-500">Email</Label>
              <div className="flex items-center space-x-2">
                <p className="text-lg font-medium">{user?.email}</p>
                <Button size="sm" variant="outline" onClick={() => setShowEmailModal(true)}>
                  <Edit className="h-3 w-3 mr-1" />
                  Modifier
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sécurité</CardTitle>
          <CardDescription>Gérez votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowPasswordModal(true)}>
            Changer mon mot de passe
          </Button>
        </CardContent>
      </Card>

      {/* Modal de modification d'email */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier mon email</DialogTitle>
            <DialogDescription>
              Vous devrez vous reconnecter après la modification
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email actuel</Label>
              <Input value={user?.email} disabled />
            </div>
            <div>
              <Label>Nouvel email</Label>
              <Input
                type="email"
                placeholder="nouveau@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEmailModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdateEmail}>
                Modifier l'email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de modification de mot de passe */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer mon mot de passe</DialogTitle>
            <DialogDescription>
              Entrez votre mot de passe actuel et choisissez-en un nouveau
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mot de passe actuel</Label>
              <Input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              />
            </div>
            <div>
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              />
            </div>
            <div>
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdatePassword}>
                Changer le mot de passe
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main Dashboard
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('personnel');
  const { user } = useAuth();

  const getMenuItems = () => {
    const items = [
      { id: 'profil', label: 'Mon Profil', icon: Users },
      { id: 'personnel', label: 'Personnel', icon: Users },
      { id: 'planning', label: 'Planning', icon: Calendar },
      { id: 'conges', label: 'Congés', icon: Clock },
      { id: 'messages', label: 'Messages', icon: MessageSquare },
      { id: 'documents', label: 'Mon Coffre-Fort', icon: FileText },
    ];

    // Ajouter demandes de travail pour médecins et directeur
    if (user?.role === 'Médecin' || user?.role === 'Directeur') {
      items.splice(4, 0, { id: 'demandes-travail', label: 'Demandes Travail', icon: CalendarDays });
    }

    if (user?.role === 'Directeur') {
      items.push({ id: 'plan-cabinet', label: 'Plan Cabinet', icon: MapPin });
      items.push({ id: 'salles', label: 'Gestion Salles', icon: Building2 });
      items.push({ id: 'stocks', label: 'Gestion Stocks', icon: Package });
      items.push({ id: 'admin', label: 'Administration', icon: Settings });
    }

    return items;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profil':
        return <MonProfilManager />;
      case 'personnel':
        return <PersonnelManager />;
      case 'planning':
        return <PlanningManager />;
      case 'conges':
        return <CongeManager />;
      case 'demandes-travail':
        return <DemandesTravailManager />;
      case 'messages':
        return <ChatManager />;
      case 'documents':
        return <CoffreFortManager />;
      case 'plan-cabinet':
        return <PlanCabinetManager />;
      case 'stocks':
        return <StocksManager />;
      case 'salles':
        return <SallesManager />;
      case 'admin':
        return <AdminManager />;
      default:
        return <PersonnelManager />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {getMenuItems().map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === item.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <NotificationToday />
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

// Main App Component
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;