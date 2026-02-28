import React, { useState } from 'react';
import { getPhotoUrl, getInitials, getRoleColor } from '../../utils/helpers';

// Composant Image avec fallback automatique vers initiales
export const PhotoWithFallback = ({ src, prenom, nom, role, className, fallbackClassName, style }) => {
  const [hasError, setHasError] = useState(false);
  
  const initials = getInitials(prenom, nom);
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

// Composant Avatar avec gestion d'erreur
export const UserAvatar = ({ user, size = 'md', className = '' }) => {
  const [hasError, setHasError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };
  
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const roleColor = getRoleColor(user?.role);
  
  if (user?.photo_url && !hasError) {
    return (
      <img 
        src={getPhotoUrl(user.photo_url)}
        alt={`${user.prenom} ${user.nom}`}
        className={`${sizeClass} rounded-full object-cover ${className}`}
        onError={() => setHasError(true)}
      />
    );
  }
  
  return (
    <div className={`${sizeClass} ${roleColor} rounded-full flex items-center justify-center text-white font-medium ${className}`}>
      {getInitials(user?.prenom, user?.nom)}
    </div>
  );
};

export default PhotoWithFallback;
