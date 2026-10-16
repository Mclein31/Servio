import { Point } from '../../shared/utils/route-track';

/** OSM verified city-proper center, on Del Rosario Street: https://osm.org/?mlat=17.613&mlon=121.727 */
export const TUGUEGARAO_CENTER: Point = [17.613, 121.727];

/** The route ends on a residential lane in Ugac Norte; no invented street number. */
export const DEMO_ADDRESS = {
  street: 'Ugac Norte',
  barangay: 'Barangay Ugac Norte',
  city: 'Tuguegarao City',
  landmark: 'Residential lane off Bassig Street · meet at the entrance',
};
