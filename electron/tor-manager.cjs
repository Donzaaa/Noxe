const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { app, ipcMain } = require('electron');
const { SocksClient } = require('socks');

let torProcess = null;
let onionAddress = null;
let onionPrivateKey = null;

const peers = new Map(); // onionAddress -> socket (or just save contacts)
const inboundSockets = new Map(); // peerOnion -> net.Socket
let mainWindow = null;
let currentTorDataDir = null;

// Settings & Security state
let allowIncomingRequests = false;
let blockedContacts = new Set();
let acceptedContacts = new Set(); 
const rateLimits = new Map(); // peerOnion -> timestamp
const pendingConnections = new Map(); // peerOnion -> Promise

let SOCKS_PORT = 0;
let CONTROL_PORT = 0;
let HIDDEN_SERVICE_LOCAL_PORT = 0;

function getFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function initTor(window) {
  mainWindow = window;
  
  SOCKS_PORT = await getFreePort();
  CONTROL_PORT = await getFreePort();
  HIDDEN_SERVICE_LOCAL_PORT = await getFreePort();
  
  const userDataPath = app.getPath('userData');
  const torDataDir = path.join(userDataPath, 'tor-data');
  currentTorDataDir = torDataDir;
  const keyPath = path.join(userDataPath, 'onion-key.json');
  
  if (!fs.existsSync(torDataDir)) fs.mkdirSync(torDataDir, { recursive: true });

  // 1. Setup torrc
  const torrcPath = path.join(torDataDir, 'torrc');
  const torrcContent = `
DataDirectory ${torDataDir}
SocksPort ${SOCKS_PORT}
ControlPort ${CONTROL_PORT}
CookieAuthentication 1
Log notice stdout
`;
  fs.writeFileSync(torrcPath, torrcContent);

  // 2. Start Tor Process
  const torDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  const torBin = path.join(torDir, 'tor-bin', 'tor', 'tor.exe');
  
  if (!fs.existsSync(torBin)) {
    console.error("Tor binary non trovato in:", torBin);
    return;
  }

  console.log('Avvio di Tor in corso...');
  torProcess = spawn(torBin, ['-f', torrcPath]);

  torProcess.stdout.on('data', (data) => {
    const log = data.toString();
    console.log(`[Tor] ${log.trim()}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tor-log', `[Tor] ${log.trim()}`);
    }
    if (log.includes('Bootstrapped 100%')) {
      console.log('Tor connesso al 100%! Sto richiedendo il servizio nascosto...');
      setupControlPort(torDataDir, keyPath);
    }
  });

  torProcess.stderr.on('data', (data) => {
    const log = data.toString();
    console.error(`Tor Err: ${log}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tor-log', `[Tor Err] ${log.trim()}`);
    }
  });

  // 3. Start Inbound TCP Server (This receives messages from the Onion network)
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    
    // In un protocollo reale ci sarebbe un handshake per capire chi è il mittente,
    // dato che dalla socket locale vediamo solo l'IP di Tor (127.0.0.1).
    // Per semplicità, qui assumiamo che il mittente invii "FROM: <suo_onion>\n<messaggio>".
    
    let buffer = '';
    socket.on('data', (chunk) => {
      // 1. Payload size limit for unknown connections (anti-DDoS / buffer overflow)
      // Since we don't know who they are until we parse the payload, we restrict the buffer size.
      if (buffer.length > 5000000) { // 5MB limit, mostly for known file transfers
        socket.destroy();
        return;
      }
      
      buffer += chunk;
      while (buffer.includes('\n\n')) { 
        const parts = buffer.split('\n\n');
        const msgBlock = parts[0];
        buffer = parts.slice(1).join('\n\n');
        
        try {
          // Prevent large payloads from unknown senders
          if (msgBlock.length > 10240 && !Array.from(acceptedContacts).some(c => msgBlock.includes(`"from":"${c}"`))) {
             console.log(`[Tor Anti-Spam] Dropped massive payload from unknown sender.`);
             socket.destroy();
             return;
          }

          const payload = JSON.parse(msgBlock);
          const peerOnion = payload.from;
          const type = payload.type || 'MESSAGE'; 
          const message = payload.message || { text: payload.text }; 

          // 2. Blocklist Check
          if (blockedContacts.has(peerOnion)) {
            console.log(`[Tor Anti-Spam] Dropped connection from blocked peer: ${peerOnion}`);
            socket.destroy();
            return;
          }

          // 3. Known Contact Check & Rate Limiting
          const isKnown = acceptedContacts.has(peerOnion);
          
          if (!isKnown) {
             if (!allowIncomingRequests) {
                console.log(`[Tor Anti-Spam] Dropped request from ${peerOnion}. Incoming requests disabled.`);
                return; // just ignore, don't destroy socket so we don't break other pending messages in the same buffer
             }

             // If they are unknown, they can ONLY send CONTACT_REQUEST
             if (type !== 'CONTACT_REQUEST') {
                 console.log(`[Tor Anti-Spam] Ignored non-handshake message from unknown peer ${peerOnion} (Type: ${type})`);
                 return; // Just ignore, but do NOT trigger rate limit
             }

             // Rate limiting (1 request per 2 minutes per onion)
             const lastReq = rateLimits.get(peerOnion) || 0;
             const now = Date.now();
             if (now - lastReq < 120000) {
                 console.log(`[Tor Anti-Spam] Rate limited request from ${peerOnion}`);
                 return;
             }
             rateLimits.set(peerOnion, now);
          }
          
          console.log(`Ricevuto da ${peerOnion} (Type: ${type})`);
          
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (type === 'CONTACT_REQUEST') {
               mainWindow.webContents.send('tor-on-contact-request', { peerId: peerOnion, profileName: message.profileName });
            } else if (type === 'CONTACT_ACCEPTED') {
               mainWindow.webContents.send('tor-on-contact-accepted', peerOnion);
            } else {
               mainWindow.webContents.send('tor-on-message', { peerId: peerOnion, message });
            }
          }
        } catch (e) {
          console.error("Errore parsing messaggio:", e);
        }
      }
    });
    
    socket.on('error', (err) => console.error("Inbound socket error:", err.message));
  });
  
  server.listen(HIDDEN_SERVICE_LOCAL_PORT, '127.0.0.1', () => {
    console.log(`Server Inbound in ascolto su 127.0.0.1:${HIDDEN_SERVICE_LOCAL_PORT}`);
  });

  setupIPC();
}

