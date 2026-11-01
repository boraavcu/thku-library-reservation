export const THKU_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png";
export const STAFF_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"];
export const ITEMS_PER_PAGE = 10;

export const DEPT_EN_MAP = {
  "Bilgisayar Mühendisliği": "Computer Engineering",
  "Havacılık ve Uzay Mühendisliği": "Aerospace Engineering",
  "Yazılım Mühendisliği": "Software Engineering",
  "Elektrik-Elektronik Mühendisliği": "Electrical & Electronics Eng.",
  "Makine Mühendisliği": "Mechanical Engineering",
  "Endüstri Mühendisliği": "Industrial Engineering",
  "Pilotaj": "Flight Training (Pilotage)",
  "Lojistik Yönetimi": "Logistics Management",
  "Belirtilmemiş": "Unspecified",
};

export const RULE_META = {
  MIN_PARTICIPANTS: {
    title: "Minimum Katılımcı Sayısı (Kişi)",
    titleEn: "Minimum Participants Required",
    desc: "Bir çalışma odasının rezerve edilebilmesi için gereken en az öğrenci sayısı (Varsayılan: 2 Kişi).",
    descEn: "Minimum number of students required to book a study room (Default: 2).",
    unit: "Kişi",
    unitEn: "People",
    min: 2,
    max: 8,
    step: 1,
  },
  MAX_PARTICIPANTS: {
    title: "Maksimum Oda Kapasitesi (Kişi)",
    titleEn: "Maximum Room Capacity",
    desc: "Bir çalışma odasına aynı anda girebilecek en fazla öğrenci sayısı (Varsayılan: 8 Kişi).",
    descEn: "Maximum number of students allowed in a study room (Default: 8).",
    unit: "Kişi",
    unitEn: "People",
    min: 2,
    max: 16,
    step: 1,
  },
  MAX_DURATION_HOURS: {
    title: "Günlük Maksimum Rezervasyon Süresi (Saat)",
    titleEn: "Maximum Daily Booking Duration (Hours)",
    desc: "Bir grubun günde tek seferde alabileceği en uzun çalışma süresi (Varsayılan: 3 Saat, Uzatma Yok).",
    descEn: "Maximum study duration per group per day (Default: 3 Hours, No Extensions).",
    unit: "Saat",
    unitEn: "Hours",
    min: 1,
    max: 6,
    step: 1,
  },
  MAX_ADVANCE_DAYS: {
    title: "İleri Tarihli Rezervasyon Sınırı (Gün)",
    titleEn: "Advance Booking Window (Days)",
    desc: "Öğrencilerin kaç gün sonrasına kadar rezervasyon yapabileceği (Varsayılan: 1 Gün).",
    descEn: "How many days in advance students can book a room (Default: 1 Day).",
    unit: "Gün",
    unitEn: "Days",
    min: 1,
    max: 14,
    step: 1,
  },
  DAILY_RELEASE_HOUR: {
    title: "Yeni Gün Kotalarının Açılış Saati",
    titleEn: "Daily Quota Release Hour",
    desc: "İleri tarihli yeni gün rezervasyonlarının sabah saat kaçta açılacağı.",
    descEn: "The morning hour at which new daily booking slots open.",
    unit: ":00",
    unitEn: ":00",
    min: 0,
    max: 23,
    step: 1,
  },
  CHECKIN_TOLERANCE_MINUTES: {
    title: "Kapı QR Yoklama Tolerans Süresi (± Dakika)",
    titleEn: "Door QR Check-In Tolerance Window (± Mins)",
    desc: "Randevu başlangıç saatinden kaç dakika öncesi ve sonrasında kapı QR onayının açık kalacağı (Varsayılan: ±15 Dk).",
    descEn: "Minutes before and after the start time during which door QR check-in is open (Default: ±15 Mins).",
    unit: "Dakika",
    unitEn: "Mins",
    min: 10,
    max: 60,
    step: 5,
  },
  CANCEL_LOCK_MINUTES: {
    title: "Son İptal Kilidi Süresi (Dakika)",
    titleEn: "Last-Minute Cancellation Lock (Mins)",
    desc: "Randevu başlangıcına kaç dakika kala iptal işleminin kilitleneceği (Varsayılan: 60 Dk / 1 Saat).",
    descEn: "Minutes before start time when cancellation is locked (Default: 60 Mins / 1 Hour).",
    unit: "Dakika",
    unitEn: "Mins",
    min: 15,
    max: 180,
    step: 15,
  },
};

