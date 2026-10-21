// map tiles
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

export function servioTileLayer(): L.TileLayer {
  return L.tileLayer(environment.mapTileUrl, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
}
