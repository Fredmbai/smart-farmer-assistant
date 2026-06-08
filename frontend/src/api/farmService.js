import client from './client';

// Handles both paginated { count, results: [...] } and plain array responses.
const unpage = (data) => (Array.isArray(data) ? data : (data?.results ?? []));

// ── Farms ────────────────────────────────────────────────────────────
export const getFarms = () =>
  client.get('/api/farms/').then((r) => unpage(r.data));

export const createFarm = (data) =>
  client.post('/api/farms/', data).then((r) => r.data);

export const getFarm = (farmId) =>
  client.get(`/api/farms/${farmId}/`).then((r) => r.data);

export const updateFarm = (farmId, data) =>
  client.patch(`/api/farms/${farmId}/`, data).then((r) => r.data);

export const deleteFarm = (farmId) =>
  client.delete(`/api/farms/${farmId}/`).then((r) => r.data);

// ── Plots ────────────────────────────────────────────────────────────
export const getPlots = (farmId) =>
  client.get(`/api/farms/${farmId}/plots/`).then((r) => unpage(r.data));

export const createPlot = (farmId, data) =>
  client.post(`/api/farms/${farmId}/plots/`, data).then((r) => r.data);

export const getPlot = (farmId, plotId) =>
  client.get(`/api/farms/${farmId}/plots/${plotId}/`).then((r) => r.data);

export const updatePlot = (farmId, plotId, data) =>
  client.patch(`/api/farms/${farmId}/plots/${plotId}/`, data).then((r) => r.data);

// ── Crop cycles ──────────────────────────────────────────────────────
export const getCycles = (farmId, plotId) =>
  client.get(`/api/farms/${farmId}/plots/${plotId}/cycles/`).then((r) => unpage(r.data));

export const createCycle = (farmId, plotId, data) =>
  client.post(`/api/farms/${farmId}/plots/${plotId}/cycles/`, data).then((r) => r.data);

export const updateCycle = (farmId, plotId, cycleId, data) =>
  client.put(`/api/farms/${farmId}/plots/${plotId}/cycles/${cycleId}/`, data).then((r) => r.data);
