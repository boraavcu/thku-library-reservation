/**
 * Tüm Backend uç noktaları için merkezi Europe/Istanbul saat dilimi, UTC zaman hesaplama
 * ve HTML güvenlik (escape) yardımcıları.
 */

export function getIstanbulTimeDetails(dateInput = new Date()) {
  const d = new Date(dateInput);
  const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const todayDate = new Date(`${dateStr}T00:00:00Z`);

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hour = Number(timeParts.find((p) => p.type === "hour").value);
  const minute = Number(timeParts.find((p) => p.type === "minute").value);

  return {
    dateStr,
    todayDate,
    hour,
    minute,
    totalMins: hour * 60 + minute,
  };
}

export function fmtTimeUTC(dt) {
  const d = new Date(dt);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === 23 && m >= 59) return "24:00";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtDateUTC(dt, locale = "tr-TR") {
  return new Date(dt).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtMinsToTime(totalMins) {
  const normalized = Math.max(0, Math.min(24 * 60, totalMins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseReservationMinutesUTC(reservation) {
  const startDt = new Date(reservation.startTime);
  const endDt = new Date(reservation.endTime);

  const startH = startDt.getUTCHours();
  const startM = startDt.getUTCMinutes();
  const endH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
  const endM = endH === 24 ? 0 : endDt.getUTCMinutes();

  return {
    startH,
    startM,
    endH,
    endM,
    startTotalMins: startH * 60 + startM,
    endTotalMins: endH * 60 + endM,
  };
}

/**
 * Normal randevular (createdAt <= startTotalMins) için sabit [start - tol, start + tol] penceresi,
 * Boşa düşen odayı ara dakikada tutan (Walk-In: createdAt > startTotalMins) gruplar için
 * [createdAt, createdAt + tol] penceresi döndürür.
 */
export function getReservationKioskWindow(reservation, todayTrStr, toleranceMinutes = 15) {
  const { startTotalMins } = parseReservationMinutesUTC(reservation);

  if (reservation.createdAt) {
    const createdInfo = getIstanbulTimeDetails(reservation.createdAt);
    if (createdInfo.dateStr === todayTrStr && createdInfo.totalMins > startTotalMins) {
      return {
        startTotalMins,
        minAllowed: createdInfo.totalMins,
        maxAllowed: createdInfo.totalMins + toleranceMinutes,
      };
    }
  }

  return {
    startTotalMins,
    minAllowed: startTotalMins - toleranceMinutes,
    maxAllowed: startTotalMins + toleranceMinutes,
  };
}

/**
 * E-posta ve bildirim şablonlarında HTML/XSS enjeksiyonunu önleyen yardımcı fonksiyon.
 */
export function escapeHtml(input) {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
