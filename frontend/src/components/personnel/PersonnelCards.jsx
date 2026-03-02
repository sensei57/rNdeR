/**
 * Composants de cartes pour le personnel
 */
import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Calendar, Phone, Edit, Trash2 } from 'lucide-react';
import { getPhotoUrl } from '../../utils/helpers';

/**
 * Carte Médecin
 */
export const MedecinCard = ({ medecin, user, handleEditPersonnel, handleDeletePersonnel, getAssignedAssistants }) => {
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

/**
 * Carte Assistant
 */
export const AssistantCard = ({ assistant, user, handleEditPersonnel, handleDeletePersonnel, personnelList }) => {
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

/**
 * Carte Secrétaire
 */
export const SecretaireCard = ({ secretaire, user, handleEditPersonnel, handleDeletePersonnel }) => {
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

export default { MedecinCard, AssistantCard, SecretaireCard };
