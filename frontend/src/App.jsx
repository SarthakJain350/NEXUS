import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/layout/Header';
import Navigation from './components/layout/Navigation';
import StatsRibbon from './components/layout/StatsRibbon';
import GlobalSearchModal from './components/layout/GlobalSearchModal';
import AiCopilotDrawer from './components/layout/AiCopilotDrawer';

// Workspaces
import OverviewWorkspace from './components/overview/OverviewWorkspace';
import TacticalMap from './components/map/TacticalMap';
import CameraDetailDrawer from './components/map/CameraDetailDrawer';
import CameraGrid from './components/cameras/CameraGrid';
import CameraEditModal from './components/cameras/CameraEditModal';
import LiveFeedTable from './components/observations/LiveFeedTable';
import IngestSimulator from './components/observations/IngestSimulator';
import AnprWorkspace from './components/anpr/AnprWorkspace';
import VehicleSearch from './components/tracking/VehicleSearch';
import JourneyTimeline from './components/tracking/JourneyTimeline';
import CrossCameraJourney from './components/tracking/CrossCameraJourney';
import ReidWorkspace from './components/reid/ReidWorkspace';
import TrafficAnalytics from './components/analytics/TrafficAnalytics';
import AlertsWorkspace from './components/alerts/AlertsWorkspace';
import ReportsWorkspace from './components/reports/ReportsWorkspace';
import SystemHealthWorkspace from './components/system/SystemHealthWorkspace';
import SettingsWorkspace from './components/system/SettingsWorkspace';

import { api } from './services/api';
import { computeAnalytics, generateClientAlerts } from './services/analyticsBridge';

