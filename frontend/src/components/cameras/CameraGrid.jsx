import React, { useState } from 'react';
import { Camera, MapPin, Clock, Edit3, Crosshair, Radio, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function CameraGrid({
  cameras = [],
  onEditCamera,
  onFocusCamera,
  onSelectCamera
}) {
  const [statusFilter, setStatusFilter] = useState('all');

  // Count summaries
  const totalCameras = cameras.length;
  const onlineCount = cameras.filter(c => c.status === 'active').length;
  const unregisteredCount = cameras.filter(c => c.status === 'unregistered').length;
  const maintenanceCount = cameras.filter(c => c.status === 'maintenance').length;
  const offlineCount = cameras.filter(c => c.status === 'inactive').length;
  const degradedCount = unregisteredCount + maintenanceCount;

  const filtered = cameras.filter(c => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'online') return c.status === 'active';
    if (statusFilter === 'degraded') return c.status === 'unregistered' || c.status === 'maintenance';
    if (statusFilter === 'offline') return c.status === 'inactive';
    if (statusFilter === 'unregistered') return c.status === 'unregistered';
    if (statusFilter === 'maintenance') return c.status === 'maintenance';
    return c.status === statusFilter;
  });

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header & Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} color="var(--accent-cyan)" />
            <span>Camera Fleet Network</span>
          </h2>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Edge observation nodes, ANPR capture stations, and corridor surveillance sensors
          </p>
        </div>

        {/* Top Summary Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>TOTAL:</span>
            <span className="font-mono" style={{ fontWeight: 800, color: '#fff' }}>{totalCameras}</span>
          </div>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div className="status-dot active" />
            <span style={{ color: 'var(--text-dim)' }}>ONLINE:</span>
            <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>{onlineCount}</span>
          </div>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div className="status-dot unregistered" />
            <span style={{ color: 'var(--text-dim)' }}>DEGRADED:</span>
            <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-amber)' }}>{degradedCount}</span>
          </div>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div className="status-dot inactive" />
            <span style={{ color: 'var(--text-dim)' }}>OFFLINE:</span>
            <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-rose)' }}>{offlineCount}</span>
          </div>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>UNREGISTERED:</span>
            <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-amber)' }}>{unregisteredCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        {[
          { id: 'all', label: 'All Nodes' },
          { id: 'online', label: 'Online' },
          { id: 'degraded', label: 'Degraded' },
          { id: 'offline', label: 'Offline' },
          { id: 'unregistered', label: 'Unregistered' },
          { id: 'maintenance', label: 'Maintenance' }
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: statusFilter === f.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              background: statusFilter === f.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: statusFilter === f.id ? 'var(--accent-cyan)' : 'var(--text-muted)'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid of Camera Cards */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
        gap: '14px',
        alignContent: 'start'
      }}>
        {filtered.map((cam) => {
          const isUnregistered = cam.status === 'unregistered';
          const isOffline = cam.status === 'inactive';

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
                border: isUnregistered ? '1px solid rgba(245, 158, 11, 0.4)' : (isOffline ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-subtle)'),
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
                  GPS: {cam.latitude?.toFixed(4) || '0.0000'}°, {cam.longitude?.toFixed(4) || '0.0000'}°
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>Ping: {cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleTimeString() : 'Never'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}>
                    <Radio size={12} />
                    <span>{cam.observation_count || 0} Captures</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <button
                  onClick={() => onFocusCamera(cam)}
                  className="btn btn-outline"
                  title="Locate on Tactical GIS Map"
                  style={{ flex: 1, padding: '6px 8px', fontSize: '0.74rem' }}
                >
                  <Crosshair size={13} /> Locate
                </button>
                {onSelectCamera && (
                  <button
                    onClick={() => onSelectCamera(cam)}
                    className="btn btn-outline"
                    title="View Sensor Telemetry Drawer"
                    style={{ flex: 1, padding: '6px 8px', fontSize: '0.74rem' }}
                  >
                    Details
                  </button>
                )}
                <button
                  onClick={() => onEditCamera(cam)}
                  className={isUnregistered ? 'btn btn-primary' : 'btn btn-outline'}
                  title="Configure camera coordinates and status"
                  style={{ flex: 1, padding: '6px 8px', fontSize: '0.74rem' }}
                >
                  <Edit3 size={13} /> {isUnregistered ? 'Config' : 'Edit'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
