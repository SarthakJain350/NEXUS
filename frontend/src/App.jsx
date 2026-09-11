import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/layout/Header';
import Navigation from './components/layout/Navigation';
import StatsRibbon from './components/layout/StatsRibbon';
import TacticalMap from './components/map/TacticalMap';
import CameraDetailDrawer from './components/map/CameraDetailDrawer';
import VehicleSearch from './components/tracking/VehicleSearch';
import JourneyTimeline from './components/tracking/JourneyTimeline';
import CameraGrid from './components/cameras/CameraGrid';
import CameraEditModal from './components/cameras/CameraEditModal';
import LiveFeedTable from './components/observations/LiveFeedTable';
import IngestSimulator from './components/observations/IngestSimulator';
import TrafficAnalytics from './components/analytics/TrafficAnalytics';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('gis');
  const [backendHealth, setBackendHealth] = useState({ online: false, database: 'offline' });
  const [isSimulated, setIsSimulated] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [observations, setObservations] = useState([]);

  const [selectedCamera, setSelectedCamera] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [journeyPoints, setJourneyPoints] = useState([]);
  const [focusCoords, setFocusCoords] = useState(null);

  const [editingCamera, setEditingCamera] = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Load all telemetry from backend/simulation
  const loadData = useCallback(async () => {
    try {
      const health = await api.checkHealth();
      setBackendHealth(health);
      if (!health.online && !isSimulated) {
        setIsSimulated(true);
      }

      const [camData, vehData, obsData] = await Promise.all([
        api.getCameras(),
        api.getVehicles(),
        api.getObservations()
      ]);

      setCameras(camData);
      setVehicles(vehData);
      setObservations(obsData);

      // Auto-select first vehicle if none selected yet
      if (!selectedVehicle && vehData.length > 0) {
        handleSelectVehicle(vehData[0]);
      }
    } catch (err) {
      console.error('Error loading NEXUS telemetry:', err);
    }
  }, [isSimulated, selectedVehicle]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleToggleSimulation = () => {
    const next = !isSimulated;
    setIsSimulated(next);
    api.setSimulationMode(next);
    loadData();
  };

  const handleSelectVehicle = async (vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const journey = await api.getVehicleJourney(vehicle.id);
      setJourneyPoints(journey);
      if (journey && journey.length > 0) {
        setFocusCoords([journey[0].latitude, journey[0].longitude]);
      }
    } catch (e) {
      console.error('Failed to fetch vehicle journey', e);
    }
  };

  const handleSelectCamera = (camera) => {
    setSelectedCamera(camera);
    if (camera.latitude && camera.longitude) {
      setFocusCoords([camera.latitude, camera.longitude]);
    }
  };

  const handleFocusWaypoint = (coords) => {
    setFocusCoords(coords);
  };

  const handleSaveCamera = async (cameraId, payload) => {
    await api.updateCamera(cameraId, payload);
    await loadData();
    if (selectedCamera && selectedCamera.camera_id === cameraId) {
      setSelectedCamera(prev => ({ ...prev, ...payload }));
    }
  };

  const handleIngestObservation = async (payload) => {
    await api.ingestObservation(payload);
    await loadData();
    // If this observation matches current vehicle, reload journey
    if (selectedVehicle && payload.plate_number && payload.plate_number.replace(/\s+/g, '').toUpperCase() === selectedVehicle.plate_number_best_guess?.replace(/\s+/g, '').toUpperCase()) {
      handleSelectVehicle(selectedVehicle);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Header */}
      <Header
        backendHealth={backendHealth}
        isSimulated={isSimulated}
        onToggleSimulation={handleToggleSimulation}
        onRefresh={loadData}
      />

      {/* KPI Stats Ribbon */}
      <StatsRibbon
        cameras={cameras}
        vehicles={vehicles}
        observations={observations}
      />

      {/* Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={{
          cameras: cameras.length,
          vehicles: vehicles.length,
          observations: observations.length
        }}
      />

      {/* Main Content Workspace */}
      <main style={{ flex: 1, padding: '10px 16px 14px 16px', overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {/* GIS Map View */}
        {activeTab === 'gis' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '14px', width: '100%', height: '100%' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <TacticalMap
                cameras={cameras}
                selectedCamera={selectedCamera}
                onSelectCamera={handleSelectCamera}
                selectedVehicle={selectedVehicle}
                journeyPoints={journeyPoints}
                focusCoords={focusCoords}
              />

              {/* Slide-in Camera Detail Drawer */}
              {selectedCamera && (
                <CameraDetailDrawer
                  camera={selectedCamera}
                  observations={observations}
                  onClose={() => setSelectedCamera(null)}
                  onEditCamera={(cam) => setEditingCamera(cam)}
                  onSelectVehicle={(veh) => {
                    setActiveTab('tracking');
                    handleSelectVehicle(veh);
                  }}
                />
              )}
            </div>

            {/* Side Panel: Vehicle Selector & Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
              <div style={{ height: '45%' }}>
                <VehicleSearch
                  vehicles={vehicles}
                  selectedVehicle={selectedVehicle}
                  onSelectVehicle={handleSelectVehicle}
                />
              </div>
              <div style={{ height: '55%' }}>
                <JourneyTimeline
                  journeyPoints={journeyPoints}
                  selectedVehicle={selectedVehicle}
                  onFocusWaypoint={handleFocusWaypoint}
                />
              </div>
            </div>
          </div>
        )}

        {/* Trajectory Tracking Dedicated View */}
        {activeTab === 'tracking' && (
          <div style={{ display: 'grid', gridTemplateColumns: '340px 380px 1fr', gap: '14px', width: '100%', height: '100%' }}>
            <VehicleSearch
              vehicles={vehicles}
              selectedVehicle={selectedVehicle}
              onSelectVehicle={handleSelectVehicle}
            />

            <JourneyTimeline
              journeyPoints={journeyPoints}
              selectedVehicle={selectedVehicle}
              onFocusWaypoint={handleFocusWaypoint}
            />

            <TacticalMap
              cameras={cameras}
              selectedCamera={selectedCamera}
              onSelectCamera={handleSelectCamera}
              selectedVehicle={selectedVehicle}
              journeyPoints={journeyPoints}
              focusCoords={focusCoords}
            />
          </div>
        )}

        {/* Camera Fleet Manager View */}
        {activeTab === 'cameras' && (
          <div style={{ width: '100%', height: '100%' }}>
            <CameraGrid
              cameras={cameras}
              onEditCamera={(cam) => setEditingCamera(cam)}
              onFocusCamera={(cam) => {
                setActiveTab('gis');
                handleSelectCamera(cam);
              }}
            />
          </div>
        )}

        {/* Live Telemetry Feed View */}
        {activeTab === 'feed' && (
          <div style={{ width: '100%', height: '100%' }}>
            <LiveFeedTable
              observations={observations}
              onSelectVehicle={(veh) => {
                setActiveTab('tracking');
                handleSelectVehicle(veh);
              }}
              onFocusCamera={(cam) => {
                setActiveTab('gis');
                handleSelectCamera(cam);
              }}
              onOpenSimulator={() => setIsSimulatorOpen(true)}
            />
          </div>
        )}

        {/* Analytics View */}
        {activeTab === 'analytics' && (
          <div style={{ width: '100%', height: '100%' }}>
            <TrafficAnalytics
              cameras={cameras}
              observations={observations}
              vehicles={vehicles}
            />
          </div>
        )}
      </main>

      {/* Edit Camera Modal */}
      {editingCamera && (
        <CameraEditModal
          camera={editingCamera}
          isOpen={!!editingCamera}
          onClose={() => setEditingCamera(null)}
          onSave={handleSaveCamera}
        />
      )}

      {/* Ingest Simulator Modal */}
      {isSimulatorOpen && (
        <IngestSimulator
          cameras={cameras}
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          onIngest={handleIngestObservation}
        />
      )}
    </div>
  );
}
