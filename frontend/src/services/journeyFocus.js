// Single source of truth for focusing the map on a vehicle journey.
//
// Journey points are chronological ASC (backend §6.5), so the vehicle's
// most recent known position is the LAST point that carries coordinates
// (lat/lon are nullable per C7). Used by both App.jsx (explicit focus on
// vehicle selection) and TacticalMap (fallback focus) — never index [0],
// which is the OLDEST waypoint and would center the map on the journey
// start. Returns [latitude, longitude] or null when no valid point exists.

export function getLatestWaypoint(journeyPoints = []) {
  for (let i = journeyPoints.length - 1; i >= 0; i--) {
    const p = journeyPoints[i];
    if (p && p.latitude && p.longitude) {
      return [p.latitude, p.longitude];
    }
  }
  return null;
}
