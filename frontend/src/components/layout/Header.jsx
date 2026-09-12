import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, Clock, Cpu, RefreshCw, AlertTriangle, Search, Bot } from 'lucide-react';

export default function Header({
  backendHealth,
  isSimulated,
  onToggleSimulation,
  onRefresh,
  alertCount = 0,
  onOpenSearch,
  onOpenCopilot
}) {
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
      margin: '10px 16px 0 16px',
      padding: '10px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Brand & System Code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '9px',
          background: 'linear-gradient(135deg, rgba(0,242,254,0.25) 0%, rgba(79,172,254,0.1) 100%)',
          border: '1px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-cyan)',
          boxShadow: '0 0 15px rgba(0,242,254,0.25)'
        }}>
          <Shield size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px', color: '#fff', margin: 0 }}>
              NEXUS <span style={{ color: 'var(--accent-cyan)', fontWeight: 400 }}>// COMMAND CENTER</span>
            </h1>
            <span style={{
              fontSize: '0.62rem',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(0,242,254,0.12)',
              border: '1px solid rgba(0,242,254,0.35)',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700
            }}>CITY INTELLIGENCE</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
            Autonomous Multi-Camera ANPR & GIS Vehicle Trajectory Fusion
          </p>
        </div>
      </div>

      {/* Center Clocks & Global Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Global Search Quick Button */}
        <button
          onClick={onOpenSearch}
          className="btn btn-outline"
          title="Search cameras, vehicles, plates (Ctrl+K)"
          style={{
            padding: '6px 14px',
            fontSize: '0.75rem',
            background: 'rgba(11, 17, 30, 0.7)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Search size={13} color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-dim)' }}>Global Lookup...</span>
          <kbd className="kbd-badge" style={{ fontSize: '0.62rem' }}>Ctrl K</kbd>
        </button>

        {/* Center Clocks (IST / UTC) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(7, 10, 17, 0.7)',
          padding: '5px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Capture:</span>
            <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>{istTime}</span>
          </div>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>UTC:</span>
            <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{utcTime}</span>
          </div>
        </div>
      </div>

      {/* Backend Status, AI Copilot & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Connection Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 10px',
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
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: isSimulated ? '#fbbf24' : (backendHealth.online ? '#34d399' : '#fb7185') }}>
              {isSimulated ? '● TACTICAL SIMULATION' : (backendHealth.online ? '● LIVE TELEMETRY' : '● BACKEND OFFLINE')}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>
              {isSimulated ? 'Corridor Sandbox Data' : (backendHealth.online ? `PostgreSQL: ${backendHealth.database}` : 'Serving tactical cached telemetry')}
            </span>
          </div>
        </div>

        {/* AI Copilot Trigger */}
        <button
          onClick={onOpenCopilot}
          className="btn btn-outline"
          title="Open NEXUS AI Copilot"
          style={{
            padding: '6px 10px',
            background: 'linear-gradient(135deg, rgba(0,242,254,0.1) 0%, rgba(168,85,247,0.1) 100%)',
            borderColor: 'var(--border-medium)',
            color: 'var(--accent-cyan)'
          }}
        >
          <Bot size={15} />
          <span style={{ fontSize: '0.74rem' }}>AI Copilot</span>
        </button>

        {/* Toggle Simulation Button */}
        <button 
          onClick={onToggleSimulation} 
          className="btn btn-outline" 
          title="Toggle between Live API and Tactical Sandbox"
          style={{ padding: '6px 10px', fontSize: '0.74rem' }}
        >
          <Cpu size={13} />
          {isSimulated ? 'Live API' : 'Sandbox'}
        </button>

        {/* Refresh button */}
        <button 
          onClick={onRefresh} 
          className="btn btn-outline"
          title="Reload fresh telemetry"
          style={{ padding: '6px 9px' }}
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </header>
  );
}
