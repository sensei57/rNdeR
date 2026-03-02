/**
 * Composant PhotoWithFallback
 * Affiche une photo avec fallback sur les initiales
 */
import React, { useState } from 'react';
import { getPhotoUrl } from '../../utils/helpers';

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

export default PhotoWithFallback;
