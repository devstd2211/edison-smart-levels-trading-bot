import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

type ServerConfig = {
  api?: {
    port?: number;
    url?: string;
  };
  websocket?: {
    port?: number;
    url?: string;
  };
};

declare global {
  interface Window {
    __SERVER_CONFIG__?: ServerConfig;
  }
}

/**
 * Initialize server configuration on app startup
 * This fetches the dynamic API/WebSocket ports from the server
 */
async function initializeServerConfig() {
  try {
    const hostname = window.location.hostname;
    const response = await fetch(`http://${hostname}:4002/api/config/server`);

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        console.log('[App] Server config loaded:', data.data);
        // Store in window for global access
        window.__SERVER_CONFIG__ = data.data as ServerConfig;
      }
    }
  } catch (error) {
    console.warn('[App] Failed to load server config, using defaults:', error);
  }
}

// Initialize before rendering
initializeServerConfig().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
