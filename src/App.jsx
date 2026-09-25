import React, { useState, useEffect, useRef } from 'react';
import { MdSettings, MdClose, MdRemove, MdCropSquare, MdTerminal, MdRefresh } from 'react-icons/md';
import Chat from './components/Chat';
import { translations } from './i18n';
import './index.css';

function App() {
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState('theme-glass-light');
  const [customBg, setCustomBg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [torLogs, setTorLogs] = useState([]);
  const [torCircuits, setTorCircuits] = useState([]);
  const logsEndRef = useRef(null);
  const [customColors, setCustomColors] = useState({
    bg: '#1a1a1a',
    panel: 'rgba(30, 30, 30, 0.85)',
    text: '#ffffff',
    accent: '#3b82f6'
  });

  const t = translations.en;

  useEffect(() => {
    const loadData = async () => {
      if (window.electron && window.electron.loadSettings) {
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



  const handleWindowMinimize = () => {
    if (window.electron && window.electron.windowMinimize) window.electron.windowMinimize();
  };

  const handleWindowMaximize = () => {
    if (window.electron && window.electron.windowMaximize) window.electron.windowMaximize();
  };

  const handleWindowClose = () => {
    if (window.electron && window.electron.windowClose) window.electron.windowClose();
  };



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
        if (showNetwork) setShowNetwork(false);
      }}
    >
      <div className="title-bar">
        <span className="title-text">Noxe</span>
        
        <div className="title-bar-center">
        </div>

        <div className="title-bar-actions" style={{ marginRight: '16px' }}>
          <button className="title-action-btn" onClick={(e) => { e.stopPropagation(); setShowNetwork(!showNetwork); setShowSettings(false); fetchCircuits(); }} title="Tor Network & Logs" style={{ color: showNetwork ? '#4ade80' : 'var(--text-secondary)' }}>
            <MdTerminal />
          </button>
          <button className="title-action-btn" onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowNetwork(false); }} title={t.settings} style={{ color: showSettings ? '#fff' : 'var(--text-secondary)' }}>
            <MdSettings />
          </button>
        </div>
        
        <div className="window-controls">
          <button className="window-btn" onClick={handleWindowMinimize}><MdRemove /></button>
          <button className="window-btn" onClick={handleWindowMaximize}><MdCropSquare style={{ fontSize: '14px' }} /></button>
          <button className="window-btn close" onClick={handleWindowClose}><MdClose /></button>
        </div>
      </div>

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

      {/* Chat Panel */}
      <div>
        <Chat isChatVisible={true} t={t} />
      </div>
    </div>
  );
}

export default App;
