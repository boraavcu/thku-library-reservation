import axios from 'axios';

function getOrCreateDeviceId() {
  try {
    let deviceId = localStorage.getItem('thku_kiosk_device_id');
    if (!deviceId) {
      const randomPart = Math.random().toString(36).substring(2, 12);
      const timePart = Date.now().toString(36);
      deviceId = `dev_${timePart}_${randomPart}`;
      localStorage.setItem('thku_kiosk_device_id', deviceId);
    }
    return deviceId;
  } catch {
    return 'dev_fallback_browser';
  }
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.headers['x-device-id'] = getOrCreateDeviceId();
  return config;
});

export default api;