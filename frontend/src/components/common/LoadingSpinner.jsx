import React from 'react';

// Composant de chargement réutilisable
export const LoadingSpinner = ({ size = 'md', text = 'Chargement...' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`animate-spin ${sizeClasses[size]} border-4 border-primary-500 border-t-transparent rounded-full`}></div>
      {text && <p className="mt-4 text-gray-600">{text}</p>}
    </div>
  );
};

// Composant d'état vide réutilisable
export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action,
  actionLabel 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {Icon && <Icon className="h-16 w-16 text-gray-300 mb-4" />}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-gray-500 text-center max-w-sm">{description}</p>}
      {action && actionLabel && (
        <button 
          onClick={action}
          className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default LoadingSpinner;
