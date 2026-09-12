import React from 'react';
import {
  LayoutDashboard,
  Map,
  Camera,
  Radio,
  ScanLine,
  Navigation2,
  Sparkles,
  BarChart3,
  AlertTriangle,
  FileText,
  HeartPulse,
  Settings
} from 'lucide-react';

export default function Navigation({ activeTab, onSelectTab, counts = {} }) {
  const workspaceGroups = [
    {
      category: 'COMMAND',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard }
      ]
    },
    {
      category: 'MONITORING',
      items: [
        { id: 'gis', label: 'Tactical GIS', icon: Map },
        { id: 'cameras', label: 'Camera Fleet', icon: Camera, count: counts.cameras },
        { id: 'feed', label: 'Live Telemetry', icon: Radio, count: counts.observations, live: true },
        { id: 'anpr', label: 'ANPR', icon: ScanLine }
      ]
    },
    {
      category: 'INTELLIGENCE',
      items: [
        { id: 'tracking', label: 'Vehicle Tracking', icon: Navigation2, count: counts.vehicles },
        { id: 'reid', label: 'Re-ID Intelligence', icon: Sparkles },
        { id: 'analytics', label: 'Traffic Analytics', icon: BarChart3 }
      ]
    },
    {
      category: 'OPS',
      items: [
        { id: 'alerts', label: 'Alerts', icon: AlertTriangle, count: counts.alerts, alert: counts.alerts > 0 }
      ]
    },
    {
      category: 'REPORTING',
      items: [
        { id: 'reports', label: 'Reports', icon: FileText }
      ]
    },
    {
      category: 'SYSTEM',
      items: [
        { id: 'health', label: 'System Health', icon: HeartPulse },
        { id: 'settings', label: 'Settings', icon: Settings }
      ]
    }
  ];

  return (
    <nav style={{
      margin: '8px 16px 0 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      overflowX: 'auto',
      paddingBottom: '4px',
      scrollbarWidth: 'none'
    }}>
      {workspaceGroups.map((group, gIdx) => (
        <div
          key={gIdx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(11, 17, 30, 0.5)',
            padding: '4px 6px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <span style={{
            fontSize: '0.62rem',
            color: 'var(--text-dim)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '0 4px'
          }}>
            {group.category}
          </span>

          {group.items.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 11px',
                  borderRadius: '7px',
                  border: isActive ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(0,242,254,0.18) 0%, rgba(79,172,254,0.1) 100%)'
                    : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 0 12px rgba(0, 242, 254, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>

                {tab.live && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-emerald)',
                    boxShadow: '0 0 6px var(--accent-emerald)'
                  }} />
                )}

                {tab.count !== undefined && (
                  <span style={{
                    fontSize: '0.66rem',
                    padding: '1px 5px',
                    borderRadius: '8px',
                    background: tab.alert
                      ? 'rgba(244, 63, 94, 0.25)'
                      : (isActive ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.08)'),
                    color: tab.alert ? '#fb7185' : (isActive ? '#fff' : 'var(--text-dim)'),
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
