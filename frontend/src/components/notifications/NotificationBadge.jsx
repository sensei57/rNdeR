/**
 * Composant badge de notification
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const API = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : '/api';

const NotificationBadge = ({ setActiveTab }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/notifications/unread-count`);
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setActiveTab && setActiveTab('notifications')}
      className="relative p-2 rounded-xl text-gray-500 hover:text-[#0091B9] hover:bg-[#E6F4F8] transition-all duration-200"
      data-testid="notification-badge-btn"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white border-2 border-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
};

export default NotificationBadge;
