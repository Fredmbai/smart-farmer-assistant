import client from './client';

export const register = (phone_number, full_name, password, county) =>
  client
    .post('/api/auth/register/', { phone_number, full_name, password, county })
    .then((r) => r.data);

export const verifyOtp = (phone_number, otp) =>
  client
    .post('/api/auth/verify-otp/', { phone_number, otp })
    .then((r) => r.data);

export const resendOtp = (phone) =>
  client
    .post('/api/auth/resend-otp/', { phone_number: phone })
    .then((r) => r.data);

export const login = (phone_number, password) =>
  client
    .post('/api/auth/login/', { phone_number, password })
    .then((r) => r.data);

export const logout = (refresh_token) =>
  client
    .post('/api/auth/logout/', { refresh: refresh_token })
    .then((r) => r.data);

export const updateProfile = (data) =>
  client
    .put('/api/auth/profile/', data)
    .then((r) => r.data);

export const refreshToken = (refresh) =>
  client
    .post('/api/auth/token/refresh/', { refresh })
    .then((r) => r.data);
