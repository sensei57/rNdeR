import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Header du Planning avec gradient et boutons de vue
 */
const PlanningHeader = ({ 
  viewMode, 
  setViewMode, 
  hasDirectorView,
  selectedDate,
  selectedWeek,
  setSelectedDate,
  setSelectedWeek,
  setSelectedMonth
}) => {
  return (
    <div className="bg-gradient-to-r from-[#0091B9] via-[#007494] to-[#19CD91] rounded-2xl p-6 text-white shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7" />
            Planning Interactif
          </h2>
          <p className="text-white/80 mt-1">Gérez les horaires et affectations du personnel</p>
        </div>
        
        {/* Boutons de vue */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={viewMode === 'jour' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewMode('jour');
              setSelectedDate(selectedWeek);
            }}
            className={viewMode === 'jour' 
              ? 'bg-white text-[#0091B9] hover:bg-white/90' 
              : 'text-white hover:bg-white/20 border-white/30'}
          >
            Jour
          </Button>
          <Button
            variant={viewMode === 'semaine' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewMode('semaine');
              setSelectedWeek(selectedDate);
            }}
            className={viewMode === 'semaine' 
              ? 'bg-white text-[#0091B9] hover:bg-white/90' 
              : 'text-white hover:bg-white/20 border-white/30'}
          >
            Semaine
          </Button>
          <Button
            variant={viewMode === 'mois' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewMode('mois');
              setSelectedMonth(selectedDate.slice(0, 7));
            }}
            className={viewMode === 'mois' 
              ? 'bg-white text-[#0091B9] hover:bg-white/90' 
              : 'text-white hover:bg-white/20 border-white/30'}
          >
            Mois
          </Button>
          {hasDirectorView && (
            <Button
              variant={viewMode === 'planning' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setViewMode('planning');
                setSelectedWeek(selectedDate);
              }}
              className={viewMode === 'planning' 
                ? 'bg-white text-[#0091B9] hover:bg-white/90' 
                : 'text-white hover:bg-white/20 border-white/30'}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Planning
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanningHeader;
