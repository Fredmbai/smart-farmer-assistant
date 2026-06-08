import client from './client';

export const scanImage = (plotId, imageUri) => {
  const form = new FormData();
  form.append('plot', plotId);
  form.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'scan.jpg',
  });
  // Explicit Content-Type lets React Native's networking layer set the
  // multipart boundary automatically (do NOT hard-code it here).
  return client
    .post('/api/vision/scan/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const getScans = (plotId) =>
  client.get(`/api/vision/scans/${plotId}/`).then((r) => r.data);
