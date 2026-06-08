import client from './client';

const unpage = (data) => (Array.isArray(data) ? data : (data?.results ?? []));

export const getPrices = () =>
  client.get('/api/market/prices/').then((r) => unpage(r.data));

export const getTrend = () =>
  client.get('/api/market/prices/trend/').then((r) => r.data);

export const reportPrice = (data) =>
  client.post('/api/market/prices/farmer-report/', data).then((r) => r.data);
