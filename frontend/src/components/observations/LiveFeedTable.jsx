import React, { useState } from 'react';
import { Radio, Search, Plus, ExternalLink, ShieldCheck, Crosshair, Clock } from 'lucide-react';

export default function LiveFeedTable({
  observations = [],
  onSelectVehicle,
  onFocusCamera,
  onOpenSimulator
}) {
  const [filterQuery, setFilterQuery] = useState('');

  const filtered = observations.filter(o => {
    const q = filterQuery.toUpperCase().replace(/\s+/g, '');
    const plateMatch = !q || (o.plate_number && o.plate_number.toUpperCase().includes(q));
    const camMatch = !q || o.camera_id.toUpperCase().includes(q);
    return plateMatch || camMatch;
  });

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header & Simulator Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={18} color="var(--accent-emerald)" />
            <span>Live Telemetry & Ingestion Stream</span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent-emerald)',
              boxShadow: '0 0 10px var(--accent-emerald)'
            }} />
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Real-time feed of vehicle captures, plate recognitions, and edge detections
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Quick Filter */}
          <div style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              className="input-control font-mono"
              placeholder="Filter plate / camera..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.78rem' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          </div>

          {/* Emit Observation Button */}
          <button onClick={onOpenSimulator} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.78rem' }}>
            <Plus size={14} /> Emit Telemetry
          </button>
        </div>
      </div>

      {/* Telemetry Table */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: '0', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(7, 10, 17, 0.8)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
              <th style={{ padding: '10px 14px' }}>Event ID</th>
              <th style={{ padding: '10px 14px' }}>Camera Node</th>
              <th style={{ padding: '10px 14px' }}>License Plate</th>
              <th style={{ padding: '10px 14px' }}>Vehicle Class</th>
              <th style={{ padding: '10px 14px' }}>ANPR Confidence</th>
              <th style={{ padding: '10px 14px' }}>Capture Time (IST)</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No detection telemetry matching filter in current buffer.
                </td>
              </tr>
            ) : (
              filtered.map((obs) => {
                const confPct = (obs.confidence * 100).toFixed(1);
                const confColor = obs.confidence > 0.9 ? 'var(--accent-emerald)' : (obs.confidence > 0.75 ? 'var(--accent-amber)' : 'var(--accent-rose)');

                return (
                  <tr
                    key={obs.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Event ID */}
                    <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      #{obs.id}
                    </td>

                    {/* Camera */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                          {obs.camera_id}
                        </span>
                        <button
                          onClick={() => onFocusCamera && onFocusCamera({ camera_id: obs.camera_id, latitude: obs.latitude, longitude: obs.longitude })}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                          title="Focus camera on map"
                        >
                          <Crosshair size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Plate */}
                    <td style={{ padding: '10px 14px' }}>
                      {obs.plate_number ? (
                        <div className="plate-badge" style={{ fontSize: '0.78rem', padding: '2px 6px' }}>
                          <span className="ind-tag">IND</span>
                          <span>{obs.plate_number}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                          UNREADABLE / NONE
                        </span>
                      )}
                    </td>

                    {/* Vehicle Class */}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}>
                        {obs.vehicle_type}
                      </span>
                    </td>

                    {/* Confidence */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '50px', height: '4px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                          <div style={{ width: `${confPct}%`, height: '100%', background: confColor }} />
                        </div>
                        <span className="font-mono" style={{ fontSize: '0.75rem', color: confColor, fontWeight: 700 }}>
                          {confPct}%
                        </span>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(obs.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {obs.vehicle_id ? (
                        <button
                          onClick={() => onSelectVehicle({ id: obs.vehicle_id, plate_number_best_guess: obs.plate_number, vehicle_type: obs.vehicle_type })}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                        >
                          <ExternalLink size={11} /> Track Journey
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Unlinked</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
