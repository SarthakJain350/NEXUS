import React, { useState, useEffect } from 'react';
import { X, Save, Camera, MapPin, AlertCircle } from 'lucide-react';

export default function CameraEditModal({ camera, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    location: '',
    status: 'active'
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (camera) {
      setFormData({
        name: camera.name || '',
        latitude: camera.latitude !== undefined && camera.latitude !== null ? camera.latitude.toString() : '',
        longitude: camera.longitude !== undefined && camera.longitude !== null ? camera.longitude.toString() : '',
        location: camera.location || '',
        status: camera.status || 'active'
      });
      setError('');
    }
  }, [camera]);

  if (!isOpen || !camera) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError('Latitude must be a valid number between -90 and 90');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setError('Longitude must be a valid number between -180 and 180');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim() || null,
        latitude: lat,
        longitude: lng,
        location: formData.location.trim() || null,
        status: formData.status
      };
      await onSave(camera.camera_id, payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update camera');
    } finally {
      setSaving(false);
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
        maxWidth: '460px',
        padding: '24px',
        background: 'rgba(11, 17, 30, 0.95)',
        border: '1px solid var(--border-medium)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--accent-cyan)' }}>
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Configure Camera Node</h3>
              <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{camera.camera_id}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            fontSize: '0.78rem',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Camera / Sensor Name
            </label>
            <input
              type="text"
              className="input-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Bandra Toll Plaza Gate 01"
              required
            />
          </div>

          {/* Location Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Corridor / Physical Location
            </label>
            <input
              type="text"
              className="input-control"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Bandra West, Mumbai"
            />
          </div>

          {/* Lat / Long Coordinates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Latitude (°N)
              </label>
              <input
                type="number"
                step="any"
                className="input-control font-mono"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="19.0368"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Longitude (°E)
              </label>
              <input
                type="number"
                step="any"
                className="input-control font-mono"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="72.8172"
                required
              />
            </div>
          </div>

          {/* Status Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Operational Status
            </label>
            <select
              className="input-control"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              style={{ background: '#0b111e', cursor: 'pointer' }}
            >
              <option value="active">Active (Online & Streaming)</option>
              <option value="unregistered">Unregistered (Awaiting Verification)</option>
              <option value="maintenance">Maintenance (Offline Service)</option>
              <option value="inactive">Inactive (Decommissioned)</option>
            </select>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              <Save size={14} />
              {saving ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
