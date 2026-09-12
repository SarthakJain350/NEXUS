import React, { useState, useMemo } from 'react';
import { Sparkles, Car, Camera, Clock, Upload, ArrowRight, ShieldCheck, Info, ExternalLink, RefreshCw } from 'lucide-react';

// Cross-camera Re-ID studio. Candidates are the probe vehicle's REAL
// observations as associated by the backend's plate-linking identity
// mechanism (MVP fusion approach, decision D3). No embedding scores are
// fabricated: the visual feature matcher (VehicleReIdentifier, handcrafted
// HSV/Sobel features + cosine similarity) ships as the Python reference
// baseline in reid/ and is designated R6 future work.
export default function ReidWorkspace({
  vehicles = [],
  cameras = [],
  observations = [],
  onSelectVehicle,
  onNavigateTab
}) {
  const [selectedProbe, setSelectedProbe] = useState(vehicles[0] || null);

  // All real observations of the probe vehicle (vehicle_id linkage)
  const probeObservations = useMemo(() => {
    if (!selectedProbe) return [];
    return observations.filter(o => o.vehicle_id === selectedProbe.id);
  }, [observations, selectedProbe]);

  // Gallery candidates: the highest-confidence observation at each camera,
  // most recent sighting first — a real cross-camera view of one identity.
  const sightings = useMemo(() => {
    const best = new Map();
    probeObservations.forEach(o => {
      const prev = best.get(o.camera_id);
      if (!prev || (o.confidence || 0) > (prev.confidence || 0)) {
        best.set(o.camera_id, o);
      }
    });
    return [...best.values()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [probeObservations]);

  const cameraName = (cameraId) =>
    cameras.find(c => c.camera_id === cameraId)?.name || `Camera ${cameraId}`;

  const firstSeen = probeObservations.length > 0
    ? probeObservations.reduce((min, o) => (new Date(o.timestamp) < min ? new Date(o.timestamp) : min), new Date(probeObservations[0].timestamp))
    : null;
  const lastSeen = probeObservations.length > 0
    ? probeObservations.reduce((max, o) => (new Date(o.timestamp) > max ? new Date(o.timestamp) : max), new Date(probeObservations[0].timestamp))
    : null;

  const handleSelectProbe = (probe) => {
    setSelectedProbe(probe);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-purple)" />
              <span>Cross-Camera Re-ID Intelligence Studio</span>
            </h2>
            <span className="client-derived-tag" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.4)' }}>
              ● PLATE-LINKED ASSOCIATION // R6 VIEW
            </span>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Cross-camera identity via plate-link association • Visual Re-ID baseline: <code className="font-mono">reid/vehicle_reid.py</code> (reference)
          </p>
        </div>
      </div>

      {/* Honest Capabilities Notice */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '8px',
        background: 'rgba(168, 85, 247, 0.05)',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.74rem',
        color: 'var(--text-muted)'
      }}>
        <Info size={16} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
        <span>
          <b>System Notice:</b> Candidates below are this vehicle's <b>real cross-camera observations</b>, associated by the backend's plate-linking identity mechanism (the MVP fusion approach). The visual feature matcher (<code className="font-mono" style={{ color: '#c084fc' }}>VehicleReIdentifier</code> — handcrafted HSV/Sobel embeddings + cosine similarity) ships as the Python reference baseline in <code className="font-mono" style={{ color: '#c084fc' }}>reid/</code> and is R6 future work; no embedding similarity scores are fabricated here.
        </span>
      </div>

      {/* Main Studio Grid: Probe Selector (Left) + Cross-Camera Sightings (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', flex: 1, minHeight: '0' }}>
        {/* Left: Query Vehicle Selection */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(7, 10, 17, 0.6)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Select Query Probe Vehicle
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
            {vehicles.map((veh) => {
              const isSelected = selectedProbe && selectedProbe.id === veh.id;
              return (
                <div
                  key={veh.id}
                  onClick={() => handleSelectProbe(veh)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div className="plate-badge" style={{ fontSize: '0.76rem', padding: '1px 6px' }}>
                      <span className="ind-tag">IND</span>
                      <span>{veh.plate_number_best_guess}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      ID: <b style={{ color: 'var(--accent-purple)' }}>{veh.global_vehicle_id || 'Pending fusion'}</b>
                      {' • '}
                      <span style={{ textTransform: 'uppercase' }}>{veh.vehicle_type}</span>
                    </div>
                  </div>

                  <button
                    className={isSelected ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                  >
                    Match
                  </button>
                </div>
              );
            })}
          </div>

          {/* Probe Summary — real derived data, no synthetic feature vectors */}
          {selectedProbe && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.72rem'
            }}>
              <div style={{ color: 'var(--accent-purple)', fontWeight: 700, marginBottom: '4px' }}>
                PROBE SUMMARY
              </div>
              <div style={{ color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div>Observations: <b style={{ color: '#fff' }}>{probeObservations.length}</b> across <b style={{ color: '#fff' }}>{sightings.length}</b> camera{sightings.length === 1 ? '' : 's'}</div>
                {firstSeen && (
                  <div>First seen: <span className="font-mono">{firstSeen.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
                )}
                {lastSeen && (
                  <div>Last seen: <span className="font-mono">{lastSeen.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
                )}
                <div>Association basis: <b style={{ color: '#c084fc' }}>PLATE LINK</b></div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Cross-Camera Sightings, ranked by recency */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(7, 10, 17, 0.6)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                CROSS-CAMERA SIGHTINGS (PLATE-ASSOCIATED)
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Best observation per camera, most recent first — same identity, multiple vantage points
              </div>
            </div>

            {selectedProbe && (
              <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-purple)' }}>
                Target: {selectedProbe.plate_number_best_guess}
              </span>
            )}
          </div>

          {/* Results List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sightings.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                {selectedProbe
                  ? 'No observations recorded for this vehicle yet — ingest or seed data first.'
                  : 'Select a query probe vehicle to see its cross-camera sightings.'}
              </div>
            )}
            {sightings.map((obs, idx) => {
              const confPct = ((obs.confidence || 0) * 100).toFixed(1);
              const isVerified = (obs.confidence || 0) >= 0.75;

              return (
                <div
                  key={obs.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: isVerified ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isVerified ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isVerified ? '#c084fc' : 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: '0.8rem'
                    }}>
                      #{idx + 1}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="plate-badge" style={{ fontSize: '0.78rem', padding: '2px 6px' }}>
                          <span className="ind-tag">IND</span>
                          <span>{obs.plate_number || 'UNREADABLE'}</span>
                        </div>
                        <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 700 }}>
                          {obs.global_vehicle_id || 'Pending fusion'}
                        </span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {obs.vehicle_type}
                        </span>
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontWeight: 700 }}>
                          PLATE LINK
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        <span>Camera: <b style={{ color: 'var(--accent-cyan)' }}>{obs.camera_id}</b> ({cameraName(obs.camera_id)})</span>
                        <span>•</span>
                        <span>Seen: {new Date(obs.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Capture Confidence Gauge — real detection confidence */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Capture Confidence
                      </div>
                      <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: isVerified ? '#c084fc' : 'var(--text-dim)' }}>
                        {confPct}%
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                        Basis: plate-link association
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onSelectVehicle?.(selectedProbe);
                        onNavigateTab('tracking');
                      }}
                      className="btn btn-outline"
                      title="View trajectory in GIS"
                      style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                    >
                      <ExternalLink size={12} /> Route
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
