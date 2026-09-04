# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Come funziona la Chat P2P (Stile Briar)

La nuova architettura di Noxe utilizza un sistema **100% Peer-to-Peer (Decentralizzato)**. Non ci sono server centrali, database cloud o server di segnalazione. Tutto avviene direttamente dal tuo computer a quello dei tuoi contatti.

### Tecnologie utilizzate:
- **Hyperswarm**: Crea una rete DHT (Distributed Hash Table) globale. Permette a due computer di "trovarsi" su Internet e bucare i firewall (NAT Holepunching) per instaurare una connessione diretta.
- **Multicast-DNS (mDNS)**: Se internet non è disponibile ma due computer sono connessi alla stessa rete Wi-Fi (o Hotspot), si scopriranno automaticamente in locale.
- **Crittografia E2EE**: Tutti i messaggi sono cifrati end-to-end. Il tuo "ID" è in realtà la tua **Chiave Pubblica** crittografica.

### Come testare l'app

Poiché il tuo "ID" è legato al tuo computer (viene generato un seme univoco salvato nel sistema), non puoi chattare con te stesso aprendo due finestre sulla stessa macchina. Ecco come testarla correttamente:

#### Metodo 1: Due Computer Reali (Consigliato)
1. Esegui il build dell'app eseguendo nel terminale: `npm run build`
2. Copia la cartella del gioco o l'eseguibile (nella cartella `release/`) su un **secondo computer**.
3. Apri l'app su entrambi i PC.
4. Vai nella sezione Chat e vedrai il tuo **ID** (una stringa esadecimale lunga).
5. Su uno dei due PC, clicca su "Aggiungi Contatto" e incolla l'ID dell'altro PC.
6. Entro pochi secondi, i PC si troveranno tramite la rete DHT globale (o la rete Wi-Fi locale) e lo stato passerà a **Online (P2P)**.

#### Metodo 2: Simulazione sullo stesso PC (Sviluppatori)
Se non hai un secondo computer ma vuoi testare il collegamento, devi avviare una seconda istanza di Electron forzandola a usare una cartella dati diversa, così genererà un nuovo ID:
1. Apri un terminale e avvia l'app normalmente: `npm run dev`
2. Apri un **secondo terminale** e lancia Electron in un ambiente isolato:
   `npx electron . --user-data-dir="C:\temp\noxe-test"`
3. Ora avrai due app con ID completamente diversi in esecuzione sullo stesso PC. Incolla l'ID di uno nell'altro per vederli comunicare!

#   N o x e - R e p o