import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Camera, Navigation, AlertTriangle, Eye, Activity } from 'lucide-react';

// Controller component to smoothly pan/zoom when target selection changes
function MapController({ targetCoords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords && targetCoords[0] && targetCoords[1]) {
      map.flyTo(targetCoords, zoom || 13, { duration: 1.2 });
    }
  }, [targetCoords, zoom, map]);
  return null;
}

export default function TacticalMap({
  cameras = [],
  selectedCamera = null,
  onSelectCamera = () => {},
  selectedVehicle = null,
  journeyPoints = [],
  focusCoords = null
}) {
  // Default center: Corridor between Mumbai and Pune
  const defaultCenter = [18.98, 73.1];
  const defaultZoom = 10;

  // Custom DivIcon generator for Cameras
  const createCameraIcon = (camera) => {
    const statusClass = camera.status || 'active';
    const isSelected = selectedCamera && selectedCamera.camera_id === camera.camera_id;
    return L.divIcon({
      className: 'custom-leaflet-marker-wrapper',
      html: `
        <div class="custom-camera-marker ${statusClass}" style="
          ${isSelected ? 'transform: scale(1.3); border-color: #00f2fe; box-shadow: 0 0 15px #00f2fe;' : ''}
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #fff;">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  };

  // Custom DivIcon for Journey Waypoints
  const createWaypointIcon = (index) => {
    return L.divIcon({
      className: 'custom-leaflet-marker-wrapper',
      html: `<div class="waypoint-pin">${index + 1}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });
  };

  // Polyline coordinates for active vehicle journey
  const polylinePositions = (journeyPoints || [])
    .filter(p => p.latitude && p.longitude)
    .map(p => [p.latitude, p.longitude]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '520px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      {/* Map Control Overlay Header */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 14,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div className="glass-panel" style={{
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.75rem',
          fontWeight: 600,
          background: 'rgba(11, 17, 30, 0.85)',
          border: '1px solid var(--border-medium)'
        }}>
          <Navigation size={14} color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-main)' }}>TACTICAL SURVEILLANCE GRID</span>
          <span style={{ color: 'var(--accent-cyan)' }}>•</span>
          <span style={{ color: 'var(--text-dim)' }}>{cameras.length} NODES</span>
        </div>

        {selectedVehicle && (
          <div className="glass-panel" style={{
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid var(--accent-cyan)',
            color: '#fff'
          }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>TRACKING:</span>
            <span className="font-mono" style={{ fontWeight: 800 }}>{selectedVehicle.plate_number_best_guess}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({journeyPoints.length} Sightings)</span>
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        zIndex: 1000,
        padding: '8px 12px',
        fontSize: '0.7rem',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }} className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className="status-dot active" />
          <span style={{ color: 'var(--text-muted)' }}>Active</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className="status-dot unregistered" />
          <span style={{ color: 'var(--text-muted)' }}>Unregistered</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className="status-dot maintenance" />
          <span style={{ color: 'var(--text-muted)' }}>Maintenance</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className="status-dot inactive" />
          <span style={{ color: 'var(--text-muted)' }}>Offline</span>
        </div>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <MapController
          targetCoords={focusCoords || (polylinePositions.length > 0 ? polylinePositions[0] : null)}
          zoom={focusCoords ? 13 : null}
        />

        {/* CartoDB Dark Matter Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Camera Coverage Radiuses & Markers */}
        {cameras.map((cam) => {
          if (!cam.latitude || !cam.longitude) return null;
          const pos = [cam.latitude, cam.longitude];
          const isSelected = selectedCamera && selectedCamera.camera_id === cam.camera_id;

          return (
            <React.Fragment key={cam.camera_id}>
              <Circle
                center={pos}
                radius={isSelected ? 600 : 350}
                pathOptions={{
                  color: cam.status === 'active' ? '#00f2fe' : (cam.status === 'unregistered' ? '#f59e0b' : '#ef4444'),
                  fillColor: cam.status === 'active' ? '#00f2fe' : '#f59e0b',
                  fillOpacity: isSelected ? 0.2 : 0.08,
                  weight: isSelected ? 2 : 1,
                  dashArray: cam.status === 'unregistered' ? '4, 4' : null
                }}
              />
              <Marker
                position={pos}
                icon={createCameraIcon(cam)}
                eventHandlers={{
                  click: () => onSelectCamera(cam)
                }}
              >
                <Popup>
                  <div style={{ minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                        {cam.camera_id}
                      </span>
                      <span className={`status-pill ${cam.status}`} style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                        {cam.status}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#fff', marginBottom: '4px' }}>
                      {cam.name || 'Unnamed Sensor'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {cam.location || 'Location unassigned'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                      GPS: {cam.latitude.toFixed(4)}°, {cam.longitude.toFixed(4)}°
                    </div>
                    <button
                      onClick={() => onSelectCamera(cam)}
                      className="btn btn-outline"
                      style={{ marginTop: '8px', width: '100%', padding: '4px 8px', fontSize: '0.72rem' }}
                    >
                      <Eye size={12} /> Inspect Feed & Detections
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Vehicle Journey Trajectory Polyline */}
        {polylinePositions.length > 1 && (
          <>
            {/* Outer glow line */}
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: '#00f2fe',
                weight: 6,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
            {/* Inner dashed core line */}
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                opacity: 0.95,
                dashArray: '8, 8'
              }}
            />
          </>
        )}

        {/* Numbered Waypoint Pins */}
        {journeyPoints.map((point, idx) => {
          if (!point.latitude || !point.longitude) return null;
          return (
            <Marker
              key={point.observation_id || idx}
              position={[point.latitude, point.longitude]}
              icon={createWaypointIcon(idx)}
            >
              <Popup>
                <div style={{ minWidth: '190px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      WAYPOINT #{idx + 1}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      {point.speed_est || 'Transit Node'}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: '2px 0 6px 0' }}>
                    {point.plate_number || 'UNKNOWN'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    <b>Camera:</b> {point.camera_id} ({point.camera_name || 'Grid Sensor'})
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    <b>Time:</b> {new Date(point.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                    <b>Confidence:</b> {(point.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
