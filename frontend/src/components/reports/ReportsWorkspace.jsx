import React, { useState } from 'react';
import { FileText, Download, Filter, Camera, Car, Radio, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ReportsWorkspace({
  observations = [],
  cameras = [],
  vehicles = [],
  alerts = []
}) {
  const [reportType, setReportType] = useState('anpr');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [plateQuery, setPlateQuery] = useState('');

  // Prepare data rows based on report type
  let reportData = [];
  let reportColumns = [];

  if (reportType === 'anpr') {
    reportColumns = ['ID', 'Plate', 'Camera', 'Class', 'Confidence', 'Timestamp'];
    reportData = observations
      .filter(o => cameraFilter === 'all' || o.camera_id === cameraFilter)
      .filter(o => !plateQuery || (o.plate_number && o.plate_number.toUpperCase().includes(plateQuery.toUpperCase())))
      .map(o => ({
        ID: o.id,
        Plate: o.plate_number || 'UNREADABLE',
        Camera: o.camera_id,
        Class: o.vehicle_type,
        Confidence: `${((o.confidence || 0) * 100).toFixed(1)}%`,
        Timestamp: o.timestamp
      }));
  } else if (reportType === 'traffic') {
    reportColumns = ['CameraID', 'CameraName', 'Location', 'Status', 'ObservationCount'];
    reportData = cameras
      .filter(c => cameraFilter === 'all' || c.camera_id === cameraFilter)
      .map(c => ({
        CameraID: c.camera_id,
        CameraName: c.name,
        Location: c.location,
        Status: c.status,
        ObservationCount: c.observation_count || 0
      }));
  } else if (reportType === 'vehicle') {
    reportColumns = ['VehicleID', 'GlobalID', 'PlateNumber', 'Class', 'Observations'];
    reportData = vehicles
      .filter(v => !plateQuery || (v.plate_number_best_guess && v.plate_number_best_guess.toUpperCase().includes(plateQuery.toUpperCase())))
      .map(v => ({
        VehicleID: v.id,
        GlobalID: v.global_vehicle_id || 'PENDING',
        PlateNumber: v.plate_number_best_guess,
        Class: v.vehicle_type,
        Observations: v.observation_count || 0
      }));
  } else if (reportType === 'camera') {
    reportColumns = ['CameraID', 'Name', 'Location', 'GPS', 'Status', 'LastSeen'];
    reportData = cameras
      .filter(c => cameraFilter === 'all' || c.camera_id === cameraFilter)
      .map(c => ({
        CameraID: c.camera_id,
        Name: c.name,
        Location: c.location,
        GPS: `${c.latitude?.toFixed(4)}, ${c.longitude?.toFixed(4)}`,
        Status: c.status,
        LastSeen: c.last_seen_at || 'Never'
      }));
  } else if (reportType === 'alerts') {
    reportColumns = ['AlertID', 'Severity', 'Type', 'Message', 'Camera', 'Target', 'Status'];
    reportData = alerts
      .filter(a => cameraFilter === 'all' || a.camera === cameraFilter)
      .map(a => ({
        AlertID: a.id,
        Severity: a.severity,
        Type: a.type,
        Message: a.message,
        Camera: a.camera,
        Target: a.vehicle,
        Status: a.status
      }));
  }

  // Export handlers
  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const headers = reportColumns.join(',');
    const rows = reportData.map(row =>
      reportColumns.map(col => `"${(row[col] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NEXUS_${reportType.toUpperCase()}_REPORT_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (reportData.length === 0) return;
    const jsonStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NEXUS_${reportType.toUpperCase()}_REPORT_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {/* Header & Export Triggers */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--accent-cyan)" />
              <span>Surveillance Audit & Export Reports</span>
            </h2>
            <span className="client-derived-tag" style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)' }}>
              CLIENT TELEMETRY EXPORT
            </span>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Compile and export structured operational reports from synchronized frontend telemetry
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExportCSV} className="btn btn-outline" style={{ padding: '7px 14px', fontSize: '0.78rem' }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={handleExportJSON} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.78rem' }}>
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { id: 'anpr', label: 'ANPR Log Report' },
          { id: 'traffic', label: 'Traffic Density Report' },
          { id: 'vehicle', label: 'Vehicle Movement Report' },
          { id: 'camera', label: 'Camera Health Audit' },
          { id: 'alerts', label: 'Alert Digest' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: reportType === t.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              background: reportType === t.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: reportType === t.id ? 'var(--accent-cyan)' : 'var(--text-muted)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        background: 'rgba(11, 17, 30, 0.6)',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ minWidth: '180px' }}>
          <select
            className="input-control font-mono"
            value={cameraFilter}
            onChange={(e) => setCameraFilter(e.target.value)}
            style={{ fontSize: '0.78rem', background: '#0b111e' }}
          >
            <option value="all">All Cameras ({cameras.length})</option>
            {cameras.map(c => (
              <option key={c.camera_id} value={c.camera_id}>
                {c.camera_id} — {c.name || 'Sensor'}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: '200px' }}>
          <input
            type="text"
            className="input-control font-mono"
            placeholder="Filter plate number..."
            value={plateQuery}
            onChange={(e) => setPlateQuery(e.target.value)}
            style={{ fontSize: '0.78rem' }}
          />
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          Record Count: <b style={{ color: '#fff' }}>{reportData.length}</b> rows
        </div>
      </div>

      {/* Table Preview */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(7, 10, 17, 0.9)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.68rem' }}>
              {reportColumns.map(col => (
                <th key={col} style={{ padding: '10px 14px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportData.length === 0 ? (
              <tr>
                <td colSpan={reportColumns.length} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No records matching the filter criteria in current buffer.
                </td>
              </tr>
            ) : (
              reportData.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {reportColumns.map(col => (
                    <td key={col} style={{ padding: '10px 14px' }}>
                      {col.toLowerCase().includes('plate') && row[col] !== 'UNREADABLE' ? (
                        <div className="plate-badge" style={{ fontSize: '0.74rem', padding: '1px 5px' }}>
                          <span className="ind-tag">IND</span>
                          <span>{row[col]}</span>
                        </div>
                      ) : (
                        <span className={col.toLowerCase().includes('id') || col.toLowerCase().includes('time') ? 'font-mono' : ''} style={{ color: col.toLowerCase().includes('camera') ? 'var(--accent-cyan)' : 'var(--text-main)', fontSize: '0.76rem' }}>
                          {row[col] ?? 'N/A'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
