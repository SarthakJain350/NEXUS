// NEXUS API Client — Communicates with FastAPI R3 Backend
// Falls back seamlessly to tactical mock simulation when the backend is offline

import { MOCK_CAMERAS, MOCK_VEHICLES, MOCK_JOURNEYS, MOCK_OBSERVATIONS } from './mockData';

const BASE_URL = '/api/v1';

class NexusApiClient {
  constructor() {
    this.forceSimulation = false;
    this.localCameras = [...MOCK_CAMERAS];
    this.localVehicles = [...MOCK_VEHICLES];
    this.localObservations = [...MOCK_OBSERVATIONS];
    this.localJourneys = { ...MOCK_JOURNEYS };
  }

  setSimulationMode(enabled) {
    this.forceSimulation = enabled;
  }

  async checkHealth() {
    if (this.forceSimulation) {
      return { online: false, simulated: true, database: 'simulated' };
    }
    try {
      const res = await fetch(`${BASE_URL}/health/ready`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        return { online: true, simulated: false, database: data.database };
      }
      return { online: false, simulated: true, database: 'unreachable' };
    } catch {
      return { online: false, simulated: true, database: 'offline' };
    }
  }

  // --- Cameras ---
  async getCameras(status = null) {
    if (this.forceSimulation) {
      return this._mockFilterCameras(status);
    }
    try {
      const url = status ? `${BASE_URL}/cameras?status=${encodeURIComponent(status)}&page_size=100` : `${BASE_URL}/cameras?page_size=100`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch (e) {
      console.warn('API getCameras failed, falling back to simulation data', e);
    }
    return this._mockFilterCameras(status);
  }

  _mockFilterCameras(status) {
    if (!status) return this.localCameras;
    return this.localCameras.filter(c => c.status === status);
  }

  async updateCamera(cameraId, payload) {
    if (this.forceSimulation) {
      return this._mockUpdateCamera(cameraId, payload);
    }
    try {
      const res = await fetch(`${BASE_URL}/cameras/${cameraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API updateCamera failed, falling back to local simulation update', e);
    }
    return this._mockUpdateCamera(cameraId, payload);
  }

  _mockUpdateCamera(cameraId, payload) {
    const idx = this.localCameras.findIndex(c => c.camera_id === cameraId);
    if (idx !== -1) {
      this.localCameras[idx] = { ...this.localCameras[idx], ...payload };
      return this.localCameras[idx];
    }
    throw new Error('Camera not found');
  }

  // --- Vehicles ---
  async getVehicles(plateNumber = null, vehicleType = null) {
    if (this.forceSimulation) {
      return this._mockFilterVehicles(plateNumber, vehicleType);
    }
    try {
      const params = new URLSearchParams();
      if (plateNumber) params.append('plate_number', plateNumber);
      if (vehicleType) params.append('vehicle_type', vehicleType);
      params.append('page_size', '100');

      const res = await fetch(`${BASE_URL}/vehicles?${params.toString()}`, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch (e) {
      console.warn('API getVehicles failed, falling back to mock vehicles', e);
    }
    return this._mockFilterVehicles(plateNumber, vehicleType);
  }

  _mockFilterVehicles(plateNumber, vehicleType) {
    let list = [...this.localVehicles];
    if (plateNumber) {
      const q = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
      list = list.filter(v => v.plate_number_best_guess?.replace(/[^A-Z0-9]/g, '').includes(q));
    }
    if (vehicleType && vehicleType !== 'all') {
      list = list.filter(v => v.vehicle_type === vehicleType);
    }
    return list;
  }

  // --- Vehicle Journey ---
  async getVehicleJourney(vehicleId) {
    if (this.forceSimulation) {
      return this.localJourneys[vehicleId] || [];
    }
    try {
      const res = await fetch(`${BASE_URL}/vehicles/${vehicleId}/journey?page_size=200`, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) return data.items;
      }
    } catch (e) {
      console.warn(`API getVehicleJourney for ${vehicleId} failed, falling back to mock journey`, e);
    }
    return this.localJourneys[vehicleId] || [];
  }

  // --- Observations ---
  async getObservations(filters = {}) {
    if (this.forceSimulation) {
      return this._mockFilterObservations(filters);
    }
    try {
      const params = new URLSearchParams();
      if (filters.camera_id) params.append('camera_id', filters.camera_id);
      if (filters.plate_number) params.append('plate_number', filters.plate_number);
      if (filters.vehicle_type) params.append('vehicle_type', filters.vehicle_type);
      params.append('page_size', '50');

      const res = await fetch(`${BASE_URL}/observations?${params.toString()}`, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch (e) {
      console.warn('API getObservations failed, using mock observations', e);
    }
    return this._mockFilterObservations(filters);
  }

  _mockFilterObservations(filters) {
    let list = [...this.localObservations];
    if (filters.camera_id) list = list.filter(o => o.camera_id === filters.camera_id);
    if (filters.plate_number) {
      const q = filters.plate_number.toUpperCase().replace(/[^A-Z0-9]/g, '');
      list = list.filter(o => o.plate_number?.replace(/[^A-Z0-9]/g, '').includes(q));
    }
    if (filters.vehicle_type && filters.vehicle_type !== 'all') {
      list = list.filter(o => o.vehicle_type === filters.vehicle_type);
    }
    return list;
  }

  // --- Ingestion Simulation ---
  async ingestObservation(payload) {
    if (this.forceSimulation) {
      return this._mockIngest(payload);
    }
    try {
      const res = await fetch(`${BASE_URL}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API ingestObservation failed, recording in local simulation', e);
    }
    return this._mockIngest(payload);
  }

  _mockIngest(payload) {
    const newId = 600 + this.localObservations.length;
    const newObs = {
      id: newId,
      vehicle_id: payload.plate_number ? 1 : null,
      created_at: new Date().toISOString(),
      ...payload
    };
    this.localObservations.unshift(newObs);
    return newObs;
  }
}

export const api = new NexusApiClient();