export default function App() {
  // Navigation active tab: defaults to overview command center
  const [activeTab, setActiveTab] = useState('overview');
  const [backendHealth, setBackendHealth] = useState({ online: false, database: 'offline' });
  const [isSimulated, setIsSimulated] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  // Core Data State
  const [cameras, setCameras] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [observations, setObservations] = useState([]);

  // Client-Derived Alerts & Status State
  const [clientAlerts, setClientAlerts] = useState([]);

  // Selections
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [journeyPoints, setJourneyPoints] = useState([]);
  const [focusCoords, setFocusCoords] = useState(null);

  // Modals & Drawers
  const [editingCamera, setEditingCamera] = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

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

      setCameras(camData || []);
      setVehicles(vehData || []);
      setObservations(obsData || []);
      setLastRefreshTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));

      // Generate client-derived alerts
      const generatedAlerts = generateClientAlerts(obsData || [], camData || [], vehData || []);
      setClientAlerts(prev => {
        // Preserve acknowledged/resolved states
        const stateMap = {};
        prev.forEach(a => { stateMap[a.id] = a.status; });
        return generatedAlerts.map(a => ({
          ...a,
          status: stateMap[a.id] || a.status
        }));
      });

      // Auto-select first vehicle if none selected
      if (!selectedVehicle && vehData && vehData.length > 0) {
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

  // Derived Analytics calculation via Bridge
  const analytics = useMemo(() => {
    return computeAnalytics(observations, cameras, vehicles);
  }, [observations, cameras, vehicles]);

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
      setJourneyPoints(journey || []);
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
    if (
      selectedVehicle &&
      payload.plate_number &&
      payload.plate_number.replace(/\s+/g, '').toUpperCase() ===
        selectedVehicle.plate_number_best_guess?.replace(/\s+/g, '').toUpperCase()
    ) {
      handleSelectVehicle(selectedVehicle);
    }
  };

  const handleUpdateAlertStatus = (alertId, newStatus) => {
    setClientAlerts(prev =>
      prev.map(a => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
  };

  // Cross-Navigation dispatcher
  const handleGlobalNavigate = (target) => {
    if (target.type === 'camera') {
      handleSelectCamera(target.item);
      setActiveTab('gis');
    } else if (target.type === 'vehicle') {
      handleSelectVehicle(target.item);
      setActiveTab('tracking');
    } else if (target.type === 'observation') {
      if (target.item.vehicle_id) {
        handleSelectVehicle({
          id: target.item.vehicle_id,
          plate_number_best_guess: target.item.plate_number,
          vehicle_type: target.item.vehicle_type
        });
        setActiveTab('tracking');
      } else {
        setActiveTab('feed');
      }
    } else if (target.type === 'open_search') {
      setIsSearchOpen(true);
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
        alertCount={clientAlerts.length}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* KPI Stats Ribbon */}
      <StatsRibbon
        cameras={cameras}
        vehicles={vehicles}
        observations={observations}
        alerts={clientAlerts}
      />

      {/* Categorized Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={{
          cameras: cameras.length,
          vehicles: vehicles.length,
          observations: observations.length,
          alerts: clientAlerts.length
        }}
      />

      {/* Main Content Workspace */}
      <main style={{ flex: 1, padding: '8px 16px 14px 16px', overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {/* 1. COMMAND CENTER: Overview */}
        {activeTab === 'overview' && (
          <OverviewWorkspace
            cameras={cameras}
            vehicles={vehicles}
            observations={observations}
            alerts={clientAlerts}
            analytics={analytics}
            backendHealth={backendHealth}
            isSimulated={isSimulated}
            onSelectCamera={(cam) => {
              handleSelectCamera(cam);
              setActiveTab('gis');
            }}
            onSelectVehicle={(veh) => {
              handleSelectVehicle(veh);
              setActiveTab('tracking');
            }}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* 2. MONITORING: Tactical GIS Map View */}
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
                alerts={clientAlerts}
                onSelectVehicle={handleSelectVehicle}
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
              <div style={{ height: '42%' }}>
                <VehicleSearch
                  vehicles={vehicles}
                  selectedVehicle={selectedVehicle}
                  onSelectVehicle={handleSelectVehicle}
                />
              </div>
              <div style={{ height: '58%' }}>
                <JourneyTimeline
                  journeyPoints={journeyPoints}
                  selectedVehicle={selectedVehicle}
                  onFocusWaypoint={handleFocusWaypoint}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. MONITORING: Camera Fleet Manager View */}
        {activeTab === 'cameras' && (
          <div style={{ width: '100%', height: '100%' }}>
            <CameraGrid
              cameras={cameras}
              onEditCamera={(cam) => setEditingCamera(cam)}
              onFocusCamera={(cam) => {
                setActiveTab('gis');
                handleSelectCamera(cam);
              }}
              onSelectCamera={(cam) => {
                setActiveTab('gis');
                handleSelectCamera(cam);
              }}
            />
          </div>
        )}

        {/* 4. MONITORING: Live Telemetry Feed View */}
        {activeTab === 'feed' && (
          <div style={{ width: '100%', height: '100%' }}>
            <LiveFeedTable
              observations={observations}
              cameras={cameras}
              onSelectVehicle={(veh) => {
                setActiveTab('tracking');
                handleSelectVehicle(veh);
              }}
              onFocusCamera={(cam) => {
                setActiveTab('gis');
                handleSelectCamera(cam);
              }}
              onOpenSimulator={() => setIsSimulatorOpen(true)}
              isSimulated={isSimulated}
              lastRefreshTime={lastRefreshTime}
            />
          </div>
        )}

        {/* 5. MONITORING: Dedicated ANPR Workspace */}
        {activeTab === 'anpr' && (
          <div style={{ width: '100%', height: '100%' }}>
            <AnprWorkspace
              observations={observations}
              cameras={cameras}
              onSelectVehicle={(veh) => {
                setActiveTab('tracking');
                handleSelectVehicle(veh);
              }}
              onFocusCamera={(cam) => {
                setActiveTab('gis');
                handleSelectCamera(cam);
              }}
            />
          </div>
        )}

        {/* 6. INTELLIGENCE: Trajectory Tracking Dedicated View */}
        {activeTab === 'tracking' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 380px 1fr', gap: '14px', width: '100%', height: '100%' }}>
            <VehicleSearch
              vehicles={vehicles}
              selectedVehicle={selectedVehicle}
              onSelectVehicle={handleSelectVehicle}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflow: 'hidden' }}>
              <CrossCameraJourney
                selectedVehicle={selectedVehicle}
                journeyPoints={journeyPoints}
                onFocusWaypoint={handleFocusWaypoint}
              />
              <div style={{ flex: 1, minHeight: '0' }}>
                <JourneyTimeline
                  journeyPoints={journeyPoints}
                  selectedVehicle={selectedVehicle}
                  onFocusWaypoint={handleFocusWaypoint}
                />
              </div>
            </div>

            <TacticalMap
              cameras={cameras}
              selectedCamera={selectedCamera}
              onSelectCamera={handleSelectCamera}
              selectedVehicle={selectedVehicle}
              journeyPoints={journeyPoints}
              focusCoords={focusCoords}
              alerts={clientAlerts}
            />
          </div>
        )}

        {/* 7. INTELLIGENCE: Re-ID Intelligence Studio */}
        {activeTab === 'reid' && (
          <div style={{ width: '100%', height: '100%' }}>
            <ReidWorkspace
              vehicles={vehicles}
              cameras={cameras}
              observations={observations}
              onSelectVehicle={handleSelectVehicle}
              onNavigateTab={setActiveTab}
            />
          </div>
        )}

        {/* 8. INTELLIGENCE: Traffic Analytics View */}
        {activeTab === 'analytics' && (
          <div style={{ width: '100%', height: '100%' }}>
            <TrafficAnalytics
              cameras={cameras}
              observations={observations}
              vehicles={vehicles}
              analytics={analytics}
            />
          </div>
        )}

        {/* 9. OPERATIONS: Alerts Engine View */}
        {activeTab === 'alerts' && (
          <div style={{ width: '100%', height: '100%' }}>
            <AlertsWorkspace
              alerts={clientAlerts}
              onUpdateAlertStatus={handleUpdateAlertStatus}
              onFocusCamera={(camId) => {
                const cam = cameras.find(c => c.camera_id === camId);
                if (cam) {
                  handleSelectCamera(cam);
                  setActiveTab('gis');
                }
              }}
              onSelectVehicle={(veh) => {
                handleSelectVehicle(veh);
                setActiveTab('tracking');
              }}
              onNavigateTab={setActiveTab}
            />
          </div>
        )}

        {/* 10. REPORTING: Reports View */}
        {activeTab === 'reports' && (
          <div style={{ width: '100%', height: '100%' }}>
            <ReportsWorkspace
              observations={observations}
              cameras={cameras}
              vehicles={vehicles}
              alerts={clientAlerts}
            />
          </div>
        )}

        {/* 11. SYSTEM: System Health View */}
        {activeTab === 'health' && (
          <div style={{ width: '100%', height: '100%' }}>
            <SystemHealthWorkspace
              backendHealth={backendHealth}
              isSimulated={isSimulated}
              cameras={cameras}
              observations={observations}
              vehicles={vehicles}
              lastRefreshTime={lastRefreshTime}
              onRefresh={loadData}
              onToggleSimulation={handleToggleSimulation}
            />
          </div>
        )}

        {/* 12. SYSTEM: Settings View */}
        {activeTab === 'settings' && (
          <div style={{ width: '100%', height: '100%' }}>
            <SettingsWorkspace
              isSimulated={isSimulated}
              onToggleSimulation={handleToggleSimulation}
              backendHealth={backendHealth}
            />
          </div>
        )}
      </main>

      {/* Global Search Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        cameras={cameras}
        vehicles={vehicles}
        observations={observations}
        onNavigate={handleGlobalNavigate}
      />

      {/* AI Copilot Slide-out Drawer */}
      <AiCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        contextData={{
          cameras,
          vehicles,
          observations,
          alerts: clientAlerts,
          analytics
        }}
        onNavigateTab={setActiveTab}
      />

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
