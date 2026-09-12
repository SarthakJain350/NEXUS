import { describe, it, expect, vi, afterEach } from 'vitest';

// mapConfig captures import.meta.env at module load, so each case re-imports
// the module fresh after stubbing the env (vi.stubEnv mutates import.meta.env,
// which vitest restores via unstubAllEnvs).
const loadConfig = async () => {
  vi.resetModules();
  const mod = await import('../mapConfig');
  return mod.getTileConfig();
};

const DEFAULT_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTileConfig — defaults (no env config)', () => {
  it('uses the keyless CARTO dark tiles by default', async () => {
    // Vitest loads frontend/.env into import.meta.env, so a locally
    // configured provider (e.g. OSM) would leak in — stub the vars empty
    // (falsy) to test the true no-env defaults.
    vi.stubEnv('VITE_MAP_TILES_URL', '');
    vi.stubEnv('VITE_MAP_API_KEY', '');
    vi.stubEnv('VITE_MAP_TILES_ATTRIBUTION', '');
    vi.stubEnv('VITE_MAP_MAX_ZOOM', '');
    const cfg = await loadConfig();
    expect(cfg.url).toBe(DEFAULT_URL);
    expect(cfg.attribution).toContain('CARTO');
    expect(cfg.maxZoom).toBe(19);
  });
});

describe('getTileConfig — keyed provider handling', () => {
  it('falls back to the keyless default when a {apikey} URL is set without a key', async () => {
    vi.stubEnv('VITE_MAP_TILES_URL', 'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key={apikey}');
    vi.stubEnv('VITE_MAP_API_KEY', ''); // deterministic: ignore any local .env key
    const cfg = await loadConfig();
    // No key configured -> keyed provider tiles would all fail; the map must
    // never render blank, so the keyless CARTO default wins.
    expect(cfg.url).toBe(DEFAULT_URL);
  });

  it('substitutes a URL-encoded key into the {apikey} placeholder', async () => {
    vi.stubEnv('VITE_MAP_TILES_URL', 'https://tiles.example.com/{z}/{x}/{y}.png?k={apikey}');
    vi.stubEnv('VITE_MAP_API_KEY', 'ab cd/123');
    const cfg = await loadConfig();
    expect(cfg.url).toBe('https://tiles.example.com/{z}/{x}/{y}.png?k=ab%20cd%2F123');
  });

  it('trims whitespace from the API key before substitution', async () => {
    vi.stubEnv('VITE_MAP_TILES_URL', 'https://tiles.example.com/{z}/{x}/{y}.png?k={apikey}');
    vi.stubEnv('VITE_MAP_API_KEY', '  secret123  ');
    const cfg = await loadConfig();
    expect(cfg.url).toBe('https://tiles.example.com/{z}/{x}/{y}.png?k=secret123');
  });

  it('uses a keyed URL as-is when no placeholder is present', async () => {
    vi.stubEnv('VITE_MAP_TILES_URL', 'https://tiles.example.com/key-in-path/{z}/{x}/{y}.png');
    const cfg = await loadConfig();
    expect(cfg.url).toBe('https://tiles.example.com/key-in-path/{z}/{x}/{y}.png');
  });
});

describe('getTileConfig — attribution and zoom overrides', () => {
  it('honours attribution and maxZoom overrides', async () => {
    vi.stubEnv('VITE_MAP_TILES_ATTRIBUTION', 'Test Attribution');
    vi.stubEnv('VITE_MAP_MAX_ZOOM', '21');
    const cfg = await loadConfig();
    expect(cfg.attribution).toBe('Test Attribution');
    expect(cfg.maxZoom).toBe(21);
  });

  it('keeps maxZoom 19 for non-numeric values', async () => {
    vi.stubEnv('VITE_MAP_MAX_ZOOM', 'not-a-number');
    const cfg = await loadConfig();
    expect(cfg.maxZoom).toBe(19);
  });
});