function setupControlPort(torDataDir, keyPath) {
  // Legge il cookie di autenticazione generato da Tor
  const cookiePath = path.join(torDataDir, 'control_auth_cookie');
  
  setTimeout(() => {
    if (!fs.existsSync(cookiePath)) {
      console.error('Cookie Tor non trovato!');
      return;
    }

    let authenticated = false;
    const cookieHex = fs.readFileSync(cookiePath).toString('hex');
    const client = net.createConnection({ port: CONTROL_PORT, host: '127.0.0.1' }, () => {
      // 1. Autenticazione
      client.write(`AUTHENTICATE ${cookieHex}\r\n`);
    });

    client.on('data', (data) => {
      const response = data.toString();
      
      if (response.startsWith('250 OK') && !authenticated) {
        authenticated = true;
        // Autenticato! Creiamo o carichiamo il Servizio Nascosto v3
        let cmd = `ADD_ONION NEW:BEST Port=80,127.0.0.1:${HIDDEN_SERVICE_LOCAL_PORT}\r\n`;
        
        if (fs.existsSync(keyPath)) {
          const savedKey = JSON.parse(fs.readFileSync(keyPath));
          cmd = `ADD_ONION ${savedKey.privateKey} Port=80,127.0.0.1:${HIDDEN_SERVICE_LOCAL_PORT}\r\n`;
        }
        
        client.write(cmd);
      }
      
      if (response.includes('250-ServiceID=')) {
        const lines = response.split('\r\n');
        lines.forEach(l => {
          if (l.startsWith('250-ServiceID=')) onionAddress = l.substring(14) + '.onion';
          if (l.startsWith('250-PrivateKey=')) onionPrivateKey = l.substring(15);
        });
        
        if (onionPrivateKey && !fs.existsSync(keyPath)) {
          fs.writeFileSync(keyPath, JSON.stringify({ privateKey: onionPrivateKey }));
        }
        
        console.log('ID Tor Onion generato:', onionAddress);
      }
    });

    client.on('error', (err) => console.error('Errore Tor Control Port', err));
  }, 1000); // Piccola attesa per dar tempo a Tor di scrivere il file
}

