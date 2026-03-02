/**
 * Page d'inscription / demande d'accès
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const API = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : '/api';

const InscriptionPage = ({ onBack, centres }) => {
  const [formData, setFormData] = useState({
    email: '',
    nom: '',
    prenom: '',
    telephone: '',
    centre_id: '',
    role_souhaite: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/inscriptions`, formData);
      setSuccess(true);
      toast.success('Demande envoyée avec succès !');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi de la demande');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0091B9] via-[#007494] to-[#19CD91] p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Demande envoyée !</h2>
            <p className="text-gray-600">
              Votre demande d'inscription a été transmise à l'administrateur. 
              Vous recevrez une réponse par email dès que votre compte sera créé.
            </p>
            <Button onClick={onBack} className="w-full">
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0091B9] via-[#007494] to-[#19CD91] p-8">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <CardTitle>Demande d'inscription</CardTitle>
              <CardDescription>Remplissez le formulaire pour demander un accès</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input
                  value={formData.prenom}
                  onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                  required
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => setFormData({...formData, nom: e.target.value})}
                  required
                  placeholder="DUPONT"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="jean.dupont@email.fr"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                placeholder="06 12 34 56 78"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Centre médical *</Label>
              <Select 
                value={formData.centre_id} 
                onValueChange={(value) => setFormData({...formData, centre_id: value})}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un centre" />
                </SelectTrigger>
                <SelectContent>
                  {centres.map((centre) => (
                    <SelectItem key={centre.id} value={centre.id}>
                      {centre.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Poste souhaité *</Label>
              <Select 
                value={formData.role_souhaite} 
                onValueChange={(value) => setFormData({...formData, role_souhaite: value})}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Médecin">Médecin</SelectItem>
                  <SelectItem value="Assistant">Assistant(e)</SelectItem>
                  <SelectItem value="Secrétaire">Secrétaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Message (optionnel)</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Informations complémentaires..."
                className="min-h-[80px]"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[#0091B9] to-[#007494]"
              disabled={loading}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer ma demande'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InscriptionPage;
