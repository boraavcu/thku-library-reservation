const LOCAL_FALLBACK = "http://localhost:5173/randevu";

export function getFrontendBaseUrl() {
  const raw = (process.env.FRONTEND_URL || LOCAL_FALLBACK).trim().replace(/\/+$/, "");
  if (raw.endsWith("/randevu")) return raw;

  try {
    const parsed = new URL(raw);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      return `${parsed.origin}/randevu`;
    }
  } catch {
    return LOCAL_FALLBACK;
  }

  return raw;
}

export function getFrontendOrigin() {
  try {
    return new URL(getFrontendBaseUrl()).origin;
  } catch {
    return "http://localhost:5173";
  }
}

export function getBrowserCookiePath() {
  return process.env.NODE_ENV === "production" ? "/randevu" : "/";
}
