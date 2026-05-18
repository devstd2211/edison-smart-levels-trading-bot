import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { bootstrapServerConfig } from './services/server-runtime-config'

/**
 * Initialize server configuration on app startup
 * This fetches the dynamic API/WebSocket ports from the server
 */
async function initializeServerConfig() {
  const result = await bootstrapServerConfig();

  if (result.source === 'fallback') {
    console.warn('[App] Failed to preload runtime server config, using fallback endpoints:', result.error);
    return;
  }

  console.log('[App] Runtime server config ready:', result.config);
}

// Initialize before rendering
initializeServerConfig().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
