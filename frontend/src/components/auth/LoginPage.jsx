/**
 * Page de connexion
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, UserPlus } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import InscriptionPage from './InscriptionPage';

const API = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : '/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [centreId, setCentreId] = useState('');
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCentres, setLoadingCentres] = useState(true);
  const [showInscription, setShowInscription] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCentres = async () => {
      try {
        const response = await axios.get(`${API}/centres/public`);
        setCentres(response.data.centres || []);
      } catch (error) {
        console.error('Erreur chargement centres:', error);
        setCentres([]);
      } finally {
        setLoadingCentres(false);
      }
    };
    fetchCentres();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const selectedCentreId = (centreId && centreId !== 'all') ? centreId : null;
      const success = await login(email, password, selectedCentreId);
      if (success) {
        navigate('/');
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      toast.error(error.response?.data?.detail || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  if (showInscription) {
    return <InscriptionPage onBack={() => setShowInscription(false)} centres={centres} />;
  }

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Panneau gauche - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0091B9] via-[#007494] to-[#19CD91] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Eye className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">OphtaGestion</span>
          </div>
        </div>
        
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            Gestion simplifiée<br />de votre cabinet
          </h1>
          <p className="text-white/80 text-lg max-w-md">
            Planning, congés, équipes - tout en un seul endroit. Concentrez-vous sur vos patients.
          </p>
          
          <div className="flex gap-8 pt-8">
            <div>
              <div className="text-3xl font-bold text-white">98%</div>
              <div className="text-white/60 text-sm">Temps gagné</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-white/60 text-sm">Accessibilité</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-white/60 text-sm">Sécurisé</div>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 text-white/40 text-sm">
          © 2025 OphtaGestion - Tous droits réservés
        </div>
      </div>
      
      {/* Panneau droit - Formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[#0091B9] to-[#19CD91] rounded-xl flex items-center justify-center">
              <Eye className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-800">OphtaGestion</span>
          </div>
          
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenue</h2>
            <p className="text-gray-500">Connectez-vous à votre espace</p>
          </div>
          
          <Card className="border-0 shadow-xl bg-white rounded-2xl">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
                <div className="space-y-2">
                  <Label htmlFor="centre" className="text-sm font-semibold text-gray-700">
                    Centre médical
                  </Label>
                  <Select value={centreId} onValueChange={setCentreId} disabled={loadingCentres}>
                    <SelectTrigger id="centre" data-testid="centre-select" className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#0091B9]">
                      <SelectValue placeholder={loadingCentres ? "Chargement..." : "Tous les centres"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="font-medium">Tous les centres</span>
                      </SelectItem>
                      {centres.map((centre) => (
                        <SelectItem key={centre.id} value={centre.id}>
                          {centre.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Adresse email</Label>
                  <Input
                    id="email"
                    data-testid="email-input"
                    type="email"
                    placeholder="votre@email.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#0091B9] focus:ring-[#0091B9]/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Mot de passe</Label>
                  <Input
                    id="password"
                    data-testid="password-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#0091B9] focus:ring-[#0091B9]/20"
                  />
                </div>
                <Button 
                  type="submit" 
                  data-testid="login-submit-btn"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#0091B9] to-[#007494] hover:from-[#007494] hover:to-[#00576F] text-white font-semibold shadow-lg shadow-[#0091B9]/25 transition-all duration-200" 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Connexion...
                    </span>
                  ) : 'Se connecter'}
                </Button>
              </form>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400">Nouveau ?</span>
                </div>
              </div>
              
              <Button 
                type="button"
                variant="outline"
                onClick={() => setShowInscription(true)}
                className="w-full h-12 rounded-xl border-2 border-[#0091B9] text-[#0091B9] hover:bg-[#0091B9] hover:text-white font-semibold transition-all duration-200"
                data-testid="inscription-btn"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Demander un accès
              </Button>
            </CardContent>
          </Card>
          
          <p className="text-center text-sm text-gray-400">
            Problème de connexion ? Contactez votre administrateur
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
