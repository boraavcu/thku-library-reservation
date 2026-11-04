import axios from 'axios';
import { API_BASE } from './runtimePaths';

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

// Gizli Sekmede (Incognito) ve farklı yakınlaştırma (zoom) seviyelerinde asla değişmeyen Donanım Parmak İzi
function getHardwareFingerprint() {
  try {
    let gpuRenderer = 'unknown-gpu';
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'webgl-std';
      }
    }

    const screenW = window.screen?.width || 0;
    const screenH = window.screen?.height || 0;
    const maxDim = Math.max(screenW, screenH);
    const minDim = Math.min(screenW, screenH);

    const rawTraits = [
      navigator.platform || '',
      navigator.hardwareConcurrency || '',
      `${maxDim}x${minDim}x${window.screen?.colorDepth || 24}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      navigator.maxTouchPoints || 0,
      gpuRenderer,
    ].join('|');

    // Basit ve hızlı 32-bit FNV-1a Hash
    let hash = 2166136261;
    for (let i = 0; i < rawTraits.length; i++) {
      hash ^= rawTraits.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return `hw_${(hash >>> 0).toString(16)}`;
  } catch {
    return 'hw_fallback';
  }
}

function getNetworkConnectionType() {
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return conn?.type || conn?.effectiveType || 'unknown';
  } catch {
    return 'unknown';
  }
}

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.headers['x-device-id'] = getOrCreateDeviceId();
  config.headers['x-hardware-fp'] = getHardwareFingerprint();
  config.headers['x-net-type'] = getNetworkConnectionType();
  return config;
});

export default api;
