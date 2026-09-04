const Hyperswarm = require('hyperswarm');
const b4a = require('b4a');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

let swarm = null;
let nodeKeyPair = null;
const peers = new Map(); // hexPublicKey -> socket
let mainWindow = null;

// The seed is used to generate the same keypair across restarts
// so your identity is stable
function getOrGenerateSeed() {
  const userDataPath = app.getPath('userData');
  const seedPath = path.join(userDataPath, 'p2p-seed.txt');
  
  if (fs.existsSync(seedPath)) {
    return b4a.from(fs.readFileSync(seedPath, 'utf8'), 'hex');
  }
  
  const seed = crypto.randomBytes(32);
  fs.writeFileSync(seedPath, b4a.toString(seed, 'hex'));
  return seed;
}

function initP2P(window) {
  mainWindow = window;
  const seed = getOrGenerateSeed();
  
  // Note: Hyperswarm natively supports ED25519 keypairs. 
  // We can use a simple DHT keypair mechanism or just let hyperswarm manage it.
  swarm = new Hyperswarm({ seed });
  
  nodeKeyPair = swarm.keyPair;
  
  console.log('P2P Node ID:', b4a.toString(nodeKeyPair.publicKey, 'hex'));
  
  swarm.on('connection', (conn, info) => {
    const peerPublicKey = b4a.toString(conn.remotePublicKey, 'hex');
    console.log('Peer connected:', peerPublicKey);
    
    peers.set(peerPublicKey, conn);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('p2p-on-peer-connected', peerPublicKey);
    }
    
    conn.on('data', (data) => {
      try {
        const message = data.toString('utf8');
        console.log(`Received from ${peerPublicKey}:`, message);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('p2p-on-message', { peerId: peerPublicKey, message });
        }
      } catch (err) {
        console.error('Error parsing p2p message', err);
      }
    });
    
    conn.on('close', () => {
      console.log('Peer disconnected:', peerPublicKey);
      peers.delete(peerPublicKey);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('p2p-on-peer-disconnected', peerPublicKey);
      }
    });
    
    conn.on('error', (err) => {
      console.error(`Connection error with ${peerPublicKey}:`, err.message);
    });
  });
  
  // Start discovering on a common topic so users can find each other locally easily,
  // or they can connect directly via public key.
  const appTopic = crypto.createHash('sha256').update('noxe-briar-clone-topic').digest();
  swarm.join(appTopic, { server: true, client: true });
  swarm.flush().then(() => {
    console.log('Swarm flushed, fully joined topic');
  });

  setupIPC();
}

function setupIPC() {
  ipcMain.handle('p2p-get-id', () => {
    return nodeKeyPair ? b4a.toString(nodeKeyPair.publicKey, 'hex') : null;
  });
  
  ipcMain.handle('p2p-connect', async (event, peerIdHex) => {
    if (!swarm) return false;
    try {
      const peerPubKey = b4a.from(peerIdHex, 'hex');
      // In hyperswarm, to explicitly connect to a specific peer by public key, 
      // you typically just rely on them being in the DHT and joining a topic,
      // or you can explicitly dial them if you know their address, but joining 
      // a topic specific to them works best for NAT traversal.
      const directTopic = crypto.createHash('sha256').update(`direct-${peerIdHex}`).digest();
      swarm.join(directTopic, { client: true, server: false });
      return true;
    } catch (e) {
      console.error('Failed to connect to peer:', e);
      return false;
    }
  });

  // When a peer wants to be reachable, they join their own specific topic
  ipcMain.handle('p2p-make-reachable', async () => {
    if (!swarm || !nodeKeyPair) return false;
    const myHex = b4a.toString(nodeKeyPair.publicKey, 'hex');
    const directTopic = crypto.createHash('sha256').update(`direct-${myHex}`).digest();
    swarm.join(directTopic, { client: false, server: true });
    return true;
  });
  
  ipcMain.handle('p2p-send-message', async (event, peerIdHex, message) => {
    const conn = peers.get(peerIdHex);
    if (conn) {
      conn.write(b4a.from(message, 'utf8'));
      return true;
    }
    return false;
  });
  
  ipcMain.handle('p2p-get-peers', () => {
    return Array.from(peers.keys());
  });
}

module.exports = {
  initP2P
};
