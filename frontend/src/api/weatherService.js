import client from './client';

export const getWeather = (farmId) =>
  client.get(`/api/weather/${farmId}/`).then((r) => r.data);

export const refreshWeather = (farmId) =>
  client.post(`/api/weather/${farmId}/refresh/`).then((r) => r.data);

export const getWeatherSummary = (farmId) =>
  client.get(`/api/weather/${farmId}/summary/`).then((r) => r.data);
