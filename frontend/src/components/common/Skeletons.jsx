import React from 'react';

// Skeleton pour les cartes
export const CardSkeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`}>
    <div className="p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>
);

// Skeleton pour les stats
export const StatsSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="animate-pulse bg-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-16"></div>
            <div className="h-6 bg-gray-200 rounded w-8"></div>
          </div>
          <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    ))}
  </div>
);

// Skeleton pour le planning
export const PlanningSkeleton = () => (
  <div className="space-y-4">
    <div className="animate-pulse bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl h-24"></div>
    <div className="animate-pulse bg-gray-100 rounded-xl h-12"></div>
    <div className="grid grid-cols-7 gap-2">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-32"></div>
      ))}
    </div>
  </div>
);

// Skeleton pour la liste
export const ListSkeleton = ({ count = 3 }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="animate-pulse bg-gray-100 rounded-xl p-4">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Skeleton pour le tableau de bord
export const DashboardSkeleton = () => (
  <div className="space-y-6 p-6">
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <CardSkeleton className="h-64" />
      <CardSkeleton className="h-64" />
    </div>
  </div>
);

// Composant de chargement global avec animation fluide
export const GlobalLoader = ({ text = "Chargement..." }) => (
  <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="text-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-[#0091B9]/20 rounded-full"></div>
        <div className="w-16 h-16 border-4 border-t-[#0091B9] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin absolute top-0 left-0"></div>
      </div>
      <p className="mt-4 text-gray-600 font-medium">{text}</p>
    </div>
  </div>
);

export default {
  CardSkeleton,
  StatsSkeleton,
  PlanningSkeleton,
  ListSkeleton,
  DashboardSkeleton,
  GlobalLoader
};
