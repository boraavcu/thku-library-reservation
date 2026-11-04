export const API_BASE = import.meta.env.PROD ? "/randevu/api" : "/api";
export const AUTH_BASE = `${API_BASE}/auth`;
export const APP_BASE = "/randevu";

export function appPath(path = "/") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}${clean}`;
}

export function appAbsoluteUrl(path = "/") {
  return `${window.location.origin}${appPath(path)}`;
}

export function stripAppBase(pathname = "/") {
  if (pathname === APP_BASE) return "/";
  if (pathname.startsWith(`${APP_BASE}/`)) {
    return pathname.slice(APP_BASE.length) || "/";
  }
  return pathname || "/";
}
