import { describe, it, expect } from 'vitest';
import { getLatestWaypoint } from '../journeyFocus';

// Journey points are chronological ASC (backend §6.5). The latest waypoint
// is the LAST valid point — the contract behind the 2026-09-13 map-focus fix.

const wp = (lat, lon, extra = {}) => ({ latitude: lat, longitude: lon, ...extra });

describe('getLatestWaypoint', () => {
  it('returns the LAST waypoint of a chronological journey', () => {
    const journey = [wp(18.52, 73.85), wp(18.61, 73.95), wp(18.82, 73.28)]; // CAM_01 -> CAM_06
    expect(getLatestWaypoint(journey)).toEqual([18.82, 73.28]);
  });

  it('skips trailing points without coordinates (lat/lon nullable per C7)', () => {
    const journey = [wp(18.52, 73.85), wp(18.61, 73.95), wp(null, 73.0), wp(18.82, null)];
    expect(getLatestWaypoint(journey)).toEqual([18.61, 73.95]);
  });

  it('returns null for an empty journey', () => {
    expect(getLatestWaypoint([])).toBeNull();
  });

  it('returns null when no point has coordinates', () => {
    expect(getLatestWaypoint([wp(null, null), wp(undefined, 73.0)])).toBeNull();
  });

  it('defaults to an empty list (no crash on undefined)', () => {
    expect(getLatestWaypoint(undefined)).toBeNull();
    expect(getLatestWaypoint()).toBeNull();
  });

  it('handles a single-waypoint journey', () => {
    expect(getLatestWaypoint([wp(18.98, 73.10)])).toEqual([18.98, 73.10]);
  });

  it('NEVER returns the first waypoint when later valid points exist', () => {
    const journey = [wp(18.52, 73.85), wp(18.82, 73.28)];
    expect(getLatestWaypoint(journey)).not.toEqual([18.52, 73.85]);
  });
});
