import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Filtres du Planning (rôles, employés, navigation)
 */
const PlanningFilters = ({
  viewMode,
  filterRole,
  handleRoleToggle,
  filterEmploye,
  setFilterEmploye,
  showDetails,
  setShowDetails,
  users,
  hasDirectorView,
  // Navigation
  selectedDate,
  setSelectedDate,
  selectedWeek,
  selectedMonth,
  setSelectedMonth,
  navigateDay,
  navigateWeek,
  navigateMonth,
  // Recherche
  searchEmploye,
  setSearchEmploye,
  // Helpers
  sortEmployeesByRoleThenName,
  filterEmployeesBySearch,
  planning,
  planningSemaine
}) => {
  
  // Calculer le nombre de jours pour un employé
  const getEmployeeDays = (emp) => {
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
    return jours % 1 === 0 ? jours.toString() : jours.toFixed(1).replace('.', ',');
  };

  return (
    <div className="space-y-4">
      {/* Ligne 1 : Filtres par rôle */}
      <div className="flex flex-wrap items-center gap-4">
        {(viewMode === 'semaine' || viewMode === 'planning') && (
          <>
            <div className="flex space-x-2">
              <Button
                variant={filterRole.length === 3 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRoleToggle('all')}
              >
                Tous
              </Button>
              <Button
                variant={filterRole.includes('Médecin') && filterRole.length < 3 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRoleToggle('Médecin')}
                className={filterRole.includes('Médecin') ? 'bg-blue-500 hover:bg-blue-600' : ''}
              >
                {filterRole.includes('Médecin') ? '✓ ' : ''}Médecins
              </Button>
              <Button
                variant={filterRole.includes('Assistant') && filterRole.length < 3 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRoleToggle('Assistant')}
                className={filterRole.includes('Assistant') ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
              >
                {filterRole.includes('Assistant') ? '✓ ' : ''}Assistants
              </Button>
              <Button
                variant={filterRole.includes('Secrétaire') && filterRole.length < 3 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRoleToggle('Secrétaire')}
                className={filterRole.includes('Secrétaire') ? 'bg-purple-500 hover:bg-purple-600' : ''}
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
      
      {/* Ligne 2 : Filtre employé + Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Filtre par employé */}
        {hasDirectorView && viewMode !== 'mois' && (
          <div className="flex items-center space-x-2">
            <Label className="text-sm whitespace-nowrap">Employé:</Label>
            <Select value={filterEmploye} onValueChange={(val) => { setFilterEmploye(val); setSearchEmploye(''); }}>
              <SelectTrigger className="w-[280px] h-8">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 border-b">
                  <Input
                    placeholder="🔍 Rechercher..."
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
                  const joursStr = getEmployeeDays(emp);
                  const jours = parseFloat(joursStr.replace(',', '.'));
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
        
        {/* Navigation */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (viewMode === 'jour') navigateDay('prev');
              else if (viewMode === 'semaine' || viewMode === 'planning') navigateWeek('prev');
              else if (viewMode === 'mois') navigateMonth('prev');
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
              value={viewMode === 'jour' ? selectedDate : selectedWeek}
              onChange={(e) => {
                if (viewMode === 'jour') setSelectedDate(e.target.value);
                else setSelectedWeek(e.target.value);
              }}
              className="w-auto"
            />
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (viewMode === 'jour') navigateDay('next');
              else if (viewMode === 'semaine' || viewMode === 'planning') navigateWeek('next');
              else if (viewMode === 'mois') navigateMonth('next');
            }}
            className="px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanningFilters;
