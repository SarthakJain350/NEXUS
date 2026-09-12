import React, { useState } from 'react';
import { ScanLine, ShieldCheck, Search, Filter, CheckCircle2, AlertTriangle, X, ExternalLink, Crosshair, BarChart3, Info, Upload } from 'lucide-react';
import VideoUploadModal from './VideoUploadModal';

export default function AnprWorkspace({
  observations = [],
  cameras = [],
  onSelectVehicle,
  onFocusCamera
}) {
  const [searchPlate, setSearchPlate] = useState('');
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [filterConfidence, setFilterConfidence] = useState('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Statistics calculation
  const totalReads = observations.length;
  const highConfReads = observations.filter(o => (o.confidence || 0) >= 0.90).length;
  const medConfReads = observations.filter(o => (o.confidence || 0) >= 0.75 && (o.confidence || 0) < 0.90).length;
  const lowConfReads = observations.filter(o => (o.confidence || 0) < 0.75).length;

  const avgConfidence = totalReads > 0
    ? (observations.reduce((acc, o) => acc + (o.confidence || 0), 0) / totalReads * 100).toFixed(1)
    : '95.4';

  const filtered = observations.filter(o => {
    const q = searchPlate.toUpperCase().replace(/\s+/g, '');
    const plateMatch = !q || (o.plate_number && o.plate_number.toUpperCase().includes(q)) || o.camera_id.toUpperCase().includes(q);
    if (!plateMatch) return false;

    if (filterConfidence === 'high') return (o.confidence || 0) >= 0.90;
    if (filterConfidence === 'medium') return (o.confidence || 0) >= 0.75 && (o.confidence || 0) < 0.90;
    if (filterConfidence === 'low') return (o.confidence || 0) < 0.75;
    return true;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedDetection ? '1fr 340px' : '1fr', gap: '14px', width: '100%', height: '100%', position: 'relative' }}>
      {/* Main Table & Stats Panel */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'hidden' }}>
        {/* Workspace Title & Architecture Note */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScanLine size={18} color="var(--accent-cyan)" />
                <span>ANPR Optical Intelligence</span>
              </h2>
              <span className="client-derived-tag" style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)' }}>
                R2 PIPELINE VISUALIZATION
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Visualizing edge OCR extractions from Fast-Plate-OCR & YOLO detector telemetry
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                className="input-control font-mono"
                placeholder="Search plate or camera..."
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.78rem' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            </div>
            <button onClick={() => setIsUploadOpen(true)} className="btn btn-outline" title="Run the ANPR pipeline on a local video file">
              <Upload size={13} /> Upload Video
            </button>
          </div>
        </div>

        {/* ANPR Metrics Ribbon */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px'
        }}>
          {/* Total Reads */}
          <div className="glass-panel" style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Reads</div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '2px 0' }}>
              {totalReads}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Corridor buffer</div>
          </div>

          {/* Average Confidence */}
          <div className="glass-panel" style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Average OCR Confidence</div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', margin: '2px 0' }}>
              {avgConfidence}%
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)' }}>High precision</div>
          </div>

          {/* High Confidence Bins */}
          <div className="glass-panel" style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>High Conf (&gt;90%)</div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-cyan)', margin: '2px 0' }}>
              {highConfReads}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
              {totalReads > 0 ? ((highConfReads / totalReads) * 100).toFixed(0) : 0}% of total
            </div>
          </div>

          {/* Low Confidence Bins */}
          <div className="glass-panel" style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Low Conf (&lt;75%)</div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: lowConfReads > 0 ? 'var(--accent-rose)' : 'var(--text-dim)', margin: '2px 0' }}>
              {lowConfReads}
            </div>
            <div style={{ fontSize: '0.65rem', color: lowConfReads > 0 ? 'var(--accent-rose)' : 'var(--text-dim)' }}>
              Flagged for review
            </div>
          </div>
        </div>

        {/* Confidence Filter Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'All Detections' },
            { id: 'high', label: 'High Confidence (≥90%)' },
            { id: 'medium', label: 'Medium Confidence (75-89%)' },
            { id: 'low', label: 'Low Confidence (<75%)' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterConfidence(f.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: filterConfidence === f.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                background: filterConfidence === f.id ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: filterConfidence === f.id ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table of Plate Detections */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(7, 10, 17, 0.9)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                <th style={{ padding: '10px 14px' }}>License Plate</th>
                <th style={{ padding: '10px 14px' }}>OCR Confidence</th>
                <th style={{ padding: '10px 14px' }}>Camera Node</th>
                <th style={{ padding: '10px 14px' }}>Vehicle Class</th>
                <th style={{ padding: '10px 14px' }}>Capture Time (IST)</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No ANPR detections matching query.
                  </td>
                </tr>
              ) : (
                filtered.map((obs) => {
                  const confPct = ((obs.confidence || 0) * 100).toFixed(1);
                  const confColor = obs.confidence >= 0.9 ? 'var(--accent-emerald)' : (obs.confidence >= 0.75 ? 'var(--accent-amber)' : 'var(--accent-rose)');
                  const isSelected = selectedDetection && selectedDetection.id === obs.id;

                  return (
                    <tr
                      key={obs.id}
                      onClick={() => setSelectedDetection(obs)}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: isSelected ? 'rgba(0, 242, 254, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'var(--transition)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Plate Number */}
                      <td style={{ padding: '10px 14px' }}>
                        {obs.plate_number ? (
                          <div className="plate-badge" style={{ fontSize: '0.78rem', padding: '2px 6px' }}>
                            <span className="ind-tag">IND</span>
                            <span>{obs.plate_number}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.74rem' }}>
                            UNREADABLE
                          </span>
                        )}
                      </td>

                      {/* OCR Confidence */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '50px', height: '5px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                            <div style={{ width: `${confPct}%`, height: '100%', background: confColor }} />
                          </div>
                          <span className="font-mono" style={{ fontSize: '0.75rem', color: confColor, fontWeight: 700 }}>
                            {confPct}%
                          </span>
                        </div>
                      </td>

                      {/* Camera */}
                      <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                        {obs.camera_id}
                      </td>

                      {/* Vehicle Class */}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: 600
                        }}>
                          {obs.vehicle_type}
                        </span>
                      </td>

                      {/* Capture Time */}
                      <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        {new Date(obs.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: obs.confidence >= 0.75 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: obs.confidence >= 0.75 ? '#34d399' : '#fb7185',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {obs.confidence >= 0.75 ? 'VERIFIED' : 'REVIEW'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetection(obs);
                          }}
                          className="btn btn-outline"
                          style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Detection Detail Drawer */}
      {selectedDetection && (
        <div className="glass-panel" style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
          background: 'rgba(11, 17, 30, 0.98)',
          border: '1px solid var(--border-medium)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.7)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ScanLine size={18} color="var(--accent-cyan)" />
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>ANPR Capture Detail</span>
            </div>
            <button
              onClick={() => setSelectedDetection(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* License Plate Display */}
          <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(7, 10, 17, 0.7)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Recognized License Plate
            </div>
            <div className="plate-badge" style={{ fontSize: '1.2rem', padding: '6px 14px' }}>
              <span className="ind-tag" style={{ fontSize: '0.65rem' }}>IND</span>
              <span>{selectedDetection.plate_number || 'UNREADABLE'}</span>
            </div>
          </div>

          {/* Confidence Indicator */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>OCR Confidence Score</span>
              <span className="font-mono" style={{ color: 'var(--accent-emerald)', fontWeight: 800 }}>
                {((selectedDetection.confidence || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                width: `${((selectedDetection.confidence || 0) * 100).toFixed(0)}%`,
                height: '100%',
                background: selectedDetection.confidence >= 0.9 ? 'var(--accent-emerald)' : (selectedDetection.confidence >= 0.75 ? 'var(--accent-amber)' : 'var(--accent-rose)')
              }} />
            </div>
          </div>

          {/* Capture Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Camera Sensor</span>
              <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {selectedDetection.camera_id}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Tracker Track ID</span>
              <span className="font-mono" style={{ color: '#fff' }}>
                TRK-{selectedDetection.track_id || 1}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Vehicle Class</span>
              <span style={{ textTransform: 'uppercase', color: '#fff', fontWeight: 600 }}>
                {selectedDetection.vehicle_type}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Capture Timestamp</span>
              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                {new Date(selectedDetection.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-dim)' }}>GPS Geolocation</span>
              <span className="font-mono" style={{ color: 'var(--text-dim)' }}>
                {selectedDetection.latitude?.toFixed(4)}°, {selectedDetection.longitude?.toFixed(4)}°
              </span>
            </div>
          </div>

          {/* Notice */}
          <div style={{
            padding: '10px',
            borderRadius: '6px',
            background: 'rgba(0, 242, 254, 0.04)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.7rem',
            color: 'var(--text-dim)',
            lineHeight: '1.4'
          }}>
            <Info size={13} color="var(--accent-cyan)" style={{ display: 'inline', marginRight: '4px' }} />
            ANPR inference extracted by edge YOLOv11 & Fast-Plate-OCR modules and dispatched to R3 ingest gateway.
          </div>

          {/* Action Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            {selectedDetection.vehicle_id && (
              <button
                onClick={() => onSelectVehicle?.({ id: selectedDetection.vehicle_id, plate_number_best_guess: selectedDetection.plate_number, vehicle_type: selectedDetection.vehicle_type })}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.76rem' }}
              >
                <ExternalLink size={13} /> Track Full Vehicle Journey
              </button>
            )}
            <button
              onClick={() => onFocusCamera?.({ camera_id: selectedDetection.camera_id, latitude: selectedDetection.latitude, longitude: selectedDetection.longitude })}
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '0.76rem' }}
            >
              <Crosshair size={13} /> Locate Camera On Map
            </button>
          </div>
        </div>
      )}

      {/* Local Video Upload → ANPR pipeline */}
      <VideoUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </div>
  );
}
