import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { preloadServerConfig } from './services/server-runtime-config'

/**
 * Initialize server configuration on app startup
 * This fetches the dynamic API/WebSocket ports from the server
 */
async function initializeServerConfig() {
  try {
    const response = await preloadServerConfig();

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
