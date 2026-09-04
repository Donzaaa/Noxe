const https = require('https');
const fs = require('fs');
const path = require('path');
const tar = require('tar');

// Usiamo un url noto dell'archivio ufficiale di Tor. 
// L'expert bundle contiene solo i file binari senza il browser.
const TOR_VERSION = '13.0.15'; 
const TOR_URL = `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-windows-x86_64-${TOR_VERSION}.tar.gz`;

const destDir = path.join(__dirname, '..', 'tor-bin');
const tarPath = path.join(__dirname, 'tor.tar.gz');

async function downloadTor() {
  console.log(`Downloading Tor Expert Bundle v${TOR_VERSION}...`);
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tarPath);
    https.get(TOR_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('Download completato. Estrazione in corso...');
        
        tar.x({
          file: tarPath,
          cwd: destDir
        }).then(() => {
          console.log('Estrazione completata con successo in', destDir);
          fs.unlinkSync(tarPath); // clean up
          resolve();
        }).catch(err => {
          console.error('Errore durante l\'estrazione:', err);
          reject(err);
        });
      });
    }).on('error', (err) => {
      fs.unlinkSync(tarPath);
      reject(err);
    });
  });
}

downloadTor().catch(console.error);
