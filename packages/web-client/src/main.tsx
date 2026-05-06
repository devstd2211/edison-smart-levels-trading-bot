import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { loadServerConfigFromUrl } from './services/server-runtime-config'

/**
 * Initialize server configuration on app startup
 * This fetches the dynamic API/WebSocket ports from the server
 */
async function initializeServerConfig() {
  try {
    const hostname = window.location.hostname;
    const response = await loadServerConfigFromUrl(`http://${hostname}:4002/api`);

    if (response.success && response.data) {
      console.log('[App] Server config loaded:', response.data);
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
