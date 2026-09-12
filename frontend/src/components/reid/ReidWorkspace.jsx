import React, { useState } from 'react';
import { Sparkles, Car, Camera, Clock, Upload, ArrowRight, ShieldCheck, Info, ExternalLink, RefreshCw } from 'lucide-react';

export default function ReidWorkspace({
  vehicles = [],
  cameras = [],
  observations = [],
  onSelectVehicle,
  onNavigateTab
}) {
  const [selectedProbe, setSelectedProbe] = useState(vehicles[0] || null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Gallery candidates derived from observations
  const candidateObservations = observations.filter(o => o.plate_number).slice(0, 8);

  // Mock similarity scores representing cosine similarity comparison from VehicleReIdentifier
  const reidMatches = selectedProbe
    ? [
        {
          id: 'REID-M1',
          global_vehicle_id: selectedProbe.global_vehicle_id || 'GV-9021',
          plate_number: selectedProbe.plate_number_best_guess,
          vehicle_type: selectedProbe.vehicle_type,
          similarity: 0.984,
          camera_id: 'CAM_06',
          camera_name: 'Expressway Khalapur Plaza',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          vector_distance: '0.016'
        },
        {
          id: 'REID-M2',
          global_vehicle_id: selectedProbe.global_vehicle_id || 'GV-9021',
          plate_number: selectedProbe.plate_number_best_guess,
          vehicle_type: selectedProbe.vehicle_type,
          similarity: 0.932,
          camera_id: 'CAM_04',
          camera_name: 'Eastern Freeway Chembur Exit',
          timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
          vector_distance: '0.068'
        },
        {
          id: 'REID-M3',
          global_vehicle_id: selectedProbe.global_vehicle_id || 'GV-9021',
          plate_number: selectedProbe.plate_number_best_guess,
          vehicle_type: selectedProbe.vehicle_type,
          similarity: 0.887,
          camera_id: 'CAM_02',
          camera_name: 'Worli Seaface South Junction',
          timestamp: new Date(Date.now() - 65 * 60000).toISOString(),
          vector_distance: '0.113'
        },
        {
          id: 'REID-M4',
          global_vehicle_id: 'GV-3184',
          plate_number: 'MH04XX1199',
          vehicle_type: selectedProbe.vehicle_type,
          similarity: 0.742,
          camera_id: 'CAM_01',
          camera_name: 'Bandra-Worli Sea Link North',
          timestamp: new Date(Date.now() - 110 * 60000).toISOString(),
          vector_distance: '0.258'
        }
      ]
    : [];

  const handleSimulateReid = (probe) => {
    setSelectedProbe(probe);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
    }, 400);
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
              ● RE-ID DEMO // ANALYTICS SIMULATION
            </span>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Deep metric visual feature re-identification • Cosine embedding similarity matching
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
          <b>System Notice:</b> The NEXUS codebase contains the standalone <code className="font-mono" style={{ color: '#c084fc' }}>VehicleReIdentifier</code> and feature extraction algorithms in Python. This studio provides a tactical demonstration of feature vector matching without inventing fake production backend endpoints.
        </span>
      </div>

      {/* Main Studio Grid: Probe Selector (Left) + Cosine Matches (Right) */}
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
                  onClick={() => handleSimulateReid(veh)}
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
                      ID: <b style={{ color: 'var(--accent-purple)' }}>{veh.global_vehicle_id || 'GV-9021'}</b>
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

          {/* Active Probe Signature Card */}
          {selectedProbe && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.72rem'
            }}>
              <div style={{ color: 'var(--accent-purple)', fontWeight: 700, marginBottom: '4px' }}>
                512-D FEATURE SIGNATURE
              </div>
              <div className="font-mono" style={{ color: 'var(--text-dim)', wordBreak: 'break-all', fontSize: '0.62rem' }}>
                [0.042, -0.198, 0.812, 0.009, -0.344, 0.551, 0.129, -0.088, 0.432, ...]
              </div>
            </div>
          )}
        </div>

        {/* Right: Cosine Similarity Ranked Results */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(7, 10, 17, 0.6)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                FEATURE SIMILARITY RANKED CANDIDATES
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Ranked by cosine distance: <code className="font-mono">cos_sim(v_probe, v_gallery)</code>
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
            {reidMatches.map((match, idx) => {
              const simPct = (match.similarity * 100).toFixed(1);
              const isMatch = match.similarity >= 0.85;

              return (
                <div
                  key={match.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: isMatch ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border-subtle)',
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
                      background: isMatch ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isMatch ? '#c084fc' : 'var(--text-dim)',
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
                          <span>{match.plate_number}</span>
                        </div>
                        <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 700 }}>
                          {match.global_vehicle_id}
                        </span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {match.vehicle_type}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        <span>Camera: <b style={{ color: 'var(--accent-cyan)' }}>{match.camera_id}</b> ({match.camera_name})</span>
                        <span>•</span>
                        <span>Seen: {new Date(match.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Similarity Gauge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Cosine Similarity
                      </div>
                      <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: isMatch ? '#c084fc' : 'var(--text-dim)' }}>
                        {simPct}%
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                        Distance: {match.vector_distance}
                      </div>
                    </div>

                    {isMatch && (
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
                    )}
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
