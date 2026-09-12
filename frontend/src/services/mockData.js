// NEXUS GIS & Command Center — High-Fidelity Tactical Mock Data
// Coordinates centered along Mumbai-Pune urban transport corridor

export const MOCK_CAMERAS = [
  {
    id: 1,
    camera_id: "CAM_01",
    name: "Bandra-Worli Sea Link North Plaza",
    latitude: 19.0368,
    longitude: 72.8172,
    location: "Bandra West, Mumbai",
    status: "active",
    last_seen_at: new Date(Date.now() - 2 * 60000).toISOString(),
    created_at: "2026-09-01T08:00:00Z",
    observation_count: 1420
  },
  {
    id: 2,
    camera_id: "CAM_02",
    name: "Worli Seaface South Junction",
    latitude: 19.0125,
    longitude: 72.8152,
    location: "Worli, Mumbai",
    status: "active",
    last_seen_at: new Date(Date.now() - 4 * 60000).toISOString(),
    created_at: "2026-09-01T08:00:00Z",
    observation_count: 1184
  },
  {
    id: 3,
    camera_id: "CAM_03",
    name: "Haji Ali Express Bay",
    latitude: 18.9782,
    longitude: 72.8118,
    location: "Mahalaxmi, Mumbai",
    status: "active",
    last_seen_at: new Date(Date.now() - 1 * 60000).toISOString(),
    created_at: "2026-09-01T08:00:00Z",
    observation_count: 982
  },
  {
    id: 4,
    camera_id: "CAM_04",
    name: "Eastern Freeway Chembur Exit",
    latitude: 19.0522,
    longitude: 72.8987,
    location: "Chembur, Mumbai",
    status: "active",
    last_seen_at: new Date(Date.now() - 5 * 60000).toISOString(),
    created_at: "2026-09-02T10:00:00Z",
    observation_count: 1650
  },
  {
    id: 5,
    camera_id: "CAM_05",
    name: "Vashi Bridge Toll Gate 04",
    latitude: 19.0645,
    longitude: 72.9855,
    location: "Navi Mumbai Outer",
    status: "active",
    last_seen_at: new Date(Date.now() - 10 * 60000).toISOString(),
    created_at: "2026-09-03T09:00:00Z",
    observation_count: 2240
  },
  {
    id: 6,
    camera_id: "CAM_06",
    name: "Expressway Khalapur Plaza",
    latitude: 18.8258,
    longitude: 73.2846,
    location: "Mumbai-Pune Expressway KM 38",
    status: "active",
    last_seen_at: new Date(Date.now() - 7 * 60000).toISOString(),
    created_at: "2026-09-04T12:00:00Z",
    observation_count: 3105
  },
  {
    id: 7,
    camera_id: "CAM_07",
    name: "Urse Toll Plaza Pune Entry",
    latitude: 18.7214,
    longitude: 73.6621,
    location: "Talegaon Dabhade, Pune",
    status: "unregistered",
    last_seen_at: new Date(Date.now() - 15 * 60000).toISOString(),
    created_at: "2026-09-10T14:30:00Z",
    observation_count: 312
  },
  {
    id: 8,
    camera_id: "CAM_08",
    name: "Wakad Hinjewadi Flyover North",
    latitude: 18.5996,
    longitude: 73.7634,
    location: "Hinjewadi Phase 1, Pune",
    status: "maintenance",
    last_seen_at: new Date(Date.now() - 120 * 60000).toISOString(),
    created_at: "2026-09-05T08:00:00Z",
    observation_count: 840
  }
];

export const MOCK_VEHICLES = [
  {
    id: 1,
    global_vehicle_id: "GV-9021",
    plate_number_best_guess: "MH12AB1234",
    vehicle_type: "car",
    observation_count: 5,
    created_at: "2026-09-11T12:00:00Z",
    updated_at: "2026-09-11T15:45:00Z"
  },
  {
    id: 2,
    global_vehicle_id: "GV-4482",
    plate_number_best_guess: "MH02CD5678",
    vehicle_type: "car",
    observation_count: 4,
    created_at: "2026-09-11T13:10:00Z",
    updated_at: "2026-09-11T16:15:00Z"
  },
  {
    id: 3,
    global_vehicle_id: "GV-1109",
    plate_number_best_guess: "MH14EF9900",
    vehicle_type: "truck",
    observation_count: 3,
    created_at: "2026-09-11T10:00:00Z",
    updated_at: "2026-09-11T14:30:00Z"
  },
  {
    id: 4,
    global_vehicle_id: "GV-8723",
    plate_number_best_guess: "DL01XY9999",
    vehicle_type: "bus",
    observation_count: 2,
    created_at: "2026-09-11T09:30:00Z",
    updated_at: "2026-09-11T11:00:00Z"
  },
  {
    id: 5,
    global_vehicle_id: null,
    plate_number_best_guess: "MH01ZZ3322",
    vehicle_type: "motorcycle",
    observation_count: 3,
    created_at: "2026-09-11T14:00:00Z",
    updated_at: "2026-09-11T16:20:00Z"
  }
];

