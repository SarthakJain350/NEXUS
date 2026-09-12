import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Camera, Navigation, AlertTriangle, Eye, Layers, ShieldCheck, Car } from 'lucide-react';
import { getTileConfig } from '../../services/mapConfig';
import { getLatestWaypoint } from '../../services/journeyFocus';

// Re-measure the map whenever its container is laid out or resized.
// Leaflet only listens for WINDOW resizes; on tab switch the map mounts
// before the grid layout is computed, caches a zero-width size, and then
// flyTo frames the wrong area even though getCenter() reports the target.
function ContainerSizeObserver() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      // pan:false is essential: a layout-driven re-measure must never move
      // the view. With a stale cached size (e.g. 0-width at mount) the
      // default pan:true shifts the map by half the size difference,
      // aborting and overwriting any in-flight flyTo.
      map.invalidateSize({ animate: false, pan: false });
    });
    observer.observe(map.getContainer());
    map.invalidateSize({ animate: false, pan: false });
    return () => observer.disconnect();
  }, [map]);
  return null;
}

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
  focusCoords = null,
  alerts = [],
  onSelectVehicle = () => {}
}) {
  // Layer visibility toggles
  const [showCameras, setShowCameras] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showJourneys, setShowJourneys] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);

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

  // Custom DivIcon for Alert Markers
  const createAlertIcon = (severity) => {
    const color = severity === 'HIGH' ? '#f43f5e' : (severity === 'MEDIUM' ? '#f59e0b' : '#38bdf8');
    return L.divIcon({
      className: 'custom-leaflet-marker-wrapper',
      html: `
        <div style="
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: rgba(14, 23, 41, 0.9);
          border: 2px solid ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px ${color};
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });
  };

  // Polyline coordinates for active vehicle journey. Memoized: rebuilding
  // these arrays every render would re-trigger the MapController flyTo
  // effect through the fallback target below (one focus per selection).
  const polylinePositions = useMemo(
    () => (journeyPoints || [])
      .filter(p => p.latitude && p.longitude)
      .map(p => [p.latitude, p.longitude]),
    [journeyPoints]
  );
  // Stable fallback focus target when no explicit focusCoords is set:
  // the journey's LAST valid waypoint (chronological ASC — never the
  // first, which is the oldest and would center on the journey start).
  // Same helper App.jsx uses for the explicit focus — one source of truth.
  const fallbackTarget = useMemo(
    () => getLatestWaypoint(journeyPoints),
    [journeyPoints]
  );

  // Base-tile provider config (env-driven; resolved once — env is immutable
  // after build). No journey/trajectory logic depends on this.
  const tileConfig = useMemo(() => getTileConfig(), []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '480px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      {/* Map Control Overlay Header */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 14,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <div className="glass-panel" style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.74rem',
          fontWeight: 700,
          background: 'rgba(11, 17, 30, 0.9)',
          border: '1px solid var(--border-medium)'
        }}>
          <Navigation size={14} color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-main)' }}>TACTICAL SURVEILLANCE GIS</span>
          <span style={{ color: 'var(--accent-cyan)' }}>•</span>
          <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{cameras.length} NODES</span>
        </div>

        {selectedVehicle && (
          <div className="glass-panel" style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.74rem',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid var(--accent-cyan)',
            color: '#fff'
          }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>TRACKING:</span>
            <span className="font-mono" style={{ fontWeight: 800 }}>{selectedVehicle.plate_number_best_guess}</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>({journeyPoints.length} Checkpoints)</span>
          </div>
        )}
      </div>

      {/* Layer Controls Dropdown/Pill Strip */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 14,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(11, 17, 30, 0.9)',
        padding: '4px 6px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Layers size={12} /> LAYERS:
        </span>
        <button
          onClick={() => setShowCameras(!showCameras)}
          style={{
            padding: '3px 8px',
            borderRadius: '5px',
            fontSize: '0.68rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: showCameras ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: showCameras ? 'var(--accent-cyan)' : 'var(--text-dim)'
          }}
        >
          Cameras
        </button>
        <button
          onClick={() => setShowCoverage(!showCoverage)}
          style={{
            padding: '3px 8px',
            borderRadius: '5px',
            fontSize: '0.68rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: showCoverage ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: showCoverage ? 'var(--accent-cyan)' : 'var(--text-dim)'
          }}
        >
          Coverage
        </button>
        <button
          onClick={() => setShowJourneys(!showJourneys)}
          style={{
            padding: '3px 8px',
            borderRadius: '5px',
            fontSize: '0.68rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: showJourneys ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: showJourneys ? 'var(--accent-cyan)' : 'var(--text-dim)'
          }}
        >
          Journeys
        </button>
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          style={{
            padding: '3px 8px',
            borderRadius: '5px',
            fontSize: '0.68rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: showAlerts ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: showAlerts ? '#fb7185' : 'var(--text-dim)'
          }}
        >
          Alerts
        </button>
      </div>

      {/* Map Legend */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        zIndex: 1000,
        padding: '6px 12px',
        fontSize: '0.68rem',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(11, 17, 30, 0.92)'
      }} className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className="status-dot active" />
          <span style={{ color: 'var(--text-muted)' }}>Online</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className="status-dot unregistered" />
          <span style={{ color: 'var(--text-muted)' }}>Degraded/Unreg</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div className="status-dot inactive" />
          <span style={{ color: 'var(--text-muted)' }}>Offline</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: '#00f2fe', fontWeight: 700 }}>━━</span>
          <span style={{ color: 'var(--text-muted)' }}>Trajectory Route</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: '#fb7185', fontWeight: 800 }}>⚠</span>
          <span style={{ color: 'var(--text-muted)' }}>Alert</span>
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
          targetCoords={focusCoords || fallbackTarget}
          zoom={focusCoords ? 13 : null}
        />

        {/* Re-sync Leaflet's cached size with the real container size */}
        <ContainerSizeObserver />

        {/* Base tiles — provider/key configured via VITE_MAP_* env vars
            (frontend/.env); defaults to keyless CARTO Dark Matter.
            See frontend/.env.example for the variable names. */}
        <TileLayer
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          maxZoom={tileConfig.maxZoom}
        />

        {/* Camera Coverage Radiuses & Markers */}
        {showCameras && cameras.map((cam) => {
          if (!cam.latitude || !cam.longitude) return null;
          const pos = [cam.latitude, cam.longitude];
          const isSelected = selectedCamera && selectedCamera.camera_id === cam.camera_id;

          return (
            <React.Fragment key={cam.camera_id}>
              {showCoverage && (
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
              )}
              <Marker
                position={pos}
                icon={createCameraIcon(cam)}
                eventHandlers={{
                  click: () => onSelectCamera(cam)
                }}
              >
                <Popup>
                  <div style={{ minWidth: '190px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                        {cam.camera_id}
                      </span>
                      <span className={`status-pill ${cam.status}`} style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                        {cam.status}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#fff', marginBottom: '4px' }}>
                      {cam.name || 'Unnamed Sensor Node'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      {cam.location || 'Location unassigned'}
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                      GPS: {cam.latitude.toFixed(4)}°, {cam.longitude.toFixed(4)}°
                    </div>
                    <button
                      onClick={() => onSelectCamera(cam)}
                      className="btn btn-outline"
                      style={{ marginTop: '8px', width: '100%', padding: '4px 8px', fontSize: '0.72rem' }}
                    >
                      <Eye size={12} /> Inspect Camera Telemetry
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Alerts Markers on Cameras */}
        {showAlerts && alerts.map((alert, idx) => {
          const cam = cameras.find(c => c.camera_id === alert.camera);
          if (!cam || !cam.latitude || !cam.longitude) return null;

          // Offset slightly so it doesn't overlap camera exactly
          const alertPos = [cam.latitude + 0.003, cam.longitude + 0.003];
          return (
            <Marker
              key={`alert-${alert.id || idx}`}
              position={alertPos}
              icon={createAlertIcon(alert.severity)}
            >
              <Popup>
                <div style={{ minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className={`severity-pill ${alert.severity}`} style={{ fontSize: '0.62rem' }}>
                      {alert.severity} ALERT
                    </span>
                    <span className="client-derived-tag" style={{ fontSize: '0.55rem' }}>CLIENT</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', margin: '4px 0' }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    Node: <b style={{ color: 'var(--accent-cyan)' }}>{alert.camera}</b> | Target: {alert.vehicle}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Vehicle Journey Trajectory Polyline */}
        {showJourneys && polylinePositions.length > 1 && (
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
        {showJourneys && journeyPoints.map((point, idx) => {
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