export function formatAuditLog(log, isEn) {
  const actor = log.user?.fullName || log.user?.email || (isEn ? "System / Student" : "Sistem / Öğrenci");
  const d = log.newData || {};
  const old = log.oldData || {};

  switch (log.action) {
    case "RESERVATION_CREATED":
      return {
        badge: isEn ? "New Booking" : "Yeni Rezervasyon",
        color: "primary",
        title: isEn
          ? `${actor} created a new group study room reservation.`
          : `${actor} yeni bir grup çalışma odası rezervasyonu oluşturdu.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Date: ${d.date || "-"} | Time: ${d.time || "-"} | Invited: ${(d.invitedParticipants || []).join(", ") || "None"}`
          : `Oda: ${d.room || "-"} | Tarih: ${d.date || "-"} | Saat: ${d.time || "-"} | Davet Edilenler: ${(d.invitedParticipants || []).join(", ") || "Yok"}`,
      };
    case "RESERVATION_CHECKED_IN":
      return {
        badge: isEn ? "Door QR Check-In" : "Kişisel Kiosk Girişi",
        color: "success",
        title: isEn
          ? `${actor} completed personal verification via the door QR code.`
          : `${actor} kapı QR kodundan kişisel doğrulama onayı vererek yoklamasını tamamladı.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Verified By: ${d.checkedInBy || actor} | Group Progress: ${d.progress || "-"}`
          : `Oda: ${d.room || "-"} | Doğrulayan: ${d.checkedInBy || actor} | Grup İlerlemesi: ${d.progress || "-"}`,
      };
    case "AUTO_NO_SHOW_PENALTY":
      return {
        badge: isEn ? `Auto No-Show (${d.warningCount || "1/3"})` : `Oto No-Show Uyarısı (${d.warningCount || "1/3"})`,
        color: "warning",
        title: isEn
          ? `${actor} did not scan the door QR code in time and received an automatic No-Show warning.`
          : `${actor} süresi içinde kapı QR kodunu okutmadığı için otomatik No-Show uyarısı aldı.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Date: ${d.date || "-"} | Time: ${d.time || "-"} | Warning: ${d.warningCount || "-"}`
          : `Oda: ${d.room || "-"} | Tarih: ${d.date || "-"} | Saat: ${d.time || "-"} | Güncel Uyarı: ${d.warningCount || "-"}`,
      };
    case "AUTO_NO_SHOW_BANNED":
      return {
        badge: isEn ? "Auto 3/3 Ban (30 Days)" : "Oto 3/3 Ban (30 Gün)",
        color: "error",
        title: isEn
          ? `${actor} reached 3/3 No-Show warnings and was automatically banned for 30 days.`
          : `${actor} 3/3 No-Show uyarısına ulaştığı için sistem tarafından 30 gün otomatik banlandı.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Time: ${d.time || "-"} | Ban Until: ${d.banUntil || "30 Days"}`
          : `Oda: ${d.room || "-"} | Saat: ${d.time || "-"} | Ban Bitiş: ${d.banUntil || "30 Gün"}`,
      };
    case "AUTO_KIOSK_CANCELLED":
      return {
        badge: isEn ? "Auto Kiosk Cancelled" : "Oto Kiosk İptali (Oda Boşa Çıktı)",
        color: "error",
        title: isEn
          ? `Reservation for ${d.room || "Room"} was automatically cancelled due to insufficient door QR check-ins.`
          : `${d.room || "Oda"} randevusu süresi içinde kapı QR onayı tamamlanmadığı için otomatik iptal edildi ve oda boşa çıkarıldı.`,
        detail: isEn
          ? `Date: ${d.date || "-"} | Time: ${d.time || "-"} | Check-In Progress: ${d.progress || "-"}`
          : `Tarih: ${d.date || "-"} | Saat: ${d.time || "-"} | Kiosk Onay Durumu: ${d.progress || "-"}`,
      };
    case "AUTO_TIMEOUT_CANCELLED":
      return {
        badge: isEn ? "30m Invite Timeout" : "30 Dk Davet Süre Aşımı",
        color: "warning",
        title: isEn
          ? `${actor}'s reservation request was cancelled because invitations were not accepted within 30 minutes.`
          : `${actor} tarafından oluşturulan randevu, davetler 30 dk içinde onaylanmadığı için otomatik iptal edildi.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Date: ${d.date || "-"} | Time: ${d.time || "-"}`
          : `Oda: ${d.room || "-"} | Tarih: ${d.date || "-"} | Saat: ${d.time || "-"}`,
      };
    case "RESERVATION_CANCELLED":
      return {
        badge: isEn ? "Cancelled" : "İptal Edildi",
        color: "error",
        title: isEn ? `${actor} cancelled the reservation.` : `${actor} rezervasyonu iptal etti.`,
        detail: isEn
          ? `Room: ${old.room || "-"} | Reason: ${d.reason || "User cancellation"}`
          : `Oda: ${old.room || "-"} | Sebep: ${d.reason || "Kullanıcı iptali"}`,
      };
    case "RESERVATION_EARLY_CHECKOUT":
      return {
        badge: isEn ? "Early Check-Out" : "Erken Boşaltma",
        color: "info",
        title: isEn
          ? `${actor} finished early and released the room for other students.`
          : `${actor} çalışmasını erken tamamlayarak odayı diğer öğrencilere açtı.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Released By: ${d.releasedBy || actor}`
          : `Oda: ${d.room || "-"} | İşlemi Yapan: ${d.releasedBy || actor}`,
      };
    case "INVITATION_ACCEPTED":
      return {
        badge: isEn ? "Invite Accepted" : "Davet Kabulü",
        color: "success",
        title: isEn
          ? `${actor} accepted the group study invitation.`
          : `${actor} kendisine gelen grup çalışma davetini kabul etti.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Participant: ${d.participantEmail || actor}`
          : `Oda: ${d.room || "-"} | Katılımcı: ${d.participantEmail || actor}`,
      };
    case "INVITATION_REJECTED":
      return {
        badge: isEn ? "Invite Rejected" : "Davet Reddi",
        color: "warning",
        title: isEn
          ? `${actor} rejected the group study invitation.`
          : `${actor} grup çalışma davetini reddetti.`,
        detail: isEn
          ? `Room: ${d.room || "-"} | Participant: ${d.participantEmail || actor}`
          : `Oda: ${d.room || "-"} | Katılımcı: ${d.participantEmail || actor}`,
      };
    default:
      return {
        badge: log.action,
        color: "default",
        title: isEn ? `${actor} performed a system action.` : `${actor} sistem üzerinde bir işlem gerçekleştirdi.`,
        detail: `Target: ${log.entityType || "-"}`,
      };
  }
}