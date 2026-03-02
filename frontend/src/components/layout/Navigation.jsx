/**
 * Composant de navigation principal
 */
import React from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, Menu, LogOut, Users, Building2, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBadge from '../notifications/NotificationBadge';

const API = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : '/api';

const Navigation = ({ menuOpen, setMenuOpen, menuItems, activeTab, setActiveTab }) => {
  const { user, logout, setUser, centres, centreActif, switchCentre } = useAuth();

  const handleStopImpersonation = async () => {
    try {
      const originalToken = localStorage.getItem('originalToken');
      if (originalToken) {
        localStorage.setItem('token', originalToken);
        localStorage.removeItem('originalToken');
        localStorage.removeItem('isImpersonating');
        axios.defaults.headers.common['Authorization'] = `Bearer ${originalToken}`;
        const response = await axios.get(`${API}/users/me`);
        setUser(response.data);
        toast.success('Retour à votre compte directeur');
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
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2.5 rounded-xl text-gray-500 hover:text-[#0091B9] hover:bg-[#E6F4F8] transition-all duration-200"
                aria-label="Menu"
                data-testid="menu-toggle-btn"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-[#0091B9] to-[#19CD91] rounded-xl flex items-center justify-center shadow-sm">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-gray-800 hidden sm:block">OphtaGestion</h1>
              </div>
              
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
                  <p className="font-semibold text-gray-800">{user?.prenom} {user?.nom}</p>
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

      {/* Barre de navigation horizontale - DESKTOP */}
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
              
              {moreMenuItems.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-[#0091B9] hover:bg-[#E6F4F8] transition-all duration-200">
                    <MoreHorizontal className="h-4 w-4" />
                    <span>Plus</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  
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
      
      {/* Menu mobile */}
      {menuOpen && (
        <div className="lg:hidden absolute left-4 top-[72px] w-72 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-gray-100 z-50 animate-scale-in max-h-[calc(100vh-100px)] overflow-y-auto">
          <div className="p-3">
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

export default Navigation;
