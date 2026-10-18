export const environment = {
  production: true,
  demo: false,
  /** Production Worker (Cloudflare workers.dev). Swap for a custom domain when one exists. */
  apiUrl: 'https://servio-api.mcleinonza0531.workers.dev/api/v1',
  useMockApi: false,
  /** Normal interactive map viewing; no tile prefetch or offline downloads. */
  mapTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};
