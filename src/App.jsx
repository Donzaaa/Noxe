import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MdAdd, MdPushPin, MdSettings, MdSearch, MdDelete, MdRestore, MdDeleteForever, MdClose, MdChat, MdStickyNote2, MdRemove, MdCropSquare, MdTerminal, MdRefresh } from 'react-icons/md';
import Note from './components/Note';
import Chat from './components/Chat';
import { translations } from './i18n';
import './index.css';

const NOTE_COLORS = [
  { id: 'yellow', bg: 'linear-gradient(135deg, rgba(253, 230, 138, 0.9), rgba(252, 211, 77, 0.9))', text: 'dark' },
  { id: 'peach', bg: 'linear-gradient(135deg, rgba(254, 215, 170, 0.9), rgba(253, 186, 116, 0.9))', text: 'dark' },
  { id: 'orange', bg: 'linear-gradient(135deg, rgba(253, 186, 116, 0.9), rgba(251, 146, 60, 0.9))', text: 'dark' },
  { id: 'red', bg: 'linear-gradient(135deg, rgba(254, 202, 202, 0.9), rgba(252, 165, 165, 0.9))', text: 'dark' },
  { id: 'pink', bg: 'linear-gradient(135deg, rgba(251, 207, 232, 0.9), rgba(244, 114, 182, 0.9))', text: 'dark' },
  { id: 'purple', bg: 'linear-gradient(135deg, rgba(233, 213, 255, 0.9), rgba(216, 180, 254, 0.9))', text: 'dark' },
  { id: 'indigo', bg: 'linear-gradient(135deg, rgba(199, 210, 254, 0.9), rgba(165, 180, 252, 0.9))', text: 'dark' },
  { id: 'blue', bg: 'linear-gradient(135deg, rgba(191, 219, 254, 0.9), rgba(147, 197, 253, 0.9))', text: 'dark' },
  { id: 'cyan', bg: 'linear-gradient(135deg, rgba(165, 243, 252, 0.9), rgba(103, 232, 249, 0.9))', text: 'dark' },
  { id: 'green', bg: 'linear-gradient(135deg, rgba(167, 243, 208, 0.9), rgba(110, 231, 183, 0.9))', text: 'dark' },
  { id: 'lime', bg: 'linear-gradient(135deg, rgba(217, 249, 157, 0.9), rgba(190, 242, 100, 0.9))', text: 'dark' },
  { id: 'silver', bg: 'linear-gradient(135deg, rgba(226, 232, 240, 0.9), rgba(203, 213, 225, 0.9))', text: 'dark' },
  { id: 'dark', bg: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))', text: 'light' },
];

