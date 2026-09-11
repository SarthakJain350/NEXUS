import React, { useState } from 'react';
import { Camera, MapPin, Clock, Edit3, Crosshair, Plus, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function CameraGrid({
  cameras = [],
  onEditCamera,
  onFocusCamera
}) {
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = cameras.filter(c => statusFilter === 'all' || c.status === statusFilter);

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} color="var(--accent-cyan)" />
            <span>Surveillance Camera Fleet</span>
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Edge observation nodes and ANPR capture points across the transport grid
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'active', 'unregistered', 'maintenance', 'inactive'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                border: statusFilter === st ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                background: statusFilter === st ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: statusFilter === st ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Camera Cards */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '14px',
        alignContent: 'start'
      }}>
        {filtered.map((cam) => {
          const isUnregistered = cam.status === 'unregistered';

          return (
            <div
              key={cam.camera_id}
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                border: isUnregistered ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
                background: isUnregistered ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-card)',
                transition: 'var(--transition)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="font-mono" style={{ fontWeight: 800, fontSize: '0.95rem', color: isUnregistered ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>
                    {cam.camera_id}
                  </span>
                  <span className={`status-pill ${cam.status}`}>
                    {cam.status}
                  </span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                  {cam.name || (isUnregistered ? '⚠️ Unregistered Sensor Node' : 'Unnamed Camera')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <MapPin size={13} color="var(--accent-cyan)" />
                  <span>{cam.location || 'No physical location assigned'}</span>
                </div>

                <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  COORDS: {cam.latitude?.toFixed(4) || '0.0000'}°, {cam.longitude?.toFixed(4) || '0.0000'}°
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  <Clock size={13} />
                  <span>Last Seen: {cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleTimeString() : 'Never'}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <button
                  onClick={() => onFocusCamera(cam)}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem' }}
                >
                  <Crosshair size={13} /> View On Map
                </button>
                <button
                  onClick={() => onEditCamera(cam)}
                  className={isUnregistered ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem' }}
                >
                  <Edit3 size={13} /> {isUnregistered ? 'Configure' : 'Edit'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
