# Noxe

Noxe is a fully decentralized, peer-to-peer (P2P) chat application built with Electron, React, and Vite. It routes all communications entirely through the Tor network using v3 Onion Services, ensuring maximum privacy, anonymity, and security without relying on any central servers.

## Features

- **100% Peer-to-Peer:** No central servers, no cloud databases, and no signaling servers. Your data stays on your device.
- **Tor Network Integration:** Noxe bundles a Tor client to automatically create a v3 Hidden Service. This allows seamless NAT traversal (holepunching) and keeps your IP address hidden from peers.
- **Cryptographic Identities:** Your unique Chat ID is an Onion Address. Your identity is cryptographically tied to the private key stored locally on your machine.
- **Secure & Private:** Connections between peers are encrypted and anonymized by Tor. Noxe includes built-in anti-spam measures, rate limiting, and the ability to block contacts or disable unknown incoming requests.
- **Modern UI:** Features a sleek, customizable interface with a glassmorphism theme, system tray support, and a built-in notes manager.

## How It Works

When you launch Noxe, it starts a local Tor process and generates a v3 Onion Service. The `.onion` address generated becomes your unique ID. When you add a contact and send a message, Noxe connects directly to their Onion Service. Since Tor handles the routing, neither party knows the other's real IP address, and there are no firewalls or router ports to configure.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Donzaaa/Noxe.git
   cd Noxe
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the application in development mode with Hot Module Replacement (HMR):

```bash
npm run dev
```

*Note: For testing P2P capabilities on a single machine, you can launch a second isolated instance by running:*
```bash
npm run test-peer
```
*(This uses a separate user data directory so a new, independent Tor identity is generated).*

### Building for Production

To build the executable for your platform (currently configured for Windows NSIS):

```bash
npm run build
```

The compiled application will be available in the `release/` directory.

## Technical Stack

- **Frontend:** React 19, Vite, Vanilla CSS
- **Desktop Environment:** Electron 44, Node.js
- **Networking:** Tor (Bundled binary), `socks` proxy client, raw TCP sockets for the P2P protocol

## Security Considerations

- **Local Data:** Chat history, settings, and your Tor private key (`onion-key.json`) are stored in your local OS user directory. Ensure your local machine account is secure.
- **Anti-Spam:** Noxe implements strict payload size limits and drops unsolicited connections from unknown senders to prevent Denial of Service (DoS) attacks over Tor.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests for bug fixes, new features, or UX improvements.
