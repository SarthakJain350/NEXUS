import React, { useState } from 'react';
import { Settings, Sliders, Globe, Database, Map, AlertTriangle, ShieldCheck, Check } from 'lucide-react';

export default function SettingsWorkspace({
  isSimulated = false,
  onToggleSimulation,
  backendHealth = {}
}) {
  const [systemName, setSystemName] = useState('NEXUS City Intelligence Center');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [pollingInterval, setPollingInterval] = useState('12');
  const [mapLayers, setMapLayers] = useState({
    cameras: true,
    vehicles: true,
    alerts: true,
    journeys: true,
    coverage: true
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} color="var(--accent-cyan)" />
              <span>Command Center Configuration & Preferences</span>
            </h2>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Local interface preferences, map display toggles, and telemetry parameters
          </p>
        </div>

        {savedSuccess && (
          <div style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Check size={14} />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* General Section */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={15} color="var(--accent-cyan)" />
            <span>GENERAL PREFERENCES</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Command Center Title
              </label>
              <input
                type="text"
                className="input-control"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Reference Timezone
              </label>
              <select
                className="input-control"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{ background: '#0b111e' }}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30) [Primary Base]</option>
                <option value="UTC">UTC (+00:00) [Telemetry Sync]</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data & Telemetry Section */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={15} color="var(--accent-emerald)" />
            <span>DATA & TELEMETRY STREAM</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Polling Frequency
              </label>
              <select
                className="input-control"
                value={pollingInterval}
                onChange={(e) => setPollingInterval(e.target.value)}
                style={{ background: '#0b111e' }}
              >
                <option value="5">5 Seconds (High Density)</option>
                <option value="12">12 Seconds (Recommended Nominal)</option>
                <option value="30">30 Seconds (Low Bandwidth)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Simulation Sandbox Mode
              </label>
              <button
                type="button"
                onClick={onToggleSimulation}
                className={isSimulated ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem' }}
              >
                {isSimulated ? 'Simulation Active (Switch to Live API)' : 'Live API Active (Switch to Simulation)'}
              </button>
            </div>
          </div>
        </div>

        {/* Map Layer Defaults */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Map size={15} color="var(--accent-cyan)" />
            <span>MAP LAYER DEFAULT VISIBILITY</span>
          </h3>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {Object.keys(mapLayers).map((key) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mapLayers[key]}
                  onChange={(e) => setMapLayers({ ...mapLayers, [key]: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                <span style={{ textTransform: 'capitalize' }}>{key}</span>
              </label>
            ))}
          </div>
        </div>

        {/* System & Security (No Secrets Exposing) */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={15} color="var(--accent-purple)" />
            <span>BACKEND GATEWAY & INTEGRITY</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <div>
              Gateway Base URL: <code className="font-mono" style={{ color: 'var(--accent-cyan)' }}>/api/v1</code>
            </div>
            <div>
              Backend Health: <b style={{ color: backendHealth.online ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{backendHealth.online ? 'ONLINE' : 'FALLBACK MODE'}</b>
            </div>
            <div>
              PostgreSQL Storage: <b style={{ color: backendHealth.database === 'connected' ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{backendHealth.database || 'UNAVAILABLE'}</b>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Security protocol: No API credentials or environment secrets are exposed to client script bundles.
            </div>
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.82rem' }}>
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
