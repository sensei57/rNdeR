import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Calendar, Users, Clock, Plus, Check, X, CalendarDays, Trash2, Edit, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, Eye, Copy, Download, FileDown, Filter, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useAuth } from "../../contexts/AuthContext";
import { usePlanning } from "../../contexts/PlanningContext";
import PlanningHeader from './PlanningHeader';

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const PlanningManager = () => {
  const { user } = useAuth();
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
  // hasDirectorView: peut voir le planning comme un directeur (Directeur OU vue_planning_complete)
  // canModifyPlanning: peut modifier le planning (Directeur OU peut_modifier_planning)
  const hasDirectorView = () => user?.role === 'Directeur' || user?.vue_planning_complete === true;
  const canModifyPlanning = () => user?.role === 'Directeur' || user?.peut_modifier_planning === true;
  
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
      pdf.autoTable({
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
      
      // Cloner le tableau pour la capture
      const clone = tableElement.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = 'auto';
      clone.style.minWidth = 'max-content';
      clone.style.background = 'white';
      document.body.appendChild(clone);
      
      // Attendre que le clone soit rendu
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight
      });
      
      // Supprimer le clone
      document.body.removeChild(clone);
      
      // Vérifier que le canvas n'est pas vide
      if (canvas.width === 0 || canvas.height === 0) {
        toast.error('Erreur: capture vide');
        return;
      }
      
      const link = document.createElement('a');
      link.download = `planning_${selectedWeek}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Image téléchargée !');
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
  }, [selectedDate, selectedWeek, selectedMonth, viewMode, user?.role]);

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
      fetchConges();
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la suppression du congé');
    }
  };
  
  // Modifier le type d'un congé existant
  const handleModifierTypeConge = async (congeId, nouveauType) => {
    try {
      await axios.put(`${API}/conges/${congeId}`, { type_conge: nouveauType });
      toast.success('Type de congé modifié !');
      fetchConges();
      fetchPlanningTableau(selectedWeek);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la modification');
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
              <div ref={planningTableRef}>
              <table className="w-full border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-1 text-left text-xs" style={{width: '100px', maxWidth: '100px'}}>
                      Employé
                    </th>
                    {planningTableau.dates.map((date, dateIndex) => (
                      <th 
                        key={date} 
                        className={`border p-1 text-center min-w-[80px] cursor-pointer hover:bg-teal-100 transition-colors ${dateIndex % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}`}
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
                        <th className="border p-1 text-center bg-gray-300 text-xs" title="Total demi-journées">½j</th>
                        <th className="border p-1 text-center bg-blue-200 text-xs" title="Heures effectuées cette semaine (selon Semaine A ou B)">
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
                        <th className="border p-1 text-center bg-indigo-200 text-xs" title="Comparaison heures faites vs contrat">Ctr</th>
                        <th className="border p-1 text-center bg-orange-200 text-xs" title="Heures supp/récup Semaine">+/- S</th>
                        <th className="border p-1 text-center bg-orange-100 text-xs" title="Heures supp/récup Mois">+/- M</th>
                        <th className="border p-1 text-center bg-orange-50 text-xs" title="Heures supp/récup Année">+/- A</th>
                        <th className="border p-1 text-center bg-green-200 text-xs" title="Heures de congés">Cg</th>
                      </>
                    )}
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border p-1"></th>
                    {planningTableau.dates.map((date, dateIndex) => (
                      <React.Fragment key={`header-${date}`}>
                        <th 
                          className={`border p-1 text-center text-xs cursor-pointer hover:bg-slate-200 transition-colors ${dateIndex % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}`}
                          onClick={() => openDetailJourModal(date)}
                          title="📋 Voir détail journée"
                        >M</th>
                        <th 
                          className={`border p-1 text-center text-xs cursor-pointer hover:bg-slate-200 transition-colors ${dateIndex % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}`}
                          onClick={() => openDetailJourModal(date)}
                          title="📋 Voir détail journée"
                        >AM</th>
                      </React.Fragment>
                    ))}
                    {showRecapColumns && (
                      <>
                        <th className="border p-1 text-center text-xs bg-gray-300">½j</th>
                        <th className="border p-1 text-center text-xs bg-blue-200">H</th>
                        <th className="border p-1 text-center text-xs bg-indigo-200">Ctr</th>
                        <th className="border p-1 text-center text-xs bg-orange-200">+/- S</th>
                        <th className="border p-1 text-center text-xs bg-orange-100">+/- M</th>
                        <th className="border p-1 text-center text-xs bg-orange-50">+/- A</th>
                        <th className="border p-1 text-center text-xs bg-green-200">Cg</th>
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
                          className="border p-1 font-medium text-xs whitespace-nowrap"
                        >
                          <span 
                            className="cursor-pointer hover:bg-pink-200 px-1 rounded"
                            onClick={() => openSemaineABCModal({ type: 'employe', employe: secretaire })}
                            title="Cliquer pour appliquer Semaine A, B ou Congés"
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
                          className="border p-1 font-medium text-xs whitespace-nowrap"
                        >
                          <span 
                            className="cursor-pointer hover:bg-green-200 px-1 rounded"
                            onClick={() => openSemaineABCModal({ type: 'employe', employe: assistant })}
                            title="Cliquer pour appliquer Semaine A, B ou Congés"
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
                          className="border p-1 font-medium text-xs whitespace-nowrap"
                        >
                          <span 
                            className="cursor-pointer hover:bg-blue-200 px-1 rounded"
                            onClick={() => openSemaineABCModal({ type: 'employe', employe: medecin })}
                            title="Cliquer pour appliquer Semaine A, B ou Congés"
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
                <h4 className="font-semibold text-gray-700 mb-3">
                  🏖️ {journeeData.congeExistant ? 'Congé existant - Décocher pour annuler' : 'Ajouter un congé ou repos pour cette journée'}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={journeeData.matin.conge || false}
                        onChange={async (e) => {
                          if (!e.target.checked && journeeData.congeExistant) {
                            // Décocher = supprimer le congé existant
                            await handleSupprimerCongeExistant(journeeData.congeExistant.id);
                            setJourneeData(prev => ({
                              ...prev,
                              congeExistant: null,
                              matin: { ...prev.matin, conge: false, type_conge: '' },
                              apresMidi: { ...prev.apresMidi, conge: false, type_conge: '' }
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
                        className="w-full p-2 border rounded text-sm mt-2"
                        value={journeeData.matin.type_conge || 'CONGE_PAYE'}
                        onChange={(e) => {
                          setJourneeData(prev => ({
                            ...prev,
                            matin: { ...prev.matin, type_conge: e.target.value }
                          }));
                          // Si congé existant, modifier le type
                          if (journeeData.congeExistant) {
                            handleModifierTypeConge(journeeData.congeExistant.id, e.target.value);
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
                  </div>
                  <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={journeeData.apresMidi.conge || false}
                        onChange={async (e) => {
                          if (!e.target.checked && journeeData.congeExistant) {
                            // Décocher = supprimer le congé existant
                            await handleSupprimerCongeExistant(journeeData.congeExistant.id);
                            setJourneeData(prev => ({
                              ...prev,
                              congeExistant: null,
                              matin: { ...prev.matin, conge: false, type_conge: '' },
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
                        className="w-full p-2 border rounded text-sm mt-2"
                        value={journeeData.apresMidi.type_conge || 'CONGE_PAYE'}
                        onChange={(e) => {
                          setJourneeData(prev => ({
                            ...prev,
                            apresMidi: { ...prev.apresMidi, type_conge: e.target.value }
                          }));
                          // Si congé existant, modifier le type
                          if (journeeData.congeExistant) {
                            handleModifierTypeConge(journeeData.congeExistant.id, e.target.value);
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
                    fetchPlanning();
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
                    fetchPlanning();
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
                    fetchPlanning();
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

export default PlanningManager;
