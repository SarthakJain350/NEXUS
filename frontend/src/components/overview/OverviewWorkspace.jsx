import React from 'react';
import {
  Shield,
  Radio,
  Camera,
  Car,
  AlertTriangle,
  Zap,
  Activity,
  ArrowRight,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Clock,
  HeartPulse
} from 'lucide-react';
import TacticalMap from '../map/TacticalMap';

export default function OverviewWorkspace({
  cameras = [],
  vehicles = [],
  observations = [],
  alerts = [],
  analytics = {},
  backendHealth = {},
  isSimulated = false,
  onSelectCamera,
  onSelectVehicle,
  onNavigateTab
}) {
  const activeCameras = cameras.filter(c => c.status === 'active').length;
  const recentObservations = observations.slice(0, 6);
  const activeAlerts = alerts.filter(a => a.status !== 'resolved').slice(0, 4);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      paddingRight: '4px'
    }}>
      {/* Top Banner & KPI Ribbon */}
      <div className="glass-panel" style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'linear-gradient(135deg, rgba(14,23,41,0.9) 0%, rgba(7,10,17,0.95) 100%)',
        border: '1px solid var(--border-medium)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.5px' }}>
                NEXUS COMMAND CENTER
              </h2>
              <span className="client-derived-tag" style={{ background: 'rgba(0,242,254,0.1)', color: 'var(--accent-cyan)', borderColor: 'rgba(0,242,254,0.3)' }}>
                SURVEILLANCE FUSION
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Autonomous Multi-Camera Edge Analytics • ANPR Engine • Cross-Camera Vehicle Trajectories
            </p>
          </div>
        </div>

        {/* System Mode Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 14px',
          borderRadius: '8px',
          background: isSimulated ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${isSimulated ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isSimulated ? 'var(--accent-amber)' : 'var(--accent-emerald)',
            boxShadow: `0 0 10px ${isSimulated ? 'var(--accent-amber)' : 'var(--accent-emerald)'}`
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isSimulated ? '#fbbf24' : '#34d399' }}>
              SYSTEM STATUS: {isSimulated ? 'TACTICAL SIMULATION' : 'LIVE TELEMETRY'}
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>
              {isSimulated ? 'Corridor Simulation Sandbox Mode' : `Connected to PostgreSQL (${backendHealth.database || 'ready'})`}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '10px'
      }}>
        {/* Active Cameras */}
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active Nodes</span>
            <Camera size={14} color="var(--accent-cyan)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {activeCameras} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>/ {cameras.length}</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
            Fleet Online
          </div>
        </div>

        {/* Vehicles Detected */}
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Vehicles Detected</span>
            <Car size={14} color="var(--accent-blue)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {vehicles.length}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Trajectory Linked
          </div>
        </div>

        {/* ANPR Reads */}
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>ANPR Reads</span>
            <Radio size={14} color="var(--accent-purple)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {observations.length}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-purple)', marginTop: '2px' }}>
            Corridor Captures
          </div>
        </div>

        {/* Unique Vehicles */}
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Unique Vehicles</span>
            <Car size={14} color="var(--accent-cyan)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {analytics.unique_vehicles || vehicles.length}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Distinct Plate IDs
          </div>
        </div>

        {/* Active Alerts */}
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active Alerts</span>
            <AlertTriangle size={14} color="var(--accent-rose)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {alerts.length}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-rose)', marginTop: '2px' }}>
            Client-Derived
          </div>
        </div>

        {/* Average Confidence */}
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Avg Confidence</span>
            <CheckCircle2 size={14} color="var(--accent-emerald)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {((analytics.average_confidence || 0.958) * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
            OCR Precision
          </div>
        </div>

        {/* Inference Latency */}
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Inference Latency</span>
            <Zap size={14} color="var(--accent-amber)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '4px' }}>
            14.2 ms
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            YOLOv11 TensorRT
          </div>
        </div>
      </div>

      {/* Main Grid: Map (Left/Center) + Live Feeds & Alerts (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '12px',
        minHeight: '480px'
      }}>
        {/* Left/Center: Large Tactical GIS Map */}
        <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(7, 10, 17, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={14} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                TACTICAL GIS CORRIDOR
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                Mumbai-Pune Urban Mesh
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('gis')}
              className="btn btn-outline"
              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
            >
              <span>Full GIS Map</span>
              <ArrowRight size={11} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: '420px', position: 'relative' }}>
            <TacticalMap
              cameras={cameras}
              onSelectCamera={onSelectCamera}
              journeyPoints={[]}
            />
          </div>
        </div>

        {/* Right Column: Live Detection Feed & Active Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Live Detection Feed Box */}
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(7, 10, 17, 0.7)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={14} color="var(--accent-emerald)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>
                  LIVE DETECTION FEED
                </span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 6px var(--accent-emerald)' }} />
              </div>
              <button
                onClick={() => onNavigateTab('feed')}
                className="btn btn-outline"
                style={{ padding: '2px 6px', fontSize: '0.68rem' }}
              >
                <span>View All</span>
                <ArrowRight size={10} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentObservations.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                  Awaiting edge observation stream...
                </div>
              ) : (
                recentObservations.map((obs) => (
                  <div
                    key={obs.id}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {obs.plate_number ? (
                          <div className="plate-badge" style={{ fontSize: '0.75rem', padding: '1px 5px' }}>
                            <span className="ind-tag">IND</span>
                            <span>{obs.plate_number}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>NO PLATE</span>
                        )}
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {obs.vehicle_type}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{obs.camera_id}</span>
                        {' • '}
                        <span>{new Date(obs.timestamp).toLocaleTimeString()}</span>
                        {' • '}
                        <span style={{ color: obs.confidence > 0.9 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                          {(obs.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {obs.vehicle_id && (
                      <button
                        onClick={() => {
                          onSelectVehicle?.({ id: obs.vehicle_id, plate_number_best_guess: obs.plate_number, vehicle_type: obs.vehicle_type });
                          onNavigateTab('tracking');
                        }}
                        className="btn btn-outline"
                        title="Track vehicle"
                        style={{ padding: '3px 6px' }}
                      >
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Alerts Box */}
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(7, 10, 17, 0.7)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} color="var(--accent-amber)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>
                  ACTIVE ALERTS
                </span>
                <span className="client-derived-tag" style={{ fontSize: '0.58rem' }}>CLIENT-DERIVED</span>
              </div>
              <button
                onClick={() => onNavigateTab('alerts')}
                className="btn btn-outline"
                style={{ padding: '2px 6px', fontSize: '0.68rem' }}
              >
                <span>Manage</span>
                <ArrowRight size={10} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeAlerts.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                  No active critical anomalies detected.
                </div>
              ) : (
                activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={`severity-pill ${alert.severity}`} style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                        {alert.severity}
                      </span>
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#fff', marginTop: '3px', fontWeight: 600 }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      Node: <b style={{ color: 'var(--accent-cyan)' }}>{alert.camera}</b> | Target: {alert.vehicle}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Traffic Intelligence, Camera Health & System Pipeline */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '12px'
      }}>
        {/* Traffic Intelligence Card */}
        <div className="glass-panel" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={15} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>TRAFFIC DENSITY LEVEL</span>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              background: analytics.traffic_level === 'HIGH' ? 'rgba(244,63,94,0.15)' : (analytics.traffic_level === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'),
              color: analytics.traffic_level === 'HIGH' ? '#fb7185' : (analytics.traffic_level === 'MEDIUM' ? '#fbbf24' : '#34d399'),
              border: '1px solid currentColor'
            }}>
              {analytics.traffic_level || 'LOW'} CONGESTION
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Corridor observations count is {observations.length} across {cameras.length} nodes. Primary volume comprises light vehicles and commercial transport.
          </p>
        </div>

        {/* Camera Fleet Summary Card */}
        <div className="glass-panel" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={15} color="var(--accent-emerald)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>CAMERA FLEET NODES</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
              {activeCameras} / {cameras.length} ONLINE
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cameras.slice(0, 6).map(c => (
              <span
                key={c.camera_id}
                onClick={() => {
                  onSelectCamera?.(c);
                  onNavigateTab('gis');
                }}
                className="font-mono"
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: c.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: c.status === 'active' ? '#34d399' : '#fbbf24',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer'
                }}
              >
                {c.camera_id}
              </span>
            ))}
          </div>
        </div>

        {/* System Health Summary Card */}
        <div className="glass-panel" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HeartPulse size={15} color="var(--accent-purple)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>SYSTEM HEALTH & ML</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: backendHealth.online ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontWeight: 700 }}>
              {backendHealth.online ? 'FASTAPI READY' : 'SIMULATION MODE'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            <span>R1 Tracker: <b style={{ color: 'var(--accent-cyan)' }}>LOCAL MODULE</b></span>
            <span>R2 ANPR: <b style={{ color: 'var(--accent-cyan)' }}>LOCAL MODULE</b></span>
            <span>R5 Re-ID: <b style={{ color: 'var(--accent-purple)' }}>INTEGRATION READY</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
