import React from 'react';
import { Map, Navigation2, Camera, Radio, BarChart3 } from 'lucide-react';

export default function Navigation({ activeTab, onSelectTab, counts = {} }) {
  const tabs = [
    { id: 'gis', label: 'Tactical GIS Map', icon: Map },
    { id: 'tracking', label: 'Trajectory Tracking', icon: Navigation2, count: counts.vehicles },
    { id: 'cameras', label: 'Camera Network', icon: Camera, count: counts.cameras },
    { id: 'feed', label: 'Live Telemetry Feed', icon: Radio, count: counts.observations, live: true },
    { id: 'analytics', label: 'Traffic Analytics', icon: BarChart3 }
  ];

  return (
    <nav style={{
      margin: '10px 16px 0 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      overflowX: 'auto',
      paddingBottom: '4px'
    }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: '8px',
              border: isActive ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              background: isActive ? 'linear-gradient(135deg, rgba(0,242,254,0.15) 0%, rgba(79,172,254,0.08) 100%)' : 'rgba(14, 23, 41, 0.4)',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.84rem',
              cursor: 'pointer',
              transition: 'var(--transition)',
              whiteSpace: 'nowrap',
              boxShadow: isActive ? '0 0 15px rgba(0, 242, 254, 0.15)' : 'none'
            }}
          >
            <Icon size={16} />
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
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '10px',
                background: isActive ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                color: isActive ? '#fff' : 'var(--text-dim)',
                fontFamily: 'var(--font-mono)'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
