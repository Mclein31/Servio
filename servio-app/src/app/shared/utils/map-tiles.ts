// map tiles
import * as L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { environment } from '../../../environments/environment';

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

let webgl: boolean | undefined;
function supportsWebGL(): boolean {
  if (webgl !== undefined) return webgl;
  try {
    const canvas = document.createElement('canvas');
    webgl = !!canvas.getContext('webgl2');
  } catch {
    webgl = false;
  }
  return webgl;
}

// Vector basemap (OpenFreeMap, key-free, OpenStreetMap data) drawn by MapLibre
// inside Leaflet, so roads and labels stay sharp at any pixel density. Leaflet
// still owns routes and markers. Falls back to raster OSM tiles without WebGL2.
export function servioTileLayer(): L.Layer {
  if (environment.mapStyleUrl && supportsWebGL()) {
    // The layer copies the style's source credits (OpenFreeMap, OpenMapTiles,
    // OpenStreetMap) into Leaflet's attribution control once the style loads.
    return maplibreGL({ style: environment.mapStyleUrl, interactive: false });
  }
  return L.tileLayer(environment.mapTileUrl, { maxZoom: 19, attribution: OSM_ATTRIBUTION });
}
