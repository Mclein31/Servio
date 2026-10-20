const configuredApiUrl = (globalThis as typeof globalThis & { SERVIO_API_URL?: string }).SERVIO_API_URL?.trim();
const resolvedApiUrl = configuredApiUrl && /^https?:\/\/[^\s]+\/api\/v1\/?$/.test(configuredApiUrl)
  ? configuredApiUrl.replace(/\/+$/, '')
  : 'https://servio-api.mcleinonza0531.workers.dev/api/v1';

export const environment = {
  production: true,
  demo: false,
  apiUrl: resolvedApiUrl,
  useMockApi: false,
  mapTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};
