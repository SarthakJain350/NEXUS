import React, { useState } from 'react';
import { Radio, Search, Plus, ExternalLink, ShieldCheck, Crosshair, Clock, Filter, Eye } from 'lucide-react';

export default function LiveFeedTable({
  observations = [],
  cameras = [],
  onSelectVehicle,
  onFocusCamera,
  onOpenSimulator,
  isSimulated = false,
  lastRefreshTime = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);

  // Camera map lookup for location
  const cameraLocationMap = {};
  cameras.forEach(c => {
    cameraLocationMap[c.camera_id] = c.location || c.name || 'Corridor';
  });

  const filtered = observations.filter(obs => {
    const q = searchQuery.toUpperCase().replace(/\s+/g, '');
    const plateMatch = !q || (obs.plate_number && obs.plate_number.toUpperCase().includes(q)) || obs.camera_id.toUpperCase().includes(q) || obs.id.toString().includes(q);
    const cameraMatch = cameraFilter === 'all' || obs.camera_id === cameraFilter;
    const typeMatch = vehicleTypeFilter === 'all' || obs.vehicle_type === vehicleTypeFilter;
    const confMatch = (obs.confidence || 0) >= minConfidence;

    return plateMatch && cameraMatch && typeMatch && confMatch;
  });

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header & Simulator Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={18} color="var(--accent-emerald)" />
              <span>LIVE TELEMETRY INGESTION STREAM</span>
            </h2>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              background: isSimulated ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
              color: isSimulated ? '#fbbf24' : '#34d399',
              border: `1px solid ${isSimulated ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)'}`,
              fontFamily: 'var(--font-mono)'
            }}>
              {isSimulated ? '● TACTICAL SIMULATION' : '● LIVE TELEMETRY (POSTGRESQL)'}
            </span>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Real-time feed of vehicle captures, plate recognitions, and edge tracker detections • 12s Polling Cycle
            {lastRefreshTime && ` • Last refreshed: ${lastRefreshTime}`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Emit Observation Simulator Button */}
          <button onClick={onOpenSimulator} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.78rem' }}>
            <Plus size={14} /> Emit Telemetry
          </button>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        background: 'rgba(11, 17, 30, 0.6)',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        {/* Quick Search */}
        <div style={{ position: 'relative', width: '220px' }}>
          <input
            type="text"
            className="input-control font-mono"
            placeholder="Filter plate / ID / cam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '0.78rem' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        </div>

        {/* Camera Selector */}
        <div style={{ minWidth: '150px' }}>
          <select
            className="input-control font-mono"
            value={cameraFilter}
            onChange={(e) => setCameraFilter(e.target.value)}
            style={{ fontSize: '0.78rem', background: '#0b111e', cursor: 'pointer' }}
          >
            <option value="all">All Cameras ({cameras.length})</option>
            {cameras.map(c => (
              <option key={c.camera_id} value={c.camera_id}>
                {c.camera_id} — {c.name || 'Sensor'}
              </option>
            ))}
          </select>
        </div>

        {/* Vehicle Class Selector */}
        <div style={{ minWidth: '130px' }}>
          <select
            className="input-control"
            value={vehicleTypeFilter}
            onChange={(e) => setVehicleTypeFilter(e.target.value)}
            style={{ fontSize: '0.78rem', background: '#0b111e', cursor: 'pointer' }}
          >
            <option value="all">All Classes</option>
            <option value="car">Car</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="truck">Truck</option>
            <option value="bus">Bus</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        {/* Min Confidence Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>Min Conf:</span>
          <input
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--accent-cyan)' }}
          />
          <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
            {(minConfidence * 100).toFixed(0)}%
          </span>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          Showing <b style={{ color: '#fff' }}>{filtered.length}</b> of {observations.length} events
        </div>
      </div>

      {/* Telemetry Table */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: '0', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(7, 10, 17, 0.9)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
              <th style={{ padding: '10px 14px' }}>Event ID</th>
              <th style={{ padding: '10px 14px' }}>Camera Node</th>
              <th style={{ padding: '10px 14px' }}>Track ID</th>
              <th style={{ padding: '10px 14px' }}>License Plate</th>
              <th style={{ padding: '10px 14px' }}>Vehicle Class</th>
              <th style={{ padding: '10px 14px' }}>ANPR Confidence</th>
              <th style={{ padding: '10px 14px' }}>Location / Sector</th>
              <th style={{ padding: '10px 14px' }}>Capture Time (IST)</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No detection telemetry matching filter in current buffer.
                </td>
              </tr>
            ) : (
              filtered.map((obs) => {
                const confPct = ((obs.confidence || 0) * 100).toFixed(1);
                const confColor = obs.confidence > 0.9 ? 'var(--accent-emerald)' : (obs.confidence > 0.75 ? 'var(--accent-amber)' : 'var(--accent-rose)');
                const locationStr = cameraLocationMap[obs.camera_id] || (obs.latitude ? `${obs.latitude.toFixed(2)}°N` : 'Corridor');

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
                    <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
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
                          title="Focus camera on GIS map"
                        >
                          <Crosshair size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Track ID */}
                    <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                      {obs.track_id ? `TRK-${obs.track_id}` : 'TRK-01'}
                    </td>

                    {/* Plate */}
                    <td style={{ padding: '10px 14px' }}>
                      {obs.plate_number ? (
                        <div className="plate-badge" style={{ fontSize: '0.76rem', padding: '2px 6px' }}>
                          <span className="ind-tag">IND</span>
                          <span>{obs.plate_number}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.74rem' }}>
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
                        <div style={{ width: '45px', height: '4px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                          <div style={{ width: `${confPct}%`, height: '100%', background: confColor }} />
                        </div>
                        <span className="font-mono" style={{ fontSize: '0.74rem', color: confColor, fontWeight: 700 }}>
                          {confPct}%
                        </span>
                      </div>
                    </td>

                    {/* Location */}
                    <td style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {locationStr}
                    </td>

                    {/* Timestamp */}
                    <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {new Date(obs.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => onFocusCamera && onFocusCamera({ camera_id: obs.camera_id, latitude: obs.latitude, longitude: obs.longitude })}
                          className="btn btn-outline"
                          title="View camera on map"
                          style={{ padding: '3px 6px', fontSize: '0.68rem' }}
                        >
                          <Crosshair size={11} /> Map
                        </button>
                        {obs.vehicle_id ? (
                          <button
                            onClick={() => onSelectVehicle({ id: obs.vehicle_id, plate_number_best_guess: obs.plate_number, vehicle_type: obs.vehicle_type })}
                            className="btn btn-outline"
                            title="Track vehicle journey"
                            style={{ padding: '3px 6px', fontSize: '0.68rem' }}
                          >
                            <ExternalLink size={11} /> Track
                          </button>
                        ) : null}
                      </div>
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
