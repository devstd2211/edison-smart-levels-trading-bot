export const RUNTIME_DISCOVERY_GUIDANCE_LINES = {
  sameOrigin: 'Web clients resolve the API from the current origin first, then fall back to the default runtime port.',
  websocketFallback: 'WebSocket fallbacks should match the active browser protocol when runtime discovery is unavailable.',
  legacyRetry: 'The legacy compatibility config endpoint is retried only if runtime discovery fails.',
} as const;

export const RUNTIME_DISCOVERY_GUIDANCE_DESCRIPTION = [
  RUNTIME_DISCOVERY_GUIDANCE_LINES.sameOrigin,
  RUNTIME_DISCOVERY_GUIDANCE_LINES.websocketFallback,
  RUNTIME_DISCOVERY_GUIDANCE_LINES.legacyRetry,
].join(' ');
