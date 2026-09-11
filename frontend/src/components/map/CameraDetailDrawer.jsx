import React from 'react';
import { X, Edit3, Camera, Radio, ExternalLink, MapPin, Clock, Video } from 'lucide-react';

export default function CameraDetailDrawer({
  camera,
  observations = [],
  onClose,
  onEditCamera,
  onSelectVehicle
}) {
  if (!camera) return null;

  // Filter observations recorded at this camera
  const cameraObs = observations.filter(o => o.camera_id === camera.camera_id).slice(0, 5);

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        top: 12,
        right: 14,
        bottom: 14,
        width: '340px',
        zIndex: 1001,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        overflowY: 'auto',
        background: 'rgba(11, 17, 30, 0.92)',
        border: '1px solid var(--border-medium)',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.8)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={18} color="var(--accent-cyan)" />
          <span className="font-mono" style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
            {camera.camera_id}
          </span>
          <span className={`status-pill ${camera.status}`} style={{ fontSize: '0.65rem' }}>
            {camera.status}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Camera Info */}
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
          {camera.name || 'Unnamed Sensor'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          <MapPin size={13} color="var(--accent-cyan)" />
          <span>{camera.location || 'Location not configured'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
          <Clock size={13} />
          <span>Last Ping: {camera.last_seen_at ? new Date(camera.last_seen_at).toLocaleTimeString() : 'Unknown'}</span>
        </div>
        <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
          LAT {camera.latitude?.toFixed(4)}° / LON {camera.longitude?.toFixed(4)}°
        </div>
      </div>

      {/* Simulated Surveillance Feed Canvas */}
      <div style={{
        position: 'relative',
        height: '140px',
        borderRadius: '8px',
        background: 'radial-gradient(circle, #0f2334 0%, #060c14 100%)',
        border: '1px solid rgba(0, 242, 254, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Scanlines effect */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(0, 242, 254, 0.05) 1px, transparent 1px)',
          backgroundSize: '100% 4px',
          pointerEvents: 'none'
        }} />

        {/* Video stream watermark */}
        <div style={{ position: 'absolute', top: 8, left: 10, fontSize: '0.62rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
          REC ● LIVE FEED 1080P
        </div>
        <div style={{ position: 'absolute', top: 8, right: 10, fontSize: '0.62rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
          FPS: 29.8
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: '0.65rem', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {camera.camera_id} // {camera.location || 'SECTOR-01'}
        </div>

        <Video size={36} color="rgba(0, 242, 254, 0.35)" />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onEditCamera(camera)}
          className="btn btn-outline"
          style={{ flex: 1, padding: '7px 12px', fontSize: '0.78rem' }}
        >
          <Edit3 size={14} /> Update GPS / Status
        </button>
      </div>

      {/* Recent Detections at this Camera */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '0' }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          <span>Recent ANPR Detections</span>
          <span style={{ color: 'var(--accent-cyan)' }}>{cameraObs.length} in buffer</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
          {cameraObs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              No recent observations recorded at this node.
            </div>
          ) : (
            cameraObs.map((obs) => (
              <div
                key={obs.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="font-mono" style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>
                      {obs.plate_number || 'UNREADABLE'}
                    </span>
                    <span style={{
                      fontSize: '0.62rem',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(0, 242, 254, 0.1)',
                      color: 'var(--accent-cyan)',
                      textTransform: 'uppercase'
                    }}>
                      {obs.vehicle_type}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {new Date(obs.timestamp).toLocaleTimeString()} • Conf: {(obs.confidence * 100).toFixed(0)}%
                  </div>
                </div>

                {obs.vehicle_id && (
                  <button
                    onClick={() => onSelectVehicle({ id: obs.vehicle_id, plate_number_best_guess: obs.plate_number })}
                    className="btn btn-outline"
                    title="Track vehicle journey"
                    style={{ padding: '4px 6px' }}
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
