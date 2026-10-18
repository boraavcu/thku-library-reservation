require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Yardımcı tarih ve saat oluşturucular (Komutun çalıştırıldığı güne göre dinamik)
function getDateOffset(daysOffset) {
  const now = new Date();
  const trDateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const base = new Date(`${trDateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + daysOffset);
  return base;
}

function getTimeUTC(hour, minute = 0, second = 0) {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, second));
}

async function main() {
  console.log("🌱 THKÜ Kütüphane Sistemi Kapsamlı Sunum & Test Verileri Yükleniyor...");

  // 1. Önce eski hareket kayıtlarını temizle (Temiz ve tutarlı bir demo için)
  await prisma.reservationParticipant.deleteMany();
  await prisma.penaltyHistory.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.announcement.deleteMany();

  // 2. Yetkili Hesapları (SUPER_ADMIN, ADMIN, LIBRARIAN)
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@thk.edu.tr" },
    update: { role: "SUPER_ADMIN", fullName: "THKÜ Sistem Yöneticisi (BİM)", department: "Bilgi İşlem Müdürlüğü", acceptedAgreementVersion: "v1.0", isActive: true },
    create: { email: "admin@thk.edu.tr", fullName: "THKÜ Sistem Yöneticisi (BİM)", department: "Bilgi İşlem Müdürlüğü", role: "SUPER_ADMIN", acceptedAgreementVersion: "v1.0", isActive: true },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "mudur@thk.edu.tr" },
    update: { role: "ADMIN", fullName: "Kütüphane Müdürü (İdare)", department: "Kütüphane ve Dokümantasyon Daire Bşk.", acceptedAgreementVersion: "v1.0", isActive: true },
    create: { email: "mudur@thk.edu.tr", fullName: "Kütüphane Müdürü (İdare)", department: "Kütüphane ve Dokümantasyon Daire Bşk.", role: "ADMIN", acceptedAgreementVersion: "v1.0", isActive: true },
  });

  const librarianUser = await prisma.user.upsert({
    where: { email: "kutuphane@thk.edu.tr" },
    update: { role: "LIBRARIAN", fullName: "Kütüphane Görevlisi", department: "Kütüphane ve Dokümantasyon", acceptedAgreementVersion: "v1.0", isActive: true },
    create: { email: "kutuphane@thk.edu.tr", fullName: "Kütüphane Görevlisi", department: "Kütüphane ve Dokümantasyon", role: "LIBRARIAN", acceptedAgreementVersion: "v1.0", isActive: true },
  });

  // 3. 18 Öğrenci (Farklı Bölümlerden - 10'arlı Sayfalama ve Bölüm Analizi İçin)
  const studentDefinitions = [
    { email: "s250444902@stu.thk.edu.tr", fullName: "Bora Avcu (Öğrenci 1)", studentNumber: "250444902", department: "Bilgisayar Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s250201903@stu.thk.edu.tr", fullName: "Ayşe Yılmaz (Öğrenci 2)", studentNumber: "250201903", department: "Havacılık ve Uzay Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401001@stu.thk.edu.tr", fullName: "Mehmet Demir (Öğrenci 3)", studentNumber: "220401001", department: "Yazılım Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401002@stu.thk.edu.tr", fullName: "Zeynep Kaya (Öğrenci 4)", studentNumber: "220401002", department: "Elektrik-Elektronik Mühendisliği", penaltyPoints: 15, isBanned: false },
    // Caner Aydın: 2 adet No-Show'u var (30 puan). Canlı demoda 1 kez daha No-Show basılınca otomatik banlanacak!
    { email: "s220401003@stu.thk.edu.tr", fullName: "Caner Aydın (Öğrenci 5 - Sınırda)", studentNumber: "220401003", department: "Makine Mühendisliği", penaltyPoints: 30, isBanned: false },
    { email: "s220401004@stu.thk.edu.tr", fullName: "Elif Şahin (Öğrenci 6)", studentNumber: "220401004", department: "Endüstri Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401005@stu.thk.edu.tr", fullName: "Burak Çelik (Öğrenci 7)", studentNumber: "220401005", department: "Pilotaj", penaltyPoints: 0, isBanned: false },
    { email: "s220401006@stu.thk.edu.tr", fullName: "Selin Arslan", studentNumber: "220401006", department: "Bilgisayar Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401007@stu.thk.edu.tr", fullName: "Emre Koç", studentNumber: "220401007", department: "Havacılık ve Uzay Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401008@stu.thk.edu.tr", fullName: "Deniz Özkan", studentNumber: "220401008", department: "Yazılım Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401009@stu.thk.edu.tr", fullName: "Merve Çetin", studentNumber: "220401009", department: "Bilgisayar Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401010@stu.thk.edu.tr", fullName: "Oğuzhan Yıldız", studentNumber: "220401010", department: "Pilotaj", penaltyPoints: 0, isBanned: false },
    { email: "s220401011@stu.thk.edu.tr", fullName: "Ceren Aksoy", studentNumber: "220401011", department: "Endüstri Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401012@stu.thk.edu.tr", fullName: "Kaan Polat", studentNumber: "220401012", department: "Elektrik-Elektronik Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401013@stu.thk.edu.tr", fullName: "Gizem Güler", studentNumber: "220401013", department: "Havacılık ve Uzay Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "s220401014@stu.thk.edu.tr", fullName: "Tolga Doğan", studentNumber: "220401014", department: "Makine Mühendisliği", penaltyPoints: 15, isBanned: false },
    { email: "s220401015@stu.thk.edu.tr", fullName: "Büşra Korkmaz", studentNumber: "220401015", department: "Yazılım Mühendisliği", penaltyPoints: 0, isBanned: false },
    // Banlı örnek öğrenci (Yönetim panelinde "Banı Aç" butonunu göstermek için)
    {
      email: "s220401016@stu.thk.edu.tr",
      fullName: "Hakan Yavuz (Banlı Öğrenci)",
      studentNumber: "220401016",
      department: "Lojistik Yönetimi",
      penaltyPoints: 45,
      isBanned: true,
      banUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      banReason: "Dönem içinde 3 kez No-Show (Rezervasyona Gelmeme) kural ihlali.",
    },
  ];

  const students = [];
  for (const s of studentDefinitions) {
    const created = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        fullName: s.fullName,
        studentNumber: s.studentNumber,
        department: s.department,
        role: "STUDENT",
        penaltyPoints: s.penaltyPoints,
        isBanned: s.isBanned,
        banUntil: s.banUntil || null,
        banReason: s.banReason || null,
        acceptedAgreementVersion: "v1.0",
        isActive: true,
      },
      create: {
        email: s.email,
        fullName: s.fullName,
        studentNumber: s.studentNumber,
        department: s.department,
        role: "STUDENT",
        penaltyPoints: s.penaltyPoints,
        isBanned: s.isBanned,
        banUntil: s.banUntil || null,
        banReason: s.banReason || null,
        acceptedAgreementVersion: "v1.0",
        isActive: true,
      },
    });
    students.push(created);
  }
  console.log(`✅ ${students.length} öğrenci ve 3 yetkili kullanıcı hazır!`);

  // 4. Çalışma Odaları
  const roomList = [
    { roomNumber: "R101", name: "Atatürk", capacity: 7, isActive: true },
    { roomNumber: "R102", name: "Gökçen", capacity: 7, isActive: true },
    { roomNumber: "R103", name: "Uçantürk", capacity: 7, isActive: true },
    { roomNumber: "R104", name: "İstikbal", capacity: 7, isActive: true },
  ];

  const rooms = [];
  for (const r of roomList) {
    const rm = await prisma.room.upsert({
      where: { roomNumber: r.roomNumber },
      update: { name: r.name, capacity: r.capacity, isActive: r.isActive },
      create: r,
    });
    rooms.push(rm);
  }

  // 5. Aktif Sözleşme (v1.0) ve Kurallar
  const agreementContent = `1. Maksimum Rezervasyon Süresi
Çalışma odaları günde en fazla 3 saat süreyle rezerve edilebilir. Süre uzatmaları müsaitlik durumuna bağlıdır ve süre dolmadan 15 dakika önce danışmadan talep edilmelidir. Aynı grubun farklı isimlerle ardışık rezervasyon yapması yasaktır.

2. Geç Kalma / Gelmeme (No-Show)
Başlangıç saatinden itibaren 15 dakika içinde odaya giriş yapılmazsa rezervasyon otomatik olarak iptal edilir ve oda diğer öğrencilerin kullanımına açılır. Tekrarlanan gelmeme durumları (dönem içinde 3 kezden fazla), rezervasyon ayrıcalıklarının 30 güne kadar askıya alınmasına neden olabilir.

3. Sessizlik ve Kullanım Kuralları
Kullanıcılar akademik çalışmaya uygun sessiz bir ortam sağlamalıdır. Yüksek sesli konuşmalar, kulaklıksız müzik veya rahatsız edici davranışlara izin verilmez. Temizliği korumak için (kapalı şişedeki su hariç) yiyecek ve içecek tüketimi kesinlikle yasaktır.

4. Ekipman Sorumluluğu
Kullanıcılar rezervasyon süresince kütüphane mülküne, mobilyalara veya teknik ekipmanlara verilen her türlü hasardan sorumludur. Kütüphane ekipmanlarının fişini çekmeyiniz. Lütfen odaya girdiğinizde mevcut sorunları derhal bildirin.

5. Grup Çalışması
Çalışma odaları grup çalışması (en az 2 kişi) için tasarlanmıştır. Her oda en fazla 7 kişi kapasitesine sahiptir. Bireysel çalışan öğrenciler genel okuma salonlarını kullanmalıdır.

6. Günlük Rezervasyon Limiti
Her öğrenci günde yalnızca 1 (bir) adet rezervasyon yapabilir. Aynı gün içinde ikinci bir rezervasyon talebi sistem tarafından reddedilecektir.`;

  await prisma.agreement.updateMany({ data: { isActive: false } });
  await prisma.agreement.upsert({
    where: { version: "v1.0" },
    update: { title: "Kullanım Kuralları", content: agreementContent, isActive: true },
    create: { title: "Kullanım Kuralları", version: "v1.0", isActive: true, content: agreementContent },
  });

  const rules = [
    { ruleName: "MIN_PARTICIPANTS", ruleType: "INTEGER", ruleValue: { value: 2 } },
    { ruleName: "MAX_PARTICIPANTS", ruleType: "INTEGER", ruleValue: { value: 7 } },
    { ruleName: "MAX_DURATION_HOURS", ruleType: "INTEGER", ruleValue: { value: 3 } },
    { ruleName: "MAX_ADVANCE_DAYS", ruleType: "INTEGER", ruleValue: { value: 3 } },
    { ruleName: "DAILY_RELEASE_HOUR", ruleType: "INTEGER", ruleValue: { value: 8 } },
  ];

  for (const rule of rules) {
    await prisma.reservationRule.upsert({
      where: { ruleName: rule.ruleName },
      update: { ruleValue: rule.ruleValue, ruleType: rule.ruleType, isActive: true },
      create: { ruleName: rule.ruleName, ruleType: rule.ruleType, ruleValue: rule.ruleValue, isActive: true },
    });
  }

  // 6. Zengin Rezervasyon Verileri (Son 5 Gün + Bugün + Yarın)
  const nowHour = new Date().getHours();
  const activeHour = Math.min(20, Math.max(8, nowHour));
  const nextHour = Math.min(22, activeHour + 1);

  const sampleReservations = [
    // --- GEÇMİŞ GÜNLER (Günlük Trend, Isı Haritası ve Bölüm Analizi İçin) ---
    { dayOffset: -5, roomIdx: 0, orgIdx: 0, partIdxs: [1, 7, 10], startH: 10, endH: 13, status: "COMPLETED", purpose: "Algoritma Analizi Proje Çalışması" },
    { dayOffset: -5, roomIdx: 1, orgIdx: 2, partIdxs: [9, 16], startH: 14, endH: 16, status: "COMPLETED", purpose: "Yazılım Mimarisi Sunum Hazırlığı" },
    { dayOffset: -4, roomIdx: 0, orgIdx: 1, partIdxs: [8, 14], startH: 9, endH: 12, status: "COMPLETED", purpose: "Aerodinamik Rüzgar Tüneli Raporu" },
    { dayOffset: -4, roomIdx: 2, orgIdx: 5, partIdxs: [12, 3], startH: 13, endH: 16, status: "COMPLETED", purpose: "Yöneylem Araştırması Vaka Analizi" },
    { dayOffset: -4, roomIdx: 3, orgIdx: 6, partIdxs: [11], startH: 16, endH: 18, status: "COMPLETED", purpose: "Uçuş Planlama ve Meteoroloji" },
    { dayOffset: -3, roomIdx: 1, orgIdx: 0, partIdxs: [2, 7, 9], startH: 11, endH: 14, status: "COMPLETED", purpose: "Veritabanı Yönetim Sistemleri" },
    { dayOffset: -3, roomIdx: 2, orgIdx: 4, partIdxs: [15], startH: 14, endH: 17, status: "NO_SHOW", purpose: "Termodinamik Grup Çalışması", noShow: true, penaltyApplied: true },
    { dayOffset: -2, roomIdx: 0, orgIdx: 3, partIdxs: [13, 7], startH: 10, endH: 13, status: "COMPLETED", purpose: "Sayısal Tasarım Laboratuvarı" },
    { dayOffset: -2, roomIdx: 3, orgIdx: 4, partIdxs: [15], startH: 15, endH: 17, status: "NO_SHOW", purpose: "Mukavemet Soru Çözümü", noShow: true, penaltyApplied: true },
    { dayOffset: -1, roomIdx: 0, orgIdx: 1, partIdxs: [8, 14, 6], startH: 10, endH: 13, status: "COMPLETED", purpose: "Uçak Yapıları ve Malzeme" },
    { dayOffset: -1, roomIdx: 1, orgIdx: 2, partIdxs: [0, 9, 10], startH: 13, endH: 16, status: "COMPLETED", purpose: "Full-Stack Web Geliştirme Toplantısı" },
    { dayOffset: -1, roomIdx: 2, orgIdx: 5, partIdxs: [12], startH: 19, endH: 22, status: "COMPLETED", purpose: "Gece Vize Çalışma Grubu" },

    // --- BUGÜN (Canlı Oda Yoğunluğu, Gelecek 1 Saat Radarı ve Müdahale Testi İçin) ---
    { dayOffset: 0, roomIdx: 0, orgIdx: 7, partIdxs: [10, 9], startH: 9, endH: 12, status: "COMPLETED", purpose: "Veri Yapıları Çalışması" },
    { dayOffset: 0, roomIdx: 1, orgIdx: 8, partIdxs: [14, 6], startH: activeHour, endH: Math.min(23, activeHour + 2), status: "CHECKED_IN", purpose: "İtkı Sistemleri Tasarımı (Şu An Odada)" },
    { dayOffset: 0, roomIdx: 2, orgIdx: 4, partIdxs: [15, 13], startH: nextHour, endH: Math.min(24, nextHour + 2), status: "CONFIRMED", purpose: "Caner'in Randevusu (No-Show Testi İçin)" },
    { dayOffset: 0, roomIdx: 3, orgIdx: 11, partIdxs: [12, 16], startH: nextHour, endH: Math.min(24, nextHour + 3), status: "CONFIRMED", purpose: "Simülasyon ve Kontrol Grubu" },

    // --- YARIN (Gelecek Randevular ve Davet Testi İçin) ---
    { dayOffset: 1, roomIdx: 0, orgIdx: 1, partIdxs: [0, 2], startH: 10, endH: 13, status: "PENDING", purpose: "Yarınki Disiplinlerarası Proje Toplantısı" },
    { dayOffset: 1, roomIdx: 1, orgIdx: 5, partIdxs: [12, 13], startH: 14, endH: 17, status: "CONFIRMED", purpose: "Mühendislik Ekonomisi Sunumu" },
  ];

  const createdReservations = [];
  for (const item of sampleReservations) {
    const orgUser = students[item.orgIdx];
    const room = rooms[item.roomIdx];

    const res = await prisma.reservation.create({
      data: {
        roomId: room.id,
        userId: orgUser.id,
        reservationDate: getDateOffset(item.dayOffset),
        startTime: getTimeUTC(item.startH),
        endTime: item.endH >= 24 ? getTimeUTC(23, 59, 59) : getTimeUTC(item.endH),
        purpose: item.purpose,
        status: item.status,
        noShow: Boolean(item.noShow),
        penaltyApplied: Boolean(item.penaltyApplied),
        checkedInAt: item.status === "CHECKED_IN" || item.status === "COMPLETED" ? new Date() : null,
        checkedInById: item.status === "CHECKED_IN" || item.status === "COMPLETED" ? orgUser.id : null,
        participants: {
          create: item.partIdxs.map((pIdx, idx) => ({
            userId: students[pIdx].id,
            status: item.status === "PENDING" && idx === 0 ? "PENDING" : "ACCEPTED",
            joinedAt: new Date(),
          })),
        },
      },
    });
    createdReservations.push(res);
  }
  console.log(`✅ ${createdReservations.length} adet geçmiş, bugünkü ve gelecek rezervasyon oluşturuldu!`);

  // 7. Ceza Kayıtları (Caner Aydın'a 2 adet aktif No-Show, Hakan Yavuz'a 3 adet No-Show)
  const caner = students[4];
  const hakan = students[17];

  await prisma.penaltyHistory.createMany({
    data: [
      { userId: caner.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "R103 - Uçantürk odası rezervasyonuna gelinmedi (1. İhlal).", isActive: true },
      { userId: caner.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "R104 - İstikbal odası rezervasyonuna gelinmedi (2. İhlal - Sınırda!).", isActive: true },
      { userId: hakan.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "1. No-Show İhlali", isActive: true },
      { userId: hakan.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "2. No-Show İhlali", isActive: true },
      { userId: hakan.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "3. No-Show İhlali (Otomatik 30 Gün Ban)", isActive: true },
    ],
  });

  // 8. Duyurular (Dashboard ve Bildirim Zili İçin)
  await prisma.announcement.createMany({
    data: [
      {
        title: {
          tr: "7/24 Grup Çalışma Odaları ve Kiosk Check-In Sistemi Aktif Edildi",
          en: "24/7 Group Study Rooms and Kiosk Check-In System is Now Active",
        },
        content: {
          tr: "Kütüphanemiz 7/24 hizmet vermektedir. Rezervasyon başlangıç saatinden itibaren 15 dakika içinde Kiosk kodunu girerek giriş yapmayı unutmayınız. Odanın bir sonraki saati boşsa panelinizden +1 saat uzatma yapabilirsiniz.",
          en: "Our library is open 24/7. Please remember to check in with the Kiosk code within 15 minutes of your start time. If the next hour is free, you can extend your session by +1 hour.",
        },
        priority: "HIGH",
        isPinned: true,
        isActive: true,
        createdBy: superAdmin.id,
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        title: {
          tr: "Vize Dönemi Grup Çalışma Odaları Kullanım Kuralları Hatırlatması",
          en: "Midterm Period Study Room Usage Rules Reminder",
        },
        content: {
          tr: "Her öğrencimiz (organizatör veya katılımcı olarak) günde 1 rezervasyon hakkına sahiptir. Erken ayrılmanız durumunda 'Odayı Erken Boşalt' butonunu kullanarak odayı diğer arkadaşlarınıza açabilirsiniz.",
          en: "Each student has 1 booking right per day. If you leave early, please use the 'Early Check-Out' button to free the room for other students.",
        },
        priority: "MEDIUM",
        isPinned: false,
        isActive: true,
        createdBy: adminUser.id,
        publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      },
    ],
  });

  // 9. SUPER_ADMIN İçin 12 Adet Öğrenci Logu ve 12 Adet Yönetici Logu (10'arlı Sayfalama Testi İçin)
  for (let i = 0; i < 12; i++) {
    const st = students[i % students.length];
    const rm = rooms[i % rooms.length];
    await prisma.auditLog.create({
      data: {
        userId: st.id,
        action: i % 3 === 0 ? "RESERVATION_CREATED" : i % 3 === 1 ? "INVITATION_ACCEPTED" : "RESERVATION_CHECKED_IN",
        entityType: "Reservation",
        newData: {
          room: `${rm.roomNumber} - ${rm.name}`,
          date: getDateOffset(-1).toISOString().split("T")[0],
          time: "10:00 - 13:00",
          organizer: st.email,
          invitedParticipants: [students[(i + 1) % students.length].email],
        },
      },
    });
  }

  for (let i = 0; i < 12; i++) {
    await prisma.adminAction.create({
      data: {
        adminId: i % 2 === 0 ? superAdmin.id : librarianUser.id,
        actionType: i % 3 === 0 ? "RESERVATION_FORCE_CHECKIN" : i % 3 === 1 ? "ROOM_UPDATED" : "PENALTY_ADDED",
        targetEntityType: "Reservation",
        description:
          i % 3 === 0
            ? `R10${(i % 4) + 1} odası için görevli tarafından manuel check-in onaylandı.`
            : i % 3 === 1
            ? `R10${(i % 4) + 1} çalışma odası rutin kontrol sonrası aktif duruma getirildi.`
            : `No-Show kural ihlali nedeniyle +15 ceza puanı işlendi.`,
      },
    });
  }

  console.log("✅ Tüm analiz, grafik, ceza ve 10'arlı sayfalama verileri başarıyla yüklendi!");
}

main()
  .catch((e) => {
    console.error("❌ Seed Hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });