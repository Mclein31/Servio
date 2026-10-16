export const environment = {
  production: true,
  demo: false,
  apiUrl: '',
  useMockApi: false,
  /**
   * CARTO basemaps now require an API key (https://carto.com/basemaps). When empty,
   * maps fall back to OpenStreetMap standard tiles styled light (dev/prototype use only —
   * see the OSM tile usage policy before shipping).
   */
  cartoApiKey: '',
};
