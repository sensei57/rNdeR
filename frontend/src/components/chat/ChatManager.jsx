import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { MessageSquare, Plus, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (
  window.location.hostname.includes('test') 
    ? 'https://ope-francis-test.onrender.com' 
    : 'https://ope-francis.onrender.com'
);
const API = BACKEND_URL + '/api';

const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('/api')) {
    return `${BACKEND_URL}${photoUrl}`;
  }
  return photoUrl;
};

const ChatManager = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroupe, setSelectedGroupe] = useState(null);
  const [users, setUsers] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [chatType, setChatType] = useState('GENERAL');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newGroupe, setNewGroupe] = useState({
    nom: '',
    description: '',
    membres: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchGroupes();
  }, []);

  useEffect(() => {
    fetchMessages();
    
    // Polling intelligent pour les messages (10 secondes, pause si onglet caché)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [chatType, selectedGroupe, selectedUser]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.id !== user?.id));
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs');
    }
  };

  const fetchGroupes = async () => {
    try {
      const response = await axios.get(`${API}/groupes-chat`);
      setGroupes(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des groupes');
    }
  };

  const fetchMessages = useCallback(async () => {
    try {
      let url = '';
      
      if (chatType === 'PRIVE' && selectedUser) {
        url = `${API}/messages/conversation/${selectedUser.id}?limit=100`;
      } 
      else if (chatType === 'GROUPE' && selectedGroupe) {
        url = `${API}/messages?type_message=${chatType}&groupe_id=${selectedGroupe.id}&limit=100`;
      }
      else if (chatType === 'GENERAL') {
        url = `${API}/messages?type_message=${chatType}&limit=100`;
      }
      else {
        setMessages([]);
        setLoading(false);
        return;
      }
      
      const response = await axios.get(url);
      setMessages(response.data.reverse());
    } catch (error) {
      console.error('Erreur lors du chargement des messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [chatType, selectedUser, selectedGroupe]);

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    try {
      const messageData = {
        contenu: newMessage,
        type_message: chatType,
        destinataire_id: chatType === 'PRIVE' ? selectedUser?.id : null,
        groupe_id: chatType === 'GROUPE' ? selectedGroupe?.id : null
      };
      
      await axios.post(`${API}/messages`, messageData);
      setNewMessage('');
      fetchMessages();
      toast.success('Message envoyé');
    } catch (error) {
      toast.error("Erreur lors de l'envoi");
    }
  };

  const handleCreateGroupe = async (e) => {
    e.preventDefault();
    
    if (!newGroupe.nom || newGroupe.membres.length === 0) {
      toast.error('Nom et membres requis');
      return;
    }

    try {
      await axios.post(`${API}/groupes-chat`, newGroupe);
      toast.success('Groupe créé avec succès');
      setShowGroupModal(false);
      setNewGroupe({ nom: '', description: '', membres: [] });
      fetchGroupes();
    } catch (error) {
      toast.error('Erreur lors de la création du groupe');
    }
  };

  const formatMessageTime = (date) => {
    const msgDate = new Date(date);
    const today = new Date();
    const isToday = msgDate.toDateString() === today.toDateString();
    
    if (isToday) {
      return msgDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return msgDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getUserAvatar = (userData) => {
    if (userData?.photo_url) {
      return <img src={getPhotoUrl(userData.photo_url)} alt="" className="w-full h-full object-cover" />;
    }
    const bgColor = userData?.role === 'Médecin' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                    userData?.role === 'Assistant' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                    userData?.role === 'Secrétaire' ? 'bg-gradient-to-br from-purple-400 to-purple-600' :
                    'bg-gradient-to-br from-gray-400 to-gray-600';
    return (
      <div className={`avatar-fallback ${bgColor}`}>
        {userData?.prenom?.[0]}{userData?.nom?.[0]}
      </div>
    );
  };

  const getCurrentChatInfo = () => {
    if (chatType === 'GENERAL') {
      return { name: 'Chat Général', subtitle: 'Tous les employés', icon: '👥' };
    }
    if (chatType === 'GROUPE' && selectedGroupe) {
      return { name: selectedGroupe.nom, subtitle: `${selectedGroupe.membres_details?.length || 0} membres`, icon: '👨‍👩‍👧‍👦' };
    }
    if (chatType === 'PRIVE' && selectedUser) {
      return { name: `${selectedUser.prenom} ${selectedUser.nom}`, subtitle: selectedUser.role, user: selectedUser };
    }
    return null;
  };

  const chatInfo = getCurrentChatInfo();

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-[#0091B9] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ padding: '20px' }} data-testid="chat-manager">
      <div className="chat-container">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div className="chat-sidebar-title">
              <MessageSquare className="h-6 w-6" />
              <span>Messages</span>
            </div>
            <div className="chat-tabs">
              <button 
                className={`chat-tab ${chatType === 'GENERAL' ? 'active' : ''}`}
                onClick={() => { setChatType('GENERAL'); setSelectedUser(null); setSelectedGroupe(null); setSearchQuery(''); }}
              >
                Général
              </button>
              <button 
                className={`chat-tab ${chatType === 'PRIVE' ? 'active' : ''}`}
                onClick={() => { setChatType('PRIVE'); setSelectedGroupe(null); setSearchQuery(''); }}
              >
                Privé
              </button>
              <button 
                className={`chat-tab ${chatType === 'GROUPE' ? 'active' : ''}`}
                onClick={() => { setChatType('GROUPE'); setSelectedUser(null); setSearchQuery(''); }}
              >
                Groupes
              </button>
            </div>
            
            {/* Barre de recherche */}
            {chatType === 'PRIVE' && (
              <div className="p-3 border-b border-gray-200">
                <Input
                  type="text"
                  placeholder="🔍 Rechercher un utilisateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
            )}
          </div>
          
          <div className="chat-list" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {chatType === 'GENERAL' && (
              <div className="chat-list-item active">
                <div className="chat-list-avatar">
                  <div className="avatar-fallback bg-gradient-to-br from-primary-400 to-primary-600">👥</div>
                </div>
                <div className="chat-list-info">
                  <div className="chat-list-name">Chat Général</div>
                  <div className="chat-list-preview">Tous les employés du cabinet</div>
                </div>
              </div>
            )}
            
            {chatType === 'PRIVE' && users
              .filter(u => {
                if (!searchQuery.trim()) return true;
                const fullName = `${u.prenom} ${u.nom}`.toLowerCase();
                const query = searchQuery.toLowerCase();
                return fullName.includes(query) || u.role?.toLowerCase().includes(query);
              })
              .map(u => (
              <div 
                key={u.id} 
                className={`chat-list-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                onClick={() => setSelectedUser(u)}
              >
                <div className="chat-list-avatar">
                  {getUserAvatar(u)}
                  {u.actif && <div className="online-indicator"></div>}
                </div>
                <div className="chat-list-info">
                  <div className="chat-list-name">{u.prenom} {u.nom}</div>
                  <div className="chat-list-preview">{u.role}</div>
                </div>
              </div>
            ))}
            
            {chatType === 'GROUPE' && (
              <>
                {groupes.map(g => (
                  <div 
                    key={g.id} 
                    className={`chat-list-item ${selectedGroupe?.id === g.id ? 'active' : ''}`}
                    onClick={() => setSelectedGroupe(g)}
                  >
                    <div className="chat-list-avatar">
                      <div className="avatar-fallback bg-gradient-to-br from-accent-400 to-accent-600">👨‍👩‍👧‍👦</div>
                    </div>
                    <div className="chat-list-info">
                      <div className="chat-list-name">{g.nom}</div>
                      <div className="chat-list-preview">{g.membres_details?.length || 0} membres</div>
                    </div>
                  </div>
                ))}
                <button 
                  className="chat-list-item"
                  onClick={() => setShowGroupModal(true)}
                  style={{ border: '2px dashed var(--gray-300)', justifyContent: 'center' }}
                >
                  <Plus className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-500 font-medium">Créer un groupe</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Zone principale du chat */}
        <div className="chat-main">
          {chatInfo ? (
            <>
              <div className="chat-header">
                <div className="chat-header-avatar">
                  {chatInfo.user ? getUserAvatar(chatInfo.user) : (
                    <div className="avatar-fallback bg-gradient-to-br from-primary-400 to-primary-600">{chatInfo.icon}</div>
                  )}
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">{chatInfo.name}</div>
                  <div className="chat-header-status">{chatInfo.subtitle}</div>
                </div>
              </div>
              
              <div className="chat-messages">
                {messages.map(message => {
                  const isSent = message.expediteur.id === user?.id;
                  return (
                    <div key={message.id} className={`message-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
                      {!isSent && (
                        <div className="message-avatar">
                          {getUserAvatar(message.expediteur)}
                        </div>
                      )}
                      <div className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
                        {!isSent && chatType !== 'PRIVE' && (
                          <div className="message-sender">{message.expediteur.prenom} {message.expediteur.nom}</div>
                        )}
                        <div className="message-content">{message.contenu}</div>
                        <div className="message-time">{formatMessageTime(message.date_envoi)}</div>
                      </div>
                    </div>
                  );
                })}
                
                {messages.length === 0 && (
                  <div className="chat-empty">
                    <div className="chat-empty-icon">💬</div>
                    <div className="chat-empty-title">Aucun message</div>
                    <div className="chat-empty-text">Soyez le premier à envoyer un message !</div>
                  </div>
                )}
              </div>
              
              <form onSubmit={sendMessage} className="chat-input-area">
                <input
                  type="text"
                  className="chat-input"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${chatInfo.name}...`}
                />
                <button 
                  type="submit" 
                  className="chat-send-btn"
                  disabled={!newMessage.trim()}
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty">
              <div className="chat-empty-icon">👈</div>
              <div className="chat-empty-title">Sélectionnez une conversation</div>
              <div className="chat-empty-text">Choisissez un collègue ou un groupe pour commencer</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de création de groupe */}
      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un Groupe</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateGroupe} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du groupe *</Label>
              <Input
                value={newGroupe.nom}
                onChange={(e) => setNewGroupe({...newGroupe, nom: e.target.value})}
                placeholder="Équipe chirurgie..."
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newGroupe.description}
                onChange={(e) => setNewGroupe({...newGroupe, description: e.target.value})}
                placeholder="Description du groupe..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Membres *</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {users.map(u => (
                  <label key={u.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newGroupe.membres.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewGroupe({
                            ...newGroupe,
                            membres: [...newGroupe.membres, u.id]
                          });
                        } else {
                          setNewGroupe({
                            ...newGroupe,
                            membres: newGroupe.membres.filter(id => id !== u.id)
                          });
                        }
                      }}
                    />
                    <span className="text-sm">
                      {u.prenom} {u.nom} ({u.role})
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowGroupModal(false)}>
                Annuler
              </Button>
              <Button type="submit">
                Créer Groupe
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatManager;
