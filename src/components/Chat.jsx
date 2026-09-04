import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MdSend, MdContentCopy, MdCheck, MdPersonAdd, MdCircle, MdDeleteForever, 
  MdAttachFile, MdTimer, MdTimerOff, MdMic, MdMicOff, MdFileDownload, MdEdit
} from 'react-icons/md';
import './Chat.css';

export default function Chat({ isChatVisible, t }) {
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('Anonimo');
  const [myProfilePic, setMyProfilePic] = useState('');
  const [contacts, setContacts] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [activeContactId, setActiveContactId] = useState(null);
  const [messagesByContact, setMessagesByContact] = useState({});
  const [mutualPeers, setMutualPeers] = useState(new Set());
  const [input, setInput] = useState('');
  const [addCode, setAddCode] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Security & Contact Requests
  const [allowIncomingRequests, setAllowIncomingRequests] = useState(false);
  const [blockedContacts, setBlockedContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showRequestsTab, setShowRequestsTab] = useState(false);
  
  // Custom Prompt State
  const [promptConfig, setPromptConfig] = useState(null);
  const [promptValue, setPromptValue] = useState("");
  
  // New Feature States
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const messagesEndRef = useRef(null);
  const isChatVisibleRef = useRef(isChatVisible);
  const activeContactIdRef = useRef(activeContactId);
  const contactsRef = useRef(contacts);
  const myNameRef = useRef(myName);
  const myProfilePicRef = useRef(myProfilePic);
  const mutualPeersRef = useRef(mutualPeers);
  const allowIncomingRequestsRef = useRef(allowIncomingRequests);
  const blockedContactsRef = useRef(blockedContacts);

  useEffect(() => { isChatVisibleRef.current = isChatVisible; }, [isChatVisible]);
  useEffect(() => { activeContactIdRef.current = activeContactId; }, [activeContactId]);
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);
  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { myProfilePicRef.current = myProfilePic; }, [myProfilePic]);
  useEffect(() => { mutualPeersRef.current = mutualPeers; }, [mutualPeers]);
  useEffect(() => { allowIncomingRequestsRef.current = allowIncomingRequests; }, [allowIncomingRequests]);
  useEffect(() => { blockedContactsRef.current = blockedContacts; }, [blockedContacts]);

  const deleteMessage = useCallback((contactId, msgTime) => {
    setMessagesByContact(prev => {
      const next = { ...prev };
      if (next[contactId]) {
        next[contactId] = next[contactId].filter(m => m.time !== msgTime);
      }
      return next;
    });
  }, []);

  // Load chat data and ID from backend
  useEffect(() => {
    const init = async () => {
      let savedContacts = [];

      if (window.electron && window.electron.loadChatData) {
        const data = await window.electron.loadChatData();
        if (data && data.contacts) savedContacts = data.contacts;
        if (data && data.myName) setMyName(data.myName);
        if (data && data.myProfilePic) setMyProfilePic(data.myProfilePic);
        if (data && data.allowIncomingRequests !== undefined) setAllowIncomingRequests(data.allowIncomingRequests);
        if (data && data.blockedContacts) setBlockedContacts(data.blockedContacts);
      }
      setContacts(savedContacts);

      if (window.electron && window.electron.torGetId) {
        const fetchId = async () => {
          const id = await window.electron.torGetId();
          if (id) {
            setMyId(id);
            window.electron.torOnPeerConnected((peerId) => {
              setOnlineIds(prev => new Set(prev).add(peerId));
              if (window.electron.torSendMessage) {
                window.electron.torSendMessage(peerId, { 
                  type: 'profile_sync', 
                  name: myNameRef.current, 
                  avatar: myProfilePicRef.current 
                });
              }
            });
            window.electron.torOnPeerDisconnected((peerId) => {
              setOnlineIds(prev => {
                const next = new Set(prev);
                next.delete(peerId);
                return next;
              });
            });
            
            window.electron.torOnMessage(({ peerId, message }) => {
              const isContact = contactsRef.current.some(c => c.id === peerId);
              if (!isContact) {
                return; // Ignore messages from peers not in contacts
              }
              
              setMutualPeers(prev => {
                if (!prev.has(peerId)) return new Set(prev).add(peerId);
                return prev;
              });

              setOnlineIds(prev => {
                if (!prev.has(peerId)) return new Set(prev).add(peerId);
                return prev;
              });

              if (message.type === 'profile_sync') {
                setContacts(prev => prev.map(c => 
                  c.id === peerId ? { ...c, name: message.name || c.name, avatar: message.avatar } : c
                ));
                
                if (!mutualPeersRef.current.has(peerId) && window.electron.torSendMessage) {
                  window.electron.torSendMessage(peerId, { 
                    type: 'profile_sync_ack', 
                    name: myNameRef.current, 
                    avatar: myProfilePicRef.current 
                  });
                }
                return;
              }
              
              if (message.type === 'profile_sync_ack') {
                setContacts(prev => prev.map(c => 
                  c.id === peerId ? { ...c, name: message.name || c.name, avatar: message.avatar } : c
                ));
                return;
              }

              const msgTime = Date.now();
              const newMsg = { from: 'them', time: msgTime, ...message };
              
              if (typeof message === 'string') {
                newMsg.type = 'text';
                newMsg.text = message;
              }

              setMessagesByContact(prev => ({
                ...prev,
                [peerId]: [...(prev[peerId] || []), newMsg],
              }));
              
              if (newMsg.ephemeral) {
                setTimeout(() => deleteMessage(peerId, msgTime), 10000);
              }

              if (!isChatVisibleRef.current || activeContactIdRef.current !== peerId || document.hidden) {
                if (window.electron.showNotification) {
                  const senderName = contactsRef.current.find(c => c.id === peerId)?.name || peerId.substring(0, 8);
                  window.electron.showNotification(`Message from ${senderName}`, 'New message received');
                }
              }
            });

            if (window.electron.torOnContactRequest) {
              window.electron.torOnContactRequest(({ peerId, profileName }) => {
                if (contactsRef.current.some(c => c.id === peerId) || blockedContactsRef.current.includes(peerId)) return;
                setPendingRequests(prev => {
                  if (prev.some(p => p.id === peerId)) return prev;
                  return [...prev, { id: peerId, name: profileName || peerId.substring(0, 8) }];
                });
                if (window.electron.showNotification) {
                  window.electron.showNotification('New Request', `Chat request from ${profileName || peerId.substring(0, 8)}`);
                }
              });
            }

            if (window.electron.torOnContactAccepted) {
              window.electron.torOnContactAccepted((peerId) => {
                setMutualPeers(prev => new Set(prev).add(peerId));
                setOnlineIds(prev => new Set(prev).add(peerId));
              });
            }

            savedContacts.forEach(c => window.electron.torConnect(c.id));
          } else {
            setTimeout(fetchId, 2000);
          }
        };
        fetchId();
      }
    };
    init();
  }, [deleteMessage]);

  // Save contacts (exclude ephemeral messages from history, though we only save contacts here)
  useEffect(() => {
    if (!myId) return;
    if (window.electron && window.electron.saveChatData) {
      const timer = setTimeout(() => {
        window.electron.saveChatData({ 
          myId, contacts, myName, myProfilePic, 
          allowIncomingRequests, blockedContacts 
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [myId, contacts, myName, myProfilePic, allowIncomingRequests, blockedContacts]);

  const tryConnect = useCallback((contactId) => {
    if (window.electron && window.electron.torConnect) window.electron.torConnect(contactId);
  }, []);

  const addContact = () => {
    const code = addCode.trim();
    if (!code || contacts.some((c) => c.id === code)) return;
    const newContact = { id: code, name: 'Contact ' + code.substring(0, 6), addedAt: Date.now() };
    setContacts((prev) => [...prev, newContact]);
    tryConnect(code);
    
    // Send Handshake
    if (window.electron && window.electron.torSendHandshake) {
       window.electron.torSendHandshake(code, 'CONTACT_REQUEST', myNameRef.current);
    }

    setAddCode('');
    setShowAddPanel(false);
    setActiveContactId(code);
  };

  const acceptRequest = (peerId, profileName) => {
    const newContact = { id: peerId, name: profileName || 'Contact ' + peerId.substring(0, 6), addedAt: Date.now() };
    setContacts((prev) => [...prev, newContact]);
    setPendingRequests(prev => prev.filter(p => p.id !== peerId));
    setMutualPeers(prev => new Set(prev).add(peerId));
    
    if (window.electron && window.electron.torSendHandshake) {
       window.electron.torSendHandshake(peerId, 'CONTACT_ACCEPTED', myNameRef.current);
    }
    tryConnect(peerId);
  };

  const blockRequest = (peerId) => {
    setBlockedContacts(prev => [...prev, peerId]);
    setPendingRequests(prev => prev.filter(p => p.id !== peerId));
  };

  const unblockRequest = (peerId) => {
    setBlockedContacts(prev => prev.filter(id => id !== peerId));
  };

  const renameContact = (e, contactId, currentName) => {
    e.stopPropagation();
    setPromptValue(currentName || "");
    setPromptConfig({
      title: t.renamePrompt || "Choose a new name for this contact:",
      onConfirm: (newName) => {
        if (newName && newName.trim() !== "") {
          setContacts(prev => prev.map(c => c.id === contactId ? { ...c, name: newName.trim() } : c));
        }
      }
    });
  };

  const deleteContact = (e, contactId) => {
    e.stopPropagation();
    if (!window.confirm(t.deleteContactConfirm)) return;
    if (activeContactId === contactId) setActiveContactId(null);
    setContacts((prev) => prev.filter(c => c.id !== contactId));
    setMessagesByContact((prev) => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
  };

  const copyMyId = () => {
    if (window.electron && window.electron.copyToClipboard) {
      window.electron.copyToClipboard(myId);
    } else {
      navigator.clipboard.writeText(myId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const dispatchMessage = (payload) => {
    if (!activeContactId) return;
    
    if (window.electron && window.electron.torSendMessage) {
      const msgTime = Date.now();
      const newMsg = { from: 'me', time: msgTime, ...payload };
      
      window.electron.torSendMessage(activeContactId, payload);
      setMessagesByContact((prev) => ({
        ...prev,
        [activeContactId]: [...(prev[activeContactId] || []), newMsg],
      }));
      
      if (payload.ephemeral) {
        setTimeout(() => deleteMessage(activeContactId, msgTime), 10000);
      }
    }
  };

  const broadcastProfileUpdate = (newName, newPic) => {
    if (!window.electron || !window.electron.torSendMessage) return;
    onlineIds.forEach(peerId => {
      window.electron.torSendMessage(peerId, { 
        type: 'profile_sync', 
        name: newName, 
        avatar: newPic 
      });
    });
  };

  const handleChangeMyName = () => {
    setPromptValue(myName || "");
    setPromptConfig({
      title: "Choose your Nickname:",
      onConfirm: (nextName) => {
        if (nextName && nextName.trim()) {
          setMyName(nextName.trim());
          broadcastProfileUpdate(nextName.trim(), myProfilePic);
        }
      }
    });
  };

  const handleSelectMyProfilePic = async () => {
    if (window.electron && window.electron.selectImage) {
      const base64 = await window.electron.selectImage();
      if (base64) {
        setMyProfilePic(base64);
        broadcastProfileUpdate(myName, base64);
      }
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    dispatchMessage({ type: 'text', text: input, ephemeral: isEphemeral });
    setInput('');
  };

  // --- FILE ATTACHMENT ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large (Max 10MB to avoid Tor network overload).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      dispatchMessage({ 
        type: file.type.startsWith('image/') ? 'image' : 'file', 
        filename: file.name, 
        data: reader.result, 
        ephemeral: isEphemeral 
      });
    };
    reader.readAsDataURL(file);
    e.target.value = null; // reset
  };

  // --- VOICE NOTES ---
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            dispatchMessage({ type: 'voice', data: reader.result, ephemeral: isEphemeral });
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (err) {
        alert("Microphone access error: " + err.message);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByContact, activeContactId]);

  const activeMessages = activeContactId ? messagesByContact[activeContactId] || [] : [];
  const activeContact = contacts.find((c) => c.id === activeContactId);
  const activeIsOnline = activeContactId ? onlineIds.has(activeContactId) : false;
  const activeIsMutual = activeContactId ? mutualPeers.has(activeContactId) : false;
  const canChat = activeIsOnline && activeIsMutual;

  const renderMessageContent = (msg) => {
    switch (msg.type) {
      case 'image':
        return <img src={msg.data} alt="Sent image" style={{ maxWidth: '100%', borderRadius: '8px' }} />;
      case 'file':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdFileDownload size={24} />
            <a href={msg.data} download={msg.filename} style={{ color: 'inherit', textDecoration: 'underline' }}>
              {msg.filename}
            </a>
          </div>
        );
      case 'voice':
        return <audio controls src={msg.data} style={{ height: '40px', maxWidth: '200px' }} />;
      default:
        return <span>{msg.text || msg.message}</span>;
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-my-profile-row">
        <div className="chat-my-profile-avatar" onClick={handleSelectMyProfilePic} title="Change Profile Picture">
          {myProfilePic ? <img src={myProfilePic} alt="My Profile" /> : <MdPersonAdd />}
        </div>
        <div className="chat-my-profile-info">
          <span className="chat-my-name" onClick={handleChangeMyName} title="Change Nickname">{myName}</span>
          <div className="chat-my-id-container">
            <span>ID:</span>
            <code>{myId ? myId.substring(0, 16) + '...' : t.generating}</code>
            <button onClick={copyMyId} title={t.copyFullId}>
              {copied ? <MdCheck /> : <MdContentCopy />}
            </button>
            <button onClick={() => setShowAddPanel(!showAddPanel)} title={t.addContact} style={{ marginLeft: 'auto' }}>
              <MdPersonAdd />
            </button>
          </div>
        </div>
      </div>

      {showAddPanel && (
        <div className="chat-add-row">
          <input
            type="text"
            placeholder={t.pasteHexId}
            value={addCode}
            onChange={(e) => setAddCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addContact()}
          />
          <button onClick={addContact}>{t.add}</button>
        </div>
      )}

      <div className="chat-body">
        <div className="chat-contacts">
          
          <div className="chat-contacts-header-actions" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              onClick={() => setShowRequestsTab(false)}
              style={{ background: 'none', border: 'none', color: !showRequestsTab ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: !showRequestsTab ? 'bold' : 'normal' }}
            >
              Contacts
            </button>
            <button 
              onClick={() => setShowRequestsTab(true)}
              style={{ background: 'none', border: 'none', color: showRequestsTab ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: showRequestsTab ? 'bold' : 'normal', position: 'relative' }}
            >
              Requests
              {pendingRequests.length > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-15px', background: 'var(--danger-color)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px' }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>

          {!showRequestsTab ? (
            <>
              {contacts.length === 0 && <p className="chat-empty-hint">{t.noContacts}</p>}
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className={`chat-contact-item ${activeContactId === c.id ? 'active' : ''}`}
                  onClick={() => setActiveContactId(c.id)}
                >
                  <div className="contact-avatar-container">
                    {c.avatar ? <img src={c.avatar} alt={c.name} className="contact-avatar" /> : <div className="contact-avatar-placeholder">{c.name.charAt(0).toUpperCase()}</div>}
                    <MdCircle className={`status-dot ${onlineIds.has(c.id) ? 'online' : 'offline'}`} />
                  </div>
                  <span className="contact-name">{c.name}</span>
                  <button className="delete-contact-btn" onClick={(e) => renameContact(e, c.id, c.name)} title="Rename Contact" style={{ color: 'inherit', marginRight: '4px' }}>
                    <MdEdit />
                  </button>
                  <button className="delete-contact-btn" onClick={(e) => deleteContact(e, c.id)} title={t.remove}>
                    <MdDeleteForever />
                  </button>
                </div>
              ))}
            </>
          ) : (
            <div className="chat-requests-tab" style={{ padding: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '15px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={allowIncomingRequests} 
                  onChange={(e) => setAllowIncomingRequests(e.target.checked)}
                />
                {t.allowIncomingRequests}
              </label>

              {pendingRequests.length === 0 && <p className="chat-empty-hint" style={{ fontSize: '13px' }}>No pending requests.</p>}
              
              {pendingRequests.map(req => (
                <div key={req.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{req.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID: {req.id.substring(0,16)}...</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                    <button onClick={() => acceptRequest(req.id, req.name)} style={{ flex: 1, padding: '6px', background: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t.accept}</button>
                    <button onClick={() => blockRequest(req.id)} style={{ flex: 1, padding: '6px', background: 'var(--danger-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t.block}</button>
                  </div>
                </div>
              ))}

              {blockedContacts.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '10px', fontSize: '12px', textTransform: 'uppercase' }}>Blocked Contacts</h4>
                  {blockedContacts.map(id => (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,68,68,0.1)', padding: '8px', borderRadius: '6px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--danger-color)' }}>{id.substring(0,16)}...</span>
                      <button onClick={() => unblockRequest(id)} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Unblock</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="chat-thread">
          {!activeContactId ? (
            <p className="chat-empty-hint">{t.selectContactHint}</p>
          ) : (
            <>
              <div className="chat-thread-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {activeContact?.avatar ? (
                    <img src={activeContact.avatar} alt={activeContact.name} className="thread-avatar" />
                  ) : (
                    <div className="thread-avatar-placeholder">{activeContact?.name?.charAt(0).toUpperCase()}</div>
                  )}
                  <span>{activeContact?.name}</span>
                </div>
                <span className={`status-badge ${activeIsOnline ? (activeIsMutual ? 'status-connected' : 'status-waiting') : 'status-waiting'}`}>
                  {activeIsOnline ? (activeIsMutual ? t.onlineP2P : 'Waiting for approval...') : t.offlineWaiting}
                </span>
              </div>
              <div className="chat-messages">
                {activeMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg chat-msg-${msg.from}`}>
                    {msg.ephemeral && <MdTimer size={14} style={{ float: 'right', opacity: 0.5, marginLeft: '8px' }} />}
                    {renderMessageContent(msg)}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="chat-input-row" style={{ alignItems: 'center' }}>
                <input
                  type="file"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                
                <button 
                  onClick={() => setIsEphemeral(!isEphemeral)} 
                  style={{ width: '40px', height: '40px', background: isEphemeral ? 'var(--danger-color)' : 'transparent', border: isEphemeral ? 'none' : '1px solid var(--accent-color)', color: isEphemeral ? 'white' : 'var(--accent-color)' }}
                  title="Self-Destructing Messages (10s)"
                >
                  {isEphemeral ? <MdTimer /> : <MdTimerOff />}
                </button>

                <button 
                  onClick={() => fileInputRef.current.click()} 
                  style={{ width: '40px', height: '40px', background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)' }}
                  title="Attach File"
                  disabled={!canChat}
                >
                  <MdAttachFile />
                </button>
                
                <button 
                  onClick={toggleRecording} 
                  style={{ width: '40px', height: '40px', background: isRecording ? 'var(--danger-color)' : 'transparent', border: isRecording ? 'none' : '1px solid var(--accent-color)', color: isRecording ? 'white' : 'var(--accent-color)', animation: isRecording ? 'pulse-dot 1s infinite' : 'none' }}
                  title="Voice Note"
                  disabled={!canChat}
                >
                  {isRecording ? <MdMicOff /> : <MdMic />}
                </button>

                <input
                  type="text"
                  placeholder={canChat ? t.msgEncrypted : (activeIsOnline ? "User must add you to contacts first..." : t.waitingPeer)}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={!canChat}
                />
                <button onClick={sendMessage} disabled={!canChat || !input.trim()}>
                  <MdSend />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {promptConfig && (
        <div className="custom-prompt-overlay" onClick={() => setPromptConfig(null)}>
          <div className="custom-prompt-modal" onClick={e => e.stopPropagation()}>
            <h3>{promptConfig.title}</h3>
            <input 
              type="text" 
              value={promptValue} 
              onChange={(e) => setPromptValue(e.target.value)}
              autoFocus 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  promptConfig.onConfirm(promptValue);
                  setPromptConfig(null);
                }
                if (e.key === 'Escape') setPromptConfig(null);
              }}
            />
            <div className="custom-prompt-actions">
              <button onClick={() => setPromptConfig(null)}>Cancel</button>
              <button className="primary" onClick={() => {
                promptConfig.onConfirm(promptValue);
                setPromptConfig(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
