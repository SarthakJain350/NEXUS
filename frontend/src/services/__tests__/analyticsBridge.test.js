import { describe, it, expect } from 'vitest';
import { computeAnalytics, generateClientAlerts } from '../analyticsBridge';

// Test factories matching the backend ObservationRead shape (subset the
// bridge consumes).
const cam = (id, extra = {}) => ({
  camera_id: id,
  name: `Node ${id}`,
  location: 'Zone A',
  status: 'active',
  ...extra,
});

const obs = (extra = {}) => ({
  vehicle_type: 'car',
  camera_id: 'CAM_01',
  confidence: 0.8,
  timestamp: '2026-09-13T10:00:00Z',
  ...extra,
});

describe('computeAnalytics', () => {
  it('handles empty inputs with sane defaults', () => {
    const a = computeAnalytics([], [], []);
    expect(a.observation_count).toBe(0);
    expect(a.traffic_level).toBe('LOW');
    expect(a.average_confidence).toBe(0.945); // documented default
    expect(a.unique_vehicles).toBe(0);
  });

  it('breaks vehicle types down, folding unknowns into other', () => {
    const a = computeAnalytics(
      [
        obs({ vehicle_type: 'car' }),
        obs({ vehicle_type: 'TRUCK' }),
        obs({ vehicle_type: 'bullock-cart' }),
        obs({ vehicle_type: undefined }), // missing type must not inherit the factory default
      ],
      [],
      []
    );
    expect(a.vehicles_by_type.car).toBe(1);
    expect(a.vehicles_by_type.truck).toBe(1);
    expect(a.vehicles_by_type.other).toBe(2); // bullock-cart + missing type
  });

  it('normalizes plates so spacing/case variants count as one plate', () => {
    const a = computeAnalytics(
      [
        obs({ plate_number: 'MH12AB1234' }),
        obs({ plate_number: 'MH 12 AB 1234' }),
        obs({ plate_number: 'mh12ab1234' }),
        obs({ plate_number: 'MH01XY9999' }),
      ],
      [],
      []
    );
    expect(a.obs_per_plate.MH12AB1234).toBe(3);
    expect(a.obs_per_plate.MH01XY9999).toBe(1);
  });

  it('applies traffic-level thresholds: LOW < 10, MEDIUM 10-29, HIGH >= 30', () => {
    const level = (n) => computeAnalytics(Array.from({ length: n }, (_, i) => obs({ camera_id: `CAM_${i % 6}` })), [], []).traffic_level;
    expect(level(1)).toBe('LOW');
    expect(level(9)).toBe('LOW');
    expect(level(10)).toBe('MEDIUM');
    expect(level(29)).toBe('MEDIUM');
    expect(level(30)).toBe('HIGH');
  });

  it('counts per camera and ranks cameras by load (descending) with levels', () => {
    const observations = [
      ...Array.from({ length: 12 }, () => obs({ camera_id: 'CAM_01' })),
      ...Array.from({ length: 5 }, () => obs({ camera_id: 'CAM_02' })),
    ];
    const a = computeAnalytics(observations, [cam('CAM_01'), cam('CAM_02')], []);
    expect(a.vehicles_by_camera.CAM_01).toBe(12);
    expect(a.vehicles_by_camera.CAM_02).toBe(5);
    expect(a.camera_load_ranking[0].camera_id).toBe('CAM_01');
    expect(a.camera_load_ranking[0].level).toBe('MEDIUM'); // 12 captures
    expect(a.camera_load_ranking[1].level).toBe('LOW'); // 5 captures
  });

  it('unique_vehicles is max(vehicles registry size, distinct plates)', () => {
    const a = computeAnalytics(
      [obs({ plate_number: 'MH12AB1234' }), obs({ plate_number: 'MH12AB1234' })],
      [],
      [{ id: 1 }, { id: 2 }, { id: 3 }]
    );
    expect(a.unique_vehicles).toBe(3); // registry larger than plate set

    const b = computeAnalytics(
      [obs({ plate_number: 'MH12AB1234' }), obs({ plate_number: 'MH01XY9999' })],
      [],
      [{ id: 1 }]
    );
    expect(b.unique_vehicles).toBe(2); // plate set larger than registry
  });

  it('averages only numeric confidences', () => {
    const a = computeAnalytics(
      [obs({ confidence: 0.5 }), obs({ confidence: 1 }), obs({ confidence: null }), obs({ confidence: 'bad' })],
      [],
      []
    );
    expect(a.average_confidence).toBeCloseTo(0.75);
  });
});

describe('generateClientAlerts', () => {
  it('flags LOW_CONFIDENCE below 0.45 but not at exactly 0.45', () => {
    const alerts = generateClientAlerts(
      [obs({ confidence: 0.44, camera_id: 'CAM_09' }), obs({ confidence: 0.45, camera_id: 'CAM_09' })],
      [],
      []
    );
    const lowConf = alerts.filter(a => a.type === 'LOW_CONFIDENCE');
    expect(lowConf).toHaveLength(1);
    expect(lowConf[0].camera).toBe('CAM_09');
    expect(lowConf[0].severity).toBe('LOW');
  });

  it('raises HIGH CONGESTION at >= 30 captures on one camera', () => {
    const observations = Array.from({ length: 30 }, () => obs({ camera_id: 'CAM_05', confidence: 0.9 }));
    const alerts = generateClientAlerts(observations, [cam('CAM_05')], []);
    const congestion = alerts.find(a => a.type === 'CONGESTION');
    expect(congestion).toBeDefined();
    expect(congestion.severity).toBe('HIGH');
    expect(congestion.message).toContain('30');
  });

  it('raises MEDIUM EXCESSIVE_REPETITION above 20 captures of one plate, not at 20', () => {
    const make = (n) => Array.from({ length: n }, () => obs({ plate_number: 'MH12AB1234', confidence: 0.9 }));
    const at20 = generateClientAlerts(make(20), [], []).filter(a => a.type === 'EXCESSIVE_REPETITION');
    const at21 = generateClientAlerts(make(21), [], []).filter(a => a.type === 'EXCESSIVE_REPETITION');
    expect(at20).toHaveLength(0);
    expect(at21).toHaveLength(1);
    expect(at21[0].severity).toBe('MEDIUM');
    expect(at21[0].vehicle).toBe('MH12AB1234');
  });

  it('emits a baseline LOW_CONFIDENCE alert when no rule fires but observations exist', () => {
    // severity escalates to MEDIUM below 0.7, stays LOW above it
    const low = generateClientAlerts([obs({ confidence: 0.75, plate_number: 'MH01XY9999' })], [], []);
    const medium = generateClientAlerts([obs({ confidence: 0.6, plate_number: 'MH01XY9999' })], [], []);
    expect(low.find(a => a.type === 'LOW_CONFIDENCE').severity).toBe('LOW');
    expect(medium.find(a => a.type === 'LOW_CONFIDENCE').severity).toBe('MEDIUM');
    expect(medium.find(a => a.type === 'LOW_CONFIDENCE').vehicle).toBe('MH01XY9999');
  });

  it('alerts on unregistered and offline cameras regardless of observations', () => {
    const alerts = generateClientAlerts([], [cam('CAM_U', { status: 'unregistered' }), cam('CAM_X', { status: 'inactive' })], []);
    const unregistered = alerts.find(a => a.type === 'UNREGISTERED_NODE');
    const offline = alerts.find(a => a.type === 'NODE_OFFLINE');
    expect(unregistered).toBeDefined();
    expect(unregistered.severity).toBe('MEDIUM');
    expect(offline).toBeDefined();
    expect(offline.severity).toBe('HIGH');
  });
});
