export const environment = {
  production: false,
  demo: true,
  apiUrl: 'http://localhost:8787/api/v1',
  useMockApi: true,
  /**
   * CARTO basemaps now require an API key (https://carto.com/basemaps). When empty,
   * maps fall back to OpenStreetMap standard tiles styled light (dev/prototype use only —
   * see the OSM tile usage policy before shipping).
   */
  cartoApiKey: '',
};