function setupIPC() {
  ipcMain.handle('tor-get-id', () => {
    return onionAddress; // Ritornerà l'indirizzo una volta pronto
  });

  ipcMain.handle('tor-get-circuit', async () => {
    if (!currentTorDataDir) return [];
    return new Promise((resolve) => {
      const cookiePath = path.join(currentTorDataDir, 'control_auth_cookie');
      if (!fs.existsSync(cookiePath)) return resolve([]);
      
      const cookieHex = fs.readFileSync(cookiePath).toString('hex');
      const client = net.createConnection({ port: CONTROL_PORT, host: '127.0.0.1' }, () => {
        client.write(`AUTHENTICATE ${cookieHex}\r\n`);
      });

      let authenticated = false;
      let dataBuffer = '';

      client.on('data', (data) => {
        const response = data.toString();
        dataBuffer += response;
        
        if (!authenticated && dataBuffer.includes('250 OK')) {
          authenticated = true;
          dataBuffer = ''; 
          client.write('GETINFO circuit-status\r\n');
        } else if (authenticated && dataBuffer.includes('250 OK')) {
          const lines = dataBuffer.split('\\n').map(l => l.trim());
          const circuits = [];
          lines.forEach(line => {
            if (line.match(/^\\d+ (BUILT|EXTENDED|LAUNCHED)/)) {
               const parts = line.split(' ');
               const status = parts[1];
               const pathStr = parts[2]; 
               if (pathStr && !pathStr.startsWith('PURPOSE=')) {
                   const nodes = pathStr.split(',').map(n => {
                     if (n.includes('=')) return n.split('=')[1];
                     if (n.includes('~')) return n.split('~')[1];
                     return n.substring(0, 8);
                   });
                   circuits.push({ id: parts[0], status, nodes });
               }
            }
          });
          client.destroy();
          resolve(circuits);
        }
      });

      client.on('error', () => {
        if (!client.destroyed) client.destroy();
        resolve([]);
      });
      
      setTimeout(() => {
         if (!client.destroyed) client.destroy();
         resolve([]);
      }, 5000);
    });
  });
  
  // Helper function to safely get or create a socket
  async function getOrCreateTorSocket(peerOnion) {
    let socket = peers.get(peerOnion);
    
    if (socket && !socket.destroyed && socket.readyState === 'open') {
      return socket;
    }

    if (pendingConnections.has(peerOnion)) {
      return pendingConnections.get(peerOnion);
    }

    const connectPromise = (async () => {
      try {
        console.log(`[Tor] Connessione a ${peerOnion}...`);
      const options = {
        proxy: { host: '127.0.0.1', port: SOCKS_PORT, type: 5 },
        command: 'connect',
        destination: { host: peerOnion, port: 80 } 
      };
      
      const { socket: newSocket } = await SocksClient.createConnection(options);
      
      console.log(`Connesso a ${peerOnion} tramite Tor!`);
      peers.set(peerOnion, newSocket);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tor-on-peer-connected', peerOnion);
      }
      
      newSocket.on('error', () => {
        peers.delete(peerOnion);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('tor-on-peer-disconnected', peerOnion);
      });
      
      newSocket.on('close', () => {
        peers.delete(peerOnion);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('tor-on-peer-disconnected', peerOnion);
      });
      
      return newSocket;
    } catch (e) {
      console.error(`Errore connessione a ${peerOnion}:`, e.message);
      return null;
    } finally {
      pendingConnections.delete(peerOnion);
    }
    })();

    pendingConnections.set(peerOnion, connectPromise);
    return connectPromise;
  }

  // Qui apriamo un socket duraturo.
  ipcMain.handle('tor-connect', async (event, peerOnion) => {
    const socket = await getOrCreateTorSocket(peerOnion);
    return !!socket;
  });

  ipcMain.handle('tor-send-handshake', async (event, peerOnion, type, profileName) => {
    const socket = await getOrCreateTorSocket(peerOnion);
    if (!socket) return false;
    
    const payload = JSON.stringify({ 
        from: onionAddress, 
        type: type, // 'CONTACT_REQUEST' or 'CONTACT_ACCEPTED'
        message: { profileName } 
    }) + '\n\n';
    
    try {
      socket.write(payload);
      return true;
    } catch(err) {
      return false;
    }
  });

  ipcMain.handle('tor-send-message', async (event, peerOnion, messageObj) => {
    const socket = await getOrCreateTorSocket(peerOnion);
    if (!socket) return false;
    
    const payload = JSON.stringify({ from: onionAddress, type: 'MESSAGE', message: messageObj }) + '\n\n';
    try {
      socket.write(payload);
    } catch(err) {
      console.error('Errore durante la scrittura sul socket Tor:', err);
      peers.delete(peerOnion);
      socket.destroy();
      return false;
    }
    return true;
  });
}

function updateTorSecurityState(allowRequests, blockedSet, acceptedSet) {
    allowIncomingRequests = allowRequests;
    blockedContacts = new Set(blockedSet || []);
    acceptedContacts = new Set(acceptedSet || []);
}

// Assicurarsi di chiudere Tor all'uscita
app.on('before-quit', () => {
  if (torProcess) torProcess.kill();
});

module.exports = { initTor, updateTorSecurityState };
