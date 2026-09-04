const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  loadNotes: () => ipcRenderer.invoke('load-notes'),
  saveNotes: (notes) => ipcRenderer.invoke('save-notes', notes),
  toggleAlwaysOnTop: (isAlwaysOnTop) => ipcRenderer.invoke('toggle-always-on-top', isAlwaysOnTop),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectImage: () => ipcRenderer.invoke('select-image'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  loadChatData: () => ipcRenderer.invoke('load-chat-data'),
  saveChatData: (data) => ipcRenderer.invoke('save-chat-data', data),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  
  // Tor Methods
  torGetId: () => ipcRenderer.invoke('tor-get-id'),
  torGetCircuit: () => ipcRenderer.invoke('tor-get-circuit'),
  torOnLog: (callback) => ipcRenderer.on('tor-log', (_event, log) => callback(log)),
  torConnect: (peerId) => ipcRenderer.invoke('tor-connect', peerId),
  torSendMessage: (peerId, message) => ipcRenderer.invoke('tor-send-message', peerId, message),
  torOnMessage: (callback) => {
    ipcRenderer.removeAllListeners('tor-on-message');
    ipcRenderer.on('tor-on-message', (_event, data) => callback(data));
  },
  torOnPeerConnected: (callback) => {
    ipcRenderer.removeAllListeners('tor-on-peer-connected');
    ipcRenderer.on('tor-on-peer-connected', (_event, peerId) => callback(peerId));
  },
  torOnPeerDisconnected: (callback) => {
    ipcRenderer.removeAllListeners('tor-on-peer-disconnected');
    ipcRenderer.on('tor-on-peer-disconnected', (_event, peerId) => callback(peerId));
  },
  torSendHandshake: (peerId, type, profileName) => ipcRenderer.invoke('tor-send-handshake', peerId, type, profileName),
  torOnContactRequest: (callback) => {
    ipcRenderer.removeAllListeners('tor-on-contact-request');
    ipcRenderer.on('tor-on-contact-request', (_event, data) => callback(data));
  },
  torOnContactAccepted: (callback) => {
    ipcRenderer.removeAllListeners('tor-on-contact-accepted');
    ipcRenderer.on('tor-on-contact-accepted', (_event, peerId) => callback(peerId));
  }
});
