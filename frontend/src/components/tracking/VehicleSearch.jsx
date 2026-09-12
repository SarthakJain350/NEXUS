import React, { useState } from 'react';
import { Search, Car, Truck, Bus, Bike, Navigation, Filter, CheckCircle2 } from 'lucide-react';

export default function VehicleSearch({
  vehicles = [],
  selectedVehicle = null,
  onSelectVehicle,
  onSearchChange
}) {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (onSearchChange) onSearchChange(val, selectedType);
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    if (onSearchChange) onSearchChange(query, type);
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesPlate = !query || v.plate_number_best_guess?.toUpperCase().includes(query.toUpperCase().replace(/\s+/g, ''));
    const matchesType = selectedType === 'all' || v.vehicle_type === selectedType;
    return matchesPlate && matchesType;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'truck': return <Truck size={14} />;
      case 'bus': return <Bus size={14} />;
      case 'motorcycle': return <Bike size={14} />;
      default: return <Car size={14} />;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} color="var(--accent-cyan)" />
          <span>Vehicle Registry & Lookup</span>
        </h3>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
          Search by license plate or global identity to plot trajectory
        </p>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="input-control font-mono"
          placeholder="e.g. MH12AB1234 or NEXUS_V00001..."
          value={query}
          onChange={handleInput}
          style={{ paddingLeft: '36px', fontSize: '0.9rem', letterSpacing: '1px' }}
        />
        <Search
          size={16}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
        />
      </div>

      {/* Vehicle Type Filter Chips */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['all', 'car', 'truck', 'bus', 'motorcycle'].map((type) => (
          <button
            key={type}
            onClick={() => handleTypeSelect(type)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              cursor: 'pointer',
              border: selectedType === type ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              background: selectedType === type ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: selectedType === type ? 'var(--accent-cyan)' : 'var(--text-muted)'
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Vehicle Results List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '0' }}>
        {filteredVehicles.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            No matching vehicles located in surveillance registry.
          </div>
        ) : (
          filteredVehicles.map((vehicle) => {
            const isSelected = selectedVehicle && selectedVehicle.id === vehicle.id;
            return (
              <div
                key={vehicle.id}
                onClick={() => onSelectVehicle(vehicle)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Indian Plate Representation */}
                    <div className="plate-badge" style={{ fontSize: '0.82rem', padding: '2px 8px' }}>
                      <span className="ind-tag">IND</span>
                      <span>{vehicle.plate_number_best_guess || 'NO PLATE'}</span>
                    </div>

                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase'
                    }}>
                      {getTypeIcon(vehicle.vehicle_type)}
                      {vehicle.vehicle_type}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    <span>Global ID: <b style={{ color: vehicle.global_vehicle_id ? 'var(--accent-purple)' : 'var(--text-dim)' }}>{vehicle.global_vehicle_id || 'Pending Fusion'}</b></span>
                    <span>•</span>
                    <span>Sightings: <b style={{ color: 'var(--accent-cyan)' }}>{vehicle.observation_count}</b></span>
                  </div>
                </div>

                <button
                  className={isSelected ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                >
                  <Navigation size={12} />
                  {isSelected ? 'Tracking' : 'Plot'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
