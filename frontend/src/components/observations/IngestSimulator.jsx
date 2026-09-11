import React, { useState } from 'react';
import { X, Send, Radio, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function IngestSimulator({ cameras = [], isOpen, onClose, onIngest }) {
  const [formData, setFormData] = useState({
    camera_id: cameras[0]?.camera_id || 'CAM_01',
    plate_number: 'MH12AB1234',
    vehicle_type: 'car',
    confidence: '0.96',
    track_id: '42'
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCameraChange = (camId) => {
    setFormData({ ...formData, camera_id: camId });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg('');

    const targetCamera = cameras.find(c => c.camera_id === formData.camera_id) || {
      latitude: 19.0368,
      longitude: 72.8172
    };

    const payload = {
      camera_id: formData.camera_id,
      track_id: parseInt(formData.track_id, 10) || 1,
      plate_number: formData.plate_number.trim() || null,
      timestamp: new Date().toISOString(),
      vehicle_type: formData.vehicle_type,
      confidence: parseFloat(formData.confidence) || 0.9,
      latitude: targetCamera.latitude || 19.0368,
      longitude: targetCamera.longitude || 72.8172,
      ingest_id: `ui-sim-${Date.now()}`
    };

    try {
      await onIngest(payload);
      setStatusMsg('Observation ingested successfully!');
      setTimeout(() => {
        onClose();
        setStatusMsg('');
      }, 900);
    } catch (err) {
      setStatusMsg(`Ingest failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '24px',
        background: 'rgba(11, 17, 30, 0.95)',
        border: '1px solid var(--border-medium)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--accent-cyan)' }}>
              <Radio size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Simulate Telemetry Ingestion</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Trigger real-time ANPR observation into R3 pipeline</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {statusMsg && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: statusMsg.includes('failed') ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${statusMsg.includes('failed') ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            color: statusMsg.includes('failed') ? '#fb7185' : '#34d399',
            fontSize: '0.78rem',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {statusMsg.includes('failed') ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{statusMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Camera Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Originating Camera Sensor
            </label>
            <select
              className="input-control"
              value={formData.camera_id}
              onChange={(e) => handleCameraChange(e.target.value)}
              style={{ background: '#0b111e', cursor: 'pointer' }}
            >
              {cameras.map((c) => (
                <option key={c.camera_id} value={c.camera_id}>
                  {c.camera_id} — {c.name || 'Unnamed'} ({c.location || 'Corridor'})
                </option>
              ))}
            </select>
          </div>

          {/* License Plate Number */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Detected License Plate (Indian Standard)
            </label>
            <input
              type="text"
              className="input-control font-mono"
              value={formData.plate_number}
              onChange={(e) => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
              placeholder="e.g. MH12AB1234"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Vehicle Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Vehicle Class
              </label>
              <select
                className="input-control"
                value={formData.vehicle_type}
                onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                style={{ background: '#0b111e' }}
              >
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="truck">Truck</option>
                <option value="bus">Bus</option>
                <option value="auto">Auto Rickshaw</option>
              </select>
            </div>

            {/* Confidence */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                OCR Confidence (0.0 - 1.0)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="1.0"
                className="input-control font-mono"
                value={formData.confidence}
                onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Track ID */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Local Tracker ID
            </label>
            <input
              type="number"
              className="input-control font-mono"
              value={formData.track_id}
              onChange={(e) => setFormData({ ...formData, track_id: e.target.value })}
              required
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 1 }}>
              <Send size={14} />
              {isSubmitting ? 'Ingesting...' : 'Emit Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
