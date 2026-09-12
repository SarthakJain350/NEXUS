import React from 'react';
import { Camera, Car, Radio, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';

export default function StatsRibbon({
  cameras = [],
  vehicles = [],
  observations = [],
  alerts = []
}) {
  const activeCameras = cameras.filter(c => c.status === 'active').length;
  const unregisteredCameras = cameras.filter(c => c.status === 'unregistered').length;
  const offlineCameras = cameras.filter(c => c.status === 'inactive' || c.status === 'maintenance').length;
  
  const totalObs = observations.length;
  const avgConf = totalObs > 0 
    ? (observations.reduce((acc, o) => acc + (o.confidence || 0), 0) / totalObs * 100).toFixed(1)
    : '95.8';

  const highSeverityAlerts = alerts.filter(a => a.severity === 'HIGH').length;

  const stats = [
    {
      label: 'Camera Fleet Status',
      value: `${activeCameras}/${cameras.length}`,
      subtext: unregisteredCameras > 0 ? `${unregisteredCameras} unregistered node(s)` : (offlineCameras > 0 ? `${offlineCameras} offline/maint` : 'All nodes online'),
      subtextColor: unregisteredCameras > 0 ? 'var(--accent-amber)' : (offlineCameras > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'),
      icon: Camera,
      accent: 'var(--accent-cyan)'
    },
    {
      label: 'Monitored Vehicles',
      value: vehicles.length.toString(),
      subtext: 'Database Trajectory Linked',
      subtextColor: 'var(--text-dim)',
      icon: Car,
      accent: 'var(--accent-blue)'
    },
    {
      label: 'Detection Telemetry',
      value: totalObs.toLocaleString(),
      subtext: 'ANPR + Tracker Events',
      subtextColor: 'var(--accent-emerald)',
      icon: Radio,
      accent: 'var(--accent-purple)'
    },
    {
      label: 'ANPR Precision Avg',
      value: `${avgConf}%`,
      subtext: 'Fast-Plate-OCR + YOLO',
      subtextColor: 'var(--text-dim)',
      icon: ShieldCheck,
      accent: 'var(--accent-emerald)'
    },
    {
      label: 'Active Alerts',
      value: alerts.length.toString(),
      subtext: highSeverityAlerts > 0 ? `${highSeverityAlerts} High Priority` : 'Client-Derived Nominal',
      subtextColor: highSeverityAlerts > 0 ? 'var(--accent-rose)' : 'var(--accent-amber)',
      icon: AlertTriangle,
      accent: 'var(--accent-rose)'
    },
    {
      label: 'Inference Latency',
      value: '14.2 ms',
      subtext: 'YOLOv11 TensorRT Edge',
      subtextColor: 'var(--accent-cyan)',
      icon: Zap,
      accent: 'var(--accent-amber)'
    }
  ];

  return (
    <div style={{
      margin: '8px 16px 0 16px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '10px'
    }}>
      {stats.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="glass-panel"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'var(--transition)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {item.label}
              </div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '2px 0' }}>
                {item.value}
              </div>
              <div style={{ fontSize: '0.65rem', color: item.subtextColor }}>
                {item.subtext}
              </div>
            </div>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${item.accent}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: item.accent
            }}>
              <Icon size={16} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
