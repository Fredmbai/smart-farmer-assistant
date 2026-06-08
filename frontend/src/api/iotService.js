import client from './client';

const unpage = (data) => (Array.isArray(data) ? data : (data?.results ?? []));

export const getSensors = (plotId) =>
  client.get(`/api/iot/sensors/plots/${plotId}/`).then((r) => unpage(r.data));

export const getLatestReading = (plotId) =>
  client.get(`/api/iot/readings/${plotId}/latest/`).then((r) => r.data);

export const getReadings = (plotId) =>
  client.get(`/api/iot/readings/${plotId}/`).then((r) => unpage(r.data));

export const submitManualReading = (data) =>
  client.post('/api/iot/readings/manual/', data).then((r) => r.data);