export const MOCK_JOURNEYS = {
  1: [
    {
      observation_id: 101,
      camera_id: "CAM_01",
      camera_name: "Bandra-Worli Sea Link North",
      track_id: 12,
      plate_number: "MH12AB1234",
      timestamp: "2026-09-11T14:10:00Z",
      vehicle_type: "car",
      confidence: 0.96,
      latitude: 19.0368,
      longitude: 72.8172,
      speed_est: "68 km/h"
    },
    {
      observation_id: 102,
      camera_id: "CAM_02",
      camera_name: "Worli Seaface South",
      track_id: 45,
      plate_number: "MH12AB1234",
      timestamp: "2026-09-11T14:24:00Z",
      vehicle_type: "car",
      confidence: 0.94,
      latitude: 19.0125,
      longitude: 72.8152,
      speed_est: "54 km/h"
    },
    {
      observation_id: 103,
      camera_id: "CAM_04",
      camera_name: "Eastern Freeway Chembur",
      track_id: 89,
      plate_number: "MH12AB1234",
      timestamp: "2026-09-11T14:48:00Z",
      vehicle_type: "car",
      confidence: 0.98,
      latitude: 19.0522,
      longitude: 72.8987,
      speed_est: "72 km/h"
    },
    {
      observation_id: 104,
      camera_id: "CAM_05",
      camera_name: "Vashi Bridge Toll Gate 04",
      track_id: 104,
      plate_number: "MH12AB1234",
      timestamp: "2026-09-11T15:15:00Z",
      vehicle_type: "car",
      confidence: 0.95,
      latitude: 19.0645,
      longitude: 72.9855,
      speed_est: "60 km/h"
    },
    {
      observation_id: 105,
      camera_id: "CAM_06",
      camera_name: "Expressway Khalapur Plaza",
      track_id: 219,
      plate_number: "MH12AB1234",
      timestamp: "2026-09-11T15:45:00Z",
      vehicle_type: "car",
      confidence: 0.97,
      latitude: 18.8258,
      longitude: 73.2846,
      speed_est: "88 km/h"
    }
  ],
  2: [
    {
      observation_id: 201,
      camera_id: "CAM_03",
      camera_name: "Haji Ali Express Bay",
      track_id: 19,
      plate_number: "MH02CD5678",
      timestamp: "2026-09-11T15:10:00Z",
      vehicle_type: "car",
      confidence: 0.93,
      latitude: 18.9782,
      longitude: 72.8118,
      speed_est: "45 km/h"
    },
    {
      observation_id: 202,
      camera_id: "CAM_02",
      camera_name: "Worli Seaface South",
      track_id: 54,
      plate_number: "MH02CD5678",
      timestamp: "2026-09-11T15:32:00Z",
      vehicle_type: "car",
      confidence: 0.95,
      latitude: 19.0125,
      longitude: 72.8152,
      speed_est: "52 km/h"
    },
    {
      observation_id: 203,
      camera_id: "CAM_01",
      camera_name: "Bandra-Worli Sea Link North",
      track_id: 88,
      plate_number: "MH02CD5678",
      timestamp: "2026-09-11T15:55:00Z",
      vehicle_type: "car",
      confidence: 0.96,
      latitude: 19.0368,
      longitude: 72.8172,
      speed_est: "65 km/h"
    },
    {
      observation_id: 204,
      camera_id: "CAM_04",
      camera_name: "Eastern Freeway Chembur",
      track_id: 130,
      plate_number: "MH02CD5678",
      timestamp: "2026-09-11T16:15:00Z",
      vehicle_type: "car",
      confidence: 0.91,
      latitude: 19.0522,
      longitude: 72.8987,
      speed_est: "58 km/h"
    }
  ]
};

export const MOCK_OBSERVATIONS = [
  {
    id: 501,
    vehicle_id: 1,
    camera_id: "CAM_06",
    track_id: 219,
    plate_number: "MH12AB1234",
    timestamp: "2026-09-11T15:45:00Z",
    vehicle_type: "car",
    confidence: 0.97,
    latitude: 18.8258,
    longitude: 73.2846,
    ingest_id: "ingest-98112-a"
  },
  {
    id: 502,
    vehicle_id: 2,
    camera_id: "CAM_04",
    track_id: 130,
    plate_number: "MH02CD5678",
    timestamp: "2026-09-11T16:15:00Z",
    vehicle_type: "car",
    confidence: 0.91,
    latitude: 19.0522,
    longitude: 72.8987,
    ingest_id: "ingest-98112-b"
  },
  {
    id: 503,
    vehicle_id: 5,
    camera_id: "CAM_01",
    track_id: 77,
    plate_number: "MH01ZZ3322",
    timestamp: "2026-09-11T16:20:00Z",
    vehicle_type: "motorcycle",
    confidence: 0.88,
    latitude: 19.0368,
    longitude: 72.8172,
    ingest_id: "ingest-98112-c"
  },
  {
    id: 504,
    vehicle_id: 3,
    camera_id: "CAM_05",
    track_id: 312,
    plate_number: "MH14EF9900",
    timestamp: "2026-09-11T14:30:00Z",
    vehicle_type: "truck",
    confidence: 0.99,
    latitude: 19.0645,
    longitude: 72.9855,
    ingest_id: "ingest-98112-d"
  },
  {
    id: 505,
    vehicle_id: null,
    camera_id: "CAM_07",
    track_id: 12,
    plate_number: null,
    timestamp: "2026-09-11T16:22:00Z",
    vehicle_type: "auto",
    confidence: 0.82,
    latitude: 18.7214,
    longitude: 73.6621,
    ingest_id: "ingest-98112-e"
  }
];
