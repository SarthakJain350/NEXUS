import React from 'react';
import { Clock, MapPin, Navigation, ArrowDown, Gauge, ShieldCheck, Crosshair } from 'lucide-react';

export default function JourneyTimeline({
  journeyPoints = [],
  selectedVehicle = null,
  onFocusWaypoint
}) {
  if (!selectedVehicle) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
        <Navigation size={32} color="rgba(0, 242, 254, 0.3)" style={{ margin: '0 auto 10px auto' }} />
        <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>No Vehicle Selected</div>
        <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
          Select a vehicle from the registry or click an ANPR observation to trace its route across the camera network.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="plate-badge" style={{ fontSize: '0.9rem' }}>
              <span className="ind-tag">IND</span>
              <span>{selectedVehicle.plate_number_best_guess}</span>
            </div>
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,242,254,0.1)', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 600 }}>
              {selectedVehicle.vehicle_type}
            </span>
          </div>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600 }}>
            {selectedVehicle.global_vehicle_id || 'ID: UNASSIGNED'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
          <span>Trajectory Depth: <b style={{ color: '#fff' }}>{journeyPoints.length} Checkpoints</b></span>
          <span>•</span>
          <span>Sequence: Chronological Ascending</span>
        </div>
      </div>

      {/* Timeline Steps */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingRight: '4px', minHeight: '0' }}>
        {journeyPoints.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            No trajectory observations recorded for this vehicle.
          </div>
        ) : (
          journeyPoints.map((point, index) => {
            const isFirst = index === 0;
            const isLast = index === journeyPoints.length - 1;

            return (
              <div key={point.observation_id || index} style={{ position: 'relative', display: 'flex', gap: '14px' }}>
                {/* Vertical connecting line */}
                {!isLast && (
                  <div style={{
                    position: 'absolute',
                    left: '13px',
                    top: '28px',
                    bottom: '-12px',
                    width: '2px',
                    background: 'linear-gradient(to bottom, var(--accent-cyan), rgba(0, 242, 254, 0.2))'
                  }} />
                )}

                {/* Pin bubble */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: isFirst ? 'var(--accent-emerald)' : (isLast ? 'var(--accent-cyan)' : 'var(--bg-tertiary)'),
                  border: '2px solid #ffffff',
                  color: isFirst || isLast ? '#04101e' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  flexShrink: 0,
                  zIndex: 2,
                  boxShadow: '0 0 10px rgba(0, 242, 254, 0.4)'
                }}>
                  {index + 1}
                </div>

                {/* Point details card */}
                <div
                  style={{
                    flex: 1,
                    marginBottom: '16px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="font-mono" style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                        {point.camera_id}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {point.camera_name || 'Corridor Sensor'}
                      </span>
                    </div>

                    <button
                      onClick={() => onFocusWaypoint && onFocusWaypoint([point.latitude, point.longitude])}
                      className="btn btn-outline"
                      title="Center on map"
                      style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                    >
                      <Crosshair size={11} /> Pin
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} color="var(--accent-cyan)" />
                      <span>{new Date(point.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={12} color="var(--accent-emerald)" />
                      <span>Conf: {(point.confidence * 100).toFixed(1)}%</span>
                    </div>
                    {point.speed_est && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Gauge size={12} color="var(--accent-amber)" />
                        <span>{point.speed_est}</span>
                      </div>
                    )}
                  </div>

                  <div className="font-mono" style={{ fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    GPS: {point.latitude?.toFixed(4)}°, {point.longitude?.toFixed(4)}°
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
