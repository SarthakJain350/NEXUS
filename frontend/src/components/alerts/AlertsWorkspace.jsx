import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, CheckCircle2, Clock, Filter, Eye, Crosshair, ExternalLink, Info } from 'lucide-react';

export default function AlertsWorkspace({
  alerts = [],
  onUpdateAlertStatus,
  onFocusCamera,
  onSelectVehicle,
  onNavigateTab
}) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const medCount = alerts.filter(a => a.severity === 'MEDIUM').length;
  const lowCount = alerts.filter(a => a.severity === 'LOW').length;

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="var(--accent-amber)" />
              <span>Operational Alert Engine</span>
            </h2>
            <span className="client-derived-tag" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.35)' }}>
              CLIENT-DERIVED INTELLIGENCE
            </span>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Real-time anomaly triggers evaluated over client telemetry buffer (low confidence, excessive repetition, congestion)
          </p>
        </div>

        {/* Severity Summary Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>TOTAL:</span>
            <span className="font-mono" style={{ fontWeight: 800, color: '#fff' }}>{alerts.length}</span>
          </div>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className="severity-pill HIGH" style={{ padding: '1px 5px', fontSize: '0.62rem' }}>HIGH</span>
            <span className="font-mono" style={{ fontWeight: 800, color: '#fb7185' }}>{highCount}</span>
          </div>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className="severity-pill MEDIUM" style={{ padding: '1px 5px', fontSize: '0.62rem' }}>MED</span>
            <span className="font-mono" style={{ fontWeight: 800, color: '#fbbf24' }}>{medCount}</span>
          </div>
          <div className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className="severity-pill LOW" style={{ padding: '1px 5px', fontSize: '0.62rem' }}>LOW</span>
            <span className="font-mono" style={{ fontWeight: 800, color: '#60a5fa' }}>{lowCount}</span>
          </div>
        </div>
      </div>

      {/* Technical Honesty Note */}
      <div style={{
        padding: '10px 14px',
        borderRadius: '8px',
        background: 'rgba(245, 158, 11, 0.04)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.72rem',
        color: 'var(--text-muted)'
      }}>
        <Info size={15} color="var(--accent-amber)" style={{ flexShrink: 0 }} />
        <span>
          Alerts are synthesized on the frontend from live observations according to heuristic rules. The system does not pretend alerts are persisted to an invented backend endpoint.
        </span>
      </div>

      {/* Filter Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '10px'
      }}>
        {/* Severity Filters */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'All Severities' },
            { id: 'HIGH', label: 'High' },
            { id: 'MEDIUM', label: 'Medium' },
            { id: 'LOW', label: 'Low' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSeverityFilter(f.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: severityFilter === f.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                background: severityFilter === f.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: severityFilter === f.id ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'All States' },
            { id: 'new', label: 'New' },
            { id: 'acknowledged', label: 'Acknowledged' },
            { id: 'resolved', label: 'Resolved' }
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: statusFilter === s.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                background: statusFilter === s.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: statusFilter === s.id ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Table / List */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(7, 10, 17, 0.9)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.68rem' }}>
              <th style={{ padding: '10px 14px' }}>Alert ID</th>
              <th style={{ padding: '10px 14px' }}>Severity</th>
              <th style={{ padding: '10px 14px' }}>Type</th>
              <th style={{ padding: '10px 14px' }}>Message</th>
              <th style={{ padding: '10px 14px' }}>Camera</th>
              <th style={{ padding: '10px 14px' }}>Target / Vehicle</th>
              <th style={{ padding: '10px 14px' }}>Triggered Time</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No active operational alerts matching criteria.
                </td>
              </tr>
            ) : (
              filtered.map((alert) => (
                <tr
                  key={alert.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                    {alert.id}
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <span className={`severity-pill ${alert.severity}`} style={{ fontSize: '0.64rem' }}>
                      {alert.severity}
                    </span>
                  </td>

                  <td style={{ padding: '10px 14px', fontSize: '0.74rem', color: '#fff', fontWeight: 600 }}>
                    {alert.type}
                  </td>

                  <td style={{ padding: '10px 14px', fontSize: '0.76rem', color: 'var(--text-main)', maxWidth: '280px' }}>
                    {alert.message}
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {alert.camera}
                    </span>
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    {alert.plate_number ? (
                      <div className="plate-badge" style={{ fontSize: '0.74rem', padding: '1px 5px' }}>
                        <span className="ind-tag">IND</span>
                        <span>{alert.plate_number}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{alert.vehicle}</span>
                    )}
                  </td>

                  <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {new Date(alert.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: alert.status === 'resolved'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : (alert.status === 'acknowledged' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)'),
                      color: alert.status === 'resolved' ? '#34d399' : (alert.status === 'acknowledged' ? '#fbbf24' : '#fb7185'),
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {alert.status}
                    </span>
                  </td>

                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {alert.status === 'new' && (
                        <button
                          onClick={() => onUpdateAlertStatus?.(alert.id, 'acknowledged')}
                          className="btn btn-outline"
                          style={{ padding: '3px 8px', fontSize: '0.68rem' }}
                        >
                          Ack
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          onClick={() => onUpdateAlertStatus?.(alert.id, 'resolved')}
                          className="btn btn-outline"
                          style={{ padding: '3px 8px', fontSize: '0.68rem', color: 'var(--accent-emerald)' }}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
