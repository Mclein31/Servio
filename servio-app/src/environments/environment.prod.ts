export const environment = {
  production: true,
  demo: false,
  /** Production Worker (Cloudflare workers.dev). Swap for a custom domain when one exists. */
  apiUrl: 'https://servio-api.mcleinonza0531.workers.dev/api/v1',
  useMockApi: false,
  /**
   * CARTO basemaps now require an API key (https://carto.com/basemaps). When empty,
   * maps fall back to OpenStreetMap standard tiles styled light (dev/prototype use only —
   * see the OSM tile usage policy before shipping).
   */
  cartoApiKey: '',
};
