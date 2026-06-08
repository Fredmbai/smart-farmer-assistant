import client from './client';

const unpage = (data) => (Array.isArray(data) ? data : (data?.results ?? []));

export const runAnalysis = (plotId) =>
  client.post(`/api/engine/analyze/${plotId}/`).then((r) => r.data);

export const getLatestAnalysis = (plotId) =>
  client.get(`/api/engine/analysis/${plotId}/latest/`).then((r) => r.data);

export const getAlerts = () =>
  client.get('/api/engine/alerts/').then((r) => unpage(r.data));

export const markAlertRead = (alertId) =>
  client.put(`/api/engine/alerts/${alertId}/read/`).then((r) => r.data);

export const dismissAlert = (alertId) =>
  client.put(`/api/engine/alerts/${alertId}/dismiss/`).then((r) => r.data);
