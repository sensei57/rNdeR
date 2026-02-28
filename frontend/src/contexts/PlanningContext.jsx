import React, { createContext, useContext, useState } from 'react';

const PlanningContext = createContext(null);

export const usePlanning = () => {
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

export const PlanningProvider = ({ children }) => {
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

export default PlanningContext;
