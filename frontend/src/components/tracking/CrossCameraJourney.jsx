import React from 'react';
import { ArrowRight, Database, Sparkles, Navigation, Clock, ShieldCheck, MapPin } from 'lucide-react';

export default function CrossCameraJourney({
  selectedVehicle,
  journeyPoints = [],
  onFocusWaypoint
}) {
  if (!selectedVehicle || journeyPoints.length === 0) {
    return null;
  }

  return (
    <div className="glass-panel" style={{
      padding: '14px 18px',
      background: 'rgba(11, 17, 30, 0.95)',
      border: '1px solid var(--border-medium)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Header with Technical Honesty Distinction */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={16} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff', letterSpacing: '0.5px' }}>
            CROSS-CAMERA MULTI-STATION JOURNEY
          </span>
        </div>

        {/* Explicit distinction: DATABASE JOURNEY vs RE-ID MATCH */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="client-derived-tag" style={{ background: 'rgba(0, 242, 254, 0.12)', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 242, 254, 0.3)' }}>
            <Database size={11} style={{ marginRight: '3px' }} />
            DATABASE JOURNEY (ACTIVE)
          </span>
          <span className="client-derived-tag" style={{ background: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-dim)', borderColor: 'rgba(255, 255, 255, 0.1)' }} title="Standalone module, not wired into live pipeline">
            <Sparkles size={11} style={{ marginRight: '3px' }} />
            RE-ID PIPELINE (STANDALONE)
          </span>
        </div>
      </div>

      {/* Trajectory Sequence Flow */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        padding: '8px 4px',
        scrollbarWidth: 'thin'
      }}>
        {journeyPoints.map((pt, idx) => {
          const isLast = idx === journeyPoints.length - 1;
          const timeStr = pt.timestamp
            ? new Date(pt.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
            : '00:00';

          return (
            <React.Fragment key={pt.observation_id || idx}>
              <div
                onClick={() => onFocusWaypoint && onFocusWaypoint([pt.latitude, pt.longitude])}
                className="flow-node"
                style={{
                  cursor: 'pointer',
                  borderColor: isLast ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  background: isLast ? 'rgba(0, 242, 254, 0.08)' : 'rgba(14, 23, 41, 0.8)',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
                onMouseLeave={(e) => {
                  if (!isLast) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  STEP #{idx + 1}
                </div>
                <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-cyan)', margin: '2px 0' }}>
                  {pt.camera_id}
                </div>
                <div className="font-mono" style={{ fontSize: '0.74rem', color: '#fff' }}>
                  {timeStr}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pt.camera_name || 'Corridor Node'}
                </div>
              </div>

              {!isLast && (
                <div className="flow-arrow">
                  <ArrowRight size={16} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
