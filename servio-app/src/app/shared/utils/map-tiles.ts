import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const OSM_STANDARD = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Brand basemap: CARTO Light when a key is configured, otherwise light-styled OSM tiles. */
export function servioTileLayer(): L.TileLayer {
  if (environment.cartoApiKey) {
    return L.tileLayer(`${CARTO_LIGHT}?api_key=${encodeURIComponent(environment.cartoApiKey)}`, {
      subdomains: 'abcd',
      maxZoom: 19,
      maxNativeZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
  }
  return L.tileLayer(OSM_STANDARD, {
    maxZoom: 19,
    className: 'servio-tiles-light',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
}