function App() {
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState('theme-glass-light');
  const [customBg, setCustomBg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [torLogs, setTorLogs] = useState([]);
  const [torCircuits, setTorCircuits] = useState([]);
  const logsEndRef = useRef(null);
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [customColors, setCustomColors] = useState({
    bg: '#1a1a1a',
    panel: 'rgba(30, 30, 30, 0.85)',
    text: '#ffffff',
    accent: '#3b82f6'
  });

  const t = translations.en;

  useEffect(() => {
    const loadData = async () => {
      if (window.electron && window.electron.loadNotes) {
        const savedNotes = await window.electron.loadNotes();
        if (savedNotes && savedNotes.length > 0) {
          setNotes(savedNotes);
        }
        const settings = await window.electron.loadSettings();
        if (settings) {
          if (settings.theme) setTheme(settings.theme);
          if (settings.customBg) setCustomBg(settings.customBg);
          if (settings.language) setLanguage(settings.language);
          if (settings.customColors) setCustomColors(settings.customColors);
        }
      }
      setLoaded(true);

      if (window.electron && window.electron.torOnLog) {
        window.electron.torOnLog((log) => {
          setTorLogs(prev => [...prev.slice(-199), log]); // Keep max 200 logs
        });
      }
    };
    loadData();
  }, []);

  const fetchCircuits = async () => {
    if (window.electron && window.electron.torGetCircuit) {
      const circuits = await window.electron.torGetCircuit();
      setTorCircuits(circuits || []);
    }
  };

  useEffect(() => {
    if (showNetwork && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [torLogs, showNetwork]);

  useEffect(() => {
    if (loaded && window.electron && window.electron.saveNotes) {
      const timer = setTimeout(() => {
        window.electron.saveNotes(notes);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [notes, loaded]);

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    if (window.electron) window.electron.saveSettings({ theme: newTheme, customBg, language, customColors });
  };

  const changeLanguage = (newLang) => {
    setLanguage(newLang);
    if (window.electron) window.electron.saveSettings({ theme, customBg, language: newLang, customColors });
  };

  const handleCustomColorChange = (key, value) => {
    const newColors = { ...customColors, [key]: value };
    setCustomColors(newColors);
    changeTheme('theme-user-custom');
    if (window.electron) window.electron.saveSettings({ theme: 'theme-user-custom', customBg, language, customColors: newColors });
  };

  const handleSelectImage = async () => {
    if (window.electron) {
      const base64 = await window.electron.selectImage();
      if (base64) {
        setCustomBg(base64);
        setTheme('theme-custom');
        window.electron.saveSettings({ theme: 'theme-custom', customBg: base64, language, customColors });
      }
    }
  };

  const addNote = () => {
    const newNote = {
      id: uuidv4(),
      text: '',
      x: Math.floor(Math.random() * 200) + 50,
      y: Math.floor(Math.random() * 200) + 50,
      width: 250,
      height: 250,
      color: NOTE_COLORS[0],
      isMinimized: false,
      isEditing: true,
      isDeleted: false,
      alarmTime: null
    };
    setNotes([...notes, newNote]);
  };

  const updateNote = (id, updates) => {
    setNotes(notes.map(note => note.id === id ? { ...note, ...updates } : note));
  };

  const bringToFront = (id) => {
    const newZ = maxZIndex + 1;
    setMaxZIndex(newZ);
    updateNote(id, { zIndex: newZ });
  };

  const moveToTrash = (id) => {
    updateNote(id, { isDeleted: true });
  };
  
  const restoreNote = (id) => {
    updateNote(id, { isDeleted: false });
  };

  const hardDeleteNote = (id) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  const emptyTrash = () => {
    if (window.confirm(t.emptyTrashConfirm)) {
      setNotes(notes.filter(note => !note.isDeleted));
    }
  };

  const handleWindowMinimize = () => {
    if (window.electron && window.electron.windowMinimize) window.electron.windowMinimize();
  };

  const handleWindowMaximize = () => {
    if (window.electron && window.electron.windowMaximize) window.electron.windowMaximize();
  };

  const handleWindowClose = () => {
    if (window.electron && window.electron.windowClose) window.electron.windowClose();
  };

  const activeNotes = notes.filter(n => !n.isDeleted && n.text.toLowerCase().includes(searchQuery.toLowerCase()));
  const deletedNotes = notes.filter(n => n.isDeleted);

  const getDynamicStyles = () => {
    let styles = {};
    if (theme === 'theme-custom' && customBg) {
      styles = { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    } else if (theme === 'theme-user-custom') {
      styles = {
        '--custom-bg': customColors.bg,
        '--custom-panel': customColors.panel,
        '--custom-text': customColors.text,
        '--custom-accent': customColors.accent,
      };
    }
    return styles;
  };

  return (
    <div 
      className={`app-container ${theme}`}
      style={getDynamicStyles()}
      onClick={() => {
        if (showSettings) setShowSettings(false);
        if (showTrash) setShowTrash(false);
        if (showNetwork) setShowNetwork(false);
      }}
    >
      <div className="title-bar">
        <span className="title-text">Noxe</span>
        
        <div className="title-bar-center">
          {showNotes && (
            <div className="search-bar">
              <MdSearch className="search-icon" />
              <input 
                type="text" 
                placeholder={t.searchPlaceholder} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="title-bar-actions" style={{ marginRight: '16px' }}>
          <button className="title-action-btn" onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }} title="Note" style={{ color: showNotes ? '#ffcc00' : 'var(--text-secondary)' }}>
            <MdStickyNote2 />
          </button>
          <button className="title-action-btn" onClick={(e) => { e.stopPropagation(); setShowNetwork(!showNetwork); setShowTrash(false); setShowSettings(false); fetchCircuits(); }} title="Tor Network & Logs" style={{ color: showNetwork ? '#4ade80' : 'var(--text-secondary)' }}>
            <MdTerminal />
          </button>
          <button className="title-action-btn" onClick={(e) => { e.stopPropagation(); setShowTrash(!showTrash); setShowSettings(false); setShowNetwork(false); }} title={t.trash} style={{ color: showTrash ? '#ff5555' : 'var(--text-secondary)' }}>
            <MdDelete />
          </button>
          <button className="title-action-btn" onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowTrash(false); setShowNetwork(false); }} title={t.settings} style={{ color: showSettings ? '#fff' : 'var(--text-secondary)' }}>
            <MdSettings />
          </button>
        </div>
        
        <div className="window-controls">
          <button className="window-btn" onClick={handleWindowMinimize}><MdRemove /></button>
          <button className="window-btn" onClick={handleWindowMaximize}><MdCropSquare style={{ fontSize: '14px' }} /></button>
          <button className="window-btn close" onClick={handleWindowClose}><MdClose /></button>
        </div>
      </div>

      {showNotes && (
        <>
          <div className="board">
            {activeNotes.map(note => (
              <Note
                key={note.id}
                note={note}
                updateNote={updateNote}
                deleteNote={moveToTrash}
                bringToFront={bringToFront}
                colors={NOTE_COLORS}
                t={t}
              />
            ))}
          </div>

          <button className="add-btn" onClick={addNote} title={t.addNote}>
            <MdAdd />
          </button>
        </>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
          <h3>{t.backgroundsAndThemes}</h3>
          <div className="theme-options">
            <button onClick={() => changeTheme('theme-glass-light')} className={theme === 'theme-glass-light' ? 'active' : ''}>{t.themeGlass}</button>
            <button onClick={() => changeTheme('theme-modern-dark')} className={theme === 'theme-modern-dark' ? 'active' : ''}>{t.themeMinimal}</button>
            <button onClick={() => changeTheme('theme-neon')} className={theme === 'theme-neon' ? 'active' : ''}>{t.themeDotted}</button>
            <button onClick={handleSelectImage} className={theme === 'theme-custom' ? 'active' : ''}>{t.chooseImage}</button>
          </div>
          
          <h3 style={{ marginTop: '20px', marginBottom: '12px' }}>{t.customTheme}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { key: 'bg', label: t.customBgColor },
              { key: 'panel', label: t.customPanelColor },
              { key: 'text', label: t.customTextColor },
              { key: 'accent', label: t.customAccentColor }
            ].map((item) => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                <input 
                  type="color" 
                  value={customColors[item.key].startsWith('rgba') ? '#000000' : customColors[item.key]} 
                  onChange={(e) => {
                    handleCustomColorChange(item.key, e.target.value);
                  }} 
                  style={{ width: '20px', height: '20px', padding: '0', border: 'none', borderRadius: '3px', background: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: '6px' }}
                />
              </label>
            ))}
          </div>

          <h3 style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>Support the Project</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
            Noxe is free and Open Source. If you like it, consider buying me a coffee to support the development!
          </p>
          <button 
            onClick={() => window.electron && window.electron.openExternal && window.electron.openExternal('https://buymeacoffee.com/donzaa')}
            style={{
              background: '#FFDD00',
              color: '#000000',
              fontWeight: 'bold',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '15px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Buy me a coffee
          </button>
        </div>
      )}

      {/* Trash Panel */}
      {showTrash && (
        <div className="trash-panel" onClick={(e) => e.stopPropagation()}>
          <div className="trash-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>{t.trash} <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>({deletedNotes.length})</span></h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {deletedNotes.length > 0 && (
                <button onClick={emptyTrash} style={{ background: 'none', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '4px 8px' }}>
                  {t.emptyAll}
                </button>
              )}
              <button onClick={() => setShowTrash(false)} className="close-btn" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', padding: 0 }}><MdClose /></button>
            </div>
          </div>
          <div className="trash-list">
            {deletedNotes.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '20px' }}>{t.trashEmpty}</p>
            ) : null}
            {deletedNotes.map(note => (
              <div key={note.id} className="trash-item">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', paddingRight: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.text ? note.text.substring(0, 40) : t.emptyNote}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(note.deletedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <div className="trash-actions">
                  <button onClick={() => restoreNote(note.id)} title={t.restore} className="trash-action-btn"><MdRestore size={18} /></button>
                  <button onClick={() => hardDeleteNote(note.id)} title={t.deletePermanently} className="trash-action-btn danger"><MdDeleteForever size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Network / Terminal Panel */}
      {showNetwork && (
        <div className="network-panel" onClick={(e) => e.stopPropagation()}>
          <div className="network-header">
            <h3>Tor Network & Logs</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={fetchCircuits} className="close-btn" title="Refresh Circuit" style={{ color: '#4ade80' }}><MdRefresh /></button>
              <button onClick={() => setShowNetwork(false)} className="close-btn"><MdClose /></button>
            </div>
          </div>
          <div className="network-content">
            <div className="circuits-section">
              <h4>Active Circuits ({torCircuits.length})</h4>
              {torCircuits.length === 0 && <p style={{ fontSize: '12px', color: '#888' }}>No visible circuits or loading...</p>}
              {torCircuits.map(c => (
                <div key={c.id} className="circuit-item">
                  <span className="circuit-status">{c.status}</span>
                  <div className="circuit-nodes">
                    {c.nodes.map((n, i) => (
                      <span key={i} className="circuit-node">
                        {n}
                        {i < c.nodes.length - 1 && <span className="circuit-arrow"> ➔ </span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="logs-section">
              <h4>Tor Daemon Logs</h4>
              <div className="logs-terminal">
                {torLogs.map((log, i) => (
                  <div key={i} className={`log-line ${log.includes('Err') ? 'log-err' : ''}`}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel - always rendered to keep connection alive, hidden when notes are shown */}
      <div style={{ display: showNotes ? 'none' : 'block' }}>
        <Chat isChatVisible={!showNotes} t={t} />
      </div>
    </div>
  );
}

export default App;
