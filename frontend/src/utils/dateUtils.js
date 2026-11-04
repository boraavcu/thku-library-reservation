/**
 * Tüm Frontend sayfaları için ortak Europe/Istanbul saat dilimi ve UTC saat/tarih formatlayıcıları.
 */

export function toDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getIstanbulNowParts() {
  const now = new Date();
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(timeParts.find((p) => p.type === "hour").value);
  const minute = Number(timeParts.find((p) => p.type === "minute").value);
  const nowMinutes = hour * 60 + minute;

  return {
    todayIso,
    todayStr: todayIso,
    hour,
    minute,
    nowMinutes,
  };
}

// ReserveForm.jsx ve StudyRooms.jsx uyumluluğu için alias
export function getIstanbulNowInfo() {
  return getIstanbulNowParts();
}

/**
 * Bir randevunun bitiş saatinin (Europe/Istanbul) geçip geçmediğini kontrol eder.
 * Backend lifecycle senkronizasyonuna ek olarak istemci tarafında da süresi bitmiş
 * randevuların anında geçmiş olarak sınıflandırılmasını garanti eder.
 */
export function isReservationEnded(res) {
  if (!res?.reservationDate || !res?.endTime) return false;
  const { todayIso, nowMinutes } = getIstanbulNowParts();
  const resDateIso = new Date(res.reservationDate).toISOString().split("T")[0];

  if (resDateIso < todayIso) return true;
  if (resDateIso > todayIso) return false;

  const endDt = new Date(res.endTime);
  const endH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
  const endM = endH === 24 ? 0 : endDt.getUTCMinutes();
  const endMinutes = endH * 60 + endM;

  return nowMinutes >= endMinutes;
}

export function getFutureDateStr(daysToAdd) {
  const { todayIso } = getIstanbulNowParts();
  const base = new Date(`${todayIso}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + Number(daysToAdd || 0));
  return base.toISOString().split("T")[0];
}

export function fmtTimeUTC(timeStr) {
  const d = new Date(timeStr);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === 23 && m >= 59) return "24:00";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtDateShortUTC(dateStr, isEn = false) {
  return new Date(dateStr).toLocaleDateString(isEn ? "en-US" : "tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtDateLongUTC(dateStr, isEn = false) {
  return new Date(dateStr).toLocaleDateString(isEn ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
