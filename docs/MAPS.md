# Key-free maps and address autofill

SERVIO uses Leaflet with standard OpenStreetMap tiles. No Google API key or Google billing is needed. `mapTileUrl` in each app environment config selects the tile provider. Keep visible OSM attribution, normal browser caching, and interactive use; do not prefetch/offline-download public tiles.

Pin taps, completed drags and current-location selection trigger a debounced authenticated `GET /api/v1/locations/reverse?lat=...&lng=...`. The API uses a singleton `GEOCODER` Durable Object to enforce an app-wide interval of at least 1.1 seconds between fresh upstream requests and reject overlapping requests. It caches up to 256 lookups for seven days. The client retries busy responses once, then allows manual address entry. Stale lookups and late GPS fixes cannot overwrite newer pin selections.

The default upstream is Nominatim. Set the optional Worker variable `GEOCODING_URL` to a compatible reverse endpoint to change providers without an app update. Requests identify SERVIO. Public Nominatim is intended for moderate interactive use, not high-volume production traffic; use a hosted/self-hosted compatible provider as usage grows. No key or account is required for the current default.

Returned street, barangay and city fields remain editable. Street/house details may be missing from map data; users must supply missing details. A city/province is never used as an invented barangay. Existing saved text is preserved until the pin moves.

Deploy the API with its new `GEOCODER` binding/migration before distributing the rebuilt client; local Wrangler supplies the binding automatically. No deployment is performed by the source change. Verify map tap, drag, GPS, rapid pin changes, missing fields, offline lookup and saving on target devices.

Provider references:
- https://operations.osmfoundation.org/policies/nominatim/
- https://operations.osmfoundation.org/policies/tiles/
- https://nominatim.org/release-docs/latest/api/Reverse/
