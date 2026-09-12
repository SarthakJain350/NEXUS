// NEXUS Tactical GIS — tile-provider configuration (env-driven, never in source).
//
// Default: CARTO Dark Matter — free for non-commercial use, NO API key
// required. If your network/deployment gets key-required or rate-limited
// tile responses from CARTO, switch providers via frontend/.env:
//
//   VITE_MAP_TILES_URL       tile URL template; may contain an {apikey}
//                            placeholder for providers that require a key
//                            (MapTiler, Mapbox, Thunderforest, HERE, ...)
//   VITE_MAP_API_KEY         the key itself (only used when the URL has
//                            {apikey}); leave empty for keyless providers
//   VITE_MAP_TILES_ATTRIBUTION  optional attribution override
//   VITE_MAP_MAX_ZOOM        optional max zoom (default 19)
//
// Keyless alternatives that work with no key at all:
//   CARTO dark:  https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
//   OSM standard: https://tile.openstreetmap.org/{z}/{x}/{y}.png
//
// Security note: VITE_* vars are compiled into the browser bundle at build
// time — use a browser key with domain restrictions from your provider, and
// never commit the real key (.env is gitignored; .env.example carries names
// only).

const env = import.meta.env || {};

const DEFAULT_TILES_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function getTileConfig() {
  const apiKey = (env.VITE_MAP_API_KEY || '').trim();
  let url = env.VITE_MAP_TILES_URL || DEFAULT_TILES_URL;

  if (url.includes('{apikey}')) {
    // The configured provider requires a key. Without one its tiles would
    // fail — fall back to the keyless CARTO default so the map never
    // renders blank (journey/trajectory layers stay functional either way).
    url = apiKey
      ? url.split('{apikey}').join(encodeURIComponent(apiKey))
      : DEFAULT_TILES_URL;
  }

  return {
    url,
    attribution: env.VITE_MAP_TILES_ATTRIBUTION || DEFAULT_ATTRIBUTION,
    maxZoom: Number(env.VITE_MAP_MAX_ZOOM) || 19,
  };
}
