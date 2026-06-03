export const API_DOCS_PATH = '/api/docs';
export const OPENAPI_DOCUMENT_PATH = `${API_DOCS_PATH}/openapi.json`;
export const RUNTIME_CONFIG_PATH = '/api/config/server';
export const RUNTIME_DISCOVERY_GUIDANCE_HEADING = 'Browser Runtime Discovery';

export const RUNTIME_DISCOVERY_GUIDANCE_LINES = {
  sameOrigin: 'Web clients resolve the API from the current origin first, then fall back to the default runtime port.',
  websocketFallback: 'WebSocket fallbacks should match the active browser protocol when runtime discovery is unavailable.',
  legacyRetry: 'The legacy compatibility config endpoint is retried only if runtime discovery fails.',
} as const;

export const RUNTIME_DISCOVERY_GUIDANCE_PARAGRAPHS = [
  RUNTIME_DISCOVERY_GUIDANCE_LINES.sameOrigin,
  RUNTIME_DISCOVERY_GUIDANCE_LINES.websocketFallback,
  RUNTIME_DISCOVERY_GUIDANCE_LINES.legacyRetry,
];

export function createRuntimeDiscoveryGuidanceDescription(
  paragraphs: readonly string[] = RUNTIME_DISCOVERY_GUIDANCE_PARAGRAPHS,
): string {
  return paragraphs.join(' ');
}

export function createRuntimeApiServerDescription(): string {
  return `Default runtime API server. ${RUNTIME_DISCOVERY_GUIDANCE_LINES.sameOrigin}`;
}

export function createDocsRuntimeDiscoverySectionHtml(
  paragraphs: readonly string[] = RUNTIME_DISCOVERY_GUIDANCE_PARAGRAPHS,
): string {
  return `
            <div class="endpoint" style="margin-top: 20px;">
              <h3>${RUNTIME_DISCOVERY_GUIDANCE_HEADING}</h3>
              ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n              ')}
            </div>`;
}

export const RUNTIME_DISCOVERY_GUIDANCE_DESCRIPTION = createRuntimeDiscoveryGuidanceDescription();
export const DEFAULT_RUNTIME_API_SERVER_DESCRIPTION = createRuntimeApiServerDescription();
