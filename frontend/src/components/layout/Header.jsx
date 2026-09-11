import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, Clock, Cpu, RefreshCw, AlertCircle } from 'lucide-react';

export default function Header({ backendHealth, isSimulated, onToggleSimulation, onRefresh }) {
  const [istTime, setIstTime] = useState('');
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setIstTime(now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST');
      setUtcTime(now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-panel" style={{
      margin: '12px 16px 0 16px',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Brand & System Code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(79,172,254,0.1) 100%)',
          border: '1px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-cyan)',
          boxShadow: '0 0 15px rgba(0,242,254,0.25)'
        }}>
          <Shield size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '1px', color: '#fff' }}>
              NEXUS <span style={{ color: 'var(--accent-cyan)', fontWeight: 400 }}>// COMMAND CENTER</span>
            </h1>
            <span style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(0,242,254,0.1)',
              border: '1px solid rgba(0,242,254,0.3)',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600
            }}>R4 SURVEILLANCE</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Autonomous Multi-Camera ANPR & GIS Vehicle Trajectory Fusion
          </p>
        </div>
      </div>

      {/* Center Clocks (IST / UTC) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'rgba(7, 10, 17, 0.6)',
        padding: '6px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Capture Base:</span>
          <span className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{istTime}</span>
        </div>
        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>UTC Sync:</span>
          <span className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{utcTime}</span>
        </div>
      </div>

      {/* Backend Status & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Connection Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '8px',
          background: isSimulated ? 'rgba(245, 158, 11, 0.12)' : (backendHealth.online ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)'),
          border: `1px solid ${isSimulated ? 'rgba(245, 158, 11, 0.35)' : (backendHealth.online ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)')}`
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isSimulated ? 'var(--accent-amber)' : (backendHealth.online ? 'var(--accent-emerald)' : 'var(--accent-rose)'),
            boxShadow: `0 0 8px ${isSimulated ? 'var(--accent-amber)' : (backendHealth.online ? 'var(--accent-emerald)' : 'var(--accent-rose)')}`
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: isSimulated ? '#fbbf24' : (backendHealth.online ? '#34d399' : '#fb7185') }}>
              {isSimulated ? 'SIMULATION MODE' : (backendHealth.online ? 'FASTAPI R3 ONLINE' : 'BACKEND OFFLINE')}
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>
              {isSimulated ? 'Corridor Simulation Active' : (backendHealth.online ? `PostgreSQL: ${backendHealth.database}` : 'Serving tactical cached telemetry')}
            </span>
          </div>
        </div>

        {/* Toggle Simulation Button */}
        <button 
          onClick={onToggleSimulation} 
          className="btn btn-outline" 
          title="Toggle between Live API and Simulation Sandbox"
          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
        >
          <Cpu size={14} />
          {isSimulated ? 'Switch to Live API' : 'Sandbox Demo'}
        </button>

        {/* Refresh button */}
        <button 
          onClick={onRefresh} 
          className="btn btn-outline"
          title="Reload fresh telemetry"
          style={{ padding: '6px 10px' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </header>
  );
}
