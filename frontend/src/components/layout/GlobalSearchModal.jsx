import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Camera, Car, Radio, MapPin, ArrowRight } from 'lucide-react';

export default function GlobalSearchModal({
  isOpen,
  onClose,
  cameras = [],
  vehicles = [],
  observations = [],
  onNavigate
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onNavigate?.({ type: 'open_search' });
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigate]);

  if (!isOpen) return null;

  const cleanQuery = query.trim().toUpperCase();

  // Filter results
  const matchedCameras = cleanQuery
    ? cameras.filter(c =>
        c.camera_id.toUpperCase().includes(cleanQuery) ||
        (c.name && c.name.toUpperCase().includes(cleanQuery)) ||
        (c.location && c.location.toUpperCase().includes(cleanQuery))
      ).slice(0, 4)
    : cameras.slice(0, 3);

  const matchedVehicles = cleanQuery
    ? vehicles.filter(v =>
        (v.plate_number_best_guess && v.plate_number_best_guess.toUpperCase().includes(cleanQuery)) ||
        (v.global_vehicle_id && v.global_vehicle_id.toUpperCase().includes(cleanQuery))
      ).slice(0, 4)
    : vehicles.slice(0, 3);

  const matchedObservations = cleanQuery
    ? observations.filter(o =>
        (o.plate_number && o.plate_number.toUpperCase().includes(cleanQuery)) ||
        o.camera_id.toUpperCase().includes(cleanQuery) ||
        o.id.toString().includes(cleanQuery)
      ).slice(0, 4)
    : observations.slice(0, 3);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '80px 20px 20px 20px'
    }}>
      <div className="glass-panel glass-panel-glow" style={{
        width: '100%',
        maxWidth: '620px',
        background: 'rgba(11, 17, 30, 0.98)',
        border: '1px solid var(--accent-cyan)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 25px rgba(0,242,254,0.2)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <Search size={20} color="var(--accent-cyan)" />
          <input
            ref={inputRef}
            type="text"
            className="font-mono"
            placeholder="Search camera node, plate number, vehicle ID, observation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '1rem',
              letterSpacing: '0.5px'
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="kbd-badge" style={{ marginRight: '8px' }}>ESC</span>
            <X size={18} />
          </button>
        </div>

        {/* Results Body */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cameras Section */}
          {matchedCameras.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={13} color="var(--accent-cyan)" />
                <span>Camera Nodes</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {matchedCameras.map((cam) => (
                  <div
                    key={cam.camera_id}
                    onClick={() => {
                      onNavigate?.({ type: 'camera', item: cam });
                      onClose();
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 242, 254, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  >
                    <div>
                      <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700, marginRight: '8px' }}>
                        {cam.camera_id}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#fff' }}>{cam.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: '8px' }}>
                        ({cam.location || 'Corridor'})
                      </span>
                    </div>
                    <ArrowRight size={14} color="var(--text-dim)" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles Section */}
          {matchedVehicles.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Car size={13} color="var(--accent-blue)" />
                <span>Vehicles & Trajectories</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {matchedVehicles.map((veh) => (
                  <div
                    key={veh.id}
                    onClick={() => {
                      onNavigate?.({ type: 'vehicle', item: veh });
                      onClose();
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(79, 172, 254, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="plate-badge" style={{ fontSize: '0.75rem', padding: '1px 6px' }}>
                        <span className="ind-tag">IND</span>
                        <span>{veh.plate_number_best_guess}</span>
                      </span>
                      <span className="font-mono" style={{ fontSize: '0.74rem', color: 'var(--accent-purple)' }}>
                        {veh.global_vehicle_id || 'ID Pending'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        {veh.vehicle_type}
                      </span>
                    </div>
                    <ArrowRight size={14} color="var(--text-dim)" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations Section */}
          {matchedObservations.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={13} color="var(--accent-emerald)" />
                <span>Recent Observations</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {matchedObservations.map((obs) => (
                  <div
                    key={obs.id}
                    onClick={() => {
                      onNavigate?.({ type: 'observation', item: obs });
                      onClose();
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        #{obs.id}
                      </span>
                      <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontSize: '0.78rem', fontWeight: 700 }}>
                        {obs.camera_id}
                      </span>
                      <span className="font-mono" style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                        {obs.plate_number || 'UNREADABLE'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--accent-emerald)' }}>
                        {(obs.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <ArrowRight size={14} color="var(--text-dim)" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div style={{
          padding: '10px 18px',
          background: 'rgba(7, 10, 17, 0.8)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'var(--text-dim)'
        }}>
          <span>Press <kbd className="kbd-badge">ESC</kbd> to exit</span>
          <span>Click item to navigate directly to workspace</span>
        </div>
      </div>
    </div>
  );
}
