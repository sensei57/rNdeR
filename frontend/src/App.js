import React, { useState, useEffect, createContext, useContext, useRef, useMemo, useCallback, Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Calendar, Users, Clock, FileText, MessageSquare, Settings, LogOut, Plus, Check, X, CalendarDays, Send, Trash2, Edit, ChevronLeft, ChevronRight, MapPin, Building2, AlertTriangle, AlertCircle, Package, Eye, Link, Upload, Bell, Menu, Copy, Download, FileDown, Smartphone, Phone, UserPlus, ArrowLeft, LayoutGrid, Filter, RefreshCw, MoreHorizontal, ChevronDown } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import usePWA from './hooks/usePWA';

// Import des composants extraits
import PlanningHeader from './components/planning/PlanningHeader';
import PlanningFilters from './components/planning/PlanningFilters';
import ChatManager from './components/chat/ChatManager';
import ActualitesManager from './components/dashboard/ActualitesManager';
import CongeManager from './components/conges/CongeManager';

// Configuration automatique de l'URL backend
// Utilise d'abord la variable d'environnement, sinon fallback pour Render.com
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (
  window.location.hostname.includes('test') 
    ? 'https://ope-francis-test.onrender.com' 
    : 'https://ope-francis.onrender.com'
);

const isTestMode = window.location.hostname.includes('test') || window.location.hostname.includes('preview');

const API = `${BACKEND_URL}/api`;

// Configuration axios pour retry automatique sur mobile
axios.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    // Retry jusqu'à 2 fois en cas d'erreur réseau
    if (!config || config.__retryCount >= 2) {
      return Promise.reject(error);
    }
    config.__retryCount = config.__retryCount || 0;
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response) {
      config.__retryCount += 1;
      console.log(`🔄 Retry ${config.__retryCount}/2 pour ${config.url}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * config.__retryCount));
      return axios(config);
    }
    return Promise.reject(error);
  }
);

// Log pour debug
console.log(`%c 🚀 MODE ${isTestMode ? 'TEST' : 'PROD'} ACTIF `, 
            `background: ${isTestMode ? '#ffeb3b' : '#4caf50'}; color: #000; font-weight: bold;`);
console.log(`%c 🔗 Backend: ${BACKEND_URL} `, 
            `background: #2196f3; color: #fff; font-weight: bold;`);

// Fonction utilitaire pour obtenir l'URL complète d'une photo
const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null;
  // Si c'est une URL locale uploadée (commence par /api)
  if (photoUrl.startsWith('/api')) {
    return `${BACKEND_URL}${photoUrl}`;
  }
  // Sinon c'est une URL externe complète
  return photoUrl;
};

// Fonction utilitaire pour trier les employés par rôle (Médecin > Assistant > Secrétaire) puis par prénom
const sortEmployeesByRoleThenName = (employees) => {
  const roleOrder = { 'Médecin': 1, 'Assistant': 2, 'Secrétaire': 3, 'Directeur': 4 };
  return [...employees].sort((a, b) => {
    // D'abord trier par rôle
    const roleA = roleOrder[a.role] || 99;
    const roleB = roleOrder[b.role] || 99;
    if (roleA !== roleB) return roleA - roleB;
    // Ensuite par prénom (alphabétique)
    return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
  });
};

// Fonction pour filtrer les employés par recherche de nom/prénom
const filterEmployeesBySearch = (employees, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return employees;
  const term = searchTerm.toLowerCase().trim();
  return employees.filter(emp => 
    (emp.prenom && emp.prenom.toLowerCase().includes(term)) ||
    (emp.nom && emp.nom.toLowerCase().includes(term)) ||
    (`${emp.prenom} ${emp.nom}`.toLowerCase().includes(term))
  );
};

// Composant Image avec fallback automatique vers initiales
const PhotoWithFallback = ({ src, prenom, nom, role, className, fallbackClassName, style }) => {
  const [hasError, setHasError] = useState(false);
  
  const initials = `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
  const roleClass = role === 'Médecin' ? 'medecin' : role === 'Assistant' ? 'assistant' : '';
  
  if (!src || hasError) {
    return (
      <div 
        className={fallbackClassName || `photo-fallback ${roleClass}`}
        style={style}
      >
        {initials}
      </div>
    );
  }
  
  return (
    <img 
      src={getPhotoUrl(src)}
      alt={`${prenom} ${nom}`}
      className={className}
      style={style}
      onError={() => setHasError(true)}
    />
  );
};

// Composant pour le contenu d'une carte de salle avec gestion d'erreur d'image
const RoomCardContent = ({ salle, occupation }) => {
  const [imageError, setImageError] = useState(false);
  const hasPhoto = occupation?.employe?.photo_url && !imageError;
  
  if (hasPhoto) {
    return (
      <>
        <img 
          src={getPhotoUrl(occupation.employe.photo_url)} 
          alt={occupation.employe?.prenom}
          className="room-photo-full"
          onError={() => setImageError(true)}
        />
        <div className="room-photo-overlay"></div>
        <div className="room-info-overlay">
          <div className="room-card-name">{salle.nom}</div>
          <div className="room-card-employee-name">{occupation.employe?.prenom}</div>
        </div>
      </>
    );
  }
  
  return (
    <>
      <div className="room-card-name">{salle.nom}</div>
      <div className={`room-card-initials-full ${
        occupation.employe?.role === 'Médecin' ? 'medecin' :
        occupation.employe?.role === 'Assistant' ? 'assistant' : ''
      }`}>
        {occupation.employe?.prenom?.[0]}{occupation.employe?.nom?.[0]}
      </div>
      <div className="room-card-employee-name">{occupation.employe?.prenom?.substring(0, 7)}</div>
    </>
  );
};

// Composant Plan du Cabinet avec scroll horizontal sur mobile et popup plein écran
// Ce composant charge ses propres données pour éviter les problèmes de timing
const CabinetPlanWithPopup = ({ user, centreActif }) => {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenPeriod, setFullscreenPeriod] = useState('matin');
  const [planMatin, setPlanMatin] = useState(null);
  const [planApresMidi, setPlanApresMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const today = new Date().toISOString().split('T')[0];
  
  // Charger les données du plan cabinet - se recharge quand le centre change
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const [matinResponse, apresMidiResponse] = await Promise.all([
          axios.get(`${API}/cabinet/plan/${today}?creneau=MATIN`),
          axios.get(`${API}/cabinet/plan/${today}?creneau=APRES_MIDI`)
        ]);
        console.log('[CabinetPlanWithPopup] Centre:', centreActif?.nom, 'Matin:', matinResponse.data?.salles?.length, 'salles');
        setPlanMatin(matinResponse.data);
        setPlanApresMidi(apresMidiResponse.data);
      } catch (error) {
        console.error('[CabinetPlanWithPopup] Erreur chargement:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchPlans();
    }
  }, [user, today, centreActif?.id]); // Recharger quand le centre change
  
  const renderPlanContent = (plan, periodTitle, periodEmoji, isFullscreen = false) => {
    if (!plan?.salles?.length) return null;
    
    // Filtrer les salles valides
    const validSalles = plan.salles.filter(s => s.position_x > 0 && s.position_x < 6);
    if (validSalles.length === 0) return null;
    
    // Calculer les dimensions de la grille
    const maxX = Math.max(...validSalles.map(s => s.position_x));
    const maxY = Math.max(...validSalles.map(s => s.position_y));
    const numCols = maxX; // nombre de colonnes (1-5 = 5 colonnes max)
    const numRows = maxY + 1; // nombre de lignes
    
    return (
      <div className={`cabinet-plan-period ${isFullscreen ? 'fullscreen-period' : ''}`}>
        <div className="cabinet-plan-period-header">
          <h3 className={`cabinet-plan-period-title ${periodTitle === 'Matin' ? 'morning' : 'afternoon'}`}>
            <span>{periodEmoji}</span> {periodTitle}
          </h3>
        </div>
        <div 
          className={`cabinet-plan-grid-responsive ${isFullscreen ? 'fullscreen-scroll' : ''}`}
          onClick={() => {
            if (!isFullscreen) {
              setFullscreenPeriod(periodTitle === 'Matin' ? 'matin' : 'apresmidi');
              setShowFullscreen(true);
            }
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${numCols}, minmax(55px, 1fr))`,
            gap: window.innerWidth < 768 ? '4px' : '8px',
            cursor: isFullscreen ? 'default' : 'pointer',
            minWidth: `${numCols * 60}px`
          }}
        >
          {validSalles.map(salle => {
            const occupation = salle.occupation;
            const adjustedX = salle.position_x > 0 ? salle.position_x - 1 : 0;
            
            let statusClass = 'libre';
            if (occupation) {
              if (salle.type_salle === 'MEDECIN') statusClass = 'medecin';
              else if (salle.type_salle === 'ASSISTANT') statusClass = 'assistant';
              else if (salle.type_salle === 'ATTENTE') statusClass = 'attente';
            }
            
            const hasPhoto = occupation?.employe?.photo_url;
            
            return (
              <div
                key={salle.id}
                className={`room-card-grid ${statusClass} ${hasPhoto ? 'has-photo' : ''}`}
                style={{
                  gridColumn: adjustedX + 1,
                  gridRow: salle.position_y + 1
                }}
              >
                {occupation && <div className="room-card-indicator"></div>}
                {occupation ? (
                  <RoomCardContent salle={salle} occupation={occupation} />
                ) : (
                  <>
                    <div className="room-card-name">{salle.nom}</div>
                    <div className="room-card-status">Libre</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {!isFullscreen && (
          <div className="cabinet-plan-tap-hint md:hidden">
            <span>👆 Appuyez pour agrandir</span>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <>
      <div className="cabinet-plan-container">
        <div className="cabinet-plan-header">
          <div className="cabinet-plan-title">
            <div className="cabinet-plan-title-icon">
              <MapPin className="h-5 w-5" />
            </div>
            <span>Plan du Cabinet</span>
          </div>
          <span className="cabinet-plan-date">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-[#0091B9] border-t-transparent rounded-full"></div>
          </div>
        ) : (planMatin?.salles?.length > 0 || planApresMidi?.salles?.length > 0) ? (
          <>
            <div className="cabinet-plan-grid-wrapper">
              {renderPlanContent(planMatin, 'Matin', '☀️')}
              {renderPlanContent(planApresMidi, 'Après-midi', '🌙')}
            </div>
            
            {/* Légende */}
            <div className="cabinet-legend">
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot medecin"></div>
                <span>Médecin</span>
              </div>
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot assistant"></div>
                <span>Assistant</span>
              </div>
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot attente"></div>
                <span>Attente</span>
              </div>
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot libre"></div>
                <span>Libre</span>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <MapPin className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="empty-state-title">Aucun planning pour aujourd'hui</p>
            <p className="empty-state-text">Le plan s'affichera une fois que des créneaux seront programmés</p>
          </div>
        )}
      </div>
      
      {/* Modal Plein Écran */}
      {showFullscreen && (
        <div className="cabinet-plan-fullscreen-modal" onClick={() => setShowFullscreen(false)}>
          <div className="cabinet-plan-fullscreen-content" onClick={e => e.stopPropagation()}>
            <button 
              className="cabinet-plan-fullscreen-close"
              onClick={() => setShowFullscreen(false)}
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="cabinet-plan-fullscreen-header">
              <h2>Plan du Cabinet</h2>
              <div className="cabinet-plan-fullscreen-tabs">
                <button 
                  className={`tab-btn ${fullscreenPeriod === 'matin' ? 'active' : ''}`}
                  onClick={() => setFullscreenPeriod('matin')}
                >
                  ☀️ Matin
                </button>
                <button 
                  className={`tab-btn ${fullscreenPeriod === 'apresmidi' ? 'active' : ''}`}
                  onClick={() => setFullscreenPeriod('apresmidi')}
                >
                  🌙 Après-midi
                </button>
              </div>
            </div>
            
            <div className="cabinet-plan-fullscreen-scroll">
              {fullscreenPeriod === 'matin' 
                ? renderPlanContent(planMatin, 'Matin', '☀️', true)
                : renderPlanContent(planApresMidi, 'Après-midi', '🌙', true)
              }
            </div>
            
            {/* Légende en plein écran */}
            <div className="cabinet-legend fullscreen-legend">
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot medecin"></div>
                <span>Médecin</span>
              </div>
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot assistant"></div>
                <span>Assistant</span>
              </div>
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot attente"></div>
                <span>Attente</span>
              </div>
              <div className="cabinet-legend-item">
                <div className="cabinet-legend-dot libre"></div>
                <span>Libre</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Composant carte Médecin avec gestion d'erreur d'image
const MedecinCard = ({ medecin, user, handleEditPersonnel, handleDeletePersonnel, getAssignedAssistants }) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md">
      <div className="relative">
        <div className="h-24 bg-gradient-to-br from-blue-500 to-blue-700"></div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-12">
          <div className="relative">
            {medecin.photo_url && !imageError ? (
              <img 
                src={getPhotoUrl(medecin.photo_url)} 
                alt={`${medecin.prenom} ${medecin.nom}`}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl font-bold">
                {medecin.prenom?.[0]}{medecin.nom?.[0]}
              </div>
            )}
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white"></div>
          </div>
        </div>
      </div>
      
      <CardContent className="pt-14 pb-4 text-center">
        <h3 className="text-lg font-bold text-gray-900">Dr. {medecin.prenom} {medecin.nom}</h3>
        <p className="text-sm text-gray-500 mt-1">{medecin.email}</p>
        
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-left">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            {medecin.telephone || 'Non renseigné'}
          </p>
          {medecin.date_naissance && (
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(medecin.date_naissance + 'T12:00:00').toLocaleDateString('fr-FR')}
            </p>
          )}
          <div className="pt-2">
            <p className="text-xs font-medium text-gray-500 mb-2">Assistants assignés:</p>
            <div className="flex flex-wrap gap-1">
              {getAssignedAssistants(medecin.id).map(assistant => (
                <Badge key={assistant?.id} variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                  {assistant?.prenom}
                </Badge>
              ))}
              {getAssignedAssistants(medecin.id).length === 0 && (
                <span className="text-xs text-gray-400 italic">Aucun</span>
              )}
            </div>
          </div>
        </div>
        
        {user?.role === 'Directeur' && (
          <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditPersonnel(medecin)}
              className="gap-1"
            >
              <Edit className="h-3 w-3" /> Modifier
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeletePersonnel(medecin.id, `${medecin.prenom} ${medecin.nom}`)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Composant carte Assistant avec gestion d'erreur d'image
const AssistantCard = ({ assistant, user, handleEditPersonnel, handleDeletePersonnel, personnelList }) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md">
      <div className="relative">
        <div className="h-24 bg-gradient-to-br from-emerald-500 to-emerald-700"></div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-12">
          <div className="relative">
            {assistant.photo_url && !imageError ? (
              <img 
                src={getPhotoUrl(assistant.photo_url)} 
                alt={`${assistant.prenom} ${assistant.nom}`}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl font-bold">
                {assistant.prenom?.[0]}{assistant.nom?.[0]}
              </div>
            )}
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white"></div>
          </div>
        </div>
      </div>
      
      <CardContent className="pt-14 pb-4 text-center">
        <h3 className="text-lg font-bold text-gray-900">{assistant.prenom} {assistant.nom}</h3>
        <p className="text-sm text-gray-500 mt-1">{assistant.email}</p>
        
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-left">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            {assistant.telephone || 'Non renseigné'}
          </p>
          {assistant.date_naissance && (
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(assistant.date_naissance + 'T12:00:00').toLocaleDateString('fr-FR')}
            </p>
          )}
          <div className="pt-2">
            <p className="text-xs font-medium text-gray-500 mb-2">Médecin assigné:</p>
            {assistant.medecin_assigne_id ? (
              <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">
                Dr. {personnelList.find(p => p.id === assistant.medecin_assigne_id)?.prenom || 'N/A'}
              </Badge>
            ) : (
              <span className="text-xs text-gray-400 italic">Non assigné</span>
            )}
          </div>
        </div>
        
        {user?.role === 'Directeur' && (
          <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditPersonnel(assistant)}
              className="gap-1"
            >
              <Edit className="h-3 w-3" /> Modifier
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeletePersonnel(assistant.id, `${assistant.prenom} ${assistant.nom}`)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Composant carte Secrétaire avec gestion d'erreur d'image
const SecretaireCard = ({ secretaire, user, handleEditPersonnel, handleDeletePersonnel }) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md">
      <div className="relative">
        <div className="h-24 bg-gradient-to-br from-purple-500 to-purple-700"></div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-12">
          <div className="relative">
            {secretaire.photo_url && !imageError ? (
              <img 
                src={getPhotoUrl(secretaire.photo_url)} 
                alt={`${secretaire.prenom} ${secretaire.nom}`}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl font-bold">
                {secretaire.prenom?.[0]}{secretaire.nom?.[0]}
              </div>
            )}
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-purple-500 rounded-full border-2 border-white"></div>
          </div>
        </div>
      </div>
      
      <CardContent className="pt-14 pb-4 text-center">
        <h3 className="text-lg font-bold text-gray-900">{secretaire.prenom} {secretaire.nom}</h3>
        <p className="text-sm text-gray-500 mt-1">{secretaire.email}</p>
        
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-left">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            {secretaire.telephone || 'Non renseigné'}
          </p>
          {secretaire.date_naissance && (
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(secretaire.date_naissance + 'T12:00:00').toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        
        {user?.role === 'Directeur' && (
          <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditPersonnel(secretaire)}
              className="gap-1"
            >
              <Edit className="h-3 w-3" /> Modifier
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeletePersonnel(secretaire.id, `${secretaire.prenom} ${secretaire.nom}`)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

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
  const [centres, setCentres] = useState([]);
  const [centreActif, setCentreActif] = useState(null);
  const [loading, setLoading] = useState(true);
  const maxRetries = 3;

  // Configuration axios avec retry automatique
  useEffect(() => {
    // Intercepteur pour retry automatique sur erreur réseau
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        const config = error.config;
        
        // Ne pas retry si c'est une erreur d'auth ou si on a déjà retry
        if (error.response?.status === 401 || error.response?.status === 403) {
          return Promise.reject(error);
        }
        
        // Retry sur erreur réseau (timeout, network error)
        if (!config._retryCount) {
          config._retryCount = 0;
        }
        
        if (config._retryCount < 2 && (!error.response || error.response.status >= 500)) {
          config._retryCount += 1;
          console.log(`Retry ${config._retryCount} pour ${config.url}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * config._retryCount));
          return axios(config);
        }
        
        return Promise.reject(error);
      }
    );
    
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Utiliser une ref pour le retry count pour éviter les problèmes d'état asynchrone
  const retryCountRef = useRef(0);
  
  const fetchCurrentUser = async (currentRetry = 0) => {
    try {
      const response = await axios.get(`${API}/users/me`, { timeout: 60000 });
      setUser(response.data);
      retryCountRef.current = 0; // Reset retry count on success
      
      // Charger les centres en parallèle avec un timeout plus long
      try {
        const centresResponse = await axios.get(`${API}/centres`, { timeout: 60000 });
        const allCentres = centresResponse.data.centres || [];
        
        if (response.data.role === 'Super-Admin' || response.data.role === 'Directeur') {
          setCentres(allCentres);
          
          if (response.data.centre_actif_id) {
            const actif = allCentres.find(c => c.id === response.data.centre_actif_id);
            setCentreActif(actif || allCentres[0] || null);
          } else if (allCentres.length > 0) {
            setCentreActif(allCentres[0]);
          }
        } else {
          const userCentreIds = response.data.centre_ids || (response.data.centre_id ? [response.data.centre_id] : []);
          if (userCentreIds.length > 0) {
            const userCentres = allCentres.filter(c => userCentreIds.includes(c.id));
            setCentres(userCentres);
            
            const centreActifId = response.data.centre_actif_id || userCentreIds[0];
            const activeCentre = userCentres.find(c => c.id === centreActifId);
            setCentreActif(activeCentre || userCentres[0] || null);
          }
        }
      } catch (centreError) {
        console.warn('Erreur chargement centres, utilisation des données en cache:', centreError);
        // Ne pas bloquer l'authentification si les centres échouent
      }
      
      setLoading(false);
    } catch (error) {
      console.error(`Erreur récupération utilisateur (tentative ${currentRetry + 1}/${maxRetries}):`, error);
      
      // Retry automatique sur erreur réseau ou serveur (pas sur 401/403)
      const isNetworkOrServerError = !error.response || error.response.status >= 500;
      const isAuthError = error.response?.status === 401 || error.response?.status === 403;
      
      if (!isAuthError && isNetworkOrServerError && currentRetry < maxRetries) {
        const nextRetry = currentRetry + 1;
        const delay = 1500 * nextRetry; // 1.5s, 3s, 4.5s
        console.log(`🔄 Retry ${nextRetry}/${maxRetries} dans ${delay/1000}s...`);
        
        // Afficher un toast si c'est le 2ème retry
        if (nextRetry === 2) {
          toast.info('Connexion en cours, veuillez patienter...');
        }
        
        setTimeout(() => fetchCurrentUser(nextRetry), delay);
        return; // Ne pas exécuter le finally ici
      }
      
      // Échec définitif : déconnecter
      setLoading(false);
      logout();
    }
  };

  const login = async (email, password, centreId = null) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password, centre_id: centreId });
      const { access_token, user: userData, centres: userCentres } = response.data;
      
      setToken(access_token);
      setUser(userData);
      setCentres(userCentres || []);
      
      // Définir le centre actif
      if (userCentres && userCentres.length > 0) {
        const actif = centreId 
          ? userCentres.find(c => c.id === centreId) 
          : userCentres[0];
        setCentreActif(actif || userCentres[0]);
      }
      
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Envoyer le token au Service Worker pour les réponses rapides
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'STORE_TOKEN',
          token: access_token
        });
      }
      
      toast.success('Connexion réussie !');
      
      return true;
    } catch (error) {
      const message = error.response?.data?.detail || 'Email ou mot de passe incorrect';
      toast.error(message);
      throw error;
    }
  };

  const switchCentre = async (centreId) => {
    try {
      const response = await axios.post(`${API}/centres/${centreId}/switch`);
      const newCentre = centres.find(c => c.id === centreId);
      setCentreActif(newCentre);
      
      // Mettre à jour l'utilisateur
      setUser(prev => ({ ...prev, centre_actif_id: centreId }));
      
      toast.success(response.data.message);
      
      // Recharger la page pour mettre à jour toutes les données
      window.location.reload();
    } catch (error) {
      toast.error('Erreur lors du changement de centre');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setCentres([]);
    setCentreActif(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Déconnexion réussie');
  };

  return (
    <AuthContext.Provider value={{ 
      user, setUser, token, setToken, 
      centres, setCentres, centreActif, setCentreActif,
      login, logout, switchCentre, loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Planning Context - Pour partager la date sélectionnée entre composants
const PlanningContext = createContext();

const usePlanning = () => {
  const context = useContext(PlanningContext);
  if (!context) {
    // Retourner des valeurs par défaut si le contexte n'est pas disponible
    return { 
      planningSelectedDate: new Date().toISOString().split('T')[0], 
      planningViewMode: 'jour',
      setPlanningSelectedDate: () => {},
      setPlanningViewMode: () => {}
    };
  }
  return context;
};

const PlanningProvider = ({ children }) => {
  const [planningSelectedDate, setPlanningSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [planningViewMode, setPlanningViewMode] = useState('jour');

  return (
    <PlanningContext.Provider value={{ 
      planningSelectedDate, 
      setPlanningSelectedDate, 
      planningViewMode, 
      setPlanningViewMode 
    }}>
      {children}
    </PlanningContext.Provider>
  );
};

// Login Component
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

  // Charger la liste des centres au montage
  useEffect(() => {
    const fetchCentres = async () => {
      try {
        const response = await axios.get(`${API}/centres/public`);
        setCentres(response.data.centres || []);
      } catch (error) {
        console.error('Erreur chargement centres:', error);
        // Fallback: essayer sans auth
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
      // Si "all" est sélectionné ou rien, on passe null (pour les Directeurs)
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

  // Formulaire d'inscription
  if (showInscription) {
    return <InscriptionPage onBack={() => setShowInscription(false)} centres={centres} />;
  }

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Panneau gauche - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0091B9] via-[#007494] to-[#19CD91] p-12 flex-col justify-between relative overflow-hidden">
        {/* Formes décoratives */}
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
          
          {/* Stats */}
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
          {/* Logo mobile */}
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
                {/* Sélection du centre - Optionnel pour les Directeurs */}
                <div className="space-y-2">
                  <Label htmlFor="centre" className="text-sm font-semibold text-gray-700">
                    Centre médical
                  </Label>
                  <Select 
                    value={centreId} 
                    onValueChange={setCentreId}
                    disabled={loadingCentres}
                  >
                    <SelectTrigger 
                      id="centre"
                      data-testid="centre-select"
                      className="h-12 rounded-xl border-2 border-gray-200 focus:border-[#0091B9]"
                    >
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
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                    Adresse email
                  </Label>
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
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    Mot de passe
                  </Label>
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
              
              {/* Séparateur */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400">Nouveau ?</span>
                </div>
              </div>
              
              {/* Bouton d'inscription */}
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

// Page d'inscription
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

// PWA Install Banner Component
const PWAInstallBanner = () => {
  const { isInstallable, isInstalled, isIOS, installApp, iOSInstructions } = usePWA();
  const [showBanner, setShowBanner] = useState(true);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Ne pas afficher si déjà installé ou si l'utilisateur a fermé le banner
  if (isInstalled || !showBanner) return null;

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      const success = await installApp();
      if (success) {
        toast.success('Application installée avec succès !');
        setShowBanner(false);
      }
    }
  };

  // Afficher seulement si installable (Chrome/Edge) ou iOS
  if (!isInstallable && !isIOS) return null;

  return (
    <>
      {/* Petit bouton d'installation discret */}
      <button 
        onClick={handleInstall}
        className="pwa-install-floating-btn"
        title="Installer l'application"
      >
        <Download className="h-4 w-4" />
        <span>Installer</span>
        <button 
          onClick={(e) => { e.stopPropagation(); setShowBanner(false); }}
          className="pwa-close-btn"
        >
          <X className="h-3 w-3" />
        </button>
      </button>

      {/* Modal iOS avec instructions */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              Installer sur iPhone/iPad
            </DialogTitle>
            <DialogDescription>
              Suivez ces étapes pour ajouter l'application à votre écran d'accueil
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">1</div>
              <div>
                <p className="font-medium">Appuyez sur le bouton Partager</p>
                <p className="text-sm text-gray-500">Le bouton avec une flèche vers le haut (⬆️) en bas de Safari</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">2</div>
              <div>
                <p className="font-medium">Sélectionnez "Sur l'écran d'accueil"</p>
                <p className="text-sm text-gray-500">Faites défiler vers le bas si nécessaire</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">3</div>
              <div>
                <p className="font-medium">Appuyez sur "Ajouter"</p>
                <p className="text-sm text-gray-500">L'icône OphtaCare apparaîtra sur votre écran d'accueil</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowIOSModal(false)}>J'ai compris</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
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

// Push Notification Manager Component
const PushNotificationManager = () => {
  const { user, centreActif } = useAuth();
  const [permission, setPermission] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');
  const [subscribed, setSubscribed] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    if (user) {
      checkSubscription();
      fetchDevices();
    }
  }, [user]);

  const fetchDevices = async () => {
    try {
      setLoadingDevices(true);
      const response = await axios.get(`${API}/notifications/devices`);
      const devicesList = response.data?.devices || [];
      setDevices(devicesList);
      // Si l'utilisateur a des appareils, il est considéré comme abonné
      if (devicesList.length > 0) {
        setSubscribed(true);
      }
    } catch (error) {
      console.error('Erreur chargement appareils:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const checkSubscription = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          setSubscribed(true);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'abonnement:', error);
      }
    }
  };

  const requestPermission = async () => {
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm === 'granted') {
        await subscribeToPush();
        toast.success('Notifications activées ! Vous recevrez votre planning chaque matin à 7h45.');
      } else {
        toast.error('Notifications refusées. Vous ne recevrez pas les alertes.');
      }
    } catch (error) {
      console.error('Erreur lors de la demande de permission:', error);
      toast.error('Erreur lors de l\'activation des notifications');
    }
  };

  const subscribeToPush = async () => {
    // Collecter les informations de l'appareil
    const userAgent = navigator.userAgent;
    let browserName = 'Inconnu';
    let osName = 'Inconnu';
    let deviceName = 'Appareil';

    // Détecter le navigateur
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browserName = 'Chrome';
    else if (userAgent.includes('Firefox')) browserName = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browserName = 'Safari';
    else if (userAgent.includes('Edg')) browserName = 'Edge';
    else if (userAgent.includes('Opera')) browserName = 'Opera';

    // Détecter l'OS
    if (userAgent.includes('Windows')) osName = 'Windows';
    else if (userAgent.includes('Mac')) osName = 'macOS';
    else if (userAgent.includes('iPhone')) { osName = 'iOS'; deviceName = 'iPhone'; }
    else if (userAgent.includes('iPad')) { osName = 'iPadOS'; deviceName = 'iPad'; }
    else if (userAgent.includes('Android')) { osName = 'Android'; deviceName = 'Android'; }
    else if (userAgent.includes('Linux')) osName = 'Linux';

    // Construire le nom de l'appareil
    if (deviceName === 'Appareil') {
      deviceName = `${osName} - ${browserName}`;
    } else {
      deviceName = `${deviceName} - ${browserName}`;
    }

    try {
      // Essayer d'obtenir un token Firebase
      let token = null;
      try {
        // ÉTAPE 1: Désinscrire TOUS les anciens Service Workers pour éviter les credentials périmés
        console.log('🧹 Nettoyage des anciens Service Workers...');
        const existingRegistrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of existingRegistrations) {
          console.log('🗑️ Désinscription SW:', reg.scope);
          await reg.unregister();
        }
        
        // Attendre un peu pour s'assurer que tout est nettoyé
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { messaging, getToken } = await import('./firebase.js');
        if (messaging) {
          // ÉTAPE 2: Enregistrer un nouveau Service Worker propre
          console.log('📝 Enregistrement nouveau Service Worker...');
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            updateViaCache: 'none' // Force le téléchargement du SW à chaque fois
          });
          console.log('✅ Service Worker enregistré:', registration);
          
          // Attendre que le SW soit actif
          if (registration.installing) {
            await new Promise(resolve => {
              registration.installing.addEventListener('statechange', function() {
                if (this.state === 'activated') resolve();
              });
            });
          }
          
          // ÉTAPE 3: Obtenir le token avec la VAPID key depuis l'environnement
          const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
          
          token = await getToken(messaging, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: registration
          });
          console.log('✅ Token FCM obtenu:', token ? token.substring(0, 20) + '...' : 'null');
        }
      } catch (firebaseError) {
        console.error('❌ Erreur Firebase:', firebaseError.message);
        console.error('❌ Détails:', firebaseError);
        // Générer un token local unique pour cet appareil
        token = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      if (!token) {
        // Générer un token local si Firebase n'a pas fonctionné
        token = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Enregistrer le token au backend avec les infos appareil ET le centre
      await axios.post(`${API}/notifications/subscribe`, {
        token: token,
        userId: user.id,
        centre_id: centreActif?.id || null,
        device_info: {
          userAgent: userAgent,
          platform: navigator.platform,
          deviceName: deviceName,
          browser: browserName,
          os: osName
        }
      });
      
      setSubscribed(true);
      // Recharger la liste des appareils
      await fetchDevices();
      toast.success(`✅ Notifications activées sur ${deviceName} !`);
    } catch (error) {
      console.error('Erreur lors de l\'abonnement:', error);
      toast.error('Erreur: ' + (error.response?.data?.detail || error.message));
    }
  };

  const testNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🏥 Planning Test', {
        body: 'Test de notification - Votre planning serait affiché ici chaque matin à 7h45',
        icon: '/icon-192.png',
        tag: 'test-notification'
      });
      toast.success('Notification de test envoyée !');
    } else {
      toast.error('Notifications non autorisées');
    }
  };

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
        <p className="text-gray-600">
          ⚠️ Votre navigateur ne supporte pas les notifications push. Utilisez Chrome, Firefox ou Safari récent.
        </p>
      </div>
    );
  }

  if (permission === 'denied') {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm space-y-3">
        <p className="text-red-800 font-medium">
          ⚠️ Notifications bloquées
        </p>
        <p className="text-red-700 text-xs">
          Pour recevoir votre planning quotidien, vous devez autoriser les notifications dans les paramètres de votre appareil.
        </p>
        
        <div className="bg-white rounded p-3 text-xs text-gray-700 space-y-2">
          <p className="font-semibold">📱 Comment réactiver :</p>
          {isIOS ? (
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Ouvrez <strong>Réglages</strong> de votre iPhone/iPad</li>
              <li>Descendez et appuyez sur <strong>Safari</strong> (ou votre navigateur)</li>
              <li>Appuyez sur <strong>Notifications</strong></li>
              <li>Trouvez ce site et activez les notifications</li>
            </ol>
          ) : isAndroid ? (
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Appuyez sur le <strong>cadenas 🔒</strong> dans la barre d'adresse</li>
              <li>Appuyez sur <strong>Autorisations</strong> ou <strong>Paramètres du site</strong></li>
              <li>Activez <strong>Notifications</strong></li>
              <li>Rechargez la page</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Cliquez sur le <strong>cadenas 🔒</strong> dans la barre d'adresse</li>
              <li>Cliquez sur <strong>Paramètres du site</strong></li>
              <li>Changez <strong>Notifications</strong> sur "Autoriser"</li>
              <li>Rechargez la page</li>
            </ol>
          )}
        </div>
        
        <Button 
          onClick={() => {
            // Tenter de redemander (fonctionne sur certains navigateurs après un délai)
            requestPermission();
          }}
          size="sm"
          variant="outline"
          className="w-full border-red-300 text-red-700 hover:bg-red-100"
        >
          🔄 Réessayer d'activer
        </Button>
      </div>
    );
  }

  if (permission === 'granted' && subscribed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">Notifications activées ✓</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={testNotification} 
              size="sm" 
              variant="outline"
              className="text-xs"
            >
              Test
            </Button>
          </div>
        </div>
        
        {/* Liste des appareils */}
        <DevicesList />
        
        {/* Boutons d'action */}
        <div className="flex flex-col gap-2 pt-2 border-t border-green-200">
          {/* BOUTON PRINCIPAL - Forcer réactivation */}
          <Button 
            onClick={async () => {
              toast.loading('Réactivation en cours...', { id: 'reactivate' });
              try {
                // 1. Nettoyer tous les Service Workers
                console.log('🧹 Nettoyage complet...');
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                  await reg.unregister();
                }
                
                // 2. Supprimer les caches
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                  await caches.delete(name);
                }
                
                // 3. Attendre
                await new Promise(r => setTimeout(r, 1000));
                
                // 4. Ré-inscrire
                await subscribeToPush();
                
                toast.success('✅ Notifications réactivées avec succès !', { id: 'reactivate' });
              } catch (error) {
                console.error('Erreur réactivation:', error);
                toast.error('Erreur: ' + error.message, { id: 'reactivate' });
              }
            }} 
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            🔄 Forcer la réactivation des notifications
          </Button>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={subscribeToPush} 
              size="sm" 
              variant="outline"
              className="flex-1 text-xs border-green-300 text-green-700 hover:bg-green-100"
            >
              ➕ Ajouter cet appareil
            </Button>
            <Button 
              onClick={async () => {
                try {
                  // Désabonner de Firebase
                  const registration = await navigator.serviceWorker.ready;
                  const subscription = await registration.pushManager.getSubscription();
                  if (subscription) {
                    await subscription.unsubscribe();
                  }
                  setSubscribed(false);
                  toast.success('Notifications désactivées sur cet appareil');
                } catch (error) {
                  console.error('Erreur désabonnement:', error);
                  toast.error('Erreur lors de la désactivation');
                }
              }} 
              size="sm" 
              variant="outline"
              className="flex-1 text-xs border-red-300 text-red-700 hover:bg-red-100"
            >
              🔕 Désactiver sur cet appareil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-900">
            📱 Recevez votre planning quotidien
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Activez les notifications pour recevoir chaque matin votre planning (salle + collègues)
          </p>
        </div>
        <Button onClick={requestPermission} size="sm" className="ml-4">
          Activer
        </Button>
      </div>
    </div>
  );
};

// Composant pour afficher la liste des appareils enregistrés
const DevicesList = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchDevices();
  }, []);
  
  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${API}/notifications/devices`);
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const removeDevice = async (deviceId) => {
    if (!window.confirm('Supprimer cet appareil des notifications ?')) return;
    
    try {
      await axios.delete(`${API}/notifications/devices/${deviceId}`);
      toast.success('Appareil supprimé');
      fetchDevices();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };
  
  const getDeviceIcon = (os) => {
    if (os?.includes('iOS') || os?.includes('iPhone') || os?.includes('iPad')) return '📱';
    if (os?.includes('Android')) return '📱';
    if (os?.includes('Windows')) return '💻';
    if (os?.includes('Mac')) return '🖥️';
    return '📟';
  };
  
  if (loading) return null;
  
  if (devices.length === 0) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-green-200">
      <p className="text-xs font-medium text-green-700 mb-2">
        📲 Appareils enregistrés ({devices.length}/5)
      </p>
      <div className="space-y-2">
        {devices.map((device, index) => (
          <div 
            key={device.device_id || index} 
            className="flex items-center justify-between bg-white rounded px-2 py-1.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <span>{getDeviceIcon(device.os)}</span>
              <div>
                <p className="font-medium text-gray-800">{device.device_name || 'Appareil'}</p>
                <p className="text-gray-500 text-[10px]">
                  {device.registered_at ? new Date(device.registered_at).toLocaleDateString('fr-FR') : 'Date inconnue'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => removeDevice(device.device_id)}
              className="text-red-500 hover:text-red-700 p-1"
              title="Supprimer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Notifications Badge Component
const NotificationBadge = ({ setActiveTab }) => {
  const { user } = useAuth();
  const [showPanel, setShowPanel] = useState(false);
  const [demandesConges, setDemandesConges] = useState([]);
  const [demandesTravail, setDemandesTravail] = useState([]);
  const [userNotifications, setUserNotifications] = useState([]);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(() => {
    const stored = localStorage.getItem('notificationsLastSeen');
    return stored ? parseInt(stored) : Date.now();
  });

  useEffect(() => {
    // Polling intelligent pour les notifications
    const startPolling = (fetchFn) => {
      fetchFn();
      return setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchFn();
        }
      }, 45000); // 45 secondes au lieu de 30
    };
    
    if (user?.role === 'Directeur' || user?.role === 'Super-Admin') {
      const interval = startPolling(fetchNotifications);
      return () => clearInterval(interval);
    }
    
    if (user) {
      const interval = startPolling(fetchUserNotifications);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUserNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      // Garder TOUTES les notifications, pas seulement les non lues
      // S'assurer que c'est un tableau
      setUserNotifications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications utilisateur');
      setUserNotifications([]);
    }
  };

  const fetchNotifications = async () => {
    try {
      const [congesRes, travailRes] = await Promise.all([
        axios.get(`${API}/conges`),
        axios.get(`${API}/demandes-travail`)
      ]);

      const congesData = Array.isArray(congesRes.data) ? congesRes.data : [];
      const travailData = Array.isArray(travailRes.data) ? travailRes.data : [];
      
      const congesEnAttente = congesData.filter(d => d.statut === 'EN_ATTENTE');
      const travailEnAttente = travailData.filter(d => d.statut === 'EN_ATTENTE');

      setDemandesConges(congesEnAttente);
      setDemandesTravail(travailEnAttente);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications');
      setDemandesConges([]);
      setDemandesTravail([]);
    }
  };

  const handleNotificationClick = (type) => {
    // Naviguer vers la page appropriée
    if (setActiveTab) {
      setActiveTab(type);
    }
    
    // Fermer le panneau
    setShowPanel(false);
  };

  const handleBellClick = () => {
    // Ouvrir/fermer le panneau
    const newShowPanel = !showPanel;
    setShowPanel(newShowPanel);
    
    // Si on ouvre le panneau, mettre à jour le timestamp
    if (newShowPanel) {
      const now = Date.now();
      setLastSeenTimestamp(now);
      localStorage.setItem('notificationsLastSeen', now.toString());
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${API}/notifications/${notificationId}`);
      // Retirer de la liste locale
      setUserNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification supprimée');
    } catch (error) {
      console.error('Erreur lors de la suppression de la notification');
      toast.error('Erreur lors de la suppression');
    }
  };

  const deleteDemande = async (type, demandeId) => {
    // Marquer la demande comme "vue" en la retirant de la liste locale
    if (type === 'conge') {
      setDemandesConges(prev => prev.filter(d => d.id !== demandeId));
    } else if (type === 'travail') {
      setDemandesTravail(prev => prev.filter(d => d.id !== demandeId));
    }
    toast.success('Notification retirée');
  };

  // Compter les NOUVELLES notifications (créées après lastSeenTimestamp)
  const countNewNotifications = () => {
    let count = 0;
    
    // Pour le directeur : demandes en attente créées après le dernier vu
    if (user?.role === 'Directeur') {
      (demandesConges || []).forEach(d => {
        const createdAt = new Date(d.created_at || d.date_creation || 0).getTime();
        if (createdAt > lastSeenTimestamp) count++;
      });
      (demandesTravail || []).forEach(d => {
        const createdAt = new Date(d.created_at || d.date_creation || 0).getTime();
        if (createdAt > lastSeenTimestamp) count++;
      });
    }
    
    // Pour tous : notifications personnelles créées après le dernier vu
    (userNotifications || []).forEach(n => {
      const sentAt = new Date(n.sent_at || 0).getTime();
      if (sentAt > lastSeenTimestamp) count++;
    });
    
    return count;
  };

  const totalNewNotifications = countNewNotifications();

  // Compter le total réel de notifications dans les données (pour savoir si on affiche la cloche)
  const totalRealNotifications = (userNotifications || []).length + (demandesConges || []).length + (demandesTravail || []).length;

  // Afficher la cloche si : il y a des notifications OU le panneau est ouvert
  const showBell = totalRealNotifications > 0 || showPanel;

  if (!showBell) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={handleBellClick}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {totalNewNotifications > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {totalNewNotifications}
          </span>
        )}
      </Button>

      {showPanel && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications ({(userNotifications || []).length + (demandesConges || []).length + (demandesTravail || []).length})
            </h3>
          </div>

          {/* Notifications personnelles */}
          {(userNotifications || []).length > 0 && (
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">
                Mes notifications ({(userNotifications || []).length})
              </h4>
              <div className="space-y-2">
                {(userNotifications || []).slice(0, 5).map(notif => (
                  <div 
                    key={notif.id} 
                    className="text-sm bg-blue-50 p-2 rounded border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => handleNotificationClick('planning', notif.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-blue-900">{notif.title}</p>
                        <p className="text-xs text-blue-700">{notif.body}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notif.sent_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="text-red-600 hover:text-red-800 text-lg ml-2 flex-shrink-0 hover:bg-red-100 rounded px-1"
                        title="Supprimer cette notification"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications directeur */}
          {user?.role === 'Directeur' && (
            <>
              {/* Demandes de congés */}
              {(demandesConges || []).length > 0 && (
                <div className="p-4 border-b">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">
                    Demandes de Congés ({(demandesConges || []).length})
                  </h4>
                  <div className="space-y-2">
                    {(demandesConges || []).map(demande => (
                      <div 
                        key={demande.id} 
                        className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
                        onClick={() => handleNotificationClick('conges')}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{demande.utilisateur?.prenom} {demande.utilisateur?.nom}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(demande.date_debut).toLocaleDateString('fr-FR')} - {new Date(demande.date_fin).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDemande('conge', demande.id);
                            }}
                            className="text-red-600 hover:text-red-800 text-lg ml-2 flex-shrink-0 hover:bg-red-100 rounded px-1"
                            title="Retirer de la liste"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Demandes de travail */}
              {(demandesTravail || []).length > 0 && (
                <div className="p-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">
                    Demandes de Travail ({(demandesTravail || []).length})
                  </h4>
                  <div className="space-y-2">
                    {(demandesTravail || []).map(demande => (
                      <div 
                        key={demande.id} 
                        className="text-sm bg-blue-50 p-2 rounded border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => handleNotificationClick('demandes-travail')}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">Dr. {demande.medecin?.prenom} {demande.medecin?.nom}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(demande.date_demandee).toLocaleDateString('fr-FR')} - {demande.creneau === 'MATIN' ? 'Matin' : demande.creneau === 'APRES_MIDI' ? 'Après-midi' : 'Journée'}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDemande('travail', demande.id);
                            }}
                            className="text-red-600 hover:text-red-800 text-lg ml-2 flex-shrink-0 hover:bg-red-100 rounded px-1"
                            title="Retirer de la liste"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="p-3 border-t bg-gray-50 text-center">
            <button
              onClick={() => setShowPanel(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Dashboard Navigation
const Navigation = ({ menuOpen, setMenuOpen, menuItems, activeTab, setActiveTab }) => {
  const { user, logout, setUser, centres, centreActif, switchCentre } = useAuth();
  const isSuperAdmin = user?.role === 'Super-Admin' || user?.role === 'Directeur';

  const handleStopImpersonation = async () => {
    try {
      const originalToken = localStorage.getItem('originalToken');
      if (originalToken) {
        // Restaurer le token original
        localStorage.setItem('token', originalToken);
        localStorage.removeItem('originalToken');
        localStorage.removeItem('isImpersonating');
        
        // Mettre à jour l'en-tête d'autorisation d'axios
        axios.defaults.headers.common['Authorization'] = `Bearer ${originalToken}`;
        
        // Récupérer les infos du directeur
        const response = await axios.get(`${API}/users/me`);
        setUser(response.data);
        
        toast.success('Retour à votre compte directeur');
        
        // Rafraîchir la page pour éviter les problèmes de state
        window.location.reload();
      }
    } catch (error) {
      toast.error('Erreur lors du retour au compte directeur');
    }
  };

  const getInitials = (nom, prenom) => {
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Super-Admin':
      case 'Directeur': return 'bg-gradient-to-br from-red-500 to-red-600';
      case 'Manager': return 'bg-gradient-to-br from-orange-500 to-orange-600';
      case 'Médecin': return 'bg-gradient-to-br from-[#0091B9] to-[#007494]';
      case 'Assistant': return 'bg-gradient-to-br from-[#19CD91] to-[#14A474]';
      case 'Secrétaire': return 'bg-gradient-to-br from-purple-500 to-purple-600';
      default: return 'bg-gradient-to-br from-gray-400 to-gray-500';
    }
  };

  // Séparer les items en deux catégories : items généraux (visibles dans la barre) et items admin (dans "Plus")
  // Les items admin sont : Administration et Gestion Centres
  const adminItemIds = ['admin', 'centres'];
  const mainMenuItems = menuItems.filter(item => !adminItemIds.includes(item.id));
  const moreMenuItems = menuItems.filter(item => adminItemIds.includes(item.id));

  return (
    <>
      {/* Navbar principale */}
      <nav className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50" data-testid="main-navbar">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              {/* Bouton Menu Hamburger - MOBILE ONLY */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2.5 rounded-xl text-gray-500 hover:text-[#0091B9] hover:bg-[#E6F4F8] transition-all duration-200"
                aria-label="Menu"
                data-testid="menu-toggle-btn"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              {/* Logo et Titre */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-[#0091B9] to-[#19CD91] rounded-xl flex items-center justify-center shadow-sm">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-gray-800 hidden sm:block">
                  OphtaGestion
                </h1>
              </div>
              
              {/* Sélecteur de centre (visible si l'utilisateur a accès à plusieurs centres) */}
              {centres.length > 0 && (
                <div className="hidden md:block">
                  <Select 
                    value={centreActif?.id || ''} 
                    onValueChange={(value) => switchCentre(value)}
                    disabled={centres.length === 1}
                  >
                    <SelectTrigger 
                      className={`h-9 w-[180px] border-[#0091B9]/30 bg-[#E6F4F8]/50 text-sm ${centres.length === 1 ? 'cursor-default' : ''}`}
                      data-testid="centre-switcher"
                    >
                      <Building2 className="h-4 w-4 mr-2 text-[#0091B9]" />
                      <SelectValue placeholder="Sélectionner un centre" />
                    </SelectTrigger>
                    {centres.length > 1 && (
                      <SelectContent>
                        {centres.map((centre) => (
                          <SelectItem key={centre.id} value={centre.id}>
                            {centre.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    )}
                  </Select>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <NotificationBadge setActiveTab={setActiveTab} />
              
              <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
              
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10 ring-2 ring-white shadow-md">
                  <AvatarFallback className={`${getRoleColor(user?.role)} text-white text-sm font-semibold`}>
                    {getInitials(user?.nom, user?.prenom)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm hidden md:block">
                  <p className="font-semibold text-gray-800">
                    {user?.prenom} {user?.nom}
                  </p>
                  <Badge variant="secondary" className="text-xs font-medium bg-gray-100 text-gray-600 border-0">
                    {user?.role === 'Directeur' ? 'Super-Admin' : user?.role}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {localStorage.getItem('isImpersonating') === 'true' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStopImpersonation}
                    className="flex items-center space-x-1.5 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 rounded-xl"
                    data-testid="stop-impersonation-btn"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Retour Directeur</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="flex items-center space-x-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  data-testid="logout-btn"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Sélecteur de centre mobile (visible si plusieurs centres) */}
        {centres.length > 1 && (
          <div className="md:hidden px-4 pb-2">
            <Select 
              value={centreActif?.id || ''} 
              onValueChange={(value) => switchCentre(value)}
            >
              <SelectTrigger className="w-full h-9 border-[#0091B9]/30 bg-[#E6F4F8]/50 text-sm">
                <Building2 className="h-4 w-4 mr-2 text-[#0091B9]" />
                <SelectValue placeholder="Sélectionner un centre" />
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
        )}
      </nav>

      {/* Barre de navigation horizontale - DESKTOP ONLY */}
      <div className="hidden lg:block bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-16 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center space-x-1">
              {mainMenuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    data-testid={`nav-desktop-${item.id}`}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#0091B9] to-[#007494] text-white shadow-md'
                        : 'text-gray-600 hover:text-[#0091B9] hover:bg-[#E6F4F8]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : ''}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              
              {/* Menu "Plus" pour les items supplémentaires */}
              {moreMenuItems.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-[#0091B9] hover:bg-[#E6F4F8] transition-all duration-200">
                    <MoreHorizontal className="h-4 w-4" />
                    <span>Plus</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  
                  {/* Dropdown menu */}
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="p-2">
                      {moreMenuItems.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            data-testid={`nav-more-${item.id}`}
                            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isActive
                                ? 'bg-[#E6F4F8] text-[#0091B9]'
                                : 'text-gray-600 hover:text-[#0091B9] hover:bg-[#E6F4F8]'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Menu déroulant mobile - MOBILE ONLY */}
      {menuOpen && (
        <div className="lg:hidden absolute left-4 top-[72px] w-72 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-gray-100 z-50 animate-scale-in max-h-[calc(100vh-100px)] overflow-y-auto">
          <div className="p-3">
            {/* En-tête du menu */}
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Navigation</p>
            </div>
            <nav className="space-y-1">
              {menuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMenuOpen(false);
                    }}
                    data-testid={`nav-item-${item.id}`}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#0091B9] to-[#007494] text-white shadow-md shadow-[#0091B9]/25'
                        : 'text-gray-600 hover:text-[#0091B9] hover:bg-[#E6F4F8]'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
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
    date_naissance: '',
    photo_url: '',
    password: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Tous les utilisateurs voient tout le personnel et toutes les assignations
      const [usersRes, assignationsRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/assignations`)
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setAssignations(Array.isArray(assignationsRes.data) ? assignationsRes.data : []);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getUsersByRole = (role) => {
    return (users || []).filter(u => u.role === role && u.actif);
  };

  const getAssignedAssistants = (medecinId) => {
    return (assignations || [])
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
          date_naissance: newPersonnel.date_naissance || null,
          photo_url: newPersonnel.photo_url || null,
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
      date_naissance: personnel.date_naissance || '',
      photo_url: personnel.photo_url || '',
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
      date_naissance: '',
      photo_url: '',
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
                
                <div className="space-y-2">
                  <Label htmlFor="date_naissance">Date de naissance</Label>
                  <Input
                    id="date_naissance"
                    type="date"
                    value={newPersonnel.date_naissance}
                    onChange={(e) => setNewPersonnel({...newPersonnel, date_naissance: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Photo de profil</Label>
                  <div className="flex flex-col items-center space-y-3">
                    {/* Aperçu de la photo */}
                    {newPersonnel.photo_url && (
                      <div className="relative">
                        <img 
                          src={getPhotoUrl(newPersonnel.photo_url)} 
                          alt="Aperçu" 
                          className="w-24 h-24 rounded-full object-cover border-4 border-teal-200 shadow-lg"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        <button
                          type="button"
                          onClick={() => setNewPersonnel({...newPersonnel, photo_url: ''})}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    
                    {/* Bouton d'upload */}
                    <div className="flex flex-col items-center space-y-2 w-full">
                      <input
                        type="file"
                        id="photo_upload"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          // Vérifier la taille (max 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('La photo ne doit pas dépasser 5 Mo');
                            return;
                          }
                          
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            const response = await axios.post(`${API}/upload/photo`, formData, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            
                            setNewPersonnel({...newPersonnel, photo_url: response.data.url});
                            toast.success('Photo téléchargée avec succès');
                          } catch (error) {
                            console.error('Erreur upload:', error);
                            toast.error('Erreur lors du téléchargement de la photo');
                          }
                          
                          // Reset l'input pour permettre de re-sélectionner le même fichier
                          e.target.value = '';
                        }}
                      />
                      <label
                        htmlFor="photo_upload"
                        className="flex items-center justify-center px-4 py-2 bg-teal-600 text-white rounded-lg cursor-pointer hover:bg-teal-700 transition-colors"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {newPersonnel.photo_url ? 'Changer la photo' : 'Télécharger une photo'}
                      </label>
                      <p className="text-xs text-gray-500">JPG, PNG, GIF ou WEBP (max 5 Mo)</p>
                    </div>
                    
                    {/* Option URL alternative */}
                    <div className="w-full pt-2 border-t">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                          Ou coller une URL d'image
                        </summary>
                        <Input
                          className="mt-2"
                          value={newPersonnel.photo_url?.startsWith('/api') ? '' : newPersonnel.photo_url}
                          onChange={(e) => setNewPersonnel({...newPersonnel, photo_url: e.target.value})}
                          placeholder="https://exemple.com/photo.jpg"
                        />
                      </details>
                    </div>
                  </div>
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
        <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
          <TabsTrigger value="medecins">
            Médecins ({getUsersByRole('Médecin').length})
          </TabsTrigger>
          <TabsTrigger value="assistants">
            Assistants ({getUsersByRole('Assistant').length})
          </TabsTrigger>
          <TabsTrigger value="secretaires">
            Secrétaires ({getUsersByRole('Secrétaire').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="medecins">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {getUsersByRole('Médecin').map(medecin => (
              <MedecinCard 
                key={medecin.id} 
                medecin={medecin} 
                user={user}
                handleEditPersonnel={handleEditPersonnel}
                handleDeletePersonnel={handleDeletePersonnel}
                getAssignedAssistants={getAssignedAssistants}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="assistants">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {getUsersByRole('Assistant').map(assistant => (
              <AssistantCard 
                key={assistant.id} 
                assistant={assistant} 
                user={user}
                handleEditPersonnel={handleEditPersonnel}
                handleDeletePersonnel={handleDeletePersonnel}
                personnelList={users}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="secretaires">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {getUsersByRole('Secrétaire').map(secretaire => (
              <SecretaireCard 
                key={secretaire.id} 
                secretaire={secretaire} 
                user={user}
                handleEditPersonnel={handleEditPersonnel}
                handleDeletePersonnel={handleDeletePersonnel}
              />
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

  return (
    <div className="space-y-6" data-testid="salles-manager">
      {/* Header moderne avec gradient */}
      <div className="bg-gradient-to-r from-[#0091B9] via-[#007494] to-[#19CD91] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-7 w-7" />
              Gestion des Salles
            </h2>
            <p className="text-white/80 mt-1">Configurez les salles et boxes du cabinet</p>
          </div>
          
          {user?.role === 'Directeur' && (
            <div className="flex flex-wrap gap-2">
              {salles.length === 0 && (
                <Button
                  onClick={initialiserCabinet}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Initialiser
                </Button>
              )}
              <Button
                onClick={() => setShowConfigModal(true)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </Button>
              <Button 
                onClick={() => setShowSalleModal(true)}
                className="bg-white text-[#0091B9] hover:bg-white/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Salle
              </Button>
            </div>
          )}
        </div>
      </div>

        <Dialog open={showSalleModal} onOpenChange={setShowSalleModal}>
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

      {/* Configuration Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuration du Cabinet</DialogTitle>
          </DialogHeader>
          
          {configuration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max médecins par créneau</Label>
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
                  <Label>Max assistants par créneau</Label>
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
              </div>
              
              {/* Limites de demi-journées par semaine */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Limites demi-journées par semaine (Vue Planning)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Médecins</Label>
                    <Input
                      type="number"
                      min="1"
                      max="14"
                      value={configuration.limite_demi_journees_medecin || 6}
                      onChange={(e) => setConfiguration({
                        ...configuration,
                        limite_demi_journees_medecin: parseInt(e.target.value)
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Assistants</Label>
                    <Input
                      type="number"
                      min="1"
                      max="14"
                      value={configuration.limite_demi_journees_assistant || 8}
                      onChange={(e) => setConfiguration({
                        ...configuration,
                        limite_demi_journees_assistant: parseInt(e.target.value)
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Secrétaires</Label>
                    <Input
                      type="number"
                      min="1"
                      max="14"
                      value={configuration.limite_demi_journees_secretaire || 10}
                      onChange={(e) => setConfiguration({
                        ...configuration,
                        limite_demi_journees_secretaire: parseInt(e.target.value)
                      })}
                    />
                  </div>
                </div>
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
                
                {user?.role === 'Directeur' && (
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
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {salles.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">Aucune salle configurée</p>
              {user?.role === 'Directeur' && (
                <Button onClick={initialiserCabinet} variant="outline">
                  Initialiser le Cabinet avec des Salles par Défaut
                </Button>
              )}
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
// Composant compact du Plan du Cabinet pour le Planning - Affiche MATIN et APRÈS-MIDI
const PlanningManager = () => {
  const { user, centreActif } = useAuth();
  const { planningSelectedDate, setPlanningSelectedDate, planningViewMode, setPlanningViewMode } = usePlanning();
  const [selectedDate, setSelectedDateLocal] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // Format YYYY-MM
  const [planning, setPlanning] = useState([]);
  const [planningMois, setPlanningMois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewModeLocal] = useState('jour');
  const [semaineAffichee, setSemaineAffichee] = useState('A'); // Semaine A ou B pour le calcul des heures
  
  // Fonction utilitaire pour formater une date en YYYY-MM-DD sans problèmes de fuseau horaire
  const formatDateISO = (year, month, day) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  
  // Fonctions pour gérer les permissions de vue planning
  // hasDirectorView: peut voir le planning comme un directeur (Directeur, Super-Admin OU vue_planning_complete)
  // canModifyPlanning: peut modifier le planning (Directeur, Super-Admin OU peut_modifier_planning)
  const hasDirectorView = () => user?.role === 'Directeur' || user?.role === 'Super-Admin' || user?.vue_planning_complete === true;
  const canModifyPlanning = () => user?.role === 'Directeur' || user?.role === 'Super-Admin' || user?.peut_modifier_planning === true;
  
  // Synchroniser avec le contexte global
  const setSelectedDate = (date) => {
    setSelectedDateLocal(date);
    setPlanningSelectedDate(date);
  };
  
  const setViewMode = (mode) => {
    setViewModeLocal(mode);
    setPlanningViewMode(mode);
  };
  
  const [filterRole, setFilterRole] = useState(['Médecin', 'Assistant', 'Secrétaire']); // Tous sélectionnés par défaut
  const [filterEmploye, setFilterEmploye] = useState('tous'); // Filtre employé pour vue jour/semaine
  const [filterEmployeMois, setFilterEmployeMois] = useState('tous'); // Filtre employé pour vue mois
  const [showDetails, setShowDetails] = useState(true); // Afficher ou masquer les détails (Box, Salle d'attente, Assistants)
  const [showMoisDetailsModal, setShowMoisDetailsModal] = useState(false); // Modal détails vue mois
  const [moisDetailsData, setMoisDetailsData] = useState({ date: '', creneau: '', employes: [] }); // Données pour le modal
  const [showRecapColumns, setShowRecapColumns] = useState(true); // Afficher ou masquer les colonnes récapitulatives (½j, H, Ctr, +/- S, +/- M, +/- A, Cg)
  
  // Référence pour le tableau planning (pour export PDF)
  const planningTableRef = useRef(null);
  
  // Horaires prédéfinis pour les secrétaires (stockés localement)
  const [horairesSecretaires, setHorairesSecretaires] = useState(() => {
    const saved = localStorage.getItem('horairesSecretaires');
    return saved ? JSON.parse(saved) : [
      { id: 1, nom: 'Temps plein', debut_matin: '08:00', fin_matin: '12:00', debut_aprem: '14:00', fin_aprem: '18:00' },
      { id: 2, nom: 'Mi-temps matin', debut_matin: '08:00', fin_matin: '12:00', debut_aprem: '', fin_aprem: '' },
      { id: 3, nom: 'Mi-temps après-midi', debut_matin: '', fin_matin: '', debut_aprem: '14:00', fin_aprem: '18:00' }
    ];
  });
  const [showHorairesConfig, setShowHorairesConfig] = useState(false);
  
  // Modal pour les boutons A, B, Co (semaines prédéfinies)
  const [showSemaineABCModal, setShowSemaineABCModal] = useState(false);
  const [semaineABCTarget, setSemaineABCTarget] = useState(null); // { type: 'employe' | 'section', employe?: user, section?: 'Secrétaire' | 'Assistant' | 'Médecin' }
  
  // Configuration des semaines A/B pour chaque employé
  const [showConfigSemainesModal, setShowConfigSemainesModal] = useState(false);
  const [configSemaineEmploye, setConfigSemaineEmploye] = useState(null); // employé en cours de config
  const [configSemaineType, setConfigSemaineType] = useState('A'); // 'A' ou 'B'
  
  // Structure de la semaine type pour un employé
  const getDefaultSemaineConfig = (role) => {
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    if (role === 'Secrétaire') {
      return jours.map(jour => ({
        jour,
        actif: jour !== 'Samedi',
        debut_matin: '08:00',
        fin_matin: '12:00',
        debut_aprem: '14:00',
        fin_aprem: '18:00'
      }));
    } else {
      // Médecins et Assistants - demi-journées
      return jours.map(jour => ({
        jour,
        matin: jour !== 'Samedi',
        apres_midi: jour !== 'Samedi'
      }));
    }
  };
  
  // Ouvrir la configuration de semaine pour un employé
  const openConfigSemaine = (employe, type) => {
    setConfigSemaineEmploye(employe);
    setConfigSemaineType(type);
    // Charger la config existante ou créer une nouvelle
    const existingConfig = employe[`semaine_${type.toLowerCase()}_config`];
    if (existingConfig) {
      setConfigSemaineEmploye({...employe, tempConfig: existingConfig});
    } else {
      setConfigSemaineEmploye({...employe, tempConfig: getDefaultSemaineConfig(employe.role)});
    }
  };
  
  // Sauvegarder la configuration de semaine
  const saveConfigSemaine = async () => {
    if (!configSemaineEmploye) return;
    try {
      const fieldName = `semaine_${configSemaineType.toLowerCase()}_config`;
      await axios.put(`${API}/users/${configSemaineEmploye.id}`, {
        [fieldName]: configSemaineEmploye.tempConfig
      });
      toast.success(`Semaine ${configSemaineType} configurée pour ${configSemaineEmploye.prenom}`);
      fetchData();
      setConfigSemaineEmploye(null);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };
  
  // ============================================================
  // DÉCOMPTE MENSUEL PAR EMPLOYÉ
  // ============================================================
  
  // Déterminer si une semaine est A ou B (basé sur le numéro de semaine)
  const getTypeSemaine = (date) => {
    const d = new Date(date);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return weekNumber % 2 === 0 ? 'B' : 'A';
  };
  
  // Calculer le décompte mensuel pour un employé
  const getDecompteMensuel = (employe, mois, annee) => {
    // Obtenir toutes les dates du mois
    const premierJour = new Date(annee, mois, 1);
    const dernierJour = new Date(annee, mois + 1, 0);
    
    let heuresEffectuees = 0;
    let demiJourneesEffectuees = 0;
    let heuresPrevues = 0;
    let demiJourneesPrevues = 0;
    let heuresConges = 0;
    let congesCount = 0;
    
    // Parcourir chaque jour du mois
    for (let jour = new Date(premierJour); jour <= dernierJour; jour.setDate(jour.getDate() + 1)) {
      const dateStr = jour.toISOString().split('T')[0];
      const jourSemaine = jour.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam
      
      // Ignorer dimanche
      if (jourSemaine === 0) continue;
      
      const typeSemaine = getTypeSemaine(dateStr);
      const config = typeSemaine === 'A' ? employe.semaine_a_config : employe.semaine_b_config;
      
      // Vérifier les créneaux effectués
      const creneauxJour = planningTableau.planning?.[dateStr]?.filter(c => c.employe_id === employe.id) || [];
      
      if (employe.role === 'Secrétaire') {
        // Pour les secrétaires : compter les heures
        const heuresSemaine = typeSemaine === 'A' ? (employe.heures_semaine_a || 35) : (employe.heures_semaine_b || 35);
        const heuresParJour = heuresSemaine / 5; // 5 jours ouvrés
        
        // Heures prévues (si pas dimanche et jour ouvré dans la config)
        if (config) {
          const jourConfig = config[jourSemaine - 1]; // index 0 = Lundi
          if (jourConfig?.actif) {
            // Calculer heures de ce jour
            let heuresJour = 0;
            if (jourConfig.debut_matin && jourConfig.fin_matin) {
              const [h1, m1] = jourConfig.debut_matin.split(':').map(Number);
              const [h2, m2] = jourConfig.fin_matin.split(':').map(Number);
              heuresJour += (h2 + m2/60) - (h1 + m1/60);
            }
            if (jourConfig.debut_aprem && jourConfig.fin_aprem) {
              const [h1, m1] = jourConfig.debut_aprem.split(':').map(Number);
              const [h2, m2] = jourConfig.fin_aprem.split(':').map(Number);
              heuresJour += (h2 + m2/60) - (h1 + m1/60);
            }
            heuresPrevues += heuresJour;
          }
        } else if (jourSemaine >= 1 && jourSemaine <= 5) {
          // Pas de config, utiliser heures par défaut (jours ouvrés)
          heuresPrevues += heuresParJour;
        }
        
        // Heures effectuées
        creneauxJour.forEach(creneau => {
          if (creneau.horaire_debut && creneau.horaire_fin) {
            const [h1, m1] = creneau.horaire_debut.split(':').map(Number);
            const [h2, m2] = creneau.horaire_fin.split(':').map(Number);
            heuresEffectuees += (h2 + m2/60) - (h1 + m1/60);
          } else {
            // Par défaut 4h par demi-journée
            heuresEffectuees += 4;
          }
        });
        
      } else {
        // Pour médecins/assistants : compter les demi-journées
        const limiteSemaine = typeSemaine === 'A' ? (employe.limite_demi_journees_a || 10) : (employe.limite_demi_journees_b || 10);
        
        // Demi-journées prévues
        if (config) {
          const jourConfig = config[jourSemaine - 1]; // index 0 = Lundi
          if (jourConfig) {
            if (jourConfig.matin) demiJourneesPrevues++;
            if (jourConfig.apres_midi) demiJourneesPrevues++;
          }
        } else if (jourSemaine >= 1 && jourSemaine <= 5) {
          // Pas de config, utiliser 2 demi-journées par défaut (jours ouvrés)
          demiJourneesPrevues += 2;
        }
        
        // Demi-journées effectuées
        demiJourneesEffectuees += creneauxJour.length;
      }
      
      // Comptabiliser les congés (approuvés uniquement)
      // - REPOS : non comptabilisé nulle part (aucun effet)
      // - HEURES_A_RECUPERER : heures supplémentaires positives (pas en heures effectuées, pas en congés)
      // - HEURES_RECUPEREES : heures supplémentaires négatives (pas en heures effectuées, pas en congés)
      // - CONGE_PAYE : comptabilisé en heures effectuées ET dans colonne "Congés"
      // - CONGE_SANS_SOLDE, MALADIE : comptabilisé en heures effectuées SEULEMENT (pas en congés)
      const typesCongesNonComptabilises = ['REPOS'];
      const congesJour = congesApprouves?.filter(c => 
        c.utilisateur_id === employe.id && 
        dateStr >= c.date_debut && dateStr <= c.date_fin &&
        !typesCongesNonComptabilises.includes(c.type_conge)
      ) || [];
      
      congesJour.forEach(conge => {
        // Utiliser heures_conge du congé si défini, sinon valeur par défaut de l'employé
        const heuresConge = conge.heures_conge || employe.heures_demi_journee_conge || 4;
        const nbDemiJournees = conge.demi_journee ? 1 : 2;
        const heuresTotal = heuresConge * nbDemiJournees;
        
        if (conge.type_conge === 'HEURES_RECUPEREES') {
          // Heures récupérées = négatif dans heures sup (ne compte PAS comme travail ni congé)
          // On ne l'ajoute pas aux heuresConges ni congesCount
        } else if (conge.type_conge === 'HEURES_A_RECUPERER') {
          // Heures à récupérer = heures sup positives (pas en heures effectuées, pas en congés)
          // On ne l'ajoute pas aux heuresConges ni congesCount
        } else if (conge.type_conge === 'CONGE_PAYE') {
          // CONGE_PAYE = compte comme heures effectuées ET comme congé
          heuresConges += heuresTotal;
          congesCount += nbDemiJournees;
        } else {
          // CONGE_SANS_SOLDE, MALADIE = compte comme heures effectuées SEULEMENT (pas en congés)
          heuresConges += heuresTotal;
          // Ne pas incrémenter congesCount
        }
      });
    }
    
    if (employe.role === 'Secrétaire') {
      const diff = heuresEffectuees - heuresPrevues;
      return {
        effectuees: heuresEffectuees,
        prevues: heuresPrevues,
        diff,
        unite: 'h',
        status: diff === 0 ? 'ok' : diff > 0 ? 'trop' : 'manque',
        heuresConges,
        conges: congesCount
      };
    } else {
      const diff = demiJourneesEffectuees - demiJourneesPrevues;
      return {
        effectuees: demiJourneesEffectuees,
        prevues: demiJourneesPrevues,
        diff,
        unite: '½j',
        status: diff === 0 ? 'ok' : diff > 0 ? 'trop' : 'manque',
        heuresConges,
        conges: congesCount
      };
    }
  };
  
  // ============================================================
  // FONCTIONS D'EXPORT DE DONNÉES
  // ============================================================
  
  // Exporter toutes les données en JSON
  const handleExportAllJSON = async () => {
    try {
      toast.info('Export en cours...');
      const response = await axios.get(`${API}/export/all`);
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export_cabinet_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Export JSON téléchargé !');
    } catch (error) {
      console.error('Erreur export:', error);
      toast.error('Erreur lors de l\'export');
    }
  };
  
  // Exporter les utilisateurs en CSV
  const handleExportUsersCSV = async () => {
    try {
      toast.info('Export en cours...');
      const response = await axios.get(`${API}/export/users`);
      const users = response.data.users;
      
      // Créer le CSV
      const headers = ['ID', 'Email', 'Prénom', 'Nom', 'Rôle', 'Téléphone', 'Actif', 'Vue Planning', 'Modif Planning'];
      const csvContent = [
        headers.join(';'),
        ...users.map(u => [
          u.id,
          u.email,
          u.prenom,
          u.nom,
          u.role,
          u.telephone || '',
          u.actif ? 'Oui' : 'Non',
          u.vue_planning_complete ? 'Oui' : 'Non',
          u.peut_modifier_planning ? 'Oui' : 'Non'
        ].join(';'))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `utilisateurs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé !');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };
  
  // Exporter le planning en PDF
  const handleExportPlanningPDF = async () => {
    try {
      toast.info('Génération du PDF en cours...');
      
      // Créer un nouveau document PDF en format paysage avec plus d'espace
      const pdf = new jsPDF('landscape', 'mm', 'a3');
      
      // Titre
      const weekStart = planningTableau.dates?.[0] || selectedWeek;
      const weekEnd = planningTableau.dates?.[planningTableau.dates.length - 1] || selectedWeek;
      pdf.setFontSize(16);
      pdf.text(`Planning du ${new Date(weekStart + 'T12:00:00').toLocaleDateString('fr-FR')} au ${new Date(weekEnd + 'T12:00:00').toLocaleDateString('fr-FR')}`, 14, 15);
      pdf.setFontSize(10);
      pdf.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, 22);
      
      // Préparer les données pour le tableau avec les nouvelles colonnes
      const tableHead = [['Employé', ...planningTableau.dates.flatMap(d => {
        const date = new Date(d + 'T12:00:00');
        return [`${date.toLocaleDateString('fr-FR', { weekday: 'short' })} M`, `AM`];
      }), '½j', 'H', 'Ctr', '+/- S', '+/- M', '+/- A', 'Cg']];
      
      const tableBody = [];
      
      // Types de congés non comptabilisés (REPOS = aucun effet)
      const typesCongesNonComptabilises = ['REPOS'];
      
      // Fonction pour calculer les stats d'un employé
      const getEmployeStats = (employe) => {
        let totalDemiJournees = 0;
        let totalHeures = 0;
        let heuresConges = 0;
        let congesCount = 0;  // Compteur de congés (uniquement CONGE_PAYE)
        let heuresARecuperer = 0;  // Heures à récupérer = ajoutent aux heures sup
        let heuresRecuperees = 0;  // Heures récupérées = retirent des heures sup
        
        planningTableau.dates?.forEach(date => {
          // Filtrer les créneaux en excluant les repos
          const creneaux = planningTableau.planning?.[date]?.filter(c => c.employe_id === employe.id && !c.est_repos) || [];
          totalDemiJournees += creneaux.length;
          creneaux.forEach(c => {
            if (employe.role === 'Secrétaire' && c.horaire_debut && c.horaire_fin) {
              const [h1, m1] = c.horaire_debut.split(':').map(Number);
              const [h2, m2] = c.horaire_fin.split(':').map(Number);
              totalHeures += (h2 + m2/60) - (h1 + m1/60);
            } else {
              // Utiliser heures_demi_journee_travail si défini
              const heuresParDemiJ = employe.heures_demi_journee_travail || (employe.heures_par_jour ? employe.heures_par_jour / 2 : 3.5);
              totalHeures += heuresParDemiJ;
            }
          });
          
          // Congés - gérer tous les types
          // REPOS : non comptabilisé nulle part (aucun effet)
          // HEURES_A_RECUPERER : heures sup positives (pas en heures effectuées, pas en congés)
          // HEURES_RECUPEREES : heures sup négatives (pas en heures effectuées, pas en congés)
          // CONGE_PAYE : comptabilisé en heures effectuées ET en congés
          // CONGE_SANS_SOLDE, MALADIE : comptabilisé en heures effectuées SEULEMENT (pas en congés)
          const congesJour = congesApprouves?.filter(c => 
            c.utilisateur_id === employe.id && 
            date >= c.date_debut && date <= c.date_fin &&
            !typesCongesNonComptabilises.includes(c.type_conge)
          ) || [];
          congesJour.forEach(c => {
            // Utiliser heures_conge du congé si défini
            const h = c.heures_conge || employe.heures_demi_journee_conge || 4;
            const nbDemiJ = c.demi_journee ? 1 : 2;
            const heuresTotal = h * nbDemiJ;
            
            if (c.type_conge === 'HEURES_A_RECUPERER') {
              // Heures à récupérer = heures sup positives (PAS en heures effectuées, PAS en congés)
              heuresARecuperer += heuresTotal;
            } else if (c.type_conge === 'HEURES_RECUPEREES') {
              // Heures récupérées = heures sup négatives (PAS en heures effectuées, PAS en congés)
              heuresRecuperees += heuresTotal;
            } else if (c.type_conge === 'CONGE_PAYE') {
              // CONGE_PAYE = heures effectuées ET congés
              heuresConges += heuresTotal;
              congesCount += nbDemiJ;
            } else {
              // CONGE_SANS_SOLDE, MALADIE = heures effectuées SEULEMENT (pas en congés)
              heuresConges += heuresTotal;
            }
          });
        });
        
        const heuresContrat = employe.heures_semaine_fixe || 35;
        // Calcul heures sup: base + heures à récupérer - heures récupérées
        const heuresSupSemaine = (totalHeures + heuresConges - heuresContrat) + heuresARecuperer - heuresRecuperees;
        
        return {
          demiJournees: totalDemiJournees,
          heures: Math.round(totalHeures * 10) / 10,
          contrat: heuresContrat,
          supSemaine: Math.round(heuresSupSemaine * 10) / 10,
          supMois: getHeuresSupMois(employe.id),
          supAnnee: getHeuresSupAnnee(employe.id),
          conges: congesCount  // Nombre de demi-journées de congés (CONGE_PAYE uniquement)
        };
      };
      
      // Ajouter les secrétaires
      tableBody.push([{ content: 'SECRÉTAIRES', colSpan: tableHead[0].length, styles: { fillColor: [255, 192, 203], fontStyle: 'bold' } }]);
      users.filter(u => u.actif && u.role === 'Secrétaire').forEach(sec => {
        const stats = getEmployeStats(sec);
        const row = [`${sec.prenom} ${sec.nom}`];
        planningTableau.dates.forEach(date => {
          const creneauM = planningTableau.planning?.[date]?.find(p => p.employe_id === sec.id && p.creneau === 'MATIN');
          const creneauAM = planningTableau.planning?.[date]?.find(p => p.employe_id === sec.id && p.creneau === 'APRES_MIDI');
          row.push(creneauM ? (creneauM.horaire_debut ? `${creneauM.horaire_debut}-${creneauM.horaire_fin}` : '✓') : '');
          row.push(creneauAM ? (creneauAM.horaire_debut ? `${creneauAM.horaire_debut}-${creneauAM.horaire_fin}` : '✓') : '');
        });
        row.push(stats.demiJournees, `${stats.heures}h`, `${stats.contrat}h`, `${stats.supSemaine}h`, `${stats.supMois}h`, `${stats.supAnnee}h`, `${stats.conges}h`);
        tableBody.push(row);
      });
      
      // Ajouter les assistants
      tableBody.push([{ content: 'ASSISTANTS', colSpan: tableHead[0].length, styles: { fillColor: [144, 238, 144], fontStyle: 'bold' } }]);
      users.filter(u => u.actif && u.role === 'Assistant').forEach(ass => {
        const stats = getEmployeStats(ass);
        const row = [`${ass.prenom} ${ass.nom}`];
        planningTableau.dates.forEach(date => {
          const creneauM = planningTableau.planning?.[date]?.find(p => p.employe_id === ass.id && p.creneau === 'MATIN');
          const creneauAM = planningTableau.planning?.[date]?.find(p => p.employe_id === ass.id && p.creneau === 'APRES_MIDI');
          row.push(creneauM ? '✓' : '');
          row.push(creneauAM ? '✓' : '');
        });
        row.push(stats.demiJournees, `${stats.heures}h`, `${stats.contrat}h`, `${stats.supSemaine}h`, `${stats.supMois}h`, `${stats.supAnnee}h`, `${stats.conges}h`);
        tableBody.push(row);
      });
      
      // Ajouter les médecins
      tableBody.push([{ content: 'MÉDECINS', colSpan: tableHead[0].length, styles: { fillColor: [173, 216, 230], fontStyle: 'bold' } }]);
      users.filter(u => u.actif && u.role === 'Médecin').forEach(med => {
        const stats = getEmployeStats(med);
        const row = [`Dr. ${med.prenom} ${med.nom}`];
        planningTableau.dates.forEach(date => {
          const creneauM = planningTableau.planning?.[date]?.find(p => p.employe_id === med.id && p.creneau === 'MATIN');
          const creneauAM = planningTableau.planning?.[date]?.find(p => p.employe_id === med.id && p.creneau === 'APRES_MIDI');
          row.push(creneauM ? creneauM.salle_attribuee || '✓' : '');
          row.push(creneauAM ? creneauAM.salle_attribuee || '✓' : '');
        });
        row.push(stats.demiJournees, `${stats.heures}h`, '-', `${stats.supSemaine}h`, `${stats.supMois}h`, `${stats.supAnnee}h`, '-');
        tableBody.push(row);
      });
      
      // Générer le tableau
      autoTable(pdf, {
        head: tableHead,
        body: tableBody,
        startY: 28,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [59, 130, 246], fontSize: 6 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 35 } // Colonne Employé plus large
        }
      });
      
      // Sauvegarder
      pdf.save(`planning_${weekStart}_${weekEnd}.pdf`);
      toast.success('PDF téléchargé !');
    } catch (error) {
      console.error('Erreur PDF:', error);
      toast.error(`Erreur lors de la génération du PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };
  
  // Exporter le planning en image (capture d'écran)
  const handleExportPlanningImage = async () => {
    const tableElement = planningTableRef.current;
    if (!tableElement) {
      toast.error('Tableau non disponible');
      return;
    }
    
    try {
      toast.info('Capture en cours...');
      
      // Capturer directement l'élément sans le cloner
      const canvas = await html2canvas(tableElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: tableElement.scrollWidth,
        windowHeight: tableElement.scrollHeight
      });
      
      // Vérifier que le canvas n'est pas vide
      if (canvas.width === 0 || canvas.height === 0) {
        toast.error('Erreur: capture vide');
        return;
      }
      
      // Convertir en blob puis télécharger
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Erreur: impossible de créer l\'image');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `planning_${selectedWeek}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Image téléchargée !');
      }, 'image/png');
    } catch (error) {
      console.error('Erreur capture:', error);
      toast.error('Erreur lors de la capture: ' + (error.message || 'Erreur inconnue'));
    }
  };
  
  // Sauvegarder les horaires prédéfinis dans localStorage
  const saveHorairesSecretaires = (newHoraires) => {
    setHorairesSecretaires(newHoraires);
    localStorage.setItem('horairesSecretaires', JSON.stringify(newHoraires));
  };
  
  const [users, setUsers] = useState([]);
  const [salles, setSalles] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [congesApprouves, setCongesApprouves] = useState([]);
  const [congesEnAttente, setCongesEnAttente] = useState([]); // Congés en attente pour validation
  const [assignations, setAssignations] = useState([]);
  const [demandesTravail, setDemandesTravail] = useState([]);
  const [planningSemaine, setPlanningSemaine] = useState(null);
  const [planningTableau, setPlanningTableau] = useState({}); // Pour la vue Planning
  const [configurationPlanning, setConfigurationPlanning] = useState(null); // Configuration des limites
  const [notesPlanningJour, setNotesPlanningJour] = useState({}); // Notes par date pour le planning
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [showEditCreneauModal, setShowEditCreneauModal] = useState(false);
  const [showAttributionModal, setShowAttributionModal] = useState(false);
  const [showSemaineTypeModal, setShowSemaineTypeModal] = useState(false);
  const [showCreateSemaineTypeModal, setShowCreateSemaineTypeModal] = useState(false);
  const [semainesTypes, setSemainesTypes] = useState([]);
  const [selectedSemaineType, setSelectedSemaineType] = useState(null);
  const [dateDebutSemaine, setDateDebutSemaine] = useState('');
  // États pour le modal de création rapide dans Vue Planning
  const [showQuickCreneauModal, setShowQuickCreneauModal] = useState(false);
  const [quickCreneauData, setQuickCreneauData] = useState({
    employe_id: '',
    employe: null,
    date: '',
    creneau: '',
    notes: '',
    horaire_debut: '',
    horaire_fin: '',
    horaire_pause_debut: '',
    horaire_pause_fin: '',
    est_repos: false
  });
  
  // État pour le modal journée complète (matin + après-midi)
  const [showJourneeModal, setShowJourneeModal] = useState(false);
  const [showAssistantsDetails, setShowAssistantsDetails] = useState(false); // Afficher les assistants déjà associés
  const [journeeData, setJourneeData] = useState({
    employe_id: '',
    employe: null,
    date: '',
    matin: { notes: '', salle_attribuee: '', salle_attente: '', medecin_ids: [], horaire_debut: '', horaire_fin: '', conge: false, type_conge: '', est_repos: false },
    apresMidi: { notes: '', salle_attribuee: '', salle_attente: '', medecin_ids: [], horaire_debut: '', horaire_fin: '', conge: false, type_conge: '', est_repos: false }
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
    dimanche: 'REPOS',
    horaire_debut: '08:00',
    horaire_fin: '18:00',
    horaire_pause_debut: '12:00',
    horaire_pause_fin: '14:00'
  });
  
  // État pour le modal vue détaillée d'une journée (tous les employés par créneau)
  const [showDetailJourModal, setShowDetailJourModal] = useState(false);
  const [detailJourDate, setDetailJourDate] = useState('');
  
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
    horaire_pause_debut: '',
    horaire_pause_fin: '',
    notes: '',
    medecin_ids: []
  });
  const [attribution, setAttribution] = useState({
    employe_id: '',
    salle_attribuee: '',
    medecin_ids: [],
    notes: ''
  });
  const [showAnnulationCreneauModal, setShowAnnulationCreneauModal] = useState(false);
  const [creneauToCancel, setCreneauToCancel] = useState(null);
  const [raisonAnnulationCreneau, setRaisonAnnulationCreneau] = useState('');
  const [searchEmploye, setSearchEmploye] = useState(''); // Recherche employé
  
  // États pour le Planning Hebdo (création directe de créneaux)
  const [showPlanningHebdoModal, setShowPlanningHebdoModal] = useState(false);
  const [planningHebdo, setPlanningHebdo] = useState({
    employe_id: '',
    date_debut: ''
  });
  const [joursHebdoPlanning, setJoursHebdoPlanning] = useState([]);
  const [planningHebdoResume, setPlanningHebdoResume] = useState({});

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    if (viewMode === 'semaine') {
      setSelectedWeek(today);
    } else if (viewMode === 'mois') {
      setSelectedMonth(today.slice(0, 7));
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
    } else if (viewMode === 'mois') {
      fetchPlanningMois(selectedMonth);
    } else if (viewMode === 'planning') {
      fetchPlanningTableau(selectedWeek);
    }
  }, [selectedDate, selectedWeek, selectedMonth, viewMode, user?.role, centreActif?.id]); // Recharger quand le centre change

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

  // Fetch pour la vue Planning (tableau interactif)
  const fetchPlanningTableau = async (date) => {
    try {
      setLoading(true);
      const monday = getMondayOfWeek(date);
      const weekDates = getWeekDates(monday);
      const dateDebut = weekDates[0];
      const dateFin = weekDates[weekDates.length - 1];
      
      // Charger le planning, les utilisateurs, les congés ET les notes en parallèle
      const [usersRes, congesRes, demandesTravailRes, notesRes, ...planningResponses] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/conges`),
        axios.get(`${API}/demandes-travail`),
        axios.get(`${API}/planning/notes?date_debut=${dateDebut}&date_fin=${dateFin}`),
        ...weekDates.map(d => axios.get(`${API}/planning/${d}`))
      ]);
      
      // Mettre à jour les utilisateurs
      setUsers(usersRes.data.filter(u => u.actif));
      
      // Mettre à jour les congés (approuvés et en attente)
      setCongesApprouves(congesRes.data.filter(c => c.statut === 'APPROUVE'));
      setCongesEnAttente(congesRes.data.filter(c => c.statut === 'EN_ATTENTE'));
      
      // Mettre à jour les demandes de travail en attente
      setDemandesTravail(demandesTravailRes.data.filter(d => d.statut === 'EN_ATTENTE'));
      
      // Mettre à jour les notes de planning par date
      const notesParDate = {};
      notesRes.data.forEach(note => {
        notesParDate[note.date] = note.note;
      });
      setNotesPlanningJour(notesParDate);
      
      // Construire les données du planning
      const planningData = {};
      weekDates.forEach((d, index) => {
        planningData[d] = planningResponses[index].data;
      });
      
      setPlanningTableau({
        dates: weekDates,
        planning: planningData
      });
    } catch (error) {
      console.error('Erreur chargement planning tableau:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanningSemaine = async (date) => {
    try {
      const mondayDate = getMondayOfWeek(date);
      const mondayStr = mondayDate.toISOString().split('T')[0];
      
      if (hasDirectorView()) {
        // Vue globale pour le directeur ou utilisateur avec vue planning complète
        const [usersRes, sallesRes, planningRes, congesRes, demandesTravailRes] = await Promise.all([
          axios.get(`${API}/users`),
          axios.get(`${API}/salles`),
          axios.get(`${API}/planning/semaine/${mondayStr}`),
          axios.get(`${API}/conges`),
          axios.get(`${API}/demandes-travail`)
        ]);
        
        setUsers(usersRes.data.filter(u => u.actif));
        setSalles(sallesRes.data);
        // Filtrer les congés approuvés et en attente séparément
        setCongesApprouves(congesRes.data.filter(c => c.statut === 'APPROUVE'));
        setCongesEnAttente(congesRes.data.filter(c => c.statut === 'EN_ATTENTE'));
        // Charger les demandes de travail pour afficher les demandes en attente
        setDemandesTravail(demandesTravailRes.data.filter(d => d.statut === 'EN_ATTENTE'));
        
        // Vérifier que la structure est correcte
        if (planningRes.data && planningRes.data.dates && planningRes.data.planning) {
          setPlanningSemaine(planningRes.data);
        } else {
          console.error('Structure de planning invalide:', planningRes.data);
          setPlanningSemaine(null);
        }
      } else {
        // Vue personnelle pour les employés
        const [planningRes, congesRes] = await Promise.all([
          axios.get(`${API}/planning/semaine/${mondayStr}`),
          axios.get(`${API}/conges`)
        ]);
        
        const personalPlanning = planningRes.data;
        
        // Filtrer uniquement les congés approuvés pour l'utilisateur actuel
        setCongesApprouves(congesRes.data.filter(c => c.statut === 'APPROUVE' && c.utilisateur_id === user.id));
        
        // Vérifier que la structure est correcte
        // On garde tous les créneaux dans le planning pour pouvoir calculer les associations médecins/assistants
        if (personalPlanning && personalPlanning.dates && personalPlanning.planning) {
          setPlanningSemaine(personalPlanning);
        } else {
          console.error('Structure de planning invalide:', personalPlanning);
          setPlanningSemaine(null);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement du planning semaine:', error);
      toast.error('Erreur lors du chargement du planning');
      setPlanningSemaine(null);
    }
  };

  const fetchData = async () => {
    try {
      // Tous les utilisateurs voient toutes les données (personnel et salles)
      const [usersRes, medecinRes, assistantRes, sallesRes, semainesTypesRes, congesRes, assignationsRes, demandesTravailRes, configRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/users/by-role/Médecin`),
        axios.get(`${API}/users/by-role/Assistant`),
        axios.get(`${API}/salles`),
        axios.get(`${API}/semaines-types`),
        axios.get(`${API}/conges`),
        axios.get(`${API}/assignations`),
        axios.get(`${API}/demandes-travail`),
        axios.get(`${API}/configuration`)
      ]);
      
      setUsers(usersRes.data);
      setMedecins(medecinRes.data);
      setAssistants(assistantRes.data);
      setSalles(sallesRes.data);
      setSemainesTypes(semainesTypesRes.data);
      // Filtrer les congés approuvés et en attente séparément
      setCongesApprouves(congesRes.data.filter(c => c.statut === 'APPROUVE'));
      setCongesEnAttente(congesRes.data.filter(c => c.statut === 'EN_ATTENTE'));
      setAssignations(assignationsRes.data);
      setDemandesTravail(demandesTravailRes.data.filter(d => d.statut === 'EN_ATTENTE'));
      setConfigurationPlanning(configRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanningByDate = async (date) => {
    try {
      const [planningRes, congesRes, demandesTravailRes] = await Promise.all([
        axios.get(`${API}/planning/${date}`),
        axios.get(`${API}/conges`),
        axios.get(`${API}/demandes-travail`)
      ]);
      
      let planningData = planningRes.data;
      let congesData = congesRes.data;
      
      // Pour les non-directeurs: on garde TOUS les créneaux du jour pour calculer les associations
      // mais on filtrera à l'affichage pour ne montrer que leurs créneaux personnels
      // Cela permet aux assistants de voir avec quels médecins ils travaillent et vice-versa
      if (user?.role !== 'Directeur' && !user?.vue_planning_complete) {
        // Ne filtrer que les congés, pas le planning (pour garder les associations)
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
      
      // Charger les demandes de travail pour afficher les demandes en attente
      setDemandesTravail(demandesTravailRes.data);
      
    } catch (error) {
      console.error('Erreur lors du chargement du planning:', error);
    }
  };

  // Fonction pour récupérer le planning du mois entier (OPTIMISÉ - 1 seule requête)
  const fetchPlanningMois = async (mois) => {
    try {
      setLoading(true);
      
      // Utiliser le nouvel endpoint optimisé qui récupère tout le mois d'un coup
      const [planningRes, demandesRes] = await Promise.all([
        axios.get(`${API}/planning/mois/${mois}`),
        axios.get(`${API}/demandes-travail`)
      ]);
      
      // Mettre à jour les demandes de travail
      setDemandesTravail(demandesRes.data.filter(d => d.statut === 'EN_ATTENTE'));
      
      // Filtrer selon les permissions
      let planningData = planningRes.data;
      if (user?.role !== 'Directeur' && !user?.vue_planning_complete) {
        planningData = planningRes.data.filter(p => p.employe_id === user.id);
      }
      
      setPlanningMois(planningData);
    } catch (error) {
      console.error('Erreur lors du chargement du planning mensuel:', error);
      toast.error('Erreur lors du chargement du planning mensuel');
    } finally {
      setLoading(false);
    }
  };

  // Naviguer entre les mois
  const navigateMonth = (direction) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + (direction === 'prev' ? -1 : 1), 1);
    setSelectedMonth(newDate.toISOString().slice(0, 7));
  };

  // Obtenir les créneaux d'un jour spécifique pour la vue mois
  const getCreneauxMoisByDate = (date, creneau) => {
    return planningMois.filter(p => p.date === date && p.creneau === creneau);
  };

  // Compter les médecins présents pour un jour/créneau
  const countMedecinsPresents = (date, creneau) => {
    return planningMois.filter(p => 
      p.date === date && 
      p.creneau === creneau && 
      p.employe_role === 'Médecin'
    ).length;
  };

  // Compter les demandes de médecins en attente pour un jour/créneau
  const countMedecinsEnAttente = (date, creneau) => {
    return demandesTravail.filter(d => 
      d.date_demandee === date && 
      d.statut === 'EN_ATTENTE' &&
      (d.creneau === creneau || d.creneau === 'JOURNEE_COMPLETE')
    ).length;
  };

  // Afficher les détails d'un créneau dans le modal
  const showMoisCreneauDetails = (date, creneau) => {
    const employes = planningMois.filter(p => p.date === date && p.creneau === creneau);
    setMoisDetailsData({
      date,
      creneau,
      employes
    });
    setShowMoisDetailsModal(true);
  };

  // Vérifier si un employé est présent à une date/créneau
  const isEmployePresent = (date, creneau) => {
    return planningMois.some(p => 
      p.date === date && 
      p.creneau === creneau && 
      p.employe_id === user.id
    );
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
      // Créer le créneau principal
      const response = await axios.post(`${API}/planning`, newCreneau);
      const createdCreneau = response.data;
      
      // Déterminer le rôle de l'employé créé
      const employe = users.find(u => u.id === newCreneau.employe_id);
      
      // Si c'est un médecin et qu'il a des assistants sélectionnés, créer leurs créneaux
      if (employe?.role === 'Médecin' && newCreneau.medecin_ids && newCreneau.medecin_ids.length > 0) {
        for (const assistantId of newCreneau.medecin_ids) {
          try {
            // Créer un créneau pour chaque assistant sélectionné
            const assistantCreneau = {
              date: newCreneau.date,
              creneau: newCreneau.creneau,
              employe_id: assistantId,
              salle_attribuee: newCreneau.salle_attribuee,
              salle_attente: newCreneau.salle_attente,
              horaire_debut: newCreneau.horaire_debut,
              horaire_fin: newCreneau.horaire_fin,
              horaire_pause_debut: newCreneau.horaire_pause_debut,
              horaire_pause_fin: newCreneau.horaire_pause_fin,
              notes: `Associé à Dr. ${employe.prenom} ${employe.nom}`,
              medecin_ids: [newCreneau.employe_id] // Lien inverse
            };
            await axios.post(`${API}/planning`, assistantCreneau);
          } catch (err) {
            console.error('Erreur création créneau assistant:', err);
            // Continue même si un créneau échoue
          }
        }
        toast.success('Créneau créé et créneaux assistants créés avec succès');
      } else {
        toast.success('Créneau créé avec succès');
      }
      
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
      // Mettre à jour le créneau principal
      await axios.put(`${API}/planning/${editingCreneau.id}`, newCreneau);
      
      // Si c'est un médecin et qu'il a des assistants sélectionnés, créer/mettre à jour leurs créneaux
      if (editingCreneau.employe_role === 'Médecin' && newCreneau.medecin_ids && newCreneau.medecin_ids.length > 0) {
        let assistantsCreated = 0;
        let assistantsUpdated = 0;
        let assistantsFailed = 0;
        
        const errors = [];
        
        for (const assistantId of newCreneau.medecin_ids) {
          try {
            // Vérifier d'abord si un créneau existe déjà pour cet assistant à cette date/créneau
            const existingCreneaux = await axios.get(`${API}/planning/${newCreneau.date}`);
            const existingCreneau = existingCreneaux.data.find(c => 
              c.employe_id === assistantId && c.creneau === newCreneau.creneau
            );
            
            if (existingCreneau) {
              // L'assistant a déjà un créneau : juste ajouter ce médecin à ses medecin_ids
              const updatedMedecinIds = existingCreneau.medecin_ids && existingCreneau.medecin_ids.length > 0 
                ? [...new Set([...existingCreneau.medecin_ids, newCreneau.employe_id])] 
                : [newCreneau.employe_id];
              
              await axios.put(`${API}/planning/${existingCreneau.id}`, {
                medecin_ids: updatedMedecinIds
              });
              assistantsUpdated++;
            } else {
              // Créer un nouveau créneau pour l'assistant SANS salle
              // L'assistant devra définir sa propre salle (A, B, C, D, O, Blue)
              const assistantCreneauData = {
                date: newCreneau.date,
                creneau: newCreneau.creneau,
                employe_id: assistantId,
                notes: `Associé à Dr. ${editingCreneau.employe?.prenom} ${editingCreneau.employe?.nom}`,
                medecin_ids: [newCreneau.employe_id]
              };
              
              await axios.post(`${API}/planning`, assistantCreneauData);
              assistantsCreated++;
            }
          } catch (err) {
            console.error('Erreur création/modification créneau assistant:', err);
            const assistant = users.find(u => u.id === assistantId);
            const assistantName = assistant ? `${assistant.prenom} ${assistant.nom}` : 'Assistant';
            const errorMsg = err.response?.data?.detail || err.message;
            errors.push(`${assistantName}: ${errorMsg}`);
            assistantsFailed++;
          }
        }
        
        if (assistantsCreated > 0 || assistantsUpdated > 0) {
          const messages = [];
          if (assistantsCreated > 0) messages.push(`${assistantsCreated} créneau(x) créé(s)`);
          if (assistantsUpdated > 0) messages.push(`${assistantsUpdated} créneau(x) mis à jour`);
          toast.success(`Créneau médecin modifié avec succès. Assistants: ${messages.join(', ')}`);
        } else if (assistantsFailed > 0) {
          toast.warning(`Créneau médecin modifié, mais problème avec les assistants:\n${errors.join('\n')}`);
        } else {
          toast.success('Créneau modifié avec succès');
        }
      } else {
        toast.success('Créneau modifié avec succès');
      }
      
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

  // Dupliquer un créneau vers l'autre période (matin ↔ après-midi)
  const handleDuplicateCreneau = async (creneau) => {
    const nouveauCreneau = creneau.creneau === 'MATIN' ? 'APRES_MIDI' : 'MATIN';
    const creneauLabel = nouveauCreneau === 'MATIN' ? 'Matin' : 'Après-midi';
    
    try {
      // Créer le nouveau créneau avec les mêmes informations
      await axios.post(`${API}/planning`, {
        employe_id: creneau.employe_id,
        date: creneau.date,
        creneau: nouveauCreneau,
        salle_attribuee: creneau.salle_attribuee,
        salle_attente: creneau.salle_attente,
        notes: creneau.notes,
        horaire_debut: creneau.horaire_debut,
        horaire_fin: creneau.horaire_fin
      });
      
      // Si c'est un médecin avec des assistants, dupliquer aussi les assignations
      if (creneau.employe_role === 'Médecin') {
        const assistantsAssignes = getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau);
        for (const assistant of assistantsAssignes) {
          // Vérifier si l'assistant a un créneau pour la nouvelle période
          const assistantCreneau = planning.find(p => 
            p.employe_id === assistant.id && 
            p.date === creneau.date && 
            p.creneau === nouveauCreneau
          );
          
          if (assistantCreneau) {
            // Créer l'assignation pour la nouvelle période
            await axios.post(`${API}/assignations`, {
              medecin_id: creneau.employe_id,
              assistant_id: assistant.id,
              date: creneau.date,
              creneau: nouveauCreneau
            });
          }
        }
      }
      
      toast.success(`Créneau dupliqué vers ${creneauLabel}`);
      
      if (viewMode === 'semaine') {
        fetchPlanningSemaine(selectedWeek);
      } else {
        fetchPlanningByDate(selectedDate);
      }
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(`Un créneau existe déjà pour ${creneauLabel}`);
      } else {
        toast.error('Erreur lors de la duplication');
      }
    }
  };

  const handleAnnulerCreneau = async (creneau) => {
    // Vérifier si ce créneau vient d'une demande de travail approuvée
    const demandeTravail = demandesTravail.find(d => 
      d.medecin_id === creneau.employe_id &&
      d.date_demandee === creneau.date &&
      (d.creneau === creneau.creneau || d.creneau === 'JOURNEE_COMPLETE') &&
      d.statut === 'APPROUVE'
    );

    if (demandeTravail) {
      // Si c'est une demande de travail, ouvrir la modale d'annulation
      setCreneauToCancel({ ...creneau, demande_id: demandeTravail.id });
      setRaisonAnnulationCreneau('');
      setShowAnnulationCreneauModal(true);
    } else {
      // Si c'est un créneau manuel, suppression directe
      if (confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) {
        await handleDeleteCreneau(creneau.id);
      }
    }
  };

  const handleSubmitAnnulationCreneau = async (e) => {
    e.preventDefault();
    
    if (!raisonAnnulationCreneau.trim()) {
      toast.error('La raison est obligatoire');
      return;
    }

    try {
      // Annuler la demande de travail qui a créé ce créneau
      // Envoyer le créneau spécifique pour ne supprimer que celui-ci (et pas toute la journée)
      await axios.post(`${API}/demandes-travail/${creneauToCancel.demande_id}/annuler-directement`, {
        raison: raisonAnnulationCreneau,
        creneau_specifique: creneauToCancel.creneau  // MATIN ou APRES_MIDI
      });
      
      toast.success('Créneau annulé avec succès');
      setShowAnnulationCreneauModal(false);
      setRaisonAnnulationCreneau('');
      
      // Recharger le planning et les demandes
      if (viewMode === 'semaine') {
        fetchPlanningSemaine(selectedWeek);
      } else {
        fetchPlanningByDate(selectedDate);
      }
      // Recharger les données
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'annulation');
    }
  };

  // ===== PLANNING HEBDO (Création directe de créneaux par le directeur) =====
  const openPlanningHebdoModal = () => {
    const today = new Date();
    // Trouver le lundi de la semaine prochaine
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    
    setPlanningHebdo({
      employe_id: '',
      date_debut: nextMonday.toISOString().split('T')[0]
    });
    genererJoursHebdoPlanning(nextMonday.toISOString().split('T')[0]);
    setShowPlanningHebdoModal(true);
  };

  const genererJoursHebdoPlanning = async (dateDebut) => {
    const startDate = new Date(dateDebut + 'T12:00:00');
    // Trouver le lundi de cette semaine
    const day = startDate.getDay();
    const monday = new Date(startDate);
    monday.setDate(startDate.getDate() - (day === 0 ? 6 : day - 1));
    
    const jours = [];
    const joursNoms = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const resume = {};
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      jours.push({
        date: dateStr,
        jourNom: joursNoms[i],
        creneau: null,
        selectionne: false
      });
      
      // Récupérer le planning pour ce jour
      try {
        const res = await axios.get(`${API}/planning/${dateStr}`);
        const medecins = res.data.filter(p => p.employe_role === 'Médecin');
        const assistants = res.data.filter(p => p.employe_role === 'Assistant');
        resume[dateStr] = {
          medecinsMatin: medecins.filter(p => p.creneau === 'MATIN').length,
          medecinsAM: medecins.filter(p => p.creneau === 'APRES_MIDI').length,
          assistantsMatin: assistants.filter(p => p.creneau === 'MATIN').length,
          assistantsAM: assistants.filter(p => p.creneau === 'APRES_MIDI').length
        };
      } catch (error) {
        resume[dateStr] = { medecinsMatin: 0, medecinsAM: 0, assistantsMatin: 0, assistantsAM: 0 };
      }
    }
    
    setJoursHebdoPlanning(jours);
    setPlanningHebdoResume(resume);
  };

  const handleDateHebdoPlanningChange = (newDate) => {
    setPlanningHebdo(prev => ({ ...prev, date_debut: newDate }));
    genererJoursHebdoPlanning(newDate);
  };

  const toggleJourHebdoPlanning = (dateStr) => {
    setJoursHebdoPlanning(prev => prev.map(j => {
      if (j.date !== dateStr) return j;
      
      // Système cyclique : null → MATIN → APRES_MIDI → JOURNEE_COMPLETE → null
      let nouveauCreneau = null;
      let nouveauSelectionne = false;
      
      if (j.creneau === null) {
        nouveauCreneau = 'MATIN';
        nouveauSelectionne = true;
      } else if (j.creneau === 'MATIN') {
        nouveauCreneau = 'APRES_MIDI';
        nouveauSelectionne = true;
      } else if (j.creneau === 'APRES_MIDI') {
        nouveauCreneau = 'JOURNEE_COMPLETE';
        nouveauSelectionne = true;
      } else {
        nouveauCreneau = null;
        nouveauSelectionne = false;
      }
      
      return { ...j, creneau: nouveauCreneau, selectionne: nouveauSelectionne };
    }));
  };

  const handleSubmitPlanningHebdo = async (e) => {
    e.preventDefault();
    
    if (!planningHebdo.employe_id) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }
    
    const joursAvecCreneaux = joursHebdoPlanning
      .filter(j => j.selectionne && j.creneau !== null)
      .map(j => ({
        date: j.date,
        creneau: j.creneau
      }));
    
    if (joursAvecCreneaux.length === 0) {
      toast.error('Veuillez sélectionner au moins un jour');
      return;
    }
    
    try {
      let creneauxCrees = 0;
      
      // Créer directement les créneaux de planning (pas de demandes)
      for (const jour of joursAvecCreneaux) {
        if (jour.creneau === 'JOURNEE_COMPLETE') {
          // Créer 2 créneaux : matin + après-midi
          await axios.post(`${API}/planning`, {
            employe_id: planningHebdo.employe_id,
            date: jour.date,
            creneau: 'MATIN'
          });
          await axios.post(`${API}/planning`, {
            employe_id: planningHebdo.employe_id,
            date: jour.date,
            creneau: 'APRES_MIDI'
          });
          creneauxCrees += 2;
        } else {
          await axios.post(`${API}/planning`, {
            employe_id: planningHebdo.employe_id,
            date: jour.date,
            creneau: jour.creneau
          });
          creneauxCrees += 1;
        }
      }
      
      toast.success(`${creneauxCrees} créneau(x) créé(s) avec succès`);
      setShowPlanningHebdoModal(false);
      
      // Recharger le planning
      if (viewMode === 'semaine') {
        fetchPlanningSemaine(selectedWeek);
      } else if (viewMode === 'mois') {
        fetchPlanningMois(selectedMonth);
      } else if (viewMode === 'planning') {
        fetchPlanningTableau(selectedWeek);
      } else {
        fetchPlanningByDate(selectedDate);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création des créneaux');
    }
  };

  // Ouvrir le modal de création/modification rapide pour la Vue Planning
  const openQuickCreneauModal = (employe, date, creneau, existingCreneau = null) => {
    // Vérifier si l'utilisateur peut modifier le planning
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    
    setQuickCreneauData({
      id: existingCreneau?.id || null, // ID pour la modification
      employe_id: employe.id,
      employe: employe,
      date: date,
      creneau: creneau,
      notes: existingCreneau?.notes || '',
      // Ne pré-remplir les horaires QUE si un créneau existe
      horaire_debut: existingCreneau?.horaire_debut || '',
      horaire_fin: existingCreneau?.horaire_fin || '',
      horaire_pause_debut: existingCreneau?.horaire_pause_debut || '',
      horaire_pause_fin: existingCreneau?.horaire_pause_fin || '',
      salle_attribuee: existingCreneau?.salle_attribuee || '',
      salle_attente: existingCreneau?.salle_attente || '',
      medecin_ids: existingCreneau?.medecin_ids || [],
      est_repos: existingCreneau?.est_repos || false
    });
    setShowQuickCreneauModal(true);
  };
  
  // Ouvrir le modal de vue détaillée d'une journée (tous les employés)
  const openDetailJourModal = (date) => {
    setDetailJourDate(date);
    setShowDetailJourModal(true);
  };
  
  // Récupérer tous les créneaux d'une journée groupés par période et rôle
  const getCreneauxJourneeGroupes = (date) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) {
      return { matin: { medecins: [], assistants: [], secretaires: [] }, apresMidi: { medecins: [], assistants: [], secretaires: [] } };
    }
    
    const creneaux = planningTableau.planning[date] || [];
    
    const matin = {
      medecins: creneaux.filter(c => c.creneau === 'MATIN' && c.employe_role === 'Médecin'),
      assistants: creneaux.filter(c => c.creneau === 'MATIN' && c.employe_role === 'Assistant'),
      secretaires: creneaux.filter(c => c.creneau === 'MATIN' && c.employe_role === 'Secrétaire')
    };
    
    const apresMidi = {
      medecins: creneaux.filter(c => c.creneau === 'APRES_MIDI' && c.employe_role === 'Médecin'),
      assistants: creneaux.filter(c => c.creneau === 'APRES_MIDI' && c.employe_role === 'Assistant'),
      secretaires: creneaux.filter(c => c.creneau === 'APRES_MIDI' && c.employe_role === 'Secrétaire')
    };
    
    return { matin, apresMidi };
  };
  
  // Ouvrir le modal journée complète (matin + après-midi)
  const openJourneeModal = (employe, date) => {
    // Vérifier si l'utilisateur peut modifier le planning
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    
    const creneauMatin = getCreneauForEmploye(employe.id, date, 'MATIN');
    const creneauAM = getCreneauForEmploye(employe.id, date, 'APRES_MIDI');
    
    // Vérifier si un congé existe pour cette date
    const congeExistant = congesApprouves.find(c => 
      c.utilisateur_id === employe.id && 
      c.statut === 'APPROUVE' && 
      c.date_debut <= date && 
      c.date_fin >= date
    );
    
    // Pré-cocher les cases congé si un congé existe
    const hasConge = !!congeExistant;
    const typeCongeExistant = congeExistant?.type_conge || 'CONGE_PAYE';
    
    setJourneeData({
      employe_id: employe.id,
      employe: employe,
      date: date,
      congeExistant: congeExistant || null,
      matin: {
        id: creneauMatin?.id || null,
        exists: !!creneauMatin,
        actif: !!creneauMatin,
        notes: creneauMatin?.notes || '',
        salle_attribuee: creneauMatin?.salle_attribuee || '',
        salle_attente: creneauMatin?.salle_attente || '',
        medecin_ids: creneauMatin?.medecin_ids || [],
        // Ne pré-remplir les horaires QUE si un créneau existe
        horaire_debut: creneauMatin?.horaire_debut || '',
        horaire_fin: creneauMatin?.horaire_fin || '',
        conge: hasConge,
        type_conge: hasConge ? typeCongeExistant : '',
        heures_conge: employe.heures_demi_journee_conge || 4
      },
      apresMidi: {
        id: creneauAM?.id || null,
        exists: !!creneauAM,
        actif: !!creneauAM,
        notes: creneauAM?.notes || '',
        salle_attribuee: creneauAM?.salle_attribuee || '',
        salle_attente: creneauAM?.salle_attente || '',
        medecin_ids: creneauAM?.medecin_ids || [],
        // Ne pré-remplir les horaires QUE si un créneau existe
        horaire_debut: creneauAM?.horaire_debut || '',
        horaire_fin: creneauAM?.horaire_fin || '',
        conge: hasConge,
        type_conge: hasConge ? typeCongeExistant : '',
        heures_conge: employe.heures_demi_journee_conge || 4
      },
      heures_supp_jour: 0,
      heures_rattraper_jour: 0
    });
    setShowAssistantsDetails(false);
    setShowJourneeModal(true);
  };
  
  // Supprimer un congé existant
  const handleSupprimerCongeExistant = async (congeId) => {
    try {
      await axios.delete(`${API}/conges/${congeId}`);
      toast.success('Congé supprimé !');
      // Recharger le planning pour refléter les changements
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur suppression congé:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression du congé');
    }
  };
  
  // Modifier le type d'un congé existant
  const handleModifierTypeConge = async (congeId, nouveauType) => {
    try {
      // Utiliser l'endpoint correct: /conges/{id}/modifier-type
      await axios.put(`${API}/conges/${congeId}/modifier-type`, { type_conge: nouveauType });
      toast.success('Type de congé modifié !');
      // Recharger le planning pour refléter les changements
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur modification type congé:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };
  
  // Scinder un congé multi-jours pour modifier un jour spécifique
  const handleScinderConge = async (congeId, dateAModifier, creneau, nouveauType, creerCreneauTravail = false) => {
    try {
      const response = await axios.put(`${API}/conges/${congeId}/scinder`, {
        date_a_modifier: dateAModifier,
        creneau: creneau, // 'MATIN', 'APRES_MIDI', ou 'JOURNEE_COMPLETE'
        nouveau_type: nouveauType, // null = supprimer le congé pour ce jour, sinon le nouveau type
        creer_creneau_travail: creerCreneauTravail
      });
      toast.success(response.data.message || 'Congé modifié avec succès !');
      // Recharger le planning pour refléter les changements
      fetchPlanningTableau(selectedWeek);
      setShowJourneeModal(false);
      return response.data;
    } catch (error) {
      console.error('Erreur scission congé:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification du congé');
      return null;
    }
  };
  
  // Soumettre le modal journée complète
  // Enregistrer uniquement le MATIN
  const handleEnregistrerMatin = async () => {
    try {
      const payloadMatin = {
        notes: journeeData.matin.notes || 'Présence',
        salle_attribuee: journeeData.matin.salle_attribuee || null,
        salle_attente: journeeData.matin.salle_attente || null,
        medecin_ids: journeeData.matin.medecin_ids || [],
        horaire_debut: journeeData.matin.horaire_debut || null,
        horaire_fin: journeeData.matin.horaire_fin || null
      };
      
      if (journeeData.matin.id) {
        await axios.put(`${API}/planning/${journeeData.matin.id}`, payloadMatin);
        toast.success('Matin modifié !');
      } else {
        await axios.post(`${API}/planning`, {
          employe_id: journeeData.employe_id,
          date: journeeData.date,
          creneau: 'MATIN',
          ...payloadMatin
        });
        toast.success('Matin créé !');
      }
      
      setShowJourneeModal(false);
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'enregistrement du matin');
    }
  };

  // Supprimer uniquement le MATIN
  const handleSupprimerMatin = async () => {
    if (!journeeData.matin.id) return;
    try {
      await axios.delete(`${API}/planning/${journeeData.matin.id}`);
      toast.success('Matin supprimé !');
      setShowJourneeModal(false);
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Enregistrer uniquement l'APRÈS-MIDI
  const handleEnregistrerApresMidi = async () => {
    try {
      const payloadAM = {
        notes: journeeData.apresMidi.notes || 'Présence',
        salle_attribuee: journeeData.apresMidi.salle_attribuee || null,
        salle_attente: journeeData.apresMidi.salle_attente || null,
        medecin_ids: journeeData.apresMidi.medecin_ids || [],
        horaire_debut: journeeData.apresMidi.horaire_debut || null,
        horaire_fin: journeeData.apresMidi.horaire_fin || null
      };
      
      if (journeeData.apresMidi.id) {
        await axios.put(`${API}/planning/${journeeData.apresMidi.id}`, payloadAM);
        toast.success('Après-midi modifié !');
      } else {
        await axios.post(`${API}/planning`, {
          employe_id: journeeData.employe_id,
          date: journeeData.date,
          creneau: 'APRES_MIDI',
          ...payloadAM
        });
        toast.success('Après-midi créé !');
      }
      
      setShowJourneeModal(false);
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'enregistrement de l\'après-midi');
    }
  };

  // Supprimer uniquement l'APRÈS-MIDI
  const handleSupprimerApresMidi = async () => {
    if (!journeeData.apresMidi.id) return;
    try {
      await axios.delete(`${API}/planning/${journeeData.apresMidi.id}`);
      toast.success('Après-midi supprimé !');
      setShowJourneeModal(false);
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Supprimer la JOURNÉE COMPLÈTE (matin + après-midi)
  const handleSupprimerJourneeComplete = async () => {
    if (!journeeData.matin.id && !journeeData.apresMidi.id) {
      toast.error('Aucun créneau à supprimer');
      return;
    }
    
    try {
      const promises = [];
      if (journeeData.matin.id) {
        promises.push(axios.delete(`${API}/planning/${journeeData.matin.id}`));
      }
      if (journeeData.apresMidi.id) {
        promises.push(axios.delete(`${API}/planning/${journeeData.apresMidi.id}`));
      }
      
      await Promise.all(promises);
      toast.success('Journée complète supprimée !');
      setShowJourneeModal(false);
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Enregistrer la JOURNÉE COMPLÈTE (matin + après-midi)
  const handleJourneeSubmit = async (e) => {
    if (e) e.preventDefault();
    
    try {
      const promises = [];
      
      // Créer un congé si demandé pour les secrétaires
      if (journeeData.employe?.role === 'Secrétaire' && (journeeData.matin.conge || journeeData.apresMidi.conge)) {
        // Déterminer le type de congé et la durée
        const typeConge = journeeData.matin.type_conge || journeeData.apresMidi.type_conge || 'CONGE_PAYE';
        let duree = 'JOURNEE_COMPLETE';
        if (journeeData.matin.conge && !journeeData.apresMidi.conge) duree = 'MATIN';
        if (!journeeData.matin.conge && journeeData.apresMidi.conge) duree = 'APRES_MIDI';
        
        // Utiliser les heures personnalisées si définies
        const heuresConge = journeeData.matin.heures_conge || journeeData.apresMidi.heures_conge || null;
        
        const congePayload = {
          utilisateur_id: journeeData.employe_id, // ID de la secrétaire
          date_debut: journeeData.date,
          date_fin: journeeData.date,
          type_conge: typeConge,
          duree: duree,
          heures_conge: heuresConge,
          motif: `Congé ajouté depuis le planning`
        };
        
        await axios.post(`${API}/conges/direct`, congePayload);
        toast.success('Congé/Repos créé avec succès !');
        setShowJourneeModal(false);
        fetchPlanningTableau(selectedWeek);
        return;
      }
      
      // Créer un congé si demandé pour les assistants
      if (journeeData.employe?.role === 'Assistant' && (journeeData.matin.conge || journeeData.apresMidi.conge)) {
        const typeConge = journeeData.matin.type_conge || journeeData.apresMidi.type_conge || 'CONGE_PAYE';
        let duree = 'JOURNEE_COMPLETE';
        if (journeeData.matin.conge && !journeeData.apresMidi.conge) duree = 'MATIN';
        if (!journeeData.matin.conge && journeeData.apresMidi.conge) duree = 'APRES_MIDI';
        
        // Utiliser les heures personnalisées si définies
        const heuresConge = journeeData.matin.heures_conge || journeeData.apresMidi.heures_conge || null;
        
        const congePayload = {
          utilisateur_id: journeeData.employe_id,
          date_debut: journeeData.date,
          date_fin: journeeData.date,
          type_conge: typeConge,
          duree: duree,
          heures_conge: heuresConge,
          motif: `Congé ajouté depuis le planning`
        };
        
        await axios.post(`${API}/conges/direct`, congePayload);
        toast.success('Congé/Repos créé avec succès !');
        setShowJourneeModal(false);
        fetchPlanningTableau(selectedWeek);
        return;
      }
      
      // MATIN
      const payloadMatin = {
        notes: journeeData.matin.notes || 'Présence',
        salle_attribuee: journeeData.matin.salle_attribuee || null,
        salle_attente: journeeData.matin.salle_attente || null,
        medecin_ids: journeeData.matin.medecin_ids || [],
        horaire_debut: journeeData.matin.horaire_debut || null,
        horaire_fin: journeeData.matin.horaire_fin || null
      };
      
      if (journeeData.matin.id) {
        promises.push(axios.put(`${API}/planning/${journeeData.matin.id}`, payloadMatin));
      } else {
        promises.push(axios.post(`${API}/planning`, {
          employe_id: journeeData.employe_id,
          date: journeeData.date,
          creneau: 'MATIN',
          ...payloadMatin
        }));
      }
      
      // APRÈS-MIDI
      const payloadAM = {
        notes: journeeData.apresMidi.notes || 'Présence',
        salle_attribuee: journeeData.apresMidi.salle_attribuee || null,
        salle_attente: journeeData.apresMidi.salle_attente || null,
        medecin_ids: journeeData.apresMidi.medecin_ids || [],
        horaire_debut: journeeData.apresMidi.horaire_debut || null,
        horaire_fin: journeeData.apresMidi.horaire_fin || null
      };
      
      if (journeeData.apresMidi.id) {
        promises.push(axios.put(`${API}/planning/${journeeData.apresMidi.id}`, payloadAM));
      } else {
        promises.push(axios.post(`${API}/planning`, {
          employe_id: journeeData.employe_id,
          date: journeeData.date,
          creneau: 'APRES_MIDI',
          ...payloadAM
        }));
      }
      
      await Promise.all(promises);
      
      // Mettre à jour les heures supplémentaires si renseignées
      if (journeeData.heures_supp_jour > 0 || journeeData.heures_rattraper_jour > 0) {
        const currentSupp = journeeData.employe?.heures_supplementaires || 0;
        const newSupp = currentSupp + (journeeData.heures_supp_jour || 0) - (journeeData.heures_rattraper_jour || 0);
        await updateEmployeSemaineConfig(journeeData.employe_id, 'heures_supplementaires', newSupp);
      }
      
      toast.success('Journée mise à jour !');
      setShowJourneeModal(false);
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };
  
  // Récupérer les médecins présents pour un jour et créneau donné
  const getMedecinsPresentsPourCreneau = (date, creneau) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) return [];
    return planningTableau.planning[date]
      .filter(p => p.employe_role === 'Médecin' && p.creneau === creneau)
      .map(p => ({
        id: p.employe_id,
        nom: p.employe?.nom,
        prenom: p.employe?.prenom,
        initiales: `${p.employe?.prenom?.[0] || ''}${p.employe?.nom?.[0] || ''}`.toUpperCase()
      }))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  };

  // Créer ou modifier un créneau rapidement depuis la Vue Planning
  const handleQuickCreneauSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        notes: quickCreneauData.notes || 'Présence',
        horaire_debut: quickCreneauData.horaire_debut || null,
        horaire_fin: quickCreneauData.horaire_fin || null,
        horaire_pause_debut: quickCreneauData.horaire_pause_debut || null,
        horaire_pause_fin: quickCreneauData.horaire_pause_fin || null,
        salle_attribuee: quickCreneauData.salle_attribuee || null,
        salle_attente: quickCreneauData.salle_attente || null,
        medecin_ids: quickCreneauData.medecin_ids || [],
        est_repos: quickCreneauData.est_repos || false
      };
      
      if (quickCreneauData.id) {
        // Modification
        await axios.put(`${API}/planning/${quickCreneauData.id}`, payload);
        toast.success('Créneau modifié !');
      } else {
        // Création
        await axios.post(`${API}/planning`, {
          employe_id: quickCreneauData.employe_id,
          date: quickCreneauData.date,
          creneau: quickCreneauData.creneau,
          ...payload
        });
        toast.success('Créneau créé !');
      }
      
      setShowQuickCreneauModal(false);
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };
  
  // Vérifier si un box/salle est déjà utilisé pour un jour donné
  const isSalleUtiliseeJour = (salleNom, date) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) return false;
    return planningTableau.planning[date].some(p => 
      p.salle_attribuee === salleNom || p.salle_attente === salleNom
    );
  };
  
  // Vérifier si un médecin est déjà associé à un assistant pour la journée (matin OU après-midi)
  const isMedecinDejaAssocieJour = (medecinId, date, creneau = null) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) return false;
    return planningTableau.planning[date].some(p => 
      p.employe_role === 'Assistant' && 
      (creneau ? p.creneau === creneau : true) &&
      p.medecin_ids && 
      p.medecin_ids.includes(medecinId)
    );
  };
  
  // Obtenir l'assistant qui a ce médecin associé (pour afficher son nom)
  const getAssistantPourMedecin = (medecinId, date, creneau, excludeAssistantId = null) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) return null;
    const assistantCreneau = planningTableau.planning[date].find(p => 
      p.employe_role === 'Assistant' && 
      p.creneau === creneau &&
      p.medecin_ids && 
      p.medecin_ids.includes(medecinId) &&
      (excludeAssistantId ? p.employe_id !== excludeAssistantId : true)
    );
    if (!assistantCreneau) return null;
    const assistant = users.find(u => u.id === assistantCreneau.employe_id);
    return assistant ? `${assistant.prenom} ${assistant.nom}` : 'Un autre assistant';
  };

  // Supprimer un créneau depuis la Vue Planning
  const handleDeleteCreneauTableau = async (creneauId) => {
    try {
      await axios.delete(`${API}/planning/${creneauId}`);
      toast.success('Créneau supprimé');
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };
  
  // Obtenir l'affichage pour un assistant (initiales médecins + salle ou note ou PRÉSENT)
  const getAssistantDisplay = (creneau) => {
    if (!creneau) return null;
    
    // Si médecins associés, afficher leurs initiales
    if (creneau.medecin_ids && creneau.medecin_ids.length > 0) {
      // Trouver les médecins associés
      const medecinsAssocies = users.filter(u => creneau.medecin_ids.includes(u.id));
      const initiales = medecinsAssocies.map(m => 
        `${m.prenom?.[0] || ''}${m.nom?.[0] || ''}`.toUpperCase()
      ).join(' ');
      
      // Ajouter la salle si définie
      if (creneau.salle_attribuee) {
        return `${initiales} (${creneau.salle_attribuee})`;
      }
      return initiales;
    }
    
    // Si salle définie mais pas de médecins
    if (creneau.salle_attribuee) {
      return creneau.salle_attribuee;
    }
    
    // Si note personnalisée
    if (creneau.notes && creneau.notes !== 'Présence') {
      return creneau.notes;
    }
    
    return 'PRÉSENT';
  };
  
  // Obtenir l'affichage pour un médecin (box ou note ou M/AM)
  const getMedecinDisplay = (creneau, defaultDisplay) => {
    if (!creneau) return null;
    
    // Si box défini, l'afficher en priorité
    if (creneau.salle_attribuee) {
      return creneau.salle_attribuee;
    }
    
    // Si note personnalisée
    if (creneau.notes && creneau.notes !== 'Présence') {
      return creneau.notes;
    }
    
    return defaultDisplay;
  };

  // Vérifier si un médecin a un assistant attribué pour un créneau donné
  const medecinHasAssistant = (medecinId, date, creneau) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) return false;
    
    // Chercher si un assistant a ce médecin dans ses medecin_ids
    return planningTableau.planning[date].some(p => 
      p.employe_role === 'Assistant' && 
      p.creneau === creneau &&
      p.medecin_ids && 
      p.medecin_ids.includes(medecinId)
    );
  };

  // Récupérer les demandes de congés pour un employé à une date donnée
  const getCongesForEmployeDate = (employeId, date) => {
    if (!congesApprouves) return [];
    return congesApprouves.filter(conge => 
      conge.utilisateur_id === employeId &&
      new Date(conge.date_debut) <= new Date(date) &&
      new Date(conge.date_fin) >= new Date(date)
    );
  };

  // Récupérer les demandes de congés EN ATTENTE pour un employé à une date donnée  
  const getCongesEnAttenteForEmployeDate = (employeId, date) => {
    if (!congesEnAttente) return [];
    return congesEnAttente.filter(conge => 
      conge.utilisateur_id === employeId &&
      new Date(conge.date_debut) <= new Date(date) &&
      new Date(conge.date_fin) >= new Date(date)
    );
  };

  // Récupérer toutes les demandes de travail en attente pour un médecin à une date donnée
  const getDemandesCreneauxEnAttenteForDate = (medecinId, date) => {
    if (!demandesTravail) return [];
    return demandesTravail.filter(d => 
      d.medecin_id === medecinId &&
      d.date_demandee === date &&
      d.statut === 'EN_ATTENTE'
    );
  };

  // Approuver une demande de travail rapidement depuis le planning
  const handleApprouverDemandeTravailRapide = async (demande) => {
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    
    try {
      const body = {
        commentaire: 'Approuvé depuis le planning'
      };
      
      await axios.put(`${API}/demandes-travail/${demande.id}/approuver`, body);
      toast.success('Demande approuvée avec succès');
      
      // Rafraîchir les données
      fetchPlanningTableau(selectedWeek);
      setDemandesTravail(prev => prev.filter(d => d.id !== demande.id));
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'approbation');
    }
  };

  // Refuser une demande de travail rapidement depuis le planning
  const handleRefuserDemandeTravailRapide = async (demande) => {
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    
    const raison = window.prompt('Raison du refus (optionnel):');
    if (raison === null) return; // Annulé
    
    try {
      await axios.put(`${API}/demandes-travail/${demande.id}/rejeter`, {
        commentaire: raison || 'Refusé depuis le planning'
      });
      toast.success('Demande refusée');
      
      // Rafraîchir les données
      fetchPlanningTableau(selectedWeek);
      setDemandesTravail(prev => prev.filter(d => d.id !== demande.id));
    } catch (error) {
      toast.error('Erreur lors du refus');
    }
  };

  // Approuver un congé rapidement depuis le planning
  const handleApprouverCongeRapide = async (conge) => {
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    
    try {
      await axios.put(`${API}/conges/${conge.id}/approuver`, {
        approuve: true,
        commentaire: 'Approuvé depuis le planning'
      });
      toast.success('Congé approuvé');
      
      // Rafraîchir les données
      fetchPlanningTableau(selectedWeek);
      setCongesEnAttente(prev => prev.filter(c => c.id !== conge.id));
    } catch (error) {
      toast.error('Erreur lors de l\'approbation');
    }
  };

  // Refuser un congé rapidement depuis le planning
  const handleRefuserCongeRapide = async (conge) => {
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    
    const raison = window.prompt('Raison du refus (optionnel):');
    if (raison === null) return;
    
    try {
      await axios.put(`${API}/conges/${conge.id}/approuver`, {
        approuve: false,
        commentaire: raison || 'Refusé depuis le planning'
      });
      toast.success('Congé refusé');
      
      // Rafraîchir les données
      fetchPlanningTableau(selectedWeek);
      setCongesEnAttente(prev => prev.filter(c => c.id !== conge.id));
    } catch (error) {
      toast.error('Erreur lors du refus');
    }
  };

  // Changer le type d'un congé (basculer entre congé payé et repos)
  const handleChangerTypeCongeRapide = async (conge) => {
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    // Si c'est REPOS -> passer en CONGE_PAYE, sinon passer en REPOS
    const estRepos = conge.type_conge === 'REPOS';
    const nouveauType = estRepos ? 'CONGE_PAYE' : 'REPOS';
    const label = nouveauType === 'REPOS' ? 'Repos (non comptabilisé)' : 'Congé payé';
    
    if (!window.confirm(`Changer en "${label}" ?`)) return;
    
    try {
      await axios.put(`${API}/conges/${conge.id}/modifier-type?nouveau_type=${nouveauType}`);
      toast.success(`Type modifié en "${label}"`);
      
      // Rafraîchir les données
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      toast.error('Erreur lors de la modification');
    }
  };

  // Sauvegarder une note pour un jour de planning
  const handleSaveNotePlanningJour = async (date, note) => {
    if (!canModifyPlanning()) {
      toast.error('Vous n\'avez pas la permission de modifier le planning');
      return;
    }
    
    try {
      await axios.put(`${API}/planning/notes/${date}`, { date, note });
      setNotesPlanningJour(prev => ({...prev, [date]: note}));
    } catch (error) {
      console.error('Erreur sauvegarde note:', error);
      toast.error('Erreur lors de la sauvegarde de la note');
    }
  };

  // Obtenir le label court du type de congé
  const getTypeCongeShortLabel = (type) => {
    const types = {
      'CONGE_PAYE': 'CP',
      'CONGE_SANS_SOLDE': 'CSS',
      'MALADIE': 'MAL',
      'REPOS': 'REP',  // Repos non comptabilisé (aucun effet)
      'HEURES_A_RECUPERER': 'H+',  // Heures à récupérer (heures sup positif)
      'HEURES_RECUPEREES': 'H-'   // Heures récupérées (heures sup négatif)
    };
    return types[type] || type?.substring(0, 3) || '?';
  };

  // Déterminer si un congé est "comptabilisé" comme CONGÉ (uniquement CONGE_PAYE)
  // CONGE_SANS_SOLDE et MALADIE comptent en heures effectuées mais PAS comme congés
  const isCongeComptabilise = (typeConge) => {
    // Seul CONGE_PAYE compte comme "congé" dans la colonne Congés
    return typeConge === 'CONGE_PAYE';
  };

  // Obtenir les classes CSS pour un congé selon son type
  const getCongeColorClasses = (typeConge, isBackground = false) => {
    if (typeConge === 'HEURES_A_RECUPERER') {
      // Heures à récupérer -> BLEU
      return isBackground 
        ? 'bg-blue-200 hover:bg-blue-300' 
        : 'text-blue-800';
    } else if (typeConge === 'HEURES_RECUPEREES') {
      // Heures récupérées -> VIOLET
      return isBackground 
        ? 'bg-purple-200 hover:bg-purple-300' 
        : 'text-purple-800';
    } else if (typeConge === 'CONGE_PAYE') {
      // Congés payés (seul type comptabilisé en congés) -> ROUGE
      return isBackground 
        ? 'bg-red-200 hover:bg-red-300' 
        : 'text-red-800';
    } else if (typeConge === 'MALADIE' || typeConge === 'CONGE_SANS_SOLDE') {
      // Maladie/Sans solde = heures effectuées mais PAS congés -> ROSE
      return isBackground 
        ? 'bg-pink-200 hover:bg-pink-300' 
        : 'text-pink-800';
    } else {
      // Repos non comptabilisé -> ORANGE
      return isBackground 
        ? 'bg-orange-200 hover:bg-orange-300' 
        : 'text-orange-800';
    }
  };

  // Calculer le total de demi-journées pour un employé sur la semaine
  const getTotalDemiJournees = (employeId) => {
    if (!planningTableau.planning) return 0;
    let total = 0;
    planningTableau.dates?.forEach(date => {
      const dayPlanning = planningTableau.planning[date] || [];
      dayPlanning.forEach(c => {
        if (c.employe_id === employeId) total++;
      });
    });
    return total;
  };

  // Fonction pour abréger un nom (Prénom N.)
  const abbreviateName = (prenom, nom) => {
    if (!prenom || !nom) return prenom || nom || '';
    return `${prenom} ${nom.charAt(0)}.`;
  };

  // Obtenir la couleur du total selon les règles
  const getTotalColor = (total, type = 'employe', employe = null) => {
    if (type === 'employe') {
      // Utiliser la limite personnalisée de l'employé si disponible
      const limite = employe?.limite_demi_journees || 10;
      if (total < limite) return 'bg-green-100 text-green-800';
      if (total === limite) return 'bg-orange-100 text-orange-800';
      return 'bg-red-100 text-red-800';
    } else {
      // Pour le total médecins : basé sur le nombre de salles médecin
      const nbSallesMedecin = salles.filter(s => s.type === 'MEDECIN').length || 6;
      if (total < nbSallesMedecin) return 'bg-green-100 text-green-800';
      if (total === nbSallesMedecin) return 'bg-orange-100 text-orange-800';
      return 'bg-red-100 text-red-800';
    }
  };

  // Calculer les heures travaillées pour un employé sur la période affichée
  const getTotalHeures = (employeId) => {
    if (!planningTableau.planning) return 0;
    const employe = users.find(u => u.id === employeId);
    if (!employe) return 0;
    
    let totalMinutes = 0;
    
    planningTableau.dates?.forEach(date => {
      const dayPlanning = planningTableau.planning[date] || [];
      dayPlanning.forEach(c => {
        if (c.employe_id === employeId) {
          if (employe.role === 'Secrétaire') {
            // Pour les secrétaires : calculer selon les horaires
            if (c.horaire_debut && c.horaire_fin) {
              const [hDeb, mDeb] = c.horaire_debut.split(':').map(Number);
              const [hFin, mFin] = c.horaire_fin.split(':').map(Number);
              let minutes = (hFin * 60 + mFin) - (hDeb * 60 + mDeb);
              
              // Si c'est le matin et il y a une pause
              if (c.creneau === 'MATIN' && c.horaire_pause_debut) {
                const [hPause, mPause] = c.horaire_pause_debut.split(':').map(Number);
                minutes = (hPause * 60 + mPause) - (hDeb * 60 + mDeb);
              }
              // Si c'est l'après-midi et il y a une reprise après pause
              if (c.creneau === 'APRES_MIDI' && c.horaire_pause_fin) {
                const [hReprise, mReprise] = c.horaire_pause_fin.split(':').map(Number);
                minutes = (hFin * 60 + mFin) - (hReprise * 60 + mReprise);
              }
              
              totalMinutes += Math.max(0, minutes);
            }
          } else {
            // Pour assistants/médecins : utiliser heures_demi_journee_travail si défini
            const heuresParDemiJournee = employe.heures_demi_journee_travail || (employe.heures_par_jour ? employe.heures_par_jour / 2 : 3.5);
            totalMinutes += heuresParDemiJournee * 60;
          }
          
          // Ajouter les heures supplémentaires si présentes
          if (c.heures_supplementaires) {
            totalMinutes += (c.heures_supplementaires || 0) * 60;
          }
        }
      });
    });
    
    return Math.round(totalMinutes / 60 * 10) / 10; // Arrondir à 0.1h
  };

  // Calculer les heures supp/récup pour le MOIS en cours
  const getHeuresSupMois = (employeId) => {
    const employe = users.find(u => u.id === employeId);
    if (!employe || !planningTableau.dates?.length) return 0;
    
    // Récupérer le mois de la semaine affichée
    const dateRef = new Date(planningTableau.dates[0] + 'T12:00:00');
    const mois = dateRef.getMonth();
    const annee = dateRef.getFullYear();
    const premierJour = new Date(annee, mois, 1);
    const dernierJour = new Date(annee, mois + 1, 0);
    
    let heuresEffectives = 0;
    let heuresContrat = 0;
    let heuresARecuperer = 0;
    let heuresRecuperees = 0;
    const heuresParDemiJ = employe.heures_demi_journee_travail || (employe.heures_par_jour ? employe.heures_par_jour / 2 : 3.5);
    const heuresParSemaine = employe.heures_semaine_fixe || 35;
    
    // Parcourir chaque jour du mois
    for (let jour = new Date(premierJour); jour <= dernierJour; jour.setDate(jour.getDate() + 1)) {
      const dateStr = jour.toISOString().split('T')[0];
      const jourSemaine = jour.getDay();
      
      // Ignorer dimanche
      if (jourSemaine === 0) continue;
      
      // Heures prévues (jours ouvrés lun-ven)
      if (jourSemaine >= 1 && jourSemaine <= 5) {
        heuresContrat += heuresParSemaine / 5;
      }
      
      // Heures effectuées (créneaux du planning) - exclure les repos
      const creneauxJour = planningTableau.planning?.[dateStr]?.filter(c => c.employe_id === employeId && !c.est_repos) || [];
      creneauxJour.forEach(creneau => {
        if (employe.role === 'Secrétaire' && creneau.horaire_debut && creneau.horaire_fin) {
          const [h1, m1] = creneau.horaire_debut.split(':').map(Number);
          const [h2, m2] = creneau.horaire_fin.split(':').map(Number);
          heuresEffectives += (h2 + m2/60) - (h1 + m1/60);
        } else {
          heuresEffectives += heuresParDemiJ; // Une demi-journée
        }
      });
      
      // Traiter les congés selon leur type
      const congesJour = congesApprouves?.filter(c => 
        c.utilisateur_id === employeId && 
        dateStr >= c.date_debut && dateStr <= c.date_fin
      ) || [];
      congesJour.forEach(conge => {
        const heuresConge = conge.heures_conge || employe.heures_demi_journee_conge || 4;
        const heuresJour = conge.demi_journee ? heuresConge : heuresConge * 2;
        
        // REPOS : ne compte pas du tout
        if (conge.type_conge === 'REPOS' || conge.type_conge === 'REPOS_COMPENSATEUR') {
          return;
        }
        // HEURES_A_RECUPERER : heures sup positives (PAS heures effectives)
        if (conge.type_conge === 'HEURES_A_RECUPERER') {
          heuresARecuperer += heuresJour;
          return;
        }
        // HEURES_RECUPEREES : heures sup négatives (PAS heures effectives)
        if (conge.type_conge === 'HEURES_RECUPEREES') {
          heuresRecuperees += heuresJour;
          return;
        }
        // CONGE_PAYE, MALADIE, CONGE_SANS_SOLDE : comptent comme heures effectives
        heuresEffectives += heuresJour;
      });
    }
    
    // Formule: (heures effectives - contrat) + heures à récupérer - heures récupérées
    return Math.round((heuresEffectives - heuresContrat + heuresARecuperer - heuresRecuperees) * 10) / 10;
  };

  // Calculer les heures supp/récup pour l'ANNÉE en cours
  const getHeuresSupAnnee = (employeId) => {
    const employe = users.find(u => u.id === employeId);
    if (!employe || !planningTableau.dates?.length) return 0;
    
    // Récupérer l'année de la semaine affichée
    const dateRef = new Date(planningTableau.dates[0] + 'T12:00:00');
    const annee = dateRef.getFullYear();
    
    let heuresEffectives = 0;
    let heuresContrat = 0;
    let heuresARecuperer = 0;
    let heuresRecuperees = 0;
    const heuresParDemiJ = employe.heures_demi_journee_travail || (employe.heures_par_jour ? employe.heures_par_jour / 2 : 3.5);
    const heuresParSemaine = employe.heures_semaine_fixe || 35;
    
    // Parcourir chaque jour de l'année (du 1er janvier jusqu'à aujourd'hui ou fin de l'année)
    const premierJour = new Date(annee, 0, 1);
    const dernierJour = new Date(); // Aujourd'hui
    dernierJour.setHours(23, 59, 59, 999);
    
    for (let jour = new Date(premierJour); jour <= dernierJour; jour.setDate(jour.getDate() + 1)) {
      const dateStr = jour.toISOString().split('T')[0];
      const jourSemaine = jour.getDay();
      
      // Ignorer dimanche
      if (jourSemaine === 0) continue;
      
      // Heures prévues (jours ouvrés lun-ven)
      if (jourSemaine >= 1 && jourSemaine <= 5) {
        heuresContrat += heuresParSemaine / 5;
      }
      
      // Heures effectuées (créneaux du planning) - exclure les repos
      const creneauxJour = planningTableau.planning?.[dateStr]?.filter(c => c.employe_id === employeId && !c.est_repos) || [];
      creneauxJour.forEach(creneau => {
        if (employe.role === 'Secrétaire' && creneau.horaire_debut && creneau.horaire_fin) {
          const [h1, m1] = creneau.horaire_debut.split(':').map(Number);
          const [h2, m2] = creneau.horaire_fin.split(':').map(Number);
          heuresEffectives += (h2 + m2/60) - (h1 + m1/60);
        } else {
          heuresEffectives += heuresParDemiJ; // Une demi-journée
        }
      });
      
      // Traiter les congés selon leur type
      const congesJour = congesApprouves?.filter(c => 
        c.utilisateur_id === employeId && 
        dateStr >= c.date_debut && dateStr <= c.date_fin
      ) || [];
      congesJour.forEach(conge => {
        const heuresConge = conge.heures_conge || employe.heures_demi_journee_conge || 4;
        const heuresJour = conge.demi_journee ? heuresConge : heuresConge * 2;
        
        // REPOS : ne compte pas du tout
        if (conge.type_conge === 'REPOS' || conge.type_conge === 'REPOS_COMPENSATEUR') {
          return;
        }
        // HEURES_A_RECUPERER : heures sup positives (PAS heures effectives)
        if (conge.type_conge === 'HEURES_A_RECUPERER') {
          heuresARecuperer += heuresJour;
          return;
        }
        // HEURES_RECUPEREES : heures sup négatives (PAS heures effectives)
        if (conge.type_conge === 'HEURES_RECUPEREES') {
          heuresRecuperees += heuresJour;
          return;
        }
        // CONGE_PAYE, MALADIE, CONGE_SANS_SOLDE : comptent comme heures effectives
        heuresEffectives += heuresJour;
      });
    }
    
    // Formule: (heures effectives - contrat) + heures à récupérer - heures récupérées
    return Math.round((heuresEffectives - heuresContrat + heuresARecuperer - heuresRecuperees) * 10) / 10;
  };

  // Ouvrir le modal A/B/Co pour un employé ou une section
  const openSemaineABCModal = (target) => {
    setSemaineABCTarget(target);
    setShowSemaineABCModal(true);
  };

  // Appliquer la semaine A ou B à un employé
  const applySemaineToEmploye = async (employe, semaine) => {
    if (!employe) return;
    
    // Utiliser la nouvelle configuration semaine_a_config ou semaine_b_config
    const config = semaine === 'A' ? employe.semaine_a_config : employe.semaine_b_config;
    
    // Si pas de config, utiliser l'ancien système pour compatibilité
    const horaireId = semaine === 'A' ? employe.semaine_a_id : employe.semaine_b_id;
    const horaireOld = horairesSecretaires.find(h => String(h.id) === String(horaireId));
    
    if (!config && !horaireOld && employe.role === 'Secrétaire') {
      toast.error(`Semaine ${semaine} non configurée pour ${employe.prenom}. Cliquez sur ⚙️ Configurer pour définir les horaires.`);
      return 0;
    }
    
    let created = 0;
    const joursNoms = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    for (const date of planningTableau.dates) {
      // Vérifier si l'employé a déjà un congé ce jour
      const conges = getCongesForEmployeDate(employe.id, date);
      const congesEnAttente = getCongesEnAttenteForEmployeDate(employe.id, date);
      if (conges.length > 0 || congesEnAttente.length > 0) continue;
      
      // Vérifier les créneaux existants
      const creneauMatin = getCreneauForEmploye(employe.id, date, 'MATIN');
      const creneauAM = getCreneauForEmploye(employe.id, date, 'APRES_MIDI');
      
      // Obtenir la configuration pour ce jour
      const jourSemaine = new Date(date + 'T12:00:00').getDay(); // 0=Dim, 1=Lun, ..., 6=Sam
      const jourConfig = config ? config[jourSemaine === 0 ? 6 : jourSemaine - 1] : null; // Ajuster index (config[0]=Lundi)
      
      if (employe.role === 'Secrétaire') {
        // Pour les secrétaires : utiliser les horaires de la config
        if (jourConfig && jourConfig.actif) {
          // Créer le créneau MATIN si il n'existe pas
          if (!creneauMatin && jourConfig.debut_matin && jourConfig.fin_matin) {
            try {
              await axios.post(`${API}/planning`, {
                employe_id: employe.id,
                date: date,
                creneau: 'MATIN',
                horaire_debut: jourConfig.debut_matin,
                horaire_fin: jourConfig.fin_matin
              });
              created++;
            } catch (err) {
              console.error('Erreur création matin:', err);
            }
          }
          
          // Créer le créneau APRES_MIDI si il n'existe pas
          if (!creneauAM && jourConfig.debut_aprem && jourConfig.fin_aprem) {
            try {
              await axios.post(`${API}/planning`, {
                employe_id: employe.id,
                date: date,
                creneau: 'APRES_MIDI',
                horaire_debut: jourConfig.debut_aprem,
                horaire_fin: jourConfig.fin_aprem
              });
              created++;
            } catch (err) {
              console.error('Erreur création AM:', err);
            }
          }
        } else if (!config && horaireOld) {
          // Fallback sur l'ancien système
          if (!creneauMatin && horaireOld.debut_matin && horaireOld.fin_matin) {
            try {
              await axios.post(`${API}/planning`, {
                employe_id: employe.id,
                date: date,
                creneau: 'MATIN',
                horaire_debut: horaireOld.debut_matin,
                horaire_fin: horaireOld.fin_matin
              });
              created++;
            } catch (err) {
              console.error('Erreur création matin:', err);
            }
          }
          if (!creneauAM && horaireOld.debut_aprem && horaireOld.fin_aprem) {
            try {
              await axios.post(`${API}/planning`, {
                employe_id: employe.id,
                date: date,
                creneau: 'APRES_MIDI',
                horaire_debut: horaireOld.debut_aprem,
                horaire_fin: horaireOld.fin_aprem
              });
              created++;
            } catch (err) {
              console.error('Erreur création AM:', err);
            }
          }
        }
      } else {
        // Pour assistants/médecins : utiliser les demi-journées de la config
        if (jourConfig) {
          // Créer le créneau MATIN si prévu et n'existe pas
          if (!creneauMatin && jourConfig.matin) {
            try {
              await axios.post(`${API}/planning`, {
                employe_id: employe.id,
                date: date,
                creneau: 'MATIN',
                notes: 'Présence'
              });
              created++;
            } catch (err) {
              console.error('Erreur création matin:', err);
            }
          }
          
          // Créer le créneau APRES_MIDI si prévu et n'existe pas
          if (!creneauAM && jourConfig.apres_midi) {
            try {
              await axios.post(`${API}/planning`, {
                employe_id: employe.id,
                date: date,
                creneau: 'APRES_MIDI',
                notes: 'Présence'
              });
              created++;
            } catch (err) {
              console.error('Erreur création AM:', err);
            }
          }
        } else if (!config) {
          // Pas de config, créer les deux demi-journées par défaut (sauf dimanche et samedi)
          if (jourSemaine >= 1 && jourSemaine <= 5) {
            if (!creneauMatin) {
              try {
                await axios.post(`${API}/planning`, {
                  employe_id: employe.id,
                  date: date,
                  creneau: 'MATIN',
                  notes: 'Présence'
                });
                created++;
              } catch (err) {
                console.error('Erreur création matin:', err);
              }
            }
            if (!creneauAM) {
              try {
                await axios.post(`${API}/planning`, {
                  employe_id: employe.id,
                  date: date,
                  creneau: 'APRES_MIDI',
                  notes: 'Présence'
                });
                created++;
              } catch (err) {
                console.error('Erreur création AM:', err);
              }
            }
          }
        }
      }
    }
    
    return created;
  };

  // Appliquer la semaine A ou B à toute une section
  const applySemaineToSection = async (section, semaine) => {
    const employesDuRole = users.filter(u => u.actif && u.role === section);
    let totalCreated = 0;
    
    for (const employe of employesDuRole) {
      const created = await applySemaineToEmploye(employe, semaine);
      totalCreated += created || 0;
    }
    
    return totalCreated;
  };

  // Appliquer une semaine de congés
  const applyCongesSemaine = async (employe) => {
    if (!employe) return;
    
    let created = 0;
    
    for (const date of planningTableau.dates) {
      // Vérifier si l'employé a déjà un congé ce jour
      const conges = getCongesForEmployeDate(employe.id, date);
      const congesEnAttente = getCongesEnAttenteForEmployeDate(employe.id, date);
      if (conges.length > 0 || congesEnAttente.length > 0) continue;
      
      // Vérifier les créneaux existants - ne pas écraser
      const creneauMatin = getCreneauForEmploye(employe.id, date, 'MATIN');
      const creneauAM = getCreneauForEmploye(employe.id, date, 'APRES_MIDI');
      if (creneauMatin || creneauAM) continue;
      
      // Créer le congé
      try {
        await axios.post(`${API}/conges`, {
          employe_id: employe.id,
          date_debut: date,
          date_fin: date,
          type_conge: 'CP',
          motif: 'Congés semaine complète',
          statut: 'APPROUVE'
        });
        created++;
      } catch (err) {
        console.error('Erreur création congé:', err);
      }
    }
    
    return created;
  };

  // Handler pour le modal A/B/Co
  const handleSemaineABCAction = async (action) => {
    if (!semaineABCTarget) return;
    
    setShowSemaineABCModal(false);
    toast.info('Application en cours...');
    
    try {
      let result = 0;
      
      if (action === 'A' || action === 'B') {
        if (semaineABCTarget.type === 'employe') {
          result = await applySemaineToEmploye(semaineABCTarget.employe, action);
        } else if (semaineABCTarget.type === 'section') {
          result = await applySemaineToSection(semaineABCTarget.section, action);
        }
        toast.success(`Semaine ${action} appliquée ! ${result} créneaux créés`);
      } else if (action === 'Co') {
        if (semaineABCTarget.type === 'employe') {
          result = await applyCongesSemaine(semaineABCTarget.employe);
          toast.success(`Congés appliqués ! ${result} jours de congés créés`);
        } else {
          toast.error('Les congés ne peuvent être appliqués qu\'à un employé individuel');
        }
      }
      
      // Rafraîchir les données
      fetchPlanningTableau();
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'application');
    }
  };

  // Mettre à jour la configuration semaine A/B d'un employé
  const updateEmployeSemaineConfig = async (employeId, field, value) => {
    try {
      await axios.put(`${API}/users/${employeId}`, { [field]: value });
      fetchData();
      toast.success('Configuration mise à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Vérifier si un employé a un créneau
  const getCreneauForEmploye = (employeId, date, creneau) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) return null;
    return planningTableau.planning[date].find(c => 
      c.employe_id === employeId && c.creneau === creneau
    );
  };

  // Compter les médecins présents pour un créneau
  const countMedecinsForCreneau = (date, creneau) => {
    if (!planningTableau.planning || !planningTableau.planning[date]) return 0;
    return planningTableau.planning[date].filter(c => 
      c.employe_role === 'Médecin' && c.creneau === creneau
    ).length;
  };

  // Approuver/Refuser une demande directement depuis le planning
  const handleApprouverDemandePlanning = async (employeId, date, creneau, approuver, creneauPartiel = null) => {
    try {
      // Trouver la demande correspondante
      const demande = demandesTravail.find(d => 
        d.medecin_id === employeId && 
        d.date_demandee === date && 
        (d.creneau === creneau || d.creneau === 'JOURNEE_COMPLETE') &&
        d.statut === 'EN_ATTENTE'
      );
      
      if (!demande) {
        toast.error('Demande introuvable');
        return;
      }
      
      // Préparer le body avec ou sans créneau partiel
      const body = {
        approuve: approuver,
        commentaire: ''
      };
      
      if (creneauPartiel) {
        body.creneau_partiel = creneauPartiel;
      }
      
      const response = await axios.put(`${API}/demandes-travail/${demande.id}/approuver`, body);
      
      // L'opération backend a réussi, afficher le message approprié
      if (approuver) {
        if (creneauPartiel) {
          const creneauRestant = creneauPartiel === 'MATIN' ? 'après-midi' : 'matin';
          const creneauApprouve = creneauPartiel === 'MATIN' ? 'Matin' : 'Après-midi';
          toast.success(`✅ ${creneauApprouve} approuvé. La demande reste en attente pour l'${creneauRestant}.`);
        } else {
          toast.success('✅ Demande approuvée ! Créneau(x) ajouté(s) au planning.');
        }
      } else {
        if (creneauPartiel) {
          const creneauRestant = creneauPartiel === 'MATIN' ? 'après-midi' : 'matin';
          const creneauRefuse = creneauPartiel === 'MATIN' ? 'Matin' : 'Après-midi';
          toast.warning(`${creneauRefuse} refusé. La demande reste en attente pour l'${creneauRestant}.`);
        } else {
          toast.error('Demande refusée');
        }
      }
      
      // Attendre un peu pour laisser le backend finaliser toutes les opérations
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Recharger le planning et les demandes (entourer d'un try/catch séparé pour ne pas masquer le succès)
      try {
        if (viewMode === 'jour') {
          await fetchPlanningByDate(selectedDate);
        } else {
          await fetchPlanningSemaine(selectedWeek);
        }
        await fetchData();
      } catch (reloadError) {
        console.error('Erreur rechargement données:', reloadError);
        // Ne pas afficher d'erreur à l'utilisateur car l'opération principale a réussi
        // L'utilisateur peut rafraîchir manuellement si besoin
      }
    } catch (error) {
      console.error('Erreur approbation/refus:', error);
      toast.error(error.response?.data?.detail || `Erreur lors de ${approuver ? 'l\'approbation' : 'le refus'}`);
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

  // Filtrer le planning selon les rôles sélectionnés et l'employé spécifique (multi-sélection)
  // Pour les non-directeurs sans vue_planning_complete, on affiche seulement leurs propres créneaux
  const filteredPlanning = filterRole.length === 0
    ? []
    : planning.filter(c => {
        // Pour les non-directeurs sans vue_planning_complete: filtrer uniquement leurs créneaux
        if (!hasDirectorView() && c.employe_id !== user?.id) return false;
        // Filtre par rôle
        if (!filterRole.includes(c.employe_role)) return false;
        // Filtre par employé spécifique (si sélectionné) - seulement pour directeurs
        if (hasDirectorView() && filterEmploye !== 'tous' && c.employe_id !== filterEmploye) return false;
        return true;
      });
  
  // Séparer les créneaux par période
  // Le backend crée déjà 2 créneaux séparés (MATIN + APRES_MIDI) pour JOURNEE_COMPLETE
  const planningMatin = filteredPlanning.filter(c => c.creneau === 'MATIN');
  const planningApresMidi = filteredPlanning.filter(c => c.creneau === 'APRES_MIDI');
  const planningJournee = filteredPlanning.filter(c => c.creneau === 'JOURNEE');

  // Créer des groupes par rôle pour l'affichage en colonnes
  const getRoleGroups = (planningData) => {
    const roles = filterRole.length > 0 ? filterRole : ['Médecin', 'Assistant', 'Secrétaire'];
    
    const groups = {};
    roles.forEach(role => {
      let creneaux = planningData.filter(c => c.employe_role === role);
      
      // Tri selon le rôle
      if (role === 'Médecin') {
        // Tri par salle_attribuee (Box 1, Box 2, etc.)
        creneaux.sort((a, b) => {
          const salleA = a.salle_attribuee || '';
          const salleB = b.salle_attribuee || '';
          
          // Extraire le numéro du box si format "Box X"
          const numA = salleA.match(/Box (\d+)/i)?.[1];
          const numB = salleB.match(/Box (\d+)/i)?.[1];
          
          if (numA && numB) {
            return parseInt(numA) - parseInt(numB);
          }
          
          // Sinon tri alphabétique par prénom
          const prenomA = a.employe?.prenom || '';
          const prenomB = b.employe?.prenom || '';
          return prenomA.localeCompare(prenomB, 'fr');
        });
      } else if (role === 'Assistant') {
        // Tri par salle_attente (A, O, C, D, Bleu) puis par prénom
        const ordreAttente = ['A', 'O', 'C', 'D', 'Bleu'];
        creneaux.sort((a, b) => {
          const attenteA = a.salle_attente || '';
          const attenteB = b.salle_attente || '';
          
          const indexA = ordreAttente.indexOf(attenteA);
          const indexB = ordreAttente.indexOf(attenteB);
          
          // Si les deux sont dans l'ordre défini
          if (indexA !== -1 && indexB !== -1 && indexA !== indexB) {
            return indexA - indexB;
          }
          
          // Sinon tri par prénom
          const prenomA = a.employe?.prenom || '';
          const prenomB = b.employe?.prenom || '';
          return prenomA.localeCompare(prenomB, 'fr');
        });
      } else if (role === 'Secrétaire') {
        // Tri alphabétique par prénom
        creneaux.sort((a, b) => {
          const prenomA = a.employe?.prenom || '';
          const prenomB = b.employe?.prenom || '';
          return prenomA.localeCompare(prenomB, 'fr');
        });
      }
      
      groups[role] = creneaux;
    });
    
    return {
      roles: roles,
      groups: groups
    };
  };

  // Vérifier si un employé est en congé à une date donnée
  const isEmployeEnConge = (employeId, date) => {
    if (!congesApprouves || congesApprouves.length === 0) return false;
    
    return congesApprouves.some(conge => {
      if (conge.utilisateur_id !== employeId) return false;
      
      const dateToCheck = new Date(date);
      const dateDebut = new Date(conge.date_debut);
      const dateFin = new Date(conge.date_fin);
      
      return dateToCheck >= dateDebut && dateToCheck <= dateFin;
    });
  };

  // Récupérer les assistants assignés à un médecin
  const getAssistantsForMedecin = (medecinId) => {
    if (!assignations || assignations.length === 0) return [];
    
    return assignations
      .filter(a => a.medecin_id === medecinId && a.actif)
      .map(a => a.assistant)
      .filter(a => a); // Filtrer les undefined
  };

  // Récupérer les assistants qui travaillent avec un médecin ce jour-là dans le planning
  const getAssistantsForMedecinInPlanning = (medecinId, date, creneau) => {
    // Récupérer les créneaux à partir de planning OU planningSemaine selon ce qui est disponible
    let allCreneaux = [];
    
    // D'abord essayer avec planning (vue jour)
    if (planning && planning.length > 0) {
      allCreneaux = planning;
    }
    // Sinon essayer avec planningSemaine
    else if (planningSemaine && planningSemaine.planning && planningSemaine.planning[date]) {
      const matinCreneaux = planningSemaine.planning[date]?.MATIN || [];
      const amCreneaux = planningSemaine.planning[date]?.APRES_MIDI || [];
      allCreneaux = [...matinCreneaux, ...amCreneaux];
    }
    
    if (allCreneaux.length === 0) return [];
    
    return allCreneaux
      .filter(p => 
        p.date === date && 
        p.creneau === creneau && 
        p.employe_role === 'Assistant' && 
        p.medecin_ids && 
        p.medecin_ids.includes(medecinId)
      )
      .map(p => p.employe)
      .filter(a => a); // Filtrer les undefined
  };

  // Récupérer les médecins avec leurs infos (box/salle) qui travaillent avec un assistant ce jour-là
  const getMedecinsForAssistantInPlanning = (assistantId, date, creneau) => {
    // Récupérer les créneaux à partir de planning OU planningSemaine selon ce qui est disponible
    let allCreneaux = [];
    
    // D'abord essayer avec planning (vue jour)
    if (planning && planning.length > 0) {
      allCreneaux = planning;
    }
    // Sinon essayer avec planningSemaine
    else if (planningSemaine && planningSemaine.planning && planningSemaine.planning[date]) {
      const matinCreneaux = planningSemaine.planning[date]?.MATIN || [];
      const amCreneaux = planningSemaine.planning[date]?.APRES_MIDI || [];
      allCreneaux = [...matinCreneaux, ...amCreneaux];
    }
    
    if (allCreneaux.length === 0) return [];
    
    // Trouver le créneau de l'assistant
    const assistantCreneau = allCreneaux.find(p => 
      p.employe_id === assistantId && 
      p.date === date && 
      p.creneau === creneau
    );
    
    if (!assistantCreneau || !assistantCreneau.medecin_ids || assistantCreneau.medecin_ids.length === 0) {
      return [];
    }
    
    // Récupérer les créneaux des médecins associés
    return allCreneaux
      .filter(p => 
        p.date === date && 
        p.creneau === creneau && 
        p.employe_role === 'Médecin' && 
        assistantCreneau.medecin_ids.includes(p.employe_id)
      )
      .map(p => ({
        medecin: p.employe,
        box: p.salle_attribuee,
        salleAttente: p.salle_attente
      }))
      .filter(m => m.medecin); // Filtrer les undefined
  };

  // Calculer le niveau de remplissage d'un créneau (0-100%)
  const getCreneauCompletionLevel = (creneau) => {
    if (!creneau) return 0;
    
    let totalFields = 0;
    let filledFields = 0;
    
    if (creneau.employe_role === 'Médecin') {
      // Pour un médecin : box, salle d'attente, assistants
      totalFields = 3;
      if (creneau.salle_attribuee) filledFields++;
      if (creneau.salle_attente) filledFields++;
      if (getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0) filledFields++;
    } else if (creneau.employe_role === 'Assistant') {
      // Pour un assistant : salle de travail, médecins associés
      totalFields = 2;
      if (creneau.salle_attribuee) filledFields++;
      if (getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0) filledFields++;
    } else if (creneau.employe_role === 'Secrétaire') {
      // Pour une secrétaire : salle, horaires
      totalFields = 2;
      if (creneau.salle_attribuee) filledFields++;
      if (creneau.horaire_debut && creneau.horaire_fin) filledFields++;
    }
    
    return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  };

  // Obtenir les classes CSS selon le niveau de remplissage avec transition
  const getCreneauBackgroundClasses = (creneau) => {
    const completion = getCreneauCompletionLevel(creneau);
    const role = creneau.employe_role;
    
    // Base : transition fluide
    let classes = 'transition-all duration-500 ease-in-out ';
    
    if (role === 'Médecin') {
      // Pour les médecins : 3 niveaux basés sur box, salle d'attente, assistant
      // 100% = tout rempli (box + salle attente + assistant)
      // 66% = 2 sur 3 remplis
      // 33% = 1 sur 3 rempli
      // 0% = rien
      if (completion >= 100) {
        classes += 'bg-blue-900 text-white border-blue-900';
      } else if (completion >= 66) {
        classes += 'bg-blue-700 text-white border-blue-700';
      } else if (completion >= 33) {
        classes += 'bg-blue-400 text-white border-blue-400';
      } else {
        classes += 'bg-blue-50 text-blue-900 border-blue-300';
      }
    } else if (role === 'Assistant') {
      // Pour les assistants : couleur basée sur le niveau de remplissage (0/2, 1/2, 2/2)
      const hasMedecin = getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0;
      const hasSalleTravail = creneau.salle_attribuee && creneau.salle_attribuee.trim() !== '';
      
      // Compter le niveau de remplissage
      const remplissage = (hasSalleTravail ? 1 : 0) + (hasMedecin ? 1 : 0);
      
      if (remplissage === 2) {
        // 2/2 : Salle ET Médecin → Vert foncé
        classes += 'bg-green-600 text-white border-green-700';
      } else if (remplissage === 1) {
        // 1/2 : Salle OU Médecin → Vert moyen
        classes += 'bg-green-400 text-white border-green-500';
      } else {
        // 0/2 : Juste présent → Vert clair
        classes += 'bg-green-100 text-green-900 border-green-300';
      }
    } else if (role === 'Secrétaire') {
      // Pour les secrétaires : garder la logique de complétion
      const completion = getCreneauCompletionLevel(creneau);
      if (completion >= 100) {
        classes += 'bg-yellow-600 text-white border-yellow-700';
      } else if (completion >= 50) {
        classes += 'bg-yellow-400 text-yellow-900 border-yellow-500';
      } else {
        classes += 'bg-yellow-100 text-yellow-900 border-yellow-300';
      }
    } else {
      classes += 'bg-gray-100 text-gray-900 border-gray-300';
    }
    
    return classes;
  };

  // Déterminer si le fond est foncé pour adapter la couleur des détails
  const isCreneauDarkBackground = (creneau) => {
    const completion = getCreneauCompletionLevel(creneau);
    const role = creneau.employe_role;
    
    if (role === 'Médecin') {
      // Fond foncé si 33% ou plus (blue-400 et plus foncé)
      return completion >= 33;
    } else if (role === 'Assistant') {
      // Fond foncé si assistant a des médecins associés
      return getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0;
    } else if (role === 'Secrétaire') {
      return completion >= 100; // Seulement jaune-600 est foncé
    }
    
    return false;
  };

  // Récupérer les médecins assignés à un assistant
  const getMedecinsForAssistant = (assistantId) => {
    if (!assignations || assignations.length === 0) return [];
    
    return assignations
      .filter(a => a.assistant_id === assistantId && a.actif)
      .map(a => a.medecin)
      .filter(m => m); // Filtrer les undefined
  };

  // Vérifier si un employé a une demande de travail en attente à une date donnée
  const hasDemandeEnAttente = (employeId, date, creneau) => {
    if (!demandesTravail || demandesTravail.length === 0) return false;
    
    return demandesTravail.some(demande => {
      if (demande.medecin_id !== employeId) return false;
      if (demande.statut !== 'EN_ATTENTE') return false;
      if (demande.date_demandee !== date) return false;
      
      // Vérifier le créneau
      if (demande.creneau === 'JOURNEE_COMPLETE') return true;
      if (demande.creneau === creneau) return true;
      
      return false;
    });
  };
  
  // Nouvelle fonction pour récupérer la demande complète
  const getDemandeEnAttente = (employeId, date, creneau) => {
    if (!demandesTravail || demandesTravail.length === 0) return null;
    
    return demandesTravail.find(demande => {
      if (demande.medecin_id !== employeId) return false;
      if (demande.statut !== 'EN_ATTENTE') return false;
      if (demande.date_demandee !== date) return false;
      
      // Vérifier le créneau
      if (demande.creneau === 'JOURNEE_COMPLETE') return true;
      if (demande.creneau === creneau) return true;
      
      return false;
    });
  };

  // Calculer les demi-journées pour un employé dans une période
  const calculateDemiJournees = (employeId, dates) => {
    if (!planningSemaine || !planningSemaine.planning) return 0;
    
    let total = 0;
    dates.forEach(date => {
      const planning = planningSemaine.planning[date];
      if (!planning) return;
      
      // Filtrer les créneaux qui ne sont PAS des repos
      const creneauxMatin = planning.MATIN?.filter(c => c.employe_id === employeId && !c.est_repos) || [];
      const creneauxApresMidi = planning.APRES_MIDI?.filter(c => c.employe_id === employeId && !c.est_repos) || [];
      
      // Chaque créneau (MATIN ou APRES_MIDI) = 1 demi-journée (sauf repos)
      if (creneauxMatin.length > 0) total += 1;
      if (creneauxApresMidi.length > 0) total += 1;
    });
    
    return total;
  };

  // Calculer les heures travaillées pour un secrétaire dans une période
  const calculateHeures = (employeId, dates) => {
    if (!planningSemaine || !planningSemaine.planning) return 0;
    
    let totalMinutes = 0;
    dates.forEach(date => {
      const planning = planningSemaine.planning[date];
      if (!planning) return;
      
      const creneaux = [...(planning.MATIN || []), ...(planning.APRES_MIDI || [])];
      // Exclure les repos du calcul
      const creneauxEmploye = creneaux.filter(c => c.employe_id === employeId && !c.est_repos);
      
      creneauxEmploye.forEach(creneau => {
        if (creneau.horaire_debut && creneau.horaire_fin) {
          // Parser les heures
          const [debutH, debutM] = creneau.horaire_debut.split(':').map(Number);
          const [finH, finM] = creneau.horaire_fin.split(':').map(Number);
          
          let minutes = (finH * 60 + finM) - (debutH * 60 + debutM);
          
          // Soustraire la pause si présente
          if (creneau.horaire_pause_debut && creneau.horaire_pause_fin) {
            const [pauseDebutH, pauseDebutM] = creneau.horaire_pause_debut.split(':').map(Number);
            const [pauseFinH, pauseFinM] = creneau.horaire_pause_fin.split(':').map(Number);
            const pauseMinutes = (pauseFinH * 60 + pauseFinM) - (pauseDebutH * 60 + pauseDebutM);
            minutes -= pauseMinutes;
          }
          
          totalMinutes += minutes;
        }
      });
    });
    
    return (totalMinutes / 60).toFixed(1); // Convertir en heures avec 1 décimale
  };

  // Calculer le nombre de jours de congés pour un employé dans une période
  const calculateConges = (employeId, dates) => {
    if (!congesApprouves || congesApprouves.length === 0) return 0;
    
    let joursConges = 0;
    dates.forEach(date => {
      if (isEmployeEnConge(employeId, date)) {
        joursConges += 1;
      }
    });
    
    return joursConges;
  };

  // Calculer uniquement les congés COMPTABILISÉS (uniquement CONGE_PAYE)
  // CONGE_SANS_SOLDE et MALADIE comptent en heures mais PAS dans la colonne "Congés"
  const calculateCongesComptabilises = (employeId, dates) => {
    if (!congesApprouves || congesApprouves.length === 0) return 0;
    
    let demiJourneesConges = 0;
    
    dates.forEach(date => {
      // Chercher uniquement les CONGE_PAYE approuvés pour cet employé à cette date
      const congesJour = congesApprouves.filter(c => 
        c.utilisateur_id === employeId && 
        c.date_debut <= date && 
        c.date_fin >= date &&
        c.type_conge === 'CONGE_PAYE'  // Seul CONGE_PAYE compte comme congé
      );
      
      congesJour.forEach(conge => {
        // Si c'est une demi-journée, compter 1, sinon compter 2
        demiJourneesConges += conge.demi_journee ? 1 : 2;
      });
    });
    
    return demiJourneesConges;
  };

  return (
    <div className="space-y-6" data-testid="planning-manager">
      {/* Header moderne avec gradient - Composant extrait */}
      <PlanningHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        hasDirectorView={hasDirectorView()}
        selectedDate={selectedDate}
        selectedWeek={selectedWeek}
        setSelectedDate={setSelectedDate}
        setSelectedWeek={setSelectedWeek}
        setSelectedMonth={setSelectedMonth}
      />
      
      {/* Ligne 1 : Filtres par rôle */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex space-x-2">
          {/* Espace vide car les boutons de vue ont été déplacés */}
        </div>
        
        {/* Filtre par rôle - Sélection multiple pour le directeur ou vue planning complète */}
        {hasDirectorView() && viewMode !== 'planning' && (
          <>
            <div className="border-l pl-4 flex items-center space-x-2">
              <span className="text-sm font-medium">Filtres :</span>
              <Button
                variant={filterRole.length === 3 ? 'default' : 'outline'}
                size="sm"
                onClick={selectAllRoles}
              >
                Tous
              </Button>
              <Button
                variant={filterRole.includes('Médecin') ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRoleToggle('Médecin')}
              >
                {filterRole.includes('Médecin') ? '✓ ' : ''}Médecins
              </Button>
              <Button
                variant={filterRole.includes('Assistant') ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRoleToggle('Assistant')}
              >
                {filterRole.includes('Assistant') ? '✓ ' : ''}Assistants
              </Button>
              <Button
                variant={filterRole.includes('Secrétaire') ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRoleToggle('Secrétaire')}
              >
                {filterRole.includes('Secrétaire') ? '✓ ' : ''}Secrétaires
              </Button>
            </div>
            <div className="border-l pl-4">
              <Button
                variant={showDetails ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? '👁️ Masquer détails' : '👁️ Afficher détails'}
              </Button>
            </div>
          </>
        )}
      </div>
      
      {/* Ligne 2 : Filtre employé + Navigation + Actions */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* Filtre par employé spécifique (Directeur ou vue planning complète) */}
        {hasDirectorView() && viewMode !== 'mois' && (
          <div className="flex items-center space-x-2">
            <Label className="text-sm whitespace-nowrap">Employé:</Label>
            <Select value={filterEmploye} onValueChange={(val) => { setFilterEmploye(val); setSearchEmploye(''); }}>
              <SelectTrigger className="w-[280px] h-8">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 border-b">
                  <Input
                    placeholder="🔍 Rechercher un employé..."
                    value={searchEmploye}
                    onChange={(e) => setSearchEmploye(e.target.value)}
                    className="h-8"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <SelectItem value="tous">👥 Tous les employés</SelectItem>
                {sortEmployeesByRoleThenName(
                  filterEmployeesBySearch(
                    users.filter(u => u.actif && u.role !== 'Directeur'),
                    searchEmploye
                  )
                ).map(emp => {
                  let demiJournees = 0;
                  if (viewMode === 'jour') {
                    const creneauxJour = planning.filter(p => p.employe_id === emp.id);
                    demiJournees = creneauxJour.length;
                  } else if (viewMode === 'semaine' && planningSemaine?.planning) {
                    planningSemaine.dates?.forEach(date => {
                      const matin = (planningSemaine.planning[date]?.MATIN || []).filter(c => c.employe_id === emp.id);
                      const apresMidi = (planningSemaine.planning[date]?.APRES_MIDI || []).filter(c => c.employe_id === emp.id);
                      if (matin.length > 0) demiJournees += 1;
                      if (apresMidi.length > 0) demiJournees += 1;
                    });
                  }
                  const jours = demiJournees / 2;
                  const joursStr = jours % 1 === 0 ? jours.toString() : jours.toFixed(1).replace('.', ',');
                  
                  return (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.role === 'Médecin' ? '👨‍⚕️' : emp.role === 'Assistant' ? '👥' : '📋'} {emp.prenom} {emp.nom} ({joursStr} {jours <= 1 ? 'jour' : 'jours'})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Navigation et sélecteur de date */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (viewMode === 'jour') {
                const currentDate = new Date(selectedDate);
                currentDate.setDate(currentDate.getDate() - 1);
                setSelectedDate(currentDate.toISOString().split('T')[0]);
              } else if (viewMode === 'semaine') {
                navigateWeek('prev');
              } else if (viewMode === 'mois') {
                navigateMonth('prev');
              }
            }}
            className="px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {viewMode === 'mois' ? (
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-auto"
            />
          ) : (
            <Input
              type="date"
              value={(viewMode === 'semaine' || viewMode === 'planning') ? selectedWeek : selectedDate}
              onChange={(e) => (viewMode === 'semaine' || viewMode === 'planning') ? setSelectedWeek(e.target.value) : setSelectedDate(e.target.value)}
              className="w-auto"
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (viewMode === 'jour') {
                const currentDate = new Date(selectedDate);
                currentDate.setDate(currentDate.getDate() + 1);
                setSelectedDate(currentDate.toISOString().split('T')[0]);
              } else if (viewMode === 'semaine') {
                navigateWeek('next');
              } else if (viewMode === 'mois') {
                navigateMonth('next');
              }
            }}
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
        
        {/* Actions du directeur - Modification du planning */}
        {canModifyPlanning() && (
          <div className="flex items-center space-x-2 border-l pl-4">
            <Button
              onClick={generateNotifications}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>Notifications</span>
            </Button>
            
            <Button
              onClick={() => setShowSemaineTypeModal(true)}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Calendar className="h-4 w-4" />
              <span>Semaine Type</span>
            </Button>
            
            <Button 
              onClick={openPlanningHebdoModal}
              size="sm"
              className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700"
            >
              <Calendar className="h-4 w-4" />
              <span>Planning Hebdo</span>
            </Button>
            
            <Dialog open={showPlanningModal} onOpenChange={setShowPlanningModal}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Nouveau Créneau</span>
                </Button>
              </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nouveau Créneau Planning</DialogTitle>
                    <DialogDescription>
                      Définissez un nouveau créneau de travail pour le personnel.
                      <br />
                      <span className="text-blue-600 font-medium">ℹ️ Les médecins peuvent aussi faire leurs demandes via l'onglet "Demandes de Créneaux"</span>
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
                          onValueChange={(value) => {
                            const employe = users.find(u => u.id === newCreneau.employe_id);
                            let horaires = { 
                              horaire_debut: newCreneau.horaire_debut, 
                              horaire_fin: newCreneau.horaire_fin,
                              horaire_pause_debut: '',
                              horaire_pause_fin: ''
                            };
                            
                            // Ajuster automatiquement les horaires pour les secrétaires
                            if (employe?.role === 'Secrétaire') {
                              if (value === 'MATIN') {
                                horaires = { horaire_debut: '08:00', horaire_fin: '12:00', horaire_pause_debut: '', horaire_pause_fin: '' };
                              } else if (value === 'APRES_MIDI') {
                                horaires = { horaire_debut: '14:00', horaire_fin: '18:00', horaire_pause_debut: '', horaire_pause_fin: '' };
                              } else if (value === 'JOURNEE_COMPLETE') {
                                horaires = { horaire_debut: '08:00', horaire_fin: '18:00', horaire_pause_debut: '12:00', horaire_pause_fin: '14:00' };
                              }
                            }
                            
                            setNewCreneau({...newCreneau, creneau: value, ...horaires});
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MATIN">Matin</SelectItem>
                            <SelectItem value="APRES_MIDI">Après-midi</SelectItem>
                            <SelectItem value="JOURNEE_COMPLETE">Journée complète</SelectItem>
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
                          let horaires = { horaire_debut: '', horaire_fin: '' };
                          
                          // Ajuster automatiquement les horaires pour les secrétaires selon le créneau
                          if (employe?.role === 'Secrétaire') {
                            if (newCreneau.creneau === 'MATIN') {
                              horaires = { horaire_debut: '08:00', horaire_fin: '12:00', horaire_pause_debut: '', horaire_pause_fin: '' };
                            } else if (newCreneau.creneau === 'APRES_MIDI') {
                              horaires = { horaire_debut: '14:00', horaire_fin: '18:00', horaire_pause_debut: '', horaire_pause_fin: '' };
                            } else {
                              horaires = { horaire_debut: '08:00', horaire_fin: '18:00', horaire_pause_debut: '12:00', horaire_pause_fin: '14:00' };
                            }
                          }
                          
                          setNewCreneau({
                            ...newCreneau, 
                            employe_id: value,
                            // Reset fields when changing employee
                            medecin_attribue_id: '',
                            medecin_ids: [],
                            salle_attribuee: '',
                            salle_attente: '',
                            ...horaires
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un employé" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2 border-b">
                            <Input
                              placeholder="🔍 Rechercher..."
                              className="h-8"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                // Filtrage local via data attribute
                                const term = e.target.value.toLowerCase();
                                const items = e.target.closest('.select-content')?.querySelectorAll('[data-employee-name]');
                                items?.forEach(item => {
                                  const name = item.getAttribute('data-employee-name');
                                  item.style.display = name?.includes(term) ? '' : 'none';
                                });
                              }}
                            />
                          </div>
                          {sortEmployeesByRoleThenName(users.filter(u => u.actif && u.role !== 'Directeur')).map(employe => (
                            <SelectItem 
                              key={employe.id} 
                              value={employe.id}
                              data-employee-name={`${employe.prenom} ${employe.nom}`.toLowerCase()}
                            >
                              {employe.role === 'Médecin' ? '👨‍⚕️' : employe.role === 'Assistant' ? '👥' : '📋'} {employe.prenom} {employe.nom}
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
                      <>
                        {newCreneau.creneau === 'JOURNEE_COMPLETE' ? (
                          /* Disposition pour journée complète */
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Heure de début</Label>
                                <Input
                                  type="time"
                                  value={newCreneau.horaire_debut}
                                  onChange={(e) => setNewCreneau({...newCreneau, horaire_debut: e.target.value})}
                                  placeholder="08:00"
                                />
                                <p className="text-xs text-gray-500">Ex: 08:00</p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Fin du matin (début pause)</Label>
                                <Input
                                  type="time"
                                  value={newCreneau.horaire_pause_debut}
                                  onChange={(e) => setNewCreneau({...newCreneau, horaire_pause_debut: e.target.value})}
                                  placeholder="12:00"
                                />
                                <p className="text-xs text-gray-500">Ex: 12:00</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Reprise après-midi (fin pause)</Label>
                                <Input
                                  type="time"
                                  value={newCreneau.horaire_pause_fin}
                                  onChange={(e) => setNewCreneau({...newCreneau, horaire_pause_fin: e.target.value})}
                                  placeholder="14:00"
                                />
                                <p className="text-xs text-gray-500">Ex: 14:00</p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Fin de journée</Label>
                                <Input
                                  type="time"
                                  value={newCreneau.horaire_fin}
                                  onChange={(e) => setNewCreneau({...newCreneau, horaire_fin: e.target.value})}
                                  placeholder="18:00"
                                />
                                <p className="text-xs text-gray-500">Ex: 18:00</p>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* Disposition pour matin ou après-midi uniquement */
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
                      </>
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
        </div>

      {/* Modal de modification de créneau */}
      {canModifyPlanning() && editingCreneau && (
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
                <>
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

                  <div className="space-y-2">
                    <Label>Assistants attribués</Label>
                    <div className="border rounded p-3 space-y-2 max-h-40 overflow-y-auto">
                      {assistants.map(assistant => (
                        <div key={assistant.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={newCreneau.medecin_ids.includes(assistant.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCreneau({...newCreneau, medecin_ids: [...newCreneau.medecin_ids, assistant.id]});
                              } else {
                                setNewCreneau({...newCreneau, medecin_ids: newCreneau.medecin_ids.filter(id => id !== assistant.id)});
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <label>{assistant.prenom} {assistant.nom}</label>
                        </div>
                      ))}
                      {assistants.length === 0 && (
                        <p className="text-sm text-gray-500">Aucun assistant disponible</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Pour créer automatiquement un créneau pour l'assistant, cochez son nom. Le système créera son créneau avec les mêmes horaires.
                    </p>
                  </div>
                </>
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
      {canModifyPlanning() && (
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
      {canModifyPlanning() && (
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateSemaineTypeModal(true)}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une Nouvelle Semaine Type
                </Button>
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

                      // Trouver l'employé pour vérifier son rôle
                      const employe = users.find(u => u.id === newCreneau.employe_id);
                      
                      for (let i = 0; i < jours.length; i++) {
                        const creneau = semaine[jours[i]];
                        if (creneau && creneau !== 'REPOS') {
                          const dateJour = new Date(dateDebut);
                          dateJour.setDate(dateDebut.getDate() + i);
                          const dateStr = dateJour.toISOString().split('T')[0];

                          // Utiliser les horaires de la semaine type si l'employé est secrétaire
                          const creneauData = {
                            date: dateStr,
                            creneau: creneau,
                            employe_id: newCreneau.employe_id,
                            salle_attribuee: '',
                            salle_attente: '',
                            notes: `Semaine type: ${semaine.nom}`,
                            medecin_ids: []
                          };
                          
                          // Ajouter les horaires pour les secrétaires
                          if (employe?.role === 'Secrétaire') {
                            creneauData.horaire_debut = semaine.horaire_debut || '';
                            creneauData.horaire_fin = semaine.horaire_fin || '';
                            if (creneau === 'JOURNEE_COMPLETE') {
                              creneauData.horaire_pause_debut = semaine.horaire_pause_debut || '';
                              creneauData.horaire_pause_fin = semaine.horaire_pause_fin || '';
                            }
                          } else {
                            creneauData.horaire_debut = '';
                            creneauData.horaire_fin = '';
                          }

                          await axios.post(`${API}/planning`, creneauData);
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

      {/* Modal Créer Nouvelle Semaine Type */}
      {canModifyPlanning() && (
        <Dialog open={showCreateSemaineTypeModal} onOpenChange={setShowCreateSemaineTypeModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une Nouvelle Semaine Type</DialogTitle>
              <DialogDescription>
                Définissez un modèle de semaine réutilisable pour vos employés
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              
              if (!newSemaineType.nom) {
                toast.error('Le nom de la semaine type est requis');
                return;
              }

              try {
                await axios.post(`${API}/semaines-types`, newSemaineType);
                toast.success('Semaine type créée avec succès');
                setShowCreateSemaineTypeModal(false);
                setNewSemaineType({
                  nom: '',
                  description: '',
                  lundi: 'REPOS',
                  mardi: 'REPOS',
                  mercredi: 'REPOS',
                  jeudi: 'REPOS',
                  vendredi: 'REPOS',
                  samedi: 'REPOS',
                  dimanche: 'REPOS',
                  horaire_debut: '08:00',
                  horaire_fin: '18:00',
                  horaire_pause_debut: '12:00',
                  horaire_pause_fin: '14:00'
                });
                // Recharger les semaines types
                const response = await axios.get(`${API}/semaines-types`);
                setSemainesTypes(response.data);
              } catch (error) {
                toast.error(error.response?.data?.detail || 'Erreur lors de la création');
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nom-planning">Nom de la semaine type *</Label>
                  <Input
                    id="nom-planning"
                    value={newSemaineType.nom}
                    onChange={(e) => setNewSemaineType({...newSemaineType, nom: e.target.value})}
                    placeholder="Ex: Semaine Standard Secrétaire"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description-planning">Description</Label>
                  <Input
                    id="description-planning"
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
              
              <div className="space-y-3">
                <Label className="text-base font-medium">Horaires types (pour Secrétaires)</Label>
                <p className="text-sm text-gray-500">Ces horaires seront appliqués automatiquement aux secrétaires</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Heure de début</Label>
                    <Input
                      type="time"
                      value={newSemaineType.horaire_debut}
                      onChange={(e) => setNewSemaineType({...newSemaineType, horaire_debut: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Fin du matin (début pause)</Label>
                    <Input
                      type="time"
                      value={newSemaineType.horaire_pause_debut}
                      onChange={(e) => setNewSemaineType({...newSemaineType, horaire_pause_debut: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reprise après-midi (fin pause)</Label>
                    <Input
                      type="time"
                      value={newSemaineType.horaire_pause_fin}
                      onChange={(e) => setNewSemaineType({...newSemaineType, horaire_pause_fin: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Fin de journée</Label>
                    <Input
                      type="time"
                      value={newSemaineType.horaire_fin}
                      onChange={(e) => setNewSemaineType({...newSemaineType, horaire_fin: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateSemaineTypeModal(false);
                    setNewSemaineType({
                      nom: '',
                      description: '',
                      lundi: 'REPOS',
                      mardi: 'REPOS',
                      mercredi: 'REPOS',
                      jeudi: 'REPOS',
                      vendredi: 'REPOS',
                      samedi: 'REPOS',
                      dimanche: 'REPOS',
                      horaire_debut: '08:00',
                      horaire_fin: '18:00',
                      horaire_pause_debut: '12:00',
                      horaire_pause_fin: '14:00'
                    });
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Créer la Semaine Type
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}


      {/* Modal Annulation Créneau depuis Planning */}
      <Dialog open={showAnnulationCreneauModal} onOpenChange={setShowAnnulationCreneauModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🗑️ Annuler le créneau</DialogTitle>
            <DialogDescription>
              {creneauToCancel && (
                <>
                  Annulation du créneau de <strong>{creneauToCancel.employe?.prenom} {creneauToCancel.employe?.nom}</strong>
                  <br />
                  {creneauToCancel.date} - {creneauToCancel.creneau === 'MATIN' ? 'Matin' : 'Après-midi'}
                  <br />
                  <span className="text-orange-600 text-sm mt-2 block">
                    ⚠️ Ce créneau provient d'une demande de travail approuvée. Le médecin sera notifié de l'annulation.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitAnnulationCreneau} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="raison-annulation-creneau">Raison de l'annulation *</Label>
              <Textarea
                id="raison-annulation-creneau"
                value={raisonAnnulationCreneau}
                onChange={(e) => setRaisonAnnulationCreneau(e.target.value)}
                placeholder="Ex: Réorganisation interne, urgence, fermeture exceptionnelle..."
                rows={4}
                required
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAnnulationCreneauModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                Confirmer l'annulation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Planning Hebdo (Création directe de créneaux) */}
      <Dialog open={showPlanningHebdoModal} onOpenChange={setShowPlanningHebdoModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>📅 Planning Hebdomadaire</span>
            </DialogTitle>
            <DialogDescription>
              Créez directement des créneaux de planning pour une semaine. Cliquez sur les jours pour sélectionner Matin, Après-midi ou Journée complète.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitPlanningHebdo} className="space-y-6">
            {/* Sélection employé */}
            <div className="space-y-2">
              <Label>Employé *</Label>
              <Select
                value={planningHebdo.employe_id}
                onValueChange={(value) => setPlanningHebdo(prev => ({ ...prev, employe_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b">
                    <Input
                      placeholder="🔍 Rechercher..."
                      className="h-8"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {sortEmployeesByRoleThenName(users.filter(u => u.actif && u.role !== 'Directeur')).map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.role === 'Médecin' ? '👨‍⚕️' : emp.role === 'Assistant' ? '👥' : '📋'} {emp.prenom} {emp.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Sélection de la semaine */}
            <div className="space-y-2">
              <Label>Semaine du *</Label>
              <Input
                type="date"
                value={planningHebdo.date_debut}
                onChange={(e) => handleDateHebdoPlanningChange(e.target.value)}
              />
            </div>

            {/* Grille des jours de la semaine */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Jours de la semaine</Label>
                <div className="text-sm text-gray-600">
                  {joursHebdoPlanning.filter(j => j.selectionne).length} jour(s) sélectionné(s)
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-7 gap-2">
                  {joursHebdoPlanning.map(jour => {
                    const resume = planningHebdoResume[jour.date] || { medecinsMatin: 0, medecinsAM: 0, assistantsMatin: 0, assistantsAM: 0 };
                    return (
                      <div 
                        key={jour.date}
                        className={`
                          p-2 rounded border cursor-pointer text-center text-sm transition-colors
                          ${jour.creneau === 'MATIN' 
                            ? 'bg-orange-100 border-orange-500 text-orange-800' 
                            : jour.creneau === 'APRES_MIDI'
                            ? 'bg-purple-100 border-purple-500 text-purple-800'
                            : jour.creneau === 'JOURNEE_COMPLETE'
                            ? 'bg-green-100 border-green-500 text-green-800'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                        `}
                        onClick={() => toggleJourHebdoPlanning(jour.date)}
                      >
                        <div className="font-bold capitalize">{jour.jourNom.substring(0, 3)}</div>
                        <div className="text-xs">{new Date(jour.date + 'T12:00:00').getDate()}/{new Date(jour.date + 'T12:00:00').getMonth() + 1}</div>
                        <div className="text-xs mt-1 font-semibold">
                          {jour.creneau === 'JOURNEE_COMPLETE' ? '🌞 Journée' :
                           jour.creneau === 'MATIN' ? '🌅 Matin' :
                           jour.creneau === 'APRES_MIDI' ? '🌆 AM' :
                           '⭕'}
                        </div>
                        {/* Résumé des présences */}
                        <div className="mt-2 pt-2 border-t border-gray-200 text-[10px]">
                          <div className="text-blue-600">👨‍⚕️ M:{resume.medecinsMatin} | AM:{resume.medecinsAM}</div>
                          <div className="text-green-600">👥 M:{resume.assistantsMatin} | AM:{resume.assistantsAM}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                💡 1 clic = 🌅 Matin | 2 clics = 🌆 Après-midi | 3 clics = 🌞 Journée | 4 clics = ⭕ Désactivé
              </p>
              <p className="text-xs text-blue-600 mt-1">
                📊 M = Matin | AM = Après-midi | 👨‍⚕️ Médecins présents | 👥 Assistants présents
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowPlanningHebdoModal(false)}>
                Annuler
              </Button>
              <Button 
                type="submit"
                disabled={joursHebdoPlanning.filter(j => j.selectionne).length === 0 || !planningHebdo.employe_id}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Créer {joursHebdoPlanning.filter(j => j.selectionne).length} créneau(x)
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

        {/* Vue Jour - Planning Matin */}
        {viewMode === 'jour' && (
        <>
        {/* Rappel de la date */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-6 py-4 shadow-lg mb-4">
          <div className="flex items-center justify-center space-x-3">
            <Calendar className="h-6 w-6" />
            <h3 className="text-2xl font-bold">
              {new Date(selectedDate).toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              }).replace(/^\w/, c => c.toUpperCase())}
            </h3>
          </div>
        </div>
        
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
            {planningMatin.length === 0 && !(hasDirectorView() && users.some(u => u.role === 'Médecin' && hasDemandeEnAttente(u.id, selectedDate, 'MATIN'))) ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarDays className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Aucun créneau programmé le matin</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`grid ${getRoleGroups(planningMatin).roles.length === 1 ? 'grid-cols-1' : getRoleGroups(planningMatin).roles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-4`}>
                  {getRoleGroups(planningMatin).roles.map(role => (
                    <div key={role} className="space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">
                        {role}s ({getRoleGroups(planningMatin).groups[role]?.length || 0})
                      </h3>
                      {getRoleGroups(planningMatin).groups[role]?.map(creneau => {
                        const hasAssistant = creneau.employe?.role === 'Médecin' && getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0;
                        const hasMedecin = creneau.employe?.role === 'Assistant' && getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0;
                        const isDark = isCreneauDarkBackground(creneau);
                        
                        return (
                        <div
                          key={creneau.id}
                          className={`border rounded-lg p-3 ${getCreneauBackgroundClasses(creneau)}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="font-medium">
                                {creneau.employe?.prenom} {creneau.employe?.nom}
                              </div>
                              
                              {/* MÉDECINS : Afficher Box, Salle d'attente, Assistants */}
                              {(showDetails || user?.role !== 'Directeur') && creneau.employe?.role === 'Médecin' && (
                                <>
                                  {creneau.salle_attribuee && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      🏥 Box: {creneau.salle_attribuee}
                                    </div>
                                  )}
                                  {creneau.salle_attente && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      ⏳ Salle d'attente: {creneau.salle_attente}
                                    </div>
                                  )}
                                  {getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0 && (
                                    <div className={`text-sm ${isDark ? 'text-white font-semibold' : 'text-blue-600'}`}>
                                      👥 Assistants: {getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau).map(a => `${a.prenom} ${a.nom}`).join(', ')}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* ASSISTANTS : Afficher sa salle de travail et médecins associés */}
                              {(showDetails || user?.role !== 'Directeur') && creneau.employe?.role === 'Assistant' && (
                                <>
                                  {creneau.salle_attribuee && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      🏥 Salle de travail: {creneau.salle_attribuee}
                                    </div>
                                  )}
                                  {getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0 && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-blue-600'}`}>
                                      {getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).map(info => (
                                        <div key={info.medecin.id} className="mt-1">
                                          👨‍⚕️ Associé à Dr. {info.medecin.prenom} {info.medecin.nom}
                                          {info.box && ` - BOXE ${info.box}`}
                                          {info.salleAttente && ` (Salle d'attente: ${info.salleAttente})`}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* SECRÉTAIRES : Affichage avec horaires */}
                              {creneau.employe?.role === 'Secrétaire' && (
                                <>
                                  {creneau.salle_attribuee && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      📍 {creneau.salle_attribuee}
                                    </div>
                                  )}
                                  {(creneau.horaire_debut || creneau.horaire_fin) && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      {creneau.horaire_pause_debut && creneau.horaire_pause_fin ? (
                                        // Affichage avec pause (journée complète)
                                        <>🕐 {creneau.horaire_debut || '?'} - {creneau.horaire_pause_debut} / {creneau.horaire_pause_fin} - {creneau.horaire_fin || '?'}</>
                                      ) : (
                                        // Affichage simple (matin ou après-midi)
                                        <>🕐 {creneau.horaire_debut || '?'} - {creneau.horaire_fin || '?'}</>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* Notes : Afficher seulement si ce n'est pas un assistant avec médecins associés (pour éviter doublon) */}
                              {creneau.notes && !(creneau.employe?.role === 'Assistant' && getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0) && (
                                <div className={`text-xs italic truncate ${isDark ? 'text-white opacity-80' : 'text-gray-600'}`}>
                                  📝 {creneau.notes}
                                </div>
                              )}
                            </div>
                            
                            {canModifyPlanning() && (
                              <div className="flex flex-col space-y-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditCreneau(creneau)}
                                  className={`h-7 w-7 p-0 ${hasAssistant || hasMedecin ? 'text-white hover:bg-white hover:bg-opacity-20' : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'}`}
                                  title="Modifier"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDuplicateCreneau(creneau)}
                                  className={`h-7 w-7 p-0 ${hasAssistant || hasMedecin ? 'text-white hover:bg-white hover:bg-opacity-20' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`}
                                  title="Dupliquer vers Après-midi"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAnnulerCreneau(creneau)}
                                  className={`h-7 w-7 p-0 ${hasAssistant || hasMedecin ? 'text-white hover:bg-white hover:bg-opacity-20' : 'text-red-600 hover:text-red-800 hover:bg-red-50'}`}
                                  title="Annuler"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* Afficher les demandes en attente APRÈS la grille (Vue directeur) */}
                {hasDirectorView() && users.filter(u => 
                  u.role === 'Médecin' && hasDemandeEnAttente(u.id, selectedDate, 'MATIN')
                ).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">
                      Demandes en attente - Matin
                    </h3>
                    {users.filter(u => 
                      u.role === 'Médecin' && hasDemandeEnAttente(u.id, selectedDate, 'MATIN')
                    ).map(employe => {
                      const demande = getDemandeEnAttente(employe.id, selectedDate, 'MATIN');
                      const isJourneeComplete = demande?.creneau === 'JOURNEE_COMPLETE';
                      
                      return (
                      <div
                        key={`demande-jour-matin-${employe.id}`}
                        className="border-2 border-yellow-500 bg-yellow-50 text-yellow-700 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">
                              {employe.prenom} {employe.nom}
                            </div>
                            <div className="text-sm font-semibold mt-1">
                              ⏳ Demande en attente {isJourneeComplete && '(Journée complète)'}
                            </div>
                          </div>
                          {canModifyPlanning() && (
                          <div className="flex space-x-1">
                            {isJourneeComplete && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprouverDemandePlanning(employe.id, selectedDate, 'MATIN', true, null)}
                                className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                                title="Approuver la journée complète"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approuver Journée
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprouverDemandePlanning(employe.id, selectedDate, 'MATIN', true, isJourneeComplete ? 'MATIN' : null)}
                              className="text-green-600 hover:text-green-800 hover:bg-green-50 h-8 px-3"
                              title={isJourneeComplete ? "Approuver Matin uniquement" : "Approuver"}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              {isJourneeComplete ? 'Matin' : 'Approuver'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprouverDemandePlanning(employe.id, selectedDate, 'MATIN', false, isJourneeComplete ? 'MATIN' : null)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 px-3"
                              title={isJourneeComplete ? "Refuser Matin uniquement" : "Refuser"}
                            >
                              <X className="h-4 w-4 mr-1" />
                              {isJourneeComplete ? 'Refuser Matin' : 'Refuser'}
                            </Button>
                          </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vue Jour - Planning Après-midi */}
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
            {planningApresMidi.length === 0 && !(hasDirectorView() && users.some(u => u.role === 'Médecin' && hasDemandeEnAttente(u.id, selectedDate, 'APRES_MIDI'))) ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarDays className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Aucun créneau programmé l'après-midi</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`grid ${getRoleGroups(planningApresMidi).roles.length === 1 ? 'grid-cols-1' : getRoleGroups(planningApresMidi).roles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-4`}>
                  {getRoleGroups(planningApresMidi).roles.map(role => (
                    <div key={role} className="space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">
                        {role}s ({getRoleGroups(planningApresMidi).groups[role]?.length || 0})
                      </h3>
                      {getRoleGroups(planningApresMidi).groups[role]?.map(creneau => {
                        const hasAssistant = creneau.employe?.role === 'Médecin' && getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0;
                        const hasMedecin = creneau.employe?.role === 'Assistant' && getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0;
                        const isDark = isCreneauDarkBackground(creneau);
                        
                        return (
                        <div
                          key={creneau.id}
                          className={`border rounded-lg p-3 ${getCreneauBackgroundClasses(creneau)}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="font-medium">
                                {creneau.employe?.prenom} {creneau.employe?.nom}
                              </div>
                              
                              {/* MÉDECINS : Afficher Box, Salle d'attente, Assistants */}
                              {(showDetails || user?.role !== 'Directeur') && creneau.employe?.role === 'Médecin' && (
                                <>
                                  {creneau.salle_attribuee && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      🏥 Box: {creneau.salle_attribuee}
                                    </div>
                                  )}
                                  {creneau.salle_attente && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      ⏳ Salle d'attente: {creneau.salle_attente}
                                    </div>
                                  )}
                                  {getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0 && (
                                    <div className={`text-sm ${isDark ? 'text-white font-semibold' : 'text-blue-600'}`}>
                                      👥 Assistants: {getAssistantsForMedecinInPlanning(creneau.employe_id, creneau.date, creneau.creneau).map(a => `${a.prenom} ${a.nom}`).join(', ')}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* ASSISTANTS : Afficher sa salle de travail et médecins associés */}
                              {(showDetails || user?.role !== 'Directeur') && creneau.employe?.role === 'Assistant' && (
                                <>
                                  {creneau.salle_attribuee && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      🏥 Salle de travail: {creneau.salle_attribuee}
                                    </div>
                                  )}
                                  {getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0 && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-blue-600'}`}>
                                      {getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).map(info => (
                                        <div key={info.medecin.id} className="mt-1">
                                          👨‍⚕️ Associé à Dr. {info.medecin.prenom} {info.medecin.nom}
                                          {info.box && ` - BOXE ${info.box}`}
                                          {info.salleAttente && ` (Salle d'attente: ${info.salleAttente})`}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* SECRÉTAIRES : Affichage avec horaires */}
                              {creneau.employe?.role === 'Secrétaire' && (
                                <>
                                  {creneau.salle_attribuee && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      📍 {creneau.salle_attribuee}
                                    </div>
                                  )}
                                  {(creneau.horaire_debut || creneau.horaire_fin) && (
                                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-600'}`}>
                                      {creneau.horaire_pause_debut && creneau.horaire_pause_fin ? (
                                        // Affichage avec pause (journée complète)
                                        <>🕐 {creneau.horaire_debut || '?'} - {creneau.horaire_pause_debut} / {creneau.horaire_pause_fin} - {creneau.horaire_fin || '?'}</>
                                      ) : (
                                        // Affichage simple (matin ou après-midi)
                                        <>🕐 {creneau.horaire_debut || '?'} - {creneau.horaire_fin || '?'}</>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* Notes : Afficher seulement si ce n'est pas un assistant avec médecins associés (pour éviter doublon) */}
                              {creneau.notes && !(creneau.employe?.role === 'Assistant' && getMedecinsForAssistantInPlanning(creneau.employe_id, creneau.date, creneau.creneau).length > 0) && (
                                <div className={`text-xs italic truncate ${isDark ? 'text-white opacity-80' : 'text-gray-600'}`}>
                                  📝 {creneau.notes}
                                </div>
                              )}
                            </div>
                            
                            {canModifyPlanning() && (
                              <div className="flex flex-col space-y-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditCreneau(creneau)}
                                  className={`h-7 w-7 p-0 ${hasAssistant || hasMedecin ? 'text-white hover:bg-white hover:bg-opacity-20' : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'}`}
                                  title="Modifier"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDuplicateCreneau(creneau)}
                                  className={`h-7 w-7 p-0 ${hasAssistant || hasMedecin ? 'text-white hover:bg-white hover:bg-opacity-20' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`}
                                  title="Dupliquer vers Matin"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAnnulerCreneau(creneau)}
                                  className={`h-7 w-7 p-0 ${hasAssistant || hasMedecin ? 'text-white hover:bg-white hover:bg-opacity-20' : 'text-red-600 hover:text-red-800 hover:bg-red-50'}`}
                                  title="Annuler"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* Afficher les demandes en attente APRÈS la grille (Vue directeur) */}
                {hasDirectorView() && users.filter(u => 
                  u.role === 'Médecin' && hasDemandeEnAttente(u.id, selectedDate, 'APRES_MIDI')
                ).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">
                      Demandes en attente - Après-midi
                    </h3>
                    {users.filter(u => 
                      u.role === 'Médecin' && hasDemandeEnAttente(u.id, selectedDate, 'APRES_MIDI')
                    ).map(employe => {
                      const demande = getDemandeEnAttente(employe.id, selectedDate, 'APRES_MIDI');
                      const isJourneeComplete = demande?.creneau === 'JOURNEE_COMPLETE';
                      
                      return (
                      <div
                        key={`demande-jour-apres-midi-${employe.id}`}
                        className="border-2 border-yellow-500 bg-yellow-50 text-yellow-700 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">
                              {employe.prenom} {employe.nom}
                            </div>
                            <div className="text-sm font-semibold mt-1">
                              ⏳ Demande en attente {isJourneeComplete && '(Journée complète)'}
                            </div>
                          </div>
                          {canModifyPlanning() && (
                          <div className="flex space-x-1">
                            {isJourneeComplete && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprouverDemandePlanning(employe.id, selectedDate, 'APRES_MIDI', true, null)}
                                className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                                title="Approuver la journée complète"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approuver Journée
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprouverDemandePlanning(employe.id, selectedDate, 'APRES_MIDI', true, isJourneeComplete ? 'APRES_MIDI' : null)}
                              className="text-green-600 hover:text-green-800 hover:bg-green-50 h-8 px-3"
                              title={isJourneeComplete ? "Approuver Après-midi uniquement" : "Approuver"}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              {isJourneeComplete ? 'Après-midi' : 'Approuver'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprouverDemandePlanning(employe.id, selectedDate, 'APRES_MIDI', false, isJourneeComplete ? 'APRES_MIDI' : null)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 px-3"
                              title={isJourneeComplete ? "Refuser Après-midi uniquement" : "Refuser"}
                            >
                              <X className="h-4 w-4 mr-1" />
                              {isJourneeComplete ? 'Refuser Après-midi' : 'Refuser'}
                            </Button>
                          </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan du Cabinet - Visible pour tous sous le planning journalier */}
        <PlanCabinetCompact 
          selectedDate={selectedDate} 
          isDirector={hasDirectorView()}
          onRefresh={() => fetchPlanningByDate(selectedDate)}
          centreActif={centreActif}
        />
        </>
        )}

        {/* Vue Semaine */}
        {viewMode === 'semaine' && planningSemaine && planningSemaine.dates && planningSemaine.dates.length > 0 && (
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>Planning de la Semaine</span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium">Filtres :</span>
                  <div className="flex space-x-2">
                    <Button
                      variant={filterRole.length === 3 ? 'default' : 'outline'}
                      size="sm"
                      onClick={selectAllRoles}
                    >
                      Tous
                    </Button>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant={filterRole.includes('Médecin') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleRoleToggle('Médecin')}
                    >
                      {filterRole.includes('Médecin') ? '✓ ' : ''}Médecins
                    </Button>
                    <Button
                      variant={filterRole.includes('Assistant') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleRoleToggle('Assistant')}
                    >
                      {filterRole.includes('Assistant') ? '✓ ' : ''}Assistants
                    </Button>
                    <Button
                      variant={filterRole.includes('Secrétaire') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleRoleToggle('Secrétaire')}
                    >
                      {filterRole.includes('Secrétaire') ? '✓ ' : ''}Secrétaires
                    </Button>
                  </div>
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
                  {planningSemaine.dates && planningSemaine.dates[0] && planningSemaine.dates[6] ? 
                    `${new Date(planningSemaine.dates[0]).toLocaleDateString('fr-FR')} - ${new Date(planningSemaine.dates[6]).toLocaleDateString('fr-FR')}` 
                    : 'Semaine en cours'}
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
                    {planningSemaine.dates && planningSemaine.dates[index] ? new Date(planningSemaine.dates[index]).getDate() : '-'}
                  </div>
                </div>
              ))}
              
              {/* Créneaux par jour avec filtrage */}
              {planningSemaine.dates.map(date => {
                // Filtrer les créneaux selon les rôles sélectionnés et l'employé spécifique
                const planningMatinFiltered = sortEmployeesByRoleThenName(
                  filterRole.length === 0
                    ? []
                    : (planningSemaine.planning[date]?.MATIN || []).filter(c => {
                        // Pour les non-directeurs sans vue_planning_complete: uniquement leurs créneaux
                        if (!hasDirectorView() && c.employe_id !== user?.id) return false;
                        if (!filterRole.includes(c.employe_role)) return false;
                        if (hasDirectorView() && filterEmploye !== 'tous' && c.employe_id !== filterEmploye) return false;
                        return true;
                      }).map(c => ({ ...c, role: c.employe_role, prenom: c.employe?.prenom }))
                );
                
                const planningApresMidiFiltered = sortEmployeesByRoleThenName(
                  filterRole.length === 0
                    ? []
                    : (planningSemaine.planning[date]?.APRES_MIDI || []).filter(c => {
                        // Pour les non-directeurs sans vue_planning_complete: uniquement leurs créneaux
                        if (!hasDirectorView() && c.employe_id !== user?.id) return false;
                        if (!filterRole.includes(c.employe_role)) return false;
                        if (hasDirectorView() && filterEmploye !== 'tous' && c.employe_id !== filterEmploye) return false;
                        return true;
                      }).map(c => ({ ...c, role: c.employe_role, prenom: c.employe?.prenom }))
                );
                
                // Trouver les employés en congé ce jour (filtré par employé si sélectionné)
                const employesEnConge = users.filter(u => 
                  filterRole.includes(u.role) && 
                  isEmployeEnConge(u.id, date) &&
                  (filterEmploye === 'tous' || u.id === filterEmploye)
                );
                
                // Trouver les employés avec demande de travail en attente (matin)
                const employesDemandeMatinEnAttente = users.filter(u => 
                  filterRole.includes(u.role) && 
                  hasDemandeEnAttente(u.id, date, 'MATIN') &&
                  (filterEmploye === 'tous' || u.id === filterEmploye)
                );
                
                // Trouver les employés avec demande de travail en attente (après-midi)
                const employesDemandeApresMidiEnAttente = users.filter(u => 
                  filterRole.includes(u.role) && 
                  hasDemandeEnAttente(u.id, date, 'APRES_MIDI') &&
                  (filterEmploye === 'tous' || u.id === filterEmploye)
                );
                
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
                              if (canModifyPlanning()) {
                                handleEditCreneau(creneau);
                              }
                            }}
                            className={`text-xs p-1 rounded border ${getRoleColor(creneau.employe_role)} ${canModifyPlanning() ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                          >
                            <div className="font-medium truncate">
                              {creneau.employe?.prenom?.[0]}.{creneau.employe?.nom}
                            </div>
                            {creneau.salle_attribuee && (
                              <div className="text-xs opacity-75">
                                {creneau.salle_attribuee}
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Afficher les employés en congé */}
                        {employesEnConge.map(employe => (
                          <div
                            key={`conge-matin-${employe.id}`}
                            className="text-xs p-1 rounded border-2 border-red-500 bg-red-50 text-red-700"
                          >
                            <div className="font-medium truncate">
                              {employe.prenom?.[0]}.{employe.nom}
                            </div>
                            <div className="text-xs font-semibold">
                              🚫 Congés
                            </div>
                          </div>
                        ))}
                        {/* Afficher les employés avec demande en attente (Vue directeur) */}
                        {hasDirectorView() && employesDemandeMatinEnAttente.map(employe => (
                          <div
                            key={`demande-matin-${employe.id}`}
                            className="text-xs p-1 rounded border-2 border-yellow-500 bg-yellow-50 text-yellow-700"
                          >
                            <div className="font-medium truncate">
                              {employe.prenom?.[0]}.{employe.nom}
                            </div>
                            <div className="text-xs font-semibold">
                              ⏳ Demande en attente
                            </div>
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
                              if (canModifyPlanning()) {
                                handleEditCreneau(creneau);
                              }
                            }}
                            className={`text-xs p-1 rounded border ${getRoleColor(creneau.employe_role)} ${canModifyPlanning() ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                          >
                            <div className="font-medium truncate">
                              {creneau.employe?.prenom?.[0]}.{creneau.employe?.nom}
                            </div>
                            {creneau.salle_attribuee && (
                              <div className="text-xs opacity-75">
                                {creneau.salle_attribuee}
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Afficher les employés en congé */}
                        {employesEnConge.map(employe => (
                          <div
                            key={`conge-apres-midi-${employe.id}`}
                            className="text-xs p-1 rounded border-2 border-red-500 bg-red-50 text-red-700"
                          >
                            <div className="font-medium truncate">
                              {employe.prenom?.[0]}.{employe.nom}
                            </div>
                            <div className="text-xs font-semibold">
                              🚫 Congés
                            </div>
                          </div>
                        ))}
                        {/* Afficher les employés avec demande en attente (Vue directeur) */}
                        {hasDirectorView() && employesDemandeApresMidiEnAttente.map(employe => (
                          <div
                            key={`demande-apres-midi-${employe.id}`}
                            className="text-xs p-1 rounded border-2 border-yellow-500 bg-yellow-50 text-yellow-700"
                          >
                            <div className="font-medium truncate">
                              {employe.prenom?.[0]}.{employe.nom}
                            </div>
                            <div className="text-xs font-semibold">
                              ⏳ Demande en attente
                            </div>
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

      {/* Tableau Récapitulatif - Vue directeur */}
      {viewMode === 'semaine' && hasDirectorView() && planningSemaine && planningSemaine.dates && planningSemaine.dates.length > 0 && (
        <>
          {/* Récapitulatif Hebdomadaire */}
          <Card className="mt-4">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
              <CardTitle className="flex items-center space-x-2">
                <span>📊 Récapitulatif de la Semaine</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Secrétaires */}
                {users.filter(u => u.role === 'Secrétaire' && u.actif).length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-pink-700 mb-2 bg-pink-100 p-2 rounded">📋 Secrétaires</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {users.filter(u => u.role === 'Secrétaire' && u.actif).map(secretaire => {
                        const heuresFaites = calculateHeures(secretaire.id, planningSemaine.dates);
                        const heuresContrat = secretaire.heures_semaine_fixe || 35;
                        const heuresSup = secretaire.heures_supplementaires || 0;
                        const congesDemiJ = calculateConges(secretaire.id, planningSemaine.dates);
                        const congesHeures = congesDemiJ * (secretaire.heures_demi_journee_conge || 4);
                        const diff = heuresFaites - heuresContrat;
                        
                        return (
                          <div key={secretaire.id} className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                            <div className="font-medium text-gray-800 mb-2">{secretaire.prenom} {secretaire.nom}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">Heures:</span>
                                <span className={`font-bold ml-1 ${Math.abs(diff) < 0.5 ? 'text-yellow-600' : diff < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {heuresFaites}h / {heuresContrat}h
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">H sup:</span>
                                <span className={`font-bold ml-1 ${heuresSup >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                  {heuresSup >= 0 ? '+' : ''}{heuresSup.toFixed(1)}h
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-500">Congés:</span>
                                <span className="font-bold text-green-600 ml-1">{congesDemiJ} ½j ({congesHeures}h)</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Assistants */}
                {users.filter(u => u.role === 'Assistant' && u.actif).length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-green-700 mb-2 bg-green-100 p-2 rounded">👥 Assistants</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {users.filter(u => u.role === 'Assistant' && u.actif).map(assistant => {
                        const demiJFaites = calculateDemiJournees(assistant.id, planningSemaine.dates);
                        const demiJPrevues = semaineAffichee === 'A' ? (assistant.limite_demi_journees_a || 10) : (assistant.limite_demi_journees_b || 10);
                        // Utiliser heures_demi_journee_travail si défini, sinon fallback sur heures_par_jour/2
                        const heuresParDemiJ = assistant.heures_demi_journee_travail || (assistant.heures_par_jour ? assistant.heures_par_jour / 2 : 3.5);
                        const heuresFaites = demiJFaites * heuresParDemiJ;
                        const heuresSup = assistant.heures_supplementaires || 0;
                        // Calculer uniquement les vrais congés (pas les repos)
                        const congesDemiJ = calculateCongesComptabilises(assistant.id, planningSemaine.dates);
                        const congesHeures = congesDemiJ * (assistant.heures_demi_journee_conge || 4);
                        
                        return (
                          <div key={assistant.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="font-medium text-gray-800 mb-2">{assistant.prenom} {assistant.nom}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">½j:</span>
                                <span className={`font-bold ml-1 ${demiJFaites === demiJPrevues ? 'text-yellow-600' : demiJFaites < demiJPrevues ? 'text-green-600' : 'text-red-600'}`}>
                                  {demiJFaites} / {demiJPrevues}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Heures:</span>
                                <span className="font-bold text-green-700 ml-1">{heuresFaites}h</span>
                              </div>
                              <div>
                                <span className="text-gray-500">H sup:</span>
                                <span className={`font-bold ml-1 ${heuresSup >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                  {heuresSup >= 0 ? '+' : ''}{heuresSup.toFixed(1)}h
                                </span>
                              </div>
                              {congesDemiJ > 0 && (
                              <div>
                                <span className="text-gray-500">Congés:</span>
                                <span className="font-bold text-green-600 ml-1">{congesDemiJ} ½j ({congesHeures}h)</span>
                              </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Médecins */}
                {users.filter(u => u.role === 'Médecin' && u.actif).length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-blue-700 mb-2 bg-blue-100 p-2 rounded">👨‍⚕️ Médecins</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {users.filter(u => u.role === 'Médecin' && u.actif).map(medecin => {
                        const demiJFaites = calculateDemiJournees(medecin.id, planningSemaine.dates);
                        const heuresSup = medecin.heures_supplementaires || 0;
                        
                        return (
                          <div key={medecin.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="font-medium text-gray-800 mb-2">Dr. {medecin.prenom} {medecin.nom}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">½j:</span>
                                <span className="font-bold text-blue-700 ml-1">{demiJFaites}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">H sup:</span>
                                <span className={`font-bold ml-1 ${heuresSup >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                  {heuresSup >= 0 ? '+' : ''}{heuresSup.toFixed(1)}h
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Séparation */}
          <div className="mt-6 border-t-4 border-gray-300"></div>
        </>
      )}

      {/* VUE MENSUELLE - Planning Calendrier en premier (Directeur uniquement) */}
      {viewMode === 'mois' && user?.role === 'Directeur' && (
        <Card className="mt-4">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>
                  📅 Planning Mensuel - {new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
              </span>
              {/* Filtre employé pour le directeur ou vue planning complète */}
              {hasDirectorView() && (
                <div className="flex items-center space-x-2">
                  <Label className="text-sm">Filtrer par employé:</Label>
                  <Select value={filterEmployeMois} onValueChange={setFilterEmployeMois}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Tous les employés" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2 border-b">
                        <Input
                          placeholder="🔍 Rechercher..."
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const term = e.target.value.toLowerCase();
                            const items = e.target.closest('.select-content')?.querySelectorAll('[data-employee-name]');
                            items?.forEach(item => {
                              const name = item.getAttribute('data-employee-name');
                              item.style.display = name?.includes(term) ? '' : 'none';
                            });
                          }}
                        />
                      </div>
                      <SelectItem value="tous">👥 Tous les employés</SelectItem>
                      <SelectItem value="medecins">👨‍⚕️ Médecins uniquement</SelectItem>
                      {sortEmployeesByRoleThenName(users.filter(u => u.actif && u.role !== 'Directeur')).map(emp => {
                        let demiJournees = 0;
                        planningMois.filter(p => p.employe_id === emp.id).forEach(p => {
                          demiJournees += 1;
                        });
                        const jours = demiJournees / 2;
                        const joursStr = jours % 1 === 0 ? jours.toString() : jours.toFixed(1).replace('.', ',');
                        
                        return (
                          <SelectItem 
                            key={emp.id} 
                            value={emp.id}
                            data-employee-name={`${emp.prenom} ${emp.nom}`.toLowerCase()}
                          >
                            {emp.role === 'Médecin' ? '👨‍⚕️' : emp.role === 'Assistant' ? '👥' : '📋'} {emp.prenom} {emp.nom} ({joursStr}j)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Calendrier mensuel style grille avec Matin/Après-midi */}
            <div className="overflow-x-auto">
              {(() => {
                // Calculer les données du mois
                const year = new Date(selectedMonth + '-01').getFullYear();
                const month = new Date(selectedMonth + '-01').getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstDayOfMonth = new Date(year, month, 1).getDay();
                // Ajuster pour que lundi soit 0
                const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                
                // Créer les semaines
                const weeks = [];
                let currentWeek = Array(startDay).fill(null);
                
                for (let day = 1; day <= daysInMonth; day++) {
                  currentWeek.push(day);
                  if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                  }
                }
                if (currentWeek.length > 0) {
                  while (currentWeek.length < 7) currentWeek.push(null);
                  weeks.push(currentWeek);
                }
                
                // Vérifier si un employé spécifique est sélectionné
                const selectedEmployee = filterEmployeMois && filterEmployeMois !== 'tous' && filterEmployeMois !== 'medecins' 
                  ? users.find(u => u.id === filterEmployeMois) 
                  : null;
                const empColor = selectedEmployee 
                  ? (selectedEmployee.role === 'Médecin' ? 'blue' : selectedEmployee.role === 'Assistant' ? 'green' : 'pink')
                  : 'indigo';
                
                return (
                  <div>
                    {/* En-têtes des jours */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(jour => (
                        <div key={jour} className={`text-center font-semibold py-2 rounded ${selectedEmployee ? `bg-${empColor}-100 text-${empColor}-700` : 'bg-indigo-100 text-gray-600'}`}>
                          {jour}
                        </div>
                      ))}
                    </div>
                    
                    {/* Titre si employé sélectionné */}
                    {selectedEmployee && (
                      <div className={`mb-3 p-2 rounded-lg bg-${empColor}-50 border border-${empColor}-200`}>
                        <span className="font-semibold text-${empColor}-800">
                          📅 Planning de {selectedEmployee.role === 'Médecin' ? 'Dr. ' : ''}{selectedEmployee.prenom} {selectedEmployee.nom}
                        </span>
                      </div>
                    )}
                    
                    {/* Grille des jours */}
                    {weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
                        {week.map((day, dayIndex) => {
                          if (day === null) {
                            return <div key={dayIndex} className="min-h-[80px]"></div>;
                          }
                          
                          const dateStr = formatDateISO(year, month + 1, day);
                          const isWeekend = dayIndex === 5 || dayIndex === 6;
                          
                          // Si un employé est sélectionné, afficher sa présence personnelle
                          if (selectedEmployee) {
                            const hasMatin = planningMois.some(p => 
                              p.date === dateStr && 
                              p.creneau === 'MATIN' && 
                              p.employe_id === selectedEmployee.id
                            );
                            const hasAM = planningMois.some(p => 
                              p.date === dateStr && 
                              p.creneau === 'APRES_MIDI' && 
                              p.employe_id === selectedEmployee.id
                            );
                            
                            // Vérifier congés
                            const congesJour = congesApprouves.filter(c => 
                              c.utilisateur_id === selectedEmployee.id && 
                              c.statut === 'APPROUVE' && 
                              c.date_debut <= dateStr && 
                              c.date_fin >= dateStr
                            );
                            const hasConge = congesJour.length > 0;
                            const conge = congesJour[0];
                            
                            return (
                              <div 
                                key={dayIndex} 
                                className={`border rounded-lg overflow-hidden min-h-[80px] ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}
                              >
                                <div className={`text-right px-2 py-1 text-sm font-semibold ${isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                                  {day}
                                </div>
                                
                                {hasConge ? (
                                  <div className="bg-red-100 mx-1 mb-1 rounded p-2 text-center">
                                    <div className="text-red-700 font-bold">🏖️ Congé</div>
                                    <div className="text-xs text-red-600">
                                      {conge.type_conge === 'CONGE_PAYE' ? 'CP' : 
                                       conge.type_conge === 'CONGE_SANS_SOLDE' ? 'CSS' : 
                                       conge.type_conge === 'MALADIE' ? 'Maladie' :
                                       conge.type_conge === 'REPOS' ? 'Repos' : 
                                       conge.type_conge === 'HEURES_A_RECUPERER' ? 'H+' :
                                       conge.type_conge === 'HEURES_RECUPEREES' ? 'H-' : 'Congé'}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className={`mx-1 mb-1 rounded p-1 ${hasMatin ? `bg-${empColor}-200` : 'bg-gray-100'}`}>
                                      <div className="text-xs text-center">🌅 Matin</div>
                                      <div className={`text-center font-bold text-sm ${hasMatin ? `text-${empColor}-800` : 'text-gray-400'}`}>
                                        {hasMatin ? '✓ Présent' : '-'}
                                      </div>
                                    </div>
                                    <div className={`mx-1 mb-1 rounded p-1 ${hasAM ? `bg-${empColor}-200` : 'bg-gray-100'}`}>
                                      <div className="text-xs text-center">🌆 Après-midi</div>
                                      <div className={`text-center font-bold text-sm ${hasAM ? `text-${empColor}-800` : 'text-gray-400'}`}>
                                        {hasAM ? '✓ Présent' : '-'}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          }
                          
                          // Vue par défaut : compter les médecins
                          const medecinsMatin = planningMois.filter(p => 
                            p.date === dateStr && 
                            p.creneau === 'MATIN' && 
                            users.find(u => u.id === p.employe_id)?.role === 'Médecin'
                          ).length;
                          const medecinsAM = planningMois.filter(p => 
                            p.date === dateStr && 
                            p.creneau === 'APRES_MIDI' && 
                            users.find(u => u.id === p.employe_id)?.role === 'Médecin'
                          ).length;
                          
                          // Compter les demandes en attente
                          const demandesMatinAttente = demandesTravail.filter(d => 
                            d.date_demandee === dateStr && 
                            d.statut === 'EN_ATTENTE' && 
                            (d.creneau === 'MATIN' || d.creneau === 'JOURNEE_COMPLETE')
                          ).length;
                          const demandesAMAttente = demandesTravail.filter(d => 
                            d.date_demandee === dateStr && 
                            d.statut === 'EN_ATTENTE' && 
                            (d.creneau === 'APRES_MIDI' || d.creneau === 'JOURNEE_COMPLETE')
                          ).length;
                          
                          return (
                            <div 
                              key={dayIndex} 
                              className={`border rounded-lg overflow-hidden min-h-[80px] ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}
                            >
                              <div className={`text-right px-2 py-1 text-sm font-semibold ${isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                                {day}
                              </div>
                              
                              <div 
                                className="bg-orange-100 mx-1 mb-1 rounded p-1 cursor-pointer hover:bg-orange-200 transition-colors"
                                onClick={() => {
                                  setMoisDetailsData({
                                    date: dateStr,
                                    creneau: 'MATIN',
                                    employes: planningMois.filter(p => p.date === dateStr && p.creneau === 'MATIN')
                                  });
                                  setShowMoisDetailsModal(true);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-orange-700">🌅 Matin</span>
                                  {demandesMatinAttente > 0 && (
                                    <span className="text-xs bg-yellow-400 text-yellow-900 px-1 rounded font-bold">+{demandesMatinAttente}</span>
                                  )}
                                </div>
                                <div className="text-center font-bold text-orange-800">{medecinsMatin}</div>
                                <div className="text-xs text-center text-orange-600">médecin(s)</div>
                              </div>
                              
                              <div 
                                className="bg-purple-100 mx-1 mb-1 rounded p-1 cursor-pointer hover:bg-purple-200 transition-colors"
                                onClick={() => {
                                  setMoisDetailsData({
                                    date: dateStr,
                                    creneau: 'APRES_MIDI',
                                    employes: planningMois.filter(p => p.date === dateStr && p.creneau === 'APRES_MIDI')
                                  });
                                  setShowMoisDetailsModal(true);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-purple-700">🌆 Après-midi</span>
                                  {demandesAMAttente > 0 && (
                                    <span className="text-xs bg-yellow-400 text-yellow-900 px-1 rounded font-bold">+{demandesAMAttente}</span>
                                  )}
                                </div>
                                <div className="text-center font-bold text-purple-800">{medecinsAM}</div>
                                <div className="text-xs text-center text-purple-600">médecin(s)</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            {/* Légende */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs items-center">
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-orange-100 rounded"></span> Matin</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-purple-100 rounded"></span> Après-midi</div>
              <div className="flex items-center gap-1"><span className="px-1 bg-yellow-400 text-yellow-900 rounded text-xs font-bold">+N</span> = demandes en attente</div>
              <div className="text-gray-500">💡 Cliquez sur un créneau pour voir les détails</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VUE MENSUELLE - Planning personnel pour les employés (non-directeurs) */}
      {viewMode === 'mois' && user?.role !== 'Directeur' && (
        <Card className="mt-4">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>
                📅 Mon Planning - {new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Calendrier mensuel personnel */}
            <div className="overflow-x-auto">
              {(() => {
                const year = new Date(selectedMonth + '-01').getFullYear();
                const month = new Date(selectedMonth + '-01').getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstDayOfMonth = new Date(year, month, 1).getDay();
                const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                
                const weeks = [];
                let currentWeek = Array(startDay).fill(null);
                
                for (let day = 1; day <= daysInMonth; day++) {
                  currentWeek.push(day);
                  if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                  }
                }
                if (currentWeek.length > 0) {
                  while (currentWeek.length < 7) currentWeek.push(null);
                  weeks.push(currentWeek);
                }
                
                const userColor = user?.role === 'Médecin' ? 'blue' : user?.role === 'Assistant' ? 'green' : 'pink';
                
                return (
                  <div>
                    {/* En-têtes des jours */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(jour => (
                        <div key={jour} className={`text-center font-semibold text-${userColor}-700 py-2 bg-${userColor}-100 rounded`}>
                          {jour}
                        </div>
                      ))}
                    </div>
                    
                    {/* Grille des jours */}
                    {weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
                        {week.map((day, dayIndex) => {
                          if (day === null) {
                            return <div key={dayIndex} className="min-h-[80px]"></div>;
                          }
                          
                          const dateStr = formatDateISO(year, month + 1, day);
                          const isWeekend = dayIndex === 5 || dayIndex === 6;
                          
                          // Vérifier présence de l'employé
                          const hasMatin = planningMois.some(p => 
                            p.date === dateStr && 
                            p.creneau === 'MATIN' && 
                            p.employe_id === user?.id
                          );
                          const hasAM = planningMois.some(p => 
                            p.date === dateStr && 
                            p.creneau === 'APRES_MIDI' && 
                            p.employe_id === user?.id
                          );
                          
                          // Vérifier congés
                          const congesJour = congesApprouves.filter(c => 
                            c.utilisateur_id === user?.id && 
                            c.statut === 'APPROUVE' && 
                            c.date_debut <= dateStr && 
                            c.date_fin >= dateStr
                          );
                          const hasConge = congesJour.length > 0;
                          const conge = congesJour[0];
                          
                          return (
                            <div 
                              key={dayIndex} 
                              className={`border rounded-lg overflow-hidden min-h-[80px] ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}
                            >
                              {/* Numéro du jour */}
                              <div className={`text-right px-2 py-1 text-sm font-semibold ${isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                                {day}
                              </div>
                              
                              {hasConge ? (
                                // Afficher le congé
                                <div className="bg-red-100 mx-1 mb-1 rounded p-2 text-center">
                                  <div className="text-red-700 font-bold">🏖️ Congé</div>
                                  <div className="text-xs text-red-600">
                                    {conge.type_conge === 'CONGE_PAYE' ? 'CP' : 
                                     conge.type_conge === 'CONGE_SANS_SOLDE' ? 'CSS' : 
                                     conge.type_conge === 'MALADIE' ? 'Maladie' :
                                     conge.type_conge === 'REPOS' ? 'Repos' : 
                                     conge.type_conge === 'HEURES_A_RECUPERER' ? 'H+' :
                                     conge.type_conge === 'HEURES_RECUPEREES' ? 'H-' : 'Congé'}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Matin */}
                                  <div className={`mx-1 mb-1 rounded p-1 ${hasMatin ? `bg-${userColor}-200` : 'bg-gray-100'}`}>
                                    <div className="text-xs text-center">🌅 Matin</div>
                                    <div className={`text-center font-bold text-sm ${hasMatin ? `text-${userColor}-800` : 'text-gray-400'}`}>
                                      {hasMatin ? '✓ Présent' : '-'}
                                    </div>
                                  </div>
                                  
                                  {/* Après-midi */}
                                  <div className={`mx-1 mb-1 rounded p-1 ${hasAM ? `bg-${userColor}-200` : 'bg-gray-100'}`}>
                                    <div className="text-xs text-center">🌆 Après-midi</div>
                                    <div className={`text-center font-bold text-sm ${hasAM ? `text-${userColor}-800` : 'text-gray-400'}`}>
                                      {hasAM ? '✓ Présent' : '-'}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            {/* Légende */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs items-center">
              <div className="flex items-center gap-1"><span className={`w-4 h-4 bg-${user?.role === 'Médecin' ? 'blue' : user?.role === 'Assistant' ? 'green' : 'pink'}-200 rounded`}></span> Présent</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-gray-100 rounded"></span> Absent</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-red-100 rounded"></span> Congé</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VUE MENSUELLE - Tableau détaillé des employés (Directeur uniquement) */}
      {viewMode === 'mois' && user?.role === 'Directeur' && (
        <Card className="mt-4">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <span>📋 Détail par Employé</span>
              </span>
              <div className="flex items-center space-x-2">
                <Label className="text-sm">Filtrer:</Label>
                <Select value={filterEmployeMois} onValueChange={setFilterEmployeMois}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Tous les employés" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">👥 Tous les employés</SelectItem>
                    <SelectItem value="medecins">👨‍⚕️ Médecins uniquement</SelectItem>
                    {sortEmployeesByRoleThenName(users.filter(u => u.actif && u.role !== 'Directeur')).map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.role === 'Médecin' ? '👨‍⚕️' : emp.role === 'Assistant' ? '👥' : '📋'} {emp.prenom} {emp.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Tableau des employés */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border p-2 bg-gray-100 text-left min-w-[120px]">Employé</th>
                    {Array.from({ length: new Date(new Date(selectedMonth + '-01').getFullYear(), new Date(selectedMonth + '-01').getMonth() + 1, 0).getDate() }, (_, i) => {
                      const date = new Date(selectedMonth + '-01');
                      date.setDate(i + 1);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const dayLetter = date.toLocaleDateString('fr-FR', { weekday: 'short' }).charAt(0).toUpperCase();
                      return (
                        <th key={i} className={`border p-1 text-center ${isWeekend ? 'bg-gray-200' : 'bg-gray-50'}`}>
                          <div className="text-xs font-semibold">{dayLetter}</div>
                          <div className="text-xs">{i + 1}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortEmployeesByRoleThenName(
                    users.filter(u => {
                      if (!u.actif || u.role === 'Directeur') return false;
                      if (filterEmployeMois === 'tous') return true;
                      if (filterEmployeMois === 'medecins') return u.role === 'Médecin';
                      return u.id === filterEmployeMois;
                    })
                  ).map(emp => {
                    const empColor = emp.role === 'Médecin' ? 'blue' : emp.role === 'Assistant' ? 'green' : 'pink';
                    return (
                      <tr key={emp.id}>
                        <td className={`border p-1 font-medium bg-${empColor}-50 whitespace-nowrap`}>
                          {emp.role === 'Médecin' && 'Dr. '}{emp.prenom} {emp.nom}
                        </td>
                        {Array.from({ length: new Date(new Date(selectedMonth + '-01').getFullYear(), new Date(selectedMonth + '-01').getMonth() + 1, 0).getDate() }, (_, i) => {
                          const dateStr = formatDateISO(
                            new Date(selectedMonth + '-01').getFullYear(),
                            new Date(selectedMonth + '-01').getMonth() + 1,
                            i + 1
                          );
                          const date = new Date(dateStr + 'T12:00:00');
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          
                          const creneauMatin = planningMois.find(p => p.employe_id === emp.id && p.date === dateStr && p.creneau === 'MATIN');
                          const creneauAM = planningMois.find(p => p.employe_id === emp.id && p.date === dateStr && p.creneau === 'APRES_MIDI');
                          const congesJour = congesApprouves.filter(c => c.utilisateur_id === emp.id && c.statut === 'APPROUVE' && c.date_debut <= dateStr && c.date_fin >= dateStr);
                          const hasConge = congesJour.length > 0;
                          
                          let cellContent = '';
                          let cellClass = isWeekend ? 'bg-gray-100' : 'bg-white';
                          
                          if (hasConge) {
                            const conge = congesJour[0];
                            cellContent = conge.type_conge === 'CONGE_PAYE' ? 'CP' : 
                                          conge.type_conge === 'CONGE_SANS_SOLDE' ? 'CSS' : 
                                          conge.type_conge === 'MALADIE' ? 'M' :
                                          conge.type_conge === 'REPOS' ? 'R' : 
                                          conge.type_conge === 'HEURES_A_RECUPERER' ? 'H+' :
                                          conge.type_conge === 'HEURES_RECUPEREES' ? 'H-' : 'C';
                            cellClass = 'bg-red-100 text-red-700';
                          } else if (creneauMatin && creneauAM) {
                            cellContent = 'J';
                            cellClass = `bg-${empColor}-200 text-${empColor}-800`;
                          } else if (creneauMatin) {
                            cellContent = 'M';
                            cellClass = `bg-${empColor}-100 text-${empColor}-700`;
                          } else if (creneauAM) {
                            cellContent = 'AM';
                            cellClass = `bg-${empColor}-100 text-${empColor}-700`;
                          }
                          
                          return (
                            <td key={i} className={`border p-1 text-center font-semibold ${cellClass}`}>
                              {cellContent}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Légende */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-blue-200 rounded"></span> Médecin</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-green-100 border border-green-300 rounded"></span> Assistant 0/2</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-green-400 rounded"></span> Assistant 1/2</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-green-600 rounded"></span> Assistant 2/2</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-pink-200 rounded"></span> Secrétaire</div>
              <div className="flex items-center gap-1"><span className="w-4 h-4 bg-red-100 rounded"></span> Congé</div>
              <div><strong>M</strong> = Matin, <strong>AM</strong> = Après-midi, <strong>J</strong> = Journée</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VUE MENSUELLE - Récapitulatif en dessous (Directeur uniquement) */}
      {viewMode === 'mois' && user?.role === 'Directeur' && (
        <Card className="mt-4">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100">
            <CardTitle className="flex items-center space-x-2">
              <span>📊 Récapitulatif du Mois</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Secrétaires */}
              {users.filter(u => u.role === 'Secrétaire' && u.actif).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-pink-700 mb-2 bg-pink-100 p-2 rounded">📋 Secrétaires</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {users.filter(u => u.role === 'Secrétaire' && u.actif).map(secretaire => {
                      const firstDate = new Date(planningMois[0]?.date || selectedMonth + '-01');
                      const year = firstDate.getFullYear();
                      const month = firstDate.getMonth();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const datesMonth = [];
                      for (let i = 1; i <= daysInMonth; i++) {
                        datesMonth.push(formatDateISO(year, month + 1, i));
                      }
                      const heuresFaites = calculateHeures(secretaire.id, datesMonth);
                      const heuresContrat = (secretaire.heures_semaine_fixe || 35) * 4;
                      const heuresSup = secretaire.heures_supplementaires || 0;
                      const congesDemiJ = calculateConges(secretaire.id, datesMonth);
                      const congesHeures = congesDemiJ * (secretaire.heures_demi_journee_conge || 4);
                      
                      return (
                        <div key={secretaire.id} className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                          <div className="font-medium text-gray-800 mb-2">{secretaire.prenom} {secretaire.nom}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Heures:</span>
                              <span className="font-bold text-pink-700 ml-1">{heuresFaites}h / {heuresContrat}h</span>
                            </div>
                            <div>
                              <span className="text-gray-500">H sup:</span>
                              <span className={`font-bold ml-1 ${heuresSup >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                {heuresSup >= 0 ? '+' : ''}{heuresSup.toFixed(1)}h
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500">Congés:</span>
                              <span className="font-bold text-green-600 ml-1">{congesDemiJ} ½j ({congesHeures}h)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Assistants */}
              {users.filter(u => u.role === 'Assistant' && u.actif).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-700 mb-2 bg-green-100 p-2 rounded">👥 Assistants</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {users.filter(u => u.role === 'Assistant' && u.actif).map(assistant => {
                      const firstDate = new Date(planningMois[0]?.date || selectedMonth + '-01');
                      const year = firstDate.getFullYear();
                      const month = firstDate.getMonth();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const datesMonth = [];
                      for (let i = 1; i <= daysInMonth; i++) {
                        datesMonth.push(formatDateISO(year, month + 1, i));
                      }
                      const demiJFaites = calculateDemiJournees(assistant.id, datesMonth);
                      const demiJPrevues = ((assistant.limite_demi_journees_a || 10) + (assistant.limite_demi_journees_b || 10)) / 2 * 4;
                      // Utiliser heures_demi_journee_travail si défini
                      const heuresParDemiJ = assistant.heures_demi_journee_travail || (assistant.heures_par_jour ? assistant.heures_par_jour / 2 : 3.5);
                      const heuresFaites = demiJFaites * heuresParDemiJ;
                      const heuresSup = assistant.heures_supplementaires || 0;
                      const congesDemiJ = calculateCongesComptabilises(assistant.id, datesMonth);
                      const congesHeures = congesDemiJ * (assistant.heures_demi_journee_conge || 4);
                      
                      return (
                        <div key={assistant.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="font-medium text-gray-800 mb-2">{assistant.prenom} {assistant.nom}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">½j:</span>
                              <span className="font-bold text-green-700 ml-1">{demiJFaites} / {Math.round(demiJPrevues)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Heures:</span>
                              <span className="font-bold text-green-700 ml-1">{heuresFaites}h</span>
                            </div>
                            <div>
                              <span className="text-gray-500">H sup:</span>
                              <span className={`font-bold ml-1 ${heuresSup >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                {heuresSup >= 0 ? '+' : ''}{heuresSup.toFixed(1)}h
                              </span>
                            </div>
                            {congesDemiJ > 0 && (
                            <div>
                              <span className="text-gray-500">Congés:</span>
                              <span className="font-bold text-green-600 ml-1">{congesDemiJ} ½j ({congesHeures}h)</span>
                            </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Médecins */}
              {users.filter(u => u.role === 'Médecin' && u.actif).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-blue-700 mb-2 bg-blue-100 p-2 rounded">👨‍⚕️ Médecins</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {users.filter(u => u.role === 'Médecin' && u.actif).map(medecin => {
                      const firstDate = new Date(planningMois[0]?.date || selectedMonth + '-01');
                      const year = firstDate.getFullYear();
                      const month = firstDate.getMonth();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const datesMonth = [];
                      for (let i = 1; i <= daysInMonth; i++) {
                        datesMonth.push(formatDateISO(year, month + 1, i));
                      }
                      const demiJFaites = calculateDemiJournees(medecin.id, datesMonth);
                      const heuresSup = medecin.heures_supplementaires || 0;
                      
                      return (
                        <div key={medecin.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="font-medium text-gray-800 mb-2">Dr. {medecin.prenom} {medecin.nom}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">½j:</span>
                              <span className="font-bold text-blue-700 ml-1">{demiJFaites}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">H sup:</span>
                              <span className={`font-bold ml-1 ${heuresSup >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                {heuresSup >= 0 ? '+' : ''}{heuresSup.toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Détails Vue Mois */}
      <Dialog open={showMoisDetailsModal} onOpenChange={setShowMoisDetailsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              📋 Détails du {new Date(moisDetailsData.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {moisDetailsData.creneau === 'MATIN' ? ' - Matin 🌅' : ' - Après-midi 🌆'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {moisDetailsData.employes.length === 0 && demandesTravail.filter(d => 
              d.date_demandee === moisDetailsData.date && 
              d.statut === 'EN_ATTENTE' &&
              (d.creneau === moisDetailsData.creneau || d.creneau === 'JOURNEE_COMPLETE')
            ).length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucun employé présent ni demande en attente</p>
            ) : (
              <>
                {/* Médecins Présents */}
                {moisDetailsData.employes.filter(e => e.employe_role === 'Médecin').length > 0 && (
                  <div>
                    <h4 className="font-semibold text-blue-700 mb-2">👨‍⚕️ Médecins Présents ({moisDetailsData.employes.filter(e => e.employe_role === 'Médecin').length})</h4>
                    {moisDetailsData.employes.filter(e => e.employe_role === 'Médecin').map(emp => (
                      <div key={emp.id} className="bg-blue-50 border border-blue-200 rounded p-2 mb-1">
                        <div className="font-medium">Dr. {emp.employe?.prenom} {emp.employe?.nom}</div>
                        {emp.salle_attribuee && <div className="text-xs text-gray-600">🏥 Box: {emp.salle_attribuee}</div>}
                        {emp.salle_attente && <div className="text-xs text-gray-600">⏳ Salle d'attente: {emp.salle_attente}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Demandes en Attente */}
                {demandesTravail.filter(d => 
                  d.date_demandee === moisDetailsData.date && 
                  d.statut === 'EN_ATTENTE' &&
                  (d.creneau === moisDetailsData.creneau || d.creneau === 'JOURNEE_COMPLETE')
                ).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-yellow-700 mb-2">⏳ Demandes en Attente ({demandesTravail.filter(d => 
                      d.date_demandee === moisDetailsData.date && 
                      d.statut === 'EN_ATTENTE' &&
                      (d.creneau === moisDetailsData.creneau || d.creneau === 'JOURNEE_COMPLETE')
                    ).length})</h4>
                    {demandesTravail.filter(d => 
                      d.date_demandee === moisDetailsData.date && 
                      d.statut === 'EN_ATTENTE' &&
                      (d.creneau === moisDetailsData.creneau || d.creneau === 'JOURNEE_COMPLETE')
                    ).map(demande => (
                      <div key={demande.id} className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-1">
                        <div className="font-medium">Dr. {demande.medecin?.prenom} {demande.medecin?.nom}</div>
                        <div className="text-xs text-yellow-700">
                          📋 {demande.creneau === 'JOURNEE_COMPLETE' ? 'Journée complète' : demande.creneau}
                        </div>
                        {demande.motif && <div className="text-xs text-gray-500 italic">"{demande.motif}"</div>}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Assistants */}
                {moisDetailsData.employes.filter(e => e.employe_role === 'Assistant').length > 0 && (
                  <div>
                    <h4 className="font-semibold text-green-700 mb-2">👥 Assistants ({moisDetailsData.employes.filter(e => e.employe_role === 'Assistant').length})</h4>
                    {moisDetailsData.employes.filter(e => e.employe_role === 'Assistant').map(emp => (
                      <div key={emp.id} className="bg-green-50 border border-green-200 rounded p-2 mb-1">
                        <div className="font-medium">{emp.employe?.prenom} {emp.employe?.nom}</div>
                        {emp.salle_attribuee && <div className="text-xs text-gray-600">🏥 Salle: {emp.salle_attribuee}</div>}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Secrétaires */}
                {moisDetailsData.employes.filter(e => e.employe_role === 'Secrétaire').length > 0 && (
                  <div>
                    <h4 className="font-semibold text-purple-700 mb-2">📋 Secrétaires ({moisDetailsData.employes.filter(e => e.employe_role === 'Secrétaire').length})</h4>
                    {moisDetailsData.employes.filter(e => e.employe_role === 'Secrétaire').map(emp => (
                      <div key={emp.id} className="bg-purple-50 border border-purple-200 rounded p-2 mb-1">
                        <div className="font-medium">{emp.employe?.prenom} {emp.employe?.nom}</div>
                        {emp.salle_attribuee && <div className="text-xs text-gray-600">📍 {emp.salle_attribuee}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowMoisDetailsModal(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== VUE PLANNING INTERACTIF ==================== */}
      {viewMode === 'planning' && planningTableau.dates && (
        <Card className="mt-4">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-teal-100">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>📊 Planning Interactif - Semaine du {new Date(planningTableau.dates[0] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
              </span>
              <div className="flex items-center space-x-2">
                <Button 
                  variant={showRecapColumns ? "default" : "outline"}
                  size="sm" 
                  onClick={() => setShowRecapColumns(!showRecapColumns)}
                  className="text-xs"
                  title={showRecapColumns ? "Masquer les colonnes récap" : "Afficher les colonnes récap"}
                >
                  {showRecapColumns ? '📊 Masquer Récap' : '📊 Afficher Récap'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportPlanningPDF}
                  className="text-xs"
                  title="Télécharger en PDF"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportPlanningImage}
                  className="text-xs"
                  title="Télécharger en image"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Image
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
              </div>
            ) : (
              <div ref={planningTableRef} className="overflow-x-auto">
              <table className="w-full border-collapse text-xs planning-semaine-table">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-1 text-left text-xs col-employe">
                      Employé
                    </th>
                    {planningTableau.dates.map((date, dateIndex) => (
                      <th 
                        key={date} 
                        className={`border p-1 text-center cursor-pointer hover:bg-teal-100 transition-colors ${dateIndex % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}`}
                        colSpan={2}
                        onClick={() => openDetailJourModal(date)}
                        title="📋 Cliquer pour voir le détail de cette journée"
                      >
                        <input
                          type="text"
                          placeholder="Note..."
                          className="w-full text-xs bg-transparent border-none text-center placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-300 rounded"
                          value={notesPlanningJour[date] || ''}
                          onChange={(e) => setNotesPlanningJour(prev => ({...prev, [date]: e.target.value}))}
                          onBlur={(e) => handleSaveNotePlanningJour(date, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    ))}
                    {showRecapColumns && (
                      <>
                        <th className="border p-1 text-center bg-gray-300 text-xs col-recap" title="Total demi-journées">½j</th>
                        <th className="border p-1 text-center bg-blue-200 text-xs" style={{width: '50px'}} title="Heures effectuées cette semaine (selon Semaine A ou B)">
                          <div className="flex flex-col items-center">
                            <span>H Eff</span>
                            <select 
                              className="text-xs border rounded px-1 mt-1 bg-white"
                              value={semaineAffichee}
                              onChange={(e) => setSemaineAffichee(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="A">Sem A</option>
                              <option value="B">Sem B</option>
                            </select>
                          </div>
                        </th>
                        <th className="border p-1 text-center bg-indigo-200 text-xs col-recap" title="Comparaison heures faites vs contrat">Ctr</th>
                        <th className="border p-1 text-center bg-orange-200 text-xs col-recap" title="Heures supp/récup Semaine">+/- S</th>
                        <th className="border p-1 text-center bg-orange-100 text-xs col-recap" title="Heures supp/récup Mois">+/- M</th>
                        <th className="border p-1 text-center bg-orange-50 text-xs col-recap" title="Heures supp/récup Année">+/- A</th>
                        <th className="border p-1 text-center bg-green-200 text-xs col-recap" title="Heures de congés">Cg</th>
                      </>
                    )}
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border p-1 col-employe"></th>
                    {planningTableau.dates.map((date, dateIndex) => (
                      <React.Fragment key={`header-${date}`}>
                        <th 
                          className={`border p-1 text-center text-xs cursor-pointer hover:bg-slate-200 transition-colors col-jour ${dateIndex % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}`}
                          onClick={() => openDetailJourModal(date)}
                          title="📋 Voir détail journée"
                        >M</th>
                        <th 
                          className={`border p-1 text-center text-xs cursor-pointer hover:bg-slate-200 transition-colors col-jour ${dateIndex % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}`}
                          onClick={() => openDetailJourModal(date)}
                          title="📋 Voir détail journée"
                        >AM</th>
                      </React.Fragment>
                    ))}
                    {showRecapColumns && (
                      <>
                        <th className="border p-1 text-center text-xs bg-gray-300 col-recap">½j</th>
                        <th className="border p-1 text-center text-xs bg-blue-200">H</th>
                        <th className="border p-1 text-center text-xs bg-indigo-200 col-recap">Ctr</th>
                        <th className="border p-1 text-center text-xs bg-orange-200 col-recap">+/- S</th>
                        <th className="border p-1 text-center text-xs bg-orange-100 col-recap">+/- M</th>
                        <th className="border p-1 text-center text-xs bg-orange-50 col-recap">+/- A</th>
                        <th className="border p-1 text-center text-xs bg-green-200 col-recap">Cg</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* SECTION SECRÉTAIRES */}
                  <tr className="bg-pink-100">
                    <td 
                      className="border p-1 font-bold text-pink-800 cursor-pointer hover:bg-pink-200 text-xs"
                      onClick={() => openSemaineABCModal({ type: 'section', section: 'Secrétaire' })}
                      title="Cliquer pour appliquer Semaine A, B ou Congés"
                    >
                      📋 SECRÉTAIRES
                    </td>
                    {planningTableau.dates.map((date, dateIndex) => (
                      <td 
                        key={`sec-header-${date}`}
                        colSpan={2} 
                        className={`border p-1 text-center text-xs font-medium ${dateIndex % 2 === 0 ? 'bg-pink-50' : 'bg-pink-100'}`}
                      >
                        <div>{new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                        <div className="text-gray-500">{new Date(date + 'T12:00:00').getDate()}/{new Date(date + 'T12:00:00').getMonth() + 1}</div>
                      </td>
                    ))}
                    {showRecapColumns && (
                      <>
                        <td className="border p-1 bg-pink-100 text-xs text-center font-bold">½j</td>
                        <td className="border p-1 bg-pink-100 text-xs text-center font-bold">H</td>
                        <td className="border p-1 bg-pink-100 text-xs text-center font-bold">Ctr</td>
                        <td className="border p-1 bg-pink-100 text-xs text-center font-bold" title="Heures supp/récup Semaine">+/- S</td>
                        <td className="border p-1 bg-pink-100 text-xs text-center font-bold" title="Heures supp/récup Mois">+/- M</td>
                        <td className="border p-1 bg-pink-100 text-xs text-center font-bold" title="Heures supp/récup Année">+/- A</td>
                        <td className="border p-1 bg-pink-100 text-xs text-center font-bold">Cg</td>
                      </>
                    )}
                  </tr>
                  {sortEmployeesByRoleThenName(users.filter(u => u.actif && u.role === 'Secrétaire')).map(secretaire => {
                    const total = getTotalDemiJournees(secretaire.id);
                    const heures = getTotalHeures(secretaire.id);
                    return (
                      <tr key={secretaire.id} className="hover:bg-pink-50">
                        <td 
                          className="border p-1 font-medium text-xs col-employe overflow-hidden"
                        >
                          <span 
                            className="cursor-pointer hover:bg-pink-200 px-1 rounded block truncate"
                            onClick={() => openSemaineABCModal({ type: 'employe', employe: secretaire })}
                            title={`${secretaire.prenom} ${secretaire.nom} - Cliquer pour appliquer Semaine A, B ou Congés`}
                          >
                            {abbreviateName(secretaire.prenom, secretaire.nom)}
                          </span>
                        </td>
                        {planningTableau.dates.map((date, dateIndex) => {
                          const creneauMatin = getCreneauForEmploye(secretaire.id, date, 'MATIN');
                          const creneauAM = getCreneauForEmploye(secretaire.id, date, 'APRES_MIDI');
                          const congesApprouvesDate = getCongesForEmployeDate(secretaire.id, date);
                          const congesEnAttenteDate = getCongesEnAttenteForEmployeDate(secretaire.id, date);
                          const hasCongeApprouve = congesApprouvesDate.length > 0;
                          const hasCongeEnAttente = congesEnAttenteDate.length > 0;
                          const congeApprouve = congesApprouvesDate[0];
                          const congeEnAttente = congesEnAttenteDate[0];
                          
                          return (
                            <React.Fragment key={`${secretaire.id}-${date}`}>
                              {/* Cellule MATIN - Congé ou créneau */}
                              <td 
                                className={`border p-1 text-center cursor-pointer transition-colors ${
                                  hasCongeEnAttente ? 'bg-yellow-200 hover:bg-yellow-300' :
                                  hasCongeApprouve ? getCongeColorClasses(congeApprouve.type_conge, true) :
                                  creneauMatin ? 'bg-pink-200 hover:bg-pink-300' : 
                                  dateIndex % 2 === 0 ? 'bg-white hover:bg-pink-100' : 'bg-gray-50 hover:bg-pink-100'
                                }`}
                                onClick={() => {
                                  if (hasCongeEnAttente) return; // Les boutons gèrent les actions
                                  openJourneeModal(secretaire, date);
                                }}
                                title={
                                  hasCongeEnAttente ? `⏳ Demande de congé en attente - ${congeEnAttente.motif || 'Pas de motif'}` :
                                  hasCongeApprouve ? `🏖️ ${getTypeCongeShortLabel(congeApprouve.type_conge)} - Cliquer pour modifier` :
                                  creneauMatin ? `📝 ${creneauMatin.horaire_debut || ''} - ${creneauMatin.horaire_fin || ''}` : '📅 Ajouter'
                                }
                              >
                                {hasCongeEnAttente ? (
                                  <div className="flex flex-col items-center space-y-1">
                                    <span className="text-xs font-bold text-yellow-800">⏳ {getTypeCongeShortLabel(congeEnAttente.type_conge)}</span>
                                    <div className="flex space-x-1">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleApprouverCongeRapide(congeEnAttente); }}
                                        className="text-xs px-1 bg-green-500 text-white rounded hover:bg-green-600"
                                        title="Approuver"
                                      >✓</button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleRefuserCongeRapide(congeEnAttente); }}
                                        className="text-xs px-1 bg-red-500 text-white rounded hover:bg-red-600"
                                        title="Refuser"
                                      >✗</button>
                                    </div>
                                  </div>
                                ) : hasCongeApprouve ? (
                                  <span className={`text-xs font-bold ${getCongeColorClasses(congeApprouve.type_conge, false)}`}>
                                    {getTypeCongeShortLabel(congeApprouve.type_conge)}
                                  </span>
                                ) : creneauMatin ? (
                                  <div className="text-xs leading-tight">
                                    <div className="font-semibold">{creneauMatin.horaire_debut?.substring(0,5)}</div>
                                    <div className="text-gray-400">-</div>
                                    <div className="font-semibold">{creneauMatin.horaire_pause_debut?.substring(0,5) || creneauMatin.horaire_fin?.substring(0,5)}</div>
                                  </div>
                                ) : <span className="text-gray-300">+</span>}
                              </td>
                              {/* Cellule APRES-MIDI - Congé ou créneau */}
                              <td 
                                className={`border p-1 text-center cursor-pointer transition-colors ${
                                  hasCongeEnAttente ? 'bg-yellow-200 hover:bg-yellow-300' :
                                  hasCongeApprouve ? getCongeColorClasses(congeApprouve.type_conge, true) :
                                  creneauAM ? 'bg-pink-200 hover:bg-pink-300' : 
                                  dateIndex % 2 === 0 ? 'bg-white hover:bg-pink-100' : 'bg-gray-50 hover:bg-pink-100'
                                }`}
                                onClick={() => {
                                  if (hasCongeEnAttente) return;
                                  openJourneeModal(secretaire, date);
                                }}
                                title={
                                  hasCongeEnAttente ? `⏳ Demande en attente` :
                                  hasCongeApprouve ? `🏖️ ${getTypeCongeShortLabel(congeApprouve.type_conge)} - Cliquer pour modifier` :
                                  creneauAM ? `📝 ${creneauAM.horaire_debut || ''} - ${creneauAM.horaire_fin || ''}` : '📅 Ajouter'
                                }
                              >
                                {hasCongeEnAttente ? (
                                  <span className="text-xs font-bold text-yellow-800">⏳</span>
                                ) : hasCongeApprouve ? (
                                  <span className={`text-xs font-bold ${getCongeColorClasses(congeApprouve.type_conge, false)}`}>
                                    {getTypeCongeShortLabel(congeApprouve.type_conge)}
                                  </span>
                                ) : creneauAM ? (
                                  <div className="text-xs leading-tight">
                                    <div className="font-semibold">{creneauAM.horaire_pause_fin?.substring(0,5) || creneauAM.horaire_debut?.substring(0,5)}</div>
                                    <div className="text-gray-400">-</div>
                                    <div className="font-semibold">{creneauAM.horaire_fin?.substring(0,5)}</div>
                                  </div>
                                ) : <span className="text-gray-300">+</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        {/* Colonnes récapitulatives de fin de ligne */}
                        {showRecapColumns && (() => {
                          const heuresContrat = secretaire.heures_semaine_fixe || 35;
                          
                          // Calculer les heures de congés pour cette semaine
                          let heuresCongesPayesSemaine = 0; // Congés payés = comptent comme travail
                          let heuresReposSemaine = 0; // Repos = ne comptent pas
                          let heuresARecupererSemaine = 0; // Heures à récupérer = heures sup positives
                          let heuresRecupereesSemaine = 0; // Heures récupérées = négatif heures sup
                          let nbConges = 0;
                          let nbCongesComptabilises = 0; // Seulement CONGE_PAYE compte comme congé
                          const congesDejaComptes = new Set(); // Éviter de compter le même congé plusieurs fois
                          planningTableau.dates.forEach(date => {
                            const congesJour = getCongesForEmployeDate(secretaire.id, date);
                            congesJour.forEach(conge => {
                              // Créer une clé unique pour ce congé + ce jour
                              const cleConge = `${conge.id}-${date}`;
                              if (congesDejaComptes.has(cleConge)) return;
                              congesDejaComptes.add(cleConge);
                              
                              // Utiliser heures_conge du congé si défini
                              const heuresConge = conge.heures_conge || secretaire.heures_demi_journee_conge || 4;
                              // Déterminer le nombre d'heures pour ce jour
                              // Si demi_journee est true → heuresConge (1 demi-journée)
                              // Si demi_journee est false → heuresConge * 2 (journée complète)
                              const heuresJour = conge.demi_journee ? heuresConge : heuresConge * 2;
                              const nbDemiJ = conge.demi_journee ? 1 : 2;
                              
                              nbConges++;
                              // Gestion des différents types de congés
                              // REPOS : non comptabilisé nulle part
                              // HEURES_A_RECUPERER : heures sup positives (pas heures travail, pas congé)
                              // HEURES_RECUPEREES : heures sup négatives (pas heures travail, pas congé)
                              // CONGE_PAYE : heures travail + congé comptabilisé
                              // CONGE_SANS_SOLDE, MALADIE : heures travail seulement (pas congé)
                              if (conge.type_conge === 'REPOS' || conge.type_conge === 'REPOS_COMPENSATEUR') {
                                // Repos = ne comptent pas du tout
                                heuresReposSemaine += heuresJour;
                              } else if (conge.type_conge === 'HEURES_A_RECUPERER') {
                                // Heures à récupérer = heures sup positives (PAS heures travail, PAS congé)
                                heuresARecupererSemaine += heuresJour;
                              } else if (conge.type_conge === 'HEURES_RECUPEREES') {
                                // Heures récupérées = négatif heures sup (PAS heures travail, PAS congé)
                                heuresRecupereesSemaine += heuresJour;
                              } else if (conge.type_conge === 'CONGE_PAYE') {
                                // Congé payé = compte comme heures travail + congé comptabilisé
                                heuresCongesPayesSemaine += heuresJour;
                                nbCongesComptabilises += nbDemiJ;
                              } else {
                                // MALADIE, CONGE_SANS_SOLDE = comptent comme heures travail SEULEMENT (pas comme congé)
                                heuresCongesPayesSemaine += heuresJour;
                              }
                            });
                          });
                          
                          // Heures effectives + congés payés (les congés payés comptent comme du travail)
                          const heuresAvecConges = heures + heuresCongesPayesSemaine;
                          
                          // Calcul différence heures (avec congés payés) vs contrat
                          const diffHeures = heuresAvecConges - heuresContrat;
                          
                          // Heures supp/récup de cette semaine
                          // HEURES_A_RECUPERER ajoute aux heures sup
                          // HEURES_RECUPEREES retire des heures sup
                          const heuresSupSemaine = diffHeures + heuresARecupererSemaine - heuresRecupereesSemaine;
                          
                          // Couleur colonne Contrat: Jaune=égal, Vert=moins(récup), Rouge=plus(sup)
                          const getCouleurContrat = (effectuees, contrat) => {
                            if (Math.abs(effectuees - contrat) < 0.5) return 'bg-yellow-200 text-yellow-800';
                            return effectuees < contrat ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800';
                          };
                          
                          const getCouleur = (val, cible) => {
                            if (Math.abs(val - cible) < 0.5) return 'bg-yellow-100';
                            return val < cible ? 'bg-green-100' : 'bg-red-100';
                          };
                          return (
                            <>
                              <td className={`border p-1 text-center text-xs font-bold ${getCouleur(total, 10)}`}>{total}</td>
                              <td className={`border p-1 text-center text-xs font-bold ${getCouleur(heuresAvecConges, heuresContrat)}`}>{heures}h{heuresCongesPayesSemaine > 0 ? <span className="text-green-600">+{heuresCongesPayesSemaine}</span> : ''}</td>
                              <td className={`border p-1 text-center text-xs font-bold ${getCouleurContrat(heuresAvecConges, heuresContrat)}`}>
                                {heuresContrat}h
                              </td>
                              <td className={`border p-1 text-center text-xs font-bold ${heuresSupSemaine > 0 ? 'text-orange-600 bg-orange-50' : heuresSupSemaine < 0 ? 'text-blue-600 bg-blue-50' : ''}`}>
                                {heuresSupSemaine > 0 ? '+' : ''}{heuresSupSemaine.toFixed(1)}h
                              </td>
                              {(() => {
                                const heuresSupMois = getHeuresSupMois(secretaire.id);
                                const heuresSupAnnee = getHeuresSupAnnee(secretaire.id);
                                return (
                                  <>
                                    <td className={`border p-1 text-center text-xs font-bold ${heuresSupMois > 0 ? 'text-orange-600 bg-orange-50' : heuresSupMois < 0 ? 'text-blue-600 bg-blue-50' : ''}`} title="Mois">
                                      {heuresSupMois > 0 ? '+' : ''}{heuresSupMois.toFixed(1)}h
                                    </td>
                                    <td className={`border p-1 text-center text-xs font-bold ${heuresSupAnnee > 0 ? 'text-orange-600 bg-orange-50' : heuresSupAnnee < 0 ? 'text-blue-600 bg-blue-50' : ''}`} title="Année">
                                      {heuresSupAnnee > 0 ? '+' : ''}{heuresSupAnnee.toFixed(1)}h
                                    </td>
                                  </>
                                );
                              })()}
                              <td className={`border p-1 text-center text-xs font-bold ${nbCongesComptabilises > 0 ? 'bg-green-200 text-green-800' : 'bg-green-50'}`}>{nbCongesComptabilises > 0 ? `${nbCongesComptabilises}½j` : '0'}</td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })}

                  {/* SECTION ASSISTANTS */}
                  <tr className="bg-green-100">
                    <td 
                      className="border p-1 font-bold text-green-800 cursor-pointer hover:bg-green-200 text-xs"
                      onClick={() => openSemaineABCModal({ type: 'section', section: 'Assistant' })}
                      title="Cliquer pour appliquer Semaine A, B ou Congés"
                    >
                      👥 ASSISTANTS
                    </td>
                    {planningTableau.dates.map((date, dateIndex) => (
                      <td 
                        key={`ass-header-${date}`}
                        colSpan={2} 
                        className={`border p-1 text-center text-xs font-medium ${dateIndex % 2 === 0 ? 'bg-green-50' : 'bg-green-100'}`}
                      >
                        <div>{new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                        <div className="text-gray-500">{new Date(date + 'T12:00:00').getDate()}/{new Date(date + 'T12:00:00').getMonth() + 1}</div>
                      </td>
                    ))}
                    {showRecapColumns && (
                      <>
                        <td className="border p-1 bg-green-100 text-xs text-center font-bold">½j</td>
                        <td className="border p-1 bg-green-100 text-xs text-center font-bold">H</td>
                        <td className="border p-1 bg-green-100 text-xs text-center font-bold">Ctr</td>
                        <td className="border p-1 bg-green-100 text-xs text-center font-bold" title="Heures supp/récup Semaine">+/- S</td>
                        <td className="border p-1 bg-green-100 text-xs text-center font-bold" title="Heures supp/récup Mois">+/- M</td>
                        <td className="border p-1 bg-green-100 text-xs text-center font-bold" title="Heures supp/récup Année">+/- A</td>
                        <td className="border p-1 bg-green-100 text-xs text-center font-bold">Cg</td>
                      </>
                    )}
                  </tr>
                  {sortEmployeesByRoleThenName(users.filter(u => u.actif && u.role === 'Assistant')).map(assistant => {
                    const total = getTotalDemiJournees(assistant.id);
                    const heures = getTotalHeures(assistant.id);
                    return (
                      <tr key={assistant.id} className="hover:bg-green-50">
                        <td 
                          className="border p-1 font-medium text-xs col-employe overflow-hidden"
                        >
                          <span 
                            className="cursor-pointer hover:bg-green-200 px-1 rounded block truncate"
                            onClick={() => openSemaineABCModal({ type: 'employe', employe: assistant })}
                            title={`${assistant.prenom} ${assistant.nom} - Cliquer pour appliquer Semaine A, B ou Congés`}
                          >
                            {abbreviateName(assistant.prenom, assistant.nom)}
                          </span>
                        </td>
                        {planningTableau.dates.map((date, dateIndex) => {
                          const creneauMatin = getCreneauForEmploye(assistant.id, date, 'MATIN');
                          const creneauAM = getCreneauForEmploye(assistant.id, date, 'APRES_MIDI');
                          const displayMatin = getAssistantDisplay(creneauMatin);
                          const displayAM = getAssistantDisplay(creneauAM);
                          const congesApprouvesDate = getCongesForEmployeDate(assistant.id, date);
                          const congesEnAttenteDate = getCongesEnAttenteForEmployeDate(assistant.id, date);
                          const hasCongeApprouve = congesApprouvesDate.length > 0;
                          const hasCongeEnAttente = congesEnAttenteDate.length > 0;
                          const congeApprouve = congesApprouvesDate[0];
                          const congeEnAttente = congesEnAttenteDate[0];
                          
                          return (
                            <React.Fragment key={`${assistant.id}-${date}`}>
                              {/* Cellule MATIN - Congé ou créneau */}
                              <td 
                                className={`border p-1 text-center cursor-pointer transition-colors ${
                                  hasCongeEnAttente ? 'bg-yellow-200 hover:bg-yellow-300' :
                                  hasCongeApprouve ? getCongeColorClasses(congeApprouve.type_conge, true) :
                                  creneauMatin ? 'bg-green-200 hover:bg-green-300' : 
                                  dateIndex % 2 === 0 ? 'bg-white hover:bg-green-100' : 'bg-gray-50 hover:bg-green-100'
                                }`}
                                onClick={() => {
                                  if (hasCongeEnAttente) return;
                                  openJourneeModal(assistant, date);
                                }}
                                title={
                                  hasCongeEnAttente ? `⏳ Demande de congé en attente - ${congeEnAttente.motif || ''}` :
                                  hasCongeApprouve ? `🏖️ ${getTypeCongeShortLabel(congeApprouve.type_conge)} - Cliquer pour modifier` :
                                  creneauMatin ? `📝 ${displayMatin || 'Présent'}` : '📅 Ajouter'
                                }
                              >
                                {hasCongeEnAttente ? (
                                  <div className="flex flex-col items-center space-y-1">
                                    <span className="text-xs font-bold text-yellow-800">⏳ {getTypeCongeShortLabel(congeEnAttente.type_conge)}</span>
                                    <div className="flex space-x-1">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleApprouverCongeRapide(congeEnAttente); }}
                                        className="text-xs px-1 bg-green-500 text-white rounded hover:bg-green-600"
                                        title="Approuver"
                                      >✓</button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleRefuserCongeRapide(congeEnAttente); }}
                                        className="text-xs px-1 bg-red-500 text-white rounded hover:bg-red-600"
                                        title="Refuser"
                                      >✗</button>
                                    </div>
                                  </div>
                                ) : hasCongeApprouve ? (
                                  <span className={`text-xs font-bold ${getCongeColorClasses(congeApprouve.type_conge, false)}`}>
                                    {getTypeCongeShortLabel(congeApprouve.type_conge)}
                                  </span>
                                ) : creneauMatin ? (
                                  <span className="text-xs font-semibold text-green-700">{displayMatin || 'Présent'}</span>
                                ) : <span className="text-gray-300">+</span>}
                              </td>
                              {/* Cellule APRES-MIDI */}
                              <td 
                                className={`border p-1 text-center cursor-pointer transition-colors ${
                                  hasCongeEnAttente ? 'bg-yellow-200 hover:bg-yellow-300' :
                                  hasCongeApprouve ? getCongeColorClasses(congeApprouve.type_conge, true) :
                                  creneauAM ? 'bg-green-200 hover:bg-green-300' : 
                                  dateIndex % 2 === 0 ? 'bg-white hover:bg-green-100' : 'bg-gray-50 hover:bg-green-100'
                                }`}
                                onClick={() => {
                                  if (hasCongeEnAttente) return;
                                  openJourneeModal(assistant, date);
                                }}
                                title={
                                  hasCongeEnAttente ? `⏳ Demande en attente` :
                                  hasCongeApprouve ? `🏖️ ${getTypeCongeShortLabel(congeApprouve.type_conge)} - Cliquer pour modifier` :
                                  creneauAM ? `📝 ${displayAM || 'Présent'}` : '📅 Ajouter'
                                }
                              >
                                {hasCongeEnAttente ? (
                                  <span className="text-xs font-bold text-yellow-800">⏳</span>
                                ) : hasCongeApprouve ? (
                                  <span className={`text-xs font-bold ${getCongeColorClasses(congeApprouve.type_conge, false)}`}>
                                    {getTypeCongeShortLabel(congeApprouve.type_conge)}
                                  </span>
                                ) : creneauAM ? (
                                  <span className="text-xs font-semibold text-green-700">{displayAM || 'Présent'}</span>
                                ) : <span className="text-gray-300">+</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        {/* Colonnes récapitulatives de fin de ligne - Assistants */}
                        {showRecapColumns && (() => {
                          const demiJourneesSemaine = semaineAffichee === 'A' ? (assistant.limite_demi_journees_a || 10) : (assistant.limite_demi_journees_b || 10);
                          const heuresContrat = assistant.heures_semaine_fixe || (demiJourneesSemaine * 4);
                          
                          // Calculer les demi-journées de congés pour cette semaine
                          let nbCongesPayesSemaine = 0; // Congés = comptent comme travail (en demi-journées)
                          let nbReposSemaine = 0; // Repos = ne comptent pas (en demi-journées)
                          let nbCongesComptabilises = 0; // Seulement CONGE_PAYE compte comme congé
                          let heuresARecupererSemaine = 0; // Heures à récupérer
                          let heuresRecupereesSemaine = 0; // Heures récupérées
                          const congesDejaComptes = new Set(); // Éviter de compter le même congé plusieurs fois
                          planningTableau.dates.forEach(date => {
                            const congesJour = getCongesForEmployeDate(assistant.id, date);
                            congesJour.forEach(conge => {
                              // Créer une clé unique pour ce congé + ce jour
                              const cleConge = `${conge.id}-${date}`;
                              if (congesDejaComptes.has(cleConge)) return;
                              congesDejaComptes.add(cleConge);
                              
                              // Utiliser heures_conge du congé si défini
                              const heuresConge = conge.heures_conge || assistant.heures_demi_journee_conge || 4;
                              // Déterminer le nombre de demi-journées et heures pour ce jour
                              const demiJourneesJour = conge.demi_journee ? 1 : 2;
                              const heuresJour = conge.demi_journee ? heuresConge : heuresConge * 2;
                              
                              // REPOS : non comptabilisé nulle part
                              // HEURES_A_RECUPERER : heures sup positives (pas heures travail, pas congé)
                              // HEURES_RECUPEREES : heures sup négatives (pas heures travail, pas congé)
                              // CONGE_PAYE : heures travail + congé comptabilisé
                              // CONGE_SANS_SOLDE, MALADIE : heures travail seulement (pas congé)
                              if (conge.type_conge === 'REPOS' || conge.type_conge === 'REPOS_COMPENSATEUR') {
                                // Repos = ne comptent pas du tout
                                nbReposSemaine += demiJourneesJour;
                              } else if (conge.type_conge === 'HEURES_A_RECUPERER') {
                                // Heures à récupérer = heures sup positives (PAS heures travail, PAS congé)
                                heuresARecupererSemaine += heuresJour;
                              } else if (conge.type_conge === 'HEURES_RECUPEREES') {
                                // Heures récupérées = négatif heures sup (PAS heures travail, PAS congé)
                                heuresRecupereesSemaine += heuresJour;
                              } else if (conge.type_conge === 'CONGE_PAYE') {
                                // Congé payé = heures travail + congé comptabilisé
                                nbCongesPayesSemaine += demiJourneesJour;
                                nbCongesComptabilises += demiJourneesJour;
                              } else {
                                // MALADIE, CONGE_SANS_SOLDE = heures travail SEULEMENT (pas congé)
                                nbCongesPayesSemaine += demiJourneesJour;
                              }
                            });
                          });
                          
                          // Heures des congés payés (comptent comme travail)
                          // heures_demi_journee_conge est le nombre d'heures par DEMI-JOURNÉE de congé
                          const heuresCongesPayes = nbCongesPayesSemaine * (assistant.heures_demi_journee_conge || 4);
                          const heuresAvecConges = heures + heuresCongesPayes;
                          
                          // Calcul différence heures (avec congés payés) vs contrat
                          const diffHeures = heuresAvecConges - heuresContrat;
                          
                          // Heures supp/récup de cette semaine
                          // HEURES_A_RECUPERER ajoute aux heures sup
                          // HEURES_RECUPEREES retire des heures sup
                          const heuresSupSemaine = diffHeures + heuresARecupererSemaine - heuresRecupereesSemaine;
                          
                          // Couleur colonne Contrat: Jaune=égal, Vert=moins(récup), Rouge=plus(sup)
                          const getCouleurContrat = (effectuees, contrat) => {
                            if (Math.abs(effectuees - contrat) < 0.5) return 'bg-yellow-200 text-yellow-800';
                            return effectuees < contrat ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800';
                          };
                          
                          const getCouleur = (val, cible) => {
                            if (Math.abs(val - cible) < 0.5) return 'bg-yellow-100';
                            return val < cible ? 'bg-green-100' : 'bg-red-100';
                          };
                          return (
                            <>
                              <td className={`border p-1 text-center text-xs font-bold ${getCouleur(total, demiJourneesSemaine)}`}>{total}</td>
                              <td className={`border p-1 text-center text-xs font-bold ${getCouleur(heuresAvecConges, heuresContrat)}`}>{heures}h{heuresCongesPayes > 0 ? <span className="text-green-600">+{heuresCongesPayes}</span> : ''}</td>
                              <td className={`border p-1 text-center text-xs font-bold ${getCouleurContrat(heuresAvecConges, heuresContrat)}`}>
                                {heuresContrat}h
                              </td>
                              <td className={`border p-1 text-center text-xs font-bold ${heuresSupSemaine > 0 ? 'text-orange-600 bg-orange-50' : heuresSupSemaine < 0 ? 'text-blue-600 bg-blue-50' : ''}`}>
                                {heuresSupSemaine > 0 ? '+' : ''}{heuresSupSemaine.toFixed(1)}h
                              </td>
                              {(() => {
                                const heuresSupMois = getHeuresSupMois(assistant.id);
                                const heuresSupAnnee = getHeuresSupAnnee(assistant.id);
                                return (
                                  <>
                                    <td className={`border p-1 text-center text-xs font-bold ${heuresSupMois > 0 ? 'text-orange-600 bg-orange-50' : heuresSupMois < 0 ? 'text-blue-600 bg-blue-50' : ''}`} title="Mois">
                                      {heuresSupMois > 0 ? '+' : ''}{heuresSupMois.toFixed(1)}h
                                    </td>
                                    <td className={`border p-1 text-center text-xs font-bold ${heuresSupAnnee > 0 ? 'text-orange-600 bg-orange-50' : heuresSupAnnee < 0 ? 'text-blue-600 bg-blue-50' : ''}`} title="Année">
                                      {heuresSupAnnee > 0 ? '+' : ''}{heuresSupAnnee.toFixed(1)}h
                                    </td>
                                  </>
                                );
                              })()}
                              <td className={`border p-1 text-center text-xs font-bold ${nbCongesComptabilises > 0 ? 'bg-green-200 text-green-800' : 'bg-green-50'}`}>{nbCongesComptabilises > 0 ? `${nbCongesComptabilises}½j` : '0'}</td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })}

                  {/* SECTION MÉDECINS */}
                  <tr className="bg-blue-100">
                    <td 
                      className="border p-1 font-bold text-blue-800 cursor-pointer hover:bg-blue-200 text-xs"
                      onClick={() => openSemaineABCModal({ type: 'section', section: 'Médecin' })}
                      title="Cliquer pour appliquer Semaine A, B ou Congés"
                    >
                      👨‍⚕️ MÉDECINS
                    </td>
                    {planningTableau.dates.map((date, dateIndex) => (
                      <td 
                        key={`med-header-${date}`}
                        colSpan={2} 
                        className={`border p-1 text-center text-xs font-medium ${dateIndex % 2 === 0 ? 'bg-blue-50' : 'bg-blue-100'}`}
                      >
                        <div>{new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                        <div className="text-gray-500">{new Date(date + 'T12:00:00').getDate()}/{new Date(date + 'T12:00:00').getMonth() + 1}</div>
                      </td>
                    ))}
                    {showRecapColumns && (
                      <>
                        <td className="border p-1 bg-blue-100 text-xs text-center font-bold">½j</td>
                        <td className="border p-1 bg-blue-100 text-xs text-center font-bold">H</td>
                        <td className="border p-1 bg-blue-100 text-xs text-center font-bold">+/-</td>
                        <td className="border p-1 bg-blue-100"></td>
                        <td className="border p-1 bg-blue-100"></td>
                        <td className="border p-1 bg-blue-100"></td>
                        <td className="border p-1 bg-blue-100"></td>
                      </>
                    )}
                  </tr>
                  {sortEmployeesByRoleThenName(users.filter(u => u.actif && u.role === 'Médecin')).map(medecin => {
                    const total = getTotalDemiJournees(medecin.id);
                    const heures = getTotalHeures(medecin.id);
                    return (
                      <tr key={medecin.id} className="hover:bg-blue-50">
                        <td 
                          className="border p-1 font-medium text-xs col-employe overflow-hidden"
                        >
                          <span 
                            className="cursor-pointer hover:bg-blue-200 px-1 rounded block truncate"
                            onClick={() => openSemaineABCModal({ type: 'employe', employe: medecin })}
                            title={`Dr. ${medecin.prenom} ${medecin.nom} - Cliquer pour appliquer Semaine A, B ou Congés`}
                          >
                            Dr. {abbreviateName(medecin.prenom, medecin.nom)}
                          </span>
                        </td>
                        {planningTableau.dates.map((date, dateIndex) => {
                          const creneauMatin = getCreneauForEmploye(medecin.id, date, 'MATIN');
                          const creneauAM = getCreneauForEmploye(medecin.id, date, 'APRES_MIDI');
                          const displayMatin = getMedecinDisplay(creneauMatin, 'M');
                          const displayAM = getMedecinDisplay(creneauAM, 'AM');
                          const hasAssistantMatin = medecinHasAssistant(medecin.id, date, 'MATIN');
                          const hasAssistantAM = medecinHasAssistant(medecin.id, date, 'APRES_MIDI');
                          
                          // Demandes de créneaux en attente pour ce médecin
                          const demandesEnAttente = getDemandesCreneauxEnAttenteForDate(medecin.id, date);
                          const demandeMatinEnAttente = demandesEnAttente.find(d => d.creneau === 'MATIN' || d.creneau === 'JOURNEE_COMPLETE');
                          const demandeAMEnAttente = demandesEnAttente.find(d => d.creneau === 'APRES_MIDI' || d.creneau === 'JOURNEE_COMPLETE');
                          
                          return (
                            <React.Fragment key={`${medecin.id}-${date}`}>
                              {/* Cellule MATIN - Demande en attente ou créneau */}
                              <td 
                                className={`border p-1 text-center cursor-pointer transition-colors ${
                                  demandeMatinEnAttente ? 'bg-yellow-200 hover:bg-yellow-300' :
                                  creneauMatin 
                                    ? hasAssistantMatin 
                                      ? 'bg-indigo-300 hover:bg-indigo-400' 
                                      : 'bg-blue-200 hover:bg-blue-300'
                                    : dateIndex % 2 === 0 ? 'bg-white hover:bg-blue-100' : 'bg-gray-50 hover:bg-blue-100'
                                }`}
                                onClick={() => {
                                  if (demandeMatinEnAttente) return; // Les boutons gèrent
                                  openJourneeModal(medecin, date);
                                }}
                                title={
                                  demandeMatinEnAttente 
                                    ? `⏳ Demande de créneau en attente - ${demandeMatinEnAttente.motif || 'Pas de motif'}` 
                                    : creneauMatin 
                                      ? `📝 ${displayMatin}${hasAssistantMatin ? ' ✓ Avec assistant' : ' ⚠ Sans assistant'}` 
                                      : '📅 Ajouter'
                                }
                              >
                                {demandeMatinEnAttente ? (
                                  <div className="flex flex-col items-center space-y-1">
                                    <span className="text-xs font-bold text-yellow-800">⏳ {demandeMatinEnAttente.creneau === 'JOURNEE_COMPLETE' ? 'JC' : 'M'}</span>
                                    <div className="flex space-x-1">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleApprouverDemandeTravailRapide(demandeMatinEnAttente); }}
                                        className="text-xs px-1 bg-green-500 text-white rounded hover:bg-green-600"
                                        title="Approuver"
                                      >✓</button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleRefuserDemandeTravailRapide(demandeMatinEnAttente); }}
                                        className="text-xs px-1 bg-red-500 text-white rounded hover:bg-red-600"
                                        title="Refuser"
                                      >✗</button>
                                    </div>
                                  </div>
                                ) : creneauMatin ? (
                                  <span className={`text-xs font-semibold ${hasAssistantMatin ? 'text-indigo-900' : 'text-blue-700'}`}>{displayMatin}</span>
                                ) : <span className="text-gray-300">+</span>}
                              </td>
                              {/* Cellule APRES-MIDI */}
                              <td 
                                className={`border p-1 text-center cursor-pointer transition-colors ${
                                  demandeAMEnAttente && !demandeMatinEnAttente ? 'bg-yellow-200 hover:bg-yellow-300' :
                                  demandeAMEnAttente && demandeMatinEnAttente && demandeAMEnAttente.id === demandeMatinEnAttente.id ? 'bg-yellow-200 hover:bg-yellow-300' :
                                  creneauAM 
                                    ? hasAssistantAM 
                                      ? 'bg-indigo-300 hover:bg-indigo-400' 
                                      : 'bg-blue-200 hover:bg-blue-300'
                                    : dateIndex % 2 === 0 ? 'bg-white hover:bg-blue-100' : 'bg-gray-50 hover:bg-blue-100'
                                }`}
                                onClick={() => {
                                  if (demandeAMEnAttente) return;
                                  openJourneeModal(medecin, date);
                                }}
                                title={
                                  demandeAMEnAttente 
                                    ? `⏳ Demande en attente` 
                                    : creneauAM 
                                      ? `📝 ${displayAM}${hasAssistantAM ? ' ✓ Avec assistant' : ' ⚠ Sans assistant'}` 
                                      : '📅 Ajouter'
                                }
                              >
                                {demandeAMEnAttente && (!demandeMatinEnAttente || demandeAMEnAttente.id !== demandeMatinEnAttente.id) ? (
                                  <div className="flex flex-col items-center space-y-1">
                                    <span className="text-xs font-bold text-yellow-800">⏳ AM</span>
                                    <div className="flex space-x-1">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleApprouverDemandeTravailRapide(demandeAMEnAttente); }}
                                        className="text-xs px-1 bg-green-500 text-white rounded hover:bg-green-600"
                                        title="Approuver"
                                      >✓</button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleRefuserDemandeTravailRapide(demandeAMEnAttente); }}
                                        className="text-xs px-1 bg-red-500 text-white rounded hover:bg-red-600"
                                        title="Refuser"
                                      >✗</button>
                                    </div>
                                  </div>
                                ) : demandeAMEnAttente && demandeMatinEnAttente && demandeAMEnAttente.id === demandeMatinEnAttente.id ? (
                                  <span className="text-xs font-bold text-yellow-800">⏳</span>
                                ) : creneauAM ? (
                                  <span className={`text-xs font-semibold ${hasAssistantAM ? 'text-indigo-900' : 'text-blue-700'}`}>{displayAM}</span>
                                ) : <span className="text-gray-300">+</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        {/* Colonnes récapitulatives de fin de ligne - Médecins */}
                        {showRecapColumns && (() => {
                          const demiJourneesSemaine = semaineAffichee === 'A' ? (medecin.limite_demi_journees_a || 10) : (medecin.limite_demi_journees_b || 10);
                          
                          // Cumul stocké (solde depuis début d'année)
                          const cumulHeuresSupRecup = medecin.heures_supplementaires || 0;
                          
                          const getCouleur = (val, cible) => {
                            if (Math.abs(val - cible) < 0.5) return 'bg-yellow-100';
                            return val < cible ? 'bg-green-100' : 'bg-red-100';
                          };
                          return (
                            <>
                              <td className={`border p-1 text-center text-xs font-bold ${getCouleur(total, demiJourneesSemaine)}`}>{total}/{demiJourneesSemaine}</td>
                              <td className="border p-1 text-center text-xs font-bold bg-blue-50">{heures}h</td>
                              <td className={`border p-1 text-center text-xs font-bold ${cumulHeuresSupRecup >= 0 ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'}`}>
                                {cumulHeuresSupRecup >= 0 ? '+' : ''}{cumulHeuresSupRecup.toFixed(1)}h
                              </td>
                              <td className="border p-1 text-center text-xs bg-gray-50">-</td>
                              <td className="border p-1 text-center text-xs bg-gray-50">-</td>
                              <td className="border p-1 text-center text-xs bg-gray-50">-</td>
                              <td className="border p-1 text-center text-xs bg-gray-50">-</td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })}

                  {/* LIGNE TOTAL MÉDECINS */}
                  <tr className="bg-gray-200 font-bold">
                    <td className="border p-1 text-xs">TOTAL MÉDECINS</td>
                    {planningTableau.dates.map(date => {
                      const totalMatin = countMedecinsForCreneau(date, 'MATIN');
                      const totalAM = countMedecinsForCreneau(date, 'APRES_MIDI');
                      return (
                        <React.Fragment key={`total-${date}`}>
                          <td className={`border p-1 text-center text-xs ${getTotalColor(totalMatin, 'medecins')}`}>
                            {totalMatin}
                          </td>
                          <td className={`border p-1 text-center text-xs ${getTotalColor(totalAM, 'medecins')}`}>
                            {totalAM}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    {showRecapColumns && (
                      <>
                        <td className="border p-1 text-center text-xs bg-gray-300">
                          {planningTableau.dates.reduce((sum, date) => 
                            sum + countMedecinsForCreneau(date, 'MATIN') + countMedecinsForCreneau(date, 'APRES_MIDI'), 0
                          )}
                        </td>
                        <td className="border p-1 text-center bg-gray-300"></td>
                        <td className="border p-1 text-center bg-gray-300"></td>
                        <td className="border p-1 text-center bg-gray-300"></td>
                        <td className="border p-1 text-center bg-gray-300"></td>
                        <td className="border p-1 text-center bg-gray-300"></td>
                        <td className="border p-1 text-center bg-gray-300"></td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
              </div>
            )}

            {/* Légende */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-100 rounded border"></div>
                <span>&lt; limite</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-100 rounded border"></div>
                <span>= limite</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-100 rounded border"></div>
                <span>&gt; limite</span>
              </div>
              <div className="flex items-center space-x-2 ml-4 border-l pl-4">
                <div className="w-4 h-4 bg-yellow-200 rounded border border-yellow-400"></div>
                <span>⏳ Demande en attente</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-200 rounded border border-red-400"></div>
                <span>🏖️ Congé payé (seul comptabilisé)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-200 rounded border border-orange-400"></div>
                <span>😴 Repos (non comptabilisé)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-pink-200 rounded border border-pink-400"></div>
                <span>🏥 Maladie/Sans solde (heures, pas congé)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-indigo-300 rounded border border-indigo-400"></div>
                <span>✓ Médecin avec assistant</span>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              💡 Médecins: {configurationPlanning?.limite_demi_journees_medecin || 6} demi-journées | 
              Assistants: {configurationPlanning?.limite_demi_journees_assistant || 8} demi-journées | 
              Secrétaires: {configurationPlanning?.limite_demi_journees_secretaire || 10} demi-journées | 
              Box: {salles.filter(s => s.type_salle === 'MEDECIN').length || 6}
            </div>

            {/* Horaires prédéfinis pour les secrétaires */}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">🕐 Horaires prédéfinis secrétaires</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowHorairesConfig(!showHorairesConfig)}
                >
                  {showHorairesConfig ? 'Masquer' : 'Configurer'}
                </Button>
              </div>
              
              {/* Affichage rapide des horaires */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {horairesSecretaires.map(horaire => (
                  <div key={horaire.id} className="bg-pink-50 border border-pink-200 rounded p-2 text-xs">
                    <div className="font-semibold text-pink-700">{horaire.nom}</div>
                    <div className="text-gray-600">
                      {horaire.debut_matin && horaire.fin_matin && (
                        <span>Matin: {horaire.debut_matin}-{horaire.fin_matin}</span>
                      )}
                      {horaire.debut_matin && horaire.fin_matin && horaire.debut_aprem && horaire.fin_aprem && ' | '}
                      {horaire.debut_aprem && horaire.fin_aprem && (
                        <span>Après-midi: {horaire.debut_aprem}-{horaire.fin_aprem}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Formulaire de configuration */}
              {showHorairesConfig && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  {horairesSecretaires.map((horaire, index) => (
                    <div key={horaire.id} className="bg-white border rounded p-3">
                      <div className="grid grid-cols-5 gap-2 items-end">
                        <div>
                          <Label className="text-xs">Nom</Label>
                          <Input
                            value={horaire.nom}
                            onChange={(e) => {
                              const newHoraires = [...horairesSecretaires];
                              newHoraires[index].nom = e.target.value;
                              saveHorairesSecretaires(newHoraires);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Début matin</Label>
                          <Input
                            type="time"
                            value={horaire.debut_matin}
                            onChange={(e) => {
                              const newHoraires = [...horairesSecretaires];
                              newHoraires[index].debut_matin = e.target.value;
                              saveHorairesSecretaires(newHoraires);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fin matin</Label>
                          <Input
                            type="time"
                            value={horaire.fin_matin}
                            onChange={(e) => {
                              const newHoraires = [...horairesSecretaires];
                              newHoraires[index].fin_matin = e.target.value;
                              saveHorairesSecretaires(newHoraires);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Début après-midi</Label>
                          <Input
                            type="time"
                            value={horaire.debut_aprem}
                            onChange={(e) => {
                              const newHoraires = [...horairesSecretaires];
                              newHoraires[index].debut_aprem = e.target.value;
                              saveHorairesSecretaires(newHoraires);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fin après-midi</Label>
                          <Input
                            type="time"
                            value={horaire.fin_aprem}
                            onChange={(e) => {
                              const newHoraires = [...horairesSecretaires];
                              newHoraires[index].fin_aprem = e.target.value;
                              saveHorairesSecretaires(newHoraires);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 italic">
                    💡 Laissez les champs vides si l'horaire ne couvre pas le matin ou l'après-midi
                  </p>
                </div>
              )}
            </div>

            {/* Bouton configuration des heures */}
            <div className="mt-4 flex justify-center">
              <Button 
                variant="outline" 
                className="flex items-center gap-2 border-gray-300 hover:bg-gray-100"
                onClick={() => setShowConfigSemainesModal(true)}
              >
                <Settings className="h-4 w-4" />
                ⚙️ Paramétrage des heures contrat
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de création/modification rapide pour Vue Planning */}
      <Dialog open={showQuickCreneauModal} onOpenChange={setShowQuickCreneauModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {quickCreneauData.id 
                ? (quickCreneauData.employe?.role === 'Secrétaire' ? '🕐 Modifier les horaires' : '📝 Modifier le créneau')
                : (quickCreneauData.employe?.role === 'Secrétaire' ? '🕐 Définir les horaires' : '📝 Ajouter un créneau')
              }
            </DialogTitle>
            <DialogDescription>
              {quickCreneauData.employe?.prenom} {quickCreneauData.employe?.nom} - {new Date(quickCreneauData.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {quickCreneauData.employe?.role !== 'Secrétaire' && ` (${quickCreneauData.creneau === 'MATIN' ? 'Matin' : 'Après-midi'})`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickCreneauSubmit} className="space-y-4">
            {quickCreneauData.employe?.role === 'Secrétaire' ? (
              <>
                {/* Sélection rapide des horaires prédéfinis */}
                {!quickCreneauData.id && (
                  <div className="space-y-2">
                    <Label>⚡ Sélection rapide (journée)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {horairesSecretaires.map(horaire => {
                        const hasMatinOrAprem = (horaire.debut_matin && horaire.fin_matin) || (horaire.debut_aprem && horaire.fin_aprem);
                        return hasMatinOrAprem ? (
                          <Button
                            key={horaire.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-auto py-2 hover:bg-pink-50 hover:border-pink-300"
                            onClick={async () => {
                              // Créer les créneaux pour la journée avec cet horaire
                              try {
                                const promises = [];
                                
                                // Créneau matin si défini
                                if (horaire.debut_matin && horaire.fin_matin) {
                                  promises.push(axios.post(`${API}/planning`, {
                                    date: quickCreneauData.date,
                                    creneau: 'MATIN',
                                    employe_id: quickCreneauData.employe_id,
                                    horaire_debut: horaire.debut_matin,
                                    horaire_fin: horaire.fin_matin,
                                    notes: ''
                                  }));
                                }
                                
                                // Créneau après-midi si défini
                                if (horaire.debut_aprem && horaire.fin_aprem) {
                                  promises.push(axios.post(`${API}/planning`, {
                                    date: quickCreneauData.date,
                                    creneau: 'APRES_MIDI',
                                    employe_id: quickCreneauData.employe_id,
                                    horaire_debut: horaire.debut_aprem,
                                    horaire_fin: horaire.fin_aprem,
                                    notes: ''
                                  }));
                                }
                                
                                await Promise.all(promises);
                                toast.success(`${horaire.nom} appliqué pour ${quickCreneauData.employe?.prenom}`);
                                setShowQuickCreneauModal(false);
                                fetchPlanningTableau(selectedWeek);
                              } catch (error) {
                                console.error('Erreur:', error);
                                toast.error(error.response?.data?.detail || 'Erreur lors de la création');
                              }
                            }}
                          >
                            <div className="text-center">
                              <div className="font-semibold">{horaire.nom}</div>
                              <div className="text-[10px] text-gray-500">
                                {horaire.debut_matin && horaire.fin_matin && `${horaire.debut_matin}-${horaire.fin_matin}`}
                                {horaire.debut_matin && horaire.fin_matin && horaire.debut_aprem && horaire.fin_aprem && ' / '}
                                {horaire.debut_aprem && horaire.fin_aprem && `${horaire.debut_aprem}-${horaire.fin_aprem}`}
                              </div>
                            </div>
                          </Button>
                        ) : null;
                      })}
                    </div>
                    <div className="border-t my-3"></div>
                    <Label className="text-gray-500">Ou saisie manuelle :</Label>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Heure début</Label>
                    <Input
                      type="time"
                      value={quickCreneauData.horaire_debut}
                      onChange={(e) => setQuickCreneauData(prev => ({ ...prev, horaire_debut: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Heure fin</Label>
                    <Input
                      type="time"
                      value={quickCreneauData.horaire_fin}
                      onChange={(e) => setQuickCreneauData(prev => ({ ...prev, horaire_fin: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </>
            ) : quickCreneauData.employe?.role === 'Assistant' ? (
              <div className="space-y-4">
                {/* Note optionnelle */}
                <div className="space-y-2">
                  <Label>Note (optionnel)</Label>
                  <Input
                    placeholder="Laisser vide pour 'Présence'"
                    value={quickCreneauData.notes}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                
                {/* Médecins présents à cocher */}
                {getMedecinsPresentsPourCreneau(quickCreneauData.date, quickCreneauData.creneau).length > 0 && (
                  <div className="space-y-2">
                    <Label>👨‍⚕️ Médecins associés (présents ce créneau)</Label>
                    <p className="text-xs text-gray-500">Les médecins en <b>orange</b> sont déjà associés à un autre assistant</p>
                    <div className="grid grid-cols-2 gap-2">
                      {getMedecinsPresentsPourCreneau(quickCreneauData.date, quickCreneauData.creneau).map(medecin => {
                        const autreAssistant = getAssistantPourMedecin(medecin.id, quickCreneauData.date, quickCreneauData.creneau, quickCreneauData.employe?.id);
                        const isDejaAssocie = autreAssistant !== null;
                        const isChecked = quickCreneauData.medecin_ids?.includes(medecin.id);
                        return (
                          <label 
                            key={medecin.id} 
                            className={`flex items-center space-x-2 cursor-pointer p-2 rounded border hover:bg-blue-50 ${isDejaAssocie && !isChecked ? 'bg-orange-50 border-orange-300' : ''} ${isChecked ? 'bg-blue-100 border-blue-400' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setQuickCreneauData(prev => ({
                                    ...prev,
                                    medecin_ids: [...(prev.medecin_ids || []), medecin.id]
                                  }));
                                } else {
                                  setQuickCreneauData(prev => ({
                                    ...prev,
                                    medecin_ids: (prev.medecin_ids || []).filter(id => id !== medecin.id)
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className={`text-sm ${isDejaAssocie ? 'text-orange-700' : ''}`}>
                              <span className="font-semibold text-blue-600">{medecin.initiales}</span> - Dr. {medecin.prenom} {medecin.nom}
                              {isDejaAssocie && !isChecked && <span className="text-xs text-orange-600 ml-1 block">(avec {autreAssistant})</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Salle de travail */}
                <div className="space-y-2">
                  <Label>🏥 Salle de travail</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={quickCreneauData.salle_attribuee || ''}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, salle_attribuee: e.target.value }))}
                  >
                    <option value="">-- Sélectionner une salle --</option>
                    {salles.filter(s => s.type_salle === 'ASSISTANT').map(salle => {
                      const isUsed = isSalleUtiliseeJour(salle.nom, quickCreneauData.date);
                      return (
                        <option 
                          key={salle.id} 
                          value={salle.nom}
                          style={{ fontWeight: isUsed ? 'bold' : 'normal' }}
                        >
                          {salle.nom} {isUsed ? '(déjà utilisée)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                {/* Aperçu de l'affichage */}
                {(quickCreneauData.medecin_ids?.length > 0 || quickCreneauData.salle_attribuee) && (
                  <div className="bg-green-50 border border-green-200 rounded p-2 text-sm">
                    <span className="font-semibold">Aperçu: </span>
                    {quickCreneauData.medecin_ids?.length > 0 ? (
                      <>
                        {getMedecinsPresentsPourCreneau(quickCreneauData.date, quickCreneauData.creneau)
                          .filter(m => quickCreneauData.medecin_ids.includes(m.id))
                          .map(m => m.initiales)
                          .join(' ')}
                        {quickCreneauData.salle_attribuee && ` (${quickCreneauData.salle_attribuee})`}
                      </>
                    ) : quickCreneauData.salle_attribuee ? (
                      `Salle: ${quickCreneauData.salle_attribuee}`
                    ) : 'PRÉSENT'}
                  </div>
                )}
              </div>
            ) : quickCreneauData.employe?.role === 'Médecin' ? (
              <div className="space-y-4">
                {/* Box de travail */}
                <div className="space-y-2">
                  <Label>🏥 Box de travail</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={quickCreneauData.salle_attribuee || ''}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, salle_attribuee: e.target.value }))}
                  >
                    <option value="">-- Sélectionner un box --</option>
                    {salles.filter(s => s.type_salle === 'MEDECIN').map(salle => {
                      const isUsed = isSalleUtiliseeJour(salle.nom, quickCreneauData.date);
                      return (
                        <option 
                          key={salle.id} 
                          value={salle.nom}
                          style={{ fontWeight: isUsed ? 'bold' : 'normal' }}
                        >
                          {salle.nom} {isUsed ? '(déjà utilisé)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                {/* Salle d'attente */}
                <div className="space-y-2">
                  <Label>🪑 Salle d'attente</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={quickCreneauData.salle_attente || ''}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, salle_attente: e.target.value }))}
                  >
                    <option value="">-- Sélectionner une salle d'attente --</option>
                    {salles.filter(s => s.type_salle === 'ATTENTE').map(salle => {
                      const isUsed = isSalleUtiliseeJour(salle.nom, quickCreneauData.date);
                      return (
                        <option 
                          key={salle.id} 
                          value={salle.nom}
                          style={{ fontWeight: isUsed ? 'bold' : 'normal' }}
                        >
                          {salle.nom} {isUsed ? '(déjà utilisée)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                {/* Note optionnelle */}
                <div className="space-y-2">
                  <Label>Note (optionnel)</Label>
                  <Input
                    placeholder="Laisser vide pour 'Présence'"
                    value={quickCreneauData.notes}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                
                {/* Option Repos (non comptabilisé) */}
                <div className="flex items-center space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="est_repos"
                    checked={quickCreneauData.est_repos}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, est_repos: e.target.checked }))}
                    className="h-5 w-5 text-orange-600 rounded border-orange-300 focus:ring-orange-500"
                  />
                  <label htmlFor="est_repos" className="flex-1 cursor-pointer">
                    <span className="font-medium text-orange-700">😴 Repos (non comptabilisé)</span>
                    <p className="text-xs text-orange-600">Cocher si ce créneau ne doit pas être comptabilisé dans les heures de travail</p>
                  </label>
                </div>
                
                {/* Aperçu de l'affichage */}
                <div className={`border rounded p-2 text-sm ${quickCreneauData.est_repos ? 'bg-orange-100 border-orange-300' : 'bg-blue-50 border-blue-200'}`}>
                  <span className="font-semibold">Aperçu: </span>
                  {quickCreneauData.est_repos ? '😴 REPOS (non comptabilisé)' : (quickCreneauData.salle_attribuee || quickCreneauData.notes || 'PRÉSENT')}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Note (optionnel)</Label>
                  <Input
                    placeholder="Laisser vide pour 'Présence'"
                    value={quickCreneauData.notes}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                
                {/* Option Repos (non comptabilisé) pour non-secrétaires */}
                <div className="flex items-center space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="est_repos_simple"
                    checked={quickCreneauData.est_repos}
                    onChange={(e) => setQuickCreneauData(prev => ({ ...prev, est_repos: e.target.checked }))}
                    className="h-5 w-5 text-orange-600 rounded border-orange-300 focus:ring-orange-500"
                  />
                  <label htmlFor="est_repos_simple" className="flex-1 cursor-pointer">
                    <span className="font-medium text-orange-700">😴 Repos (non comptabilisé)</span>
                    <p className="text-xs text-orange-600">Cocher si ce créneau ne doit pas être comptabilisé dans les heures de travail</p>
                  </label>
                </div>
              </div>
            )}
            <div className="flex justify-between">
              {quickCreneauData.id ? (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => {
                    if (window.confirm('Voulez-vous vraiment supprimer ce créneau ?')) {
                      handleDeleteCreneauTableau(quickCreneauData.id);
                      setShowQuickCreneauModal(false);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              ) : <div></div>}
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowQuickCreneauModal(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  {quickCreneauData.id ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Détail Journée (Tous les employés par créneau) */}
      <Dialog open={showDetailJourModal} onOpenChange={setShowDetailJourModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              📋 Détail de la journée - {detailJourDate && new Date(detailJourDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </DialogTitle>
            <DialogDescription>
              Vue complète des présences par période et par rôle
            </DialogDescription>
          </DialogHeader>
          
          {detailJourDate && (() => {
            const groupes = getCreneauxJourneeGroupes(detailJourDate);
            return (
              <div className="grid grid-cols-2 gap-6 mt-4">
                {/* MATIN */}
                <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h3 className="font-bold text-orange-800 text-lg flex items-center border-b border-orange-300 pb-2">
                    🌅 MATIN
                  </h3>
                  
                  {/* Médecins Matin */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-700 flex items-center">
                      👨‍⚕️ Médecins ({groupes.matin.medecins.length})
                    </h4>
                    {groupes.matin.medecins.length > 0 ? (
                      <div className="space-y-1">
                        {groupes.matin.medecins.map(c => {
                          const employe = users.find(u => u.id === c.employe_id);
                          const hasAssistant = medecinHasAssistant(c.employe_id, detailJourDate, 'MATIN');
                          return (
                            <div 
                              key={c.id} 
                              className={`p-2 rounded text-sm cursor-pointer hover:opacity-80 transition-opacity ${hasAssistant ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-900'}`}
                              onClick={() => { setShowDetailJourModal(false); employe && openQuickCreneauModal(employe, detailJourDate, 'MATIN', c); }}
                              title="Cliquer pour modifier"
                            >
                              <div className="font-medium">Dr. {employe?.prenom} {employe?.nom}</div>
                              {c.salle_attribuee && <div className="text-xs opacity-80">📍 Box: {c.salle_attribuee}</div>}
                              {hasAssistant && <div className="text-xs opacity-80">✓ Avec assistant</div>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucun médecin</p>
                    )}
                  </div>
                  
                  {/* Assistants Matin */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-700 flex items-center">
                      👥 Assistants ({groupes.matin.assistants.length})
                    </h4>
                    {groupes.matin.assistants.length > 0 ? (
                      <div className="space-y-1">
                        {groupes.matin.assistants.map(c => {
                          const employe = users.find(u => u.id === c.employe_id);
                          return (
                            <div 
                              key={c.id} 
                              className="p-2 rounded text-sm bg-green-100 text-green-900 cursor-pointer hover:bg-green-200 transition-colors"
                              onClick={() => { setShowDetailJourModal(false); employe && openQuickCreneauModal(employe, detailJourDate, 'MATIN', c); }}
                              title="Cliquer pour modifier"
                            >
                              <div className="font-medium">{employe?.prenom} {employe?.nom}</div>
                              {c.medecin_ids && c.medecin_ids.length > 0 && (
                                <div className="text-xs text-green-700">
                                  👨‍⚕️ {c.medecin_ids.map(mid => {
                                    const med = users.find(u => u.id === mid);
                                    return med ? `Dr. ${med.prenom} ${med.nom}` : '';
                                  }).filter(Boolean).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucun assistant</p>
                    )}
                  </div>
                  
                  {/* Secrétaires Matin */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-pink-700 flex items-center">
                      📋 Secrétaires ({groupes.matin.secretaires.length})
                    </h4>
                    {groupes.matin.secretaires.length > 0 ? (
                      <div className="space-y-1">
                        {groupes.matin.secretaires.map(c => {
                          const employe = users.find(u => u.id === c.employe_id);
                          return (
                            <div 
                              key={c.id} 
                              className="p-2 rounded text-sm bg-pink-100 text-pink-900 cursor-pointer hover:bg-pink-200 transition-colors"
                              onClick={() => { setShowDetailJourModal(false); employe && openQuickCreneauModal(employe, detailJourDate, 'MATIN', c); }}
                              title="Cliquer pour modifier"
                            >
                              <div className="font-medium">{employe?.prenom} {employe?.nom}</div>
                              {(c.horaire_debut || c.horaire_fin) && (
                                <div className="text-xs text-pink-700">🕐 {c.horaire_debut || '?'} - {c.horaire_fin || '?'}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucune secrétaire</p>
                    )}
                  </div>
                </div>
                
                {/* APRÈS-MIDI */}
                <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-bold text-purple-800 text-lg flex items-center border-b border-purple-300 pb-2">
                    🌆 APRÈS-MIDI
                  </h3>
                  
                  {/* Médecins Après-midi */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-700 flex items-center">
                      👨‍⚕️ Médecins ({groupes.apresMidi.medecins.length})
                    </h4>
                    {groupes.apresMidi.medecins.length > 0 ? (
                      <div className="space-y-1">
                        {groupes.apresMidi.medecins.map(c => {
                          const employe = users.find(u => u.id === c.employe_id);
                          const hasAssistant = medecinHasAssistant(c.employe_id, detailJourDate, 'APRES_MIDI');
                          return (
                            <div 
                              key={c.id} 
                              className={`p-2 rounded text-sm cursor-pointer hover:opacity-80 transition-opacity ${hasAssistant ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-900'}`}
                              onClick={() => { setShowDetailJourModal(false); employe && openQuickCreneauModal(employe, detailJourDate, 'APRES_MIDI', c); }}
                              title="Cliquer pour modifier"
                            >
                              <div className="font-medium">Dr. {employe?.prenom} {employe?.nom}</div>
                              {c.salle_attribuee && <div className="text-xs opacity-80">📍 Box: {c.salle_attribuee}</div>}
                              {hasAssistant && <div className="text-xs opacity-80">✓ Avec assistant</div>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucun médecin</p>
                    )}
                  </div>
                  
                  {/* Assistants Après-midi */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-700 flex items-center">
                      👥 Assistants ({groupes.apresMidi.assistants.length})
                    </h4>
                    {groupes.apresMidi.assistants.length > 0 ? (
                      <div className="space-y-1">
                        {groupes.apresMidi.assistants.map(c => {
                          const employe = users.find(u => u.id === c.employe_id);
                          return (
                            <div 
                              key={c.id} 
                              className="p-2 rounded text-sm bg-green-100 text-green-900 cursor-pointer hover:bg-green-200 transition-colors"
                              onClick={() => { setShowDetailJourModal(false); employe && openQuickCreneauModal(employe, detailJourDate, 'APRES_MIDI', c); }}
                              title="Cliquer pour modifier"
                            >
                              <div className="font-medium">{employe?.prenom} {employe?.nom}</div>
                              {c.medecin_ids && c.medecin_ids.length > 0 && (
                                <div className="text-xs text-green-700">
                                  👨‍⚕️ {c.medecin_ids.map(mid => {
                                    const med = users.find(u => u.id === mid);
                                    return med ? `Dr. ${med.prenom} ${med.nom}` : '';
                                  }).filter(Boolean).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucun assistant</p>
                    )}
                  </div>
                  
                  {/* Secrétaires Après-midi */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-pink-700 flex items-center">
                      📋 Secrétaires ({groupes.apresMidi.secretaires.length})
                    </h4>
                    {groupes.apresMidi.secretaires.length > 0 ? (
                      <div className="space-y-1">
                        {groupes.apresMidi.secretaires.map(c => {
                          const employe = users.find(u => u.id === c.employe_id);
                          return (
                            <div 
                              key={c.id} 
                              className="p-2 rounded text-sm bg-pink-100 text-pink-900 cursor-pointer hover:bg-pink-200 transition-colors"
                              onClick={() => { setShowDetailJourModal(false); employe && openQuickCreneauModal(employe, detailJourDate, 'APRES_MIDI', c); }}
                              title="Cliquer pour modifier"
                            >
                              <div className="font-medium">{employe?.prenom} {employe?.nom}</div>
                              {(c.horaire_debut || c.horaire_fin) && (
                                <div className="text-xs text-pink-700">🕐 {c.horaire_debut || '?'} - {c.horaire_fin || '?'}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucune secrétaire</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div className="text-sm text-gray-500">
              💡 Cliquez sur un employé pour modifier son créneau
            </div>
            <Button variant="outline" onClick={() => setShowDetailJourModal(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Journée Complète (Matin + Après-midi) */}
      <Dialog open={showJourneeModal} onOpenChange={setShowJourneeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              📅 {journeeData.employe?.role === 'Médecin' ? 'Dr. ' : ''}{journeeData.employe?.prenom} {journeeData.employe?.nom} - Journée complète
            </DialogTitle>
            <DialogDescription>
              {new Date(journeeData.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleJourneeSubmit} className="space-y-6">
            {/* Bouton pour afficher/masquer les assistants associés */}
            {journeeData.employe?.role === 'Assistant' && (
              <div className="flex items-center justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAssistantsDetails(!showAssistantsDetails)}
                  className="text-sm"
                >
                  {showAssistantsDetails ? '🙈 Masquer les assistants' : '👁️ Voir assistants déjà associés'}
                </Button>
              </div>
            )}
            
            {/* Boutons rapides pour les secrétaires - Appliquer journée complète */}
            {journeeData.employe?.role === 'Secrétaire' && (
              <div className="bg-pink-50 rounded-lg p-3 border border-pink-200">
                <Label className="text-sm font-bold text-pink-700 mb-2 block">⚡ Appliquer un horaire complet (Matin + Après-midi)</Label>
                <div className="flex flex-wrap gap-2">
                  {horairesSecretaires.filter(h => h.debut_matin && h.fin_matin && h.debut_aprem && h.fin_aprem).map(horaire => (
                    <Button
                      key={horaire.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs hover:bg-pink-100 hover:border-pink-400"
                      onClick={() => setJourneeData(prev => ({
                        ...prev,
                        matin: { 
                          ...prev.matin, 
                          horaire_debut: horaire.debut_matin, 
                          horaire_fin: horaire.fin_matin 
                        },
                        apresMidi: { 
                          ...prev.apresMidi, 
                          horaire_debut: horaire.debut_aprem, 
                          horaire_fin: horaire.fin_aprem 
                        }
                      }))}
                    >
                      <div className="text-center">
                        <div className="font-semibold">{horaire.nom}</div>
                        <div className="text-[10px] text-gray-500">
                          {horaire.debut_matin}-{horaire.fin_matin} / {horaire.debut_aprem}-{horaire.fin_aprem}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
              {/* MATIN */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-blue-800 flex items-center text-base">
                    <CalendarDays className="h-5 w-5 mr-2" /> Matin
                  </h3>
                  {journeeData.matin.exists && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Existant</span>
                  )}
                </div>
                
                {journeeData.employe?.role === 'Secrétaire' && (
                  <>
                    {/* Sélection rapide des horaires prédéfinis pour le MATIN */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-pink-700">⚡ Horaires prédéfinis (matin)</Label>
                      <div className="flex flex-wrap gap-1">
                        {horairesSecretaires.filter(h => h.debut_matin && h.fin_matin).map(horaire => (
                          <Button
                            key={horaire.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-auto py-1 px-2 hover:bg-pink-50 hover:border-pink-300"
                            onClick={() => setJourneeData(prev => ({
                              ...prev,
                              matin: { 
                                ...prev.matin, 
                                horaire_debut: horaire.debut_matin, 
                                horaire_fin: horaire.fin_matin 
                              }
                            }))}
                          >
                            {horaire.nom}: {horaire.debut_matin}-{horaire.fin_matin}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-sm font-medium">Début</Label>
                        <Input
                          type="time"
                          value={journeeData.matin.horaire_debut}
                          onChange={(e) => setJourneeData(prev => ({
                            ...prev,
                            matin: { ...prev.matin, horaire_debut: e.target.value }
                          }))}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Fin</Label>
                        <Input
                          type="time"
                          value={journeeData.matin.horaire_fin}
                          onChange={(e) => setJourneeData(prev => ({
                            ...prev,
                            matin: { ...prev.matin, horaire_fin: e.target.value }
                          }))}
                          className="h-8"
                        />
                      </div>
                    </div>
                    {/* Calcul des heures travaillées - Matin */}
                    {journeeData.matin.horaire_debut && journeeData.matin.horaire_fin && (
                      <div className="bg-blue-50 rounded p-2 text-center">
                        <span className="text-sm font-bold text-blue-700">
                          {(() => {
                            const [h1, m1] = journeeData.matin.horaire_debut.split(':').map(Number);
                            const [h2, m2] = journeeData.matin.horaire_fin.split(':').map(Number);
                            const minutesMatin = (h2 * 60 + m2) - (h1 * 60 + m1);
                            const heuresMatin = Math.floor(minutesMatin / 60);
                            const minsMatin = minutesMatin % 60;
                            
                            // Calculer aussi les heures de l'après-midi si disponibles
                            let minutesAM = 0;
                            if (journeeData.apresMidi.horaire_debut && journeeData.apresMidi.horaire_fin) {
                              const [h3, m3] = journeeData.apresMidi.horaire_debut.split(':').map(Number);
                              const [h4, m4] = journeeData.apresMidi.horaire_fin.split(':').map(Number);
                              minutesAM = (h4 * 60 + m4) - (h3 * 60 + m3);
                            }
                            const totalMinutes = minutesMatin + minutesAM;
                            const heuresTotal = Math.floor(totalMinutes / 60);
                            const minsTotal = totalMinutes % 60;
                            
                            return `${heuresMatin}H${minsMatin > 0 ? minsMatin.toString().padStart(2, '0') : ''} | Journée: ${heuresTotal}H${minsTotal > 0 ? minsTotal.toString().padStart(2, '0') : ''}`;
                          })()}
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {journeeData.employe?.role === 'Médecin' && (
                  <>
                    <div>
                      <Label className="text-xs">Box</Label>
                      <select
                        className="w-full p-2 border rounded text-sm"
                        value={journeeData.matin.salle_attribuee}
                        onChange={(e) => setJourneeData(prev => ({
                          ...prev,
                          matin: { ...prev.matin, salle_attribuee: e.target.value }
                        }))}
                      >
                        <option value="">-- Box --</option>
                        {salles.filter(s => s.type_salle === 'MEDECIN').map(s => (
                          <option key={s.id} value={s.nom}>{s.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Salle d'attente</Label>
                      <select
                        className="w-full p-2 border rounded text-sm"
                        value={journeeData.matin.salle_attente}
                        onChange={(e) => setJourneeData(prev => ({
                          ...prev,
                          matin: { ...prev.matin, salle_attente: e.target.value }
                        }))}
                      >
                        <option value="">-- Salle d'attente --</option>
                        {salles.filter(s => s.type_salle === 'ATTENTE').map(s => (
                          <option key={s.id} value={s.nom}>{s.nom}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                {journeeData.employe?.role === 'Assistant' && (
                  <>
                    <div>
                      <Label className="text-sm font-medium">👨‍⚕️ Médecins</Label>
                      <div className="space-y-2 mt-1">
                        {getMedecinsPresentsPourCreneau(journeeData.date, 'MATIN').map(med => {
                          const autreAssistant = getAssistantPourMedecin(med.id, journeeData.date, 'MATIN', journeeData.employe_id);
                          const estDejaAssocie = autreAssistant !== null;
                          return (
                            <label key={med.id} className={`flex items-center space-x-2 text-sm p-1 rounded cursor-pointer hover:bg-blue-100 ${estDejaAssocie ? 'text-orange-600 bg-orange-50' : 'text-gray-900'}`}>
                              <input
                                type="checkbox"
                                checked={journeeData.matin.medecin_ids?.includes(med.id)}
                                onChange={(e) => {
                                  const newIds = e.target.checked
                                    ? [...(journeeData.matin.medecin_ids || []), med.id]
                                    : (journeeData.matin.medecin_ids || []).filter(id => id !== med.id);
                                  setJourneeData(prev => ({
                                    ...prev,
                                    matin: { ...prev.matin, medecin_ids: newIds }
                                  }));
                                }}
                                className="w-4 h-4"
                              />
                              <span className="font-medium">{med.initiales}</span>
                              <span>- Dr. {med.prenom}</span>
                              {estDejaAssocie && showAssistantsDetails && (
                                <span className="ml-1 text-orange-500 text-xs">(avec {autreAssistant})</span>
                              )}
                            </label>
                          );
                        })}
                        {getMedecinsPresentsPourCreneau(journeeData.date, 'MATIN').length === 0 && (
                          <span className="text-gray-400 text-sm">Aucun médecin présent</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Salle</Label>
                      <select
                        className="w-full p-2 border rounded text-sm mt-1"
                        value={journeeData.matin.salle_attribuee}
                        onChange={(e) => setJourneeData(prev => ({
                          ...prev,
                          matin: { ...prev.matin, salle_attribuee: e.target.value }
                        }))}
                      >
                        <option value="">-- Salle --</option>
                        {salles.filter(s => s.type_salle === 'ASSISTANT').map(s => (
                          <option key={s.id} value={s.nom}>{s.nom}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                <div>
                  <Label className="text-sm font-medium">Note</Label>
                  <Input
                    placeholder="Note..."
                    value={journeeData.matin.notes}
                    onChange={(e) => setJourneeData(prev => ({
                      ...prev,
                      matin: { ...prev.matin, notes: e.target.value }
                    }))}
                    className="h-9 text-sm mt-1"
                  />
                </div>
                
                {/* Boutons Matin */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button 
                    type="button" 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm"
                    onClick={handleEnregistrerMatin}
                  >
                    ✓ Enregistrer Matin
                  </Button>
                  {journeeData.matin.exists && (
                    <Button 
                      type="button" 
                      variant="destructive"
                      className="text-sm"
                      onClick={handleSupprimerMatin}
                    >
                      🗑️
                    </Button>
                  )}
                </div>
              </div>
              
              {/* FLÈCHES DE COPIE AU CENTRE - Seulement pour Assistants */}
              {journeeData.employe?.role === 'Assistant' && (
                <div className="flex flex-col items-center justify-center gap-3 py-4">
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Copier Matin → Après-midi"
                    onClick={() => setJourneeData(prev => ({
                      ...prev,
                      apresMidi: {
                        ...prev.apresMidi,
                        medecin_ids: [...(prev.matin.medecin_ids || [])],
                        salle_attribuee: prev.matin.salle_attribuee || ''
                      }
                    }))}
                  >
                    <span className="text-2xl font-bold text-gray-700 hover:text-blue-600">➡️</span>
                  </button>
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Copier Après-midi → Matin"
                    onClick={() => setJourneeData(prev => ({
                      ...prev,
                      matin: {
                        ...prev.matin,
                        medecin_ids: [...(prev.apresMidi.medecin_ids || [])],
                        salle_attribuee: prev.apresMidi.salle_attribuee || ''
                      }
                    }))}
                  >
                    <span className="text-2xl font-bold text-gray-700 hover:text-orange-600">⬅️</span>
                  </button>
                </div>
              )}
              
              {/* Séparateur vide pour les non-assistants */}
              {journeeData.employe?.role !== 'Assistant' && (
                <div className="w-4"></div>
              )}
              
              {/* APRÈS-MIDI */}
              <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-yellow-700 flex items-center text-base">
                    <CalendarDays className="h-5 w-5 mr-2" /> Après-midi
                  </h3>
                  {journeeData.apresMidi.exists && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Existant</span>
                  )}
                </div>
                
                {journeeData.employe?.role === 'Secrétaire' && (
                  <>
                    {/* Sélection rapide des horaires prédéfinis pour l'APRÈS-MIDI */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-pink-700">⚡ Horaires prédéfinis (après-midi)</Label>
                      <div className="flex flex-wrap gap-1">
                        {horairesSecretaires.filter(h => h.debut_aprem && h.fin_aprem).map(horaire => (
                          <Button
                            key={horaire.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-auto py-1 px-2 hover:bg-pink-50 hover:border-pink-300"
                            onClick={() => setJourneeData(prev => ({
                              ...prev,
                              apresMidi: { 
                                ...prev.apresMidi, 
                                horaire_debut: horaire.debut_aprem, 
                                horaire_fin: horaire.fin_aprem 
                              }
                            }))}
                          >
                            {horaire.nom}: {horaire.debut_aprem}-{horaire.fin_aprem}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Début</Label>
                        <Input
                          type="time"
                          value={journeeData.apresMidi.horaire_debut}
                          onChange={(e) => setJourneeData(prev => ({
                            ...prev,
                            apresMidi: { ...prev.apresMidi, horaire_debut: e.target.value }
                          }))}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Fin</Label>
                        <Input
                          type="time"
                          value={journeeData.apresMidi.horaire_fin}
                          onChange={(e) => setJourneeData(prev => ({
                            ...prev,
                            apresMidi: { ...prev.apresMidi, horaire_fin: e.target.value }
                          }))}
                          className="h-8"
                        />
                      </div>
                    </div>
                    {/* Calcul des heures travaillées - Après-midi */}
                    {journeeData.apresMidi.horaire_debut && journeeData.apresMidi.horaire_fin && (
                      <div className="bg-orange-50 rounded p-2 text-center">
                        <span className="text-sm font-bold text-orange-700">
                          {(() => {
                            const [h1, m1] = journeeData.apresMidi.horaire_debut.split(':').map(Number);
                            const [h2, m2] = journeeData.apresMidi.horaire_fin.split(':').map(Number);
                            const minutesAM = (h2 * 60 + m2) - (h1 * 60 + m1);
                            const heuresAM = Math.floor(minutesAM / 60);
                            const minsAM = minutesAM % 60;
                            
                            // Calculer aussi les heures du matin si disponibles
                            let minutesMatin = 0;
                            if (journeeData.matin.horaire_debut && journeeData.matin.horaire_fin) {
                              const [h3, m3] = journeeData.matin.horaire_debut.split(':').map(Number);
                              const [h4, m4] = journeeData.matin.horaire_fin.split(':').map(Number);
                              minutesMatin = (h4 * 60 + m4) - (h3 * 60 + m3);
                            }
                            const totalMinutes = minutesMatin + minutesAM;
                            const heuresTotal = Math.floor(totalMinutes / 60);
                            const minsTotal = totalMinutes % 60;
                            
                            return `${heuresAM}H${minsAM > 0 ? minsAM.toString().padStart(2, '0') : ''} | Journée: ${heuresTotal}H${minsTotal > 0 ? minsTotal.toString().padStart(2, '0') : ''}`;
                          })()}
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {journeeData.employe?.role === 'Médecin' && (
                  <>
                    <div>
                      <Label className="text-xs">Box</Label>
                      <select
                        className="w-full p-2 border rounded text-sm"
                        value={journeeData.apresMidi.salle_attribuee}
                        onChange={(e) => setJourneeData(prev => ({
                          ...prev,
                          apresMidi: { ...prev.apresMidi, salle_attribuee: e.target.value }
                        }))}
                      >
                        <option value="">-- Box --</option>
                        {salles.filter(s => s.type_salle === 'MEDECIN').map(s => (
                          <option key={s.id} value={s.nom}>{s.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Salle d'attente</Label>
                      <select
                        className="w-full p-2 border rounded text-sm"
                        value={journeeData.apresMidi.salle_attente}
                        onChange={(e) => setJourneeData(prev => ({
                          ...prev,
                          apresMidi: { ...prev.apresMidi, salle_attente: e.target.value }
                        }))}
                      >
                        <option value="">-- Salle d'attente --</option>
                        {salles.filter(s => s.type_salle === 'ATTENTE').map(s => (
                          <option key={s.id} value={s.nom}>{s.nom}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                {journeeData.employe?.role === 'Assistant' && (
                  <>
                    <div>
                      <Label className="text-sm font-medium">👨‍⚕️ Médecins</Label>
                      <div className="space-y-2 mt-1">
                        {getMedecinsPresentsPourCreneau(journeeData.date, 'APRES_MIDI').map(med => {
                          const autreAssistant = getAssistantPourMedecin(med.id, journeeData.date, 'APRES_MIDI', journeeData.employe_id);
                          const estDejaAssocie = autreAssistant !== null;
                          return (
                            <label key={med.id} className={`flex items-center space-x-2 text-sm p-1 rounded cursor-pointer hover:bg-yellow-100 ${estDejaAssocie ? 'text-orange-600 bg-orange-50' : 'text-gray-900'}`}>
                              <input
                                type="checkbox"
                                checked={journeeData.apresMidi.medecin_ids?.includes(med.id)}
                                onChange={(e) => {
                                  const newIds = e.target.checked
                                    ? [...(journeeData.apresMidi.medecin_ids || []), med.id]
                                    : (journeeData.apresMidi.medecin_ids || []).filter(id => id !== med.id);
                                  setJourneeData(prev => ({
                                    ...prev,
                                    apresMidi: { ...prev.apresMidi, medecin_ids: newIds }
                                  }));
                                }}
                                className="w-4 h-4"
                              />
                              <span className="font-medium">{med.initiales}</span>
                              <span>- Dr. {med.prenom}</span>
                              {estDejaAssocie && showAssistantsDetails && (
                                <span className="ml-1 text-orange-500 text-xs">(avec {autreAssistant})</span>
                              )}
                            </label>
                          );
                        })}
                        {getMedecinsPresentsPourCreneau(journeeData.date, 'APRES_MIDI').length === 0 && (
                          <span className="text-gray-400 text-sm">Aucun médecin présent</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Salle</Label>
                      <select
                        className="w-full p-2 border rounded text-sm mt-1"
                        value={journeeData.apresMidi.salle_attribuee}
                        onChange={(e) => setJourneeData(prev => ({
                          ...prev,
                          apresMidi: { ...prev.apresMidi, salle_attribuee: e.target.value }
                        }))}
                      >
                        <option value="">-- Salle --</option>
                        {salles.filter(s => s.type_salle === 'ASSISTANT').map(s => (
                          <option key={s.id} value={s.nom}>{s.nom}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                <div>
                  <Label className="text-sm font-medium">Note</Label>
                  <Input
                    placeholder="Note..."
                    value={journeeData.apresMidi.notes}
                    onChange={(e) => setJourneeData(prev => ({
                      ...prev,
                      apresMidi: { ...prev.apresMidi, notes: e.target.value }
                    }))}
                    className="h-9 text-sm mt-1"
                  />
                </div>
                
                {/* Boutons Après-midi */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button 
                    type="button" 
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-sm"
                    onClick={handleEnregistrerApresMidi}
                  >
                    ✓ Enregistrer Après-midi
                  </Button>
                  {journeeData.apresMidi.exists && (
                    <Button 
                      type="button" 
                      variant="destructive"
                      className="text-sm"
                      onClick={handleSupprimerApresMidi}
                    >
                      🗑️
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Option Congé/Repos pour Secrétaires et Assistants */}
            {(journeeData.employe?.role === 'Secrétaire' || journeeData.employe?.role === 'Assistant') && (
              <div className={`border rounded-lg p-4 mt-4 ${journeeData.congeExistant ? 'bg-red-50 border-red-300' : 'bg-gray-50'}`}>
                {/* Alerte si congé multi-jours */}
                {journeeData.congeExistant && journeeData.congeExistant.date_debut !== journeeData.congeExistant.date_fin && (
                  <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 mb-3">
                    <p className="text-sm font-semibold text-yellow-800">
                      ⚠️ Congé multi-jours : {new Date(journeeData.congeExistant.date_debut + 'T12:00:00').toLocaleDateString('fr-FR')} au {new Date(journeeData.congeExistant.date_fin + 'T12:00:00').toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Vous pouvez modifier ce jour spécifiquement. Le congé sera automatiquement scindé si nécessaire.
                    </p>
                  </div>
                )}
                
                <h4 className="font-semibold text-gray-700 mb-3">
                  🏖️ {journeeData.congeExistant ? `Congé existant (${journeeData.congeExistant.type_conge})` : 'Ajouter un congé ou repos pour cette journée'}
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* MATIN */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={journeeData.matin.conge || false}
                        onChange={async (e) => {
                          if (!e.target.checked && journeeData.congeExistant) {
                            // Décocher matin = modifier ou supprimer le congé
                            const isMultiJours = journeeData.congeExistant.date_debut !== journeeData.congeExistant.date_fin;
                            const congeCreneauActuel = journeeData.congeExistant.creneau || 'JOURNEE_COMPLETE';
                            
                            // Si c'est un congé journée complète (mono ou multi-jours), on peut scinder
                            if (congeCreneauActuel === 'JOURNEE_COMPLETE' || isMultiJours) {
                              await handleScinderConge(
                                journeeData.congeExistant.id,
                                journeeData.date,
                                'MATIN',
                                null, // pas de nouveau type = retirer ce créneau du congé
                                true  // créer un créneau de travail
                              );
                            } else if (congeCreneauActuel === 'MATIN') {
                              // Congé seulement le matin → supprimer entièrement
                              await handleSupprimerCongeExistant(journeeData.congeExistant.id);
                            }
                            // Si le congé est seulement l'après-midi, décocher matin ne fait rien
                            
                            setJourneeData(prev => ({
                              ...prev,
                              matin: { ...prev.matin, conge: false, type_conge: '' }
                            }));
                          } else {
                            setJourneeData(prev => ({
                              ...prev,
                              matin: { ...prev.matin, conge: e.target.checked, type_conge: e.target.checked ? (prev.matin.type_conge || 'CONGE_PAYE') : '' }
                            }));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Congé/Repos <b>Matin</b></span>
                    </label>
                    {journeeData.matin.conge && (
                      <select
                        className="w-full p-2 border rounded text-sm"
                        value={journeeData.matin.type_conge || 'CONGE_PAYE'}
                        onChange={async (e) => {
                          const nouveauType = e.target.value;
                          setJourneeData(prev => ({
                            ...prev,
                            matin: { ...prev.matin, type_conge: nouveauType }
                          }));
                          // Si congé existant multi-jours, scinder pour changer le type
                          if (journeeData.congeExistant) {
                            const isMultiJours = journeeData.congeExistant.date_debut !== journeeData.congeExistant.date_fin;
                            if (isMultiJours && nouveauType !== journeeData.congeExistant.type_conge) {
                              await handleScinderConge(
                                journeeData.congeExistant.id,
                                journeeData.date,
                                'MATIN',
                                nouveauType,
                                false
                              );
                            } else {
                              handleModifierTypeConge(journeeData.congeExistant.id, nouveauType);
                            }
                          }
                        }}
                      >
                        <option value="CONGE_PAYE">Congé payé (CP)</option>
                        <option value="CONGE_SANS_SOLDE">Congé sans solde</option>
                        <option value="MALADIE">Maladie</option>
                        <option value="HEURES_A_RECUPERER">Heures à récupérer (+H sup)</option>
                        <option value="HEURES_RECUPEREES">Heures récupérées (-H sup)</option>
                        <option value="REPOS">Repos (non comptabilisé)</option>
                      </select>
                    )}
                    {/* Bouton pour convertir en jour de travail */}
                    {journeeData.congeExistant && journeeData.matin.conge && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                        onClick={async () => {
                          const isMultiJours = journeeData.congeExistant.date_debut !== journeeData.congeExistant.date_fin;
                          if (isMultiJours) {
                            await handleScinderConge(
                              journeeData.congeExistant.id,
                              journeeData.date,
                              'MATIN',
                              null,
                              true // créer créneau travail
                            );
                          } else {
                            await handleSupprimerCongeExistant(journeeData.congeExistant.id);
                          }
                          setJourneeData(prev => ({
                            ...prev,
                            matin: { ...prev.matin, conge: false, type_conge: '' }
                          }));
                        }}
                      >
                        ✅ Convertir en jour de travail
                      </Button>
                    )}
                  </div>
                  
                  {/* APRÈS-MIDI */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={journeeData.apresMidi.conge || false}
                        onChange={async (e) => {
                          if (!e.target.checked && journeeData.congeExistant) {
                            // Décocher après-midi = modifier ou supprimer le congé
                            const isMultiJours = journeeData.congeExistant.date_debut !== journeeData.congeExistant.date_fin;
                            const congeCreneauActuel = journeeData.congeExistant.creneau || 'JOURNEE_COMPLETE';
                            
                            // Si c'est un congé journée complète (mono ou multi-jours), on peut scinder
                            if (congeCreneauActuel === 'JOURNEE_COMPLETE' || isMultiJours) {
                              await handleScinderConge(
                                journeeData.congeExistant.id,
                                journeeData.date,
                                'APRES_MIDI',
                                null,
                                true
                              );
                            } else if (congeCreneauActuel === 'APRES_MIDI') {
                              // Congé seulement l'après-midi → supprimer entièrement
                              await handleSupprimerCongeExistant(journeeData.congeExistant.id);
                            }
                            // Si le congé est seulement le matin, décocher après-midi ne fait rien
                            
                            setJourneeData(prev => ({
                              ...prev,
                              apresMidi: { ...prev.apresMidi, conge: false, type_conge: '' }
                            }));
                          } else {
                            setJourneeData(prev => ({
                              ...prev,
                              apresMidi: { ...prev.apresMidi, conge: e.target.checked, type_conge: e.target.checked ? (prev.apresMidi.type_conge || 'CONGE_PAYE') : '' }
                            }));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Congé/Repos <b>Après-midi</b></span>
                    </label>
                    {journeeData.apresMidi.conge && (
                      <select
                        className="w-full p-2 border rounded text-sm"
                        value={journeeData.apresMidi.type_conge || 'CONGE_PAYE'}
                        onChange={async (e) => {
                          const nouveauType = e.target.value;
                          setJourneeData(prev => ({
                            ...prev,
                            apresMidi: { ...prev.apresMidi, type_conge: nouveauType }
                          }));
                          if (journeeData.congeExistant) {
                            const isMultiJours = journeeData.congeExistant.date_debut !== journeeData.congeExistant.date_fin;
                            if (isMultiJours && nouveauType !== journeeData.congeExistant.type_conge) {
                              await handleScinderConge(
                                journeeData.congeExistant.id,
                                journeeData.date,
                                'APRES_MIDI',
                                nouveauType,
                                false
                              );
                            } else {
                              handleModifierTypeConge(journeeData.congeExistant.id, nouveauType);
                            }
                          }
                        }}
                      >
                        <option value="CONGE_PAYE">Congé payé (CP)</option>
                        <option value="CONGE_SANS_SOLDE">Congé sans solde</option>
                        <option value="MALADIE">Maladie</option>
                        <option value="HEURES_A_RECUPERER">Heures à récupérer (+H sup)</option>
                        <option value="HEURES_RECUPEREES">Heures récupérées (-H sup)</option>
                        <option value="REPOS">Repos (non comptabilisé)</option>
                      </select>
                    )}
                    {/* Bouton pour convertir en jour de travail */}
                    {journeeData.congeExistant && journeeData.apresMidi.conge && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                        onClick={async () => {
                          const isMultiJours = journeeData.congeExistant.date_debut !== journeeData.congeExistant.date_fin;
                          if (isMultiJours) {
                            await handleScinderConge(
                              journeeData.congeExistant.id,
                              journeeData.date,
                              'APRES_MIDI',
                              null,
                              true
                            );
                          } else {
                            await handleSupprimerCongeExistant(journeeData.congeExistant.id);
                          }
                          setJourneeData(prev => ({
                            ...prev,
                            apresMidi: { ...prev.apresMidi, conge: false, type_conge: '' }
                          }));
                        }}
                      >
                        ✅ Convertir en jour de travail
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Heures de congés personnalisées */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">💡 Par défaut: {journeeData.employe?.heures_demi_journee_conge || 4}h par demi-journée. Modifier si besoin:</p>
                  <div className="grid grid-cols-2 gap-4">
                    {journeeData.matin.conge && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Heures congé Matin:</Label>
                        <Input
                          type="number"
                          step="0.5"
                          className="h-8 text-xs w-20"
                          value={journeeData.matin.heures_conge || journeeData.employe?.heures_demi_journee_conge || 4}
                          onChange={(e) => setJourneeData(prev => ({
                            ...prev,
                            matin: { ...prev.matin, heures_conge: parseFloat(e.target.value) || 4 }
                          }))}
                        />
                      </div>
                    )}
                    {journeeData.apresMidi.conge && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Heures congé AM:</Label>
                        <Input
                          type="number"
                          step="0.5"
                          className="h-8 text-xs w-20"
                          value={journeeData.apresMidi.heures_conge || journeeData.employe?.heures_demi_journee_conge || 4}
                          onChange={(e) => setJourneeData(prev => ({
                            ...prev,
                            apresMidi: { ...prev.apresMidi, heures_conge: parseFloat(e.target.value) || 4 }
                          }))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Section Heures Supplémentaires / À rattraper */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-orange-700 mb-3">⏱️ Heures supplémentaires / À rattraper (ce jour)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-green-700">➕ Heures supp effectuées</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0"
                      className="h-9 text-sm"
                      value={journeeData.heures_supp_jour || ''}
                      onChange={(e) => setJourneeData(prev => ({
                        ...prev,
                        heures_supp_jour: parseFloat(e.target.value) || 0
                      }))}
                    />
                    <span className="text-sm text-gray-500">h</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-blue-700">➖ Heures à rattraper</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0"
                      className="h-9 text-sm"
                      value={journeeData.heures_rattraper_jour || ''}
                      onChange={(e) => setJourneeData(prev => ({
                        ...prev,
                        heures_rattraper_jour: parseFloat(e.target.value) || 0
                      }))}
                    />
                    <span className="text-sm text-gray-500">h</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Ces heures seront ajoutées/soustraites au compteur global de l'employé
              </p>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowJourneeModal(false)}>
                Annuler
              </Button>
              <div className="flex gap-2">
                {(journeeData.matin.exists || journeeData.apresMidi.exists) && (
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={handleSupprimerJourneeComplete}
                  >
                    🗑️ Supprimer Journée
                  </Button>
                )}
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  📅 Enregistrer Journée Complète
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Semaine A/B/Co */}
      <Dialog open={showSemaineABCModal} onOpenChange={setShowSemaineABCModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-teal-600" />
              <span>Appliquer une semaine</span>
            </DialogTitle>
            <DialogDescription>
              {semaineABCTarget?.type === 'employe' 
                ? `Pour ${semaineABCTarget.employe?.prenom} ${semaineABCTarget.employe?.nom}`
                : `Pour tous les ${semaineABCTarget?.section}s`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 p-4">
            {/* Info sur la configuration */}
            {semaineABCTarget?.type === 'employe' && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between">
                  <span>Semaine A :</span>
                  <span className="font-medium">
                    {semaineABCTarget.employe?.semaine_a_id 
                      ? horairesSecretaires.find(h => String(h.id) === String(semaineABCTarget.employe?.semaine_a_id))?.nom || 'Configurée'
                      : 'Non configurée'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Semaine B :</span>
                  <span className="font-medium">
                    {semaineABCTarget.employe?.semaine_b_id 
                      ? horairesSecretaires.find(h => String(h.id) === String(semaineABCTarget.employe?.semaine_b_id))?.nom || 'Configurée'
                      : 'Non configurée'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Boutons A et B */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="flex flex-col items-center py-4 hover:bg-pink-50 hover:border-pink-400"
                onClick={async () => {
                  let created = 0;
                  if (semaineABCTarget?.type === 'employe') {
                    created = await applySemaineToEmploye(semaineABCTarget.employe, 'A');
                  } else {
                    created = await applySemaineToSection(semaineABCTarget?.section, 'A');
                  }
                  if (created > 0) {
                    toast.success(`Semaine A appliquée ! ${created} créneau(x) créé(s)`);
                    fetchPlanningTableau(selectedWeek);
                  } else {
                    toast.info('Aucun créneau créé (déjà existants ou congés)');
                  }
                  setShowSemaineABCModal(false);
                }}
              >
                <span className="text-2xl mb-1">📅</span>
                <span className="text-xs mt-1">Semaine A</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center py-4 hover:bg-blue-50 hover:border-blue-400"
                onClick={async () => {
                  let created = 0;
                  if (semaineABCTarget?.type === 'employe') {
                    created = await applySemaineToEmploye(semaineABCTarget.employe, 'B');
                  } else {
                    created = await applySemaineToSection(semaineABCTarget?.section, 'B');
                  }
                  if (created > 0) {
                    toast.success(`Semaine B appliquée ! ${created} créneau(x) créé(s)`);
                    fetchPlanningTableau(selectedWeek);
                  } else {
                    toast.info('Aucun créneau créé (déjà existants ou congés)');
                  }
                  setShowSemaineABCModal(false);
                }}
              >
                <span className="text-2xl mb-1">📆</span>
                <span className="text-xs mt-1">Semaine B</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center py-4 hover:bg-orange-50 hover:border-orange-400"
                onClick={async () => {
                  let created = 0;
                  if (semaineABCTarget?.type === 'employe') {
                    created = await applyCongeSemaine(semaineABCTarget.employe);
                  } else {
                    created = await applyCongeSemaineSection(semaineABCTarget?.section);
                  }
                  if (created > 0) {
                    toast.success(`Congés appliqués ! ${created} jour(s) de congé créé(s)`);
                    fetchConges();
                    fetchPlanningTableau(selectedWeek);
                  } else {
                    toast.info('Aucun congé créé (déjà existants ou créneaux présents)');
                  }
                  setShowSemaineABCModal(false);
                }}
              >
                <span className="text-2xl mb-1">🏖️</span>
                <span className="text-xs mt-1">Congés</span>
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              Applique les horaires prédéfinis pour toute la semaine affichée
            </p>
            
            {/* Bouton pour configurer */}
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowSemaineABCModal(false);
                  setShowConfigSemainesModal(true);
                }}
              >
                ⚙️ Configurer les semaines A/B
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Configuration Semaines A/B */}
      <Dialog open={showConfigSemainesModal} onOpenChange={setShowConfigSemainesModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings className="h-6 w-6 text-gray-600" />
              Paramétrage des heures contrat
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configurez les heures de travail hebdomadaires pour chaque employé
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8 mt-4">
            
            {/* SECTION SECRÉTAIRES */}
            <div className="bg-pink-50 rounded-xl p-5 border border-pink-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📋</span>
                <h3 className="font-bold text-pink-800 text-lg">Secrétaires</h3>
              </div>
              
              {/* En-tête du tableau */}
              <div className="grid grid-cols-6 gap-3 mb-3 px-2">
                <div className="font-semibold text-gray-600 text-sm">Nom</div>
                <div className="font-semibold text-gray-600 text-sm text-center">Semaine Type</div>
                <div className="font-semibold text-gray-600 text-sm text-center">Heures Sem A</div>
                <div className="font-semibold text-gray-600 text-sm text-center">Heures Sem B</div>
                <div className="font-semibold text-purple-700 text-sm text-center">Heures Contrat</div>
                <div className="font-semibold text-orange-600 text-sm text-center">H/½j Congé</div>
              </div>
              
              {/* Liste des employés */}
              <div className="space-y-2">
                {users.filter(u => u.actif && u.role === 'Secrétaire').map(emp => (
                  <div key={emp.id} className="grid grid-cols-6 gap-3 items-center bg-white p-3 rounded-lg shadow-sm border border-pink-100">
                    <div className="font-medium text-gray-800">{emp.prenom} {emp.nom}</div>
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant={emp.semaine_a_config ? "default" : "outline"}
                        className={`h-8 px-3 text-xs ${emp.semaine_a_config ? "bg-pink-600 hover:bg-pink-700" : "hover:bg-pink-100"}`}
                        onClick={() => openConfigSemaine(emp, 'A')}
                      >
                        A {emp.semaine_a_config ? '✓' : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant={emp.semaine_b_config ? "default" : "outline"}
                        className={`h-8 px-3 text-xs ${emp.semaine_b_config ? "bg-pink-600 hover:bg-pink-700" : "hover:bg-pink-100"}`}
                        onClick={() => openConfigSemaine(emp, 'B')}
                      >
                        B {emp.semaine_b_config ? '✓' : ''}
                      </Button>
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-gray-200 rounded-lg focus:border-pink-400 focus:ring-1 focus:ring-pink-200"
                        defaultValue={emp.heures_semaine_a || 35}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'heures_semaine_a', parseFloat(e.target.value) || 35)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-gray-200 rounded-lg focus:border-pink-400 focus:ring-1 focus:ring-pink-200"
                        defaultValue={emp.heures_semaine_b || 35}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'heures_semaine_b', parseFloat(e.target.value) || 35)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-purple-300 rounded-lg bg-purple-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 font-semibold text-purple-700"
                        defaultValue={emp.heures_semaine_fixe || 35}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'heures_semaine_fixe', parseFloat(e.target.value) || 35)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        step="0.5"
                        className="h-9 w-16 text-center border-2 border-orange-200 rounded-lg bg-orange-50 focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        defaultValue={emp.heures_demi_journee_conge || 4}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'heures_demi_journee_conge', parseFloat(e.target.value) || 4)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION ASSISTANTS */}
            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">👥</span>
                <h3 className="font-bold text-green-800 text-lg">Assistants</h3>
              </div>
              
              {/* En-tête du tableau */}
              <div className="grid grid-cols-7 gap-3 mb-3 px-2">
                <div className="font-semibold text-gray-600 text-sm">Nom</div>
                <div className="font-semibold text-gray-600 text-sm text-center">Semaine Type</div>
                <div className="font-semibold text-gray-600 text-sm text-center">½j Sem A</div>
                <div className="font-semibold text-gray-600 text-sm text-center">½j Sem B</div>
                <div className="font-semibold text-green-700 text-sm text-center">H/½j Travail</div>
                <div className="font-semibold text-purple-700 text-sm text-center">Heures Contrat</div>
                <div className="font-semibold text-orange-600 text-sm text-center">H/½j Congé</div>
              </div>
              
              {/* Liste des employés */}
              <div className="space-y-2">
                {users.filter(u => u.actif && u.role === 'Assistant').map(emp => (
                  <div key={emp.id} className="grid grid-cols-7 gap-3 items-center bg-white p-3 rounded-lg shadow-sm border border-green-100">
                    <div className="font-medium text-gray-800">{emp.prenom} {emp.nom}</div>
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant={emp.semaine_a_config ? "default" : "outline"}
                        className={`h-8 px-3 text-xs ${emp.semaine_a_config ? "bg-green-600 hover:bg-green-700" : "hover:bg-green-100"}`}
                        onClick={() => openConfigSemaine(emp, 'A')}
                      >
                        A {emp.semaine_a_config ? '✓' : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant={emp.semaine_b_config ? "default" : "outline"}
                        className={`h-8 px-3 text-xs ${emp.semaine_b_config ? "bg-green-600 hover:bg-green-700" : "hover:bg-green-100"}`}
                        onClick={() => openConfigSemaine(emp, 'B')}
                      >
                        B {emp.semaine_b_config ? '✓' : ''}
                      </Button>
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-1 focus:ring-green-200"
                        defaultValue={emp.limite_demi_journees_a || 10}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'limite_demi_journees_a', parseInt(e.target.value) || 10)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-1 focus:ring-green-200"
                        defaultValue={emp.limite_demi_journees_b || 10}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'limite_demi_journees_b', parseInt(e.target.value) || 10)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        step="0.5"
                        placeholder="-"
                        className={`h-9 w-16 text-center border-2 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-200 font-semibold ${emp.heures_demi_journee_travail ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-500'}`}
                        defaultValue={emp.heures_demi_journee_travail || ''}
                        onBlur={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          updateEmployeSemaineConfig(emp.id, 'heures_demi_journee_travail', val);
                        }}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-purple-300 rounded-lg bg-purple-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 font-semibold text-purple-700"
                        defaultValue={emp.heures_semaine_fixe || 40}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'heures_semaine_fixe', parseFloat(e.target.value) || 40)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        step="0.5"
                        className="h-9 w-16 text-center border-2 border-orange-200 rounded-lg bg-orange-50 focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        defaultValue={emp.heures_demi_journee_conge || 4}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'heures_demi_journee_conge', parseFloat(e.target.value) || 4)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION MÉDECINS */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">👨‍⚕️</span>
                <h3 className="font-bold text-blue-800 text-lg">Médecins</h3>
              </div>
              
              {/* En-tête du tableau */}
              <div className="grid grid-cols-5 gap-3 mb-3 px-2">
                <div className="font-semibold text-gray-600 text-sm">Nom</div>
                <div className="font-semibold text-gray-600 text-sm text-center">Semaine Type</div>
                <div className="font-semibold text-gray-600 text-sm text-center">½j Sem A</div>
                <div className="font-semibold text-gray-600 text-sm text-center">½j Sem B</div>
                <div className="font-semibold text-blue-700 text-sm text-center">H/½j Travail</div>
              </div>
              
              {/* Liste des employés */}
              <div className="space-y-2">
                {users.filter(u => u.actif && u.role === 'Médecin').map(emp => (
                  <div key={emp.id} className="grid grid-cols-5 gap-3 items-center bg-white p-3 rounded-lg shadow-sm border border-blue-100">
                    <div className="font-medium text-gray-800">Dr. {emp.prenom} {emp.nom}</div>
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant={emp.semaine_a_config ? "default" : "outline"}
                        className={`h-8 px-3 text-xs ${emp.semaine_a_config ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-blue-100"}`}
                        onClick={() => openConfigSemaine(emp, 'A')}
                      >
                        A {emp.semaine_a_config ? '✓' : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant={emp.semaine_b_config ? "default" : "outline"}
                        className={`h-8 px-3 text-xs ${emp.semaine_b_config ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-blue-100"}`}
                        onClick={() => openConfigSemaine(emp, 'B')}
                      >
                        B {emp.semaine_b_config ? '✓' : ''}
                      </Button>
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                        defaultValue={emp.limite_demi_journees_a || 10}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'limite_demi_journees_a', parseInt(e.target.value) || 10)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        className="h-9 w-16 text-center border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                        defaultValue={emp.limite_demi_journees_b || 10}
                        onBlur={(e) => updateEmployeSemaineConfig(emp.id, 'limite_demi_journees_b', parseInt(e.target.value) || 10)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="number"
                        step="0.5"
                        placeholder="-"
                        className={`h-9 w-16 text-center border-2 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 font-semibold ${emp.heures_demi_journee_travail ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-red-300 bg-red-50 text-red-500'}`}
                        defaultValue={emp.heures_demi_journee_travail || ''}
                        onBlur={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          updateEmployeSemaineConfig(emp.id, 'heures_demi_journee_travail', val);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Légende */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h4 className="font-semibold text-gray-700 mb-2">💡 Légende des couleurs dans le planning :</h4>
              <div className="flex gap-6 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-yellow-200 border"></span>
                  <span>Heures faites = Contrat</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-green-200 border"></span>
                  <span>Heures à récupérer</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-red-200 border"></span>
                  <span>Heures supplémentaires</span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button 
              className="bg-gray-800 hover:bg-gray-900 text-white px-6"
              onClick={() => setShowConfigSemainesModal(false)}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Détail Configuration Semaine (pour un employé) */}
      <Dialog open={configSemaineEmploye !== null} onOpenChange={(open) => !open && setConfigSemaineEmploye(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-teal-600" />
              <span>
                Semaine {configSemaineType} - {configSemaineEmploye?.prenom} {configSemaineEmploye?.nom}
              </span>
            </DialogTitle>
            <DialogDescription>
              {configSemaineEmploye?.role === 'Secrétaire' 
                ? 'Définissez les horaires de travail pour chaque jour'
                : 'Cochez les demi-journées de présence'}
            </DialogDescription>
          </DialogHeader>
          
          {configSemaineEmploye && (
            <div className="space-y-3">
              {/* Interface pour Secrétaires - Horaires */}
              {configSemaineEmploye.role === 'Secrétaire' && configSemaineEmploye.tempConfig && (
                <div className="space-y-2">
                  {configSemaineEmploye.tempConfig.map((jour, idx) => (
                    <div key={jour.jour} className={`grid grid-cols-6 gap-2 items-center p-2 rounded ${jour.actif ? 'bg-pink-50' : 'bg-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={jour.actif}
                          onChange={(e) => {
                            const newConfig = [...configSemaineEmploye.tempConfig];
                            newConfig[idx].actif = e.target.checked;
                            setConfigSemaineEmploye({...configSemaineEmploye, tempConfig: newConfig});
                          }}
                          className="w-4 h-4"
                        />
                        <span className="font-medium text-sm">{jour.jour}</span>
                      </div>
                      {jour.actif ? (
                        <>
                          <div>
                            <Label className="text-xs">Début M</Label>
                            <Input
                              type="time"
                              className="h-8 text-xs"
                              value={jour.debut_matin}
                              onChange={(e) => {
                                const newConfig = [...configSemaineEmploye.tempConfig];
                                newConfig[idx].debut_matin = e.target.value;
                                setConfigSemaineEmploye({...configSemaineEmploye, tempConfig: newConfig});
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Fin M</Label>
                            <Input
                              type="time"
                              className="h-8 text-xs"
                              value={jour.fin_matin}
                              onChange={(e) => {
                                const newConfig = [...configSemaineEmploye.tempConfig];
                                newConfig[idx].fin_matin = e.target.value;
                                setConfigSemaineEmploye({...configSemaineEmploye, tempConfig: newConfig});
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Début AM</Label>
                            <Input
                              type="time"
                              className="h-8 text-xs"
                              value={jour.debut_aprem}
                              onChange={(e) => {
                                const newConfig = [...configSemaineEmploye.tempConfig];
                                newConfig[idx].debut_aprem = e.target.value;
                                setConfigSemaineEmploye({...configSemaineEmploye, tempConfig: newConfig});
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Fin AM</Label>
                            <Input
                              type="time"
                              className="h-8 text-xs"
                              value={jour.fin_aprem}
                              onChange={(e) => {
                                const newConfig = [...configSemaineEmploye.tempConfig];
                                newConfig[idx].fin_aprem = e.target.value;
                                setConfigSemaineEmploye({...configSemaineEmploye, tempConfig: newConfig});
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="col-span-5 text-center text-gray-500 text-sm italic">
                          Absent
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Interface pour Médecins/Assistants - Demi-journées */}
              {(configSemaineEmploye.role === 'Médecin' || configSemaineEmploye.role === 'Assistant') && configSemaineEmploye.tempConfig && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-600 pb-2 border-b">
                    <span>Jour</span>
                    <span>🌅 Matin</span>
                    <span>🌆 Après-midi</span>
                  </div>
                  {configSemaineEmploye.tempConfig.map((jour, idx) => (
                    <div key={jour.jour} className={`grid grid-cols-3 gap-2 items-center p-2 rounded ${
                      configSemaineEmploye.role === 'Médecin' ? 'bg-blue-50' : 'bg-green-50'
                    }`}>
                      <span className="font-medium text-sm">{jour.jour}</span>
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={jour.matin}
                          onChange={(e) => {
                            const newConfig = [...configSemaineEmploye.tempConfig];
                            newConfig[idx].matin = e.target.checked;
                            setConfigSemaineEmploye({...configSemaineEmploye, tempConfig: newConfig});
                          }}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </div>
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={jour.apres_midi}
                          onChange={(e) => {
                            const newConfig = [...configSemaineEmploye.tempConfig];
                            newConfig[idx].apres_midi = e.target.checked;
                            setConfigSemaineEmploye({...configSemaineEmploye, tempConfig: newConfig});
                          }}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setConfigSemaineEmploye(null)}>
              Annuler
            </Button>
            <Button onClick={saveConfigSemaine} className="bg-teal-600 hover:bg-teal-700">
              💾 Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

const PlanCabinetCompact = ({ selectedDate, isDirector, onRefresh, centreActif }) => {
  const [planMatin, setPlanMatin] = useState(null);
  const [planApresMidi, setPlanApresMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSalle, setSelectedSalle] = useState(null);
  const [selectedCreneau, setSelectedCreneau] = useState(null);
  const [employesPresents, setEmployesPresents] = useState([]);

  useEffect(() => {
    fetchPlans();
  }, [selectedDate, centreActif?.id]); // Recharger quand le centre change

  const fetchPlans = async () => {
    try {
      const [matinResponse, apresMidiResponse] = await Promise.all([
        axios.get(`${API}/cabinet/plan/${selectedDate}?creneau=MATIN`),
        axios.get(`${API}/cabinet/plan/${selectedDate}?creneau=APRES_MIDI`)
      ]);
      setPlanMatin(matinResponse.data);
      setPlanApresMidi(apresMidiResponse.data);
    } catch (error) {
      console.error('Erreur chargement plan:', error);
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir le modal d'assignation
  const handleSalleClick = async (salle, creneau) => {
    if (!isDirector) return;
    
    setSelectedSalle(salle);
    setSelectedCreneau(creneau);
    
    // Charger les employés présents pour ce créneau
    try {
      const response = await axios.get(`${API}/planning/${selectedDate}`);
      const planning = response.data;
      
      // Filtrer selon le type de salle
      let roleFilter = [];
      if (salle.type_salle === 'MEDECIN') {
        roleFilter = ['Médecin'];
      } else if (salle.type_salle === 'ASSISTANT') {
        roleFilter = ['Assistant'];
      } else if (salle.type_salle === 'ATTENTE') {
        roleFilter = ['Médecin']; // Les salles d'attente sont pour les médecins
      }
      
      // Récupérer les médecins présents ce créneau pour afficher leurs initiales
      const medecinsPresents = planning.filter(p => 
        p.creneau === creneau && p.employe_role === 'Médecin'
      );
      
      // Créer un map des médecins par ID pour accès rapide
      const medecinsMap = {};
      medecinsPresents.forEach(m => {
        if (m.employe) {
          medecinsMap[m.employe_id] = m.employe;
        }
      });
      
      const presents = planning.filter(p => 
        p.creneau === creneau && 
        roleFilter.includes(p.employe_role)
      ).map(p => {
        // Pour les assistants, récupérer les initiales des médecins associés
        let medecinsInitiales = '';
        if (p.employe_role === 'Assistant' && p.medecin_ids && p.medecin_ids.length > 0) {
          const initiales = p.medecin_ids
            .map(medId => {
              const med = medecinsMap[medId];
              if (med) {
                return `${med.prenom?.charAt(0) || ''}${med.nom?.charAt(0) || ''}`.toUpperCase();
              }
              return null;
            })
            .filter(Boolean);
          medecinsInitiales = initiales.join(', ');
        }
        
        return {
          ...p,
          isAssigned: salle.type_salle === 'ATTENTE' 
            ? p.salle_attente === salle.nom
            : p.salle_attribuee === salle.nom,
          hasAnySalle: salle.type_salle === 'ATTENTE'
            ? !!p.salle_attente
            : !!p.salle_attribuee,
          medecinsInitiales
        };
      });
      
      setEmployesPresents(presents);
      setShowAssignModal(true);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des employés');
    }
  };

  // Assigner la salle à un employé
  const handleAssignSalle = async (creneauId, employe) => {
    try {
      const updateData = selectedSalle.type_salle === 'ATTENTE'
        ? { salle_attente: selectedSalle.nom }
        : { salle_attribuee: selectedSalle.nom };
      
      await axios.put(`${API}/planning/${creneauId}`, updateData);
      toast.success(`${selectedSalle.nom} assignée à ${employe.prenom} ${employe.nom}`);
      setShowAssignModal(false);
      fetchPlans();
      // Rafraîchir le planning principal
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Erreur lors de l\'assignation');
    }
  };

  // Retirer l'assignation
  const handleRemoveAssign = async (creneauId) => {
    try {
      const updateData = selectedSalle.type_salle === 'ATTENTE'
        ? { salle_attente: '' }
        : { salle_attribuee: '' };
      
      await axios.put(`${API}/planning/${creneauId}`, updateData);
      toast.success('Assignation retirée');
      setShowAssignModal(false);
      fetchPlans();
      // Rafraîchir le planning principal
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Erreur lors du retrait');
    }
  };

  // Copier les assignations d'un créneau vers un autre (Matin → AM ou AM → Matin)
  const copyAssignations = async (direction) => {
    if (!isDirector) return;
    
    try {
      const sourcePlan = direction === 'matinToAM' ? planMatin : planApresMidi;
      const targetCreneau = direction === 'matinToAM' ? 'APRES_MIDI' : 'MATIN';
      const sourceLabel = direction === 'matinToAM' ? 'Matin' : 'Après-midi';
      const targetLabel = direction === 'matinToAM' ? 'Après-midi' : 'Matin';
      
      if (!sourcePlan || !sourcePlan.salles) {
        toast.error(`Aucune donnée ${sourceLabel} à copier`);
        return;
      }
      
      // Récupérer le planning de la date pour le créneau cible
      const targetPlanningResponse = await axios.get(`${API}/planning/semaine/${selectedDate}`);
      const planningParJour = targetPlanningResponse.data.planning?.[selectedDate] || {};
      
      // Récupérer les créneaux du créneau cible (MATIN ou APRES_MIDI)
      const targetPlanning = planningParJour[targetCreneau] || [];
      
      if (targetPlanning.length === 0) {
        toast.warning(`Aucun créneau ${targetLabel} trouvé pour cette date`);
        return;
      }
      
      let copiedCount = 0;
      let skippedCount = 0;
      const errors = [];
      
      // Pour chaque salle avec une occupation dans le plan source
      for (const salle of sourcePlan.salles) {
        // Vérifier que la salle a une occupation avec un employé
        if (!salle.occupation || !salle.occupation.employe || !salle.occupation.employe.id) continue;
        
        const employeId = salle.occupation.employe.id;
        const salleNom = salle.nom;
        const typeSalle = salle.type_salle;
        
        // Vérifier si l'employé est présent dans le créneau cible
        const targetCreneauEmp = targetPlanning.find(c => c.employe_id === employeId);
        
        if (!targetCreneauEmp) {
          skippedCount++;
          continue; // L'employé n'est pas présent dans le créneau cible
        }
        
        try {
          // Mettre à jour le créneau cible avec l'assignation
          const updateData = typeSalle === 'ATTENTE' 
            ? { salle_attente: salleNom }
            : { salle_attribuee: salleNom };
          
          await axios.put(`${API}/planning/${targetCreneauEmp.id}`, updateData);
          copiedCount++;
        } catch (err) {
          errors.push(`${salle.nom}: ${err.response?.data?.detail || err.message}`);
        }
      }
      
      if (copiedCount > 0) {
        toast.success(`${copiedCount} assignation(s) copiée(s) du ${sourceLabel} vers l'${targetLabel}`);
      }
      if (skippedCount > 0) {
        toast.info(`${skippedCount} employé(s) absent(s) l'${targetLabel}`);
      }
      if (copiedCount === 0 && skippedCount === 0) {
        toast.info(`Aucune assignation à copier`);
      }
      if (errors.length > 0) {
        console.error('Erreurs:', errors);
        toast.warning(`${errors.length} erreur(s) lors de la copie`);
      }
      
      fetchPlans();
      // Rafraîchir le planning principal
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erreur copie assignations:', error);
      toast.error(`Erreur: ${error.response?.data?.detail || error.message || 'Erreur inconnue'}`);
    }
  };

  const renderSalle = (salle, creneau) => {
    const occupation = salle.occupation;
    const baseClasses = "absolute border-2 rounded-lg p-1 text-xs font-medium transition-all flex flex-col justify-center items-center";
    
    let bgColor = 'bg-gray-100 border-gray-300';
    let textColor = 'text-gray-600';
    let cursorClass = isDirector ? 'cursor-pointer hover:shadow-lg hover:scale-105' : '';
    
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
    
    // Ajuster position_x pour supprimer colonnes 0 et 6 (décaler de -1 si > 0)
    const adjustedX = salle.position_x > 0 ? salle.position_x - 1 : 0;
    
    // Style pour utiliser CSS Grid (gridColumn et gridRow)
    const style = {
      gridColumn: adjustedX + 1,
      gridRow: salle.position_y + 1,
    };

    const getInitiales = (employe) => {
      if (!employe) return '';
      const prenom = employe.prenom || '';
      const nom = employe.nom || '';
      return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
    };
    
    return (
      <div
        key={salle.id}
        className={`border-2 rounded-lg p-2 text-xs font-medium transition-all flex flex-col justify-center items-center min-h-[70px] ${bgColor} ${textColor} ${cursorClass}`}
        style={style}
        onClick={() => handleSalleClick(salle, creneau)}
        title={
          occupation 
            ? `${salle.nom} - ${occupation.employe?.prenom} ${occupation.employe?.nom}${isDirector ? ' (Cliquer pour modifier)' : ''}`
            : `${salle.nom} - Libre${isDirector ? ' (Cliquer pour assigner)' : ''}`
        }
      >
        <div className="text-center w-full">
          <div className="font-bold text-[10px] mb-0.5 truncate px-1">{salle.nom}</div>
          {occupation ? (
            <div className="space-y-0.5">
              <div className="text-[9px] font-bold bg-white bg-opacity-70 rounded-full w-5 h-5 flex items-center justify-center mx-auto border">
                {getInitiales(occupation.employe)}
              </div>
              <div className="text-[9px] leading-tight truncate px-1">
                {occupation.employe?.prenom?.charAt(0)}. {occupation.employe?.nom?.substring(0, 6)}
              </div>
            </div>
          ) : (
            <div className="text-[9px] text-gray-500">Libre</div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return null;
  }
  
  // Ne pas afficher si aucune salle dans les deux plans
  const hasSallesMatin = planMatin?.salles?.length > 0;
  const hasSallesAM = planApresMidi?.salles?.length > 0;
  
  if (!hasSallesMatin && !hasSallesAM) {
    return null; // Pas de plan à afficher pour ce centre
  }

  return (
    <>
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5" />
          <span>Plan du Cabinet</span>
          <span className="text-sm font-normal text-gray-500">
            ({new Date(selectedDate).toLocaleDateString('fr-FR')})
          </span>
          {isDirector && (
            <span className="text-xs text-teal-600 font-normal ml-2">
              💡 Cliquez sur une salle pour l'assigner
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-stretch gap-4 w-full">
          {/* Plan Matin */}
          {planMatin && planMatin.salles && planMatin.salles.length > 0 && (
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-semibold text-amber-500 flex items-center justify-center space-x-2">
                <span>☀️</span>
                <span>Matin</span>
              </h3>
              <div 
                className="bg-amber-50 rounded-lg p-4 border border-amber-200"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.max(...planMatin.salles.filter(s => s.position_x > 0 && s.position_x < 6).map(s => s.position_x))}, minmax(80px, 1fr))`,
                  gap: '8px'
                }}
              >
                {planMatin.salles.filter(s => s.position_x > 0 && s.position_x < 6).map(salle => renderSalle(salle, 'MATIN'))}
              </div>
            </div>
          )}
          
          {/* Boutons de copie flèches */}
          {isDirector && planMatin && planApresMidi && (
            <div className="flex lg:flex-col flex-row items-center justify-center space-x-4 lg:space-x-0 lg:space-y-4 py-4 lg:py-8 flex-shrink-0">
              <button
                onClick={() => copyAssignations('matinToAM')}
                className="flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all hover:scale-110"
                title="Copier le Matin vers l'Après-midi"
              >
                <span className="text-lg">→</span>
              </button>
              <div className="text-xs text-gray-500 text-center hidden lg:block">
                Copier<br/>salles
              </div>
              <button
                onClick={() => copyAssignations('amToMatin')}
                className="flex items-center justify-center w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg transition-all hover:scale-110"
                title="Copier l'Après-midi vers le Matin"
              >
                <span className="text-lg">←</span>
              </button>
            </div>
          )}
          
          {/* Plan Après-midi */}
          {planApresMidi && planApresMidi.salles && planApresMidi.salles.length > 0 && (
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-semibold text-indigo-600 flex items-center justify-center space-x-2">
                <span>🌙</span>
                <span>Après-midi</span>
              </h3>
              <div 
                className="bg-indigo-50 rounded-lg p-4 border border-indigo-200"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.max(...planApresMidi.salles.filter(s => s.position_x > 0 && s.position_x < 6).map(s => s.position_x))}, minmax(80px, 1fr))`,
                  gap: '8px'
                }}
              >
                {planApresMidi.salles.filter(s => s.position_x > 0 && s.position_x < 6).map(salle => renderSalle(salle, 'APRES_MIDI'))}
              </div>
            </div>
          )}
        </div>
        
        {/* Légende commune */}
        <div className="mt-4 bg-white p-4 rounded-lg shadow border">
          <h4 className="font-medium mb-3 text-sm">Légende</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-400 rounded"></div>
              <span>Médecin</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-100 border border-green-400 rounded"></div>
              <span>Assistant</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-400 rounded"></div>
              <span>Attente</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
              <span>Libre</span>
            </div>
          </div>
        </div>
        
        {!isDirector && (
          <p className="text-xs text-gray-500 mt-3 italic">
            💡 Seul le Directeur peut modifier le plan du cabinet via le menu dédié
          </p>
        )}
      </CardContent>
    </Card>

    {/* Modal d'assignation de salle */}
    <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedSalle?.type_salle === 'ATTENTE' ? '🪑' : '🏥'} Assigner {selectedSalle?.nom}
          </DialogTitle>
          <DialogDescription>
            {selectedCreneau === 'MATIN' ? 'Matin' : 'Après-midi'} - {new Date(selectedDate).toLocaleDateString('fr-FR')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          {employesPresents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Aucun {selectedSalle?.type_salle === 'MEDECIN' || selectedSalle?.type_salle === 'ATTENTE' ? 'médecin' : 'assistant'} présent ce créneau
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">
                Les noms en <b>gras</b> ont déjà une salle assignée. Cliquez pour assigner cette salle.
              </p>
              {employesPresents.map(emp => (
                <div
                  key={emp.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    emp.isAssigned 
                      ? 'bg-green-100 border-green-400' 
                      : emp.hasAnySalle 
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-blue-50'
                  }`}
                  onClick={() => {
                    if (emp.isAssigned) {
                      handleRemoveAssign(emp.id);
                    } else {
                      handleAssignSalle(emp.id, emp.employe);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`${emp.hasAnySalle ? 'font-bold' : ''}`}>
                        {emp.employe_role === 'Médecin' ? 'Dr. ' : ''}
                        {emp.employe?.prenom} {emp.employe?.nom}
                      </span>
                      {/* Afficher les initiales des médecins pour les assistants */}
                      {emp.employe_role === 'Assistant' && emp.medecinsInitiales && (
                        <span className="text-xs text-gray-500 block">
                          (avec {emp.medecinsInitiales})
                        </span>
                      )}
                      {emp.hasAnySalle && !emp.isAssigned && (
                        <span className="text-xs text-yellow-600 ml-2">
                          (déjà en {selectedSalle?.type_salle === 'ATTENTE' ? emp.salle_attente : emp.salle_attribuee})
                        </span>
                      )}
                    </div>
                    {emp.isAssigned ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Assigné ici</span>
                    ) : (
                      <span className="text-xs text-blue-600">Cliquer pour assigner</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => setShowAssignModal(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};


// Demandes de Travail Component
const DemandesTravailManager = () => {
  const [demandes, setDemandes] = useState([]);
  const [semainesTypes, setSemainesTypes] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [medecinSelectionne, setMedecinSelectionne] = useState('');
  const [filterStatut, setFilterStatut] = useState('TOUT'); // TOUT, EN_ATTENTE, APPROUVEE
  const [filterMedecin, setFilterMedecin] = useState('TOUS'); // TOUS ou ID d'un médecin
  const [showDemandeModal, setShowDemandeModal] = useState(false);
  const [showSemaineTypeModal, setShowSemaineTypeModal] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [typedemande, setTypeDemande] = useState('individuelle'); // 'individuelle' ou 'semaine'
  
  // Récupérer la date du planning depuis le contexte
  const { planningSelectedDate, planningViewMode } = usePlanning();
  
  const [newDemande, setNewDemande] = useState({
    date_demandee: '',
    creneau: 'MATIN',
    motif: '',
    semaine_type_id: '',
    date_debut_semaine: ''
  });
  
  // Pré-remplir la date quand le modal s'ouvre si on vient de la vue journalière
  useEffect(() => {
    if (showDemandeModal && planningViewMode === 'jour' && planningSelectedDate) {
      setNewDemande(prev => ({
        ...prev,
        date_demandee: planningSelectedDate
      }));
    }
  }, [showDemandeModal, planningViewMode, planningSelectedDate]);
  
  const [newSemaineType, setNewSemaineType] = useState({
    nom: '',
    description: '',
    lundi: 'REPOS',
    mardi: 'REPOS',
    mercredi: 'REPOS',
    jeudi: 'REPOS',
    vendredi: 'REPOS',
    samedi: 'REPOS',
    dimanche: 'REPOS',
    horaire_debut: '08:00',
    horaire_fin: '18:00',
    horaire_pause_debut: '12:00',
    horaire_pause_fin: '14:00'
  });
  const [loading, setLoading] = useState(true);
  const [showAnnulationModal, setShowAnnulationModal] = useState(false);
  const [demandeIdAnnulation, setDemandeIdAnnulation] = useState(null);
  const [raisonAnnulation, setRaisonAnnulation] = useState('');
  const [typeAnnulation, setTypeAnnulation] = useState(''); // 'demander', 'approuver', 'rejeter', 'directe'
  const [showDemandeMensuelleModal, setShowDemandeMensuelleModal] = useState(false);
  const [demandeMensuelle, setDemandeMensuelle] = useState({
    medecin_id: '',
    date_debut: '',
    semaine_type_id: '',
    motif: '',
    jours_exclus: []
  });
  const [joursDisponibles, setJoursDisponibles] = useState([]);
  const [creneauxExistantsMois, setCreneauxExistantsMois] = useState([]); // Créneaux déjà validés du médecin
  
  // États pour la demande annuelle (médecins)
  const [showDemandeAnnuelleModal, setShowDemandeAnnuelleModal] = useState(false);
  const [demandeAnnuelle, setDemandeAnnuelle] = useState({
    medecin_id: '',
    annee: new Date().getFullYear(),
    semaine_type_id: '',
    motif: ''
  });
  const [moisAnnee, setMoisAnnee] = useState([]); // 12 mois avec leurs jours
  const [moisSelectionne, setMoisSelectionne] = useState(0); // Index du mois affiché (0-11)
  
  // États pour la demande hebdomadaire (assistants/secrétaires)
  const [showDemandeHebdoModal, setShowDemandeHebdoModal] = useState(false);
  const [demandeHebdo, setDemandeHebdo] = useState({
    employe_id: '',
    date_debut: '',
    motif: ''
  });
  const [joursHebdoDisponibles, setJoursHebdoDisponibles] = useState([]);
  const [planningResume, setPlanningResume] = useState({}); // Résumé des présences par jour
  const [users, setUsers] = useState([]); // Liste des utilisateurs pour le filtre
  
  const { user } = useAuth();

  useEffect(() => {
    fetchDemandes();
    fetchConfiguration();
    fetchSemainesTypes();
    if (user?.role === 'Directeur') {
      fetchMedecins();
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.actif));
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs');
    }
  };

  // Charger les créneaux existants du médecin pour un mois donné
  const fetchCreneauxExistantsMois = async (medecinId, dateDebut) => {
    if (!medecinId || !dateDebut) {
      setCreneauxExistantsMois([]);
      return [];
    }
    
    try {
      const [year, month] = dateDebut.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      
      // Récupérer le planning de tout le mois
      const promises = [];
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        promises.push(axios.get(`${API}/planning/${dateStr}`));
      }
      
      const responses = await Promise.all(promises);
      const allCreneaux = [];
      
      responses.forEach((res, index) => {
        const day = index + 1;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Filtrer les créneaux du médecin concerné
        const creneauxMedecin = res.data.filter(c => c.employe_id === medecinId);
        creneauxMedecin.forEach(c => {
          allCreneaux.push({
            date: dateStr,
            creneau: c.creneau,
            notes: c.notes,
            salle: c.salle_attribuee
          });
        });
      });
      
      setCreneauxExistantsMois(allCreneaux);
      return allCreneaux;
    } catch (error) {
      console.error('Erreur lors du chargement des créneaux existants:', error);
      return [];
    }
  };

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

  const handleDemanderAnnulation = (demandeId) => {
    setDemandeIdAnnulation(demandeId);
    setTypeAnnulation('demander');
    setRaisonAnnulation('');
    setShowAnnulationModal(true);
  };

  const handleApprouverAnnulation = (demandeId, approuver) => {
    setDemandeIdAnnulation(demandeId);
    setTypeAnnulation(approuver ? 'approuver' : 'rejeter');
    setRaisonAnnulation('');
    setShowAnnulationModal(true);
  };

  const handleAnnulerDirectement = (demandeId) => {
    setDemandeIdAnnulation(demandeId);
    setTypeAnnulation('directe');
    setRaisonAnnulation('');
    setShowAnnulationModal(true);
  };

  const handleSubmitAnnulation = async (e) => {
    e.preventDefault();
    
    if (!raisonAnnulation.trim()) {
      toast.error('La raison est obligatoire');
      return;
    }

    try {
      if (typeAnnulation === 'demander') {
        // Médecin demande l'annulation
        await axios.post(`${API}/demandes-travail/${demandeIdAnnulation}/demander-annulation`, {
          raison: raisonAnnulation
        });
        toast.success('Demande d\'annulation envoyée avec succès');
      } else if (typeAnnulation === 'approuver' || typeAnnulation === 'rejeter') {
        // Directeur approuve ou rejette la demande d'annulation
        await axios.put(`${API}/demandes-travail/${demandeIdAnnulation}/approuver-annulation`, {
          approuve: typeAnnulation === 'approuver',
          commentaire: raisonAnnulation
        });
        toast.success(typeAnnulation === 'approuver' ? 'Annulation approuvée' : 'Demande d\'annulation rejetée');
      } else if (typeAnnulation === 'directe') {
        // Directeur annule directement
        await axios.post(`${API}/demandes-travail/${demandeIdAnnulation}/annuler-directement`, {
          raison: raisonAnnulation
        });
        toast.success('Créneau annulé avec succès');
      }
      
      setShowAnnulationModal(false);
      setRaisonAnnulation('');
      fetchDemandes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'annulation');
    }
  };

  const handleOpenDemandeMensuelle = async () => {
    const today = new Date();
    // Si on est après le 1er du mois, proposer le mois suivant
    let firstDay;
    if (today.getDate() > 1) {
      // Mois suivant
      firstDay = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    } else {
      // On est le 1er, on peut proposer le mois actuel
      firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    const dateDebutStr = firstDay.toISOString().split('T')[0];
    const medecinId = user?.role === 'Médecin' ? user.id : '';
    
    setDemandeMensuelle({
      medecin_id: medecinId,
      date_debut: dateDebutStr,
      semaine_type_id: '',
      motif: '',
      jours_exclus: []
    });
    
    // Charger les créneaux existants du médecin
    if (medecinId) {
      await fetchCreneauxExistantsMois(medecinId, dateDebutStr);
    } else {
      setCreneauxExistantsMois([]);
    }
    
    genererJoursMois(dateDebutStr, '');
    setShowDemandeMensuelleModal(true);
  };

  const genererJoursMois = (dateDebut, semaineTypeId) => {
    // Utiliser la date en format ISO pour éviter les problèmes de fuseau horaire
    const [year, month, dayStart] = dateDebut.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate(); // Dernier jour du mois
    
    const jours = [];
    const joursNoms = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const semaineType = semainesTypes.find(s => s.id === semaineTypeId);
    
    // Déterminer le jour de la semaine du 1er du mois (0=dimanche, 1=lundi, etc.)
    const premierJourDate = new Date(`${year}-${String(month).padStart(2, '0')}-01T12:00:00`);
    const premierJourSemaine = premierJourDate.getDay();
    
    // Calculer combien de cases vides ajouter pour que lundi soit toujours en première colonne
    // Si dimanche (0), on ajoute 6 cases vides; si lundi (1), 0 cases; si mardi (2), 1 case; etc.
    const casesVides = premierJourSemaine === 0 ? 6 : premierJourSemaine - 1;
    
    // Ajouter les cases vides au début
    for (let i = 0; i < casesVides; i++) {
      jours.push({
        date: null,
        jourNom: null,
        creneau: null,
        selectionne: false,
        estVide: true
      });
    }
    
    for (let day = 1; day <= lastDay; day++) {
      // Créer la date en format ISO pour éviter décalage fuseau horaire
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const currentDate = new Date(dateStr + 'T12:00:00'); // Midi pour éviter problèmes de fuseau
      const jourSemaine = joursNoms[currentDate.getDay()];
      
      let creneau = null; // Par défaut : rien de sélectionné
      let selectionne = false;
      
      if (semaineType) {
        const creneauType = semaineType[jourSemaine];
        // REPOS ou null = pas de créneau, sinon c'est sélectionné
        if (creneauType && creneauType !== 'REPOS') {
          creneau = creneauType;
          selectionne = true; // Marquer comme sélectionné si la semaine type définit un créneau
        }
      }
      // Sinon on laisse null pour permettre la sélection manuelle
      
      jours.push({
        date: dateStr,
        jourNom: jourSemaine,
        creneau: creneau,
        selectionne: selectionne, // Sélectionné si un créneau est défini par la semaine type
        estVide: false
      });
    }
    
    setJoursDisponibles(jours);
  };

  const handleDateDebutChange = (newDate) => {
    setDemandeMensuelle(prev => ({ ...prev, date_debut: newDate }));
    genererJoursMois(newDate, demandeMensuelle.semaine_type_id);
  };

  const handleSemaineTypeChangeMensuelle = (semaineTypeId) => {
    setDemandeMensuelle(prev => ({ ...prev, semaine_type_id: semaineTypeId }));
    genererJoursMois(demandeMensuelle.date_debut, semaineTypeId);
  };

  const handleMedecinChangeMensuelle = async (medecinId) => {
    setDemandeMensuelle(prev => ({ 
      ...prev, 
      medecin_id: medecinId,
      semaine_type_id: '' // Réinitialiser la semaine type quand on change de médecin
    }));
    // Charger les créneaux existants du médecin
    if (demandeMensuelle.date_debut) {
      await fetchCreneauxExistantsMois(medecinId, demandeMensuelle.date_debut);
    }
    // Regénérer les jours sans semaine type
    genererJoursMois(demandeMensuelle.date_debut, '');
  };

  // Vérifier si un créneau existe déjà pour une date et période
  const hasCreneauExistant = (date, creneau) => {
    if (!creneauxExistantsMois || creneauxExistantsMois.length === 0) return false;
    
    // Vérifier le créneau exact
    const existeExact = creneauxExistantsMois.some(c => c.date === date && c.creneau === creneau);
    if (existeExact) return true;
    
    // Si journée complète, vérifier aussi matin et après-midi
    if (creneau === 'JOURNEE_COMPLETE') {
      const existeMatin = creneauxExistantsMois.some(c => c.date === date && c.creneau === 'MATIN');
      const existeAM = creneauxExistantsMois.some(c => c.date === date && c.creneau === 'APRES_MIDI');
      return existeMatin && existeAM;
    }
    
    // Si on vérifie matin/après-midi, vérifier aussi si journée complète existe
    const existeJournee = creneauxExistantsMois.some(c => c.date === date && c.creneau === 'JOURNEE_COMPLETE');
    return existeJournee;
  };

  // Obtenir l'info des créneaux existants pour une date
  const getCreneauxExistantsForDate = (date) => {
    if (!creneauxExistantsMois) return [];
    return creneauxExistantsMois.filter(c => c.date === date);
  };

  const toggleJourSelection = (dateStr) => {
    // Vérifier les créneaux existants pour cette date
    const creneauxExistants = getCreneauxExistantsForDate(dateStr);
    const existeMatin = creneauxExistants.some(c => c.creneau === 'MATIN' || c.creneau === 'JOURNEE_COMPLETE');
    const existeAM = creneauxExistants.some(c => c.creneau === 'APRES_MIDI' || c.creneau === 'JOURNEE_COMPLETE');
    
    setJoursDisponibles(prev => prev.map(j => {
      if (j.date !== dateStr) return j;
      
      // Système cyclique adapté selon ce qui existe déjà
      let nouveauCreneau = null;
      let nouveauSelectionne = false;
      
      if (j.creneau === null) {
        // Si rien n'existe, proposer MATIN
        // Si matin existe mais pas AM, sauter à AM
        // Si tout existe, ne rien proposer
        if (!existeMatin) {
          nouveauCreneau = 'MATIN';
          nouveauSelectionne = true;
        } else if (!existeAM) {
          nouveauCreneau = 'APRES_MIDI';
          nouveauSelectionne = true;
        }
        // Si tout existe, on reste à null
      } else if (j.creneau === 'MATIN') {
        // Si AM n'existe pas, passer à AM
        // Sinon, si rien n'existe, passer à journée complète
        // Sinon, retour à null
        if (!existeAM) {
          nouveauCreneau = 'APRES_MIDI';
          nouveauSelectionne = true;
        } else if (!existeMatin && !existeAM) {
          nouveauCreneau = 'JOURNEE_COMPLETE';
          nouveauSelectionne = true;
        } else {
          nouveauCreneau = null;
          nouveauSelectionne = false;
        }
      } else if (j.creneau === 'APRES_MIDI') {
        // Si rien n'existe, proposer journée complète
        // Sinon retour à null
        if (!existeMatin && !existeAM) {
          nouveauCreneau = 'JOURNEE_COMPLETE';
          nouveauSelectionne = true;
        } else {
          nouveauCreneau = null;
          nouveauSelectionne = false;
        }
      } else {
        // JOURNEE_COMPLETE → retour à null
        nouveauCreneau = null;
        nouveauSelectionne = false;
      }
      
      return { ...j, creneau: nouveauCreneau, selectionne: nouveauSelectionne };
    }));
  };

  const handleSubmitDemandeMensuelle = async (e) => {
    e.preventDefault();
    
    // Vérifier que le médecin est sélectionné si directeur
    if (user?.role === 'Directeur' && !demandeMensuelle.medecin_id) {
      toast.error('Veuillez sélectionner un médecin');
      return;
    }
    
    // Construire la liste des jours avec leurs créneaux spécifiques
    const joursAvecCreneaux = joursDisponibles
      .filter(j => j.selectionne && j.creneau !== null)
      .map(j => ({
        date: j.date,
        creneau: j.creneau
      }));
    
    if (joursAvecCreneaux.length === 0) {
      toast.error('Veuillez sélectionner au moins un jour');
      return;
    }
    
    try {
      const response = await axios.post(`${API}/demandes-travail/mensuelle`, {
        medecin_id: demandeMensuelle.medecin_id || null,
        date_debut: demandeMensuelle.date_debut,
        semaine_type_id: (demandeMensuelle.semaine_type_id && demandeMensuelle.semaine_type_id !== 'none') ? demandeMensuelle.semaine_type_id : null,
        jours_avec_creneaux: joursAvecCreneaux, // Nouveau : envoyer date + créneau
        motif: demandeMensuelle.motif
      });
      
      toast.success(response.data.message || 'Demandes créées avec succès');
      setShowDemandeMensuelleModal(false);
      fetchDemandes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création des demandes');
    }
  };

  // ===== DEMANDE ANNUELLE (Médecins) =====
  const handleOpenDemandeAnnuelle = async () => {
    const today = new Date();
    const annee = today.getMonth() >= 10 ? today.getFullYear() + 1 : today.getFullYear(); // Si novembre/décembre, proposer l'année suivante
    const medecinId = user?.role === 'Médecin' ? user.id : '';
    
    setDemandeAnnuelle({
      medecin_id: medecinId,
      annee: annee,
      semaine_type_id: '',
      motif: ''
    });
    
    setMoisSelectionne(0); // Commencer par janvier
    genererJoursAnnee(annee, '');
    setShowDemandeAnnuelleModal(true);
  };

  const genererJoursAnnee = (annee, semaineTypeId) => {
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const joursNoms = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const semaineType = semainesTypes.find(s => s.id === semaineTypeId);
    
    const tousLesMois = [];
    
    for (let month = 0; month < 12; month++) {
      const lastDay = new Date(annee, month + 1, 0).getDate();
      const jours = [];
      
      // Calculer les cases vides pour aligner sur lundi
      const premierJourDate = new Date(annee, month, 1);
      const premierJourSemaine = premierJourDate.getDay();
      const casesVides = premierJourSemaine === 0 ? 6 : premierJourSemaine - 1;
      
      for (let i = 0; i < casesVides; i++) {
        jours.push({ date: null, jourNom: null, creneau: null, selectionne: false, estVide: true });
      }
      
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${annee}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const currentDate = new Date(dateStr + 'T12:00:00');
        const jourSemaine = joursNoms[currentDate.getDay()];
        
        let creneau = null;
        let selectionne = false;
        
        if (semaineType) {
          const creneauType = semaineType[jourSemaine];
          if (creneauType && creneauType !== 'REPOS') {
            creneau = creneauType;
            selectionne = true;
          }
        }
        
        jours.push({
          date: dateStr,
          jourNom: jourSemaine,
          creneau: creneau,
          selectionne: selectionne,
          estVide: false
        });
      }
      
      tousLesMois.push({
        nom: moisNoms[month],
        index: month,
        jours: jours
      });
    }
    
    setMoisAnnee(tousLesMois);
  };

  const handleAnneeChange = (nouvelleAnnee) => {
    setDemandeAnnuelle(prev => ({ ...prev, annee: nouvelleAnnee }));
    genererJoursAnnee(nouvelleAnnee, demandeAnnuelle.semaine_type_id);
  };

  const handleSemaineTypeChangeAnnuelle = (semaineTypeId) => {
    setDemandeAnnuelle(prev => ({ ...prev, semaine_type_id: semaineTypeId }));
    genererJoursAnnee(demandeAnnuelle.annee, semaineTypeId);
  };

  const handleMedecinChangeAnnuelle = (medecinId) => {
    setDemandeAnnuelle(prev => ({ 
      ...prev, 
      medecin_id: medecinId,
      semaine_type_id: ''
    }));
    genererJoursAnnee(demandeAnnuelle.annee, '');
  };

  const toggleJourAnnee = (moisIndex, jourIndex) => {
    setMoisAnnee(prev => {
      const newMois = [...prev];
      const jour = newMois[moisIndex].jours[jourIndex];
      if (jour.estVide) return prev;
      
      // Cycle: null -> MATIN -> APRES_MIDI -> JOURNEE_COMPLETE -> null
      if (!jour.selectionne || jour.creneau === null) {
        jour.selectionne = true;
        jour.creneau = 'MATIN';
      } else if (jour.creneau === 'MATIN') {
        jour.creneau = 'APRES_MIDI';
      } else if (jour.creneau === 'APRES_MIDI') {
        jour.creneau = 'JOURNEE_COMPLETE';
      } else {
        // Désélectionner
        jour.selectionne = false;
        jour.creneau = null;
      }
      return newMois;
    });
  };

  const cycleCreneauAnnee = (moisIndex, jourIndex, e) => {
    e.stopPropagation();
    setMoisAnnee(prev => {
      const newMois = [...prev];
      const jour = newMois[moisIndex].jours[jourIndex];
      if (!jour.selectionne) return prev;
      
      // Cycle: JOURNEE_COMPLETE -> MATIN -> APRES_MIDI -> JOURNEE_COMPLETE
      if (jour.creneau === 'JOURNEE_COMPLETE') jour.creneau = 'MATIN';
      else if (jour.creneau === 'MATIN') jour.creneau = 'APRES_MIDI';
      else jour.creneau = 'JOURNEE_COMPLETE';
      
      return newMois;
    });
  };

  const selectAllMois = (moisIndex, creneau = 'JOURNEE_COMPLETE') => {
    setMoisAnnee(prev => {
      const newMois = [...prev];
      newMois[moisIndex].jours.forEach(jour => {
        if (!jour.estVide && jour.jourNom !== 'samedi' && jour.jourNom !== 'dimanche') {
          jour.selectionne = true;
          jour.creneau = creneau;
        }
      });
      return newMois;
    });
  };

  const deselectAllMois = (moisIndex) => {
    setMoisAnnee(prev => {
      const newMois = [...prev];
      newMois[moisIndex].jours.forEach(jour => {
        if (!jour.estVide) {
          jour.selectionne = false;
          jour.creneau = null;
        }
      });
      return newMois;
    });
  };

  const getTotalJoursSelectionnesAnnee = () => {
    let total = 0;
    moisAnnee.forEach(mois => {
      mois.jours.forEach(jour => {
        if (jour.selectionne && jour.creneau) total++;
      });
    });
    return total;
  };

  const handleSubmitDemandeAnnuelle = async (e) => {
    e.preventDefault();
    
    if (user?.role === 'Directeur' && !demandeAnnuelle.medecin_id) {
      toast.error('Veuillez sélectionner un médecin');
      return;
    }
    
    // Collecter tous les jours sélectionnés de tous les mois
    const joursAvecCreneaux = [];
    moisAnnee.forEach(mois => {
      mois.jours.forEach(jour => {
        if (jour.selectionne && jour.creneau && !jour.estVide) {
          joursAvecCreneaux.push({
            date: jour.date,
            creneau: jour.creneau
          });
        }
      });
    });
    
    if (joursAvecCreneaux.length === 0) {
      toast.error('Veuillez sélectionner au moins un jour');
      return;
    }
    
    try {
      // Envoyer par lots de 31 jours (un mois) pour éviter les timeouts
      const batchSize = 31;
      let totalCreated = 0;
      
      for (let i = 0; i < joursAvecCreneaux.length; i += batchSize) {
        const batch = joursAvecCreneaux.slice(i, i + batchSize);
        const dateDebut = batch[0].date;
        
        const response = await axios.post(`${API}/demandes-travail/mensuelle`, {
          medecin_id: demandeAnnuelle.medecin_id || null,
          date_debut: dateDebut,
          semaine_type_id: (demandeAnnuelle.semaine_type_id && demandeAnnuelle.semaine_type_id !== 'none') ? demandeAnnuelle.semaine_type_id : null,
          jours_avec_creneaux: batch,
          motif: demandeAnnuelle.motif || `Demande annuelle ${demandeAnnuelle.annee}`
        });
        
        totalCreated += batch.length;
      }
      
      toast.success(`${totalCreated} demandes créées avec succès pour l'année ${demandeAnnuelle.annee}`);
      setShowDemandeAnnuelleModal(false);
      fetchDemandes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création des demandes');
    }
  };

  // ===== DEMANDE HEBDOMADAIRE (Assistants/Secrétaires) =====
  const handleOpenDemandeHebdo = () => {
    const today = new Date();
    // Trouver le lundi de la semaine prochaine
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    
    setDemandeHebdo({
      employe_id: user?.role === 'Directeur' ? '' : user?.id,
      date_debut: nextMonday.toISOString().split('T')[0],
      motif: ''
    });
    genererJoursSemaine(nextMonday.toISOString().split('T')[0]);
    setShowDemandeHebdoModal(true);
  };


  const genererJoursSemaine = async (dateDebut) => {
    const startDate = new Date(dateDebut + 'T12:00:00');
    // Trouver le lundi de cette semaine
    const day = startDate.getDay();
    const monday = new Date(startDate);
    monday.setDate(startDate.getDate() - (day === 0 ? 6 : day - 1));
    
    const jours = [];
    const joursNoms = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const resume = {};
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      jours.push({
        date: dateStr,
        jourNom: joursNoms[i],
        creneau: null,
        selectionne: false
      });
      
      // Récupérer le planning pour ce jour
      try {
        const res = await axios.get(`${API}/planning/${dateStr}`);
        const medecins = res.data.filter(p => p.employe_role === 'Médecin');
        const assistants = res.data.filter(p => p.employe_role === 'Assistant');
        resume[dateStr] = {
          medecinsMatin: medecins.filter(p => p.creneau === 'MATIN').length,
          medecinsAM: medecins.filter(p => p.creneau === 'APRES_MIDI').length,
          assistantsMatin: assistants.filter(p => p.creneau === 'MATIN').length,
          assistantsAM: assistants.filter(p => p.creneau === 'APRES_MIDI').length
        };
      } catch (error) {
        resume[dateStr] = { medecinsMatin: 0, medecinsAM: 0, assistantsMatin: 0, assistantsAM: 0 };
      }
    }
    
    setJoursHebdoDisponibles(jours);
    setPlanningResume(resume);
  };

  const handleDateDebutHebdoChange = (newDate) => {
    setDemandeHebdo(prev => ({ ...prev, date_debut: newDate }));
    genererJoursSemaine(newDate);
  };

  const toggleJourHebdoSelection = (dateStr) => {
    setJoursHebdoDisponibles(prev => prev.map(j => {
      if (j.date !== dateStr) return j;
      
      // Système cyclique : null → MATIN → APRES_MIDI → JOURNEE_COMPLETE → null
      let nouveauCreneau = null;
      let nouveauSelectionne = false;
      
      if (j.creneau === null) {
        nouveauCreneau = 'MATIN';
        nouveauSelectionne = true;
      } else if (j.creneau === 'MATIN') {
        nouveauCreneau = 'APRES_MIDI';
        nouveauSelectionne = true;
      } else if (j.creneau === 'APRES_MIDI') {
        nouveauCreneau = 'JOURNEE_COMPLETE';
        nouveauSelectionne = true;
      } else {
        nouveauCreneau = null;
        nouveauSelectionne = false;
      }
      
      return { ...j, creneau: nouveauCreneau, selectionne: nouveauSelectionne };
    }));
  };

  const handleSubmitDemandeHebdo = async (e) => {
    e.preventDefault();
    
    if (user?.role === 'Directeur' && !demandeHebdo.employe_id) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }
    
    const joursAvecCreneaux = joursHebdoDisponibles
      .filter(j => j.selectionne && j.creneau !== null)
      .map(j => ({
        date: j.date,
        creneau: j.creneau
      }));
    
    if (joursAvecCreneaux.length === 0) {
      toast.error('Veuillez sélectionner au moins un jour');
      return;
    }
    
    try {
      // Créer les demandes une par une (ou créer un endpoint batch)
      for (const jour of joursAvecCreneaux) {
        if (jour.creneau === 'JOURNEE_COMPLETE') {
          // Créer 2 demandes : matin + après-midi
          await axios.post(`${API}/demandes-travail`, {
            medecin_id: demandeHebdo.employe_id || user?.id,
            date_demandee: jour.date,
            creneau: 'MATIN',
            motif: demandeHebdo.motif || 'Demande hebdomadaire'
          });
          await axios.post(`${API}/demandes-travail`, {
            medecin_id: demandeHebdo.employe_id || user?.id,
            date_demandee: jour.date,
            creneau: 'APRES_MIDI',
            motif: demandeHebdo.motif || 'Demande hebdomadaire'
          });
        } else {
          await axios.post(`${API}/demandes-travail`, {
            medecin_id: demandeHebdo.employe_id || user?.id,
            date_demandee: jour.date,
            creneau: jour.creneau,
            motif: demandeHebdo.motif || 'Demande hebdomadaire'
          });
        }
      }
      
      toast.success('Demandes hebdomadaires créées avec succès');
      setShowDemandeHebdoModal(false);
      fetchDemandes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création des demandes');
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

  // Filtrer les demandes selon les critères sélectionnés
  const getFilteredDemandes = () => {
    let filtered = [...demandes];
    
    // Filtrer par statut
    if (filterStatut !== 'TOUT') {
      filtered = filtered.filter(d => d.statut === filterStatut);
    }
    
    // Filtrer par médecin
    if (filterMedecin !== 'TOUS') {
      filtered = filtered.filter(d => d.medecin_id === filterMedecin);
    }
    
    return filtered;
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

  const filteredDemandes = getFilteredDemandes();

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
        
        {/* Boutons pour Médecins et Directeur */}
        {(user?.role === 'Médecin' || user?.role === 'Directeur') && (
          <div className="flex space-x-2">
            <Button 
              onClick={handleOpenDemandeMensuelle}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700"
            >
              <Calendar className="h-4 w-4" />
              <span>Demande Mensuelle</span>
            </Button>
            
            <Button 
              onClick={handleOpenDemandeAnnuelle}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <Calendar className="h-4 w-4" />
              <span>Demande Annuelle</span>
            </Button>
            
            {user?.role === 'Médecin' && (
              <Button 
                onClick={() => setShowSemaineTypeModal(true)}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
              >
                <Clock className="h-4 w-4" />
                <span>Mes Semaines Types</span>
              </Button>
            )}
            
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
                          {semainesTypes
                            .filter(semaine => {
                              // Si directeur et médecin sélectionné, filtrer par ce médecin
                              if (user?.role === 'Directeur' && medecinSelectionne) {
                                return semaine.medecin_id === medecinSelectionne;
                              }
                              // Sinon afficher toutes les semaines (comportement par défaut)
                              return true;
                            })
                            .map(semaine => (
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
          </div>
        )}

        {/* Boutons pour Assistants et Secrétaires */}
        {(user?.role === 'Assistant' || user?.role === 'Secrétaire') && (
          <div className="flex space-x-2">
            <Button 
              onClick={handleOpenDemandeHebdo}
              className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700"
            >
              <Calendar className="h-4 w-4" />
              <span>Demande Hebdomadaire</span>
            </Button>
            
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
                </DialogHeader>
                <form onSubmit={handleCreateDemande} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={newDemande.date_demandee}
                      onChange={(e) => setNewDemande({...newDemande, date_demandee: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Créneau *</Label>
                    <Select
                      value={newDemande.creneau}
                      onValueChange={(value) => setNewDemande({...newDemande, creneau: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MATIN">🌅 Matin</SelectItem>
                        <SelectItem value="APRES_MIDI">🌆 Après-midi</SelectItem>
                        <SelectItem value="JOURNEE_COMPLETE">🌞 Journée complète</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Motif (optionnel)</Label>
                    <Textarea
                      value={newDemande.motif}
                      onChange={(e) => setNewDemande({...newDemande, motif: e.target.value})}
                      placeholder="Raison de la demande..."
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowDemandeModal(false)}>
                      Annuler
                    </Button>
                    <Button type="submit">Créer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
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

      {/* Filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700">Filtres</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtre par statut */}
              <div className="space-y-2">
                <Label>Statut</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={filterStatut === 'TOUT' ? 'default' : 'outline'}
                    onClick={() => setFilterStatut('TOUT')}
                  >
                    Tout ({demandes.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterStatut === 'EN_ATTENTE' ? 'default' : 'outline'}
                    onClick={() => setFilterStatut('EN_ATTENTE')}
                    className={filterStatut === 'EN_ATTENTE' ? '' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'}
                  >
                    En attente ({demandes.filter(d => d.statut === 'EN_ATTENTE').length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterStatut === 'APPROUVE' ? 'default' : 'outline'}
                    onClick={() => setFilterStatut('APPROUVE')}
                    className={filterStatut === 'APPROUVE' ? '' : 'border-green-300 text-green-700 hover:bg-green-50'}
                  >
                    Validées ({demandes.filter(d => d.statut === 'APPROUVE').length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterStatut === 'ANNULE' ? 'default' : 'outline'}
                    onClick={() => setFilterStatut('ANNULE')}
                    className={filterStatut === 'ANNULE' ? '' : 'border-red-300 text-red-700 hover:bg-red-50'}
                  >
                    Annulées ({demandes.filter(d => d.statut === 'ANNULE').length})
                  </Button>
                </div>
              </div>

              {/* Filtre par médecin */}
              {user?.role === 'Directeur' && (
                <div className="space-y-2">
                  <Label>Médecin</Label>
                  <Select value={filterMedecin} onValueChange={setFilterMedecin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOUS">Tous les médecins</SelectItem>
                      {medecins.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          Dr. {m.prenom} {m.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              {filteredDemandes.length} demande{filteredDemandes.length > 1 ? 's' : ''} affichée{filteredDemandes.length > 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredDemandes.map(demande => (
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
                  
                  {/* Afficher info demande d'annulation */}
                  {demande.demande_annulation && demande.raison_demande_annulation && (
                    <div className="text-sm bg-orange-50 border border-orange-200 p-3 rounded">
                      <strong className="text-orange-800">⚠️ Demande d'annulation:</strong>
                      <p className="text-gray-700 mt-1">{demande.raison_demande_annulation}</p>
                      {demande.date_demande_annulation && (
                        <p className="text-xs text-gray-500 mt-1">
                          Demandée le {new Date(demande.date_demande_annulation).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Afficher historique si annulé */}
                  {demande.statut === 'ANNULE' && (
                    <div className="text-sm bg-red-50 border border-red-200 p-3 rounded">
                      <strong className="text-red-800">❌ Créneau annulé</strong>
                      {demande.raison_annulation && (
                        <p className="text-gray-700 mt-1"><strong>Raison:</strong> {demande.raison_annulation}</p>
                      )}
                      {demande.date_annulation && (
                        <p className="text-xs text-gray-500 mt-1">
                          Annulé le {new Date(demande.date_annulation).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Boutons Directeur - Approuver/Rejeter demande EN_ATTENTE */}
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
                
                {/* Bouton Médecin - Demander annulation si APPROUVE */}
                {user?.role === 'Médecin' && demande.statut === 'APPROUVE' && demande.medecin_id === user.id && !demande.demande_annulation && (
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDemanderAnnulation(demande.id)}
                      className="text-orange-600 border-orange-600 hover:bg-orange-50"
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Demander annulation
                    </Button>
                  </div>
                )}
                
                {/* Badge si demande d'annulation en cours */}
                {demande.demande_annulation && (
                  <Badge className="ml-2 bg-orange-100 text-orange-800">
                    Demande d'annulation en cours
                  </Badge>
                )}
                
                {/* Boutons Directeur - Gérer demande d'annulation */}
                {user?.role === 'Directeur' && demande.demande_annulation && (
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleApprouverAnnulation(demande.id, true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approuver annulation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprouverAnnulation(demande.id, false)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Refuser
                    </Button>
                  </div>
                )}
                
                {/* Bouton Directeur - Annuler directement */}
                {user?.role === 'Directeur' && demande.statut === 'APPROUVE' && !demande.demande_annulation && (
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAnnulerDirectement(demande.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Annuler créneau
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

      {/* Modal Demande Annuelle (Médecins) */}
      <Dialog open={showDemandeAnnuelleModal} onOpenChange={setShowDemandeAnnuelleModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <span>📅 Demande Annuelle de Créneaux</span>
            </DialogTitle>
            <DialogDescription>
              Planifiez vos créneaux de travail pour une année entière. Sélectionnez les jours et choisissez le type de créneau.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitDemandeAnnuelle} className="space-y-4">
            {/* Sélection du médecin (pour Directeur) */}
            {user?.role === 'Directeur' && (
              <div className="space-y-2">
                <Label>Médecin *</Label>
                <Select
                  value={demandeAnnuelle.medecin_id}
                  onValueChange={handleMedecinChangeAnnuelle}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un médecin" />
                  </SelectTrigger>
                  <SelectContent>
                    {medecins.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        Dr. {m.prenom} {m.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Sélection de l'année et semaine type */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Année *</Label>
                <Select
                  value={String(demandeAnnuelle.annee)}
                  onValueChange={(v) => handleAnneeChange(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2].map(offset => {
                      const year = new Date().getFullYear() + offset;
                      return (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Semaine Type (optionnel)</Label>
                <Select
                  value={demandeAnnuelle.semaine_type_id || 'none'}
                  onValueChange={(v) => handleSemaineTypeChangeAnnuelle(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune (sélection manuelle)</SelectItem>
                    {semainesTypes.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Motif (optionnel)</Label>
                <Input
                  placeholder="Motif de la demande..."
                  value={demandeAnnuelle.motif}
                  onChange={(e) => setDemandeAnnuelle(prev => ({ ...prev, motif: e.target.value }))}
                />
              </div>
            </div>
            
            {/* Navigation entre les mois */}
            <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setMoisSelectionne(prev => Math.max(0, prev - 1))}
                disabled={moisSelectionne === 0}
              >
                ← Mois précédent
              </Button>
              
              <div className="flex items-center space-x-2">
                <span className="font-bold text-indigo-800 text-lg">
                  {moisAnnee[moisSelectionne]?.nom} {demandeAnnuelle.annee}
                </span>
                <span className="text-sm text-gray-500">
                  ({moisSelectionne + 1}/12)
                </span>
              </div>
              
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setMoisSelectionne(prev => Math.min(11, prev + 1))}
                disabled={moisSelectionne === 11}
              >
                Mois suivant →
              </Button>
            </div>
            
            {/* Actions rapides pour le mois */}
            <div className="flex space-x-2 justify-center">
              <Button type="button" variant="outline" size="sm" onClick={() => selectAllMois(moisSelectionne, 'JOURNEE_COMPLETE')}>
                ✓ Tout sélectionner (Journée)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => selectAllMois(moisSelectionne, 'MATIN')}>
                ✓ Tout sélectionner (Matin)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => selectAllMois(moisSelectionne, 'APRES_MIDI')}>
                ✓ Tout sélectionner (AM)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => deselectAllMois(moisSelectionne)}>
                ✗ Tout désélectionner
              </Button>
            </div>
            
            {/* Indication système de clics */}
            <div className="text-xs text-center text-gray-500 bg-gray-50 rounded p-2">
              💡 1 clic = 🌅 Matin | 2 clics = 🌆 Après-midi | 3 clics = 🌞 Journée | 4 clics = ⭕ Désactivé
            </div>
            
            {/* Calendrier du mois sélectionné */}
            {moisAnnee[moisSelectionne] && (
              <div className="border rounded-lg p-4">
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(j => (
                    <div key={j} className="font-bold text-sm text-gray-600 py-1">{j}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {moisAnnee[moisSelectionne].jours.map((jour, idx) => (
                    <div
                      key={idx}
                      className={`
                        p-2 rounded text-center cursor-pointer transition-all min-h-[60px] flex flex-col items-center justify-center
                        ${jour.estVide ? 'bg-transparent' : 
                          jour.selectionne 
                            ? jour.creneau === 'MATIN' ? 'bg-orange-200 hover:bg-orange-300 border-2 border-orange-500' 
                              : jour.creneau === 'APRES_MIDI' ? 'bg-purple-200 hover:bg-purple-300 border-2 border-purple-500'
                              : 'bg-indigo-200 hover:bg-indigo-300 border-2 border-indigo-500'
                            : jour.jourNom === 'samedi' || jour.jourNom === 'dimanche'
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                              : 'bg-gray-50 hover:bg-indigo-100'
                        }
                      `}
                      onClick={() => !jour.estVide && toggleJourAnnee(moisSelectionne, idx)}
                    >
                      {!jour.estVide && (
                        <>
                          <span className="text-sm font-medium">{new Date(jour.date + 'T12:00:00').getDate()}</span>
                          {jour.selectionne && (
                            <span 
                              className="text-xs font-bold mt-1 cursor-pointer hover:underline"
                              onClick={(e) => cycleCreneauAnnee(moisSelectionne, idx, e)}
                              title="Cliquer pour changer le créneau"
                            >
                              {jour.creneau === 'MATIN' ? 'M' : jour.creneau === 'APRES_MIDI' ? 'AM' : 'JC'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Résumé et légende */}
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
              <div className="flex space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 bg-indigo-200 border-2 border-indigo-500 rounded"></div>
                  <span>Journée (JC)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 bg-orange-200 border-2 border-orange-500 rounded"></div>
                  <span>Matin (M)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 bg-purple-200 border-2 border-purple-500 rounded"></div>
                  <span>Après-midi (AM)</span>
                </div>
              </div>
              <div className="font-bold text-indigo-700">
                📊 Total: {getTotalJoursSelectionnesAnnee()} jours sélectionnés
              </div>
            </div>
            
            {/* Boutons d'action */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowDemandeAnnuelleModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                📅 Créer les demandes ({getTotalJoursSelectionnesAnnee()} jours)
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Demande Hebdomadaire (Assistants/Secrétaires) */}
      <Dialog open={showDemandeHebdoModal} onOpenChange={setShowDemandeHebdoModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>📅 Demande Hebdomadaire</span>
            </DialogTitle>
            <DialogDescription>
              Créez des demandes de créneaux pour une semaine. Cliquez sur les jours pour sélectionner Matin, Après-midi ou Journée complète.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitDemandeHebdo} className="space-y-6">
            {/* Sélection employé pour le directeur */}
            {user?.role === 'Directeur' && (
              <div className="space-y-2">
                <Label>Employé (Assistant/Secrétaire) *</Label>
                <Select
                  value={demandeHebdo.employe_id}
                  onValueChange={(value) => setDemandeHebdo(prev => ({ ...prev, employe_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.actif && (u.role === 'Assistant' || u.role === 'Secrétaire')).map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.role === 'Assistant' ? '👥' : '📋'} {emp.prenom} {emp.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Sélection de la semaine */}
            <div className="space-y-2">
              <Label>Semaine du *</Label>
              <Input
                type="date"
                value={demandeHebdo.date_debut}
                onChange={(e) => handleDateDebutHebdoChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Motif */}
            <div className="space-y-2">
              <Label>Motif (optionnel)</Label>
              <Textarea
                value={demandeHebdo.motif}
                onChange={(e) => setDemandeHebdo(prev => ({ ...prev, motif: e.target.value }))}
                placeholder="Raison de la demande..."
              />
            </div>

            {/* Grille des jours de la semaine */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Jours de la semaine</Label>
                <div className="text-sm text-gray-600">
                  {joursHebdoDisponibles.filter(j => j.selectionne).length} jour(s) sélectionné(s)
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-7 gap-2">
                  {joursHebdoDisponibles.map(jour => {
                    const resume = planningResume[jour.date] || { medecinsMatin: 0, medecinsAM: 0, assistantsMatin: 0, assistantsAM: 0 };
                    return (
                      <div 
                        key={jour.date}
                        className={`
                          p-2 rounded border cursor-pointer text-center text-sm transition-colors
                          ${jour.creneau === 'MATIN' 
                            ? 'bg-orange-100 border-orange-500 text-orange-800' 
                            : jour.creneau === 'APRES_MIDI'
                            ? 'bg-purple-100 border-purple-500 text-purple-800'
                            : jour.creneau === 'JOURNEE_COMPLETE'
                            ? 'bg-green-100 border-green-500 text-green-800'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                        `}
                        onClick={() => toggleJourHebdoSelection(jour.date)}
                      >
                        <div className="font-bold capitalize">{jour.jourNom.substring(0, 3)}</div>
                        <div className="text-xs">{new Date(jour.date + 'T12:00:00').getDate()}/{new Date(jour.date + 'T12:00:00').getMonth() + 1}</div>
                        <div className="text-xs mt-1 font-semibold">
                          {jour.creneau === 'JOURNEE_COMPLETE' ? '🌞 Journée' :
                           jour.creneau === 'MATIN' ? '🌅 Matin' :
                           jour.creneau === 'APRES_MIDI' ? '🌆 AM' :
                           '⭕'}
                        </div>
                        {/* Résumé des présences */}
                        <div className="mt-2 pt-2 border-t border-gray-200 text-[10px]">
                          <div className="text-blue-600">👨‍⚕️ M:{resume.medecinsMatin} | AM:{resume.medecinsAM}</div>
                          <div className="text-green-600">👥 M:{resume.assistantsMatin} | AM:{resume.assistantsAM}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                💡 1 clic = 🌅 Matin | 2 clics = 🌆 Après-midi | 3 clics = 🌞 Journée | 4 clics = ⭕ Désactivé
              </p>
              <p className="text-xs text-blue-600 mt-1">
                📊 M = Matin | AM = Après-midi | 👨‍⚕️ Médecins prévus | 👥 Assistants prévus
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowDemandeHebdoModal(false)}>
                Annuler
              </Button>
              <Button 
                type="submit"
                disabled={joursHebdoDisponibles.filter(j => j.selectionne).length === 0}
              >
                Créer {joursHebdoDisponibles.filter(j => j.selectionne).length} demande(s)
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>



      {/* Modal Demande Mensuelle */}
      <Dialog open={showDemandeMensuelleModal} onOpenChange={setShowDemandeMensuelleModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>📅 Demande de Créneaux sur 1 Mois</span>
            </DialogTitle>
            <DialogDescription>
              Créez plusieurs demandes de créneaux pour tout un mois. Vous pouvez utiliser une semaine type ou personnaliser jour par jour.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitDemandeMensuelle} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {user?.role === 'Directeur' && (
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="medecin-mensuelle">Médecin *</Label>
                  <Select
                    value={demandeMensuelle.medecin_id}
                    onValueChange={handleMedecinChangeMensuelle}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un médecin" />
                    </SelectTrigger>
                    <SelectContent>
                      {medecins.filter(m => m.actif).map(medecin => (
                        <SelectItem key={medecin.id} value={medecin.id}>
                          Dr. {medecin.prenom} {medecin.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="date-debut-mensuelle">Mois / Date de début *</Label>
                <Input
                  id="date-debut-mensuelle"
                  type="date"
                  value={demandeMensuelle.date_debut}
                  onChange={(e) => handleDateDebutChange(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semaine-type-mensuelle">Semaine Type (Optionnel)</Label>
                <Select
                  value={demandeMensuelle.semaine_type_id}
                  onValueChange={handleSemaineTypeChangeMensuelle}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sans semaine type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans semaine type (Journée complète par défaut)</SelectItem>
                    {semainesTypes
                      .filter(semaine => {
                        // Si directeur et médecin sélectionné, filtrer par ce médecin
                        if (user?.role === 'Directeur' && demandeMensuelle.medecin_id) {
                          return semaine.medecin_id === demandeMensuelle.medecin_id;
                        }
                        // Sinon afficher toutes les semaines (comportement par défaut)
                        return true;
                      })
                      .map(semaine => (
                        <SelectItem key={semaine.id} value={semaine.id}>
                          {semaine.nom}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motif-mensuelle">Motif (Optionnel)</Label>
              <Textarea
                id="motif-mensuelle"
                value={demandeMensuelle.motif}
                onChange={(e) => setDemandeMensuelle(prev => ({ ...prev, motif: e.target.value }))}
                placeholder="Ex: Demande mensuelle janvier 2025..."
                rows={2}
              />
            </div>

            {/* Liste des jours avec cases à cocher */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Label>Jours demandés</Label>
                  {demandeMensuelle.date_debut && (
                    <span className="text-lg font-bold text-blue-600 capitalize">
                      - {new Date(demandeMensuelle.date_debut + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {joursDisponibles.filter(j => j.selectionne).length} jour(s) sélectionné(s)
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-gray-50 max-h-[300px] overflow-y-auto">
                {/* En-têtes des jours de la semaine (Lundi en premier) */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(jour => (
                    <div key={jour} className="text-center text-xs font-semibold text-gray-600 py-1">
                      {jour}
                    </div>
                  ))}
                </div>
                {/* Grille des jours */}
                <div className="grid grid-cols-7 gap-2">
                  {joursDisponibles.map((jour, index) => {
                    if (jour.estVide) {
                      return <div key={`vide-${index}`} className="p-2 rounded text-center text-sm"></div>;
                    }
                    
                    // Vérifier les créneaux existants
                    const creneauxExistants = getCreneauxExistantsForDate(jour.date);
                    const existeMatin = creneauxExistants.some(c => c.creneau === 'MATIN' || c.creneau === 'JOURNEE_COMPLETE');
                    const existeAM = creneauxExistants.some(c => c.creneau === 'APRES_MIDI' || c.creneau === 'JOURNEE_COMPLETE');
                    const toutExiste = existeMatin && existeAM;
                    
                    return (
                      <div 
                        key={jour.date}
                        className={`
                          p-2 rounded border cursor-pointer text-center text-sm transition-colors relative
                          ${toutExiste 
                            ? 'bg-gray-300 border-gray-500 text-gray-600 cursor-not-allowed'
                            : jour.creneau === 'MATIN' 
                            ? 'bg-orange-100 border-orange-500 text-orange-800' 
                            : jour.creneau === 'APRES_MIDI'
                            ? 'bg-purple-100 border-purple-500 text-purple-800'
                            : jour.creneau === 'JOURNEE_COMPLETE'
                            ? 'bg-green-100 border-green-500 text-green-800'
                            : 'bg-gray-100 border-gray-300 text-gray-500'
                          }
                        `}
                        onClick={() => !toutExiste && toggleJourSelection(jour.date)}
                        title={toutExiste ? 'Journée déjà complète' : existeMatin ? 'Matin déjà validé' : existeAM ? 'Après-midi déjà validé' : ''}
                      >
                        <div className="font-bold">{new Date(jour.date + 'T12:00:00').getDate()}</div>
                        {/* Indicateur créneaux existants */}
                        {(existeMatin || existeAM) && (
                          <div className="text-xs text-blue-600 font-bold">
                            {toutExiste ? '✅ Complet' : existeMatin ? '✓M' : existeAM ? '✓AM' : ''}
                          </div>
                        )}
                        <div className="text-xs mt-1 font-semibold">
                          {jour.creneau === 'JOURNEE_COMPLETE' ? '🌞 Journée' :
                           jour.creneau === 'MATIN' ? '🌅 Matin' :
                           jour.creneau === 'APRES_MIDI' ? '🌆 AM' :
                           toutExiste ? '' : '⭕'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Système de clics : 1 clic = 🌅 Matin | 2 clics = 🌆 Après-midi | 3 clics = 🌞 Journée | 4 clics = ⭕ Désactivé
                <br/>
                <span className="text-blue-600">✓M = Matin déjà validé | ✓AM = Après-midi déjà validé | ✅ = Journée complète déjà validée</span>
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowDemandeMensuelleModal(false)}>
                Annuler
              </Button>
              <Button 
                type="submit" 
                className="bg-purple-600 hover:bg-purple-700"
                disabled={joursDisponibles.filter(j => j.selectionne).length === 0}
              >
                Créer {joursDisponibles.filter(j => j.selectionne).length} demande(s)
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Annulation */}
      <Dialog open={showAnnulationModal} onOpenChange={setShowAnnulationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {typeAnnulation === 'demander' && '⚠️ Demander l\'annulation du créneau'}
              {typeAnnulation === 'approuver' && '✅ Approuver l\'annulation'}
              {typeAnnulation === 'rejeter' && '❌ Rejeter l\'annulation'}
              {typeAnnulation === 'directe' && '🗑️ Annuler le créneau'}
            </DialogTitle>
            <DialogDescription>
              {typeAnnulation === 'demander' && 'Expliquez pourquoi vous souhaitez annuler ce créneau. Le directeur examinera votre demande.'}
              {typeAnnulation === 'approuver' && 'Confirmez l\'approbation de cette demande d\'annulation. Le créneau sera supprimé du planning.'}
              {typeAnnulation === 'rejeter' && 'Expliquez pourquoi vous refusez cette demande d\'annulation.'}
              {typeAnnulation === 'directe' && 'Expliquez la raison de cette annulation. Le médecin sera notifié.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitAnnulation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="raison">
                {typeAnnulation === 'demander' || typeAnnulation === 'directe' ? 'Raison de l\'annulation *' : 'Commentaire *'}
              </Label>
              <Textarea
                id="raison"
                value={raisonAnnulation}
                onChange={(e) => setRaisonAnnulation(e.target.value)}
                placeholder={
                  typeAnnulation === 'demander' ? 'Ex: Imprévu personnel, maladie...' :
                  typeAnnulation === 'approuver' ? 'Ex: Demande acceptée, raison valable' :
                  typeAnnulation === 'rejeter' ? 'Ex: Période critique, besoin en personnel' :
                  'Ex: Réorganisation interne, urgence...'
                }
                rows={4}
                required
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAnnulationModal(false)}>
                Annuler
              </Button>
              <Button 
                type="submit"
                className={
                  typeAnnulation === 'approuver' ? 'bg-green-600 hover:bg-green-700' :
                  typeAnnulation === 'rejeter' ? 'bg-gray-600 hover:bg-gray-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }
              >
                {typeAnnulation === 'demander' && 'Envoyer la demande'}
                {typeAnnulation === 'approuver' && 'Approuver l\'annulation'}
                {typeAnnulation === 'rejeter' && 'Rejeter la demande'}
                {typeAnnulation === 'directe' && 'Annuler le créneau'}
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
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showTestNotificationModal, setShowTestNotificationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [editUserData, setEditUserData] = useState({ nom: '', prenom: '', email: '', role: '', password: '' });
  const [loading, setLoading] = useState(false);
  
  // États pour les notifications de test en masse
  const [employeesForTest, setEmployeesForTest] = useState([]);
  const [selectedEmployeesForTest, setSelectedEmployeesForTest] = useState([]);
  const [testNotificationTitle, setTestNotificationTitle] = useState('');
  const [testNotificationMessage, setTestNotificationMessage] = useState('');
  const [sendingTestNotification, setSendingTestNotification] = useState(false);

  useEffect(() => {
    fetchAllUsers();
    fetchEmployeesForTest();
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

  // Charger la liste des employés pour les notifications de test
  const fetchEmployeesForTest = async () => {
    try {
      const response = await axios.get(`${API}/notifications/employees-for-test`);
      setEmployeesForTest(response.data.employees || []);
    } catch (error) {
      console.error('Erreur lors du chargement des employés pour test:', error);
    }
  };

  // Envoyer des notifications de test à plusieurs employés
  const handleSendTestNotifications = async () => {
    if (selectedEmployeesForTest.length === 0) {
      toast.error('Sélectionnez au moins un employé');
      return;
    }
    if (!testNotificationTitle.trim() || !testNotificationMessage.trim()) {
      toast.error('Le titre et le message sont requis');
      return;
    }

    setSendingTestNotification(true);
    try {
      const response = await axios.post(`${API}/notifications/test`, {
        user_ids: selectedEmployeesForTest,
        title: testNotificationTitle.trim(),
        message: testNotificationMessage.trim()
      });
      
      toast.success(response.data.message);
      setShowTestNotificationModal(false);
      setSelectedEmployeesForTest([]);
      setTestNotificationTitle('');
      setTestNotificationMessage('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi des notifications de test');
    } finally {
      setSendingTestNotification(false);
    }
  };

  // Sélectionner/Désélectionner tous les employés pour le test
  const toggleSelectAllEmployees = () => {
    if (selectedEmployeesForTest.length === employeesForTest.length) {
      setSelectedEmployeesForTest([]);
    } else {
      setSelectedEmployeesForTest(employeesForTest.map(e => e.id));
    }
  };

  // Sélectionner/Désélectionner un employé pour le test
  const toggleEmployeeForTest = (employeeId) => {
    setSelectedEmployeesForTest(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleImpersonate = async (userId) => {
    try {
      const response = await axios.post(`${API}/admin/impersonate/${userId}`);
      
      // Sauvegarder le token original du directeur
      const currentToken = localStorage.getItem('token');
      localStorage.setItem('originalToken', currentToken);
      localStorage.setItem('isImpersonating', 'true');
      
      // Sauvegarder le nouveau token
      localStorage.setItem('token', response.data.access_token);
      
      // Mettre à jour l'en-tête d'autorisation d'axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      
      setUser(response.data.user);
      
      toast.success(`Connexion en tant que ${response.data.user.prenom} ${response.data.user.nom}`);
    } catch (error) {
      toast.error('Erreur lors de la connexion à ce compte');
    }
  };

  const handleStopImpersonation = async () => {
    try {
      const originalToken = localStorage.getItem('originalToken');
      if (originalToken) {
        // Restaurer le token original
        localStorage.setItem('token', originalToken);
        localStorage.removeItem('originalToken');
        localStorage.removeItem('isImpersonating');
        
        // Mettre à jour l'en-tête d'autorisation d'axios
        axios.defaults.headers.common['Authorization'] = `Bearer ${originalToken}`;
        
        // Récupérer les infos du directeur
        const response = await axios.get(`${API}/users/me`);
        setUser(response.data);
        
        toast.success('Retour à votre compte directeur');
      }
    } catch (error) {
      toast.error('Erreur lors du retour au compte directeur');
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

  const handleToggleVuePlanning = async (userId) => {
    try {
      const response = await axios.put(`${API}/admin/users/${userId}/toggle-vue-planning`);
      toast.success(response.data.message);
      fetchAllUsers(); // Recharger la liste
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du changement de vue planning');
    }
  };

  const handleToggleModifierPlanning = async (userId) => {
    try {
      const response = await axios.put(`${API}/admin/users/${userId}/toggle-modifier-planning`);
      toast.success(response.data.message);
      fetchAllUsers(); // Recharger la liste
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du changement de permission de modification');
    }
  };

  // Ouvrir la modale d'édition du profil complet
  const openEditProfileModal = (userItem) => {
    setSelectedUser(userItem);
    setEditUserData({
      nom: userItem.nom || '',
      prenom: userItem.prenom || '',
      email: userItem.email || '',
      role: userItem.role || 'Secrétaire',
      password: ''
    });
    setShowEditProfileModal(true);
  };

  // Sauvegarder le profil complet
  const handleSaveProfile = async () => {
    if (!editUserData.nom || !editUserData.prenom || !editUserData.email) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    if (!editUserData.email.includes('@')) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    try {
      // Mettre à jour les informations de base
      await axios.put(`${API}/users/${selectedUser.id}`, {
        nom: editUserData.nom,
        prenom: editUserData.prenom,
        role: editUserData.role
      });
      
      // Mettre à jour l'email si changé
      if (editUserData.email !== selectedUser.email) {
        await axios.put(`${API}/admin/users/${selectedUser.id}/email`, {
          email: editUserData.email
        });
      }
      
      // Mettre à jour le mot de passe si renseigné
      if (editUserData.password && editUserData.password.length >= 6) {
        await axios.put(`${API}/admin/users/${selectedUser.id}/password`, {
          password: editUserData.password
        });
      } else if (editUserData.password && editUserData.password.length < 6) {
        toast.error('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
      
      toast.success('Profil modifié avec succès');
      fetchAllUsers();
      setShowEditProfileModal(false);
      setSelectedUser(null);
      setEditUserData({ nom: '', prenom: '', email: '', role: '', password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification du profil');
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
                  <th className="text-left p-3">Vue Planning</th>
                  <th className="text-left p-3">Modif. Planning</th>
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
                      {userItem.role !== 'Directeur' && userItem.id !== user?.id ? (
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userItem.vue_planning_complete || false}
                            onChange={() => handleToggleVuePlanning(userItem.id)}
                            className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">
                            {userItem.vue_planning_complete ? 'Activée' : 'Désactivée'}
                          </span>
                        </label>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          {userItem.role === 'Directeur' ? 'Vue complète par défaut' : '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {userItem.role !== 'Directeur' && userItem.id !== user?.id ? (
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userItem.peut_modifier_planning || false}
                            onChange={() => handleToggleModifierPlanning(userItem.id)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">
                            {userItem.peut_modifier_planning ? 'Activée' : 'Désactivée'}
                          </span>
                        </label>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          {userItem.role === 'Directeur' ? 'Modif. par défaut' : '-'}
                        </span>
                      )}
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
                              onClick={() => openEditProfileModal(userItem)}
                              className="text-teal-600 hover:text-teal-800"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Modifier
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

      {/* Modal de modification du profil complet */}
      <Dialog open={showEditProfileModal} onOpenChange={setShowEditProfileModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              ✏️ Modifier le profil de {selectedUser?.prenom} {selectedUser?.nom}
            </DialogTitle>
            <DialogDescription>
              Modifiez toutes les informations de l'utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prénom *</Label>
                <Input
                  value={editUserData.prenom}
                  onChange={(e) => setEditUserData(prev => ({ ...prev, prenom: e.target.value }))}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input
                  value={editUserData.nom}
                  onChange={(e) => setEditUserData(prev => ({ ...prev, nom: e.target.value }))}
                  placeholder="Nom"
                />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={editUserData.email}
                onChange={(e) => setEditUserData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="exemple@hopital.fr"
              />
            </div>
            <div>
              <Label>Rôle *</Label>
              <select
                className="w-full p-2 border rounded"
                value={editUserData.role}
                onChange={(e) => setEditUserData(prev => ({ ...prev, role: e.target.value }))}
              >
                <option value="Médecin">Médecin</option>
                <option value="Assistant">Assistant</option>
                <option value="Secrétaire">Secrétaire</option>
                <option value="Directeur">Directeur</option>
              </select>
            </div>
            <div>
              <Label>Nouveau mot de passe (optionnel)</Label>
              <Input
                type="password"
                value={editUserData.password}
                onChange={(e) => setEditUserData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Laisser vide pour ne pas changer"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères si renseigné</p>
            </div>
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowEditProfileModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveProfile} className="bg-teal-600 hover:bg-teal-700">
                💾 Enregistrer les modifications
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

      {/* Section Notifications de Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-blue-600" />
            <span>Notifications de Test</span>
          </CardTitle>
          <CardDescription>
            Envoyez des notifications de test personnalisées à un ou plusieurs employés pour vérifier que le système fonctionne correctement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => setShowTestNotificationModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Envoyer une notification de test
            </Button>
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  await axios.post(`${API}/notifications/send-daily-planning`);
                  toast.success('Planning quotidien envoyé à tous les employés qui travaillent aujourd\'hui !');
                } catch (error) {
                  toast.error('Erreur lors de l\'envoi du planning quotidien');
                }
              }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Déclencher le planning du jour
            </Button>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Statut des notifications push</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {employeesForTest.map(emp => (
                <div key={emp.id} className="flex items-center space-x-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${emp.has_push_enabled ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className={emp.has_push_enabled ? 'text-green-700' : 'text-gray-500'}>
                    {emp.prenom} {emp.nom?.charAt(0)}.
                  </span>
                  {emp.devices_count > 0 && (
                    <span className="text-xs text-gray-400">({emp.devices_count} app.)</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Les employés avec un point vert ont activé les notifications push sur au moins un appareil
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal de notification de test en masse */}
      <Dialog open={showTestNotificationModal} onOpenChange={setShowTestNotificationModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Send className="h-5 w-5 text-blue-600" />
              <span>Envoyer une notification de test</span>
            </DialogTitle>
            <DialogDescription>
              Sélectionnez les employés et rédigez votre message de test
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Sélection des employés */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-base font-medium">Destinataires</Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={toggleSelectAllEmployees}
                >
                  {selectedEmployeesForTest.length === employeesForTest.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {employeesForTest.map(emp => (
                  <label 
                    key={emp.id} 
                    className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                      selectedEmployeesForTest.includes(emp.id) ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployeesForTest.includes(emp.id)}
                      onChange={() => toggleEmployeeForTest(emp.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {emp.prenom} {emp.nom}
                      </div>
                      <div className="flex items-center space-x-1 text-xs">
                        <span className="text-gray-500">{emp.role}</span>
                        {emp.has_push_enabled ? (
                          <span className="text-green-600">({emp.devices_count} app.)</span>
                        ) : (
                          <span className="text-red-400">(pas de push)</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {selectedEmployeesForTest.length} employé(s) sélectionné(s)
              </p>
            </div>

            {/* Titre */}
            <div>
              <Label>Titre de la notification</Label>
              <Input
                value={testNotificationTitle}
                onChange={(e) => setTestNotificationTitle(e.target.value)}
                placeholder="Ex: Test de notification"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">{testNotificationTitle.length}/50</p>
            </div>

            {/* Message */}
            <div>
              <Label>Message</Label>
              <Textarea
                value={testNotificationMessage}
                onChange={(e) => setTestNotificationMessage(e.target.value)}
                placeholder="Écrivez votre message de test ici..."
                className="min-h-[100px]"
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">{testNotificationMessage.length}/200</p>
            </div>

            {/* Boutons */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowTestNotificationModal(false);
                  setSelectedEmployeesForTest([]);
                  setTestNotificationTitle('');
                  setTestNotificationMessage('');
                }}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSendTestNotifications}
                disabled={sendingTestNotification || selectedEmployeesForTest.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendingTestNotification ? (
                  <>Envoi en cours...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer à {selectedEmployeesForTest.length} employé(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== GESTIONNAIRE MULTI-CENTRES =====
const CentresManager = () => {
  const { user, centres: authCentres } = useAuth();
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);
  const [rubriquesDisponibles, setRubriquesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('centres');
  
  // Filtres pour l'onglet Employés
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState('all'); // 'all', 'Médecin', 'Assistant', 'Secrétaire'
  const [employeeCentreFilter, setEmployeeCentreFilter] = useState('all'); // 'all' ou ID du centre
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  
  // Modals
  const [showCentreModal, setShowCentreModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showEmployeeConfigModal, setShowEmployeeConfigModal] = useState(false);
  const [editingCentre, setEditingCentre] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // Forms
  const [centreForm, setCentreForm] = useState({ nom: '', adresse: '', telephone: '', email: '' });
  const [managerForm, setManagerForm] = useState({ 
    email: '', nom: '', prenom: '', telephone: '', password: '',
    permissions: {
      rubriques_visibles: ['dashboard', 'planning', 'conges', 'personnel', 'chat', 'cabinet'],
      peut_modifier_planning: true,
      peut_approuver_conges: true,
      peut_gerer_personnel: false,
      peut_voir_statistiques: true,
      peut_envoyer_notifications: true,
      peut_gerer_salles: false,
      peut_gerer_stocks: false
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Pour la gestion multi-centres, le directeur doit voir TOUS les employés de tous les centres
      // On utilise le paramètre all_centres=true pour contourner le filtre par centre actif
      const [centresRes, rubriquesRes, inscriptionsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/centres/details`),
        axios.get(`${API}/admin/rubriques`),
        axios.get(`${API}/inscriptions?statut=EN_ATTENTE`),
        axios.get(`${API}/users?all_centres=true`)  // Charger TOUS les employés de tous les centres
      ]);
      setCentres(centresRes.data.centres || []);
      setRubriquesDisponibles(rubriquesRes.data.rubriques || []);
      setInscriptions(inscriptionsRes.data.inscriptions || []);
      // Charger tous les employés actifs de TOUS les centres
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      setEmployees(allUsers.filter(u => u.actif));
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchCentreDetails = async (centreId) => {
    try {
      // Recharger TOUS les employés (pour l'onglet Employés global) + les managers du centre sélectionné
      const [usersRes, managersRes] = await Promise.all([
        axios.get(`${API}/users?all_centres=true`),  // Toujours charger TOUS les employés
        axios.get(`${API}/admin/managers/${centreId}`)
      ]);
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      setEmployees(allUsers.filter(u => u.actif));
      setManagers(managersRes.data.managers || []);
    } catch (error) {
      toast.error('Erreur lors du chargement du centre');
    }
  };

  const handleSelectCentre = (centre) => {
    setSelectedCentre(centre);
    fetchCentreDetails(centre.id);
  };

  const handleCreateCentre = async () => {
    try {
      const response = await axios.post(`${API}/centres`, centreForm);
      toast.success('Centre créé avec succès');
      setShowCentreModal(false);
      setCentreForm({ nom: '', adresse: '', telephone: '', email: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const handleUpdateCentre = async () => {
    try {
      await axios.put(`${API}/centres/${editingCentre.id}`, centreForm);
      toast.success('Centre mis à jour');
      setShowCentreModal(false);
      setEditingCentre(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const handleCreateManager = async () => {
    if (!selectedCentre) {
      toast.error('Sélectionnez d\'abord un centre');
      return;
    }
    try {
      await axios.post(`${API}/admin/managers`, {
        ...managerForm,
        centre_id: selectedCentre.id
      });
      toast.success('Manager créé avec succès');
      setShowManagerModal(false);
      setManagerForm({ 
        email: '', nom: '', prenom: '', telephone: '', password: '',
        permissions: managerForm.permissions 
      });
      fetchCentreDetails(selectedCentre.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const handleUpdateManagerPermissions = async (managerId, permissions) => {
    try {
      await axios.put(`${API}/admin/managers/${managerId}/permissions`, permissions);
      toast.success('Permissions mises à jour');
      fetchCentreDetails(selectedCentre.id);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateCentreConfig = async (centreId, config) => {
    try {
      await axios.put(`${API}/admin/centres/${centreId}/config`, config);
      toast.success('Configuration mise à jour');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleApproveInscription = async (inscriptionId) => {
    const password = prompt('Définissez un mot de passe pour le nouvel employé:');
    if (!password) return;
    
    try {
      await axios.put(`${API}/inscriptions/${inscriptionId}/approve?password=${encodeURIComponent(password)}`);
      toast.success('Inscription approuvée');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'approbation');
    }
  };

  const handleRejectInscription = async (inscriptionId) => {
    const commentaire = prompt('Raison du refus (optionnel):');
    try {
      await axios.put(`${API}/inscriptions/${inscriptionId}/reject?commentaire=${encodeURIComponent(commentaire || '')}`);
      toast.success('Inscription refusée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors du refus');
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Manager': return 'bg-orange-100 text-orange-800';
      case 'Médecin': return 'bg-blue-100 text-blue-800';
      case 'Assistant': return 'bg-green-100 text-green-800';
      case 'Secrétaire': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0091B9]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="centres-manager">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion Multi-Centres</h2>
          <p className="text-gray-500">Gérez vos centres, managers et employés</p>
        </div>
        {inscriptions.length > 0 && (
          <Badge className="bg-orange-500 text-white">
            {inscriptions.length} inscription(s) en attente
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="centres" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Centres
          </TabsTrigger>
          <TabsTrigger value="managers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Managers
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employés
          </TabsTrigger>
          <TabsTrigger value="inscriptions" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Inscriptions
            {inscriptions.length > 0 && (
              <span className="ml-1 bg-orange-500 text-white rounded-full px-2 py-0.5 text-xs">
                {inscriptions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Onglet Centres */}
        <TabsContent value="centres" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Vue globale des centres</h3>
              <Badge className="bg-[#0091B9]">{centres.length} centre(s)</Badge>
            </div>
            <Button onClick={() => { setEditingCentre(null); setCentreForm({ nom: '', adresse: '', telephone: '', email: '' }); setShowCentreModal(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Centre
            </Button>
          </div>
          
          {/* Statistiques globales */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-gradient-to-br from-[#0091B9]/10 to-[#0091B9]/5 border-[#0091B9]/20">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-[#0091B9]">{centres.length}</div>
                <div className="text-sm text-gray-600">Centres</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {employees.filter(e => e.role === 'Médecin').length}
                </div>
                <div className="text-sm text-gray-600">Médecins</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {employees.filter(e => e.role === 'Assistant').length}
                </div>
                <div className="text-sm text-gray-600">Assistants</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {employees.filter(e => e.role === 'Secrétaire').length}
                </div>
                <div className="text-sm text-gray-600">Secrétaires</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-gray-600">
                  {employees.filter(e => e.actif).length}
                </div>
                <div className="text-sm text-gray-600">Total Actifs</div>
              </CardContent>
            </Card>
          </div>
          
          {/* Liste des centres avec employés */}
          <div className="space-y-4">
            {centres.map((centre) => {
              // Filtrer les employés de ce centre
              const centreEmployees = employees.filter(e => 
                (e.centre_ids && e.centre_ids.includes(centre.id)) || 
                e.centre_id === centre.id
              );
              const centreMedecins = centreEmployees.filter(e => e.role === 'Médecin');
              const centreAssistants = centreEmployees.filter(e => e.role === 'Assistant');
              const centreSecretaires = centreEmployees.filter(e => e.role === 'Secrétaire');
              
              return (
                <Card key={centre.id} className="overflow-hidden">
                  <div className="bg-gradient-to-r from-[#0091B9] to-[#19CD91] p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{centre.nom}</h3>
                        {centre.adresse && (
                          <p className="text-white/80 text-sm flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {centre.adresse}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-white/20 text-white">
                          {centreEmployees.length} employé(s)
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-white hover:bg-white/20"
                          onClick={() => { setEditingCentre(centre); setCentreForm(centre); setShowCentreModal(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    {centreEmployees.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Aucun employé assigné à ce centre</p>
                    ) : (
                      <div className="space-y-4">
                        {/* Médecins */}
                        {centreMedecins.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
                              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                              Médecins ({centreMedecins.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {centreMedecins.map(emp => (
                                <div key={emp.id} className="flex items-center gap-2 bg-blue-50 rounded-full px-3 py-1">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="bg-blue-500 text-white text-xs">
                                      {emp.prenom?.[0]}{emp.nom?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{emp.prenom} {emp.nom}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Assistants */}
                        {centreAssistants.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                              Assistants ({centreAssistants.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {centreAssistants.map(emp => (
                                <div key={emp.id} className="flex items-center gap-2 bg-green-50 rounded-full px-3 py-1">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="bg-green-500 text-white text-xs">
                                      {emp.prenom?.[0]}{emp.nom?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{emp.prenom} {emp.nom}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Secrétaires */}
                        {centreSecretaires.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-purple-600 mb-2 flex items-center gap-2">
                              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                              Secrétaires ({centreSecretaires.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {centreSecretaires.map(emp => (
                                <div key={emp.id} className="flex items-center gap-2 bg-purple-50 rounded-full px-3 py-1">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="bg-purple-500 text-white text-xs">
                                      {emp.prenom?.[0]}{emp.nom?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{emp.prenom} {emp.nom}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Onglet Managers */}
        <TabsContent value="managers" className="space-y-4">
          {!selectedCentre ? (
            <Card className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Sélectionnez un centre dans l'onglet "Centres" pour gérer ses managers</p>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Managers de {selectedCentre.nom}</h3>
                <Button onClick={() => setShowManagerModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Manager
                </Button>
              </div>
              
              <div className="space-y-4">
                {managers.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Aucun manager pour ce centre</p>
                  </Card>
                ) : managers.map((manager) => (
                  <Card key={manager.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-orange-500 text-white">
                              {manager.prenom?.[0]}{manager.nom?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{manager.prenom} {manager.nom}</div>
                            <div className="text-sm text-gray-500">{manager.email}</div>
                          </div>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800">Manager</Badge>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-3">Permissions</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { key: 'peut_modifier_planning', label: 'Modifier planning' },
                            { key: 'peut_approuver_conges', label: 'Approuver congés' },
                            { key: 'peut_gerer_personnel', label: 'Gérer personnel' },
                            { key: 'peut_voir_statistiques', label: 'Voir statistiques' },
                            { key: 'peut_envoyer_notifications', label: 'Envoyer notifications' },
                            { key: 'peut_gerer_salles', label: 'Gérer salles' },
                            { key: 'peut_gerer_stocks', label: 'Gérer stocks' }
                          ].map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={manager.manager_permissions?.[key] ?? false}
                                onChange={(e) => {
                                  handleUpdateManagerPermissions(manager.id, {
                                    ...manager.manager_permissions,
                                    [key]: e.target.checked
                                  });
                                }}
                                className="w-4 h-4 text-[#0091B9]"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold mb-2">Rubriques visibles</h4>
                          <div className="flex flex-wrap gap-2">
                            {rubriquesDisponibles.map((rubrique) => {
                              const isVisible = manager.manager_permissions?.rubriques_visibles?.includes(rubrique.id) ?? true;
                              return (
                                <label 
                                  key={rubrique.id}
                                  className={`px-3 py-1 rounded-full text-xs cursor-pointer transition-all ${
                                    isVisible ? 'bg-[#0091B9] text-white' : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={(e) => {
                                      const newRubriques = e.target.checked
                                        ? [...(manager.manager_permissions?.rubriques_visibles || []), rubrique.id]
                                        : (manager.manager_permissions?.rubriques_visibles || []).filter(r => r !== rubrique.id);
                                      handleUpdateManagerPermissions(manager.id, {
                                        ...manager.manager_permissions,
                                        rubriques_visibles: newRubriques
                                      });
                                    }}
                                    className="sr-only"
                                  />
                                  {rubrique.nom}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Onglet Employés */}
        <TabsContent value="employees" className="space-y-4">
          {/* Header avec titre et filtres */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Tous les Employés</h3>
              <p className="text-sm text-gray-500">Vue globale de tous les employés de tous les centres</p>
            </div>
            <Badge className="w-fit">{employees.filter(e => e.role !== 'Manager' && e.role !== 'Super-Admin' && e.role !== 'Directeur').length} employé(s)</Badge>
          </div>
          
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg">
            {/* Recherche par nom */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Rechercher par nom..."
                value={employeeSearchTerm}
                onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                className="bg-white"
              />
            </div>
            
            {/* Filtre par rôle */}
            <Select value={employeeRoleFilter} onValueChange={setEmployeeRoleFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="Médecin">🩺 Médecins</SelectItem>
                <SelectItem value="Assistant">👨‍⚕️ Assistants</SelectItem>
                <SelectItem value="Secrétaire">📋 Secrétaires</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Filtre par centre */}
            <Select value={employeeCentreFilter} onValueChange={setEmployeeCentreFilter}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Tous les centres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les centres</SelectItem>
                {centres.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {employees.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Aucun employé trouvé</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {employees
                .filter(e => e.role !== 'Manager' && e.role !== 'Super-Admin' && e.role !== 'Directeur')
                .filter(e => employeeRoleFilter === 'all' || e.role === employeeRoleFilter)
                .filter(e => {
                  if (employeeCentreFilter === 'all') return true;
                  const empCentres = e.centre_ids || (e.centre_id ? [e.centre_id] : []);
                  return empCentres.includes(employeeCentreFilter);
                })
                .filter(e => {
                  if (!employeeSearchTerm) return true;
                  const term = employeeSearchTerm.toLowerCase();
                  return (e.prenom?.toLowerCase().includes(term) || 
                          e.nom?.toLowerCase().includes(term) ||
                          e.email?.toLowerCase().includes(term));
                })
                .map((employee) => {
                // Récupérer les centres de l'employé (multi-centres)
                const employeeCentres = employee.centre_ids || (employee.centre_id ? [employee.centre_id] : []);
                
                return (
                  <Card key={employee.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={getRoleColor(employee.role)}>
                              {employee.prenom?.[0]}{employee.nom?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{employee.prenom} {employee.nom}</div>
                            <div className="text-sm text-gray-500">{employee.email}</div>
                          </div>
                        </div>
                        <Badge className={getRoleColor(employee.role)}>{employee.role}</Badge>
                      </div>
                      
                      {/* Gestion multi-centres */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Centres assignés :</span>
                          <span className="text-xs text-gray-500">
                            {(employee.centre_ids?.length > 0 ? employee.centre_ids.length : (employee.centre_id ? 1 : 0))} centre(s)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {centres.map((c) => {
                            const isAssigned = employeeCentres.includes(c.id);
                            return (
                              <label 
                                key={c.id}
                                className={`px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all flex items-center gap-1 ${
                                  isAssigned 
                                    ? 'bg-[#0091B9] text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                  <input
                                    type="checkbox"
                                    checked={isAssigned}
                                    onChange={async (e) => {
                                      try {
                                        if (e.target.checked) {
                                          // Ajouter le centre
                                          await axios.put(`${API}/admin/employees/${employee.id}/centre?new_centre_id=${c.id}`);
                                          toast.success(`${c.nom} ajouté`);
                                        } else {
                                          // Retirer le centre
                                          if (employeeCentres.length <= 1) {
                                            toast.error('L\'employé doit avoir au moins un centre');
                                            return;
                                          }
                                          await axios.delete(`${API}/admin/employees/${employee.id}/centres/${c.id}`);
                                          toast.success(`${c.nom} retiré`);
                                        }
                                        // Recharger tous les employés (pas besoin de centre sélectionné)
                                        fetchData();
                                      } catch (error) {
                                        toast.error(error.response?.data?.detail || 'Erreur');
                                      }
                                    }}
                                    className="sr-only"
                                  />
                                  <Building2 className="h-3 w-3" />
                                  {c.nom}
                                  {isAssigned && <Check className="h-3 w-3 ml-1" />}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Paramètres de visibilité */}
                        <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={employee.visibility_config?.peut_voir_tous_employes ?? true}
                              onChange={async (e) => {
                                try {
                                  await axios.put(`${API}/admin/employees/${employee.id}/visibility`, {
                                    peut_voir_tous_employes: e.target.checked,
                                    peut_voir_planning_complet: employee.visibility_config?.peut_voir_planning_complet ?? false
                                  });
                                  fetchData();
                                } catch (error) {
                                  toast.error('Erreur');
                                }
                              }}
                              className="w-4 h-4"
                            />
                            Peut voir tous les employés
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={employee.visibility_config?.peut_voir_planning_complet ?? false}
                              onChange={async (e) => {
                                try {
                                  await axios.put(`${API}/admin/employees/${employee.id}/visibility`, {
                                    peut_voir_tous_employes: employee.visibility_config?.peut_voir_tous_employes ?? true,
                                    peut_voir_planning_complet: e.target.checked
                                  });
                                  fetchData();
                                } catch (error) {
                                  toast.error('Erreur');
                                }
                              }}
                              className="w-4 h-4"
                            />
                            Peut voir le planning complet
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
        </TabsContent>

        {/* Onglet Inscriptions */}
        <TabsContent value="inscriptions" className="space-y-4">
          <h3 className="text-lg font-semibold">Demandes d'inscription en attente</h3>
          
          {inscriptions.length === 0 ? (
            <Card className="p-8 text-center">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-gray-500">Aucune demande en attente</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {inscriptions.map((inscription) => (
                <Card key={inscription.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-gray-200">
                            {inscription.prenom?.[0]}{inscription.nom?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{inscription.prenom} {inscription.nom}</div>
                          <div className="text-sm text-gray-500">{inscription.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{inscription.role_souhaite}</Badge>
                            <span className="text-xs text-gray-400">→</span>
                            <Badge variant="secondary">{inscription.centre_nom}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleRejectInscription(inscription.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Refuser
                        </Button>
                        <Button 
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveInscription(inscription.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                      </div>
                    </div>
                    {inscription.message && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        <strong>Message:</strong> {inscription.message}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-400">
                      Demandé le {new Date(inscription.date_demande).toLocaleDateString('fr-FR')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Création/Édition Centre */}
      <Dialog open={showCentreModal} onOpenChange={setShowCentreModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCentre ? 'Modifier le centre' : 'Nouveau centre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du centre *</Label>
              <Input
                value={centreForm.nom}
                onChange={(e) => setCentreForm({...centreForm, nom: e.target.value})}
                placeholder="Ex: Centre Ophtalmologie Lyon"
              />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input
                value={centreForm.adresse}
                onChange={(e) => setCentreForm({...centreForm, adresse: e.target.value})}
                placeholder="Adresse complète"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Téléphone</Label>
                <Input
                  value={centreForm.telephone}
                  onChange={(e) => setCentreForm({...centreForm, telephone: e.target.value})}
                  placeholder="01 23 45 67 89"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={centreForm.email}
                  onChange={(e) => setCentreForm({...centreForm, email: e.target.value})}
                  placeholder="contact@centre.fr"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCentreModal(false)}>Annuler</Button>
              <Button onClick={editingCentre ? handleUpdateCentre : handleCreateCentre}>
                {editingCentre ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Création Manager */}
      <Dialog open={showManagerModal} onOpenChange={setShowManagerModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau Manager pour {selectedCentre?.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prénom *</Label>
                <Input
                  value={managerForm.prenom}
                  onChange={(e) => setManagerForm({...managerForm, prenom: e.target.value})}
                />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input
                  value={managerForm.nom}
                  onChange={(e) => setManagerForm({...managerForm, nom: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={managerForm.email}
                onChange={(e) => setManagerForm({...managerForm, email: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Téléphone</Label>
                <Input
                  value={managerForm.telephone}
                  onChange={(e) => setManagerForm({...managerForm, telephone: e.target.value})}
                />
              </div>
              <div>
                <Label>Mot de passe *</Label>
                <Input
                  type="password"
                  value={managerForm.password}
                  onChange={(e) => setManagerForm({...managerForm, password: e.target.value})}
                  placeholder="Mot de passe initial"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowManagerModal(false)}>Annuler</Button>
              <Button onClick={handleCreateManager}>Créer le Manager</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

  const [users, setUsers] = useState([]);
  const [selectedPermission, setSelectedPermission] = useState({
    utilisateur_id: '',
    peut_voir: true,
    peut_modifier: false,
    peut_ajouter: false,
    peut_supprimer: false
  });

  useEffect(() => {
    fetchData();
    if (user?.role === 'Directeur') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.actif && u.role !== 'Directeur'));
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs');
    }
  };

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

  const handleSavePermission = async (e) => {
    e.preventDefault();
    
    if (!selectedPermission.utilisateur_id) {
      toast.error('Veuillez sélectionner un utilisateur');
      return;
    }

    try {
      await axios.post(`${API}/stocks/permissions`, selectedPermission);
      toast.success('Permission enregistrée avec succès');
      setShowPermissionModal(false);
      setSelectedPermission({
        utilisateur_id: '',
        peut_voir: true,
        peut_modifier: false,
        peut_ajouter: false,
        peut_supprimer: false
      });
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement de la permission');
    }
  };

  const getPermissionForUser = (userId) => {
    return permissions.find(p => p.utilisateur_id === userId);
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
    return <div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-[#0091B9] border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6" data-testid="stocks-manager">
      {/* Header moderne avec gradient */}
      <div className="bg-gradient-to-r from-[#0091B9] via-[#007494] to-[#19CD91] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-7 w-7" />
              Gestion des Stocks
            </h2>
            <p className="text-white/80 mt-1">Gérez l'inventaire du cabinet</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => setShowCategoryModal(true)}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Catégorie
            </Button>
            <Button 
              onClick={() => setShowArticleModal(true)}
              className="bg-white text-[#0091B9] hover:bg-white/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Article
            </Button>
            {user?.role === 'Directeur' && (
              <Button 
                variant="outline" 
                onClick={() => setShowPermissionModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              >
                <Settings className="h-4 w-4 mr-2" />
                Permissions
              </Button>
            )}
          </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

      {/* Modal Gestion des Permissions */}
      <Dialog open={showPermissionModal} onOpenChange={setShowPermissionModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion des Permissions - Stocks</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Formulaire d'ajout de permission */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attribuer une Permission</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePermission} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Utilisateur</Label>
                    <Select
                      value={selectedPermission.utilisateur_id}
                      onValueChange={(value) => {
                        const existingPerm = getPermissionForUser(value);
                        if (existingPerm) {
                          setSelectedPermission({
                            utilisateur_id: value,
                            peut_voir: existingPerm.peut_voir,
                            peut_modifier: existingPerm.peut_modifier,
                            peut_ajouter: existingPerm.peut_ajouter,
                            peut_supprimer: existingPerm.peut_supprimer
                          });
                        } else {
                          setSelectedPermission({
                            ...selectedPermission,
                            utilisateur_id: value
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un utilisateur" />
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

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="peut_voir"
                        checked={selectedPermission.peut_voir}
                        onChange={(e) => setSelectedPermission({...selectedPermission, peut_voir: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="peut_voir" className="cursor-pointer">Peut voir les stocks</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="peut_modifier"
                        checked={selectedPermission.peut_modifier}
                        onChange={(e) => setSelectedPermission({...selectedPermission, peut_modifier: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="peut_modifier" className="cursor-pointer">Peut modifier les articles</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="peut_ajouter"
                        checked={selectedPermission.peut_ajouter}
                        onChange={(e) => setSelectedPermission({...selectedPermission, peut_ajouter: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="peut_ajouter" className="cursor-pointer">Peut ajouter des articles</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="peut_supprimer"
                        checked={selectedPermission.peut_supprimer}
                        onChange={(e) => setSelectedPermission({...selectedPermission, peut_supprimer: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="peut_supprimer" className="cursor-pointer">Peut supprimer des articles</Label>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Enregistrer la Permission
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Liste des permissions existantes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Permissions Actuelles</CardTitle>
              </CardHeader>
              <CardContent>
                {permissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucune permission attribuée</p>
                ) : (
                  <div className="space-y-2">
                    {permissions.map(perm => (
                      <div key={perm.id} className="border rounded p-3 bg-gray-50">
                        <div className="font-medium text-gray-900">
                          {perm.utilisateur?.prenom} {perm.utilisateur?.nom}
                          <span className="text-sm text-gray-600 ml-2">({perm.utilisateur?.role})</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                          {perm.peut_voir && <div>✓ Peut voir</div>}
                          {perm.peut_modifier && <div>✓ Peut modifier</div>}
                          {perm.peut_ajouter && <div>✓ Peut ajouter</div>}
                          {perm.peut_supprimer && <div>✓ Peut supprimer</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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


// Centre Favori Component
const CentreFavoriManager = ({ user, setUser }) => {
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(user?.centre_favori_id || '');
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState(null);

  useEffect(() => {
    fetchCentres();
  }, []);

  useEffect(() => {
    setSelectedCentre(user?.centre_favori_id || '');
  }, [user?.centre_favori_id]);

  const fetchCentres = async () => {
    try {
      const response = await axios.get(`${API}/admin/centres/details`);
      setCentres(response.data.centres || []);
    } catch (error) {
      // Si pas admin, récupérer les centres de l'utilisateur
      const userCentres = user?.centre_ids || (user?.centre_id ? [user.centre_id] : []);
      if (userCentres.length > 0) {
        try {
          const centresData = [];
          for (const cId of userCentres) {
            const res = await axios.get(`${API}/centres/${cId}`).catch(() => null);
            if (res?.data) centresData.push(res.data);
          }
          setCentres(centresData);
        } catch (e) {
          console.error('Erreur chargement centres:', e);
        }
      }
    }
  };

  const handleSetCentreFavori = async () => {
    if (!selectedCentre) {
      toast.error('Veuillez sélectionner un centre');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.put(`${API}/users/me/centre-favori`, {
        centre_id: selectedCentre
      });
      toast.success(response.data.message);
      setUser({ ...user, centre_favori_id: selectedCentre });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la définition du centre favori');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateData = async () => {
    if (!user?.centre_favori_id) {
      toast.error('Veuillez d\'abord définir un centre favori');
      return;
    }

    setMigrating(true);
    setMigrationResults(null);
    try {
      const response = await axios.post(`${API}/admin/migrate-data-to-centre`, {
        centre_id: user.centre_favori_id
      });
      toast.success(response.data.message);
      setMigrationResults(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la migration');
    } finally {
      setMigrating(false);
    }
  };

  const isDirector = user?.role === 'Directeur' || user?.role === 'Super-Admin';
  const centreFavori = centres.find(c => c.id === user?.centre_favori_id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>⭐ Centre Favori</CardTitle>
        <CardDescription>
          Définissez votre centre favori pour y associer vos données
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Centre favori actuel */}
        {user?.centre_favori_id && centreFavori ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              <span className="font-semibold">Centre favori actuel :</span> {centreFavori.nom}
            </p>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Aucun centre favori défini</p>
          </div>
        )}

        {/* Sélection du centre */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedCentre} onValueChange={setSelectedCentre}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Sélectionnez un centre" />
            </SelectTrigger>
            <SelectContent>
              {centres.map(centre => (
                <SelectItem key={centre.id} value={centre.id}>
                  {centre.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleSetCentreFavori} 
            disabled={loading || !selectedCentre}
          >
            {loading ? 'En cours...' : 'Définir comme favori'}
          </Button>
        </div>

        {/* Migration des données (Directeur uniquement) */}
        {isDirector && (
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">🔄 Migration des données</h4>
            <p className="text-sm text-gray-600 mb-3">
              Associer toutes les données existantes (planning, congés, stocks, etc.) 
              qui n'ont pas de centre défini vers votre centre favori.
            </p>
            <Button 
              onClick={handleMigrateData}
              disabled={migrating || !user?.centre_favori_id}
              variant="outline"
              className="w-full"
            >
              {migrating ? '⏳ Migration en cours...' : '🚀 Lancer la migration'}
            </Button>

            {/* Résultats de la migration */}
            {migrationResults && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800 mb-2">{migrationResults.message}</p>
                <div className="text-sm space-y-1">
                  {Object.entries(migrationResults.details || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{value.label}</span>
                      <Badge variant={value.migrated_count > 0 ? "default" : "secondary"}>
                        {value.migrated_count} élément(s)
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};


// Mon Profil Component
const MonProfilManager = () => {
  const { user, setUser } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [profileData, setProfileData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    date_naissance: '',
    photo_url: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const openEditModal = () => {
    setProfileData({
      prenom: user?.prenom || '',
      nom: user?.nom || '',
      email: user?.email || '',
      telephone: user?.telephone || '',
      date_naissance: user?.date_naissance || '',
      photo_url: user?.photo_url || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateProfile = async () => {
    if (!profileData.prenom || !profileData.nom || !profileData.email) {
      toast.error('Veuillez remplir les champs obligatoires (Prénom, Nom, Email)');
      return;
    }

    if (profileData.prenom.length < 2 || profileData.nom.length < 2) {
      toast.error('Le prénom et le nom doivent contenir au moins 2 caractères');
      return;
    }

    if (!profileData.email.includes('@')) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    try {
      // Mettre à jour le profil
      await axios.put(`${API}/users/${user.id}`, {
        prenom: profileData.prenom,
        nom: profileData.nom,
        telephone: profileData.telephone || null,
        date_naissance: profileData.date_naissance || null,
        photo_url: profileData.photo_url || null
      });

      // Si l'email a changé, mettre à jour séparément
      if (profileData.email !== user.email) {
        await axios.put(`${API}/users/me/email`, { email: profileData.email });
        toast.success('Profil mis à jour. Reconnexion nécessaire (email modifié).');
        setTimeout(() => { window.location.href = '/'; }, 2000);
        return;
      }
      
      // Mettre à jour les données utilisateur dans le contexte
      setUser({
        ...user,
        prenom: profileData.prenom,
        nom: profileData.nom,
        telephone: profileData.telephone,
        date_naissance: profileData.date_naissance,
        photo_url: profileData.photo_url
      });
      
      toast.success('Profil mis à jour avec succès !');
      setShowEditModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour du profil');
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Informations du compte</CardTitle>
              <CardDescription>Vos informations personnelles</CardDescription>
            </div>
            <Button onClick={openEditModal}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier mon profil
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-6 pb-4 border-b">
            <Avatar className="h-24 w-24">
              {user?.photo_url && <AvatarImage src={getPhotoUrl(user.photo_url)} alt={`${user.prenom} ${user.nom}`} />}
              <AvatarFallback className="bg-teal-500 text-white text-2xl">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-2xl font-bold">{user?.prenom} {user?.nom}</p>
              <Badge variant="outline" className="mt-1">{user?.role}</Badge>
              {user?.date_naissance && (
                <p className="text-sm text-gray-500 mt-2">
                  🎂 Né(e) le {new Date(user.date_naissance + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <Label className="text-sm text-gray-500">📧 Email</Label>
              <p className="text-lg font-medium">{user?.email}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Label className="text-sm text-gray-500">📞 Téléphone</Label>
              <p className="text-lg font-medium">{user?.telephone || 'Non renseigné'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Label className="text-sm text-gray-500">🎂 Date de naissance</Label>
              <p className="text-lg font-medium">
                {user?.date_naissance 
                  ? new Date(user.date_naissance + 'T12:00:00').toLocaleDateString('fr-FR')
                  : 'Non renseignée'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Label className="text-sm text-gray-500">🖼️ Photo de profil</Label>
              <p className="text-lg font-medium">{user?.photo_url ? '✅ Définie' : '❌ Non définie'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🔒 Sécurité</CardTitle>
          <CardDescription>Gérez votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowPasswordModal(true)}>
            Changer mon mot de passe
          </Button>
        </CardContent>
      </Card>

      {/* Centre Favori */}
      <CentreFavoriManager user={user} setUser={setUser} />

      {/* Gestion des notifications push */}
      <Card>
        <CardHeader>
          <CardTitle>🔔 Notifications Push</CardTitle>
          <CardDescription>Recevez votre planning quotidien sur votre téléphone</CardDescription>
        </CardHeader>
        <CardContent>
          <PushNotificationManager />
        </CardContent>
      </Card>

      {/* Test notifications quotidiennes (Directeur uniquement) */}
      {user?.role === 'Directeur' && (
        <Card>
          <CardHeader>
            <CardTitle>🧪 Tests de Notifications</CardTitle>
            <CardDescription>Tester l'envoi des notifications quotidiennes</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={async () => {
                try {
                  await axios.post(`${API}/notifications/send-daily-planning`);
                  toast.success('Planning quotidien envoyé à tous les employés !');
                } catch (error) {
                  toast.error('Erreur lors de l\'envoi');
                }
              }}
              className="w-full"
            >
              📅 Envoyer le planning du jour (TEST)
            </Button>
            <p className="text-xs text-gray-600 mt-2">
              Envoie le planning d'aujourd'hui à tous les employés qui travaillent
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de modification du profil complet */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier mon profil</DialogTitle>
            <DialogDescription>
              Modifiez vos informations personnelles
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Aperçu photo */}
            <div className="flex justify-center">
              <Avatar className="h-20 w-20">
                {profileData.photo_url && <AvatarImage src={getPhotoUrl(profileData.photo_url)} />}
                <AvatarFallback className="bg-teal-500 text-white text-xl">
                  {profileData.prenom?.[0]}{profileData.nom?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom *</Label>
                <Input
                  type="text"
                  placeholder="Votre prénom"
                  value={profileData.prenom}
                  onChange={(e) => setProfileData({...profileData, prenom: e.target.value})}
                />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input
                  type="text"
                  placeholder="Votre nom"
                  value={profileData.nom}
                  onChange={(e) => setProfileData({...profileData, nom: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="votre@email.com"
                value={profileData.email}
                onChange={(e) => setProfileData({...profileData, email: e.target.value})}
              />
              {profileData.email !== user?.email && (
                <p className="text-xs text-orange-600 mt-1">⚠️ Vous devrez vous reconnecter après changement d'email</p>
              )}
            </div>

            <div>
              <Label>Téléphone</Label>
              <Input
                type="tel"
                placeholder="01 23 45 67 89"
                value={profileData.telephone}
                onChange={(e) => setProfileData({...profileData, telephone: e.target.value})}
              />
            </div>

            <div>
              <Label>Date de naissance</Label>
              <Input
                type="date"
                value={profileData.date_naissance}
                onChange={(e) => setProfileData({...profileData, date_naissance: e.target.value})}
              />
            </div>

            <div>
              <Label>Photo de profil</Label>
              <div className="flex items-center space-x-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    // Vérifier la taille (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('Image trop grande (max 5 Mo)');
                      return;
                    }
                    
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      const response = await axios.post(`${API}/upload/photo`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      
                      setProfileData({...profileData, photo_url: response.data.photo_url});
                      toast.success('Photo uploadée !');
                    } catch (error) {
                      toast.error('Erreur lors de l\'upload');
                    }
                  }}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF ou WEBP (max 5 Mo)</p>
              {profileData.photo_url && (
                <div className="mt-2 flex items-center space-x-2">
                  <img src={getPhotoUrl(profileData.photo_url)} alt="Aperçu" className="w-16 h-16 rounded-full object-cover" onError={(e) => e.target.style.display='none'} />
                  <Button type="button" variant="outline" size="sm" onClick={() => setProfileData({...profileData, photo_url: ''})}>
                    Supprimer
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdateProfile}>
                Enregistrer
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
  const [activeTab, setActiveTab] = useState('actualites');
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, centreActif } = useAuth();

  const getMenuItems = () => {
    const items = [
      { id: 'actualites', label: 'Actualités', icon: Bell },
      { id: 'profil', label: 'Mon Profil', icon: Users },
      { id: 'personnel', label: 'Personnel', icon: Users },
      { id: 'planning', label: 'Planning', icon: Calendar },
      { id: 'conges', label: 'Congés', icon: Clock },
      { id: 'messages', label: 'Messages', icon: MessageSquare },
      { id: 'documents', label: 'Mon Coffre-Fort', icon: FileText },
    ];

    // Ajouter demandes de créneaux pour médecins, directeur et super-admin
    if (user?.role === 'Médecin' || user?.role === 'Directeur' || user?.role === 'Super-Admin') {
      items.splice(5, 0, { id: 'demandes-travail', label: 'Demande de créneaux', icon: CalendarDays });
    }

    // Plan Cabinet, Salles, Stocks visible pour Directeur, Super-Admin et Manager
    if (user?.role === 'Directeur' || user?.role === 'Super-Admin' || user?.role === 'Manager') {
      items.push({ id: 'plan-cabinet', label: 'Plan Cabinet', icon: MapPin });
      items.push({ id: 'salles', label: 'Gestion Salles', icon: Building2 });
      items.push({ id: 'stocks', label: 'Gestion Stocks', icon: Package });
    }
    
    // Administration visible pour Directeur, Super-Admin et Manager
    if (user?.role === 'Directeur' || user?.role === 'Super-Admin' || user?.role === 'Manager') {
      items.push({ id: 'admin', label: 'Administration', icon: Settings });
    }
    
    // Gestion Multi-Centres uniquement pour Super-Admin et Directeur
    if (user?.role === 'Directeur' || user?.role === 'Super-Admin') {
      items.push({ id: 'centres', label: 'Gestion Centres', icon: Building2 });
    }

    return items;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'actualites':
        return <ActualitesManager user={user} centreActif={centreActif} CabinetPlanWithPopup={CabinetPlanWithPopup} />;
      case 'profil':
        return <MonProfilManager />;
      case 'personnel':
        return <PersonnelManager />;
      case 'planning':
        return <PlanningManager />;
      case 'conges':
        return <CongeManager user={user} />;
      case 'demandes-travail':
        return <DemandesTravailManager />;
      case 'messages':
        return <ChatManager user={user} />;
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
      case 'centres':
        return <CentresManager />;
      default:
        return <ActualitesManager user={user} centreActif={centreActif} CabinetPlanWithPopup={CabinetPlanWithPopup} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Fond Ophtalmologie */}
      <div className="ophta-background">
        <div className="ophta-decoration ophta-decoration-1"></div>
        <div className="ophta-decoration ophta-decoration-2"></div>
        <div className="ophta-decoration ophta-decoration-3"></div>
        <div className="ophta-eye-pattern"></div>
        <div className="ophta-eye-pattern-2"></div>
      </div>
      
      <div className="app-content-wrapper">
        <Navigation menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuItems={getMenuItems()} activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-8">
          {/* Main Content - Full width sans sidebar */}
          <div className="w-full">
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

// Floating Chat Button Component - Visible partout
const FloatingChatButton = ({ onNavigateToChat }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [recentMessages, setRecentMessages] = useState([]);

  useEffect(() => {
    if (!user) return;
    
    const fetchUnreadMessages = async () => {
      try {
        const response = await axios.get(`${API}/messages?limit=10`);
        const messages = response.data || [];
        // Compter les messages non lus (simplification - on compte les messages récents des autres)
        const unread = messages.filter(m => m.expediteur?.id !== user.id).slice(0, 5);
        setRecentMessages(unread);
        setUnreadCount(unread.length);
      } catch (error) {
        console.log('Erreur fetch messages');
      }
    };

    fetchUnreadMessages();
    // Polling intelligent : 15 secondes, pause si onglet caché
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchUnreadMessages();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  const getUserAvatar = (userData) => {
    if (userData?.photo_url) {
      return <img src={getPhotoUrl(userData.photo_url)} alt="" />;
    }
    const bgColor = userData?.role === 'Médecin' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                    userData?.role === 'Assistant' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                    'bg-gradient-to-br from-purple-400 to-purple-600';
    return (
      <div className={`avatar-fallback ${bgColor}`}>
        {userData?.prenom?.[0]}{userData?.nom?.[0]}
      </div>
    );
  };

  return (
    <>
      {/* Bouton flottant */}
      <button 
        className="chat-floating-button"
        onClick={() => setShowPreview(!showPreview)}
        data-testid="floating-chat-btn"
      >
        <MessageSquare />
        {unreadCount > 0 && (
          <span className="chat-floating-badge">{unreadCount}</span>
        )}
      </button>

      {/* Aperçu des messages */}
      {showPreview && (
        <div className="chat-floating-preview">
          <div className="chat-floating-preview-header">
            <span className="chat-floating-preview-title">Messages récents</span>
            <button 
              className="chat-floating-preview-close"
              onClick={() => setShowPreview(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="chat-floating-preview-list">
            {recentMessages.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Aucun message récent
              </div>
            ) : (
              recentMessages.map(msg => (
                <div 
                  key={msg.id} 
                  className="chat-floating-preview-item"
                  onClick={() => {
                    setShowPreview(false);
                    if (onNavigateToChat) onNavigateToChat();
                  }}
                >
                  <div className="chat-floating-preview-avatar">
                    {getUserAvatar(msg.expediteur)}
                  </div>
                  <div className="chat-floating-preview-info">
                    <div className="chat-floating-preview-name">
                      {msg.expediteur?.prenom} {msg.expediteur?.nom}
                    </div>
                    <div className="chat-floating-preview-message">
                      {msg.contenu?.substring(0, 40)}...
                    </div>
                  </div>
                  <div className="chat-floating-preview-badge"></div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

// Main App Component
function App() {
  return (
    <div className="App">
      {/* Arrière-plan ophtalmologique moderne */}
      <div className="app-background">
        <div className="bg-decoration bg-decoration-1"></div>
        <div className="bg-decoration bg-decoration-2"></div>
        <div className="bg-decoration bg-decoration-3"></div>
      </div>
      
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <PlanningProvider>
                    <Dashboard />
                  </PlanningProvider>
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
          <PWAInstallBanner />
          <FloatingChatButton />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
